'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { createExam, updateExam } from '@/lib/portal/actions/exams'
import { MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS } from '@/lib/portal/exams'
import {
  Callout,
  Card,
  Field,
  buttonClass,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface EditorQuestion {
  id?: string
  text: string
  options: string[]
  correctIndex: number
}

export interface EditorExam {
  id: string
  classId: string
  title: string
  subject: string
  dueDate: string
  pointsPerQuestion: number
  bibleReading: string
  readingMessage: string
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  questions: EditorQuestion[]
}

/**
 * Local option shape. The correct answer is bound to an option's KEY, never to
 * its position, so adding, removing or reordering options can never re-key the
 * exam (the prototype's blank-option bug — ANALYSIS §6).
 */
interface Opt {
  key: number
  value: string
}
interface Q {
  key: number
  id?: string
  text: string
  options: Opt[]
  correctKey: number | null
}

let counter = 0
const nextKey = () => ++counter

function blankQuestion(): Q {
  const options = [
    { key: nextKey(), value: '' },
    { key: nextKey(), value: '' },
    { key: nextKey(), value: '' },
    { key: nextKey(), value: '' },
  ]
  return { key: nextKey(), text: '', options, correctKey: options[0]!.key }
}

function fromExisting(q: EditorQuestion): Q {
  const options = q.options.map((value) => ({ key: nextKey(), value }))
  return {
    key: nextKey(),
    id: q.id,
    text: q.text,
    options: options.length ? options : blankQuestion().options,
    correctKey: options[q.correctIndex]?.key ?? options[0]?.key ?? null,
  }
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** The prototype's uppercase rule above a block of fields. */
function GroupLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <p className="mb-3 border-b border-parch-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
      {children}
      {hint && <span className="ml-1.5 font-normal normal-case tracking-normal text-parch-500">{hint}</span>}
    </p>
  )
}

export function ExamEditor({
  classes,
  exam,
  hasResults = false,
}: {
  classes: { id: string; name: string }[]
  exam?: EditorExam
  hasResults?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [classId, setClassId] = useState(exam?.classId ?? classes[0]?.id ?? '')
  const [title, setTitle] = useState(exam?.title ?? '')
  const [subject, setSubject] = useState(exam?.subject ?? '')
  const [dueDate, setDueDate] = useState(exam?.dueDate ?? '')
  const [pointsPerQuestion, setPointsPerQuestion] = useState(exam?.pointsPerQuestion ?? 2)
  const [bibleReading, setBibleReading] = useState(exam?.bibleReading ?? '')
  const [readingMessage, setReadingMessage] = useState(exam?.readingMessage ?? '')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'CLOSED'>(exam?.status ?? 'PUBLISHED')
  const [questions, setQuestions] = useState<Q[]>(
    exam && exam.questions.length ? exam.questions.map(fromExisting) : [blankQuestion()],
  )

  function patch(key: number, change: (q: Q) => Q) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? change(q) : q)))
  }

  function move(index: number, delta: number) {
    setQuestions((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [row] = next.splice(index, 1)
      next.splice(target, 0, row!)
      return next
    })
  }

  function submit() {
    setError(null)
    if (!classId) return setError('Choose a class for this exam.')
    if (!title.trim()) return setError('Give the exam a title.')

    const payload = questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => o.value),
      correctIndex: q.options.findIndex((o) => o.key === q.correctKey),
    }))
    const unmarked = payload.findIndex((q) => q.correctIndex < 0)
    if (unmarked !== -1) return setError(`Question ${unmarked + 1}: mark which option is the correct answer.`)

    startTransition(async () => {
      const base = {
        classId,
        title: title.trim(),
        subject: subject.trim() || undefined,
        dueDate: dueDate || undefined,
        pointsPerQuestion,
        bibleReading: bibleReading.trim() || undefined,
        readingMessage: readingMessage.trim() || undefined,
        status,
        questions: payload,
      }
      const result = exam ? await updateExam({ ...base, examId: exam.id }) : await createExam(base)
      if (!result.ok) return setError(result.error)
      router.push(`/portal/exams/${result.data?.id ?? exam?.id ?? ''}`)
      router.refresh()
    })
  }

  const totalPoints = questions.length * pointsPerQuestion

  return (
    <div className="space-y-4">
      {error && <Callout tone="bad" title="Nothing was saved">{error}</Callout>}
      {hasResults && (
        <Callout tone="warn" title="Students have already submitted">
          Editing questions will not re-grade the papers already handed in. Their saved scores stay as they were.
        </Callout>
      )}

      <Card>
        <GroupLabel>Exam details</GroupLabel>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Class" htmlFor="exam-class" hint={exam ? 'An exam cannot move class once it exists.' : undefined}>
            <select
              id="exam-class"
              className={selectClass}
              value={classId}
              disabled={!!exam}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.length === 0 && <option value="">No classes available</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Title" htmlFor="exam-title">
            <input id="exam-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gospel of St. Mark — chapters 1–3" />
          </Field>
          <Field label="Subject" htmlFor="exam-subject" hint="Optional">
            <input id="exam-subject" className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Bible" />
          </Field>
          <Field label="Due date" htmlFor="exam-due" hint="Leave blank for no deadline">
            <input id="exam-due" type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Points per question" htmlFor="exam-pts" hint={`Worth ${totalPoints} point${totalPoints === 1 ? '' : 's'} in total`}>
            <input
              id="exam-pts"
              type="number"
              min={1}
              max={100}
              className={inputClass}
              value={pointsPerQuestion}
              onChange={(e) => setPointsPerQuestion(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            />
          </Field>
          <Field label="Visibility" htmlFor="exam-status" hint="Drafts stay hidden from students">
            <select id="exam-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
          <Field label="Bible reading" htmlFor="exam-reading" hint="Optional — shown with the quiz">
            <input id="exam-reading" className={inputClass} value={bibleReading} onChange={(e) => setBibleReading(e.target.value)} placeholder="Mark 1–3" />
          </Field>
          <Field label="Reading message" htmlFor="exam-msg" hint="Optional note for the students">
            <textarea id="exam-msg" className={textareaClass} value={readingMessage} onChange={(e) => setReadingMessage(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
          Questions <span className="font-normal normal-case tracking-normal">· {pointsPerQuestion} pt{pointsPerQuestion === 1 ? '' : 's'} each</span>
        </h2>
        <span className="text-[12px] text-parch-500 tabular-nums">
          {questions.length}/{MAX_QUESTIONS}
        </span>
      </div>

      <div className="space-y-3.5">
        {questions.map((q, qi) => (
          <Card
            key={q.key}
            title={`Question ${qi + 1}`}
            action={
              <div className="flex gap-1">
                <button type="button" aria-label="Move up" disabled={qi === 0} onClick={() => move(qi, -1)} className={cn(buttonClass('ghost', 'sm'), 'px-2')}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" aria-label="Move down" disabled={qi === questions.length - 1} onClick={() => move(qi, 1)} className={cn(buttonClass('ghost', 'sm'), 'px-2')}>
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Remove question"
                  disabled={questions.length === 1}
                  onClick={() => setQuestions((prev) => prev.filter((row) => row.key !== q.key))}
                  className={cn(buttonClass('ghost', 'sm'), 'px-2 text-[#DC2626] hover:bg-[#FEF2F2]')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            }
          >
            <textarea
              id={`q-${q.key}`}
              aria-label={`Question ${qi + 1} text`}
              className={cn(textareaClass, 'mb-3 min-h-[3.5rem]')}
              value={q.text}
              onChange={(e) => patch(q.key, (row) => ({ ...row, text: e.target.value }))}
              placeholder="Enter question…"
            />

            <fieldset>
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                Answers <span className="font-normal normal-case tracking-normal">— mark the correct one</span>
              </legend>
              <ul className="space-y-2">
                {q.options.map((o, oi) => {
                  const isCorrect = q.correctKey === o.key
                  return (
                    <li key={o.key} className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[12px] font-bold text-parch-50',
                          isCorrect ? 'bg-[#16A34A]' : 'bg-brand-800',
                        )}
                      >
                        {LETTERS[oi]}
                      </span>
                      <input
                        className={cn(inputClass, 'min-w-0 flex-1 py-2')}
                        value={o.value}
                        placeholder={`Option ${LETTERS[oi]}`}
                        aria-label={`Option ${LETTERS[oi]}`}
                        onChange={(e) =>
                          patch(q.key, (row) => ({
                            ...row,
                            options: row.options.map((opt) => (opt.key === o.key ? { ...opt, value: e.target.value } : opt)),
                          }))
                        }
                      />
                      <label
                        className={cn(
                          'flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-semibold transition-colors',
                          isCorrect ? 'bg-[#DCFCE7] text-[#16A34A]' : 'text-parch-500 hover:bg-parch-100',
                        )}
                      >
                        <input
                          type="radio"
                          name={`correct-${q.key}`}
                          className="h-4 w-4 border-parch-300 text-[#16A34A] focus:ring-[#16A34A]/40"
                          checked={isCorrect}
                          onChange={() => patch(q.key, (row) => ({ ...row, correctKey: o.key }))}
                          aria-label={`Option ${LETTERS[oi]} is correct`}
                        />
                        <span className="hidden sm:inline">Correct</span>
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove option ${LETTERS[oi]}`}
                        disabled={q.options.length <= MIN_OPTIONS}
                        onClick={() =>
                          patch(q.key, (row) => ({
                            ...row,
                            options: row.options.filter((opt) => opt.key !== o.key),
                            // The key binding means the correct answer follows its
                            // option; removing the marked one simply clears it.
                            correctKey: row.correctKey === o.key ? null : row.correctKey,
                          }))
                        }
                        className={cn(buttonClass('ghost', 'sm'), 'px-2 text-parch-500 hover:bg-parch-100')}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {q.options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => patch(q.key, (row) => ({ ...row, options: [...row.options, { key: nextKey(), value: '' }] }))}
                  className={cn(buttonClass('secondary', 'sm'), 'mt-2.5')}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add option
                </button>
              )}
              {q.correctKey === null && (
                <p className="mt-2 text-[11px] font-bold text-[#DC2626]">Choose the correct answer for this question.</p>
              )}
            </fieldset>
          </Card>
        ))}
      </div>

      <Card bodyClassName="flex flex-wrap items-center justify-between gap-3 p-[18px]">
        <button
          type="button"
          disabled={questions.length >= MAX_QUESTIONS}
          onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}
          className={buttonClass('secondary')}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add question
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.back()} className={buttonClass('ghost')}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={pending || classes.length === 0} className={buttonClass('primary')}>
            <Save className="h-4 w-4" aria-hidden /> {pending ? 'Saving…' : exam ? 'Save changes' : 'Create exam'}
          </button>
        </div>
      </Card>
    </div>
  )
}
