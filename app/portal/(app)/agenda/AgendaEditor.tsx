'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Eraser, Save } from 'lucide-react'
import { clearAgendaWeek, saveAgendaWeek } from '@/lib/portal/actions/agenda'
import type { ServantOption } from '@/lib/portal/data/agenda'
import { Card, Callout, Field, buttonClass, inputClass, selectClass, textareaClass } from '@/components/portal/ui'
import { formatDateTime } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

interface Row {
  key: string
  label: string
  topic: string
  servantId: string
}

interface Props {
  classId: string
  className: string
  weekStart: string
  weekLabel: string
  servants: ServantOption[]
  initial: {
    slideLink: string
    notes: string
    leadServantId: string
    backupServantId: string
    rows: Row[]
  }
  savedAt: string | null
}

export function AgendaEditor({ classId, className, weekStart, weekLabel, servants, initial, savedAt }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Keyed on the week so navigating to another week resets the form.
  const [formKey, setFormKey] = useState(weekStart)
  const [form, setForm] = useState(initial)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  if (formKey !== weekStart) {
    setFormKey(weekStart)
    setForm(initial)
    setMessage(null)
    setConfirmClear(false)
  }

  const filled = form.rows.filter((r) => r.topic.trim() || r.servantId).length

  function setRow(idx: number, patch: Partial<Row>) {
    const rows = [...form.rows]
    rows[idx] = { ...rows[idx]!, ...patch }
    setForm({ ...form, rows })
  }

  function save() {
    setMessage(null)
    startTransition(async () => {
      const result = await saveAgendaWeek({
        classId,
        weekStart,
        slideLink: form.slideLink.trim() || undefined,
        notes: form.notes.trim() || undefined,
        leadServantId: form.leadServantId || undefined,
        backupServantId: form.backupServantId || undefined,
        items: form.rows.map((r) => ({
          activityKey: r.key,
          topic: r.topic.trim() || undefined,
          servantId: r.servantId || undefined,
        })),
      })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: `Saved the agenda for ${weekLabel}.` })
      router.refresh()
    })
  }

  function clear() {
    startTransition(async () => {
      const result = await clearAgendaWeek({ classId, weekStart })
      setConfirmClear(false)
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setForm({ slideLink: '', notes: '', leadServantId: '', backupServantId: '', rows: form.rows.map((r) => ({ ...r, topic: '', servantId: '' })) })
      setMessage({ kind: 'ok', text: `Cleared ${weekLabel}.` })
      router.refresh()
    })
  }

  const servantSelect = (value: string, onChange: (v: string) => void, label: string, id?: string) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-label={label}>
      <option value="">Unassigned</option>
      {servants.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  )

  return (
    <Card
      tone="brand"
      title={weekLabel}
      icon={<CalendarDays className="h-4 w-4" aria-hidden />}
      action={
        <span
          className={cn(
            'rounded-[10px] px-2.5 py-1 text-[11px] font-bold',
            filled > 0 ? 'bg-brand-wash text-brand-gold-dark' : 'bg-parch-100 text-parch-500',
          )}
        >
          {filled}/10 filled
        </span>
      }
      bodyClassName="p-0"
    >
      {(message || servants.length === 0) && (
        <div className="space-y-2.5 px-[18px] pt-[18px]">
          {message && (
            <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>
              <p role="status">{message.text}</p>
            </Callout>
          )}
          {servants.length === 0 && (
            <Callout tone="warn">
              No servants are on {className} yet, so activities cannot be assigned to anyone.
            </Callout>
          )}
        </div>
      )}

      {/* Week header: lead, backup and the slide link — the prototype's top strip. */}
      <div className="grid gap-x-3 border-b border-[#F0EEE8] px-[18px] pt-[18px] sm:grid-cols-2">
        <Field label="Lead servant" htmlFor="agenda-lead">
          {servantSelect(form.leadServantId, (v) => setForm({ ...form, leadServantId: v }), 'Lead servant', 'agenda-lead')}
        </Field>
        <Field label="Backup servant" htmlFor="agenda-backup">
          {servantSelect(form.backupServantId, (v) => setForm({ ...form, backupServantId: v }), 'Backup servant', 'agenda-backup')}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Slide link" htmlFor="agenda-slides" hint="A http or https address">
            <input
              id="agenda-slides"
              value={form.slideLink}
              onChange={(e) => setForm({ ...form, slideLink: e.target.value })}
              className={inputClass}
              placeholder="https://docs.google.com/presentation/…"
              inputMode="url"
            />
          </Field>
        </div>
      </div>

      {/* The ten activities as one sheet: label · topic · servant, hairline ruled. */}
      <div className="px-[18px] pt-[18px]">
        <div className="overflow-hidden rounded-[14px] border-[1.5px] border-parch-200">
          <div className="hidden bg-[#F3EFE6] px-3.5 py-2.5 sm:grid sm:grid-cols-[1fr_1.4fr_1fr] sm:gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800">Activity</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800">Topic &amp; content</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800">Assigned servant</span>
          </div>
          <ul>
            {form.rows.map((row, idx) => (
              <li
                key={row.key}
                className="grid gap-2 border-b-[0.5px] border-[#F0EEE8] px-3.5 py-2.5 last:border-b-0 sm:grid-cols-[1fr_1.4fr_1fr] sm:items-center sm:gap-2.5"
              >
                <label
                  htmlFor={`topic-${row.key}`}
                  className="text-[12px] font-bold text-[#374151] sm:font-semibold"
                >
                  {row.label}
                </label>
                <input
                  id={`topic-${row.key}`}
                  value={row.topic}
                  onChange={(e) => setRow(idx, { topic: e.target.value })}
                  className={inputClass}
                  placeholder="Topic…"
                  maxLength={200}
                />
                {servantSelect(row.servantId, (v) => setRow(idx, { servantId: v }), `Servant for ${row.label}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-[18px] pt-4">
        <Field label="Notes" htmlFor="agenda-notes">
          <textarea
            id="agenda-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={textareaClass}
            maxLength={4000}
            placeholder="Anything the class needs to remember this week"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EEE8] px-[18px] py-3.5 print:hidden">
        <button type="button" onClick={save} disabled={pending} className={buttonClass('primary')}>
          <Save className="h-4 w-4" aria-hidden /> {pending ? 'Saving…' : 'Save week'}
        </button>
        {confirmClear ? (
          <>
            <button type="button" onClick={clear} disabled={pending} className={buttonClass('danger', 'sm')}>
              Clear this week
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className={buttonClass('ghost', 'sm')}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} disabled={pending} className={buttonClass('ghost', 'sm')}>
            <Eraser className="h-4 w-4" aria-hidden /> Clear
          </button>
        )}
        {savedAt && <span className="text-[11px] text-parch-500">Last saved {formatDateTime(new Date(savedAt))}</span>}
      </div>
    </Card>
  )
}
