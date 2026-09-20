'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, Plus } from 'lucide-react'
import { saveSession } from '@/lib/portal/actions/admin'
import { Card, Callout, Field, IconTile, Badge, inputClass, buttonClass, checkboxClass } from '@/components/portal/ui'
import { accentFor } from '@/lib/portal/accents'

type Row = { key: string; label: string; points: number; isActive: boolean }

export function SessionEditor({ sessions }: { sessions: Row[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<Row[]>(sessions)
  const [fresh, setFresh] = useState<Row>({ key: '', label: '', points: 2, isActive: true })
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function save(row: Row) {
    setMessage(null)
    startTransition(async () => {
      const r = await saveSession(row)
      setMessage(r.ok ? { kind: 'ok', text: `Saved ${row.label}.` } : { kind: 'err', text: r.error })
      if (r.ok && row === fresh) setFresh({ key: '', label: '', points: 2, isActive: true })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card
          title="Sessions"
          icon={<CalendarCheck className="h-4 w-4" />}
          action={<span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{rows.length}</span>}
        >
          {message && (
            <div role="status" className="mb-4">
              <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>{message.text}</Callout>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row, i) => (
              <div
                key={row.key}
                className={`rounded-[12px] border border-parch-200 bg-parch-100 p-3.5 text-center transition-opacity ${row.isActive ? '' : 'opacity-60'}`}
              >
                <span className="mx-auto mb-2.5 block w-fit">
                  <IconTile accent={accentFor(row.key)} size="sm">
                    <CalendarCheck className="h-5 w-5" />
                  </IconTile>
                </span>
                <input
                  value={row.label}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                  className={`${inputClass} mb-2 text-center text-[12px] font-bold`}
                  aria-label={`Label for ${row.key}`}
                />
                <p className="mb-2.5 truncate text-[10.5px] text-parch-500" title={row.key}>{row.key}</p>
                <div className="mb-2.5 flex items-center justify-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.points}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, points: Number(e.target.value) } : r)))}
                    className={`${inputClass} w-[68px] px-2 text-center text-[13px] font-bold`}
                    aria-label={`Points for ${row.label || row.key}`}
                  />
                  <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">pts</span>
                </div>
                <label className="mb-3 flex items-center justify-center gap-2 text-[12px] font-semibold text-parch-700">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, isActive: e.target.checked } : r)))}
                    className={checkboxClass}
                    aria-label={`Active — ${row.label || row.key}`}
                  />
                  {row.isActive ? 'Active' : 'Hidden'}
                </label>
                <button type="button" disabled={pending} className={`${buttonClass('secondary', 'sm')} w-full`} onClick={() => save(row)}>
                  {pending ? 'Saving…' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Add a session" icon={<Plus className="h-4 w-4" />} className="lg:sticky lg:top-4 lg:self-start">
        <Field label="Name" htmlFor="new-session-label" hint="The key is filled in for you.">
          <input
            id="new-session-label"
            value={fresh.label}
            onChange={(e) =>
              setFresh({
                ...fresh,
                label: e.target.value,
                key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
              })
            }
            className={inputClass}
            placeholder="e.g. Youth Meeting"
          />
        </Field>
        <Field label="Key" htmlFor="new-session-key">
          <input id="new-session-key" value={fresh.key} onChange={(e) => setFresh({ ...fresh, key: e.target.value })} className={inputClass} placeholder="key" />
        </Field>
        <Field label="Points" htmlFor="new-session-points">
          <input
            id="new-session-points"
            type="number"
            min={0}
            max={100}
            value={fresh.points}
            onChange={(e) => setFresh({ ...fresh, points: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <div className="mb-3.5">
          <Badge tone="gold">Worth {fresh.points} pts</Badge>
        </div>
        <button
          type="button"
          disabled={pending || !fresh.key || !fresh.label}
          className={`${buttonClass('primary')} w-full`}
          onClick={() => save(fresh)}
        >
          Add session
        </button>
      </Card>
    </div>
  )
}
