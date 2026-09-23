'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { removeAttendanceSession } from '@/lib/portal/actions/attendance'
import { buttonClass, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * Delete a register saved on the wrong date.
 *
 * Saving only ever upserted, and a session counts as *held* the moment any row
 * exists for it — so one mis-dated save permanently added an occasion every
 * student in the class was measured against, with no way back. Marking everyone
 * absent does not help: those rows are exactly what make the date count.
 */
export function RemoveRegister({
  classId,
  date,
  sessionKey,
  sessionLabel,
  marks,
}: {
  classId: string
  date: string
  sessionKey: string
  sessionLabel: string
  marks: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  if (marks === 0) return null

  return (
    <div className="mt-4 print:hidden">
      <button
        type="button"
        disabled={pending}
        className={cn(buttonClass('secondary', 'sm'), 'text-[#DC2626]')}
        onClick={() => {
          if (
            !window.confirm(
              `Remove the whole ${sessionLabel} register for ${date}? All ${marks} mark${marks === 1 ? '' : 's'} and the points they awarded are deleted, and the day stops counting towards anyone's attendance. This cannot be undone.`,
            )
          ) {
            return
          }
          setError('')
          startTransition(async () => {
            const r = await removeAttendanceSession({ classId, date, sessionKey })
            if (!r.ok) return setError(r.error)
            router.refresh()
          })
        }}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {pending ? 'Removing…' : 'Remove this register'}
      </button>
      <p className="mt-1.5 text-[11px] text-parch-500">
        Use this when a register was saved on the wrong date — not to mark everyone absent.
      </p>
      {error && (
        <div className="mt-2">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
    </div>
  )
}
