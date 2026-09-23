'use client'

import { useRouter } from 'next/navigation'
import { inputClass } from '@/components/portal/ui'

/**
 * Class and week choosers for the printed week sheet (F0225 / F0595).
 *
 * The sheet was reachable only by arriving from the schedule with both
 * parameters already set, so a servant who wanted last week's sheet, or
 * another class's, had to go back and come in again.
 *
 * It builds the whole query itself rather than reusing `ClassPicker`, which
 * writes `?class=` alone — that would silently drop `week` and quietly send
 * every choice to the current week.
 */
export function WeekSheetPicker({
  classId,
  classes,
  week,
  weeks,
}: {
  classId: string
  classes: Array<{ id: string; name: string }>
  week: string
  weeks: Array<{ key: string; label: string }>
}) {
  const router = useRouter()
  const go = (next: { classId?: string; week?: string }) => {
    const params = new URLSearchParams({
      class: next.classId ?? classId,
      week: next.week ?? week,
    })
    router.push(`/portal/agenda/week?${params.toString()}`)
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
      {classes.length > 1 && (
        <label className="block max-w-xs">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Class</span>
          <select
            value={classId}
            onChange={(e) => go({ classId: e.target.value })}
            className={inputClass}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block max-w-xs">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Week</span>
        <select value={week} onChange={(e) => go({ week: e.target.value })} className={inputClass}>
          {/* A week already being viewed that falls outside this school year
              stays selectable, so arriving by link never blanks the control. */}
          {!weeks.some((w) => w.key === week) && <option value={week}>This week</option>}
          {weeks.map((w) => (
            <option key={w.key} value={w.key}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
