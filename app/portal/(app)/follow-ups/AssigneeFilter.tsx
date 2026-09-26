'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { selectClass } from '@/components/portal/ui'

/**
 * Follow-up groups: narrow a coordinator's list to one servant's group, their
 * own, or the children nobody has yet. Narrowing only; the page ignores a value
 * that is not in the viewer's scope.
 */
export function AssigneeFilter({
  value,
  hasOwnGroup,
  classes,
}: {
  value: string
  hasOwnGroup: boolean
  classes: Array<{ name: string; servants: Array<{ id: string; name: string }> }>
}) {
  const router = useRouter()
  const params = useSearchParams()
  return (
    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 print:hidden">
      Assigned to
      <select
        aria-label="Assigned to"
        value={value}
        className={`${selectClass} max-w-[240px] normal-case tracking-normal`}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString())
          if (e.target.value) next.set('servant', e.target.value)
          else next.delete('servant')
          router.push(`/portal/follow-ups${next.toString() ? `?${next.toString()}` : ''}`)
        }}
      >
        <option value="">Everyone</option>
        {hasOwnGroup && <option value="mine">My group</option>}
        <option value="unassigned">No servant yet</option>
        {classes.map((c) => (
          <optgroup key={c.name} label={c.name}>
            {c.servants.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
