import { prisma } from '@/lib/prisma'
import { absenceStreakAgainst, decideFollowUp, latestHeldStatus } from './attendance-rules'
import { formatDateOnly, toUTCDate } from './dates'

/**
 * Open, update and close the automatic Sunday-School follow-up cases for a set
 * of students.
 *
 * The prototype recomputed these on every render of the Follow-up view (OG
 * L17137-17206), so they were always current no matter how attendance arrived.
 * The port moved the logic inside the manual "Save attendance" button only,
 * which meant a class checking in by group QR never raised or cleared a case.
 * This is the single implementation both paths call.
 */
export async function syncAutoFollowUps(input: {
  classId: string
  studentIds: string[]
  /** The class's `visitationThreshold` — consecutive misses before a case opens. */
  threshold: number
  /** Date the sync is being run for, used in the resolve note. */
  asOf: string
}): Promise<{ opened: number; closed: number }> {
  const { classId, studentIds, threshold, asOf } = input
  if (studentIds.length === 0) return { opened: 0, closed: 0 }

  const [history, heldDates, openCases, students] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds }, sessionKey: 'sunday' },
      select: { studentId: true, date: true, status: true },
    }),
    // Class-wide: a Sunday the class held but this student has no row for
    // (everyone else checked in by group QR) still counts against them.
    prisma.attendanceRecord.findMany({
      where: { classId, sessionKey: 'sunday' },
      distinct: ['date'],
      select: { date: true },
    }),
    // Every open case, not just the automatic ones. The prototype's rule looked
    // at all of them (OG L17154-17155), so a student a servant had already
    // opened a manual case for did not also get an automatic duplicate. The
    // port filtered to origin:'AUTO', so the same child appeared twice.
    prisma.followUpCase.findMany({
      where: { studentId: { in: studentIds }, status: 'OPEN' },
      select: { id: true, studentId: true, origin: true },
    }),
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, createdAt: true } }),
  ])

  // Any open case blocks a new automatic one; only an automatic one may be
  // closed or updated by this rule — a manual case is someone's own record and
  // is not the absence rule's to resolve.
  const openByStudent = new Map(openCases.map((c) => [c.studentId, c.id]))
  const autoByStudent = new Map(openCases.filter((c) => c.origin === 'AUTO').map((c) => [c.studentId, c.id]))
  // When each student joined: a student with no rows at all has nothing to
  // score against, so without this anchor they could never raise a case.
  const sinceById = new Map(students.map((s) => [s.id, formatDateOnly(s.createdAt)]))
  const held = heldDates.map((h) => formatDateOnly(h.date))

  let opened = 0
  let closed = 0
  for (const id of studentIds) {
    const rows = history
      .filter((h) => h.studentId === id)
      .map((h) => ({ date: formatDateOnly(h.date), status: h.status }))
    const since = sinceById.get(id)
    const streak = absenceStreakAgainst(held, rows, since)
    // F0462 — a zero streak is satisfied by an EXCUSED mark, which means the
    // child was *not* there. Closing needs their most recent Sunday to say
    // PRESENT, or the case closes with a "Back on …" note that is not true.
    const latestHeld = latestHeldStatus(held, rows, since)
    const autoId = autoByStudent.get(id)
    const decision = decideFollowUp({ streak, threshold, hasOpenAutoCase: !!openByStudent.get(id), latestHeld })

    if (decision === 'open') {
      const lastSeen = rows.filter((r) => r.status === 'PRESENT').sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.date
      await prisma.followUpCase.create({
        data: {
          studentId: id,
          classId,
          origin: 'AUTO',
          title: streak === 1 ? 'Missed last Sunday' : `Missed ${streak} Sundays in a row`,
          consecutiveAbsences: streak,
          lastSeen: lastSeen ? toUTCDate(lastSeen) : null,
        },
      })
      opened++
    } else if (decision === 'close' && autoId) {
      // The day they were actually seen, not the day the sync happened. Those
      // differ whenever a servant types up a register later in the week, and the
      // note goes into the child's record as a statement of fact.
      const backOn =
        rows
          .filter((r) => r.status === 'PRESENT')
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.date ?? asOf
      await prisma.followUpCase.update({
        where: { id: autoId },
        data: {
          status: 'DONE',
          resolvedAt: new Date(),
          resolveReason: 'attending_again',
          resolveNote: `Back on ${backOn}`,
          lastSeen: toUTCDate(backOn),
        },
      })
      closed++
    } else if (autoId && streak > 0) {
      await prisma.followUpCase.update({ where: { id: autoId }, data: { consecutiveAbsences: streak } })
    }
  }
  return { opened, closed }
}
