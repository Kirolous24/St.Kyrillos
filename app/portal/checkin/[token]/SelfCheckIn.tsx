'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Search } from 'lucide-react'
import { selfCheckIn, undoSelfCheckIn } from '@/lib/portal/actions/checkin'
import { buttonClass, inputClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Person = { id: string; label: string; here: boolean }

/**
 * Tap your name (2026-10-24). One name per phone per code; "Not you?" takes it
 * back while the code is live.
 */
export function SelfCheckIn({
  token,
  meeting,
  dateLabel,
  people,
  mine,
  me,
}: {
  token: string
  meeting: string
  dateLabel: string
  people: Person[]
  /** Who this phone already checked in with this code. */
  mine: { id: string; label: string } | null
  /** A servant who is a member, signed in on this phone. */
  me: Person | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState('')
  const [asking, setAsking] = useState<Person | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ label: string; already: boolean } | null>(null)

  function checkIn(p: { id: string; label: string }) {
    setError('')
    startTransition(async () => {
      const r = await selfCheckIn(token, p.id)
      if (!r.ok) return setError(r.error)
      setAsking(null)
      setDone({ label: r.data!.name, already: r.data!.already })
      router.refresh()
    })
  }

  function undo() {
    setError('')
    startTransition(async () => {
      const r = await undoSelfCheckIn(token)
      if (!r.ok) return setError(r.error)
      setDone(null)
      router.refresh()
    })
  }

  const header = (
    <div className="mb-4">
      <h1 className="font-serif text-[22px] font-bold leading-tight text-parch-900">{meeting}</h1>
      <p className="text-[13px] text-parch-600">{dateLabel}</p>
    </div>
  )

  const checked = done ?? (mine ? { label: mine.label, already: true } : null)
  if (checked) {
    return (
      <>
        {header}
        <div className="rounded-[18px] border-[1.5px] border-[#86EFAC] bg-[#F0FDF4] p-5 text-center" role="status" data-testid="checkin-done">
          <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-[#16A34A]" aria-hidden />
          <p className="font-serif text-[20px] font-bold text-[#14532D]">You’re checked in, {checked.label}</p>
          <p className="mt-1 text-[13px] text-[#166534]">Welcome. God bless you.</p>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-center text-[13px] font-semibold text-[#B91C1C]">
            {error}
          </p>
        )}
        <p className="mt-4 text-center text-[12.5px] text-parch-600">
          Not you?{' '}
          <button type="button" disabled={pending} onClick={undo} className="font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
            {pending ? 'Undoing…' : 'Undo'}
          </button>
        </p>
      </>
    )
  }

  const term = q.trim().toLowerCase()
  const shown = term ? people.filter((p) => p.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(term)) || p.label.toLowerCase().startsWith(term)) : people

  return (
    <>
      {header}
      {me && !me.here && (
        <div className="mb-4 rounded-[16px] border border-brand-gold/60 bg-brand-wash p-4">
          <p className="mb-2 text-[13px] text-parch-800">You’re signed in as {me.label}.</p>
          <button type="button" disabled={pending} onClick={() => checkIn(me)} className={cn(buttonClass('primary'), 'min-h-[48px] w-full text-[15px]')}>
            Check me in
          </button>
        </div>
      )}
      <p className="mb-2 text-[14px] font-bold text-parch-900">Tap your name</p>
      <label htmlFor="checkin-search" className="sr-only">
        Find your name
      </label>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parch-400" aria-hidden />
        <input
          id="checkin-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={cn(inputClass, 'pl-9 text-[15px]')}
          placeholder="Start typing your name"
          autoComplete="off"
        />
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </p>
      )}
      <ul className="space-y-2" data-testid="checkin-names">
        {shown.map((p) =>
          asking?.id === p.id ? (
            <li key={p.id} className="rounded-[14px] border-[1.5px] border-brand-gold bg-parch-50 p-3">
              <p className="mb-2 text-[14px] text-parch-900">
                Check in as <b>{p.label}</b>?
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => checkIn(p)} className={cn(buttonClass('primary'), 'min-h-[46px] flex-1 text-[14px]')}>
                  {pending ? 'Checking in…' : 'Yes, that’s me'}
                </button>
                <button type="button" onClick={() => setAsking(null)} className={cn(buttonClass('ghost'), 'min-h-[46px]')}>
                  Cancel
                </button>
              </div>
            </li>
          ) : (
            <li key={p.id}>
              <button
                type="button"
                disabled={p.here || pending}
                onClick={() => {
                  setError('')
                  setAsking(p)
                }}
                className={cn(
                  'flex min-h-[50px] w-full items-center justify-between rounded-[14px] border px-4 text-left text-[15px] font-semibold transition-colors',
                  p.here ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]' : 'border-parch-200 bg-parch-50 text-parch-900 hover:border-brand-gold',
                )}
              >
                {p.label}
                {p.here && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-bold">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Here
                  </span>
                )}
              </button>
            </li>
          ),
        )}
        {shown.length === 0 && <li className="py-3 text-center text-[13px] text-parch-500">No name starts with that.</li>}
      </ul>
      <p className="mt-5 text-center text-[12.5px] text-parch-600">Not on the list? Ask a servant to add you.</p>
    </>
  )
}
