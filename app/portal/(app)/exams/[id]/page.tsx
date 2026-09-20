import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3, ClipboardList, HelpCircle, Pencil, Percent, Send, ThumbsDown, Trophy, Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireExamRead, examDetail, examQuestions, canWriteExam } from '@/lib/portal/data/exams'
import { formatDateOnly, todayInNewYork } from '@/lib/portal/dates'
import { formatDateTime, formatLongDate } from '@/lib/portal/format'
import { scoreBand, SCORE_BAND_LABEL, SCORE_BAND_TONE, examTotalPoints } from '@/lib/portal/exams'
import { objectsToCsv } from '@/lib/portal/csv'
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  ProgressBar,
  StatCard,
  TableWrap,
  Td,
  Th,
} from '@/components/portal/ui'
import { DownloadButton } from '@/components/portal/DownloadButton'
import { PrintButton } from '@/components/portal/PrintButton'
import { ExamActions } from './ExamActions'

export const metadata = { title: 'Exam' }

/** The prototype's letter grades, used only for the distribution bars. */
const GRADES = [
  { key: 'A', min: 90, color: '#16A34A' },
  { key: 'B', min: 80, color: '#2563EB' },
  { key: 'C', min: 70, color: '#C89B3C' },
  { key: 'D', min: 60, color: '#F97316' },
  { key: 'F', min: 0, color: '#DC2626' },
] as const

function gradeFor(percentage: number): string {
  return (GRADES.find((g) => percentage >= g.min) ?? GRADES[GRADES.length - 1]!).key
}

export default async function ExamDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  // This page renders the answer key and every classmate's score. Students go
  // to their own quiz list instead — requireExamRead refuses them too, this is
  // the friendlier of the two doors.
  if (user.role === 'STUDENT') redirect('/portal/quizzes')
  const exam = await requireExamRead(user, params.id)
  const canWrite = canWriteExam(user, exam)

  const [detail, questions] = await Promise.all([
    examDetail({ id: exam.id, classId: exam.classId, reopenedFor: exam.reopenedFor }),
    examQuestions(exam.id),
  ])

  const today = todayInNewYork()
  const dueDate = exam.dueDate ? formatDateOnly(exam.dueDate) : null
  const overdue = !!dueDate && dueDate < today
  const totalPossible = examTotalPoints(questions.length, exam.pointsPerQuestion)
  const roster = [
    ...detail.results.map((r) => ({ id: r.studentId, name: r.name, submitted: true })),
    ...detail.notSubmitted.map((r) => ({ id: r.studentId, name: r.name, submitted: false })),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const expected = roster.length
  const textByQuestion = new Map(questions.map((q, i) => [q.id, `Q${i + 1}. ${q.text}`]))

  // Display-only derivations from the results already on this page.
  const ranked = [...detail.results].sort((a, b) => b.percentage - a.percentage)
  const highest = ranked[0] ?? null
  const lowest = ranked.length > 1 ? ranked[ranked.length - 1]! : null
  const distribution = GRADES.map((g) => ({
    ...g,
    count: detail.results.filter((r) => gradeFor(r.percentage) === g.key).length,
  }))
  const handedInPct = expected > 0 ? Math.round((detail.results.length / expected) * 100) : 0

  const csv = objectsToCsv(
    [
      { key: 'student', label: 'Student' },
      { key: 'score', label: 'Score' },
      { key: 'total', label: 'Total' },
      { key: 'percentage', label: 'Percentage' },
      { key: 'band', label: 'Band' },
      { key: 'submitted', label: 'Submitted' },
    ] as const,
    [
      ...detail.results.map((r) => ({
        student: r.name,
        score: r.score,
        total: r.total,
        percentage: `${r.percentage}%`,
        band: SCORE_BAND_LABEL[scoreBand(r.percentage)],
        submitted: r.submittedAt ? formatDateTime(r.submittedAt) : '',
      })),
      ...detail.notSubmitted.map((r) => ({
        student: r.name,
        score: '',
        total: '',
        percentage: '',
        band: 'Not submitted',
        submitted: '',
      })),
    ],
  )

  return (
    <div className="portal-print-page">
      <PageHeader
        title={exam.title}
        icon={<ClipboardList className="h-[18px] w-[18px]" aria-hidden />}
        subtitle={
          <>
            {exam.class?.name ?? 'Stage-wide'} · {exam.subject ? `${exam.subject} · ` : ''}
            {questions.length} question{questions.length === 1 ? '' : 's'} · {exam.pointsPerQuestion} point
            {exam.pointsPerQuestion === 1 ? '' : 's'} each · {totalPossible} total
            {dueDate ? ` · due ${formatLongDate(dueDate)}` : ' · no due date'}
          </>
        }
        back={{ href: '/portal/exams', label: 'Exams' }}
        actions={
          <>
            <PrintButton />
            <DownloadButton filename={`${exam.title.replace(/[^\w-]+/g, '-').toLowerCase()}-results.csv`} content={csv} label="Export results" />
            {canWrite && (
              <LinkButton href={`/portal/exams/${exam.id}/edit`} variant="primary">
                <Pencil className="h-4 w-4" aria-hidden /> Edit questions
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {exam.status === 'DRAFT' && <Badge tone="neutral">Draft — hidden from students</Badge>}
        {exam.status === 'CLOSED' && <Badge tone="bad">Closed</Badge>}
        {exam.status === 'PUBLISHED' && <Badge tone="good">Published</Badge>}
        {overdue && <Badge tone="warn">Past due</Badge>}
        {exam.reopenedFor.length > 0 && <Badge tone="info">{exam.reopenedFor.length} reopened</Badge>}
        {exam.bibleReading && <Badge tone="gold">Reading: {exam.bibleReading}</Badge>}
      </div>

      {exam.readingMessage && (
        <div className="mb-5">
          <Callout tone="info" title="Message to the students">{exam.readingMessage}</Callout>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Submitted"
          value={expected ? `${detail.results.length}/${expected}` : detail.results.length}
          hint={`${detail.notSubmitted.length} still to hand in`}
          tone="brand"
          icon={<Send className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Average"
          value={detail.averagePercentage === null ? '—' : `${detail.averagePercentage}%`}
          hint={detail.averagePercentage === null ? 'Nobody has submitted yet' : SCORE_BAND_LABEL[scoreBand(detail.averagePercentage)]}
          tone={detail.averagePercentage === null ? 'default' : SCORE_BAND_TONE[scoreBand(detail.averagePercentage)]}
          icon={<Percent className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Best question"
          value={detail.best ? `${detail.best.rate}%` : '—'}
          hint={detail.best ? textByQuestion.get(detail.best.questionId) ?? '' : 'Needs answers first'}
          tone={detail.best ? 'good' : 'default'}
          icon={<Trophy className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Hardest question"
          value={detail.worst ? `${detail.worst.rate}%` : '—'}
          hint={detail.worst ? textByQuestion.get(detail.worst.questionId) ?? '' : 'Needs answers first'}
          tone={detail.worst ? 'bad' : 'default'}
          icon={<HelpCircle className="h-5 w-5" aria-hidden />}
        />
      </div>

      <div className="space-y-4">
        {expected > 0 && (
          <Card
            title="Hand-in progress"
            icon={<Users className="h-4 w-4" aria-hidden />}
            action={<Badge tone="gold">{handedInPct}%</Badge>}
          >
            <ProgressBar value={handedInPct} label="Papers handed in" />
            <p className="mt-2 text-[12px] text-parch-500">
              {detail.results.length} of {expected} on the roster have handed this in.
            </p>
          </Card>
        )}

        {detail.results.length > 0 && (
          <Card title="Class performance" icon={<BarChart3 className="h-4 w-4" aria-hidden />}>
            <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
              {highest && (
                <div className="rounded-[12px] bg-[#F0FDF4] px-3.5 py-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#166534]">
                    <Trophy className="h-3.5 w-3.5" aria-hidden /> Highest
                  </p>
                  <p className="truncate text-[13px] font-bold text-parch-900">{highest.name}</p>
                  <p className="text-[17px] font-bold tabular-nums text-[#166534]">{highest.percentage}%</p>
                </div>
              )}
              {lowest && (
                <div className="rounded-[12px] bg-[#FEF2F2] px-3.5 py-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#991B1B]">
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden /> Lowest
                  </p>
                  <p className="truncate text-[13px] font-bold text-parch-900">{lowest.name}</p>
                  <p className="text-[17px] font-bold tabular-nums text-[#991B1B]">{lowest.percentage}%</p>
                </div>
              )}
            </div>

            <p className="mb-2.5 border-b border-parch-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800">
              Grade distribution
            </p>
            <ul className="space-y-2">
              {distribution.map((g) => {
                const pct = detail.results.length ? Math.round((g.count / detail.results.length) * 100) : 0
                return (
                  <li key={g.key} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-parch-50"
                      style={{ background: g.color }}
                    >
                      {g.key}
                    </span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-parch-100">
                      <span className="block h-full rounded-[5px]" style={{ width: `${pct}%`, background: g.color }} />
                    </span>
                    <span className="min-w-[64px] shrink-0 text-right text-[12px] tabular-nums text-parch-500">
                      {g.count} ({pct}%)
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        <Card title={`Results (${detail.results.length})`} bodyClassName="p-[18px] sm:p-[18px]">
          {detail.results.length === 0 ? (
            <EmptyState title="No submissions yet" hint="Scores appear here the moment a student hands in." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th align="right">Score</Th>
                  <Th align="right">%</Th>
                  <Th>Band</Th>
                  <Th>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {detail.results.map((r) => {
                  const band = scoreBand(r.percentage)
                  return (
                    <tr key={r.studentId}>
                      <Td>
                        <Link href={`/portal/students/${r.studentId}`} className="font-semibold text-brand-900 hover:underline">
                          {r.name}
                        </Link>
                        {r.reopened && <span className="ml-2 text-[11px] text-parch-500">reopened</span>}
                      </Td>
                      <Td align="right" className="tabular-nums">{r.score}/{r.total}</Td>
                      <Td align="right" className="w-32">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold tabular-nums">{r.percentage}%</span>
                          <span className="hidden w-16 sm:block">
                            <ProgressBar value={r.percentage} tone={SCORE_BAND_TONE[band]} label={`${r.name} ${r.percentage}%`} />
                          </span>
                        </div>
                      </Td>
                      <Td><Badge tone={SCORE_BAND_TONE[band]}>{SCORE_BAND_LABEL[band]}</Badge></Td>
                      <Td className="whitespace-nowrap text-parch-500">{r.submittedAt ? formatDateTime(r.submittedAt) : '—'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>

        {detail.notSubmitted.length > 0 && (
          <Card title={`Not yet submitted (${detail.notSubmitted.length})`}>
            <ul className="flex flex-wrap gap-2">
              {detail.notSubmitted.map((r) => (
                <li key={r.studentId}>
                  <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-parch-200 bg-parch-100/60 px-3 py-1 text-[12px] font-semibold text-parch-700">
                    {r.name}
                    {r.reopened && <Badge tone="info">reopened</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={`Questions & answer key (${questions.length})`}>
          {questions.length === 0 ? (
            <EmptyState title="This exam has no questions" hint="Add some before students can take it." />
          ) : (
            <ol className="space-y-4">
              {questions.map((q, i) => {
                const rate = detail.rates.find((r) => r.questionId === q.id)
                return (
                  <li key={q.id} className="border-b border-[#F5F2ED] pb-4 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13px] font-bold text-parch-900">
                        <span className="font-serif text-brand-gold-dark">Q{i + 1}.</span> {q.text}
                      </p>
                      {rate && rate.answered > 0 && (
                        <span className="shrink-0 text-[11px] tabular-nums text-parch-500">
                          {rate.correct}/{rate.answered} correct
                        </span>
                      )}
                    </div>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {q.options.map((opt, oi) => {
                        const right = oi === q.correctIndex
                        return (
                          <li
                            key={oi}
                            className={
                              right
                                ? 'flex items-center gap-2 rounded-lg border-[1.5px] border-[#86EFAC] bg-[#F0FDF4] px-3 py-2 text-[12px] font-bold text-[#166534]'
                                : 'flex items-center gap-2 rounded-lg border-[1.5px] border-parch-200 px-3 py-2 text-[12px] text-parch-700'
                            }
                          >
                            <span
                              aria-hidden
                              className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-parch-50"
                              style={{ background: right ? '#16A34A' : '#A9A49B' }}
                            >
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span className="min-w-0 flex-1">{opt}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>

        {canWrite && (
          <ExamActions examId={exam.id} status={exam.status} roster={roster} reopened={exam.reopenedFor} />
        )}
      </div>
    </div>
  )
}
