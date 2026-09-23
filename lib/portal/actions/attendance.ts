'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate, todayInNewYork } from '../dates'
import { isFutureDate } from '../attendance-rules'
import { syncAutoFollowUps } from '../followup-sync'
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

export async function saveAttendance(raw: SaveAttendanceInput): Promise<ActionResult<{ saved: number; opened: number; closed: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = SaveSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'attendance.write')

    const date = parseDateOnly(input.date)
    if (!date) throw new PortalError('Pick a valid date.')
    if (isFutureDate(date, todayInNewYork())) {
      throw new PortalError('You cannot take attendance for a day that has not happened yet.')
    }
    const session = await prisma.attendanceSession.findUnique({ where: { key: input.sessionKey } })
    if (!session || !session.isActive) throw new PortalError('Unknown session.')

    const classStudents = await prisma.student.findMany({ where: { classId: cls.id }, select: { id: true } })
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
      },
      { timeout: 60_000, maxWait: 10_000 },
    )

    // Follow-up rule only watches the Sunday School session. Shared with the
    // QR check-in path so both stay in step (see lib/portal/followup-sync.ts).
    let opened = 0
    let closed = 0
    if (session.key === 'sunday') {
      const synced = await syncAutoFollowUps({
        classId: cls.id,
        studentIds: marks.map((m) => m.studentId),
        threshold: cls.visitationThreshold,
        asOf: date,
      })
      opened = synced.opened
      closed = synced.closed
    }

    const present = marks.filter((m) => m.status === 'PRESENT').length
    await audit(user, 'attendance.save', 'class', cls.id, `${cls.name}: ${session.label} on ${date} — ${present}/${marks.length} present`)

    revalidatePath('/portal')
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath(`/portal/classes/${cls.id}/attendance`)
    revalidatePath('/portal/follow-ups')
    return { saved: marks.length, opened, closed }
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

    const students = await prisma.student.findMany({ where: { classId: cls.id }, select: { id: true } })
    const { opened, closed } = await syncAutoFollowUps({
      classId: cls.id,
      studentIds: students.map((s) => s.id),
      threshold: cls.visitationThreshold,
      asOf: todayInNewYork(),
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
