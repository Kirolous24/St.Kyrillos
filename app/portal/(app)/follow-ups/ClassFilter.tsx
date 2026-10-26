'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { followUpsHref } from '@/lib/portal/followups'
import { selectClass } from '@/components/portal/ui'

/**
 * Follow-ups narrowed to one class (2026-10-26), for anyone who sees more than
 * one. Narrowing only; the page ignores a class the viewer cannot see.
 */
export function ClassFilter({ value, classes }: { value: string; classes: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const params = useSearchParams()
  return (
    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 print:hidden">
      Class
      <select
        aria-label="Class"
        value={value}
        className={`${selectClass} max-w-[240px] normal-case tracking-normal`}
        onChange={(e) => router.push(followUpsHref(params.toString(), { class: e.target.value }))}
      >
        <option value="">All classes</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}
