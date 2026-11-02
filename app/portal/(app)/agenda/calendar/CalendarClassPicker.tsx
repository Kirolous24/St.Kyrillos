'use client'

import { useRouter } from 'next/navigation'
import { selectClass } from '@/components/portal/ui'

/** The Calendar tab's class picker; the month or semester on screen stays. */
export function CalendarClassPicker({
  classId,
  classes,
  query,
}: {
  classId: string
  classes: Array<{ id: string; name: string }>
  /** The span's part of the address, kept across classes. */
  query: string
}) {
  const router = useRouter()
  if (classes.length < 2) return null
  return (
    <label className="mb-4 block max-w-xs print:hidden">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Class</span>
      <select
        value={classId}
        onChange={(e) => router.push(`/portal/agenda/calendar?class=${encodeURIComponent(e.target.value)}&${query}`)}
        className={selectClass}
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}
