'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shuffle } from 'lucide-react'
import { planScheduleRotation, saveScheduleRotation, type RotationPreview } from '@/lib/portal/actions/rotation'
import { ROTATION_ROLES, rotationRoleShort, type RotationRole } from '@/lib/portal/rotation'
import { ScheduleGrid, gridKey, type GridCell } from '@/components/portal/ScheduleGrid'
import { Card, Callout, Field, buttonClass, checkboxClass, inputClass } from '@/components/portal/ui'
import { addDays } from '@/lib/portal/dates'
import { formatShortDate } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

const chip = (on: boolean) =>
  cn(
    'min-h-[36px] rounded-[10px] px-3 py-1.5 text-[12px] font-bold transition-colors',
    on
      ? 'bg-brand-wash text-brand-800 ring-1 ring-brand-gold/60'
      : 'border border-parch-200 bg-parch-50 text-parch-500 hover:border-brand-gold/50 hover:text-brand-800',
  )

const toggle = <T,>(list: readonly T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

/**
 * Fill a stretch of Sundays at once (2026-11-01): "randomly and evenly …
 * without repeating assignments until every servant has been able to do it
 * once". The coordinator picks the Sundays, the parts and who takes turns,
 * looks the rotation over, and saves it, or makes another.
 */
export function RotationPanel({
  classId,
  className,
  from,
  to,
  servants,
  defaultRoles,
}: {
  classId: string
  className: string
  /** The first and last Sunday offered: the span on screen, from the coming Sunday. */
  from: string
  to: string
  /** The class's own servants, who take turns unless unticked. */
  servants: Array<{ id: string; name: string }>
  defaultRoles: RotationRole[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [first, setFirst] = useState(from)
  const [last, setLast] = useState(to)
  const [roles, setRoles] = useState<RotationRole[]>(defaultRoles)
  const [picked, setPicked] = useState<string[]>(servants.map((s) => s.id))
  const [keep, setKeep] = useState(true)
  const [preview, setPreview] = useState<RotationPreview | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  /** Any change to the choices makes the rotation on screen out of date. */
  function changed() {
    setPreview(null)
    setMessage(null)
  }

  function make() {
    setMessage(null)
    startTransition(async () => {
      const ordered = ROTATION_ROLES.map((r) => r.key).filter((k) => roles.includes(k))
      const r = await planScheduleRotation({ classId, from: first, to: last, roles: ordered, servantIds: picked, keepExisting: keep })
      if (!r.ok) {
        setPreview(null)
        return setMessage({ kind: 'err', text: r.error })
      }
      setPreview(r.data!)
    })
  }

  function save() {
    if (!preview) return
    setMessage(null)
    startTransition(async () => {
      const r = await saveScheduleRotation({ classId, from: first, to: last, keepExisting: keep, cells: preview.cells })
      if (!r.ok) return setMessage({ kind: 'err', text: r.error })
      const { saved, kept, weeks } = r.data!
      setPreview(null)
      setMessage({
        kind: 'ok',
        text: `Saved ${saved} part${saved === 1 ? '' : 's'} over ${weeks} Sunday${weeks === 1 ? '' : 's'}. Each servant is told a week before each of their Sundays, or now for this coming week.${
          kept > 0 ? ` ${kept} part${kept === 1 ? ' was' : 's were'} filled by someone in the meantime and left as ${kept === 1 ? 'it was' : 'they were'}.` : ''
        }`,
      })
      router.refresh()
    })
  }

  if (servants.length === 0) {
    return (
      <Card title="Assign by rotation" icon={<Shuffle className="h-4 w-4" aria-hidden />} className="mb-5">
        <p className="text-[12.5px] text-parch-600">No servants are on {className} yet, so there is nobody to take turns.</p>
      </Card>
    )
  }

  const shownRoles = preview
    ? ROTATION_ROLES.map((r) => r.key).filter((k) => preview.roles.includes(k) || preview.kept.some((c) => c.role === k))
    : []
  const cells: Record<string, GridCell> = {}
  const count = new Map<string, number>()
  if (preview) {
    const chosen = new Set<string>(preview.roles)
    for (const c of preview.kept) {
      cells[gridKey(c.weekStart, c.role)] = { name: preview.names[c.servantId] ?? 'Unknown' }
      if (chosen.has(c.role)) count.set(c.servantId, (count.get(c.servantId) ?? 0) + 1)
    }
    for (const c of preview.cells) {
      cells[gridKey(c.weekStart, c.role)] = { name: preview.names[c.servantId] ?? 'Unknown', tone: 'new' }
      count.set(c.servantId, (count.get(c.servantId) ?? 0) + 1)
    }
  }
  const sundays = preview ? preview.weeks.map((w) => addDays(w, 6)) : []

  return (
    <Card title="Assign by rotation" icon={<Shuffle className="h-4 w-4" aria-hidden />} className="mb-5" bodyClassName="space-y-4 p-[18px]">
      <div data-testid="rotation-panel" className="space-y-4">
        <p className="text-[12.5px] text-parch-600">
          Fill a month or a semester at once. Everyone takes turns: nobody gets a part again until every servant ticked below has had it, and
          each Sunday&rsquo;s parts are shared out evenly. Nothing is saved until you look it over.
        </p>

        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label="First Sunday" htmlFor="rotation-from">
            <input id="rotation-from" type="date" value={first} onChange={(e) => { setFirst(e.target.value); changed() }} className={inputClass} />
          </Field>
          <Field label="Last Sunday" htmlFor="rotation-to">
            <input id="rotation-to" type="date" value={last} onChange={(e) => { setLast(e.target.value); changed() }} className={inputClass} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-bold text-parch-700">Parts to fill</legend>
          <div className="flex flex-wrap gap-1.5">
            {ROTATION_ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={roles.includes(r.key)}
                data-rotation-role={r.key}
                onClick={() => { setRoles(toggle(roles, r.key)); changed() }}
                className={chip(roles.includes(r.key))}
              >
                {roles.includes(r.key) ? '✓ ' : '+ '}
                {rotationRoleShort(r.key)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-bold text-parch-700">Who takes turns</legend>
          <div className="flex flex-wrap gap-1.5">
            {servants.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={picked.includes(s.id)}
                data-rotation-servant={s.id}
                onClick={() => { setPicked(toggle(picked, s.id)); changed() }}
                className={chip(picked.includes(s.id))}
              >
                {picked.includes(s.id) ? '✓ ' : '+ '}
                {s.name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-2 text-[12.5px] text-parch-700">
          <input type="checkbox" checked={keep} onChange={(e) => { setKeep(e.target.checked); changed() }} className={cn(checkboxClass, 'mt-0.5')} />
          <span>
            Keep parts that already have someone
            <span className="block text-[11px] text-parch-500">Untick to redo those Sundays from scratch. Topics always stay.</span>
          </span>
        </label>

        {message && (
          <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>
            <p role="status">{message.text}</p>
          </Callout>
        )}

        {!preview && (
          <button type="button" onClick={make} disabled={pending || roles.length === 0 || picked.length === 0} className={buttonClass('primary')}>
            <Shuffle className="h-4 w-4" aria-hidden /> {pending ? 'Making it…' : 'Make the rotation'}
          </button>
        )}

        {preview && (
          <div className="space-y-3" data-testid="rotation-preview-block">
            <div>
              <p className="text-[13px] font-bold text-parch-900">
                Not saved yet: {sundays.length} Sunday{sundays.length === 1 ? '' : 's'}, {formatShortDate(sundays[0]!)} – {formatShortDate(sundays[sundays.length - 1]!)}
              </p>
              <p className="text-[11.5px] text-parch-500">
                New parts are highlighted. {preview.clipped ? 'Today’s and past Sundays are left as they are. ' : ''}
                {preview.cells.length === 0 ? 'Every part is already taken, so there is nothing to fill.' : ''}
              </p>
            </div>
            {preview.repeats > 0 && (
              <Callout tone="warn">
                {preview.repeats} part{preview.repeats === 1 ? ' goes' : 's go'} to someone again before everyone has had {preview.repeats === 1 ? 'it' : 'them'}: nobody else
                was free those Sundays.
              </Callout>
            )}
            <ScheduleGrid rows={preview.weeks.map((w) => ({ weekStart: w, sunday: addDays(w, 6) }))} roles={shownRoles} cells={cells} testId="rotation-preview" />
            <ul className="flex flex-wrap gap-1.5" aria-label="Parts each servant would have">
              {servants
                .filter((s) => picked.includes(s.id))
                .map((s) => (
                  <li key={s.id} className="rounded-[10px] border border-parch-200 bg-parch-50 px-2.5 py-1 text-[11.5px] text-parch-700">
                    <span className="font-bold text-parch-900">{s.name}</span> · {count.get(s.id) ?? 0} part{(count.get(s.id) ?? 0) === 1 ? '' : 's'}
                  </li>
                ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={save} disabled={pending || preview.cells.length === 0} className={buttonClass('primary')}>
                {pending ? 'Saving…' : `Save ${preview.cells.length} part${preview.cells.length === 1 ? '' : 's'}`}
              </button>
              <button type="button" onClick={make} disabled={pending} className={buttonClass('secondary')}>
                <Shuffle className="h-4 w-4" aria-hidden /> Shuffle again
              </button>
              <button type="button" onClick={() => setPreview(null)} disabled={pending} className={buttonClass('ghost')}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
