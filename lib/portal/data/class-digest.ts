import { prisma } from '@/lib/prisma'
import { loadClassStudentRows } from './reports'
import { monthLabel, monthRange } from '../reports'
import { newYorkDayStart, addDays } from '../dates'
import type { PortalUser } from '../permissions'

export interface ClassMonthDigest {
  month: string
  label: string
  attendanceRate: number | null
  attended: number
  held: number
  pointsAwarded: number
  quizzesSat: number
  quizAverage: number | null
  newStudents: number
  openCases: number
  /**
   * F0339 — the prototype's "Top this month" line. The digest is the month a
   * servant is actually in, and the one name it could not give them was the
   * child who had the best month: the class leaderboard is all-time, so a child
   * who turned a corner in November is invisible on it behind a year of points.
   *
   * Ties go to the alphabetically-first name rather than to whichever row the
   * query happened to return first, so the same month always reads the same.
   */
  topStudent: { name: string; points: number } | null
}

/**
 * The prototype's "Monthly Digest" card on the class profile: five numbers
 * scoped to the month rather than to all time.
 *
 * The class page's own stats are lifetime figures, which answer a different
 * question — a class that was excellent last year and has slipped since looks
 * fine on an all-time rate. This is the month a servant is actually in.
 *
 * Read-only, and reached through ordinary class access rather than the
 * church-report scope, so a plain servant can see their own class's digest.
 */
export async function classMonthDigest(
  user: PortalUser,
  classId: string,
  month: string,
): Promise<ClassMonthDigest> {
  const { from, to } = monthRange(month)
  const stamped = { gte: newYorkDayStart(from), lt: newYorkDayStart(addDays(to, 1)) }

  // Attendance and points for the window come free from the report loader,
  // which is already period-scoped and already gated on class access.
  const [{ rows }, quizzes, newStudents, openCases] = await Promise.all([
    loadClassStudentRows(user, { classId, from, to, sessionKey: null }),
    prisma.quizResult.aggregate({
      where: { classId, submittedAt: stamped },
      _avg: { percentage: true },
      _count: { _all: true },
    }),
    prisma.student.count({ where: { classId, createdAt: stamped } }),
    prisma.followUpCase.count({ where: { classId, status: 'OPEN' } }),
  ])

  const attended = rows.reduce((n, r) => n + r.attended, 0)
  const held = rows.reduce((n, r) => n + r.held, 0)
  // `rows` is already scoped to this month, so its `points` is the month's.
  const top = rows
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))[0]

  return {
    month,
    label: monthLabel(month),
    attendanceRate: held === 0 ? null : Math.round((attended / held) * 100),
    attended,
    held,
    pointsAwarded: rows.reduce((n, r) => n + r.points, 0),
    quizzesSat: quizzes._count._all,
    quizAverage: quizzes._avg.percentage === null ? null : Math.round(quizzes._avg.percentage),
    newStudents,
    openCases,
    topStudent: top ? { name: top.name, points: top.points } : null,
  }
}
