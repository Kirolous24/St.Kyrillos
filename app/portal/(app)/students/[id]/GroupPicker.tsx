'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moveKidToGroup } from '@/lib/portal/actions/groups'
import { selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/** Move this child to another servant's group (group.manage only). */
export function GroupPicker({
  studentId,
  current,
  servants,
}: {
  studentId: string
  current: string | null
  servants: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="mt-2">
      <select
        aria-label="Move to another servant's group"
        value={current ?? ''}
        disabled={pending}
        className={cn(selectClass, 'h-[34px] py-0 text-[12px]')}
        onChange={(e) => {
          const to = e.target.value
          if (!to) return
          setError('')
          startTransition(async () => {
            const r = await moveKidToGroup(studentId, to)
            if (!r.ok) setError(r.error)
            else router.refresh()
          })
        }}
      >
        {current === null && <option value="">Choose a servant…</option>}
        {servants.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-[11.5px] text-[#B91C1C]">
          {error}
        </p>
      )}
    </div>
  )
}
