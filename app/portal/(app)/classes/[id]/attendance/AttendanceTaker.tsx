'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Save } from 'lucide-react'
import { saveAttendance } from '@/lib/portal/actions/attendance'
import { Avatar, buttonClass, inputClass, Card } from '@/components/portal/ui'
import { formatShortDate, formatDateTime } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

type Status = 'PRESENT' | 'EXCUSED' | 'ABSENT'
type Reason = 'sick' | 'travel' | 'other'

interface Props {
  classId: string
  date: string
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

  /** What this save would change against what is already stored. */
  const diff = useMemo(() => {
    const before = new Map(props.existing.map((e) => [e.studentId, e.status]))
    let added = 0, changed = 0, cleared = 0
    for (const [id, m] of Array.from(marks.entries())) {
      const was = before.get(id)
      if (was === undefined) { if (m.status !== 'ABSENT') added++ }
      else if (was !== m.status) { if (m.status === 'ABSENT') cleared++; else changed++ }
    }
    return { added, changed, cleared, total: added + changed + cleared }
  }, [marks, props.existing])

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
      setMessage({ kind: 'ok', text: `Saved ${counts.p} present, ${counts.e} excused, ${counts.a} absent.${extra ? ` ${extra}.` : ''}` })
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
              <li key={s.id} className={cn('overflow-hidden rounded-[12px] border-[1.5px] transition-colors', CARD_STYLE[m.status])}>
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
          ) : diff.total > 0 ? (
            <p className="text-[12px] text-parch-600">
              <span className="font-bold text-brand-800">{diff.total} change{diff.total === 1 ? '' : 's'}</span> to save
              {diff.added > 0 && ` · ${diff.added} new`}
              {diff.changed > 0 && ` · ${diff.changed} changed`}
              {diff.cleared > 0 && ` · ${diff.cleared} back to absent`}
            </p>
          ) : (
            <p className="text-[12px] text-parch-500">Tap a card to cycle Absent → Present → Excused.</p>
          )}
        </div>
        <button type="button" onClick={save} disabled={pending} className={cn(buttonClass('primary'), 'min-h-[40px]')}>
          <Save className="h-[13px] w-[13px]" />
          {pending ? 'Saving…' : hasExisting ? 'Update attendance' : 'Save attendance'}
        </button>
      </div>
    </div>
  )
}
