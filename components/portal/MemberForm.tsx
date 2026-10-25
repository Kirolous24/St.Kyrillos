'use client'

import { useState } from 'react'
import { Field, inputClass, textareaClass, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface MemberFields {
  firstName: string
  lastName: string
  phone: string
  email: string
  birthday: string
  note: string
}

export const EMPTY_MEMBER: MemberFields = { firstName: '', lastName: '', phone: '', email: '', birthday: '', note: '' }

/**
 * A Fellowship member who does not serve (2026-10-24): a name, and whatever
 * else is known. Only the first name is needed; the server checks the rest.
 */
export function MemberForm({
  initial = EMPTY_MEMBER,
  submitLabel,
  pending,
  onSubmit,
  idPrefix = 'member',
}: {
  initial?: MemberFields
  submitLabel: string
  pending: boolean
  onSubmit: (fields: MemberFields) => void
  idPrefix?: string
}) {
  // Seeded once; a caller empties it for the next person by remounting it (key).
  const [fields, setFields] = useState<MemberFields>(initial)
  const set = (key: keyof MemberFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))
  const id = (k: string) => `${idPrefix}-${k}`

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(fields)
      }}
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="First name" htmlFor={id('first')}>
          <input id={id('first')} value={fields.firstName} onChange={set('firstName')} className={inputClass} required maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Last name" htmlFor={id('last')}>
          <input id={id('last')} value={fields.lastName} onChange={set('lastName')} className={inputClass} maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Phone" htmlFor={id('phone')} hint="Optional — for calls and texts when they miss">
          <input id={id('phone')} value={fields.phone} onChange={set('phone')} className={inputClass} inputMode="tel" maxLength={30} placeholder="(615) 555-0147" autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor={id('email')} hint="Optional">
          <input id={id('email')} type="email" value={fields.email} onChange={set('email')} className={inputClass} maxLength={120} autoComplete="off" />
        </Field>
        <Field label="Birthday" htmlFor={id('birthday')} hint="Optional — month/day/year">
          <input id={id('birthday')} value={fields.birthday} onChange={set('birthday')} className={inputClass} inputMode="numeric" maxLength={10} placeholder="3/14/1985" autoComplete="off" />
        </Field>
        <Field label="Note" htmlFor={id('note')} hint="Optional">
          <textarea id={id('note')} value={fields.note} onChange={set('note')} className={cn(textareaClass, 'min-h-[2.75rem]')} maxLength={500} rows={1} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={cn(buttonClass('primary'), 'min-h-[40px]')}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
