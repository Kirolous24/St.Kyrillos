'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Send } from 'lucide-react'
import { submitQuiz } from '@/lib/portal/actions/exams'
import { Callout, Card, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/** Questions as the student receives them — no correctIndex anywhere. */
export interface PaperQuestion {
  id: string
  text: string
  options: string[]
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function QuizTaker({
  examId,
  title,
  questions,
  pointsPerQuestion,
}: {
  examId: string
  title: string
  questions: PaperQuestion[]
  pointsPerQuestion: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const answered = Object.keys(answers).length
  const unanswered = questions.length - answered
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0

  function choose(questionId: string, index: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: index }))
    setError(null)
  }

  function hand_in() {
    setError(null)
    startTransition(async () => {
      const result = await submitQuiz({
        examId,
        answers: questions.map((q) => ({ questionId: q.id, chosenIndex: answers[q.id] ?? null })),
      })
      if (!result.ok) {
        setConfirming(false)
        return setError(result.error)
      }
      router.replace(`/portal/quizzes/${examId}/review`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {error && <Callout tone="bad" title="Not submitted">{error}</Callout>}

      {/* The prototype's quiz progress bar, pinned so it follows the paper down. */}
      <div className="sticky top-[64px] z-[80] md:top-[74px]">
        <div className="rounded-[14px] border-[1.5px] border-brand-gold bg-parch-50 px-4 py-3 shadow-panel">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span
              className={cn(
                'flex items-center gap-1.5 text-[12px] font-bold',
                unanswered === 0 ? 'text-[#16A34A]' : 'text-parch-500',
              )}
            >
              {unanswered === 0 && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
              {unanswered === 0 ? 'Ready to hand in!' : `${answered} / ${questions.length} answered`}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              {pointsPerQuestion} pt{pointsPerQuestion === 1 ? '' : 's'} each
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-[20px] bg-[#F0EBE3]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${title} progress`}
          >
            <div
              className="h-full rounded-[20px] transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#6F1D1B,#C89B3C)' }}
            />
          </div>
        </div>
      </div>

      <ol className="space-y-3.5">
        {questions.map((q, qi) => (
          <li key={q.id}>
            <Card>
              <fieldset>
                <legend className="mb-2.5 text-[13px] font-bold text-parch-900">
                  <span className="font-serif text-brand-gold-dark">Q{qi + 1}.</span> {q.text}
                  <span className="ml-1.5 text-[12px] font-bold text-brand-gold-dark">+{pointsPerQuestion} pts</span>
                </legend>
                <ul className="grid gap-[7px]">
                  {q.options.map((opt, oi) => {
                    const picked = answers[q.id] === oi
                    return (
                      <li key={oi}>
                        <label
                          className={cn(
                            'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border-[1.5px] px-3.5 py-2.5 text-[12.5px] transition-all',
                            'focus-within:ring-2 focus-within:ring-brand-gold focus-within:ring-offset-1',
                            picked
                              ? 'border-brand-800 bg-brand-wash font-bold text-brand-800'
                              : 'border-parch-200 bg-parch-50 text-parch-500 hover:border-brand-gold/60 hover:bg-brand-wash/40',
                          )}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="sr-only"
                            checked={picked}
                            onChange={() => choose(q.id, oi)}
                          />
                          <span
                            aria-hidden
                            className={cn(
                              'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[12px] font-bold transition-colors',
                              picked ? 'bg-brand-800 text-parch-50' : 'bg-parch-200 text-parch-500',
                            )}
                          >
                            {LETTERS[oi]}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            </Card>
          </li>
        ))}
      </ol>

      <Card title="Hand it in">
        {unanswered > 0 && (
          <p className="mb-2 text-[12.5px] font-semibold text-[#B45309]">
            {unanswered} question{unanswered === 1 ? '' : 's'} still unanswered. Unanswered questions score nothing.
          </p>
        )}
        <p className="mb-3 text-[12.5px] text-parch-500">You can only hand this quiz in once.</p>
        {/* F0036 / F0699 — the old system refused a hand-in until every question
            was answered, which strands a child who cannot answer one with no way
            to finish: guess, or abandon the quiz. A hand-in can never be undone,
            so the real protection is the last question saying plainly what is
            about to happen — the count goes on the button itself, not only in a
            line of text above it that a child tapping Hand in has already read
            past. */}
        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={hand_in} disabled={pending} className={buttonClass('primary')}>
              {pending
                ? 'Submitting…'
                : unanswered > 0
                  ? `Yes, hand in with ${unanswered} blank`
                  : 'Yes, hand it in'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={buttonClass('secondary')}>
              Keep working
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={buttonClass('primary')}>
            <Send className="h-4 w-4" aria-hidden />{' '}
            {unanswered > 0 ? `Hand in with ${unanswered} blank` : 'Hand in'}
          </button>
        )}
      </Card>
    </div>
  )
}
