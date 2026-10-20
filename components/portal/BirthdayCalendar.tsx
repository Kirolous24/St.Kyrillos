'use client'

import { useState } from 'react'
import { CalendarPlus, Copy, X } from 'lucide-react'
import { buttonClass, InlineNotice } from './ui'
import { cn } from '@/lib/utils'
import { getBirthdayCalendarLink, resetBirthdayCalendarLink } from '@/lib/portal/actions/birthday-calendar'

/**
 * "Add to my calendar" on the Birthdays page (2026-10-19): the children's
 * birthdays as a calendar subscription, with a reminder at 9 AM on the day.
 *
 * Apple removes a subscribed calendar's alerts unless "Remove Alerts" is turned
 * off while adding it, which is the one step a servant has to get right, so
 * the steps sit beside the button rather than on a help page.
 */
export function BirthdayCalendar() {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)

  async function show() {
    setOpen(true)
    if (token || busy) return
    setBusy(true)
    setError('')
    const res = await getBirthdayCalendarLink()
    setBusy(false)
    if (res.ok && res.data) setToken(res.data.token)
    else setError(res.ok ? 'Something went wrong. Please try again.' : res.error)
  }

  async function reset() {
    if (!window.confirm('Make a new link? The old one stops working, so add the calendar again with the new link afterwards.')) return
    setBusy(true)
    setError('')
    setNotice('')
    const res = await resetBirthdayCalendarLink()
    setBusy(false)
    if (res.ok && res.data) {
      setToken(res.data.token)
      setCopied(false)
      setNotice('New link made. Add the calendar again with it. The old link stops working within a day.')
    } else setError(res.ok ? 'Something went wrong. Please try again.' : res.error)
  }

  const path = token ? `/api/portal-calendar/${token}.ics` : ''
  const webcal = token ? `webcal://${window.location.host}${path}` : ''
  const https = token ? `${window.location.origin}${path}` : ''

  function copy() {
    const failed = () => setError('This browser will not copy. Open this page on a computer instead.')
    if (!navigator.clipboard) return failed()
    navigator.clipboard
      .writeText(https)
      .then(() => {
        setError('')
        setCopied(true)
      })
      .catch(failed)
  }

  return (
    <section className="mb-4 rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 px-4 py-3.5 shadow-card print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[12.5px] text-parch-700">
          <CalendarPlus className="h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden />
          Put these birthdays in your phone&rsquo;s calendar, with a reminder on the day.
        </p>
        {open ? (
          <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'sm')} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden /> Close
          </button>
        ) : (
          <button type="button" onClick={show} className={buttonClass('gold', 'sm')}>
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Add to my calendar
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3.5 border-t border-[#F3F0EB] pt-3.5 text-[12.5px] text-parch-700">
          {error && <InlineNotice tone="bad" className="mb-3">{error}</InlineNotice>}
          {notice && <InlineNotice className="mb-3">{notice}</InlineNotice>}
          {!token ? (
            busy && <p className="text-parch-500">Making your link&hellip;</p>
          ) : (
            <>
              <p className="mb-2 font-bold text-parch-900">On your iPhone:</p>
              <ol className="mb-3.5 list-decimal space-y-1 pl-5">
                <li>
                  Tap <strong>Add to Apple Calendar</strong> below, then <strong>Subscribe</strong>.
                </li>
                <li>
                  Turn <strong>off</strong> &ldquo;Remove Alerts&rdquo;. If it stays on, you get no reminders.
                </li>
                <li>
                  Tap <strong>Add</strong> (or <strong>Done</strong>).
                </li>
              </ol>
              <a href={webcal} className={cn(buttonClass('primary', 'md'), 'mb-3.5')}>
                <CalendarPlus className="h-4 w-4" aria-hidden /> Add to Apple Calendar
              </a>
              <p className="mb-1.5 text-[12px] text-parch-500">
                <strong className="text-parch-700">On a Mac:</strong> the same button works. Untick <strong>Alerts</strong> next to
                &ldquo;Remove&rdquo; before you click OK.
              </p>
              <p className="mb-1.5 text-[12px] text-parch-500">
                <strong className="text-parch-700">Added it already, but no reminders?</strong> Delete that calendar and add it again
                with &ldquo;Remove Alerts&rdquo; off.
              </p>
              <div className="mb-3.5 flex flex-wrap items-center gap-2 text-[12px] text-parch-500">
                <span>
                  <strong className="text-parch-700">Google Calendar:</strong> copy the link, then on a computer choose Other calendars,
                  +, From URL, and paste it.
                </span>
                <button type="button" onClick={copy} className={cn(buttonClass('secondary', 'sm'), 'min-h-[32px]')}>
                  <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <p className="text-[11.5px] text-parch-500">
                This link is yours. Anyone who has it can see these birthdays, so don&rsquo;t share it.{' '}
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  className="font-bold text-brand-800 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Make a new link
                </button>
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
