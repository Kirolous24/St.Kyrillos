'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, X } from 'lucide-react'
import { saveReservation } from '@/lib/portal/actions/reservations'
import { Field, InlineNotice, buttonClass, checkboxClass, inputClass, selectClass, textareaClass } from '@/components/portal/ui'
import { weekdayName } from '@/lib/portal/dates'
import {
  MAX_RESERVATION_SERVANTS,
  RESERVATION_NOTE_MAX,
  SERVICE_OTHER,
  formatReservationTime,
  overlaps,
  readReservationTimes,
  reservationDays,
} from '@/lib/portal/reservations'
import { cn } from '@/lib/utils'
import { VanPicture } from './parts'

export interface FormItem {
  id: string
  name: string
  color: string
  details: string | null
  /** A few KB: the browser shrinks every picture before it is saved. */
  photo: string | null
}

/** A reservation not over yet, for the form's "already reserved" line. Times are ISO strings. */
export interface TakenSlot {
  id: string
  itemId: string
  startsAt: string
  endsAt: string
  /** What it is for, and who has it. */
  label: string
}

export interface ReservationFormValues {
  id?: string
  itemId: string
  date: string
  from: string
  until: string
  /** The day it comes back, when that is not `date`; empty for the same day. */
  untilDate: string
  servantIds: string[]
  service: string
  note: string
}

/**
 * Reserving a van, or changing a reservation (2026-11-02). It shows what is
 * already reserved on the van that day and warns of a clash before it is
 * sent; the server checks again under a lock, so two people cannot both win.
 */
export function ReservationForm({
  items,
  servants,
  services,
  taken,
  initial,
  today,
  submitLabel,
}: {
  items: FormItem[]
  servants: Array<{ id: string; name: string }>
  services: string[]
  taken: TakenSlot[]
  initial: ReservationFormValues
  today: string
  submitLabel: string
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [laterDay, setLaterDay] = useState(!!initial.untilDate && initial.untilDate !== initial.date)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const key = initial.id ?? 'new'

  const set = <K extends keyof ReservationFormValues>(k: K, value: ReservationFormValues[K]) => setForm((f) => ({ ...f, [k]: value }))
  const names = useMemo(() => new Map(servants.map((s) => [s.id, s.name])), [servants])
  const slots = useMemo(
    () => taken.filter((t) => t.id !== initial.id).map((t) => ({ ...t, startsAt: new Date(t.startsAt), endsAt: new Date(t.endsAt) })),
    [taken, initial.id],
  )

  const times = readReservationTimes({ date: form.date, from: form.from, until: form.until, untilDate: laterDay ? form.untilDate : '' }, new Date())
  const onVan = slots.filter((s) => s.itemId === form.itemId)
  const thatDay = form.date ? onVan.filter((s) => reservationDays(s).includes(form.date)) : []
  const clash = times.ok ? onVan.find((s) => overlaps(s, times)) : undefined
  const van = items.find((i) => i.id === form.itemId)

  const matches = query.trim()
    ? servants.filter((s) => !form.servantIds.includes(s.id) && s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []

  function addServant(id: string) {
    setForm((f) => (f.servantIds.includes(id) || f.servantIds.length >= MAX_RESERVATION_SERVANTS ? f : { ...f, servantIds: [...f.servantIds, id] }))
    setQuery('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await saveReservation({
        id: form.id,
        itemId: form.itemId,
        date: form.date,
        from: form.from,
        until: form.until,
        untilDate: laterDay ? form.untilDate : undefined,
        servantIds: form.servantIds,
        service: form.service,
        note: form.note,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/portal/reservations?month=${result.data!.month}&saved=${result.data!.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-1" data-testid="reservation-form">
      <fieldset className="mb-3.5">
        <legend className="mb-1.5 text-[12px] font-bold text-parch-700">Van</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <label
              key={item.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[12px] border-[1.5px] px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-brand-gold/40',
                form.itemId === item.id ? 'border-brand-gold bg-brand-wash' : 'border-parch-200 bg-parch-50 hover:border-brand-gold/60',
              )}
            >
              <input type="radio" name={`van-${key}`} value={item.id} checked={form.itemId === item.id} onChange={() => set('itemId', item.id)} className="sr-only" />
              <VanPicture color={item.color} photo={item.photo} size="sm" />
              <span className="min-w-0 flex-1 self-center">
                <span className="block text-[13px] font-bold text-parch-900">{item.name}</span>
                {item.details && <span className="block text-[11.5px] text-parch-500">{item.details}</span>}
              </span>
              {form.itemId === item.id && <Check className="h-5 w-5 shrink-0 self-center text-brand-gold-dark" aria-hidden />}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-x-3 sm:grid-cols-3">
        <Field label="Day" htmlFor={`res-date-${key}`} hint={weekdayName(form.date) ?? undefined}>
          <input
            id={`res-date-${key}`}
            type="date"
            value={form.date}
            min={initial.id ? undefined : today}
            onChange={(e) => set('date', e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="From" htmlFor={`res-from-${key}`}>
          <input id={`res-from-${key}`} type="time" value={form.from} onChange={(e) => set('from', e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Until" htmlFor={`res-until-${key}`}>
          <input id={`res-until-${key}`} type="time" value={form.until} onChange={(e) => set('until', e.target.value)} className={inputClass} required />
        </Field>
      </div>

      <label className="mb-3 flex items-center gap-2 text-[12.5px] text-parch-700">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={laterDay}
          onChange={(e) => {
            setLaterDay(e.target.checked)
            if (e.target.checked && !form.untilDate) set('untilDate', form.date)
          }}
        />
        It comes back on a later day
      </label>
      {laterDay && (
        <Field label="Back on" htmlFor={`res-back-${key}`} hint={weekdayName(form.untilDate) ?? undefined}>
          <input
            id={`res-back-${key}`}
            type="date"
            value={form.untilDate}
            min={form.date || today}
            onChange={(e) => set('untilDate', e.target.value)}
            className={cn(inputClass, 'sm:max-w-[220px]')}
            required
          />
        </Field>
      )}

      {van && form.date && (
        <div className="mb-3.5 rounded-[12px] border border-parch-200 bg-parch-100/60 px-3 py-2.5 text-[12px]" data-testid="van-day">
          {thatDay.length === 0 ? (
            <p className="text-parch-600">
              Nothing else reserved on the {van.name} that day.
            </p>
          ) : (
            <>
              <p className="mb-1 font-bold text-parch-700">Already reserved on the {van.name} that day:</p>
              <ul className="space-y-0.5 text-parch-600">
                {thatDay.map((s) => (
                  <li key={s.id}>
                    {formatReservationTime(s)} · {s.label}
                  </li>
                ))}
              </ul>
            </>
          )}
          {clash && (
            <p className="mt-1.5 font-bold text-[#B91C1C]" role="alert" data-testid="clash">
              Your time clashes with {formatReservationTime(clash)} · {clash.label}. Pick another time or the other van.
            </p>
          )}
        </div>
      )}

      <fieldset className="mb-3.5">
        <legend className="mb-1.5 text-[12px] font-bold text-parch-700">Servants taking it</legend>
        {form.servantIds.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-1.5" data-testid="servants-chosen">
            {form.servantIds.map((id) => (
              <li key={id} className="inline-flex items-center gap-1 rounded-full border border-brand-gold/50 bg-brand-wash py-1 pl-3 pr-1 text-[12.5px] font-semibold text-parch-900">
                {names.get(id) ?? 'A servant'}
                <button
                  type="button"
                  onClick={() => set('servantIds', form.servantIds.filter((s) => s !== id))}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-parch-500 hover:bg-parch-200 hover:text-parch-900"
                  aria-label={`Take ${names.get(id) ?? 'this servant'} off`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-[12px] text-parch-500">Nobody yet. Add at least one servant.</p>
        )}
        {form.servantIds.length < MAX_RESERVATION_SERVANTS && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (matches[0]) addServant(matches[0].id)
              }
            }}
            placeholder="Add a servant: type a name"
            aria-label="Add a servant"
            className={inputClass}
          />
        )}
        {matches.length > 0 && (
          <ul className="mt-1.5 overflow-hidden rounded-[10px] border border-parch-200 bg-parch-50" data-testid="servant-matches">
            {matches.map((s) => (
              <li key={s.id} className="border-b border-[#F0EEE8] last:border-b-0">
                <button type="button" onClick={() => addServant(s.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-parch-900 hover:bg-brand-wash">
                  <Plus className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && matches.length === 0 && <p className="mt-1.5 text-[12px] text-parch-500">No servant by that name.</p>}
      </fieldset>

      <Field label="Service" htmlFor={`res-service-${key}`}>
        <select id={`res-service-${key}`} value={form.service} onChange={(e) => set('service', e.target.value)} className={selectClass} required>
          <option value="" disabled>
            Pick one
          </option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={form.service === SERVICE_OTHER ? 'What it is for' : 'Note (optional)'}
        htmlFor={`res-note-${key}`}
        hint={form.service === SERVICE_OTHER ? 'Say what the van is for.' : 'Where it is going, or anything the next person should know.'}
      >
        <textarea
          id={`res-note-${key}`}
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          className={textareaClass}
          maxLength={RESERVATION_NOTE_MAX}
          required={form.service === SERVICE_OTHER}
        />
      </Field>

      {error && <InlineNotice tone="bad">{error}</InlineNotice>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" className={buttonClass('primary')} disabled={pending || !!clash || form.servantIds.length === 0 || !form.itemId}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        {!times.ok && form.date && form.from && form.until && <span className="text-[12px] font-semibold text-[#B91C1C]">{times.error}</span>}
      </div>
    </form>
  )
}
