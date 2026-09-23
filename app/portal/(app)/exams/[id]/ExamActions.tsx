'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Eye, Trash2, Unlock } from 'lucide-react'
import { deleteExams, setExamStatus, setReopenedStudents } from '@/lib/portal/actions/exams'
import { Badge, Callout, Card, EmptyState, Field, buttonClass, checkboxClass, selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

interface RosterRow {
  id: string
  name: string
  submitted: boolean
}

/** Reopen, publish/close and delete — the write controls for one exam. */
export function ExamActions({
  examId,
  status,
  roster,
  reopened,
}: {
  examId: string
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  roster: RosterRow[]
  reopened: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set(reopened))
  const [nextStatus, setNextStatus] = useState(status)
  const [confirming, setConfirming] = useState(false)

  const candidates = roster.filter((r) => !r.submitted || picked.has(r.id))

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function saveReopen() {
    setMessage(null)
    startTransition(async () => {
      const result = await setReopenedStudents({ examId, studentIds: Array.from(picked) })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({
        kind: 'ok',
        text: result.data?.count
          ? `${result.data.count} student${result.data.count === 1 ? '' : 's'} can take this exam again.`
          : 'Nobody is reopened for this exam any more.',
      })
      router.refresh()
    })
  }

  function saveStatus(value: 'DRAFT' | 'PUBLISHED' | 'CLOSED') {
    setNextStatus(value)
    setMessage(null)
    startTransition(async () => {
      const result = await setExamStatus({ examId, status: value })
      if (!result.ok) {
        setNextStatus(status)
        return setMessage({ kind: 'err', text: result.error })
      }
      setMessage({ kind: 'ok', text: 'Visibility updated.' })
      router.refresh()
    })
  }

  function remove() {
    setMessage(null)
    startTransition(async () => {
      const result = await deleteExams([examId])
      if (!result.ok) {
        setConfirming(false)
        return setMessage({ kind: 'err', text: result.error })
      }
      router.push('/portal/exams')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 print:hidden">
      {message && <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>{message.text}</Callout>}

      <Card
        title="Reopen for students"
        icon={<Unlock className="h-4 w-4" aria-hidden />}
        action={<Badge tone="info">{picked.size} selected</Badge>}
      >
        <p className="mb-3 text-[12.5px] text-parch-500">
          A reopened student can take the exam even after the due date. Everyone else sees it as missed.
        </p>
        {candidates.length === 0 ? (
          <EmptyState title="Everyone has submitted" hint="There is nobody left to reopen this exam for." />
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {candidates.map((r) => (
              <li key={r.id}>
                <label
                  className={cn(
                    'flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-[12.5px] transition-colors',
                    picked.has(r.id) ? 'bg-brand-wash text-brand-900' : 'hover:bg-parch-100',
                  )}
                >
                  <input type="checkbox" className={cn(checkboxClass, 'h-[18px] w-[18px]')} checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                  {r.submitted && <Badge tone="good">Submitted</Badge>}
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button type="button" onClick={saveReopen} disabled={pending} className={buttonClass('primary', 'sm')}>
            <Unlock className="h-4 w-4" aria-hidden /> {pending ? 'Saving…' : 'Save reopened list'}
          </button>
          {/* F0037 / F0488 — when a quiz is published late the whole class needs
              reopening, and ticking thirty children one box at a time is the job
              that gets abandoned half-done. Only `candidates` are ticked, so a
              student who has already handed the paper in is never reopened by
              accident. */}
          {candidates.length > 0 && (
            <button
              type="button"
              data-reopen-select-all=""
              onClick={() => setPicked(new Set(candidates.map((r) => r.id)))}
              disabled={picked.size === candidates.length}
              className={cn(buttonClass('secondary', 'sm'), 'disabled:opacity-40')}
            >
              Select all {candidates.length}
            </button>
          )}
          {picked.size > 0 && (
            <button type="button" onClick={() => setPicked(new Set())} className={buttonClass('secondary', 'sm')}>
              Clear all
            </button>
          )}
        </div>
      </Card>

      <Card title="Visibility" icon={<Eye className="h-4 w-4" aria-hidden />}>
        <div className="max-w-sm">
          <Field label="Who can see this exam" htmlFor="exam-visibility">
            <select
              id="exam-visibility"
              className={selectClass}
              value={nextStatus}
              disabled={pending}
              onChange={(e) => saveStatus(e.target.value as 'DRAFT' | 'PUBLISHED' | 'CLOSED')}
            >
              <option value="PUBLISHED">Published — students can take it</option>
              <option value="DRAFT">Draft — hidden from students</option>
              <option value="CLOSED">Closed — no new submissions</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Danger zone" icon={<AlertTriangle className="h-4 w-4" aria-hidden />}>
        <p className="mb-3 text-[12.5px] text-parch-500">
          Deleting removes the exam, every submitted paper, and the points those papers awarded. It cannot be undone.
        </p>
        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={remove} disabled={pending} className={buttonClass('danger', 'sm')}>
              {pending ? 'Deleting…' : 'Yes, delete this exam'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={buttonClass('secondary', 'sm')}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass('danger', 'sm')}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete exam
          </button>
        )}
      </Card>
    </div>
  )
}
