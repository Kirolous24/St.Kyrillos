'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Phone, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { deleteCase } from '@/lib/portal/actions/followups'
import { buttonClass, inputClass, Callout } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface Contact { label: string; value: string }

/**
 * The prototype's follow-up row actions: a one-tap call, a one-tap WhatsApp, a
 * "Send" composer and a delete. The port shipped only a link to the case page,
 * so a servant chasing an absent child had to find the number themselves and
 * could never remove a case opened by mistake.
 *
 * The composer mirrors `openSendMessageModal` (OG L17340): pick a channel, pick
 * which of the family's contacts to use, edit the pastoral template, send. It
 * opens the user's own mail client or WhatsApp — the portal never sends anything
 * itself, exactly as before.
 */
export function CaseQuickActions({
  caseId, studentName, emails, phones, primaryPhone, primaryWa,
}: {
  caseId: string
  studentName: string
  emails: Contact[]
  phones: Contact[]
  /** tel: href for the first number on file, if any. */
  primaryPhone: string | null
  /** wa.me href for the first number on file, if any. */
  primaryWa: string | null
}) {
  const router = useRouter()
  // createPortal needs document, which does not exist during the server render.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<'email' | 'msg' | null>(null)
  const [contact, setContact] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [text, setText] = useState(
    `Hi ${studentName},\nI just wanted to check on you and say we really missed seeing you at church and in class! I hope you're doing well.\nYou are always in our prayers, and it would be so nice to see you again soon. Your presence means a lot to us.\nGod bless you always!`,
  )

  const list = channel === 'email' ? emails : channel === 'msg' ? phones : []

  function send() {
    if (!channel) return setErr('Choose a channel first.')
    if (!contact) return setErr('Choose who to send it to.')
    const href =
      channel === 'email'
        ? `mailto:${contact}?subject=${encodeURIComponent(`Checking in on ${studentName}`)}&body=${encodeURIComponent(text)}`
        : `https://wa.me/${contact.replace(/\D+/g, '')}?text=${encodeURIComponent(text)}`
    window.open(href, '_blank', 'noopener')
    setOpen(false)
  }

  function remove() {
    if (!window.confirm(`Delete the follow-up case for ${studentName}? Its contact log goes with it. To record an outcome instead, resolve the case.`)) return
    startTransition(async () => {
      const r = await deleteCase(caseId)
      if (!r.ok) setErr(r.error)
      else router.refresh()
    })
  }

  return (
    <>
      {primaryPhone && (
        <a href={primaryPhone} className={cn(buttonClass('secondary', 'sm'), 'px-2.5')} aria-label={`Call ${studentName}`} title="Call">
          <Phone className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden />
        </a>
      )}
      {primaryWa && (
        <a href={primaryWa} target="_blank" rel="noopener noreferrer" className={cn(buttonClass('secondary', 'sm'), 'px-2.5')} aria-label={`WhatsApp ${studentName}`} title="WhatsApp">
          <MessageCircle className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden />
        </a>
      )}
      <button type="button" onClick={() => { setErr(null); setOpen(true) }} className={buttonClass('secondary', 'sm')}>
        <Send className="h-3.5 w-3.5" aria-hidden /> Send
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={`Delete the case for ${studentName}`}
        title="Delete case"
        className={cn(buttonClass('secondary', 'sm'), 'px-2.5 text-[#DC2626]')}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/* Rendered into <body>, not here. A `position: fixed` overlay is
          positioned against its nearest transformed ancestor, and the page
          content wrapper carries an entrance animation — so this dialog used to
          be laid out inside that wrapper rather than the viewport, and the
          wrapper sat over its own controls: the contact radios and Cancel could
          not be clicked at all. */}
      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Send a message to ${studentName}`}
          className="fixed inset-0 z-[500] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[18px] border-[1.5px] border-brand-gold bg-parch-50 p-4 shadow-panel sm:rounded-[18px]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="font-serif text-[16px] font-bold text-parch-900">Send a message to {studentName}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-parch-500 hover:bg-brand-wash" aria-label="Close">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">How</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {([['email', 'Email'], ['msg', 'WhatsApp']] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setChannel(k); setContact(null); setErr(null) }}
                  aria-pressed={channel === k}
                  className={cn(
                    'rounded-[9px] border-[1.5px] px-3 py-2 text-[12.5px] font-bold transition-colors',
                    channel === k ? 'border-brand-gold bg-[#FDF5E4] text-parch-900' : 'border-[#E7E2DA] bg-parch-50 text-parch-500',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {channel && (
              <>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Who</p>
                {list.length === 0 ? (
                  <p className="mb-3 rounded-[9px] border border-[#E7E2DA] px-3 py-2.5 text-center text-[12px] text-parch-500">
                    No {channel === 'email' ? 'email addresses' : 'phone numbers'} on file for this student.
                  </p>
                ) : (
                  <div className="mb-3 space-y-1.5">
                    {list.map((c) => (
                      <label
                        key={`${c.label}-${c.value}`}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-[9px] border-[1.5px] px-2.5 py-2 transition-colors',
                          contact === c.value ? 'border-brand-800' : 'border-[#E7E2DA]',
                        )}
                      >
                        <input
                          type="radio"
                          name={`contact-${caseId}`}
                          checked={contact === c.value}
                          onChange={() => { setContact(c.value); setErr(null) }}
                          className="shrink-0 accent-[#6F1D1B]"
                        />
                        <span className="min-w-0">
                          <span className="block text-[12px] font-bold text-parch-900">{c.label}</span>
                          <span className="block truncate text-[11px] text-parch-500">{c.value}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            {channel && list.length > 0 && (
              <>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Message</p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={7}
                  className={cn(inputClass, 'mb-3 resize-y leading-relaxed')}
                />
              </>
            )}

            {err && <div className="mb-3"><Callout tone="bad">{err}</Callout></div>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass('secondary')}>Cancel</button>
              <button type="button" onClick={send} disabled={!channel || !contact} className={buttonClass('primary')}>
                <Send className="h-3.5 w-3.5" aria-hidden />{' '}
                {channel === 'email' ? 'Open in email' : channel === 'msg' ? 'Open in WhatsApp' : 'Send'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
