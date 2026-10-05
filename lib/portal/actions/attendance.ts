'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate, churchToday } from '../dates'
import { isFutureDate, lastSavedOf } from '../attendance-rules'
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
  marks: z.array(MarkSchema).max(500),
})

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
): Promise<ActionResult<{ saved: number; opened: number; closed: number; present: number; excused: number; absent: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = SaveSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'attendance.write')

    const date = parseDateOnly(input.date)
    if (!date) throw new PortalError('Pick a valid date.')
    if (isFutureDate(date, churchToday())) {
      throw new PortalError('You cannot take attendance for a day that has not happened yet.')
    }
    const session = await prisma.attendanceSession.findUnique({ where: { key: input.sessionKey } })
    if (!session || !session.isActive) throw new PortalError('Unknown session.')
    if (session.classId && session.classId !== cls.id) throw new PortalError('That meeting belongs to another class.')

    // Who this register may mark: the class's own children, and for its own
    // meeting its members too (2026-09-28).
    const classStudents = await prisma.student.findMany({ where: registerWhere(session, cls.id), select: { id: true } })
    const allowed = new Set(classStudents.map((s) => s.id))
    const marks = input.marks.filter((m) => allowed.has(m.studentId))
    if (marks.length === 0) throw new PortalError('Nothing to save.')

    const day = toUTCDate(date)

    await prisma.$transaction(
      async (tx) => {
        for (const m of marks) {
          const upserted = await tx.attendanceRecord.upsert({
            where: { studentId_date_sessionKey: { studentId: m.studentId, date: day, sessionKey: session.key } },
            create: {
              studentId: m.studentId,
              classId: cls.id,
              date: day,
              sessionKey: session.key,
              status: m.status,
              reason: m.status === 'EXCUSED' ? m.reason ?? 'other' : null,
              markedById: user.accountId,
            },
            update: {
              classId: cls.id,
              status: m.status,
              reason: m.status === 'EXCUSED' ? m.reason ?? 'other' : null,
              markedById: user.accountId,
            },
            // Select only `id`: Prisma keeps a bare-id upsert as one
            // INSERT ... ON CONFLICT DO UPDATE, but a nested read of pointEntry
            // degrades it to SELECT-then-INSERT with no ON CONFLICT, so two
            // servants saving the same class at once lose the race on the
            // unique index and roll the whole class back with P2002.
            select: { id: true },
          })
          const record = {
            id: upserted.id,
            pointEntry: await tx.pointEntry.findUnique({
              where: { attendanceRecordId: upserted.id },
              select: { id: true, points: true, undone: true },
            }),
          }

          const award = {
            studentId: m.studentId,
            classId: cls.id,
            sessionKey: session.key,
            sessionLabel: session.label,
            sessionPoints: session.points,
            accountId: user.accountId,
          }
          if (m.status === 'PRESENT') await awardAttendancePoints(tx, record, award)
          else await reverseAttendancePoints(tx, record, award)
        }

        // Everyone else on the register is recorded absent, but only where
        // nothing is stored: ON CONFLICT DO NOTHING leaves another servant's
        // mark, or a scanned card, exactly as it is.
        const marked = new Set(marks.map((m) => m.studentId))
        const unmarked = classStudents.filter((s) => !marked.has(s.id))
        if (unmarked.length > 0) {
          await tx.attendanceRecord.createMany({
            data: unmarked.map((s) => ({
              studentId: s.id,
              classId: cls.id,
              date: day,
              sessionKey: session.key,
              status: 'ABSENT' as const,
              markedById: user.accountId,
            })),
            skipDuplicates: true,
          })
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    )

    // The follow-up rule watches Sunday School, and a class's own meeting
    // (2026-09-28). Shared with the QR check-in path so both stay in step (see
    // lib/portal/followup-sync.ts).
    // The whole register, as before: the children nobody marked were just
    // recorded absent, and their streaks move too.
    let opened = 0
    let closed = 0
    if (session.key === 'sunday' || session.classId === cls.id) {
      const synced = await syncAutoFollowUps({
        classId: cls.id,
        studentIds: classStudents.map((s) => s.id),
        threshold: cls.visitationThreshold,
        asOf: date,
        session: { key: session.key, label: session.label },
      })
      opened = synced.opened
      closed = synced.closed
    }

    // The register as it now stands, everybody's marks included, for the
    // confirmation and the audit line.
    const totals = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { classId: cls.id, date: day, sessionKey: session.key, studentId: { in: classStudents.map((s) => s.id) } },
      _count: { _all: true },
    })
    const count = (status: 'PRESENT' | 'EXCUSED') => totals.find((t) => t.status === status)?._count._all ?? 0
    const present = count('PRESENT')
    const excused = count('EXCUSED')
    const absent = classStudents.length - present - excused
    await audit(
      user,
      'attendance.save',
      'class',
      cls.id,
      `${cls.name}: ${session.label} on ${date} — ${marks.length} changed; ${present}/${classStudents.length} present`,
    )

    revalidatePath('/portal')
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath(`/portal/classes/${cls.id}/attendance`)
    revalidatePath('/portal/follow-ups')
    return { saved: marks.length, opened, closed, present, excused, absent }
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
    const cls = await assertClassAction(user, input.classId, 'attendance.write')
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
    const cls = await assertClassAction(user, input.classId, 'attendance.write')

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
