'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { resetStudentPin, clearImportNotes, deleteStudentAndRedirect } from '@/lib/portal/actions/students'
import { Card, buttonClass, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export function StudentProfileActions({ studentId, hasImportNotes, isAdmin }: { studentId: string; hasImportNotes: boolean; isAdmin: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pin, setPin] = useState<{ loginId: string; pin: string } | null>(null)
  const [error, setError] = useState('')

  return (
    <Card title="Actions" icon={<Settings className="h-[15px] w-[15px]" />}>
      <div className="space-y-2.5">
        {pin ? (
          <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">New PIN for ID {pin.loginId}</p>
            <p className="font-serif text-[26px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{pin.pin}</p>
            <p className="mt-1 text-[11px] text-parch-500">Shown once. Give it to the family.</p>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px] w-full')}
            onClick={() => {
              if (!confirm('Reset this student\'s PIN? The old PIN will stop working.')) return
              startTransition(async () => {
                const r = await resetStudentPin(studentId)
                if (r.ok) setPin(r.data!)
                else setError(r.error)
              })
            }}
          >
            Reset PIN
          </button>
        )}
        {hasImportNotes && (
          <button
            type="button"
            disabled={pending}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px] w-full')}
            onClick={() => startTransition(async () => { const r = await clearImportNotes(studentId); if (!r.ok) setError(r.error); router.refresh() })}
          >
            Mark as reviewed
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            disabled={pending}
            className={cn(buttonClass('danger', 'sm'), 'min-h-[40px] w-full')}
            onClick={() => {
              if (!confirm('Delete this student and all their attendance and points? This cannot be undone.')) return
              startTransition(async () => {
                const r = await deleteStudentAndRedirect(studentId)
                if (r && !r.ok) setError(r.error)
              })
            }}
          >
            Delete student
          </button>
        )}
        {error && <div role="alert"><Callout tone="bad">{error}</Callout></div>}
      </div>
    </Card>
  )
}
