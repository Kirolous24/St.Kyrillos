'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, CircleCheck, RotateCcw } from 'lucide-react'
import { logContact, resolveCase, reopenCase } from '@/lib/portal/actions/followups'
import { RESOLVE_REASONS, type ResolveReasonKey } from '@/lib/portal/followups'
import { Card, Callout, Field, inputClass, selectClass, textareaClass, buttonClass } from '@/components/portal/ui'

export function CaseActions({ caseId, status }: { caseId: string; status: 'OPEN' | 'DONE' }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [method, setMethod] = useState<'call' | 'text' | 'whatsapp' | 'email' | 'visit' | 'other'>('call')
  const [result, setResult] = useState<'reached' | 'no_answer' | 'left_message' | 'will_come' | 'other'>('reached')
  const [note, setNote] = useState('')
  const [next, setNext] = useState('')
  // F0110 — "Attending again" was pre-selected, so the happiest possible
  // outcome was one click away from being recorded for a child nobody had
  // spoken to. Closing a case is a statement about a family; it starts blank.
  const [reason, setReason] = useState<ResolveReasonKey | ''>('')
  const [resolveNote, setResolveNote] = useState('')

  if (status === 'DONE') {
    return (
      <Card title="Actions" icon={<RotateCcw className="h-4 w-4" />}>
        <p className="mb-3 text-[12.5px] text-parch-500">This case is closed. Reopen it if the student needs another check-in.</p>
        <button
          type="button"
          disabled={pending}
          className={buttonClass('secondary')}
          onClick={() => startTransition(async () => { const r = await reopenCase(caseId); if (!r.ok) setError(r.error); router.refresh() })}
        >
          Reopen case
        </button>
        {error && (
          <div role="alert" className="mt-3">
            <Callout tone="bad">{error}</Callout>
          </div>
        )}
      </Card>
    )
  }

  return (
    <>
      <Card title="Log a contact" icon={<PhoneCall className="h-4 w-4" />}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            startTransition(async () => {
              const r = await logContact({ caseId, method, result, note, nextFollowUp: next || undefined })
              if (!r.ok) return setError(r.error)
              setNote('')
              setNext('')
              router.refresh()
            })
          }}
        >
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <Field label="How" htmlFor="log-method">
              <select id="log-method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={selectClass}>
                <option value="call">Phone call</option>
                <option value="text">Text</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="visit">Visit</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Result" htmlFor="log-result">
              <select id="log-result" value={result} onChange={(e) => setResult(e.target.value as typeof result)} className={selectClass}>
                <option value="reached">Reached</option>
                <option value="no_answer">No answer</option>
                <option value="left_message">Left message</option>
                <option value="will_come">Will come</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Note" htmlFor="log-note">
            <textarea id="log-note" value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} rows={2} maxLength={1000} />
          </Field>
          <Field label="Next follow-up" htmlFor="log-next" hint="Optional — when to check in again.">
            <input id="log-next" type="date" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          </Field>
          <button type="submit" disabled={pending} className={buttonClass('primary')}>
            {pending ? 'Saving…' : 'Add to log'}
          </button>
        </form>
      </Card>

      <Card title="Resolve" icon={<CircleCheck className="h-4 w-4" />}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            if (!reason) return setError('Choose a reason for closing this case.')
            if (reason === 'other' && !resolveNote.trim()) {
              return setError('Say what happened when the reason is "Other".')
            }
            startTransition(async () => {
              const r = await resolveCase({ caseId, reason, note: resolveNote })
              if (!r.ok) return setError(r.error)
              router.refresh()
            })
          }}
        >
          <Field label="Reason" htmlFor="resolve-reason">
            <select id="resolve-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={selectClass} required>
              <option value="">Choose a reason…</option>
              {RESOLVE_REASONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note" htmlFor="resolve-note">
            <input id="resolve-note" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} className={inputClass} maxLength={1000} />
          </Field>
          <button type="submit" disabled={pending || !reason} className={buttonClass('secondary')}>
            Mark resolved
          </button>
        </form>
        {error && (
          <div role="alert" className="mt-3">
            <Callout tone="bad">{error}</Callout>
          </div>
        )}
      </Card>
    </>
  )
}
