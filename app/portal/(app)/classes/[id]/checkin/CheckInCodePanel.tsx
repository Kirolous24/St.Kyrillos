'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from '@/components/portal/Link'
import { QrCode, RefreshCw, CheckCircle2, Undo2 } from 'lucide-react'
import { checkInList, finishCheckIn, openCheckInCode, undoMemberCheckIn, type MeetingCode } from '@/lib/portal/actions/fellowship'
import { secondsLeft } from '@/lib/portal/qr'
import { Card, Callout, buttonClass } from '@/components/portal/ui'
import { formatDateTime } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

/** A new code is made by itself when one runs out, this many times; then a tap is needed. */
const AUTO_RENEW = 6
/** How often the list of who checked in is refreshed while the page is in view. */
const POLL_MS = 3000

function countdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

type List = { checkedIn: Array<{ accountId: string; name: string; at: string }>; here: number; members: number }

/**
 * The servant's side of a meeting's check-in (2026-10-24): the code to put on
 * the screen, who has checked themselves in (with Undo), and Done, which works
 * out who missed today.
 */
export function CheckInCodePanel({ classId, meetingName }: { classId: string; meetingName: string }) {
  const [pending, startTransition] = useTransition()
  const [code, setCode] = useState<MeetingCode | null>(null)
  const [left, setLeft] = useState(0)
  const [list, setList] = useState<List | null>(null)
  const [error, setError] = useState('')
  const [finished, setFinished] = useState<{ here: number; members: number; opened: number } | null>(null)
  const renewals = useRef(0)
  // The code already renewed: the ticks until the new one arrives must not
  // each ask for another.
  const renewedFor = useRef<string | null>(null)

  const open = useCallback(() => {
    setError('')
    startTransition(async () => {
      const r = await openCheckInCode(classId)
      if (!r.ok) return setError(r.error)
      setCode(r.data!)
      setFinished(null)
    })
  }, [classId])

  // The countdown, and a fresh code when this one runs out, a few times over.
  useEffect(() => {
    if (!code) return
    const tick = () => {
      const s = secondsLeft(new Date(code.expiresAt))
      setLeft(s)
      if (s <= 0 && !finished && renewals.current < AUTO_RENEW && renewedFor.current !== code.token) {
        renewedFor.current = code.token
        renewals.current += 1
        open()
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [code, finished, open])

  // Who has checked in, while the page is in view and the check-in is open.
  useEffect(() => {
    if (!code || finished) return
    let stop = false
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      const r = await checkInList(code.token)
      if (!stop && r.ok) setList(r.data!)
    }
    void load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [code, finished])

  function undo(accountId: string, name: string) {
    if (!code || !window.confirm(`Take back ${name}’s check-in?`)) return
    startTransition(async () => {
      const r = await undoMemberCheckIn(code.token, accountId)
      if (!r.ok) return setError(r.error)
      const fresh = await checkInList(code.token)
      if (fresh.ok) setList(fresh.data!)
    })
  }

  function done() {
    if (!code) return
    startTransition(async () => {
      const r = await finishCheckIn(code.token)
      if (!r.ok) return setError(r.error)
      setFinished(r.data!)
      setLeft(0)
    })
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-[520px]" role="status" data-testid="checkin-finished">
        <Callout tone="good" title="Check-in closed">
          {finished.here} of {finished.members} here today.
          {finished.opened > 0 ? ` ${finished.opened} follow-up${finished.opened === 1 ? '' : 's'} opened for people who missed.` : ''}{' '}
          <Link href={`/portal/classes/${classId}/attendance`} className="font-bold underline decoration-brand-gold underline-offset-2">
            Open the attendance list
          </Link>{' '}
          to mark anyone else, like someone excused.
        </Callout>
        <button type="button" onClick={() => { renewals.current = 0; open() }} className={cn(buttonClass('secondary'), 'mt-3 min-h-[40px]')}>
          Open it again
        </button>
      </div>
    )
  }

  if (!code) {
    return (
      <div className="mx-auto max-w-[520px] space-y-4">
        <Callout tone="info" title="How it works">
          Put the code on a screen. Members scan it with their phone camera — no app, no sign-in — and tap their own name.
          A code lasts five minutes and renews itself. When everyone is in, press Done.
        </Callout>
        {error && <Callout tone="bad">{error}</Callout>}
        <button type="button" disabled={pending} onClick={() => { renewals.current = 0; open() }} className={cn(buttonClass('primary'), 'min-h-[48px] w-full text-[14px]')} data-testid="open-checkin">
          <QrCode className="h-5 w-5" aria-hidden /> {pending ? 'Opening…' : `Show the ${meetingName} code`}
        </button>
      </div>
    )
  }

  const expired = left <= 0
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Card>
          <div className="text-center" data-testid="checkin-code">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={code.qr} alt={`QR code for ${meetingName} check-in`} className={cn('mx-auto w-full max-w-[360px]', expired && 'opacity-30')} />
            <p className="mt-3 font-mono text-[26px] font-bold tracking-[4px] text-brand-900" data-testid="checkin-short-code">
              {code.shortCode}
            </p>
            <p className="text-[12px] text-parch-600">
              Camera won&rsquo;t focus? Go to <b>stkyrillostn.org/portal/checkin</b> and type the code.
            </p>
            <p className={cn('mt-2 text-[13px] font-bold tabular-nums', expired ? 'text-[#B91C1C]' : 'text-parch-700')}>
              {expired ? 'This code has run out' : `Renews in ${countdown(left)}`}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" disabled={pending} onClick={() => { renewals.current = 0; open() }} className={cn(buttonClass('secondary'), 'min-h-[40px]')}>
              <RefreshCw className="h-4 w-4" aria-hidden /> New code
            </button>
            <button type="button" disabled={pending} onClick={done} className={cn(buttonClass('gold'), 'min-h-[40px]')} data-testid="checkin-done-button">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Done — everyone&rsquo;s in
            </button>
          </div>
          {error && <div className="mt-3"><Callout tone="bad">{error}</Callout></div>}
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card title={list ? `Checked in from their phones (${list.checkedIn.length})` : 'Checked in from their phones'}>
          {list && (
            <p className="mb-2 text-[12px] text-parch-600" data-testid="checkin-here">
              {list.here} of {list.members} here so far, counting anyone marked by hand.
            </p>
          )}
          {!list || list.checkedIn.length === 0 ? (
            <p className="text-[12.5px] text-parch-500">Nobody yet.</p>
          ) : (
            <ul className="divide-y divide-[#F5F2ED]" data-testid="checkin-list">
              {list.checkedIn.map((c) => (
                <li key={c.accountId} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-parch-900">{c.name}</span>
                    <span className="block text-[11px] text-parch-500">{formatDateTime(new Date(c.at))}</span>
                  </span>
                  <button type="button" disabled={pending} onClick={() => undo(c.accountId, c.name)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[34px]')} aria-label={`Take back ${c.name}’s check-in`}>
                    <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
