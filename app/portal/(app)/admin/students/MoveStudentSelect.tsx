'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moveStudent } from '@/lib/portal/actions/students'
import { cn } from '@/lib/utils'

export function MoveStudentSelect({ studentId, value, options }: { studentId: string; value: string; options: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <select
      value={value}
      disabled={pending}
      aria-label="Class"
      onChange={(e) => startTransition(async () => { const r = await moveStudent(studentId, e.target.value || null); if (!r.ok) alert(r.error); router.refresh() })}
      className={cn(
        'min-h-[28px] min-w-0 flex-1 rounded-[7px] border border-parch-200 bg-parch-50 px-2 py-1 text-[11px] font-semibold text-parch-800 outline-none transition-colors focus:border-brand-gold',
        pending && 'opacity-60',
      )}
    >
      <option value="">No class</option>
      {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}
