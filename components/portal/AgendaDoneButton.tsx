'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RotateCcw } from 'lucide-react'
import { setAgendaItemDone } from '@/lib/portal/actions/agenda'
import { buttonClass } from './ui'
import { cn } from '@/lib/utils'

/**
 * Mark a part of a Sunday ready, or take the mark back (2026-10-19): the
 * servant on the part taps it once they have, say, updated the slides, and the
 * coordinator sees it on the Schedule.
 */
export function AgendaDoneButton({ itemId, done, part }: { itemId: string; done: boolean; part: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    startTransition(async () => {
      try {
        const r = await setAgendaItemDone({ itemId, done: !done })
        if (!r.ok) setError(r.error)
        else router.refresh()
      } catch {
        setError('That did not save. Try again.')
      }
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={done ? `Undo done for ${part}` : `Mark ${part} done`}
        data-testid="agenda-done-button"
        className={cn(buttonClass(done ? 'ghost' : 'primary', 'sm'), 'min-h-[34px]')}
      >
        {done ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
        {done ? 'Undo' : 'Mark done'}
      </button>
      {error && <span className="text-[11.5px] font-semibold text-[#DC2626]">{error}</span>}
    </span>
  )
}
