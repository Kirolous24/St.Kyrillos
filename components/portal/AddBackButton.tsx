'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { addPersonToMeeting } from '@/lib/portal/actions/fellowship'
import { buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/** Bring someone who left back into a meeting, with their history (2026-10-24). */
export function AddBackButton({ classId, studentId, name, label }: { classId: string; studentId: string; name: string; label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-label={`Add ${name} back`}
        onClick={() =>
          startTransition(async () => {
            setError('')
            const r = await addPersonToMeeting(classId, { kind: 'member', id: studentId })
            if (!r.ok) return setError(r.error)
            router.refresh()
          })
        }
        className={cn(buttonClass('secondary', 'sm'), 'min-h-[34px]')}
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden /> {pending ? 'Adding…' : label ?? 'Add back'}
      </button>
      {error && (
        <span role="alert" className="text-[11.5px] font-semibold text-[#B91C1C]">
          {error}
        </span>
      )}
    </span>
  )
}
