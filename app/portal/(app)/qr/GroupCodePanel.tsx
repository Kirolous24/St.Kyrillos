'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { QrCode, RefreshCw, XCircle, ClipboardCheck } from 'lucide-react'
import { createGroupCode, createMeetingCode, codeStatus, endCode, type GroupCode } from '@/lib/portal/actions/qr'
import { secondsLeft } from '@/lib/portal/qr'
import { Card, Callout, Field, buttonClass, selectClass, checkboxClass, Badge, Avatar } from '@/components/portal/ui'
import { formatDateTime } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

type Mode = 'ATTENDANCE' | 'POINTS' | 'MEETING'

/** Unattended refreshes before the panel gives up and waits to be asked. */
const AUTO_REGEN_LIMIT = 3

interface Props {
  /** Preselected from ?mode= so the sidebar's "QR Points" lands ready to use. */
  initialMode?: Mode
  /** From ?class= — the class this code should already be pointed at. */
  preselectClassId?: string | null
  classes: Array<{ id: string; name: string }>
  /**
   * F0013 — the servant's own class ids. The prototype pre-checked the servant's
   * class and labelled it "(my class)"; here a servant who serves one class among
   * the church's twelve had to find it in the list every Sunday, and an admin
   * generating a code for the wrong class is a silent mistake — the children
   * scan, and the marks land on somebody else's register.
   *
   * It has to come from the page: this is a client component and `user.classIds`
   * lives on the session.
   */
  myClassIds?: readonly string[]
  sessions: Array<{ key: string; label: string; points: number }>
  activities: Array<{ id: string; label: string; points: number; classId: string | null }>
  servantActivities: Array<{ key: string; label: string }>
}

function countdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/** The prototype's three-up segmented control (burgundy fill when active). */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: Array<[T, string]>
}) {
  return (
    <div className="mb-4 flex overflow-hidden rounded-[9px] border border-parch-200">
      {options.map(([key, label], i) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            'min-h-[40px] flex-1 px-2 py-2 text-[12px] font-bold transition-colors',
            i > 0 && 'border-l border-parch-200',
            value === key ? 'bg-brand-800 text-brand-gold' : 'bg-parch-50 text-parch-500 hover:text-brand-800',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function GroupCodePanel({
  classes,
  sessions,
  activities,
  servantActivities,
  initialMode = 'ATTENDANCE',
  preselectClassId = null,
  myClassIds = [],
}: Props) {
  const mine = new Set(myClassIds)
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>(initialMode)
  // Pre-checked: the one class if that is all there is, otherwise the servant's
  // own. An admin with no class of their own still starts from nothing, which is
  // right — they have no "my class" to assume.
  const [selected, setSelected] = useState<string[]>(
    // An explicit ?class= wins: the admin came here from that class's workspace
    // and picking it again by hand is the step this removes.
    preselectClassId
      ? [preselectClassId]
      : classes.length === 1
        ? [classes[0]!.id]
        : classes.filter((c) => mine.has(c.id)).map((c) => c.id),
  )
  const [sessionKey, setSessionKey] = useState(sessions.find((s) => s.key === 'sunday')?.key ?? sessions[0]?.key ?? '')
  const [activityId, setActivityId] = useState(activities[0]?.id ?? '')
  const [meetingKey, setMeetingKey] = useState(servantActivities.find((a) => a.key === 'servants_meeting')?.key ?? servantActivities[0]?.key ?? '')
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<GroupCode | null>(null)
  const [left, setLeft] = useState(0)
  const [scanned, setScanned] = useState<Array<{ name: string; at: string }>>([])
  // A code the servant ended on purpose must never be re-minted underneath
  // them, and a tab left on the projector cart must not mint codes all night.
  const [ended, setEnded] = useState(false)
  const [autoCycles, setAutoCycles] = useState(0)

  const expired = code !== null && left <= 0

  useEffect(() => {
    if (!code) return
    const expiresAt = new Date(code.expiresAt)
    const update = () => setLeft(secondsLeft(expiresAt))
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [code])

  const poll = useCallback(async (token: string) => {
    const result = await codeStatus(token)
    if (result.ok && result.data) setScanned(result.data.redemptions)
  }, [])

  /**
   * F0016 — the "N checked in" tally refreshes every two seconds while a code
   * is live, not every five. The prototype moved the number the instant a child
   * scanned; at five seconds the servant holding the code up is looking at a
   * count that is usually wrong and starts asking the room "did that work?".
   * Each poll is one indexed read of a single token row, and the effect returns
   * the moment the code expires, so nothing polls in the background.
   */
  useEffect(() => {
    if (!code || expired) return
    void poll(code.token)
    const id = window.setInterval(() => void poll(code.token), 2000)
    return () => window.clearInterval(id)
  }, [code, expired, poll])

  /**
   * Mint a fresh code when the projected one runs out, so a class still
   * arriving is not staring at a dead square — the prototype's own behaviour.
   *
   * The condition is the stored expiry timestamp, NOT `left <= 0`. `left`
   * starts at 0 and the countdown only fills it after mount, so every freshly
   * minted code reads as expired for one render: keying off `left` regenerates
   * forever. It also stops after three unattended cycles and while the tab is
   * hidden, because each generate writes a token row and an audit row.
   */
  useEffect(() => {
    if (!code || ended || pending) return
    if (mode !== 'ATTENDANCE' && mode !== 'POINTS' && mode !== 'MEETING') return
    if (autoCycles >= AUTO_REGEN_LIMIT) return
    const expiresAt = new Date(code.expiresAt).getTime()
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() < expiresAt) return
      generate(true)
    }
    const id = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
    // `generate` is stable enough here: it reads current state via setState
    // callbacks and the effect is re-created whenever `code` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, ended, pending, autoCycles, mode])

  function toggleClass(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function generate(auto = false) {
    setError(null)
    setEnded(false)
    setAutoCycles((n) => (auto ? n + 1 : 0))
    startTransition(async () => {
      if (mode === 'MEETING') {
        if (!meetingKey) return setError('Pick a servant activity.')
        const result = await createMeetingCode({ activityKey: meetingKey })
        if (!result.ok || !result.data) return setError(result.ok ? 'Could not open that code.' : result.error)
        setScanned([])
        return setCode(result.data)
      }
      if (selected.length === 0) return setError('Pick at least one class.')
      const result = await createGroupCode({
        mode,
        classIds: selected,
        sessionKey: mode === 'ATTENDANCE' ? sessionKey : undefined,
        activityId: mode === 'POINTS' ? activityId : undefined,
      })
      if (!result.ok || !result.data) return setError(result.ok ? 'Could not open that code.' : result.error)
      setScanned([])
      setCode(result.data)
    })
  }

  function stop() {
    if (!code) return
    startTransition(async () => {
      const result = await endCode(code.token)
      if (!result.ok) return setError(result.error)
      setEnded(true)
      setLeft(0)
    })
  }

  /* ── The live code ──────────────────────────────────────────────────────── */

  if (code) {
    return (
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card tone="brand" bodyClassName="px-5 py-6">
            <div className="mx-auto max-w-[400px] text-center">
              <p className="font-serif text-[16px] font-bold leading-snug text-parch-900">{code.title}</p>
              <p className="mt-1 text-[12px] text-parch-500">{code.subtitle}</p>

              {/* the code itself, ringed in gold on cream */}
              <div className="mt-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={code.qr}
                  alt="Check-in QR code"
                  className={cn(
                    'h-[220px] w-[220px] rounded-[14px] bg-parch-50 p-2 ring-[1.5px] ring-brand-gold/55 shadow-[0_4px_16px_rgba(74,59,50,.09)] sm:h-[260px] sm:w-[260px]',
                    expired && 'opacity-25 grayscale',
                  )}
                />
              </div>

              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Or type this code</p>
              <p className="mt-0.5 text-[30px] font-bold leading-none tracking-[0.22em] text-brand-950">{code.shortCode}</p>

              {/* expiry strip, exactly the prototype's: label + timer left, tally right */}
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-parch-200 bg-parch-100 px-4 py-3">
                <div className="text-left">
                  <p className="mb-0.5 text-[11px] text-parch-500">
                    {!expired ? 'Expires in' : ended || autoCycles >= AUTO_REGEN_LIMIT ? 'Ended' : 'Refreshing…'}
                  </p>
                  {expired ? (
                    <Badge tone="bad">Expired</Badge>
                  ) : (
                    <p className="text-[26px] font-bold leading-none tracking-[1px] tabular-nums text-brand-800">{countdown(left)}</p>
                  )}
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-[20px] px-3 py-[5px] text-[12px] font-semibold',
                    scanned.length > 0 ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-parch-200/70 text-parch-500',
                  )}
                >
                  {scanned.length} checked in
                </span>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {/* Regenerate keeps the classes and session already chosen;
                    "New code" goes back to the form to change them. The port
                    only had the latter, so a code that ran out mid-arrival meant
                    re-picking every setting. */}
                <button type="button" onClick={() => generate()} disabled={pending} className={cn(buttonClass('primary'), 'flex-1')}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> {pending ? 'Opening…' : 'Regenerate'}
                </button>
                <button type="button" onClick={() => { setCode(null); setScanned([]); setEnded(false); setAutoCycles(0) }} className={buttonClass('secondary')}>
                  New code
                </button>
                {!expired && (
                  <button type="button" onClick={stop} disabled={pending} className={buttonClass('secondary')}>
                    <XCircle className="h-4 w-4" aria-hidden /> End now
                  </button>
                )}
                {/* F0606 — a meeting code that has just run out leaves a list of
                    who scanned and no way to act on it: the two or three
                    servants who came without a phone still have to be marked by
                    hand, and finding them meant stepping the week picker back
                    from today. No ?week= on purpose — the page resolves the
                    current week in church time, and a Monday computed in the
                    browser is a day out on a Sunday evening. */}
                {mode === 'MEETING' && (
                  <Link href="/portal/servant-attendance" className={buttonClass('secondary')}>
                    <ClipboardCheck className="h-4 w-4" aria-hidden /> Fix who attended
                  </Link>
                )}
              </div>
              {error && <p role="status" className="mt-3 text-[12.5px] font-semibold text-red-600">{error}</p>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title={`Scanned (${scanned.length})`} icon={<QrCode className="h-4 w-4" aria-hidden />}>
            {scanned.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-parch-500">
                {expired ? 'Nobody scanned this code.' : 'Waiting for the first scan…'}
              </p>
            ) : (
              <ul className="max-h-[360px] space-y-1.5 overflow-y-auto">
                {scanned.map((r) => (
                  <li
                    key={`${r.name}-${r.at}`}
                    className="flex items-center gap-2.5 rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-2.5 py-1.5"
                  >
                    <Avatar name={r.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-parch-800">{r.name}</span>
                    <span className="shrink-0 text-[11px] text-parch-500">{formatDateTime(new Date(r.at))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    )
  }

  /* ── Opening a code ─────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-[440px]">
      <Card bodyClassName="px-5 py-7">
        <div className="mx-auto mb-4 grid h-[52px] w-[52px] place-items-center rounded-full bg-brand-wash text-brand-800">
          <QrCode className="h-6 w-6" aria-hidden />
        </div>

        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            ['ATTENDANCE', 'Attendance'],
            ['POINTS', 'Points'],
            ['MEETING', 'Meeting'],
          ]}
        />

        {mode === 'MEETING' ? (
          <Field label="Servant activity" hint="Servants scan it to mark themselves attended for this week.">
            <select value={meetingKey} onChange={(e) => setMeetingKey(e.target.value)} className={selectClass}>
              {servantActivities.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <fieldset className="mb-3.5">
              <legend className="mb-1.5 block text-[12px] font-bold text-parch-700">Classes this code covers</legend>
              <div className="max-h-[180px] overflow-y-auto rounded-[10px] border-[1.5px] border-parch-200 bg-parch-50">
                {classes.map((c) => (
                  <label
                    key={c.id}
                    className="flex min-h-[40px] cursor-pointer items-center gap-2.5 border-t border-[#F5F2ED] px-3 py-2 text-[12.5px] first:border-t-0"
                  >
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={selected.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                    />
                    <span className="truncate text-parch-800">{c.name}</span>
                    {mine.has(c.id) && (
                      <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.5px] text-brand-gold-dark">
                        my class
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-parch-500">Check more than one to combine classes into a single code.</p>
            </fieldset>

            {mode === 'ATTENDANCE' ? (
              <Field label="Session" hint="Students who scan are marked present and earn the session's points.">
                <select value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} className={selectClass}>
                  {sessions.map((s) => (
                    <option key={s.key} value={s.key}>{s.label} (+{s.points})</option>
                  ))}
                </select>
              </Field>
            ) : activities.length === 0 ? (
              <div className="mb-3.5">
                <Callout tone="warn">This class has no positive-point activity yet. Add one on the class Points page first.</Callout>
              </div>
            ) : (
              <Field label="Activity">
                <select value={activityId} onChange={(e) => setActivityId(e.target.value)} className={selectClass}>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{a.label} (+{a.points})</option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}

        {error && <p role="status" className="mb-3 text-[12.5px] font-semibold text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => generate()}
          disabled={pending || (mode === 'POINTS' && activities.length === 0)}
          className={cn(buttonClass('primary'), 'w-full py-3')}
        >
          <QrCode className="h-4 w-4" aria-hidden /> {pending ? 'Opening…' : 'Generate code'}
        </button>
      </Card>
    </div>
  )
}
