'use client'

import { useState, useTransition } from 'react'
import { Eye, KeyRound } from 'lucide-react'
import { revealLogins } from '@/lib/portal/actions/logins'
import { revealStudentLogins } from '@/lib/portal/actions/student-logins'
import { resetServantPin } from '@/lib/portal/actions/admin'
import { resetStudentPin } from '@/lib/portal/actions/students'
import { Callout, Card, buttonClass } from './ui'
import { LoginShareButtons } from './LoginShareButtons'
import { cn } from '@/lib/utils'

/**
 * A person's ID and PIN (option B). The PIN stays hidden until asked for, and
 * every Show is written to the activity log. Reissue works whether or not a PIN
 * is on file.
 *
 * With `studentId` it is a child's, for whoever can reset that PIN — their
 * class's servants, the stage overseer and the admin (2026-10-04) — through
 * the student logins actions and resetStudentPin. Without it, it is a
 * servant's, for the admin alone, through the admin logins and resetServantPin.
 */
export function LoginCard({
  accountId,
  studentId,
  loginId,
  name,
  email,
  phone,
  onFile,
  vaultEnabled,
}: {
  accountId: string
  studentId?: string
  loginId: string
  name: string
  email?: string | null
  phone?: string | null
  onFile: boolean
  vaultEnabled: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [pin, setPin] = useState<string | null>(null)
  const [stored, setStored] = useState(onFile)
  const [error, setError] = useState('')

  function show() {
    setError('')
    startTransition(async () => {
      const r = studentId ? await revealStudentLogins([studentId]) : await revealLogins([accountId])
      if (!r.ok) return setError(r.error)
      const row = r.data!.rows[0]
      if (row?.pin) setPin(row.pin)
      else {
        setStored(false)
        setError('That PIN is not on file any more. Reissue to give them one you can see.')
      }
    })
  }

  function reissue() {
    if (!confirm(`Give ${name} a new PIN? The one they use now stops working.`)) return
    setError('')
    startTransition(async () => {
      const r = studentId ? await resetStudentPin(studentId) : await resetServantPin(accountId)
      if (!r.ok) return setError(r.error)
      setPin(r.data!.pin)
      setStored(vaultEnabled)
    })
  }

  return (
    <Card title="Sign-in" icon={<KeyRound className="h-[15px] w-[15px]" />}>
      <dl className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3">
          <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">ID</dt>
          <dd className="font-serif text-[24px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{loginId}</dd>
        </div>
        <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3">
          <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">PIN</dt>
          <dd className="font-serif text-[24px] font-bold tracking-[0.2em] text-brand-800 tabular-nums" data-testid="login-pin">
            {pin ?? '••••'}
          </dd>
        </div>
      </dl>
      {!vaultEnabled ? (
        <p className="mt-2.5 text-[11.5px] text-parch-500">
          PIN viewing is switched off on this site (PORTAL_PIN_KEY is not set). Reissuing still works.
        </p>
      ) : !stored && !pin ? (
        <p className="mt-2.5 text-[11.5px] text-parch-500" data-testid="login-not-on-file">
          Not on file. They may have chosen their own; reissue to give them one you can see.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        {!pin && vaultEnabled && stored && (
          <button type="button" disabled={pending} onClick={show} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>
            <Eye className="h-3.5 w-3.5" aria-hidden /> {pending ? 'Opening…' : 'Show PIN'}
          </button>
        )}
        <button type="button" disabled={pending} onClick={reissue} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
          Reissue PIN
        </button>
      </div>
      {pin && (
        <div className="mt-3">
          <LoginShareButtons name={name} loginId={loginId} pin={pin} email={email} phone={phone} />
        </div>
      )}
      {error && (
        <div className="mt-3" role="alert">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
    </Card>
  )
}
