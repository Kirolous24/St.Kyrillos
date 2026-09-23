import { notFound, redirect } from 'next/navigation'
import { Award, Check, Percent, Trophy, X } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { studentReview } from '@/lib/portal/data/exams'
import { scoreBand, SCORE_BAND_LABEL, SCORE_BAND_TONE, type ScoreBand } from '@/lib/portal/exams'
import { formatDateTime } from '@/lib/portal/format'
import { Badge, Callout, Card, LinkButton, PageHeader, StatCard } from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Quiz review' }

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** The prototype's score ring palette. */
const BAND: Record<ScoreBand, { ring: string; ink: string; edge: string; bar: string; praise: string }> = {
  excellent: { ring: '#F0FDF4', ink: '#166534', edge: '#86EFAC', bar: '#22C55E', praise: 'Excellent' },
  good: { ring: '#FFFBEB', ink: '#92400E', edge: '#FCD34D', bar: '#F59E0B', praise: 'Good job' },
  'needs-work': { ring: '#FEF2F2', ink: '#991B1B', edge: '#FCA5A5', bar: '#EF4444', praise: 'Keep studying' },
}

export default async function QuizReviewPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  // A student may only ever read their own paper.
  if (user.role !== 'STUDENT' || !user.studentId) redirect(`/portal/exams/${params.id}`)

  const review = await studentReview(user.studentId, params.id)
  if (!review) notFound()

  const { result, questions } = review
  const band = scoreBand(result.percentage)
  const skin = BAND[band]

  return (
    <div className="portal-print-page">
      <PageHeader
        title={result.exam.title}
        icon={<Award className="h-[18px] w-[18px]" aria-hidden />}
        subtitle={
          <>
            {result.exam.subject ? `${result.exam.subject} · ` : ''}handed in {formatDateTime(result.submittedAt)}
          </>
        }
        back={{ href: '/portal/quizzes', label: 'Quizzes' }}
        actions={
          <>
            <PrintButton />
            <LinkButton href="/portal/quizzes" variant="secondary">All quizzes</LinkButton>
          </>
        }
      />

      {/* F0702 — the prototype said "Quiz submitted!" the moment a paper went
          in. Here the redirect lands on a page that looks identical whether the
          student handed it in a second ago or last term, so nothing confirmed
          the hand-in had actually taken and nothing named the points it earned.
          Keyed off how long ago the paper was submitted rather than a query
          parameter, so it works however the student arrived, and comparing two
          absolute instants keeps church time out of it entirely. Not printed. */}
      {Date.now() - result.submittedAt.getTime() < 60_000 && (
        <div className="mb-4 print:hidden" data-quiz-submitted="">
          <Callout tone="good" title="Quiz submitted!">
            {result.score > 0
              ? `${result.score} point${result.score === 1 ? '' : 's'} added to your total.`
              : 'Your paper is in. Read the answers below before the next one.'}
          </Callout>
        </div>
      )}

      {/* The prototype's result banner: a big score ring and a word of praise. */}
      <div className="mb-4">
        <Card bodyClassName="flex flex-wrap items-center gap-4 p-[18px]">
          <span
            aria-hidden
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border-[3px] font-serif text-[20px] font-bold tabular-nums"
            style={{ background: skin.ring, color: skin.ink, borderColor: skin.edge }}
          >
            {result.percentage}%
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[17px] font-bold text-parch-900">{skin.praise}</p>
            <p className="mt-0.5 text-[12.5px] text-parch-500">
              {result.correctCount} of {result.questionCount} correct · {result.score}/{result.total} points
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-[20px] bg-[#F0EBE3]">
              <div className="h-full rounded-[20px]" style={{ width: `${result.percentage}%`, background: skin.bar }} />
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Score"
          value={`${result.score}/${result.total}`}
          hint={`${result.correctCount} of ${result.questionCount} correct`}
          tone="brand"
          icon={<Trophy className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Percentage"
          value={`${result.percentage}%`}
          hint={SCORE_BAND_LABEL[band]}
          tone={SCORE_BAND_TONE[band]}
          icon={<Percent className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Points earned"
          value={result.score}
          hint="Added to your class total"
          tone="good"
          icon={<Award className="h-5 w-5" aria-hidden />}
        />
      </div>

      <ol className="space-y-3.5">
        {questions.map((q, qi) => (
          <li key={q.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-bold text-parch-900">
                  <span className="font-serif text-brand-gold-dark">Q{qi + 1}.</span> {q.text}
                </p>
                <Badge tone={q.isCorrect ? 'good' : 'bad'}>
                  {q.isCorrect ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                  {q.isCorrect ? 'Correct' : q.chosenIndex === null ? 'Not answered' : 'Wrong'}
                </Badge>
              </div>
              <ul className="mt-2.5 grid gap-[7px]">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex
                  const isMine = oi === q.chosenIndex
                  return (
                    <li
                      key={oi}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-[1.5px] px-3.5 py-2.5 text-[12.5px]',
                        isCorrect && 'border-[#86EFAC] bg-[#F0FDF4] font-bold text-[#166534]',
                        !isCorrect && isMine && 'border-[#FCA5A5] bg-[#FEF2F2] font-bold text-[#991B1B]',
                        !isCorrect && !isMine && 'border-parch-200 text-parch-500',
                      )}
                    >
                      <span
                        aria-hidden
                        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[12px] font-bold text-parch-50"
                        style={{
                          background: isCorrect ? '#16A34A' : isMine ? '#DC2626' : '#A9A49B',
                        }}
                      >
                        {LETTERS[oi]}
                      </span>
                      <span className="min-w-0 flex-1">{opt}</span>
                      {isMine && (
                        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.8px]">Your answer</span>
                      )}
                      {isCorrect && !isMine && (
                        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.8px]">Correct</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  )
}
