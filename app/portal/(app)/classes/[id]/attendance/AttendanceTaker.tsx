'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Check, X, Save, Pencil } from 'lucide-react'
import { saveAttendance } from '@/lib/portal/actions/attendance'
import { attendanceChanges } from '@/lib/portal/attendance-rules'
import { Avatar, buttonClass, inputClass, Card } from '@/components/portal/ui'
import { formatShortDate, formatDateTime } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

type Status = 'PRESENT' | 'EXCUSED' | 'ABSENT'
type Reason = 'sick' | 'travel' | 'other'

interface Props {
  classId: string
  date: string
  /** Today in the church's timezone — caps the date picker, as the OG did. */
  today: string
  sessionKey: string
  sessions: Array<{ key: string; label: string; points: number }>
  students: Array<{ id: string; name: string; photo: string | null }>
  existing: Array<{ studentId: string; status: Status; reason: string | null }>
  lastSaved: { at: string; by: string } | null
  recentDates: string[]
}

const NEXT: Record<Status, Status> = { ABSENT: 'PRESENT', PRESENT: 'EXCUSED', EXCUSED: 'ABSENT' }

const REASON_LABEL: Record<Reason, string> = { sick: '🤒 Sick', travel: '✈️ Travel', other: '📋 Other' }

/** The prototype's tappable card states: green present, amber excused, plain absent. */
const CARD_STYLE: Record<Status, string> = {
  PRESENT: 'border-[#22C55E] bg-[#F0FDF4]',
  EXCUSED: 'border-[#D97706] bg-[#FEF3C7]',
  ABSENT: 'border-[#EFE9DC] bg-parch-50',
}

export function AttendanceTaker(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const initial = useMemo(() => {
    const map = new Map<string, { status: Status; reason: Reason | null }>()
    for (const s of props.students) map.set(s.id, { status: 'ABSENT', reason: null })
    for (const e of props.existing) map.set(e.studentId, { status: e.status, reason: (e.reason as Reason) ?? null })
    return map
  }, [props.students, props.existing])

  const [marks, setMarks] = useState(initial)
  const [confirming, setConfirming] = useState(false)
  // createPortal needs document, absent during the server render.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const hasExisting = props.existing.length > 0
  const session = props.sessions.find((s) => s.key === props.sessionKey)

  const counts = useMemo(() => {
    let p = 0, e = 0, a = 0
    for (const m of Array.from(marks.values())) {
      if (m.status === 'PRESENT') p++
      else if (m.status === 'EXCUSED') e++
      else a++
    }
    return { p, e, a }
  }, [marks])

  /**
   * What this save would change, and who gains or loses points by it — the
   * prototype's confirm step. Computed by the unit-tested rule rather than
   * counted inline, because taking a student off PRESENT reverses the points
   * they were given and that has to be named before it happens.
   */
  /**
   * Has the servant actually touched the register?
   *
   * Not the same question as "does this differ from what is stored": with
   * nothing stored, every student starts ABSENT, and saving that really would
   * create rows and mark the day held — a change by any measure. But it is also
   * the state of a page nobody has touched, so gating on the stored diff put a
   * confirm dialog in front of an untouched screen.
   */
  const dirty = useMemo(() => {
    for (const [id, m] of Array.from(marks.entries())) {
      const was = initial.get(id)
      if (!was || was.status !== m.status || (was.reason ?? null) !== (m.reason ?? null)) return true
    }
    return false
  }, [marks, initial])

  const diff = useMemo(
    () =>
      attendanceChanges({
        marks: Array.from(marks.entries()).map(([studentId, m]) => ({
          studentId,
          name: props.students.find((s) => s.id === studentId)?.name ?? '',
          status: m.status,
          reason: m.reason,
        })),
        existing: props.existing.map((e) => ({ studentId: e.studentId, status: e.status, reason: e.reason })),
        sessionPoints: session?.points ?? 0,
      }),
    [marks, props.existing, props.students, session?.points],
  )

  function navigate(date: string, sessionKey: string) {
    router.push(`/portal/classes/${props.classId}/attendance?date=${date}&session=${sessionKey}`)
  }

  function cycle(id: string) {
    setMarks((prev) => {
      const next = new Map(prev)
      const cur = prev.get(id)!
      const status = NEXT[cur.status]
      next.set(id, { status, reason: status === 'EXCUSED' ? cur.reason ?? 'other' : null })
      return next
    })
  }

  function setReason(id: string, reason: Reason) {
    setMarks((prev) => {
      const next = new Map(prev)
      next.set(id, { status: 'EXCUSED', reason })
      return next
    })
  }

  function markAll(status: Status) {
    setMarks((prev) => {
      const next = new Map(prev)
      for (const id of Array.from(prev.keys())) next.set(id, { status, reason: status === 'EXCUSED' ? 'other' : null })
      return next
    })
  }

  function save() {
    setMessage(null)
    setConfirming(false)
    /**
     * F0577 — the confirm panel names the points this save hands out, and then
     * the message that replaces it dropped them: a servant who pressed Save had
     * no record of what the register just awarded, and taking someone off
     * present takes points back. Read here, before the write, because
     * router.refresh() rebuilds `diff` against the rows that were just saved and
     * it is zero by the time the message is set.
     */
    const gained = diff.gains.length
    const lost = diff.losses.length
    const net = diff.netPoints
    startTransition(async () => {
      const result = await saveAttendance({
        classId: props.classId,
        date: props.date,
        sessionKey: props.sessionKey,
        marks: Array.from(marks.entries()).map(([studentId, m]) => ({ studentId, status: m.status, reason: m.reason })),
      })
      if (!result.ok) {
        setMessage({ kind: 'err', text: result.error })
        return
      }
      const extra = [
        result.data?.opened ? `${result.data.opened} follow-up case${result.data.opened > 1 ? 's' : ''} opened` : null,
        result.data?.closed ? `${result.data.closed} follow-up case${result.data.closed > 1 ? 's' : ''} closed` : null,
      ].filter(Boolean).join(', ')
      const points =
        net === 0
          ? ''
          : net > 0
            ? ` +${net} pts for ${gained} student${gained === 1 ? '' : 's'}.`
            : ` ${net} pts from ${lost} student${lost === 1 ? '' : 's'}.`
      setMessage({
        kind: 'ok',
        text: `Saved ${counts.p} present, ${counts.e} excused, ${counts.a} absent.${points}${extra ? ` ${extra}.` : ''}`,
      })
      router.refresh()
    })
  }

  return (
    <div className="space-y-3.5">
      {/* Session picker — the prototype's tab row */}
      {props.sessions.length > 1 && (
        <div className="hidden flex-wrap gap-2 sm:flex print:hidden">
          {props.sessions.map((s) => {
            const active = s.key === props.sessionKey
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => navigate(props.date, s.key)}
                aria-pressed={active}
                className={cn(
                  'min-h-[40px] whitespace-nowrap rounded-[10px] px-4 py-2 text-[12px] font-bold transition-all',
                  active
                    ? 'bg-brand-wash text-brand-800 shadow-nav-on ring-1 ring-brand-gold/50'
                    : 'border border-parch-200 bg-parch-50 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800',
                )}
              >
                {s.label} <span className="font-semibold text-parch-500">+{s.points}</span>
              </button>
            )
          })}
        </div>
      )}

      <Card bodyClassName="p-0">
        {/* Date + session + live counter */}
        <div className="flex flex-wrap items-end gap-3 border-b border-[#F3F0EB] px-4 py-3.5">
          <label className="min-w-[150px] flex-1">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Date</span>
            <input
              type="date"
              value={props.date}
              max={props.today}
              onChange={(e) => e.target.value && navigate(e.target.value, props.sessionKey)}
              className={cn(inputClass, 'max-w-[190px]')}
            />
          </label>
          {props.sessions.length > 1 && (
            <label className="min-w-[150px] flex-1 sm:hidden">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Session</span>
              <select value={props.sessionKey} onChange={(e) => navigate(props.date, e.target.value)} className={inputClass}>
                {props.sessions.map((s) => (
                  <option key={s.key} value={s.key}>{s.label} (+{s.points})</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <div className="rounded-[10px] border border-[#86EFAC] bg-[#F0FDF4] px-4 py-2 text-center">
              <p className="text-[17px] font-bold leading-none text-[#166534] tabular-nums">{counts.p}</p>
              <p className="text-[11px] text-[#166534]">present</p>
            </div>
            <div className="rounded-[10px] border border-[#FDE68A] bg-[#FEF3C7] px-4 py-2 text-center">
              <p className="text-[17px] font-bold leading-none text-[#8B5A0F] tabular-nums">{counts.e}</p>
              <p className="text-[11px] text-[#8B5A0F]">excused</p>
            </div>
            <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-center">
              <p className="text-[17px] font-bold leading-none text-[#991B1B] tabular-nums">{counts.a}</p>
              <p className="text-[11px] text-[#991B1B]">absent</p>
            </div>
          </div>
        </div>

        {/* Select-all row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3F0EB] px-4 py-2.5">
          <p className="text-[12px] text-parch-500">
            {formatShortDate(props.date)} · {session?.label} · {props.students.length} student{props.students.length === 1 ? '' : 's'}
            {hasExisting && props.lastSaved && (
              <span className="block sm:ml-2 sm:inline">Last saved {formatDateTime(new Date(props.lastSaved.at))} by {props.lastSaved.by}</span>
            )}
          </p>
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={() => markAll('PRESENT')} className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}>✓ All present</button>
            <button type="button" onClick={() => markAll('ABSENT')} className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}>✕ Clear</button>
          </div>
        </div>

        {/* Tappable student cards — repeat(auto-fill,minmax(92px,1fr)), gap 10px */}
        <ul className="grid grid-cols-3 gap-2.5 p-4 sm:grid-cols-[repeat(auto-fill,minmax(104px,1fr))]">
          {props.students.map((s) => {
            const m = marks.get(s.id)!
            return (
              <li key={s.id} className={cn('relative overflow-hidden rounded-[12px] border-[1.5px] transition-colors', CARD_STYLE[m.status])}>
                {/* F0207 — reaching Excused cost three taps on the same card, so
                    a servant told "he is away sick" either tapped past it twice
                    or gave up and left the child marked absent. The pencil goes
                    straight to Excused and opens the reasons; pressing it again
                    puts the child back to Absent, so it is never a one-way door.
                    A real 28px button, not an icon on the card's own hit area. */}
                <button
                  type="button"
                  onClick={() =>
                    setMarks((prev) => {
                      const next = new Map(prev)
                      const cur = prev.get(s.id)!
                      next.set(
                        s.id,
                        cur.status === 'EXCUSED'
                          ? { status: 'ABSENT', reason: null }
                          : { status: 'EXCUSED', reason: cur.reason ?? 'other' },
                      )
                      return next
                    })
                  }
                  aria-pressed={m.status === 'EXCUSED'}
                  aria-label={`${m.status === 'EXCUSED' ? 'Stop excusing' : 'Excuse'} ${s.name}`}
                  title={m.status === 'EXCUSED' ? 'Not excused after all' : 'Excuse — pick a reason'}
                  className="absolute right-1 top-1 z-10 grid h-7 w-7 place-items-center rounded-[8px] border border-parch-200 bg-parch-50/90 text-parch-600 transition-colors hover:border-[#D97706] hover:text-[#8B5A0F] print:hidden"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => cycle(s.id)}
                  aria-pressed={m.status === 'PRESENT'}
                  aria-label={`${s.name}: ${m.status === 'PRESENT' ? 'present' : m.status === 'EXCUSED' ? 'excused' : 'absent'}. Tap to change.`}
                  className="w-full px-2 py-3.5 text-center"
                >
                  <span className="mx-auto mb-2 block w-fit">
                    <Avatar name={s.name} photo={s.photo} size="md" />
                  </span>
                  <span className="mb-2 block truncate text-[11.5px] font-bold text-parch-900" title={s.name}>{s.name}</span>
                  <span
                    className={cn(
                      'mx-auto grid h-6 w-6 place-items-center rounded-full border-2',
                      m.status === 'PRESENT' && 'border-[#22C55E] bg-[#22C55E] text-parch-50',
                      m.status === 'EXCUSED' && 'border-[#D97706] bg-[#D97706] text-parch-50',
                      m.status === 'ABSENT' && 'border-parch-300',
                    )}
                    aria-hidden
                  >
                    {m.status === 'PRESENT' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    {m.status === 'EXCUSED' && <X className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </button>
                {m.status === 'EXCUSED' && (
                  <div className="flex flex-wrap justify-center gap-1.5 px-2 pb-2.5">
                    {(['sick', 'travel', 'other'] as Reason[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(s.id, r)}
                        aria-pressed={m.reason === r}
                        className={cn(
                          'rounded-[16px] border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                          m.reason === r
                            ? 'border-[#8B5A0F] bg-[#8B5A0F] text-parch-50'
                            : 'border-parch-200 bg-parch-50 text-parch-700 hover:border-brand-gold',
                        )}
                      >
                        {REASON_LABEL[r]}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {props.recentDates.length > 0 && (
        <Card title={`Recent ${session?.label ?? ''} dates`} bodyClassName="p-3.5">
          <div className="flex flex-wrap gap-2">
            {props.recentDates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => navigate(d, props.sessionKey)}
                className={cn(
                  'min-h-[40px] rounded-[10px] px-3 py-2 text-[12px] font-bold transition-all',
                  d === props.date
                    ? 'bg-brand-wash text-brand-800 ring-1 ring-brand-gold/50'
                    : 'border border-parch-200 bg-parch-50 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800',
                )}
              >
                {formatShortDate(d)}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Save bar with a diff review, as the prototype shows before writing */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50/95 p-3 shadow-panel backdrop-blur print:hidden">
        <div className="min-w-0 flex-1">
          {message ? (
            <p role="status" className={cn('text-[12.5px] font-semibold', message.kind === 'ok' ? 'text-[#15803D]' : 'text-[#B91C1C]')}>
              {message.text}
            </p>
          ) : dirty && diff.changed > 0 ? (
            <p className="text-[12px] text-parch-600">
              <span className="font-bold text-brand-800">{diff.changed} change{diff.changed === 1 ? '' : 's'}</span> to save
              {diff.gains.length > 0 && ` · ${diff.gains.length} present`}
              {diff.losses.length > 0 && ` · ${diff.losses.length} losing points`}
              {diff.netPoints !== 0 && ` · ${diff.netPoints > 0 ? '+' : ''}${diff.netPoints} pts`}
            </p>
          ) : (
            <p className="text-[12px] text-parch-500">Tap a card to cycle Absent → Present → Excused.</p>
          )}
        </div>
        {/* Nothing to save is said plainly rather than left to a no-op press. */}
        <button
          type="button"
          onClick={() =>
            !dirty || diff.changed === 0
              ? setMessage({ kind: 'ok', text: 'Nothing has changed, so there is nothing to save.' })
              : setConfirming(true)
          }
          disabled={pending}
          className={cn(buttonClass('primary'), 'min-h-[40px]')}
        >
          <Save className="h-[13px] w-[13px]" />
          {pending ? 'Saving…' : hasExisting ? 'Update attendance' : 'Save attendance'}
        </button>
      </div>

      {/* Through a portal into <body>: a fixed overlay inside the page content
          is positioned against .portal-enter's transform, which once left the
          follow-up composer's own controls unclickable. */}
      {confirming && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm attendance"
          className="fixed inset-0 z-[500] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false) }}
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[18px] border-[1.5px] border-brand-gold bg-parch-50 p-4 shadow-panel sm:rounded-[18px]">
            <h2 className="mb-1 font-serif text-[16px] font-bold text-parch-900">
              Save {formatShortDate(props.date)}?
            </h2>
            <p className="mb-3 text-[12px] text-parch-500">
              {session?.label ?? props.sessionKey} · {diff.changed} change{diff.changed === 1 ? '' : 's'}
            </p>

            {diff.createsEmptyRegister && (
              <div className="mb-3 rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] p-2.5 text-[12px] text-[#7F1D1D]">
                <strong>Everyone is marked absent.</strong> This records the day as held and counts against
                every student. If you have not taken the register yet, cancel.
              </div>
            )}

            {diff.gains.length > 0 && (
              <div className="mb-2.5">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                  Gaining {session?.points ?? 0} pt{(session?.points ?? 0) === 1 ? '' : 's'}
                </p>
                <p className="text-[12.5px] text-[#15803D]">{diff.gains.map((g) => g.name).join(', ')}</p>
              </div>
            )}

            {diff.losses.length > 0 && (
              <div className="mb-2.5">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Losing points</p>
                <ul className="space-y-0.5 text-[12.5px] text-[#B91C1C]">
                  {diff.losses.map((l) => (
                    <li key={l.studentId}>
                      {l.name} <span className="tabular-nums">({l.delta})</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-parch-500">
                  Taking a student off present reverses the points that save gave them.
                </p>
              </div>
            )}

            {diff.reasonOnly.length > 0 && (
              <div className="mb-2.5">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                  Changed, no points either way
                </p>
                <p className="text-[12.5px] text-parch-600">{diff.reasonOnly.map((r) => r.name).join(', ')}</p>
              </div>
            )}

            <div className="mt-3.5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={buttonClass('secondary')}>
                Cancel
              </button>
              <button type="button" onClick={save} disabled={pending} className={buttonClass('primary')}>
                <Save className="h-[13px] w-[13px]" /> {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
