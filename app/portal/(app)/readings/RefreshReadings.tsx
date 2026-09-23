'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { buttonClass, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * F0325 — fetch the readings again when today's have not arrived.
 *
 * Admins only, on purpose. The first version of this endpoint deleted four weeks
 * of readings before fetching anything, so on a morning when the upstream feed
 * was down, a servant pressing "try again" at the altar was left with nothing at
 * all rather than one stale day. The endpoint now replaces each day in place, and
 * a servant who needs it asks the office — which is the trade the church picked
 * over leaving a "try again" button that can make things much worse in reach of
 * everyone.
 */
export function RefreshReadings() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  return (
    <div className="space-y-2 print:hidden">
      <button
        type="button"
        disabled={pending}
        className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
        onClick={() =>
          startTransition(async () => {
            setMessage(null)
            try {
              const res = await fetch('/api/coptic/refresh', { method: 'POST' })
              const body = (await res.json().catch(() => null)) as
                | { message?: string; error?: string }
                | null
              if (!res.ok) {
                setMessage({
                  kind: 'err',
                  text: body?.error ?? 'The calendar feed could not be reached. Today’s readings are unchanged.',
                })
                return
              }
              setMessage({ kind: 'ok', text: body?.message ?? 'Refreshed.' })
              router.refresh()
            } catch {
              setMessage({
                kind: 'err',
                text: 'The calendar feed could not be reached. Today’s readings are unchanged.',
              })
            }
          })
        }
      >
        <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} aria-hidden />{' '}
        {pending ? 'Fetching…' : 'Fetch the readings again'}
      </button>
      {message && (
        <div role="status">
          <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>{message.text}</Callout>
        </div>
      )}
    </div>
  )
}
