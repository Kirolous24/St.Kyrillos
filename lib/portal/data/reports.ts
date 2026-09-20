// Every database read behind the reports area, the notification bell and the
// report cards. Queries are always scoped to the classes the caller may see and
// select only the columns the report needs — the prototype downloaded whole
// collections and filtered in JS (ANALYSIS §7).

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { PortalUser, StageKey } from '../permissions'
import { visibleClassIds } from '../permissions'
import { requireClassAccess, listVisibleClasses } from './classes'
import { studentName } from './students'
import { rankStudents } from '../points-math'
import { todayInNewYork, toUTCDate, newYorkDayStart, formatDateOnly, addDays } from '../dates'
import {
  attendanceRate,
  countAttendanceCells,
  heldOccasions,
  occasionKey,
  buildMonthMatrix,
  classSummary,
  churchTotals,
  buildReportCard,
  monthRange,
  type AttendanceRow,
  type ClassSummaryRow,
  type MonthMatrix,
  type ReportCard,
} from '../reports'
import {
  buildNotifications,
  unreadNotifications,
  type PortalNotification,
} from '../notifications'

export interface SessionOption {
  key: string
  label: string
  points: number
}

/**
 * Class-wide reports are staff-only.
 *
 * `class.read` alone cannot express that: permissions.ts grants a STUDENT
 * `class.read` for the class they sit in, so gating a roster-wide report on it
 * would hand every classmate's attendance — reason and note fields included —
 * to any signed-in student. The role check on the reports page does not protect
 * a server action, which is a separately invokable POST endpoint, so every
 * class-wide loader and export funnels through this instead.
 */
export function isReportsStaff(user: PortalUser): boolean {
  return user.role !== 'STUDENT'
}

export async function listSessions(): Promise<SessionOption[]> {
  const rows = await prisma.attendanceSession.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { key: true, label: true, points: true },
  })
  return rows
}

/* ── Notifications ────────────────────────────────────────────────────────── */

/**
 * The signed-in person's undismissed notifications, computed live.
 * Mount the bell with these: `<NotificationBell />` loads them itself.
 */
export const loadNotifications = cache(async (user: PortalUser): Promise<PortalNotification[]> => {
  const today = todayInNewYork()
  const [items, read] = await Promise.all([
    buildFacts(user, today),
    prisma.notificationRead.findMany({ where: { accountId: user.accountId }, select: { key: true } }),
  ])
  return unreadNotifications(items, read.map((r) => r.key))
})

async function buildFacts(user: PortalUser, today: string): Promise<PortalNotification[]> {
  if (user.role === 'STUDENT') {
    if (!user.studentId) return []
    const me = await prisma.student.findUnique({
      where: { id: user.studentId },
      select: { dob: true, classId: true, class: { select: { stage: true } } },
    })
    if (!me) return []
    const stage = me.class?.stage ?? undefined
    const [exams, announcements] = await Promise.all([
      prisma.exam.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            ...(me.classId ? [{ classId: me.classId }] : []),
            ...(stage ? [{ stage, classId: null }] : []),
          ],
          results: { none: { studentId: user.studentId } },
        },
        orderBy: [{ dueDate: 'asc' }],
        take: 5,
        select: { id: true, title: true, dueDate: true },
      }),
      prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [
            { classId: null, stage: null },
            ...(stage ? [{ classId: null, stage }] : []),
            ...(me.classId ? [{ classId: me.classId }] : []),
          ],
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
        select: { id: true, title: true, date: true, createdAt: true },
      }),
    ])
    return buildNotifications('STUDENT', {
      today,
      pendingExams: exams.map((e) => ({
        id: e.id,
        title: e.title,
        dueDate: e.dueDate ? formatDateOnly(e.dueDate) : null,
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        date: a.date ? formatDateOnly(a.date) : todayInNewYork(a.createdAt),
      })),
      ownBirthday: me.dob ? formatDateOnly(me.dob) : null,
    })
  }

  if (user.role === 'SERVANT') {
    const classes = await listVisibleClasses(user)
    const classIds = classes.map((c) => c.id)
    if (classIds.length === 0) return buildNotifications('SERVANT', { today })
    const [students, openCases, autoCases] = await Promise.all([
      prisma.student.findMany({
        where: { classId: { in: classIds }, dob: { not: null } },
        select: { id: true, firstName: true, lastName: true, dob: true },
      }),
      prisma.followUpCase.count({ where: { classId: { in: classIds }, status: 'OPEN' } }),
      prisma.followUpCase.findMany({
        where: { classId: { in: classIds }, status: 'OPEN', origin: 'AUTO', consecutiveAbsences: { gte: 3 } },
        orderBy: { consecutiveAbsences: 'desc' },
        take: 10,
        select: { studentId: true, consecutiveAbsences: true, student: { select: { firstName: true, lastName: true } } },
      }),
    ])
    return buildNotifications('SERVANT', {
      today,
      birthdays: students
        .filter((s) => s.dob)
        .map((s) => ({ id: s.id, name: studentName(s), dob: formatDateOnly(s.dob!) })),
      openCases,
      absenceStreaks: autoCases.map((c) => ({
        studentId: c.studentId,
        name: studentName(c.student),
        streak: c.consecutiveAbsences,
      })),
    })
  }

  if (user.role === 'ADMIN') {
    const [orphans, openCases] = await Promise.all([
      prisma.schoolClass.findMany({
        where: { isActive: true, servants: { none: {} } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.followUpCase.count({ where: { status: 'OPEN' } }),
    ])
    return buildNotifications('ADMIN', { today, classesWithoutServants: orphans, openCases })
  }

  const openCases = await prisma.followUpCase.count({ where: { status: 'OPEN' } })
  return buildNotifications('PASTOR', { today, openCases })
}

/* ── Report scope ─────────────────────────────────────────────────────────── */

export interface ReportClass {
  id: string
  name: string
  stage: StageKey
}

/** Classes this person may run a class-level report on. */
export async function reportClasses(user: PortalUser): Promise<ReportClass[]> {
  const classes = await listVisibleClasses(user)
  return classes.map((c) => ({ id: c.id, name: c.name, stage: c.stage }))
}

/**
 * The church report is for the admin and the pastor; a stage overseer sees
 * their own stage. Returns null when this person may not see it at all.
 */
export async function churchReportScope(user: PortalUser): Promise<ReportClass[] | null> {
  if (user.role === 'ADMIN' || user.role === 'PASTOR') {
    const all = await prisma.schoolClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, stage: true },
    })
    return all
  }
  if (user.role === 'SERVANT' && user.stageOversight) {
    const stage = user.stageOversight
    const all = await prisma.schoolClass.findMany({
      where: { isActive: true, stage },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, stage: true },
    })
    const visible = new Set(visibleClassIds(user, all))
    return all.filter((c) => visible.has(c.id))
  }
  return null
}

/* ── Attendance matrix ────────────────────────────────────────────────────── */

export interface AttendanceMatrixData {
  cls: { id: string; name: string }
  sessionKey: string
  sessionLabel: string
  matrix: MonthMatrix
  rate: ReturnType<typeof attendanceRate>
}

export async function loadAttendanceMatrix(
  user: PortalUser,
  input: { classId: string; month: string; sessionKey: string; blank?: boolean },
): Promise<AttendanceMatrixData> {
  if (!isReportsStaff(user)) notFound()
  const cls = await requireClassAccess(user, input.classId, 'class.read')
  const { from, to } = monthRange(input.month)

  const [students, session] = await Promise.all([
    prisma.student.findMany({
      where: { classId: cls.id },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.attendanceSession.findUnique({ where: { key: input.sessionKey }, select: { label: true } }),
  ])
  // The blank paper form deliberately carries no marks at all.
  const records = input.blank
    ? []
    : await prisma.attendanceRecord.findMany({
        where: {
          classId: cls.id,
          sessionKey: input.sessionKey,
          date: { gte: toUTCDate(from), lte: toUTCDate(to) },
        },
        select: { studentId: true, date: true, status: true },
      })

  const rows = records.map((r) => ({
    studentId: r.studentId,
    date: formatDateOnly(r.date),
    status: r.status,
  }))
  const matrix = buildMonthMatrix(
    students.map((s) => ({ id: s.id, name: studentName(s) })),
    rows,
    input.month,
  )
  const withSession: AttendanceRow[] = rows.map((r) => ({ ...r, sessionKey: input.sessionKey }))
  return {
    cls: { id: cls.id, name: cls.name },
    sessionKey: input.sessionKey,
    sessionLabel: session?.label ?? input.sessionKey,
    matrix,
    rate: attendanceRate(withSession, { studentIds: students.map((s) => s.id) }),
  }
}

/* ── Church report ────────────────────────────────────────────────────────── */

export interface ChurchReportData {
  classes: ClassSummaryRow[]
  totals: ReturnType<typeof churchTotals>
  from: string
  to: string
  sessionKey: string | null
}

export async function loadChurchReport(
  user: PortalUser,
  input: { from: string; to: string; sessionKey: string | null },
): Promise<ChurchReportData | null> {
  const scope = await churchReportScope(user)
  if (!scope) return null
  const ids = scope.map((c) => c.id)
  if (ids.length === 0) {
    return { classes: [], totals: churchTotals([]), from: input.from, to: input.to, sessionKey: input.sessionKey }
  }

  const range = { gte: toUTCDate(input.from), lte: toUTCDate(input.to) }
  // AttendanceRecord.date is a @db.Date, so UTC midnight is the whole story.
  // createdAt/submittedAt are instants: they have to be bounded by the church's
  // own midnights, or an evening service lands in the neighbouring month.
  const stamped = { gte: newYorkDayStart(input.from), lt: newYorkDayStart(addDays(input.to, 1)) }
  const attendanceWhere = {
    classId: { in: ids },
    date: range,
    ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
  }

  // Aggregates where they are enough. The marks themselves have to be counted
  // per (student, occasion), the same granularity the denominator is sized at:
  // a `groupBy(['classId','status'])` counts rows, so a session recorded on two
  // days of one week would put two marks against one held occasion.
  const [heldRows, markRows, studentRows, quizRows, pointRows] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ['classId', 'sessionKey', 'date'],
      where: attendanceWhere,
      _count: { _all: true },
    }),
    prisma.attendanceRecord.findMany({
      // Current roster only: moveStudent updates Student.classId but leaves the
      // denormalised AttendanceRecord.classId pointing at the old class, whose
      // student count no longer includes them.
      where: { ...attendanceWhere, student: { classId: { in: ids } } },
      select: {
        classId: true,
        studentId: true,
        sessionKey: true,
        date: true,
        status: true,
        student: { select: { classId: true } },
      },
    }),
    prisma.student.groupBy({
      by: ['classId'],
      where: { classId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.quizResult.groupBy({
      by: ['classId'],
      where: {
        classId: { in: ids },
        submittedAt: stamped,
      },
      _avg: { percentage: true },
      _count: { _all: true },
    }),
    prisma.pointEntry.groupBy({
      by: ['classId'],
      where: {
        classId: { in: ids },
        createdAt: stamped,
      },
      _sum: { points: true },
    }),
  ])

  const occasionsByClass = new Map<string, Set<string>>()
  for (const row of heldRows) {
    const set = occasionsByClass.get(row.classId) ?? new Set<string>()
    set.add(occasionKey(row.sessionKey, formatDateOnly(row.date)))
    occasionsByClass.set(row.classId, set)
  }
  const rowsByClass = new Map<string, AttendanceRow[]>()
  for (const row of markRows) {
    if (row.student.classId !== row.classId) continue // moved on since; not this class's any more
    const list = rowsByClass.get(row.classId) ?? []
    list.push({ studentId: row.studentId, date: formatDateOnly(row.date), sessionKey: row.sessionKey, status: row.status })
    rowsByClass.set(row.classId, list)
  }
  const presentByClass = new Map<string, number>()
  const excusedByClass = new Map<string, number>()
  for (const [classId, rows] of Array.from(rowsByClass.entries())) {
    const counts = countAttendanceCells(rows, { occasions: Array.from(occasionsByClass.get(classId) ?? []) })
    presentByClass.set(classId, counts.present)
    excusedByClass.set(classId, counts.excused)
  }
  const studentsByClass = new Map(studentRows.filter((r) => r.classId).map((r) => [r.classId!, r._count._all]))
  const quizByClass = new Map(
    quizRows.filter((r) => r.classId).map((r) => [r.classId!, { avg: r._avg.percentage, count: r._count._all }]),
  )
  const pointsByClass = new Map(pointRows.filter((r) => r.classId).map((r) => [r.classId!, r._sum.points ?? 0]))

  const classes = scope.map((c) =>
    classSummary({
      classId: c.id,
      className: c.name,
      stage: c.stage,
      students: studentsByClass.get(c.id) ?? 0,
      occasions: occasionsByClass.get(c.id)?.size ?? 0,
      present: presentByClass.get(c.id) ?? 0,
      excused: excusedByClass.get(c.id) ?? 0,
      quizAverage: quizByClass.get(c.id)?.avg != null ? Math.round(quizByClass.get(c.id)!.avg!) : null,
      quizCount: quizByClass.get(c.id)?.count ?? 0,
      pointsTotal: pointsByClass.get(c.id) ?? 0,
    }),
  )

  return { classes, totals: churchTotals(classes), from: input.from, to: input.to, sessionKey: input.sessionKey }
}

/* ── Report cards ─────────────────────────────────────────────────────────── */

export interface ReportCardsData {
  cls: { id: string; name: string }
  from: string
  to: string
  sessionKey: string | null
  cards: ReportCard[]
}

export async function loadReportCards(
  user: PortalUser,
  input: { classId: string; from: string; to: string; sessionKey: string | null },
): Promise<ReportCardsData> {
  const cls = await requireClassAccess(user, input.classId, 'student.read')
  const range = { gte: toUTCDate(input.from), lte: toUTCDate(input.to) }
  const stamped = { gte: newYorkDayStart(input.from), lt: newYorkDayStart(addDays(input.to, 1)) }

  const students = await prisma.student.findMany({
    where: { classId: cls.id },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true },
  })
  const ids = students.map((s) => s.id)
  if (ids.length === 0) {
    return { cls: { id: cls.id, name: cls.name }, from: input.from, to: input.to, sessionKey: input.sessionKey, cards: [] }
  }

  const [records, quizzes, points, badges] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        classId: cls.id,
        date: range,
        ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
      },
      select: { studentId: true, date: true, sessionKey: true, status: true },
    }),
    prisma.quizResult.findMany({
      where: { studentId: { in: ids }, submittedAt: stamped },
      select: { studentId: true, percentage: true },
    }),
    prisma.pointEntry.groupBy({
      by: ['studentId'],
      where: { studentId: { in: ids }, createdAt: stamped },
      _sum: { points: true },
    }),
    prisma.studentAchievement.findMany({
      where: { studentId: { in: ids } },
      select: { studentId: true, badgeKey: true },
    }),
  ])

  const rows: AttendanceRow[] = records.map((r) => ({
    studentId: r.studentId,
    date: formatDateOnly(r.date),
    sessionKey: r.sessionKey,
    status: r.status,
  }))
  const occasions = heldOccasions(rows)
  const pointsById = new Map(points.map((p) => [p.studentId, p._sum.points ?? 0]))
  const quizzesById = new Map<string, number[]>()
  for (const q of quizzes) quizzesById.set(q.studentId, [...(quizzesById.get(q.studentId) ?? []), q.percentage])
  const badgesById = new Map<string, string[]>()
  for (const b of badges) badgesById.set(b.studentId, [...(badgesById.get(b.studentId) ?? []), b.badgeKey])

  const ranked = rankStudents(
    students.map((s) => ({ studentId: s.id, name: studentName(s), total: pointsById.get(s.id) ?? 0 })),
  )
  const rankById = new Map(ranked.map((r) => [r.studentId, r.rank]))

  const cards = students.map((s) =>
    buildReportCard({
      studentId: s.id,
      name: studentName(s),
      className: cls.name,
      attendance: attendanceRate(
        rows.filter((r) => r.studentId === s.id),
        { occasions, studentIds: [s.id] },
      ),
      quizPercentages: quizzesById.get(s.id) ?? [],
      pointsTotal: pointsById.get(s.id) ?? 0,
      badges: badgesById.get(s.id) ?? [],
      rank: rankById.get(s.id) ?? null,
    }),
  )

  return { cls: { id: cls.id, name: cls.name }, from: input.from, to: input.to, sessionKey: input.sessionKey, cards }
}

/* ── Photo targets ────────────────────────────────────────────────────────── */

export async function loadMyPhoto(user: PortalUser): Promise<{ photo: string | null; displayName: string }> {
  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
    select: { photo: true, displayName: true },
  })
  return { photo: account?.photo ?? null, displayName: account?.displayName ?? user.displayName }
}
