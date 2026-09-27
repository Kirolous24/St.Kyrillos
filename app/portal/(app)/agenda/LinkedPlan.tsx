'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Eye } from 'lucide-react'
import { shareAgendaWeek } from '@/lib/portal/actions/agenda'
import { Callout, buttonClass, selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * Another class's plan, opened through a curriculum link. It is read-only here:
 * the link lets this servant read it and copy a week into their own linked class,
 * and grants nothing else about that class.
 */
export function LinkedPlan({
  weekStart,
  weekLabel,
  source,
  targets,
}: {
  weekStart: string
  weekLabel: string
  source: { id: string; name: string }
  /** The viewer's own classes linked with this one, which they may edit. */
  targets: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [to, setTo] = useState(targets[0]?.id ?? '')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const toName = targets.find((t) => t.id === to)?.name ?? 'your class'

  return (
    <div className="mb-4 print:hidden">
      <Callout tone="info" title={`Reading ${source.name}'s plan`}>
        <span className="flex flex-wrap items-center gap-2">
          <Eye className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden />
          <span className="min-w-0 flex-1">Linked with your class, so it is read-only here. Copy a week to use it.</span>
        </span>
        {targets.length > 0 && (
          <span className="mt-2.5 flex flex-wrap items-center gap-2">
            {targets.length > 1 && (
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={cn(selectClass, 'max-w-[220px]')}
                aria-label="Copy into"
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={pending || !to}
              className={buttonClass('secondary', 'sm')}
              onClick={() => {
                if (!window.confirm(`Copy ${source.name}'s ${weekLabel} into ${toName}? Anything already filled in for that week is replaced.`)) return
                setMessage(null)
                startTransition(async () => {
                  const r = await shareAgendaWeek({ classId: source.id, toClassId: to, weekStart })
                  if (!r.ok) return setMessage({ kind: 'err', text: r.error })
                  setMessage({
                    kind: 'ok',
                    text: `Copied ${weekLabel} into ${toName}${r.data && r.data.dropped > 0 ? ` — ${r.data.dropped} assignment${r.data.dropped === 1 ? '' : 's'} left blank` : ''}.`,
                  })
                  router.refresh()
                })
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden /> {pending ? 'Copying…' : `Copy this week into ${toName}`}
            </button>
          </span>
        )}
        {message && (
          <p role="status" className={message.kind === 'ok' ? 'mt-2 font-semibold text-[#15803D]' : 'mt-2 font-semibold text-[#B91C1C]'}>
            {message.text}
          </p>
        )}
      </Callout>
    </div>
  )
}
