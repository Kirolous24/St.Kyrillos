import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, CalendarClock, CheckCircle2, ChevronDown, ClipboardList, Lock, Percent, XCircle } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { studentExams, type StudentExamRow } from '@/lib/portal/data/exams'
import {
  examStatusFor,
  scoreBand,
  daysUntilDue,
  SCORE_BAND_LABEL,
  SCORE_BAND_TONE,
  type ExamStudentStatus,
  type ScoreBand,
} from '@/lib/portal/exams'
import { formatLongDate } from '@/lib/portal/format'
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard } from '@/components/portal/ui'
import { PortalChart } from '@/components/portal/PortalChart'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Quizzes' }

/** The prototype's score ring / bar palette, band for band. */
const BAND: Record<ScoreBand, { ring: string; ink: string; edge: string; bar: string; praise: string }> = {
  excellent: { ring: '#F0FDF4', ink: '#166534', edge: '#86EFAC', bar: '#22C55E', praise: 'Excellent' },
  good: { ring: '#FFFBEB', ink: '#92400E', edge: '#FCD34D', bar: '#F59E0B', praise: 'Good job' },
  'needs-work': { ring: '#FEF2F2', ink: '#991B1B', edge: '#FCA5A5', bar: '#EF4444', praise: 'Keep studying' },
}

function dueLabel(dueDate: string | null, today: string): string {
  if (!dueDate) return 'No deadline'
  const days = daysUntilDue(dueDate, today)
  if (days === null) return formatLongDate(dueDate)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days > 1) return `Due in ${days} days · ${formatLongDate(dueDate)}`
  return `Was due ${formatLongDate(dueDate)}`
}

export default async function QuizzesPage() {
  const user = await requirePortalUser()
  if (user.role !== 'STUDENT') redirect('/portal/exams')
  if (!user.studentId) {
    return (
      <>
        <PageHeader title="My Quizzes" icon={<ClipboardList className="h-[18px] w-[18px]" aria-hidden />} />
        <EmptyState title="No student record" hint="Ask a servant to finish setting up your account." />
      </>
    )
  }

  const studentId = user.studentId
  const { today, rows } = await studentExams(studentId)
  const submitted = rows.filter((r) => r.result).map((r) => r.id)
  const grouped: Record<ExamStudentStatus, StudentExamRow[]> = { available: [], completed: [], missed: [], upcoming: [] }
  for (const row of rows) {
    grouped[examStatusFor(row, studentId, submitted, today)].push(row)
  }

  const scored = grouped.completed.filter((r) => r.result)
  const average = scored.length
    ? Math.round(scored.reduce((n, r) => n + (r.result?.percentage ?? 0), 0) / scored.length)
    : null
  // The student's own score trend — the prototype's private chart. Oldest
  // first, because a trend line reads left to right. Placed here rather than
  // on My Stage, which 404s for a student: it is a stage-coordinator page.
  const myTrend = scored
    .filter((r) => r.result)
    .sort((a, b) => (a.result!.submittedAt < b.result!.submittedAt ? -1 : 1))
    .slice(-8)
    .map((r) => ({ label: r.title.length > 16 ? `${r.title.slice(0, 15)}…` : r.title, value: r.result!.percentage }))

  const next = grouped.available
    .filter((r) => r.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0]

  return (
    <>
      <PageHeader
        title="My Quizzes"
        icon={<ClipboardList className="h-[18px] w-[18px]" aria-hidden />}
        subtitle={`${rows.length} quiz${rows.length === 1 ? '' : 'zes'} · finish the open ones before they close`}
      />

      {/* F0032 — the prototype put four counts in a chip row under the header,
          each hidden at zero. The three tiles that replaced it dropped Upcoming
          altogether and demoted Missed to a hint under Completed, so a student
          could not see that two quizzes were coming, or that one had been
          missed, without reading to the bottom of the page. All four buckets
          are already computed above. */}
      {rows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ['Done', grouped.completed.length, 'border-[#86EFAC] bg-[#DCFCE7] text-[#166534]'],
              ['Available', grouped.available.length, 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]'],
              ['Missed', grouped.missed.length, 'border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]'],
              ['Upcoming', grouped.upcoming.length, 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]'],
            ] as const
          )
            .filter(([, count]) => count > 0)
            .map(([label, count, skin]) => (
              <span
                key={label}
                data-quiz-chip={label}
                className={cn('rounded-[20px] border px-3 py-1 text-[11.5px] font-bold', skin)}
              >
                {count} {label}
              </span>
            ))}
        </div>
      )}

      {myTrend.length >= 2 && (
        <Card className="mb-5" title="How you have been doing" icon={<ClipboardList className="h-4 w-4" aria-hidden />}>
          <PortalChart
            kind="line"
            colour="#C89B3C"
            points={myTrend}
            label="Your score"
            caption="Your last few quizzes, oldest first. Only quizzes you have handed in appear here."
            suffix="%"
            maxY={100}
          />
        </Card>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="To do"
          value={grouped.available.length}
          hint={next ? dueLabel(next.dueDate, today) : 'Nothing waiting'}
          tone="brand"
          icon={<CalendarClock className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Completed"
          value={grouped.completed.length}
          hint={`${grouped.missed.length} missed`}
          tone="good"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Average"
          value={average === null ? '—' : `${average}%`}
          hint={average === null ? 'Take your first quiz' : SCORE_BAND_LABEL[scoreBand(average)]}
          tone={average === null ? 'default' : SCORE_BAND_TONE[scoreBand(average)]}
          icon={<Percent className="h-5 w-5" aria-hidden />}
        />
      </div>

      <section className="mb-7">
        <SectionTitle hint={`${grouped.available.length} open`}>Available now</SectionTitle>
        {grouped.available.length === 0 ? (
          <EmptyState title="Nothing to do right now" hint="New quizzes show up here as soon as your servant publishes them." />
        ) : (
          <ul className="grid gap-3.5 sm:grid-cols-2">
            {grouped.available.map((q) => (
              <li key={q.id}>
                <AvailableCard row={q} today={today} reopened={q.reopenedFor.includes(studentId)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-7">
        <SectionTitle hint={`${grouped.completed.length} done`}>Completed</SectionTitle>
        {grouped.completed.length === 0 ? (
          <EmptyState title="No finished quizzes yet" hint="Your score and a full review land here once you hand one in." />
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2">
              {grouped.completed.slice(0, 4).map((q) => (
                <li key={q.id}>
                  <CompletedCard row={q} />
                </li>
              ))}
            </ul>
            {/* F0703 — this is the one group that only ever grows: by March a
                student scrolls past thirty finished papers to reach anything
                else on the page. The count is in the summary, so nothing is
                hidden without saying how much. Available now and Missed are
                deliberately left uncapped — a quiz still to do, or one that
                needs a servant to reopen it, must not be behind a disclosure. */}
            {grouped.completed.length > 4 && (
              <details className="mt-3">
                <summary
                  data-completed-more=""
                  className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-bold text-brand-800 hover:underline [&::-webkit-details-marker]:hidden"
                >
                  Show {grouped.completed.length - 4} more
                  <span aria-hidden>▾</span>
                </summary>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {grouped.completed.slice(4).map((q) => (
                    <li key={q.id}>
                      <CompletedCard row={q} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      {(grouped.missed.length > 0 || grouped.upcoming.length > 0) && (
        <section>
          <SectionTitle hint={grouped.missed.length > 0 ? 'Ask a servant to reopen one' : undefined}>
            Missed &amp; upcoming
          </SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...grouped.missed, ...grouped.upcoming].map((q) => (
              <li key={q.id}>
                <ClosedCard row={q} today={today} missed={grouped.missed.includes(q)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/* ── Cards ────────────────────────────────────────────────────────────────── */

function AvailableCard({ row, today, reopened }: { row: StudentExamRow; today: string; reopened: boolean }) {
  const points = row.questionCount * row.pointsPerQuestion
  return (
    <Card className="h-full border-[1.5px] border-brand-gold" bodyClassName="flex h-full flex-col p-0">
      <div className="flex items-start justify-between gap-3 bg-brand-800 px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-parch-50">{row.title}</p>
          <p className="mt-1 truncate text-[12px] text-parch-50/55">
            {row.questionCount} question{row.questionCount === 1 ? '' : 's'}
            {points ? ` · ${points} pts` : ''}
            {row.dueDate ? ` · ${dueLabel(row.dueDate, today)}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-[20px] bg-brand-gold px-3 py-1 text-[12px] font-bold text-parch-50">
          {reopened ? 'Reopened' : 'Available'}
        </span>
      </div>

      {row.bibleReading && (
        /* F0698 — the reading's own message was stored and then shown only after
           the child opened the quiz, so the sentence a servant wrote to make them
           want to read the passage never reached the card that offers it. It
           opens rather than always showing: a long note would otherwise push the
           Start button off a phone screen, and a truncated one with no way to
           expand is the thing this finding is about. */
        <div className="border-b border-[#EFE4C8] bg-brand-wash px-4 py-2.5">
          {/* F0324 — the reading may now be up to 2000 characters, so the summary
              line truncates but the opened panel prints it in full. A reading
              that is only ever truncated, with nothing that opens, is the same
              silent clipping this pair of findings is about. */}
          {row.readingMessage || row.bibleReading.length > 48 ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-bold text-[#8B5A0F]">
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">Reading: {row.bibleReading}</span>
                <ChevronDown
                  aria-hidden
                  className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              {row.bibleReading.length > 48 && (
                <p className="mt-1.5 whitespace-pre-line text-[11.5px] font-semibold leading-[1.6] text-[#8B5A0F]">
                  {row.bibleReading}
                </p>
              )}
              {row.readingMessage && (
                <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-[1.6] text-[#7A5210]">
                  {row.readingMessage}
                </p>
              )}
            </details>
          ) : (
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#8B5A0F]">
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Reading: {row.bibleReading}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
          {row.subject ?? dueLabel(row.dueDate, today)}
        </span>
        <LinkButton href={`/portal/quizzes/${row.id}`} size="sm">
          Start quiz
        </LinkButton>
      </div>
    </Card>
  )
}

function CompletedCard({ row }: { row: StudentExamRow }) {
  const pct = row.result?.percentage ?? 0
  const band = scoreBand(pct)
  const skin = BAND[band]
  return (
    <Card className="h-full" bodyClassName="flex h-full flex-col p-0">
      <div className="flex items-center gap-3 px-4 pb-2.5 pt-3.5">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-[12px] font-bold tabular-nums"
          style={{ background: skin.ring, color: skin.ink, borderColor: skin.edge }}
        >
          {pct}%
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-parch-900">{row.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-parch-500">
            {row.result?.score ?? 0}/{row.result?.total ?? 0} points · {SCORE_BAND_LABEL[band]}
          </p>
        </div>
        <Badge tone={SCORE_BAND_TONE[band]}>{skin.praise}</Badge>
      </div>
      <div className="mx-4 h-[3px] overflow-hidden rounded-[2px] bg-parch-200">
        <div className="h-full rounded-[2px]" style={{ width: `${pct}%`, background: skin.bar }} />
      </div>
      <div className="mt-auto px-4 pb-3.5 pt-3">
        <Link
          href={`/portal/quizzes/${row.id}/review`}
          className="text-[12px] font-bold text-brand-800 hover:underline"
        >
          Review answers →
        </Link>
      </div>
    </Card>
  )
}

function ClosedCard({ row, today, missed }: { row: StudentExamRow; today: string; missed: boolean }) {
  return (
    <Card className="h-full opacity-60" bodyClassName="flex items-center gap-3 p-4">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-parch-200 text-parch-600"
      >
        {missed ? <XCircle className="h-[18px] w-[18px]" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-parch-800">{row.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-parch-500">{dueLabel(row.dueDate, today)}</p>
      </div>
      <Badge tone={missed ? 'bad' : 'info'}>{missed ? 'Missed' : 'Upcoming'}</Badge>
    </Card>
  )
}
