'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { decideReservation } from '@/lib/portal/actions/reservations'
import { InlineNotice, buttonClass, textareaClass } from '@/components/portal/ui'
import { DECISION_NOTE_MAX, type ReservationStatus } from '@/lib/portal/reservations'

/**
 * Approve or reject a van request (2026-11-04): "he can accept it or reject
 * it". Rejecting asks why, for the one who asked; saying why is up to the
 * approver. An approved one can still be rejected, and a rejected one approved.
 */
export function DecisionButtons({
  id,
  status,
  asker,
  afterHref,
}: {
  id: string
  status: ReservationStatus
  /** Who asked, by name: they are told the answer. */
  asker: string
  /** Where to go once it is answered; without it the page stays and shows the answer. */
  afterHref?: string
}) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function decide(decision: 'APPROVED' | 'REJECTED') {
    setMessage(null)
    startTransition(async () => {
      const result = await decideReservation({ id, decision, note: decision === 'REJECTED' ? note : undefined })
      if (!result.ok) {
        setMessage({ tone: 'bad', text: result.error })
        return
      }
      setRejecting(false)
      setNote('')
      if (afterHref) {
        router.push(afterHref)
      } else {
        setMessage({ tone: 'good', text: `${decision === 'APPROVED' ? 'Approved' : 'Rejected'}. ${asker} has been told.` })
      }
      router.refresh()
    })
  }

  return (
    <div data-testid={`decide-${id}`}>
      {rejecting ? (
        <div role="group" aria-label="Reject this request" className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-3">
          <label htmlFor={`why-${id}`} className="mb-1.5 block text-[12px] font-bold text-[#991B1B]">
            Why? (optional: {asker} is told)
          </label>
          <textarea
            id={`why-${id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={textareaClass}
            maxLength={DECISION_NOTE_MAX}
            placeholder="e.g. The van is in the shop that week"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={buttonClass('danger', 'sm')} onClick={() => decide('REJECTED')} disabled={pending}>
              {pending ? 'Rejecting…' : 'Reject it'}
            </button>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setRejecting(false)} disabled={pending}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status !== 'APPROVED' && (
            <button type="button" className={buttonClass('primary', 'sm')} onClick={() => decide('APPROVED')} disabled={pending}>
              <Check className="h-4 w-4" aria-hidden />
              {pending ? 'Approving…' : 'Approve'}
            </button>
          )}
          {status !== 'REJECTED' && (
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setRejecting(true)} disabled={pending}>
              <X className="h-4 w-4" aria-hidden />
              Reject
            </button>
          )}
        </div>
      )}
      {message && (
        <InlineNotice tone={message.tone} className="mt-2">
          {message.text}
        </InlineNotice>
      )}
    </div>
  )
}
