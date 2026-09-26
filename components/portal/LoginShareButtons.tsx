'use client'

import { useState } from 'react'
import { Copy, Mail, MessageCircle, MessageSquare } from 'lucide-react'
import { buttonClass } from './ui'
import { cn } from '@/lib/utils'
import { loginMessage, mailtoHref, smsHref, whatsappHref } from '@/lib/portal/login-share'

/**
 * Hand one person their login. Copy it, or open Messages, WhatsApp or the
 * admin's own mail app with it already written. The portal sends nothing from
 * here: the admin presses Send in their own app, from a number or address the
 * person already knows, which is also why it never reads as a scam.
 */
export function LoginShareButtons({
  name,
  loginId,
  pin,
  email,
  phone,
}: {
  name: string
  loginId: string
  pin: string
  email?: string | null
  phone?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const text = loginMessage({ name, loginId, pin })
  const sms = smsHref(phone, text)
  const wa = whatsappHref(phone, text)
  const mail = mailtoHref(email, text)
  const cls = cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')

  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
      <button
        type="button"
        className={cls}
        onClick={() => {
          if (!navigator.clipboard) return setError('This browser will not copy. Write it down instead.')
          navigator.clipboard
            .writeText(text)
            .then(() => {
              setError('')
              setCopied(true)
            })
            .catch(() => setError('This browser will not copy. Write it down instead.'))
        }}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? 'Copied' : 'Copy'}
      </button>
      {sms && (
        <a href={sms} className={cls}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Text
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cls}>
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
        </a>
      )}
      {mail && (
        <a href={mail} className={cls}>
          <Mail className="h-3.5 w-3.5" aria-hidden /> Email
        </a>
      )}
      {error && (
        <span role="alert" className="text-[11.5px] text-[#B91C1C]">
          {error}
        </span>
      )}
    </div>
  )
}
