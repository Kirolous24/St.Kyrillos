'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { AttendanceSession, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate, churchToday } from '../dates'
import { isFutureDate, lastSavedOf, sessionsToRecord } from '../attendance-rules'
import { andList } from '../format'
import { syncAutoFollowUps } from '../followup-sync'
import { registerWhere } from '../class-members'
import { awardAttendancePoints, reverseAttendancePoints } from '../attendance-award'
import { audit } from '../audit'

const MarkSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(['PRESENT', 'EXCUSED', 'ABSENT']),
  reason: z.enum(['sick', 'travel', 'other']).nullable().optional(),
})

const SaveSchema = z.object({
  classId: z.string().min(1),
  date: z.string(),
  sessionKey: z.string().min(1),
  // Other sessions the same register is saved for (2026-11-01: "Sometimes
  // vespers & hymns").
  alsoSessionKeys: z.array(z.string().min(1).max(64)).max(10).optional(),
  marks: z.array(MarkSchema).max(500),
})

type Mark = z.infer<typeof MarkSchema>
type Fill = { status: 'PRESENT' | 'EXCUSED' | 'ABSENT'; reason: string | null }
const ABSENT: Fill = { status: 'ABSENT', reason: null }

/**
 * Write one session's register: the marks this servant made, then everybody
 * else on its list where nothing is stored yet, as `fill` says. The fill never
 * overwrites (ON CONFLICT DO NOTHING): another servant's mark, or a scanned
 * card, stays exactly as it is. A child filled in present earns the session's
 * points like any other.
 */
async function writeRegister(
  tx: Prisma.TransactionClient,
  args: {
    classId: string
    session: { key: string; label: string; points: number }
    roster: readonly string[]
    marks: readonly Mark[]
    fill: (studentId: string) => Fill
    accountId: string
    day: Date
  },
): Promise<void> {
  const { classId, session, accountId, day } = args
  const onRoster = new Set(args.roster)
  // When the admin last reset each child's points (2026-11-02): a record made
  // before then earns nothing again when the register is saved.
  const resets = new Map(
    (
      await tx.student.findMany({
        where: { id: { in: [...args.roster] }, pointsResetAt: { not: null } },
        select: { id: true, pointsResetAt: true },
      })
    ).map((s) => [s.id, s.pointsResetAt]),
  )
  const award = (studentId: string) => ({
    studentId,
    classId,
    sessionKey: session.key,
    sessionLabel: session.label,
    sessionPoints: session.points,
    accountId,
    pointsResetAt: resets.get(studentId) ?? null,
  })
  const mine = args.marks.filter((m) => onRoster.has(m.studentId))
  for (const m of mine) {
    const upserted = await tx.attendanceRecord.upsert({
      where: { studentId_date_sessionKey: { studentId: m.studentId, date: day, sessionKey: session.key } },
      create: {
        studentId: m.studentId,
        classId,
        date: day,
        sessionKey: session.key,
        status: m.status,
        reason: m.status === 'EXCUSED' ? m.reason ?? 'other' : null,
        markedById: accountId,
      },
      update: {
        classId,
        status: m.status,
        reason: m.status === 'EXCUSED' ? m.reason ?? 'other' : null,
        markedById: accountId,
      },
      // Select only the row's own columns: Prisma keeps such an upsert as one
      // INSERT ... ON CONFLICT DO UPDATE, but a nested read of pointEntry
      // degrades it to SELECT-then-INSERT with no ON CONFLICT, so two
      // servants saving the same class at once lose the race on the
      // unique index and roll the whole class back with P2002.
      select: { id: true, createdAt: true },
    })
    const record = {
      id: upserted.id,
      createdAt: upserted.createdAt,
      pointEntry: await tx.pointEntry.findUnique({
        where: { attendanceRecordId: upserted.id },
        select: { id: true, points: true, undone: true },
      }),
    }
    if (m.status === 'PRESENT') await awardAttendancePoints(tx, record, award(m.studentId))
    else await reverseAttendancePoints(tx, record, award(m.studentId))
  }

  const marked = new Set(mine.map((m) => m.studentId))
  const fills = args.roster.filter((id) => !marked.has(id)).map((id) => ({ studentId: id, ...args.fill(id) }))
  if (fills.length === 0) return
  // Who is filled in present onto nothing stored, read first: only they are
  // owed this session's points from the fill.
  const present = fills.filter((f) => f.status === 'PRESENT').map((f) => f.studentId)
  const stored = present.length
    ? new Set(
        (
          await tx.attendanceRecord.findMany({
            where: { date: day, sessionKey: session.key, studentId: { in: present } },
            select: { studentId: true },
          })
        ).map((r) => r.studentId),
      )
    : new Set<string>()
  await tx.attendanceRecord.createMany({
    data: fills.map((f) => ({
      studentId: f.studentId,
      classId,
      date: day,
      sessionKey: session.key,
      status: f.status,
      reason: f.status === 'EXCUSED' ? f.reason ?? 'other' : null,
      markedById: accountId,
    })),
    skipDuplicates: true,
  })
  const owed = present.filter((id) => !stored.has(id))
  if (owed.length > 0) {
    const created = await tx.attendanceRecord.findMany({
      where: { date: day, sessionKey: session.key, studentId: { in: owed }, status: 'PRESENT' },
      select: { id: true, studentId: true, createdAt: true, pointEntry: { select: { id: true, points: true, undone: true } } },
    })
    for (const r of created) await awardAttendancePoints(tx, r, award(r.studentId))
  }
}

export type SaveAttendanceInput = z.infer<typeof SaveSchema>

/**
 * Save the marks a servant changed on a register.
 *
 * `marks` is what this servant changed, not the whole register (KG,
 * 2026-10-04). Several servants take one register at once, and each screen is
 * as old as the moment it opened: writing every child as that screen showed
 * them let the second save put the first servant's "present" children back to
 * absent and take their points. Children nobody has marked are still recorded
 * absent, so the register is complete, but only where nothing is stored.
 */
export async function saveAttendance(
  raw: SaveAttendanceInput,
): Promise<
  ActionResult<{
    saved: number
    opened: number
    closed: number
    present: number
    excused: number
    absent: number
    /** The other sessions it was saved for, each as it now stands (2026-11-01). */
    also: Array<{ label: string; present: number; excused: number; absent: number }>
  }>
> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = SaveSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'attendance.take')

    const date = parseDateOnly(input.date)
    if (!date) throw new PortalError('Pick a valid date.')
    if (isFutureDate(date, churchToday())) {
      throw new PortalError('You cannot take attendance for a day that has not happened yet.')
    }
    // Every session this save covers, all checked before anything is written:
    // the register's own first, then any others it is also saved for.
    const sessions: AttendanceSession[] = []
    for (const key of sessionsToRecord(input.sessionKey, input.alsoSessionKeys)) {
      const session = await prisma.attendanceSession.findUnique({ where: { key } })
      if (!session || !session.isActive) throw new PortalError('Unknown session.')
      if (session.classId && session.classId !== cls.id) throw new PortalError('That meeting belongs to another class.')
      sessions.push(session)
    }

    // Who each session's register lists: the class's own children, and for its
    // own meeting its members too (2026-09-28).
    const rosters = await Promise.all(
      sessions.map(async (s) => (await prisma.student.findMany({ where: registerWhere(s, cls.id), select: { id: true } })).map((r) => r.id)),
    )
    // A servant marks the children on the register in front of them.
    const allowed = new Set(rosters[0])
    const marks = input.marks.filter((m) => allowed.has(m.studentId))
    if (marks.length === 0) throw new PortalError('Nothing to save.')

    const day = toUTCDate(date)

    await prisma.$transaction(
      async (tx) => {
        // The register's own session: everyone nobody has marked is absent.
        await writeRegister(tx, { classId: cls.id, session: sessions[0]!, roster: rosters[0]!, marks, fill: () => ABSENT, accountId: user.accountId, day })
        if (sessions.length === 1) return
        // Every other session: the same marks, and for anyone nobody has
        // marked there yet, the mark they now have in the register's own
        // session — another servant's and a scanned card's included.
        const first = new Map(
          (
            await tx.attendanceRecord.findMany({
              where: { date: day, sessionKey: sessions[0]!.key, studentId: { in: rosters[0] } },
              select: { studentId: true, status: true, reason: true },
            })
          ).map((r) => [r.studentId, { status: r.status, reason: r.reason }] as const),
        )
        for (let i = 1; i < sessions.length; i++) {
          await writeRegister(tx, {
            classId: cls.id,
            session: sessions[i]!,
            roster: rosters[i]!,
            marks,
            fill: (id) => first.get(id) ?? ABSENT,
            accountId: user.accountId,
            day,
          })
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    )

    // The follow-up rule watches Sunday School, and a class's own meeting
    // (2026-09-28), for each session saved. Shared with the QR check-in path so
    // both stay in step (see lib/portal/followup-sync.ts). The whole register,
    // as before: the children nobody marked were just recorded, and their
    // streaks move too.
    let opened = 0
    let closed = 0
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]!
      if (session.key !== 'sunday' && session.classId !== cls.id) continue
      const synced = await syncAutoFollowUps({
        classId: cls.id,
        studentIds: rosters[i]!,
        threshold: cls.visitationThreshold,
        asOf: date,
        session: { key: session.key, label: session.label },
      })
      opened += synced.opened
      closed += synced.closed
    }

    // Each register as it now stands, everybody's marks included, for the
    // confirmation and the audit line.
    const totals = await Promise.all(
      sessions.map(async (session, i) => {
        const rows = await prisma.attendanceRecord.groupBy({
          by: ['status'],
          where: { classId: cls.id, date: day, sessionKey: session.key, studentId: { in: rosters[i] } },
          _count: { _all: true },
        })
        const count = (status: 'PRESENT' | 'EXCUSED') => rows.find((t) => t.status === status)?._count._all ?? 0
        const present = count('PRESENT')
        const excused = count('EXCUSED')
        return { label: session.label, present, excused, absent: rosters[i]!.length - present - excused }
      }),
    )
    for (let i = 0; i < sessions.length; i++) {
      const others = sessions.filter((_, j) => j !== i).map((s) => s.label)
      await audit(
        user,
        'attendance.save',
        'class',
        cls.id,
        `${cls.name}: ${sessions[i]!.label} on ${date} — ${marks.length} changed; ${totals[i]!.present}/${rosters[i]!.length} present${others.length ? ` (saved with ${andList(others)})` : ''}`,
      )
    }

    revalidatePath('/portal')
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath(`/portal/classes/${cls.id}/attendance`)
    revalidatePath('/portal/follow-ups')
    const [own, ...also] = totals
    return { saved: marks.length, opened, closed, present: own!.present, excused: own!.excused, absent: own!.absent, also }
  })
}

const RegisterSchema = z.object({
  classId: z.string().min(1),
  date: z.string(),
  sessionKey: z.string().min(1),
})

/**
 * A register as it is stored right now, so an open register can take in what
 * the other servants saved (KG, 2026-10-04). Read-only, and the same access as
 * taking the register.
 */
export async function registerMarks(
  raw: z.infer<typeof RegisterSchema>,
): Promise<
  ActionResult<{
    marks: Array<{ studentId: string; status: 'PRESENT' | 'EXCUSED' | 'ABSENT'; reason: string | null }>
    lastSaved: { at: string; by: string } | null
  }>
> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = RegisterSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'attendance.take')
    const date = parseDateOnly(input.date)
    if (!date) throw new PortalError('Pick a valid date.')
    const rows = await prisma.attendanceRecord.findMany({
      where: { classId: cls.id, date: toUTCDate(date), sessionKey: input.sessionKey },
      select: { studentId: true, status: true, reason: true, updatedAt: true, markedBy: { select: { displayName: true } } },
    })
    const last = lastSavedOf(rows)
    return {
      marks: rows.map((r) => ({ studentId: r.studentId, status: r.status, reason: r.reason })),
      lastSaved: last ? { at: last.at.toISOString(), by: last.by } : null,
    }
  })
}

const RemoveSchema = z.object({
  classId: z.string().min(1),
  date: z.string(),
  sessionKey: z.string().min(1),
})

/**
 * Delete a whole register — every mark for one class, on one date, for one
 * session.
 *
 * A register saved on the wrong date could not be undone. `saveAttendance` only
 * ever upserts, and a session counts as *held* the moment any row exists for
 * it, so one mis-dated save permanently added an occasion every student in the
 * class was then measured against. Marking everyone absent does not help: those
 * rows are what make the date count. The prototype simply removed the rows
 * (OG L13111-13121).
 *
 * The attendance points ride on `PointEntry.attendanceRecordId`, which cascades
 * on delete, so the points awarded for that day go with it. Follow-up cases are
 * recomputed afterwards, because removing a held Sunday changes every streak
 * that was scored against it.
 */
export async function removeAttendanceSession(
  raw: z.infer<typeof RemoveSchema>,
): Promise<ActionResult<{ removed: number; opened: number; closed: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = RemoveSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'attendance.take')

    const date = parseDateOnly(input.date)
    if (!date) throw new PortalError('Pick a valid date.')
    const session = await prisma.attendanceSession.findUnique({ where: { key: input.sessionKey } })
    if (!session) throw new PortalError('Unknown session.')

    const day = toUTCDate(date)
    const existing = await prisma.attendanceRecord.count({
      where: { classId: cls.id, date: day, sessionKey: session.key },
    })
    if (existing === 0) throw new PortalError('There is nothing recorded for that day.')

    const { count } = await prisma.attendanceRecord.deleteMany({
      where: { classId: cls.id, date: day, sessionKey: session.key },
    })

    // Re-score the meeting that was removed, when it is one the rule watches.
    const watched = session.key === 'sunday' || session.classId === cls.id
    const students = watched ? await prisma.student.findMany({ where: registerWhere(session, cls.id), select: { id: true } }) : []
    const { opened, closed } = await syncAutoFollowUps({
      classId: cls.id,
      studentIds: students.map((s) => s.id),
      threshold: cls.visitationThreshold,
      asOf: churchToday(),
      session: { key: session.key, label: session.label },
    })

    await audit(
      user,
      'attendance.remove',
      'class',
      cls.id,
      `${cls.name}: removed ${count} mark${count === 1 ? '' : 's'} for ${session.label} on ${input.date}`,
    )
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath(`/portal/classes/${cls.id}/attendance`)
    revalidatePath('/portal/reports')
    revalidatePath('/portal/follow-ups')
    revalidatePath('/portal')
    return { removed: count, opened, closed }
  })
}
