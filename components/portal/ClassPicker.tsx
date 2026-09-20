'use client'

import { useRouter, usePathname } from 'next/navigation'
import { inputClass } from './ui'

export function ClassPicker({ value, options, allowAll, param = 'class' }: { value: string; options: Array<{ id: string; name: string }>; allowAll: boolean; param?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <label className="block max-w-xs">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Class</span>
      <select value={value} onChange={(e) => router.push(`${pathname}?${param}=${encodeURIComponent(e.target.value)}`)} className={inputClass}>
        {allowAll && <option value="all">All classes</option>}
        {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  )
}
