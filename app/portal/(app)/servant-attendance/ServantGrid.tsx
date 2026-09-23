'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Minus, X } from 'lucide-react'
import { saveServantWeek } from '@/lib/portal/actions/servant-attendance'
import { Card, TableWrap, Th, Td, Avatar, Badge, buttonClass } from '@/components/portal/ui'
import { addDays } from '@/lib/portal/dates'
import { formatMonthDay } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

type Cell = 'PRESENT' | 'EXCUSED' | 'ABSENT' | null

const CYCLE: Cell[] = [null, 'PRESENT', 'EXCUSED', 'ABSENT']
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The prototype's three statuses: solid green / amber / red, white glyph. */
const CELL_STYLE: Record<Exclude<Cell, null>, string> = {
  PRESENT: 'border-transparent bg-[#16A34A] text-white',
  EXCUSED: 'border-transparent bg-[#B45309] text-white',
  ABSENT: 'border-transparent bg-[#DC2626] text-white',
}

interface Props {
  weekStart: string
  activities: Array<{ key: string; label: string; dayOfWeek: number }>
  servants: Array<{
    id: string
    /** The Account id — what /portal/admin/servants/[id] is keyed on. */
    accountId: string
    name: string
    photo: string | null
    classNames: string[]
    isSelf: boolean
  }>
  marks: Array<{
    servantId: string
    activityKey: string
    status: 'PRESENT' | 'EXCUSED' | 'ABSENT'
    /**
     * F0288 / F0580 / F0617 — why somebody was excused. The column, the zod
     * field and the upsert have all stored this since servant attendance was
     * built (`ServantAttendance.reason`, `MarkSchema.reason`), and
     * `loadWeekGrid` already selects it — the grid was the only thing that never
     * collected or showed it. "Excused" without a reason is the same information
     * as a blank cell to whoever reads the week afterwards.
     */
    reason?: string | null
  }>
  /** Servant ids this user may write. Empty means the grid is read-only. */
  writableIds: string[]
  /**
   * F0293 — whether to link each row to that servant's profile. The prototype
   * opened it from the grid; here the name was plain text, so an admin who
   * noticed somebody had missed three weeks had to leave, open the roster and
   * find them again.
   *
   * ADMIN only, and not by preference: /portal/admin/servants/[id] calls
   * notFound() for every other role, so linking it for a pastor or a servant
   * would put a 404 behind every name in the grid.
   */
  canOpenProfiles?: boolean
}

const key = (servantId: string, activityKey: string) => `${servantId}|${activityKey}`

export function ServantGrid({
  weekStart,
  activities,
  servants,
  marks,
  writableIds,
  canOpenProfiles = false,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const initial = useMemo(() => {
    const map: Record<string, Cell> = {}
    for (const m of marks) map[key(m.servantId, m.activityKey)] = m.status
    return map
  }, [marks])
  const initialReasons = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of marks) if (m.reason) map[key(m.servantId, m.activityKey)] = m.reason
    return map
  }, [marks])
  const [cells, setCells] = useState<Record<string, Cell>>(initial)
  const [reasons, setReasons] = useState<Record<string, string>>(initialReasons)
  const [dirty, setDirty] = useState<string[]>([])
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const writable = useMemo(() => new Set(writableIds), [writableIds])

  function cycle(servantId: string, activityKey: string) {
    if (!writable.has(servantId)) return
    const k = key(servantId, activityKey)
    const current = cells[k] ?? null
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? null
    setCells((prev) => ({ ...prev, [k]: next }))
    setDirty((prev) => (prev.includes(k) ? prev : [...prev, k]))
    setMessage(null)
  }

  /**
   * F0599 / F0627 and F0600 / F0628 — the prototype's "Select All (Attended)"
   * and "Clear Selection". Marking a dozen servants present one cell at a time
   * is the single most repetitive thing on this page, and it happens weekly.
   *
   * Only cells this user may write are touched, and only cells that actually
   * change are marked dirty — so "Select all" on an already-complete column
   * does not manufacture a save with nothing in it.
   */
  function setColumn(activityKey: string, next: Cell) {
    setMessage(null)
    setCells((prev) => {
      const out = { ...prev }
      const changed: string[] = []
      for (const s of servants) {
        if (!writable.has(s.id)) continue
        const k = key(s.id, activityKey)
        if ((prev[k] ?? null) === next) continue
        out[k] = next
        changed.push(k)
      }
      if (changed.length > 0) {
        setDirty((d) => [...d, ...changed.filter((k) => !d.includes(k))])
      }
      return out
    })
  }

  function save() {
    if (dirty.length === 0) return

    /**
     * F0304 — a save that deletes marks asks first.
     *
     * Clearing a whole column is now one tap, so a save is no longer only ever
     * additive: it can take away marks already recorded against real servants,
     * and until this asked, the first anyone knew was the grid coming back
     * empty. Who may do it is deliberately unchanged — the church settled that
     * the register belongs to whoever takes it. What changed is that one tap
     * can now wipe a column, and that calls for a question, not a narrower gate.
     */
    const clearing = dirty.filter((k) => (initial[k] ?? null) !== null && (cells[k] ?? null) === null)
    if (clearing.length > 0) {
      const names = Array.from(
        new Set(clearing.map((k) => servants.find((s) => s.id === k.split('|')[0])?.name).filter(Boolean)),
      )
      const shown = names.slice(0, 8).join(', ')
      if (
        !confirm(
          `Saving will remove ${clearing.length} mark${clearing.length === 1 ? '' : 's'} already recorded for ${shown}${names.length > 8 ? `, and ${names.length - 8} more` : ''}.\n\nThose marks are deleted, not set to absent. Save anyway?`,
        )
      ) {
        return
      }
    }

    setMessage(null)
    startTransition(async () => {
      const payload = dirty.map((k) => {
        const [servantId, activityKey] = k.split('|') as [string, string]
        const value = cells[k] ?? null
        // The action stores a reason only for EXCUSED and nulls it otherwise, so
        // a cell cycled off "excused" cannot keep a stale note behind it.
        return {
          servantId,
          activityKey,
          status: value ?? ('CLEAR' as const),
          reason: value === 'EXCUSED' ? reasons[k]?.trim() || undefined : undefined,
        }
      })
      const result = await saveServantWeek({ weekStart, marks: payload })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setDirty([])
      setMessage({ kind: 'ok', text: `Saved ${result.data?.saved ?? 0} mark${result.data?.saved === 1 ? '' : 's'}.` })
      router.refresh()
    })
  }

  const readOnly = writableIds.length === 0

  return (
    <Card
      title="Weekly grid"
      action={
        readOnly ? null : (
          <div className="flex items-center gap-2">
            {message && (
              <span
                role="status"
                className={cn('text-[11px] font-bold', message.kind === 'ok' ? 'text-[#16A34A]' : 'text-[#DC2626]')}
              >
                {message.text}
              </span>
            )}
            <button type="button" onClick={save} disabled={pending || dirty.length === 0} className={buttonClass('primary', 'sm')}>
              {pending ? 'Saving…' : dirty.length > 0 ? `Save ${dirty.length} change${dirty.length === 1 ? '' : 's'}` : 'Saved'}
            </button>
          </div>
        )
      }
    >
      {/* legend, in the prototype's 11px uppercase label voice */}
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[5px] bg-[#16A34A] text-white">
            <Check className="h-2.5 w-2.5" />
          </span>
          Attended
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[5px] bg-[#B45309] text-white">
            <Minus className="h-2.5 w-2.5" />
          </span>
          Excused
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[5px] bg-[#DC2626] text-white">
            <X className="h-2.5 w-2.5" />
          </span>
          Absent
        </span>
        {/* F0581 — cycling a cell past Absent deletes the row on save, and it
            is the only way to undo a mark made by mistake. "Tap a cell to
            cycle" never said where the cycle ends, so a coordinator either did
            not know the escape existed or reached it by accident and could not
            tell whether the mark was cleared or never saved. */}
        {!readOnly && (
          <span className="font-normal normal-case tracking-normal">
            Tap a cell to cycle: attended → excused → absent → blank. Blank deletes that mark when you save.
          </span>
        )}
      </p>

      <TableWrap>
        <thead>
          <tr>
            <Th className="sticky left-0 z-10 bg-parch-50">Servant</Th>
            {activities.map((a) => (
              <Th key={a.key} align="center" className="whitespace-nowrap">
                <span className="block">{a.label}</span>
                {/* F0300 — the column said "Fri" and nothing more. On this week
                    that is obvious; on any other it is not, and correcting a
                    meeting three weeks back is exactly when somebody is on this
                    page. The header now names the day it actually writes to,
                    derived from the week being shown rather than from today. */}
                <span className="block font-normal normal-case tracking-normal text-parch-400">
                  {DAY_LABEL[a.dayOfWeek]} · {formatMonthDay(addDays(weekStart, (a.dayOfWeek + 6) % 7))}
                </span>
                {/* F0599/F0600 — per-column bulk marking, in the column header
                    where the prototype had it. Absent when this user may write
                    to nobody, so it is never a control that does nothing. */}
                {!readOnly && (
                  <span className="mt-1 flex items-center justify-center gap-1 print:hidden">
                    <button
                      type="button"
                      onClick={() => setColumn(a.key, 'PRESENT')}
                      title={`Mark every servant present for ${a.label}`}
                      className="rounded-[6px] border border-[#86EFAC] px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[#166534] transition-colors hover:bg-[#F0FDF4]"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumn(a.key, null)}
                      title={`Clear every mark for ${a.label}`}
                      className="rounded-[6px] border border-parch-200 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-parch-600 transition-colors hover:bg-parch-100"
                    >
                      Clear
                    </button>
                  </span>
                )}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {servants.map((s) => (
            <tr key={s.id} className={s.isSelf ? 'bg-brand-wash' : undefined}>
              <Td className={cn('sticky left-0 z-10', s.isSelf ? 'bg-brand-wash' : 'bg-parch-50')}>
                <div className="flex min-w-[9.5rem] items-center gap-2">
                  {canOpenProfiles ? (
                    <Link
                      href={`/portal/admin/servants/${s.accountId}`}
                      className="flex min-w-0 items-center gap-2 rounded-[10px] transition-colors hover:text-brand-800"
                    >
                      <Avatar name={s.name} photo={s.photo} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-[12.5px] font-bold text-parch-900 underline decoration-transparent underline-offset-2 transition-colors hover:decoration-brand-gold">
                          {s.name} {s.isSelf && <Badge tone="brand">you</Badge>}
                        </p>
                        {s.classNames.length > 0 && (
                          <p className="truncate text-[11px] text-parch-500">{s.classNames.join(', ')}</p>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <>
                      <Avatar name={s.name} photo={s.photo} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-[12.5px] font-bold text-parch-900">
                          {s.name} {s.isSelf && <Badge tone="brand">you</Badge>}
                        </p>
                        {s.classNames.length > 0 && (
                          <p className="truncate text-[11px] text-parch-500">{s.classNames.join(', ')}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Td>
              {activities.map((a) => {
                const value = cells[key(s.id, a.key)] ?? null
                const editable = writable.has(s.id)
                return (
                  <Td key={a.key} align="center" className="px-1.5">
                    <button
                      type="button"
                      onClick={() => cycle(s.id, a.key)}
                      disabled={!editable}
                      aria-label={`${s.name} — ${a.label}: ${value ? value.toLowerCase() : 'not recorded'}`}
                      className={cn(
                        'inline-flex h-10 w-10 items-center justify-center rounded-[9px] border text-[13px] font-extrabold transition-colors',
                        value === null ? 'border-parch-200 bg-parch-50 text-parch-400' : CELL_STYLE[value],
                        editable ? 'hover:border-brand-gold/70' : 'cursor-not-allowed opacity-70',
                      )}
                    >
                      {value === 'PRESENT' ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : value === 'EXCUSED' ? (
                        <Minus className="h-4 w-4" aria-hidden />
                      ) : value === 'ABSENT' ? (
                        <X className="h-4 w-4" aria-hidden />
                      ) : (
                        '·'
                      )}
                    </button>
                    {/* Only under an excused cell: the action stores a reason for
                        nothing else, and a note box under "present" would invite
                        one that is silently dropped. Read-only for somebody who
                        cannot write this row, so the reason still explains the
                        week to whoever is only looking. */}
                    {value === 'EXCUSED' &&
                      (editable ? (
                        <input
                          value={reasons[key(s.id, a.key)] ?? ''}
                          onChange={(e) => {
                            const k = key(s.id, a.key)
                            setReasons((r) => ({ ...r, [k]: e.target.value }))
                            setDirty((d) => (d.includes(k) ? d : [...d, k]))
                          }}
                          maxLength={120}
                          placeholder="Reason…"
                          aria-label={`Why ${s.name} was excused from ${a.label}`}
                          data-excuse-reason={`${s.id}|${a.key}`}
                          className="mt-1 w-full min-w-[5.5rem] rounded-[7px] border border-parch-200 bg-parch-50 px-1.5 py-1 text-[10.5px] text-parch-800 placeholder:text-parch-400"
                        />
                      ) : (
                        reasons[key(s.id, a.key)] && (
                          <p className="mt-1 text-[10.5px] leading-tight text-parch-500">
                            {reasons[key(s.id, a.key)]}
                          </p>
                        )
                      ))}
                  </Td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {message && (
        <p
          role="status"
          className={cn('mt-3 text-[12.5px] font-semibold', message.kind === 'ok' ? 'text-[#16A34A]' : 'text-[#DC2626]')}
        >
          {message.text}
        </p>
      )}
    </Card>
  )
}
