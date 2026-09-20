'use client'

import { useState, useTransition } from 'react'
import { KeyRound } from 'lucide-react'
import { changeOwnPin } from '@/lib/portal/actions/account'
import { Card, Callout, Field, inputClass, buttonClass } from '@/components/portal/ui'

/** The prototype's PIN field: monospace, centred, widely tracked. */
const pinInputClass = `${inputClass} text-center font-mono text-[18px] font-bold tracking-[4px]`

export function ChangePinForm() {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ currentPin: '', newPin: '', confirmPin: '' })
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  return (
    <Card title="Change PIN" icon={<KeyRound className="h-4 w-4" />}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setMessage(null)
          startTransition(async () => {
            const r = await changeOwnPin(form)
            if (!r.ok) return setMessage({ kind: 'err', text: r.error })
            setForm({ currentPin: '', newPin: '', confirmPin: '' })
            setMessage({ kind: 'ok', text: 'Your PIN was changed.' })
          })
        }}
      >
        <Field label="Current PIN" htmlFor="currentPin">
          <input
            id="currentPin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={form.currentPin}
            onChange={(e) => setForm({ ...form, currentPin: digits(e.target.value) })}
            className={pinInputClass}
            placeholder="••••"
            required
          />
        </Field>
        <Field label="New PIN" htmlFor="newPin" hint="4 to 8 digits.">
          <input
            id="newPin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={form.newPin}
            onChange={(e) => setForm({ ...form, newPin: digits(e.target.value) })}
            className={pinInputClass}
            placeholder="••••"
            required
          />
        </Field>
        <Field label="Confirm new PIN" htmlFor="confirmPin">
          <input
            id="confirmPin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={form.confirmPin}
            onChange={(e) => setForm({ ...form, confirmPin: digits(e.target.value) })}
            className={pinInputClass}
            placeholder="••••"
            required
          />
        </Field>
        {message && (
          <div role="status" className="mb-3.5">
            <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>{message.text}</Callout>
          </div>
        )}
        <button type="submit" disabled={pending} className={`${buttonClass('primary')} w-full`}>
          {pending ? 'Saving…' : 'Change PIN'}
        </button>
      </form>
    </Card>
  )
}
