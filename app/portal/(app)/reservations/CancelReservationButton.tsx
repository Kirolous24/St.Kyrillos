'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelReservation } from '@/lib/portal/actions/reservations'
import { InlineNotice, buttonClass } from '@/components/portal/ui'

/** Cancel a reservation, after saying which one (2026-11-02). */
export function CancelReservationButton({ id, what, label = 'Cancel this reservation' }: { id: string; what: string; label?: string }) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function cancel() {
    setError(null)
    startTransition(async () => {
      const result = await cancelReservation(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/portal/reservations?month=${result.data!.month}&cancelled=1`)
      router.refresh()
    })
  }

  if (!asking) {
    return (
      <button type="button" className={buttonClass('danger', 'sm')} onClick={() => setAsking(true)} data-testid="cancel-reservation">
        {label}
      </button>
    )
  }
  return (
    <div role="alertdialog" aria-label="Cancel this reservation?" className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-3">
      <p className="mb-2 text-[12.5px] font-bold text-[#991B1B]">Cancel {what}?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass('danger', 'sm')} onClick={cancel} disabled={pending} data-testid="cancel-reservation-yes">
          {pending ? 'Cancelling…' : 'Yes, cancel it'}
        </button>
        <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setAsking(false)} disabled={pending}>
          Keep it
        </button>
      </div>
      {error && <InlineNotice tone="bad" className="mt-2">{error}</InlineNotice>}
    </div>
  )
}
