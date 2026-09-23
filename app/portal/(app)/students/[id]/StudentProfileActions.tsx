'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import {
  resetStudentPin,
  clearImportNotes,
  deleteStudentAndRedirect,
  convertStudentToServantAndRedirect,
  setStudentLoginEnabled,
} from '@/lib/portal/actions/students'
import { Card, buttonClass, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export function StudentProfileActions({
  studentId,
  hasImportNotes,
  isAdmin,
  loginEnabled,
}: {
  studentId: string
  hasImportNotes: boolean
  isAdmin: boolean
  loginEnabled: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pin, setPin] = useState<{ loginId: string; pin: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  return (
    <Card title="Actions" icon={<Settings className="h-[15px] w-[15px]" />}>
      <div className="space-y-2.5">
        {pin ? (
          <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">New PIN for ID {pin.loginId}</p>
            <p className="font-serif text-[26px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{pin.pin}</p>
            <p className="mt-1 text-[11px] text-parch-500">Shown once. Give it to the family.</p>
            {/* F0012 — the PIN is shown once and then gone forever, so an admin
                was reading eight digits off a screen and retyping them into a
                message. One wrong digit and the family cannot sign in, and the
                only fix is another reset. */}
            <button
              type="button"
              className={cn(buttonClass('secondary', 'sm'), 'mt-2.5 min-h-[40px] w-full')}
              onClick={() => {
                const text = `St. Kyrillos Sunday School portal\n${window.location.origin}/portal/login\nStudent ID: ${pin.loginId}\nPIN: ${pin.pin}`
                void navigator.clipboard
                  ?.writeText(text)
                  .then(() => {
                    setError('')
                    setCopied(true)
                  })
                  .catch(() => setError('This browser would not let the portal copy. Write the PIN down instead.'))
              }}
            >
              {copied ? 'Copied — paste it to the family' : 'Copy ID and PIN'}
            </button>
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
        {/* F0052 — the mild problem (a PIN passed round the class, a family who
            has moved) now has a mild answer. Before this, the only lever was
            Delete Student, which takes the child's whole history with it. */}
        {isAdmin && (
          <button
            type="button"
            disabled={pending}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px] w-full')}
            onClick={() => {
              if (
                loginEnabled &&
                !confirm(
                  'Switch off this student\u2019s login? They will not be able to sign in. Their attendance, points and quizzes are kept, and you can switch it back on at any time.',
                )
              ) {
                return
              }
              startTransition(async () => {
                const r = await setStudentLoginEnabled(studentId, !loginEnabled)
                if (!r.ok) setError(r.error)
                else router.refresh()
              })
            }}
          >
            {loginEnabled ? 'Switch off login' : 'Switch login back on'}
          </button>
        )}
        {/* F0850 — the senior who grew up here and is now serving. Converting
            keeps every register mark, point, quiz and badge; the old way round
            was to delete the child and start again, which destroyed all of it.
            It also has a deadline: left as a student, she is deleted by the
            end-of-year reset. */}
        {isAdmin && (
          <button
            type="button"
            disabled={pending}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px] w-full')}
            onClick={() => {
              if (
                !confirm(
                  'Make this student a servant?\n\nTheir Sunday School history \u2014 attendance, points, quizzes and badges \u2014 is kept and stays on this profile. They come off the class roster and sign in with the same ID and PIN.',
                )
              ) {
                return
              }
              startTransition(async () => {
                const r = await convertStudentToServantAndRedirect(studentId)
                if (r && !r.ok) setError(r.error)
              })
            }}
          >
            Make a servant
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
        {/* F0069 — a servant used to find a red "Remove student" card here and
            now finds nothing, so they hunt for a control that is not there and
            conclude the portal has lost it. Removing a child erases their whole
            history, which stays with the office — but the absence should be
            answered rather than silent. */}
        {!isAdmin && (
          <p className="pt-1 text-[11.5px] text-parch-500">
            Taking a child off the roll is done by the office, so their attendance, points and
            quizzes are never lost by accident. Ask an admin if a child has left the church.
          </p>
        )}
        {error && <div role="alert"><Callout tone="bad">{error}</Callout></div>}
      </div>
    </Card>
  )
}
