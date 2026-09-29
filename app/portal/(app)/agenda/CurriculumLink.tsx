'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/portal/Link'
import { Link as LinkIcon, Copy } from 'lucide-react'
import { shareAgendaWeek } from '@/lib/portal/actions/agenda'
import { Callout, buttonClass } from '@/components/portal/ui'

/**
 * The classes this one is linked with. A link joins two classes both ways
 * (2026-09-26): each can open the other's plan and copy a week of it into its
 * own. The link is shown, not silent: the prototype's "permanently follow" was
 * easy to forget was on and impossible to tell from two classes that merely
 * teach the same thing.
 */
export function LinkedWith({
  classId,
  weekStart,
  weekLabel,
  links,
  canWrite,
}: {
  classId: string
  weekStart: string
  weekLabel: string
  links: Array<{ id: string; name: string }>
  canWrite: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  return (
    <div className="mb-4 print:hidden">
      <Callout tone="info" title={`Linked with ${links.map((l) => l.name).join(', ')}`}>
        <p className="flex items-center gap-2">
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden />
          <span>Linked classes can read each other&rsquo;s plan and copy a week of it. Nothing else is shared.</span>
        </p>
        <ul className="mt-2 space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2">
              <Link
                href={`/portal/agenda?class=${encodeURIComponent(l.id)}&week=${weekStart}`}
                className="font-semibold text-brand-800 underline"
              >
                Open {l.name}&rsquo;s plan
              </Link>
              {canWrite && (
                <button
                  type="button"
                  disabled={pending}
                  className={buttonClass('secondary', 'sm')}
                  onClick={() => {
                    if (!window.confirm(`Copy ${l.name}'s ${weekLabel} into this class? Anything already filled in for that week is replaced.`)) return
                    setMessage(null)
                    startTransition(async () => {
                      const r = await shareAgendaWeek({ classId: l.id, toClassId: classId, weekStart })
                      if (!r.ok) return setMessage({ kind: 'err', text: r.error })
                      setMessage({
                        kind: 'ok',
                        text: `Copied ${weekLabel} from ${l.name}${r.data && r.data.dropped > 0 ? ` — ${r.data.dropped} assignment${r.data.dropped === 1 ? '' : 's'} left blank` : ''}.`,
                      })
                      router.refresh()
                    })
                  }}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden /> {pending ? 'Copying…' : `Copy this week from ${l.name}`}
                </button>
              )}
            </li>
          ))}
        </ul>
        {message && (
          <p role="status" className={message.kind === 'ok' ? 'mt-2 font-semibold text-[#15803D]' : 'mt-2 font-semibold text-[#B91C1C]'}>
            {message.text}
          </p>
        )}
      </Callout>
    </div>
  )
}
