'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, Plus } from 'lucide-react'
import { saveSession, deleteSession } from '@/lib/portal/actions/admin'
import { isStandardSession } from '@/lib/portal/sessions'
import { Card, Callout, Field, IconTile, Badge, inputClass, buttonClass, checkboxClass } from '@/components/portal/ui'
import { accentFor } from '@/lib/portal/accents'

// F0190 / F0845 — `icon` is a single glyph stored on AttendanceSession. The
// column has always existed and nothing wrote it, so every session drew the same
// generic tile and an admin scanning the grid read each label to tell them apart.
type Row = { key: string; label: string; points: number; isActive: boolean; icon?: string | null }

export function SessionEditor({ sessions }: { sessions: Row[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<Row[]>(sessions)
  const [fresh, setFresh] = useState<Row>({ key: '', label: '', points: 2, isActive: true, icon: '' })
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function save(row: Row) {
    setMessage(null)
    startTransition(async () => {
      const r = await saveSession(row)
      setMessage(r.ok ? { kind: 'ok', text: `Saved ${row.label}.` } : { kind: 'err', text: r.error })
      if (r.ok && row === fresh) setFresh({ key: '', label: '', points: 2, isActive: true, icon: '' })
      router.refresh()
    })
  }

  // F0669 — the prototype had one "Save Point Values" button. Here every card
  // saved on its own, so an admin re-pointing the six sessions before a term
  // clicked Save six times and, because each click replaced the last message,
  // had no way to tell afterwards which ones had gone through. Only rows that
  // actually changed are sent, so a stray click cannot rewrite the whole table,
  // and a failure names the session it belongs to instead of a bare count.
  const original = new Map(sessions.map((s) => [s.key, s]))
  const dirty = rows.filter((r) => {
    const o = original.get(r.key)
    return !o || o.label !== r.label || o.points !== r.points || o.isActive !== r.isActive || (o.icon ?? '') !== (r.icon ?? '')
  })

  function saveAll() {
    setMessage(null)
    startTransition(async () => {
      const failed: string[] = []
      for (const row of dirty) {
        const r = await saveSession(row)
        if (!r.ok) failed.push(`${row.label || row.key} (${r.error})`)
      }
      setMessage(
        failed.length === 0
          ? { kind: 'ok', text: `Saved ${dirty.length} session${dirty.length === 1 ? '' : 's'}.` }
          : {
              kind: 'err',
              text: `Saved ${dirty.length - failed.length} of ${dirty.length}. Not saved: ${failed.join(' · ')}`,
            },
      )
      router.refresh()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card
          title="Sessions"
          icon={<CalendarCheck className="h-4 w-4" />}
          action={
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={pending || dirty.length === 0}
                className={buttonClass('secondary', 'sm')}
                onClick={saveAll}
              >
                {pending ? 'Saving…' : `Save all (${dirty.length})`}
              </button>
              <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{rows.length}</span>
            </div>
          }
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
                <span className="mx-auto mb-2 block w-fit">
                  <IconTile accent={accentFor(row.key)} size="sm">
                    {row.icon ? (
                      <span aria-hidden className="text-[17px] leading-none">{row.icon}</span>
                    ) : (
                      <CalendarCheck className="h-5 w-5" />
                    )}
                  </IconTile>
                </span>
                <input
                  value={row.icon ?? ''}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, icon: e.target.value } : r)))}
                  className={`${inputClass} mx-auto mb-2 w-[58px] px-2 text-center text-[15px]`}
                  maxLength={4}
                  aria-label={`Icon for ${row.label || row.key}`}
                  placeholder="🕊️"
                  data-session-icon={row.key}
                />
                {/* F0845 — the six standard names are the church's own
                    vocabulary and one of them, 'sunday', is read by name by the
                    follow-up rules, the class stat cards and the QR check-in. A
                    renamed session leaves all three measuring something their
                    label no longer describes, and nobody has a reason to rename
                    them. Points, icon and whether it runs stay editable. */}
                {isStandardSession(row.key) ? (
                  <p className="mb-2 rounded-[8px] border border-dashed border-parch-200 px-2 py-1.5 text-center text-[12px] font-bold text-parch-800">
                    {row.label}
                  </p>
                ) : (
                  <input
                    value={row.label}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                    className={`${inputClass} mb-2 text-center text-[12px] font-bold`}
                    aria-label={`Label for ${row.key}`}
                  />
                )}
                <p className="mb-2.5 truncate text-[10.5px] text-parch-500" title={row.key}>
                  {row.key}
                  {isStandardSession(row.key) && <span className="ml-1 font-bold text-parch-600">· standard</span>}
                </p>
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
                {/* F0670 — the typo an admin could not take back. Offered only
                    for a session they added themselves, and the action refuses
                    the moment a single mark exists against it, so this can never
                    reach into children's history. */}
                {!isStandardSession(row.key) && (
                  <button
                    type="button"
                    disabled={pending}
                    className={`${buttonClass('secondary', 'sm')} mt-2 w-full text-[#991B1B]`}
                    onClick={() => {
                      if (!confirm(`Delete the session "${row.label || row.key}"? This only works while no attendance has ever been taken for it.`)) return
                      setMessage(null)
                      startTransition(async () => {
                        const r = await deleteSession(row.key)
                        if (r.ok) {
                          setRows(rows.filter((x) => x.key !== row.key))
                          setMessage({ kind: 'ok', text: `Deleted ${row.label || row.key}.` })
                        } else {
                          setMessage({ kind: 'err', text: r.error })
                        }
                        router.refresh()
                      })
                    }}
                  >
                    Delete
                  </button>
                )}
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
        <Field label="Icon" htmlFor="new-session-icon" hint="Optional. One emoji, shown on the tile.">
          <input
            id="new-session-icon"
            value={fresh.icon ?? ''}
            onChange={(e) => setFresh({ ...fresh, icon: e.target.value })}
            className={`${inputClass} w-[76px] text-center text-[17px]`}
            maxLength={4}
            placeholder="🕊️"
          />
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
