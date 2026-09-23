'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moveStudent } from '@/lib/portal/actions/students'
import { cn } from '@/lib/utils'

/**
 * Quick-action shortcut on the admin roster. It fires on change with no undo,
 * so a misclick silently reassigned a child; the prototype only ever moved a
 * student from inside the Edit Student form, where you review before saving.
 * The confirm is the minimum that makes an instant, irreversible write safe.
 */
export function MoveStudentSelect({
  studentId,
  value,
  options,
}: {
  studentId: string
  value: string
  options: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [shown, setShown] = useState(value)

  const nameOf = (id: string) => options.find((c) => c.id === id)?.name ?? 'no class'

  function change(next: string) {
    if (next === value) return setShown(next)
    if (!confirm(`Move this student from ${nameOf(value)} to ${nameOf(next)}?`)) {
      // Put the select back — nothing was written.
      return setShown(value)
    }
    setShown(next)
    startTransition(async () => {
      const r = await moveStudent(studentId, next || null)
      if (!r.ok) {
        alert(r.error)
        setShown(value)
      }
      router.refresh()
    })
  }

  return (
    <select
      value={shown}
      disabled={pending}
      aria-label="Class"
      onChange={(e) => change(e.target.value)}
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
