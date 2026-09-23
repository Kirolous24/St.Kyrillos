'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Check } from 'lucide-react'
import { saveServantActivity } from '@/lib/portal/actions/admin'
import { DAY_NAMES } from '@/lib/portal/dates'
import { Card, Callout, buttonClass, inputClass, selectClass, checkboxClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface ServantActivityRow {
  key: string
  label: string
  dayOfWeek: number
  isActive: boolean
}

/**
 * Editing the weekly servant activities — the prototype's "Edit Activity Days".
 *
 * `dayOfWeek` has been in the schema and read by the reports since the port,
 * but nothing could change it: if the servants' meeting moved from Friday to
 * Saturday there was no screen for it anywhere.
 */
export function ServantActivityEditor({ activities }: { activities: ServantActivityRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState(activities)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')

  function set(key: string, patch: Partial<ServantActivityRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function save(row: ServantActivityRow) {
    setError('')
    setSaved(null)
    startTransition(async () => {
      const r = await saveServantActivity(row)
      if (!r.ok) return setError(r.error)
      setSaved(row.key)
      router.refresh()
    })
  }

  return (
    <Card
      title="Weekly servant activities"
      icon={<CalendarClock className="h-4 w-4" aria-hidden />}
      className="mt-4"
    >
      <p className="mb-3.5 text-[12.5px] text-parch-600">
        The activities servants are marked against each week, and the day each one falls on. Turning
        one off leaves past records alone; it just stops appearing in new weeks.
      </p>

      {error && <div className="mb-3" role="alert"><Callout tone="bad">{error}</Callout></div>}

      {rows.length === 0 ? (
        <p className="text-[12.5px] text-parch-500">No servant activities are set up.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-end gap-2.5 rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2.5">
              <label className="min-w-[10rem] flex-1">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Name</span>
                <input
                  value={r.label}
                  onChange={(e) => set(r.key, { label: e.target.value })}
                  className={inputClass}
                  maxLength={40}
                  aria-label={`Name of ${r.label}`}
                />
              </label>
              <label className="min-w-[8rem]">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Day</span>
                <select
                  value={r.dayOfWeek}
                  onChange={(e) => set(r.key, { dayOfWeek: Number(e.target.value) })}
                  className={selectClass}
                  aria-label={`Day of ${r.label}`}
                >
                  {DAY_NAMES.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-[40px] items-center gap-2 text-[12px] font-semibold text-parch-700">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={r.isActive}
                  onChange={(e) => set(r.key, { isActive: e.target.checked })}
                  aria-label={`${r.label} still runs`}
                />
                Still runs
              </label>
              <button
                type="button"
                disabled={pending || !r.label.trim()}
                onClick={() => save(r)}
                className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
              >
                {saved === r.key ? <><Check className="h-3.5 w-3.5" aria-hidden /> Saved</> : 'Save'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
