// The point row that goes with an attendance record.
//
// The points ledger is append-only (§5): undoing an award writes a compensating
// negative row and flags the original `undone`, it never deletes anything. A
// deleted row would make a re-printed report card disagree with the one the
// family already has, and leave no trace on the student's profile of an award
// that really was made. Marking a student absent reverses their attendance
// points the same way.
//
// AttendanceRecord.pointEntry is 1-1 (attendanceRecordId is @unique), so the
// linked entry is the one canonical award and its `undone` flag is the whole
// state: false means the award stands, true means a compensating row has
// cancelled it. Every later flip appends another compensating row.

import type { Prisma } from '@prisma/client'

export interface AttendanceAwardContext {
  studentId: string
  classId: string
  sessionKey: string
  sessionLabel: string
  sessionPoints: number
  /** Account credited with making the change. */
  accountId: string
}

export interface AttendanceAwardRecord {
  id: string
  pointEntry: { id: string; points: number; undone: boolean } | null
}

/** Award the session's points once, or bring a reversed award back. */
export async function awardAttendancePoints(
  tx: Prisma.TransactionClient,
  record: AttendanceAwardRecord,
  ctx: AttendanceAwardContext,
): Promise<void> {
  const award = record.pointEntry
  if (!award) {
    if (ctx.sessionPoints <= 0) return
    await tx.pointEntry.create({
      data: {
        studentId: ctx.studentId,
        classId: ctx.classId,
        points: ctx.sessionPoints,
        source: 'ATTENDANCE',
        activityKey: ctx.sessionKey,
        activityLabel: ctx.sessionLabel,
        attendanceRecordId: record.id,
        createdById: ctx.accountId,
      },
    })
    return
  }
  if (!award.undone) return // already live — re-issue exactly once
  await tx.pointEntry.update({ where: { id: award.id }, data: { undone: false } })
  await tx.pointEntry.create({
    data: {
      studentId: ctx.studentId,
      classId: ctx.classId,
      points: award.points,
      source: 'ATTENDANCE',
      activityKey: ctx.sessionKey,
      activityLabel: ctx.sessionLabel,
      reason: 'Marked present again',
      createdById: ctx.accountId,
    },
  })
}

/** Reverse a live award with a compensating row; never delete it. */
export async function reverseAttendancePoints(
  tx: Prisma.TransactionClient,
  record: AttendanceAwardRecord,
  ctx: Pick<AttendanceAwardContext, 'studentId' | 'classId' | 'sessionKey' | 'sessionLabel' | 'accountId'>,
): Promise<void> {
  const award = record.pointEntry
  if (!award || award.undone) return
  // undoOfId is @unique, so only the first reversal can carry the link; later
  // ones are plain compensating rows tied to the same session.
  const linked = await tx.pointEntry.findUnique({ where: { undoOfId: award.id }, select: { id: true } })
  await tx.pointEntry.update({ where: { id: award.id }, data: { undone: true } })
  await tx.pointEntry.create({
    data: {
      studentId: ctx.studentId,
      classId: ctx.classId,
      points: -award.points,
      source: 'UNDO',
      activityKey: ctx.sessionKey,
      activityLabel: `Undo: ${ctx.sessionLabel}`,
      reason: 'Marked absent',
      undoOfId: linked ? null : award.id,
      createdById: ctx.accountId,
    },
  })
}
