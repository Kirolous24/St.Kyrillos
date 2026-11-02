'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { resetClassPoints, resetStudentPoints } from '@/lib/portal/actions/points'
import { buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export type ResetPointsTarget =
  | { kind: 'student'; id: string; name: string; points: number }
  | {
      kind: 'class'
      id: string
      name: string
      points: number
      children: number
      /** Children on the list who belong to another class. */
      members: number
    }

const n = (x: number) => x.toLocaleString('en-US')

/**
 * The admin's "Reset points" (2026-11-02), on a class page and on a child's
 * profile: one tap, then a confirm that says exactly what goes. No typed
 * phrase: it was asked for to be easy, and the confirm names the class or
 * child and the points.
 */
export function ResetPointsButton({ target, className }: { target: ResetPointsTarget; className?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  if (target.points === 0 && !message) {
    return (
      <p className={cn('text-[11.5px] text-parch-500', className)} data-testid="reset-points-none">
        {target.kind === 'class' ? 'Everyone is at 0 points.' : 'At 0 points.'}
      </p>
    )
  }

  function reset() {
    setMessage(null)
    startTransition(async () => {
      const r = target.kind === 'class' ? await resetClassPoints(target.id) : await resetStudentPoints(target.id)
      setAsking(false)
      if (!r.ok) return setMessage({ kind: 'err', text: r.error })
      setMessage({
        kind: 'ok',
        text: target.kind === 'class' ? `Done: everyone in ${target.name} is back to 0 points.` : `Done: ${target.name} is back to 0 points.`,
      })
      router.refresh()
    })
  }

  return (
    <div className={cn('space-y-2', className)} data-testid="reset-points">
      {!asking && target.points !== 0 && (
        <button type="button" onClick={() => setAsking(true)} disabled={pending} className={buttonClass('danger', 'sm')}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset points
        </button>
      )}
      {asking && (
        <div className="rounded-[12px] border-[1.5px] border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[12.5px] text-[#7F1D1D]" role="alertdialog" aria-label="Reset points">
          <p className="font-bold">Reset {target.name}&rsquo;s points to 0?</p>
          <p className="mt-1">
            {target.kind === 'class'
              ? `All ${n(target.children)} child${target.children === 1 ? '' : 'ren'} on the list go back to 0 (${n(target.points)} points between them)${
                  target.members > 0
                    ? `, including ${n(target.members)} from other classes, whose points there go too: each child has one total`
                    : ''
                }.`
              : `${n(target.points)} point${target.points === 1 ? ' is' : 's are'} taken away.`}{' '}
            Attendance and quiz results stay. This can&rsquo;t be undone.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={reset} disabled={pending} className={buttonClass('danger', 'sm')}>
              {pending ? 'Resetting…' : 'Yes, reset to 0'}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={pending} className={buttonClass('ghost', 'sm')}>
              Keep the points
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className={message.kind === 'ok' ? 'text-[12px] font-semibold text-[#15803D]' : 'text-[12px] font-semibold text-[#B91C1C]'}>
          {message.text}
        </p>
      )}
    </div>
  )
}
