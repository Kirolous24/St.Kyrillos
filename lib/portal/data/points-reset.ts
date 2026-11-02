import { prisma } from '@/lib/prisma'

/**
 * Reset these children's points to 0 (2026-11-02): every point entry of theirs
 * goes, and each child is stamped with when, so a register from before then,
 * saved again, does not bring the points back (lib/portal/attendance-award.ts).
 * Attendance, quiz results and the children themselves stay. A child has one
 * total, so this is everything they earned, in whichever class.
 */
export async function resetPointsOf(studentIds: readonly string[]): Promise<{ entries: number; points: number }> {
  const ids = Array.from(new Set(studentIds))
  if (ids.length === 0) return { entries: 0, points: 0 }
  return prisma.$transaction(
    async (tx) => {
      const had = await tx.pointEntry.aggregate({ where: { studentId: { in: ids } }, _sum: { points: true } })
      const removed = await tx.pointEntry.deleteMany({ where: { studentId: { in: ids } } })
      await tx.student.updateMany({ where: { id: { in: ids } }, data: { pointsResetAt: new Date() } })
      return { entries: removed.count, points: had._sum.points ?? 0 }
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
}
