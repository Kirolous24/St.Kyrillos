'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate, formatDateOnly } from '../dates'
import { absenceStreakAgainst, decideFollowUp } from '../attendance-rules'
import { awardAttendancePoints, reverseAttendancePoints } from '../attendance-award'
import { audit } from '../audit'
import { studentName } from '../data/students'

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

    // Follow-up rule only watches the Sunday School session.
    let opened = 0
    let closed = 0
    if (session.key === 'sunday') {
      const studentIds = marks.map((m) => m.studentId)
      const [history, heldDates, openAuto, names] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where: { studentId: { in: studentIds }, sessionKey: 'sunday' },
          select: { studentId: true, date: true, status: true },
        }),
        // Class-wide: a Sunday the class held but this student has no row for
        // (everyone else checked in by group QR) still counts against them.
        prisma.attendanceRecord.findMany({
          where: { classId: cls.id, sessionKey: 'sunday' },
          distinct: ['date'],
          select: { date: true },
        }),
        prisma.followUpCase.findMany({
          where: { studentId: { in: studentIds }, status: 'OPEN', origin: 'AUTO' },
          select: { id: true, studentId: true },
        }),
        prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } }),
      ])
      const openByStudent = new Map(openAuto.map((c) => [c.studentId, c.id]))
      const nameById = new Map(names.map((n) => [n.id, studentName(n)]))

      const held = heldDates.map((h) => formatDateOnly(h.date))
      for (const id of studentIds) {
        const rows = history.filter((h) => h.studentId === id).map((h) => ({ date: formatDateOnly(h.date), status: h.status }))
        const streak = absenceStreakAgainst(held, rows)
        const openId = openByStudent.get(id)
        const decision = decideFollowUp({ streak, threshold: cls.visitationThreshold, hasOpenAutoCase: !!openId })
        if (decision === 'open') {
          const lastSeen = rows.filter((r) => r.status === 'PRESENT').sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.date
          await prisma.followUpCase.create({
            data: {
              studentId: id,
              classId: cls.id,
              origin: 'AUTO',
              title: `Missed ${streak} Sunday${streak > 1 ? 's' : ''} in a row`,
              consecutiveAbsences: streak,
              lastSeen: lastSeen ? toUTCDate(lastSeen) : null,
            },
          })
          opened++
        } else if (decision === 'close' && openId) {
          await prisma.followUpCase.update({
            where: { id: openId },
            data: { status: 'DONE', resolvedAt: new Date(), resolveReason: 'attending_again', resolveNote: `Back on ${date}` },
          })
          closed++
        } else if (openId && streak > 0) {
          await prisma.followUpCase.update({ where: { id: openId }, data: { consecutiveAbsences: streak } })
        }
      }
      void nameById
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
