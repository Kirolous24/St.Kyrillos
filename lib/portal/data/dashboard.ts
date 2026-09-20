import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { todayInNewYork, addDays, formatDateOnly, toUTCDate } from '../dates'
import { upcomingBirthdays } from '../birthdays'
import { rankStudents } from '../points-math'
import { attendanceRate, heldOccasions } from '../reports'
import type { PortalUser } from '../permissions'
import { listVisibleClasses } from './classes'
import { studentName } from './students'

export async function classTotals(classIds: string[]) {
  const sums = await prisma.pointEntry.groupBy({
    by: ['studentId'],
    where: { student: { classId: { in: classIds } } },
    _sum: { points: true },
  })
  return new Map(sums.map((s) => [s.studentId, s._sum.points ?? 0]))
}

export async function staffOverview(user: PortalUser) {
  const today = todayInNewYork()
  const classes = await listVisibleClasses(user)
  const classIds = classes.map((c) => c.id)

  const [openCases, takenToday, students, recentSundays] = await Promise.all([
    prisma.followUpCase.groupBy({
      by: ['classId'],
      where: { classId: { in: classIds }, status: 'OPEN' },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['classId', 'sessionKey'],
      where: { classId: { in: classIds }, date: toUTCDate(today) },
    }),
    prisma.student.findMany({
      where: { classId: { in: classIds } },
      select: { id: true, firstName: true, lastName: true, dob: true, classId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { classId: { in: classIds }, sessionKey: 'sunday', date: { gte: toUTCDate(addDays(today, -28)) } },
      select: { classId: true, studentId: true, status: true, date: true },
    }),
  ])

  const openByClass = new Map(openCases.map((c) => [c.classId, c._count._all]))
  const takenByClass = new Map<string, string[]>()
  for (const t of takenToday) takenByClass.set(t.classId, [...(takenByClass.get(t.classId) ?? []), t.sessionKey])

  // Roster-aware, like the official Reports page: a student with no row at
  // all for a session the class held still counts against the rate, not just
  // the students who happened to get a row that day (e.g. a group QR code).
  const studentIdsByClass = new Map<string, string[]>()
  for (const s of students) studentIdsByClass.set(s.classId!, [...(studentIdsByClass.get(s.classId!) ?? []), s.id])

  const rateByClass = new Map<string, number | null>()
  for (const id of classIds) {
    const rows = recentSundays
      .filter((r) => r.classId === id)
      .map((r) => ({ studentId: r.studentId, date: formatDateOnly(r.date), sessionKey: 'sunday', status: r.status }))
    rateByClass.set(id, attendanceRate(rows, { studentIds: studentIdsByClass.get(id) ?? [] }).rate)
  }

  const birthdays = upcomingBirthdays(
    students.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null, classId: s.classId })),
    today,
    14,
  )

  const servantCount =
    user.role === 'ADMIN' || user.role === 'PASTOR'
      ? await prisma.servant.count()
      : await prisma.servant.count({ where: { classes: { some: { classId: { in: classIds } } } } })

  return {
    today,
    classes: classes.map((c) => ({
      ...c,
      openCases: openByClass.get(c.id) ?? 0,
      sessionsToday: takenByClass.get(c.id) ?? [],
      sundayRate4w: rateByClass.get(c.id) ?? null,
    })),
    totals: {
      students: students.length,
      // Distinct servant accounts, not the sum of class assignments: a servant
      // on two classes is one person, and servants with no class still count.
      servants: servantCount,
      openCases: openCases.reduce((n, c) => n + c._count._all, 0),
      classesWithoutServants: classes.filter((c) => c.servantCount === 0).length,
    },
    birthdays,
  }
}

export async function studentOverview(user: PortalUser) {
  const today = todayInNewYork()
  const me = await prisma.student.findUnique({
    where: { id: user.studentId ?? '' },
    select: {
      id: true, firstName: true, lastName: true, dob: true, classId: true,
      class: { select: { id: true, name: true } },
      account: { select: { photo: true, loginId: true } },
    },
  })
  if (!me) return null

  const classmates = me.classId
    ? await prisma.student.findMany({ where: { classId: me.classId }, select: { id: true, firstName: true, lastName: true, dob: true } })
    : [me]
  const totals = await classTotals(me.classId ? [me.classId] : [])
  const ranked = rankStudents(classmates.map((s) => ({ studentId: s.id, name: studentName(s), total: totals.get(s.id) ?? 0 })))
  const mine = ranked.find((r) => r.studentId === me.id)

  const [entries, sunday, heldSundays] = await Promise.all([
    prisma.pointEntry.findMany({
      where: { studentId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, points: true, activityLabel: true, reason: true, createdAt: true, source: true, undone: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: me.id, sessionKey: 'sunday' },
      orderBy: { date: 'desc' },
      take: 12,
      select: { date: true, status: true },
    }),
    // Class-wide, not student-scoped: a Sunday the class held but this
    // student has no row for (e.g. everyone else checked in by group QR)
    // still has to count against them, same window as `sunday` above.
    me.classId
      ? prisma.attendanceRecord.findMany({
          where: { classId: me.classId, sessionKey: 'sunday' },
          orderBy: { date: 'desc' },
          distinct: ['date'],
          take: 12,
          select: { date: true },
        })
      : Promise.resolve([]),
  ])

  const birthdays = upcomingBirthdays(
    classmates.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null })),
    today,
    30,
  )

  return {
    today,
    me,
    className: me.class?.name ?? 'No class yet',
    total: mine?.total ?? 0,
    rank: mine?.rank ?? null,
    classSize: ranked.length,
    top3: ranked.slice(0, 3),
    entries,
    sunday: sunday.map((r) => ({ date: formatDateOnly(r.date), status: r.status })),
    rate: attendanceRate(
      sunday.map((r) => ({ studentId: me.id, sessionKey: 'sunday', date: formatDateOnly(r.date), status: r.status })),
      { occasions: heldOccasions(heldSundays.map((r) => ({ sessionKey: 'sunday', date: formatDateOnly(r.date) }))), studentIds: [me.id] },
    ),
    birthdays,
  }
}

/**
 * The single birthday the top bar shows: the soonest one in the next week
 * among the people this user can see. Null when there is none.
 *
 * This runs in the layout, so it is on the critical path of EVERY portal
 * navigation. The answer only changes when the date does, so it is cached per
 * (account, day) rather than re-queried on every click.
 */
export function nextBirthdayForTopbar(
  user: PortalUser,
  today: string,
): Promise<{ name: string; on: string } | null> {
  return unstable_cache(
    () => computeNextBirthday(user, today),
    ['portal-topbar-birthday', user.accountId, today],
    { revalidate: 3600, tags: ['portal-topbar-birthday'] },
  )()
}

async function computeNextBirthday(
  user: PortalUser,
  today: string,
): Promise<{ name: string; on: string } | null> {
  const classes = await listVisibleClasses(user)
  const classIds = classes.map((c) => c.id)
  if (user.role === 'STUDENT' || classIds.length === 0) return null

  const students = await prisma.student.findMany({
    where: { classId: { in: classIds }, dob: { not: null } },
    select: { id: true, firstName: true, lastName: true, dob: true, classId: true },
  })
  const upcoming = upcomingBirthdays(
    students.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null, classId: s.classId })),
    today,
    7,
  )
  const first = upcoming[0]
  return first ? { name: first.name, on: first.on } : null
}
