'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { Check, Keyboard, ScanLine, SlidersHorizontal, Undo2, X } from 'lucide-react'
import { scanStudent, undoScan } from '@/lib/portal/actions/qr'
import { QrScanner } from '@/components/portal/QrScanner'
import { Card, Field, EmptyState, buttonClass, inputClass, selectClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Mode = 'ATTENDANCE' | 'POINTS'

interface Props {
  classes: Array<{ id: string; name: string }>
  sessions: Array<{ key: string; label: string; points: number }>
  activities: Array<{ id: string; label: string; points: number; classId: string | null }>
}

interface Row {
  key: string
  name: string
  message: string
  tone: 'ok' | 'warn' | 'err'
  undo: { kind: 'ATTENDANCE' | 'POINTS'; id: string } | null
  undone: boolean
  /** The scanned payload and the selection it was recorded under, so an undo can re-arm it. */
  code: string
  signature: string
}

/** The prototype's status colours, used for the scan-result dots. */
const TONE_STYLE: Record<Row['tone'], { tile: string; text: string }> = {
  ok: { tile: 'bg-[#DCFCE7] text-[#16A34A]', text: 'text-parch-800' },
  warn: { tile: 'bg-[#FEF3C7] text-[#B45309]', text: 'text-parch-800' },
  err: { tile: 'bg-[#FEE2E2] text-[#DC2626]', text: 'text-[#B91C1C]' },
}

export function ScanPanel({ classes, sessions, activities }: Props) {
  const [pending, startTransition] = useTransition()
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [mode, setMode] = useState<Mode>('ATTENDANCE')
  const [sessionKey, setSessionKey] = useState(sessions.find((s) => s.key === 'sunday')?.key ?? sessions[0]?.key ?? '')
  const [activityId, setActivityId] = useState(activities[0]?.id ?? '')
  const [manual, setManual] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const busyRef = useRef(false)
  /**
   * Payloads already awarded under the current selection. Marking present is
   * idempotent on the server (@@unique([studentId, date, sessionKey])), but
   * giving points is not: without this, a card left sitting in the camera's
   * view would be awarded the activity again and again.
   */
  const awardedRef = useRef(new Map<string, string>())
  const signatureRef = useRef('')

  const classActivities = activities.filter((a) => a.classId === null || a.classId === classId)

  const pushRow = useCallback((row: Omit<Row, 'key'>) => {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setRows((prev) => [{ ...row, key }, ...prev].slice(0, 40))
  }, [])

  const submitCode = useCallback(
    (code: string) => {
      if (busyRef.current) return
      const signature = `${classId}|${mode}|${mode === 'ATTENDANCE' ? sessionKey : activityId}`
      if (signatureRef.current !== signature) {
        signatureRef.current = signature
        awardedRef.current = new Map()
      }

      const awarded = awardedRef.current.get(code)
      if (awarded !== undefined) {
        pushRow({
          name: awarded,
          message: `${awarded} already got these points — undo first to give them again.`,
          tone: 'warn',
          undo: null,
          undone: false,
          code,
          signature,
        })
        return
      }

      busyRef.current = true
      startTransition(async () => {
        const result = await scanStudent({
          classId,
          code,
          mode,
          sessionKey: mode === 'ATTENDANCE' ? sessionKey : undefined,
          activityId: mode === 'POINTS' ? activityId : undefined,
        })
        if (result.ok && result.data && mode === 'POINTS' && !result.data.already) {
          awardedRef.current.set(code, result.data.name)
        }
        pushRow(
          result.ok && result.data
            ? {
                name: result.data.name,
                message: result.data.message,
                tone: result.data.already ? ('warn' as const) : ('ok' as const),
                undo: result.data.undo,
                undone: false,
                code,
                signature,
              }
            : {
                name: '',
                message: result.ok ? 'Could not record that scan.' : result.error,
                tone: 'err' as const,
                undo: null,
                undone: false,
                code,
                signature,
              },
        )
        busyRef.current = false
      })
    },
    [classId, mode, sessionKey, activityId, pushRow],
  )

  function undo(row: Row) {
    if (!row.undo) return
    const target = row.undo
    startTransition(async () => {
      const result = await undoScan(target)
      if (result.ok && row.signature === signatureRef.current) {
        // The award is gone, so the same card may be scanned again.
        awardedRef.current.delete(row.code)
      }
      setRows((prev) =>
        prev.map((r) =>
          r.key === row.key
            ? result.ok
              ? { ...r, undone: true, message: `${r.name} — undone`, tone: 'warn' as const }
              : { ...r, message: result.error, tone: 'err' as const }
            : r,
        ),
      )
    })
  }

  function submitManual(event: React.FormEvent) {
    event.preventDefault()
    const code = manual.trim()
    if (!code) return
    setManual('')
    submitCode(code)
  }

  const recorded = rows.filter((r) => r.tone === 'ok' && !r.undone).length

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card title="What each scan does" icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}>
          <Field label="Class">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selectClass}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <div className="mb-3.5 flex overflow-hidden rounded-[9px] border border-parch-200">
            {([['ATTENDANCE', 'Mark present'], ['POINTS', 'Give points']] as Array<[Mode, string]>).map(([value, label], i) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  'min-h-[40px] flex-1 px-3 py-2 text-[12px] font-bold transition-colors',
                  i > 0 && 'border-l border-parch-200',
                  mode === value ? 'bg-brand-800 text-brand-gold' : 'bg-parch-50 text-parch-500 hover:text-brand-800',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'ATTENDANCE' ? (
            <Field label="Session" hint="Pick it once — you are not asked again while scanning.">
              <select value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} className={selectClass}>
                {sessions.map((s) => (
                  <option key={s.key} value={s.key}>{s.label} (+{s.points})</option>
                ))}
              </select>
            </Field>
          ) : classActivities.length === 0 ? (
            <p className="text-[12.5px] text-parch-500">This class has no positive-point activity yet.</p>
          ) : (
            <Field label="Activity" hint="Pick it once — you are not asked again while scanning.">
              <select value={activityId} onChange={(e) => setActivityId(e.target.value)} className={selectClass}>
                {classActivities.map((a) => (
                  <option key={a.id} value={a.id}>{a.label} (+{a.points})</option>
                ))}
              </select>
            </Field>
          )}
        </Card>

        <Card title="Camera" icon={<ScanLine className="h-4 w-4" aria-hidden />}>
          <QrScanner onScan={submitCode} paused={pending} />
          <form onSubmit={submitManual} className="mt-4 border-t border-[#F3F0EB] pt-4">
            <Field label="No camera? Type the student's 4-digit ID" htmlFor="manual-id">
              <div className="flex gap-2">
                <input
                  id="manual-id"
                  value={manual}
                  onChange={(e) => setManual(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0421"
                  className={cn(inputClass, 'text-[16px] font-bold tracking-[0.3em]')}
                />
                <button type="submit" disabled={pending || manual.length !== 4} className={cn(buttonClass('primary'), 'shrink-0')}>
                  <Keyboard className="h-4 w-4" aria-hidden /> Record
                </button>
              </div>
            </Field>
          </form>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card title="This session" bodyClassName="p-0">
          {/* the prototype's batch bar: a big burgundy tally over the live list */}
          <div className="flex items-center justify-between gap-3 border-b border-[#F3F0EB] px-[18px] py-3">
            <p className="text-[12px] text-parch-500">
              <span className="text-[18px] font-extrabold text-brand-800 tabular-nums">{recorded}</span> recorded
            </p>
            {rows.length > 0 && <span className="text-[11px] text-parch-500">{rows.length} scan{rows.length === 1 ? '' : 's'}</span>}
          </div>
          <div className="p-[18px]">
            {rows.length === 0 ? (
              <EmptyState title="Nothing scanned yet" hint="Point the camera at a card, or type an ID." />
            ) : (
              <ul className="max-h-[420px] space-y-1.5 overflow-y-auto">
                {rows.map((row) => {
                  const tone = TONE_STYLE[row.tone]
                  return (
                    <li
                      key={row.key}
                      className="flex items-center gap-2.5 rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-2.5 py-2"
                    >
                      <span aria-hidden className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', tone.tile)}>
                        {row.tone === 'err' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 text-[12.5px] font-semibold leading-snug',
                          tone.text,
                          row.undone && 'text-parch-400 line-through',
                        )}
                      >
                        {row.message}
                      </span>
                      {row.undo && !row.undone && (
                        <button
                          type="button"
                          onClick={() => undo(row)}
                          disabled={pending}
                          className="inline-flex shrink-0 items-center gap-1 rounded-[8px] px-1.5 py-1 text-[11px] font-bold text-parch-500 transition-colors hover:text-brand-800"
                        >
                          <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
