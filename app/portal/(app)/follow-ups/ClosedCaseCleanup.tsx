'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { bulkDeleteCases } from '@/lib/portal/actions/followups'
import { Card, buttonClass, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface ClosedCaseRow {
  id: string
  name: string
  className: string
  resolved: string
}

/**
 * F0113 — clearing out closed follow-up cases in one go.
 *
 * The church asked for this on the condition that it asks before it acts. It
 * sits only on the resolved list, folded shut, and away from the cards a
 * servant reads day to day: a tick box beside every row on the ordinary view is
 * how a careful multi-step delete becomes one tap. What it removes is the
 * written record that somebody phoned a family, so the confirmation says so in
 * those words and names the number of cases going.
 */
export function ClosedCaseCleanup({ cases }: { cases: ClosedCaseRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  if (cases.length === 0) return null

  const allPicked = picked.length === cases.length
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  function remove() {
    const count = picked.length
    if (count === 0) {
      setError('Tick the cases you want to clear first.')
      return
    }
    const names = cases.filter((c) => picked.includes(c.id)).map((c) => c.name)
    const shown = names.slice(0, 8).join(', ')
    if (
      !confirm(
        `Clear ${count} closed case${count === 1 ? '' : 's'}?\n\n${shown}${names.length > 8 ? `, and ${names.length - 8} more` : ''}\n\nThis also deletes the contact log for each one — the record of who was phoned and what was said. It cannot be undone.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await bulkDeleteCases(picked)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setError('')
      setPicked([])
      setDone(`Cleared ${r.data?.deleted ?? count} closed case${(r.data?.deleted ?? count) === 1 ? '' : 's'}.`)
      router.refresh()
    })
  }

  return (
    <Card title="Clear closed cases" icon={<Trash2 className="h-[15px] w-[15px]" />}>
      {!open ? (
        <div className="space-y-2">
          <p className="text-[12.5px] text-parch-700">
            A closed case is the record that a family was contacted about a child who had stopped
            coming. Keep them unless the list has become unmanageable.
          </p>
          <button
            type="button"
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
            onClick={() => setOpen(true)}
          >
            Choose cases to clear
          </button>
          {done && <Callout tone="good">{done}</Callout>}
        </div>
      ) : (
        <div className="space-y-2.5">
          <button
            type="button"
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}
            onClick={() => setPicked(allPicked ? [] : cases.map((c) => c.id))}
          >
            {allPicked ? 'Untick all' : `Tick all ${cases.length}`}
          </button>
          <ul className="max-h-[320px] space-y-1 overflow-y-auto">
            {cases.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[12.5px] hover:bg-brand-wash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-brand-800"
                    checked={picked.includes(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold text-parch-800">{c.name}</span>
                  <span className="shrink-0 text-[11px] text-parch-500">
                    {c.className} · {c.resolved}
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
              onClick={remove}
            >
              {pending
                ? 'Clearing…'
                : `Clear ${picked.length} selected case${picked.length === 1 ? '' : 's'}`}
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
