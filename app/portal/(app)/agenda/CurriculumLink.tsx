'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Link as LinkIcon, Copy } from 'lucide-react'
import { shareAgendaWeek } from '@/lib/portal/actions/agenda'
import { Callout, buttonClass } from '@/components/portal/ui'

/**
 * Shown when an admin has pointed this class's curriculum at another one.
 *
 * The link is deliberately visible and manual rather than silently swapping
 * what the servant sees: the prototype's version made a class "permanently
 * follow" another, which is easy to forget is on and impossible to tell from a
 * class that simply happens to teach the same thing. This says whose plan it
 * follows and pulls that week across on request.
 */
export function CurriculumLink({
  classId,
  weekStart,
  weekLabel,
  source,
  canWrite,
}: {
  classId: string
  weekStart: string
  weekLabel: string
  source: { id: string; name: string }
  canWrite: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  return (
    <div className="mb-4 print:hidden">
      <Callout tone="info" title={`This class follows ${source.name}`}>
        <span className="flex flex-wrap items-center gap-2">
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden />
          <span className="min-w-0 flex-1">
            An admin linked its curriculum.{' '}
            <Link
              href={`/portal/agenda?class=${encodeURIComponent(source.id)}&week=${weekStart}`}
              className="font-semibold text-brand-800 underline"
            >
              Open {source.name}&rsquo;s plan
            </Link>
            .
          </span>
          {canWrite && (
            <button
              type="button"
              disabled={pending}
              className={buttonClass('secondary', 'sm')}
              onClick={() => {
                if (!window.confirm(`Copy ${source.name}'s ${weekLabel} into this class? Anything already filled in for that week is replaced.`)) return
                setMessage(null)
                startTransition(async () => {
                  // source -> this class, which is the direction the link means.
                  const r = await shareAgendaWeek({ classId: source.id, toClassId: classId, weekStart })
                  if (!r.ok) return setMessage({ kind: 'err', text: r.error })
                  setMessage({
                    kind: 'ok',
                    text: `Copied ${weekLabel} from ${source.name}${r.data && r.data.dropped > 0 ? ` — ${r.data.dropped} assignment${r.data.dropped === 1 ? '' : 's'} left blank` : ''}.`,
                  })
                  router.refresh()
                })
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden /> {pending ? 'Copying…' : 'Copy this week'}
            </button>
          )}
        </span>
        {message && (
          <p role="status" className={message.kind === 'ok' ? 'mt-2 font-semibold text-[#15803D]' : 'mt-2 font-semibold text-[#B91C1C]'}>
            {message.text}
          </p>
        )}
      </Callout>
    </div>
  )
}
