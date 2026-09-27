'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, RotateCcw, Trash2 } from 'lucide-react'
import { deleteUnassigned, moveUnassigned, putBackUnassigned } from '@/lib/portal/actions/unassigned'
import type { ActionResult } from '@/lib/portal/action-result'
import { Callout, buttonClass, selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/** Put back, move or delete one child on the UNASSIGNED list. */
export function UnassignedActions({
  studentId,
  name,
  putBackTo,
  classes,
}: {
  studentId: string
  name: string
  /** The class they came from, when it still exists and is active. */
  putBackTo: string | null
  classes: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<ActionResult>) {
    setError(null)
    startTransition(async () => {
      const r = await action()
      if (!r.ok) return setError(r.error)
      router.refresh()
    })
  }

  return (
    <div className="mt-3.5 border-t border-[#F0EEE8] pt-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {putBackTo && (
          <button
            type="button"
            disabled={pending}
            className={cn(buttonClass('primary', 'sm'), 'min-h-[40px]')}
            onClick={() => run(() => putBackUnassigned(studentId))}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Put back in {putBackTo}
          </button>
        )}
        <span className="flex items-center gap-2">
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={cn(selectClass, 'min-h-[40px] w-auto max-w-[200px]')}
            aria-label={`Move ${name} to`}
          >
            <option value="">Move to…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !to}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
            onClick={() => run(() => moveUnassigned(studentId, to))}
          >
            <ArrowRight className="h-4 w-4" aria-hidden /> Move
          </button>
        </span>
        <button
          type="button"
          disabled={pending}
          className={cn(buttonClass('danger', 'sm'), 'min-h-[40px] sm:ml-auto')}
          onClick={() => {
            if (!window.confirm(`Delete ${name} for good? Their attendance, points and quizzes are deleted too. This cannot be undone.`)) return
            run(() => deleteUnassigned(studentId))
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Delete for good
        </button>
      </div>
      {error && (
        <div className="mt-2.5" role="alert">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
    </div>
  )
}
