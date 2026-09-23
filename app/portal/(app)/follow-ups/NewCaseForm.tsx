'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { createManualCase } from '@/lib/portal/actions/followups'
import { Card, Callout, Field, inputClass, selectClass, textareaClass, buttonClass } from '@/components/portal/ui'

const RESOLVE_REASONS: Array<{ value: string; label: string }> = [
  { value: 'attending_again', label: 'Coming again' },
  { value: 'moved', label: 'Moved away' },
  { value: 'sick', label: 'Unwell' },
  { value: 'family', label: 'Family situation' },
  { value: 'lost_interest', label: 'Lost interest' },
  { value: 'other', label: 'Other' },
]

export function NewCaseForm({ students, today }: { students: Array<{ id: string; label: string }>; today: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [studentId, setStudentId] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  /**
   * F0106 — the two things a servant actually needed on a Sunday. A case typed
   * up midweek should carry the date the conversation happened, because the age
   * of a case is what pushes it up the list; and a family somebody already rang
   * should go into the record closed, not onto the list to be chased again.
   */
  const [openedOn, setOpenedOn] = useState(today)
  const [alreadyHandled, setAlreadyHandled] = useState(false)
  const [resolveReason, setResolveReason] = useState('')
  const [resolveNote, setResolveNote] = useState('')
  const [error, setError] = useState('')

  return (
    <Card title="Open a case" icon={<UserPlus className="h-4 w-4" />} className="lg:sticky lg:top-4 lg:self-start">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          startTransition(async () => {
            const r = await createManualCase({
              studentId,
              title,
              details,
              openedOn: openedOn && openedOn !== today ? openedOn : undefined,
              alreadyHandled,
              resolveReason: alreadyHandled ? (resolveReason as never) : undefined,
              resolveNote: alreadyHandled ? resolveNote : undefined,
            })
            if (!r.ok) return setError(r.error)
            router.push(`/portal/follow-ups/${r.data!.caseId}`)
            router.refresh()
          })
        }}
      >
        <Field label="Student" htmlFor="case-student">
          <select id="case-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={selectClass} required>
            <option value="">Choose…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="What is going on?" htmlFor="case-title">
          <input id="case-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required maxLength={120} placeholder="e.g. Family going through a hard time" />
        </Field>
        <Field label="Details" htmlFor="case-details" hint="Optional — anything the next servant should know.">
          <textarea id="case-details" value={details} onChange={(e) => setDetails(e.target.value)} className={textareaClass} maxLength={1000} rows={3} />
        </Field>
        <Field label="When did it start?" htmlFor="case-opened" hint="Defaults to today. Backdate it if the conversation was earlier.">
          <input
            id="case-opened"
            type="date"
            value={openedOn}
            max={today}
            onChange={(e) => setOpenedOn(e.target.value)}
            className={inputClass}
          />
        </Field>
        <label className="mb-3 flex items-start gap-2.5 text-[12.5px] font-semibold text-parch-700">
          <input
            type="checkbox"
            checked={alreadyHandled}
            onChange={(e) => setAlreadyHandled(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-800"
          />
          <span>
            Already sorted out
            <span className="block text-[11.5px] font-normal text-parch-500">
              Records it for the history without putting it on the list to be chased.
            </span>
          </span>
        </label>
        {alreadyHandled && (
          <>
            <Field label="How was it sorted?" htmlFor="case-reason">
              <select id="case-reason" value={resolveReason} onChange={(e) => setResolveReason(e.target.value)} className={selectClass} required>
                <option value="">Choose…</option>
                {RESOLVE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field
              label="Note"
              htmlFor="case-resolve-note"
              hint={resolveReason === 'other' ? 'Required when the reason is "Other".' : 'Optional'}
            >
              <textarea
                id="case-resolve-note"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                className={textareaClass}
                maxLength={1000}
                rows={2}
              />
            </Field>
          </>
        )}
        {error && (
          <div role="alert" className="mb-3.5">
            <Callout tone="bad">{error}</Callout>
          </div>
        )}
        <button type="submit" disabled={pending || !studentId} className={buttonClass('primary')}>
          {pending ? 'Saving…' : alreadyHandled ? 'Record it' : 'Open case'}
        </button>
      </form>
    </Card>
  )
}
