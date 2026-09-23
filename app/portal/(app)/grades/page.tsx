import { Star, Sparkles, ClipboardList, Trophy } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireStudentRead, studentName } from '@/lib/portal/data/students'
import { classTotals } from '@/lib/portal/data/dashboard'
import { rankStudents } from '@/lib/portal/points-math'
import { PageHeader, Card, StatCard, ProgressBar, EmptyState, SectionTitle, Badge, TableWrap } from '@/components/portal/ui'
import { formatShortDate } from '@/lib/portal/format'
import { formatDateOnly } from '@/lib/portal/dates'
import { notFound } from 'next/navigation'
import { scoreBand, SCORE_BAND_TONE } from '@/lib/portal/exams'

export const metadata = { title: 'Grades & Points' }

/**
 * "My Grades & Points", restored from the prototype's stLoad('grades'). The
 * port shipped no equivalent at all: a student could see a leaderboard and a
 * list of quizzes, but never where their own points actually came from.
 *
 * Like the Achievements page, `?student=` lets a servant open a student's
 * ledger; a student only ever sees their own.
 */
export default async function GradesPage({ searchParams }: { searchParams: { student?: string } }) {
  const user = await requirePortalUser()

  let studentId = user.studentId ?? null
  let heading = 'My Grades & Points'
  let mine = true
  if (searchParams.student && searchParams.student !== user.studentId) {
    const student = await requireStudentRead(user, searchParams.student)
    studentId = student.id
    heading = `${studentName(student)}’s Grades & Points`
    mine = false
  }
  if (!studentId) notFound()

  const [entries, quizzes, me] = await Promise.all([
    prisma.pointEntry.findMany({
      where: { studentId },
      // F0176 — `source` is read below so quiz points can be left out of the
      // activity breakdown, the way the prototype did it.
      select: { points: true, activityLabel: true, source: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quizResult.findMany({
      where: { studentId },
      select: { id: true, score: true, total: true, percentage: true, submittedAt: true, exam: { select: { title: true } } },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } }),
  ])

  const total = entries.reduce((n, e) => n + e.points, 0)

  // Grouped by activity, the prototype's "Activities & Points" breakdown.
  const groups = new Map<string, { label: string; points: number; count: number }>()
  for (const e of entries) {
    const g = groups.get(e.activityLabel) ?? { label: e.activityLabel, points: 0, count: 0 }
    g.points += e.points
    g.count += 1
    groups.set(e.activityLabel, g)
  }
  const breakdown = Array.from(groups.values()).sort((a, b) => b.points - a.points)
  const peak = Math.max(1, ...breakdown.map((g) => Math.abs(g.points)))

  const avg = quizzes.length ? Math.round(quizzes.reduce((n, q) => n + q.percentage, 0) / quizzes.length) : null

  // A rank is only meaningful once someone in the class has scored. With every
  // total at zero rankStudents ties the whole class at #1, and telling a child
  // who has earned nothing that they are first is worse than saying nothing.
  let rank: number | undefined
  if (me?.classId && total > 0) {
    const [classmates, totals] = await Promise.all([
      prisma.student.findMany({ where: { classId: me.classId }, select: { id: true, firstName: true, lastName: true } }),
      classTotals([me.classId]),
    ])
    rank = rankStudents(
      classmates.map((c) => ({ studentId: c.id, name: studentName(c), total: totals.get(c.id) ?? 0 })),
    ).find((r) => r.studentId === studentId)?.rank
  }

  /**
   * F0714 — the prototype showed six rows on each list and put the rest behind
   * "Show all (N)" (OG ACTS_SHOW_LIMIT / QUIZ_SHOW_LIMIT, :12158, :12176). A
   * child in their third year opens this page to a screen and a half of old
   * quiz rows with this term's points below them. Six is the prototype's
   * number. Built as <details> rather than state: this page is a server
   * component and a disclosure that needs no JavaScript opens the same on a
   * phone on the hall's wifi.
   */
  const SHOW_LIMIT = 6
  const showAllClass =
    'mx-auto mt-3.5 flex min-h-[40px] w-fit cursor-pointer list-none items-center rounded-[20px] bg-brand-wash px-4 text-[12px] font-bold text-brand-gold-dark transition-colors hover:bg-[#FBF3E0] [&::-webkit-details-marker]:hidden'
  const activityRow = (g: (typeof breakdown)[number]) => (
    <li key={g.label}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-semibold text-parch-900">{g.label}</span>
        <span className="shrink-0 text-[12px] text-parch-500">
          {g.count}× ·{' '}
          <span className={g.points < 0 ? 'font-bold text-[#DC2626]' : 'font-bold text-parch-900'}>
            {g.points > 0 ? `+${g.points}` : g.points}
          </span>
        </span>
      </div>
      <ProgressBar value={(Math.abs(g.points) / peak) * 100} tone={g.points < 0 ? 'bad' : 'brand'} />
    </li>
  )
  const quizHead = (
    <thead>
      <tr className="border-b border-[#EFE9DC] text-left">
        <th className="pb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Quiz</th>
        <th className="pb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Score</th>
        <th className="pb-2 text-right text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">When</th>
      </tr>
    </thead>
  )
  const quizRow = (q: (typeof quizzes)[number]) => (
    <tr key={q.id} className="border-b border-[#EFE9DC] last:border-0">
      <td className="py-2.5 pr-3 font-semibold text-parch-900">{q.exam.title}</td>
      <td className="py-2.5 pr-3">
        <Badge tone={SCORE_BAND_TONE[scoreBand(q.percentage)]}>
          {q.score}/{q.total} · {q.percentage}%
        </Badge>
      </td>
      <td className="py-2.5 text-right text-parch-500">{formatShortDate(formatDateOnly(q.submittedAt))}</td>
    </tr>
  )

  return (
    <>
      <PageHeader
        title={heading}
        subtitle={mine ? 'Where your points came from, and how your quizzes went' : 'Where their points came from, and how their quizzes went'}
        icon={<Star className="h-5 w-5" />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total points" value={total} icon={<Star className="h-4 w-4" />} />
        <StatCard label="Quizzes taken" value={quizzes.length} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Average score" value={avg === null ? '—' : `${avg}%`} tone={avg === null ? undefined : SCORE_BAND_TONE[scoreBand(avg)]} icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Class rank" value={rank ? `#${rank}` : '—'} icon={<Trophy className="h-4 w-4" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <SectionTitle hint={`${breakdown.length} ${breakdown.length === 1 ? 'activity' : 'activities'}`}>
            Activities &amp; points
          </SectionTitle>
          {breakdown.length === 0 ? (
            <EmptyState title="No points yet" hint={mine ? 'Points show up here as you attend and take quizzes.' : 'Points will show up here as they attend and take quizzes.'} />
          ) : (
            <Card>
              <ul className="space-y-3.5">{breakdown.slice(0, SHOW_LIMIT).map(activityRow)}</ul>
              {breakdown.length > SHOW_LIMIT && (
                <details className="group">
                  <summary className={showAllClass}>
                    <span className="group-open:hidden">Show all ({breakdown.length})</span>
                    <span className="hidden group-open:inline">Show less</span>
                  </summary>
                  <ul className="mt-3.5 space-y-3.5">{breakdown.slice(SHOW_LIMIT).map(activityRow)}</ul>
                </details>
              )}
            </Card>
          )}
        </div>

        <div>
          <SectionTitle hint={quizzes.length ? `${quizzes.length} taken` : undefined}>Quiz results</SectionTitle>
          {quizzes.length === 0 ? (
            <EmptyState title="No quizzes taken yet" />
          ) : (
            <Card>
              <TableWrap>
                {quizHead}
                <tbody>{quizzes.slice(0, SHOW_LIMIT).map(quizRow)}</tbody>
              </TableWrap>
              {quizzes.length > SHOW_LIMIT && (
                <details className="group">
                  <summary className={showAllClass}>
                    <span className="group-open:hidden">Show all ({quizzes.length})</span>
                    <span className="hidden group-open:inline">Show less</span>
                  </summary>
                  <TableWrap className="mt-3.5">
                    {quizHead}
                    <tbody>{quizzes.slice(SHOW_LIMIT).map(quizRow)}</tbody>
                  </TableWrap>
                </details>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
