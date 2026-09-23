'use client'

import { useState, useTransition } from 'react'
import { UserCog } from 'lucide-react'
import { updateOwnProfile } from '@/lib/portal/actions/account'
import { Card, Callout, Field, inputClass, buttonClass } from '@/components/portal/ui'

/**
 * The prototype's My Profile editor. `showServantFields` is false for a pure
 * ADMIN account, which has no Servant row and therefore no address/birthday.
 */
export function ProfileForm({
  initial, showServantFields,
}: {
  initial: { email: string; phone: string; address: string; birthday: string }
  showServantFields: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(initial)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  return (
    <Card title="Edit my details" icon={<UserCog className="h-4 w-4" />}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setMessage(null)
          startTransition(async () => {
            const r = await updateOwnProfile(form)
            setMessage(r.ok ? { kind: 'ok', text: 'Your details were saved.' } : { kind: 'err', text: r.error })
          })
        }}
      >
        <Field label="Email" htmlFor="pf-email" hint="Used for follow-up messages you send.">
          <input
            id="pf-email" type="email" autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass} placeholder="you@example.com"
          />
        </Field>
        <Field label="Phone" htmlFor="pf-phone">
          <input
            id="pf-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={inputClass} placeholder="(615) 555-0123"
          />
        </Field>
        {showServantFields && (
          <>
            <Field label="Birthday" htmlFor="pf-bday" hint="Shows on the birthdays board.">
              <input
                id="pf-bday" type="date" value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Address" htmlFor="pf-addr">
              <input
                id="pf-addr" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass} placeholder="Street, city, state"
              />
            </Field>
          </>
        )}
        {message && (
          <div role="status" className="mb-3.5">
            <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>{message.text}</Callout>
          </div>
        )}
        <button type="submit" disabled={pending} className={`${buttonClass('primary')} w-full`}>
          {pending ? 'Saving…' : 'Save my details'}
        </button>
      </form>
    </Card>
  )
}
