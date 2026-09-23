'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eraser } from 'lucide-react'
import { clearAgendaWeeks } from '@/lib/portal/actions/agenda'
import { Card, buttonClass, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface ClearableWeek {
  weekStart: string
  label: string
  filledCount: number
  hasSlides: boolean
}

/**
 * F0221 / F0490 / F0585 / F0586 — clear several weeks of the year plan at once.
 *
 * The old app had a tick box on every week tile in the year list and a "Clear
 * Selected Weeks" button. A servant who filled September against the wrong
 * class, or imported a schedule a week out of step, otherwise has to open and
 * clear each week one at a time.
 *
 * It is a separate folded panel rather than a tick box on each tile, for two
 * reasons: the tiles are links, so a checkbox inside one fights the click it
 * already has; and this deletes lesson planning, which does not belong one
 * mis-tap away from browsing the year. Only weeks that actually have something
 * saved are listed — ticking an empty week would do nothing and only makes the
 * list longer.
 */
export function ClearWeeksPanel({
  classId,
  className,
  weeks,
}: {
  classId: string
  className: string
  weeks: ClearableWeek[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  if (weeks.length === 0) return null

  const allPicked = picked.length === weeks.length
  const toggle = (weekStart: string) =>
    setPicked((p) => (p.includes(weekStart) ? p.filter((x) => x !== weekStart) : [...p, weekStart]))

  function clear() {
    const count = picked.length
    if (count === 0) {
      setError('Tick the weeks you want to clear first.')
      return
    }
    const chosen = weeks.filter((w) => picked.includes(w.weekStart))
    const shown = chosen.slice(0, 10).map((w) => w.label).join('\n')
    const items = chosen.reduce((n, w) => n + w.filledCount, 0)
    if (
      !window.confirm(
        `Clear ${count} week${count === 1 ? '' : 's'} of ${className}?\n\n${shown}${chosen.length > 10 ? `\n…and ${chosen.length - 10} more` : ''}\n\nThis deletes the lesson plan for ${count === 1 ? 'that week' : 'those weeks'} — ${items} filled ${items === 1 ? 'row' : 'rows'}, plus the topics, the lead and backup servants, the notes and any slide links. It cannot be undone.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await clearAgendaWeeks({ classId, weekStarts: picked })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setError('')
      setPicked([])
      const cleared = r.data?.cleared ?? count
      setDone(`Cleared ${cleared} week${cleared === 1 ? '' : 's'}.`)
      router.refresh()
    })
  }

  return (
    <Card title="Clear several weeks" icon={<Eraser className="h-[15px] w-[15px]" />}>
      {!open ? (
        <div className="space-y-2">
          <p className="text-[12.5px] text-parch-700">
            For a run of weeks filled in against the wrong class, or a schedule imported a week out of
            step. Clearing one week at a time is on the week itself.
          </p>
          <button
            type="button"
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
            onClick={() => setOpen(true)}
          >
            Choose weeks to clear
          </button>
          {done && <Callout tone="good">{done}</Callout>}
        </div>
      ) : (
        <div className="space-y-2.5">
          <button
            type="button"
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}
            onClick={() => setPicked(allPicked ? [] : weeks.map((w) => w.weekStart))}
          >
            {allPicked ? 'Untick all' : `Tick all ${weeks.length}`}
          </button>
          <ul className="max-h-[300px] space-y-1 overflow-y-auto">
            {weeks.map((w) => (
              <li key={w.weekStart}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[12.5px] hover:bg-brand-wash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-brand-800"
                    checked={picked.includes(w.weekStart)}
                    onChange={() => toggle(w.weekStart)}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold text-parch-800">{w.label}</span>
                  <span className="shrink-0 text-[11px] text-parch-500">
                    {w.filledCount}/10{w.hasSlides ? ' · slides' : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || picked.length === 0}
              className={cn(buttonClass('danger', 'sm'), 'min-h-[40px]')}
              onClick={clear}
            >
              {pending ? 'Clearing…' : `Clear ${picked.length} selected week${picked.length === 1 ? '' : 's'}`}
            </button>
            <button
              type="button"
              className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
              onClick={() => {
                setOpen(false)
                setPicked([])
                setError('')
              }}
            >
              Cancel
            </button>
          </div>
          {error && (
            <div role="alert">
              <Callout tone="bad">{error}</Callout>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
