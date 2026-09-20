'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Pencil, Trash2, X } from 'lucide-react'
import { createEvent, updateEvent, deleteEvent } from '@/lib/portal/actions/events'
import { Card, Field, inputClass, textareaClass, buttonClass, checkboxClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface ManagedEvent {
  id: string
  title: string
  date: string
  time: string | null
  location: string | null
  link: string | null
  notes: string | null
  targetAll: boolean
  classIds: string[]
}

interface Props {
  /** Classes this user may target. */
  classes: Array<{ id: string; name: string }>
  /** Only admins and pastors may address the whole Sunday School. */
  canTargetAll: boolean
  /** Present when editing an existing event. */
  event?: ManagedEvent
}

const EMPTY = {
  title: '',
  date: '',
  time: '',
  location: '',
  link: '',
  notes: '',
  targetAll: false,
  classIds: [] as string[],
}

export function EventManager({ classes, canTargetAll, event }: Props) {
  const editing = !!event
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState(() =>
    event
      ? {
          title: event.title,
          date: event.date,
          time: event.time ?? '',
          location: event.location ?? '',
          link: event.link ?? '',
          notes: event.notes ?? '',
          targetAll: event.targetAll,
          classIds: event.classIds,
        }
      : { ...EMPTY, classIds: classes.length === 1 ? [classes[0].id] : [] },
  )

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleClass(id: string) {
    setForm((f) => ({
      ...f,
      classIds: f.classIds.includes(id) ? f.classIds.filter((c) => c !== id) : [...f.classIds, id],
    }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const payload = {
      title: form.title,
      date: form.date,
      time: form.time || undefined,
      location: form.location || undefined,
      link: form.link || undefined,
      notes: form.notes || undefined,
      targetAll: form.targetAll,
      classIds: form.targetAll ? [] : form.classIds,
    }
    startTransition(async () => {
      const result = editing ? await updateEvent({ ...payload, eventId: event!.id }) : await createEvent(payload)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      if (!editing) setForm({ ...EMPTY, classIds: classes.length === 1 ? [classes[0].id] : [] })
      router.refresh()
    })
  }

  function remove() {
    setError('')
    startTransition(async () => {
      const result = await deleteEvent(event!.id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  const formBody = (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Event" htmlFor={`ev-title-${event?.id ?? 'new'}`}>
        <input
          id={`ev-title-${event?.id ?? 'new'}`}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className={inputClass}
          maxLength={120}
          required
          placeholder="e.g. Youth retreat"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date" htmlFor={`ev-date-${event?.id ?? 'new'}`}>
          <input id={`ev-date-${event?.id ?? 'new'}`} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Time" htmlFor={`ev-time-${event?.id ?? 'new'}`} hint="Free text">
          <input id={`ev-time-${event?.id ?? 'new'}`} value={form.time} onChange={(e) => set('time', e.target.value)} className={inputClass} maxLength={40} placeholder="6:00 PM" />
        </Field>
        <Field label="Location" htmlFor={`ev-loc-${event?.id ?? 'new'}`}>
          <input id={`ev-loc-${event?.id ?? 'new'}`} value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass} maxLength={160} placeholder="Church hall" />
        </Field>
      </div>

      <Field label="Link" htmlFor={`ev-link-${event?.id ?? 'new'}`} hint="Optional sign-up or details page. Must start with https://">
        <input id={`ev-link-${event?.id ?? 'new'}`} value={form.link} onChange={(e) => set('link', e.target.value)} className={inputClass} maxLength={500} inputMode="url" placeholder="https://…" />
      </Field>

      <Field label="Notes" htmlFor={`ev-notes-${event?.id ?? 'new'}`}>
        <textarea id={`ev-notes-${event?.id ?? 'new'}`} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={textareaClass} rows={3} maxLength={2000} placeholder="What to bring, who to ask…" />
      </Field>

      <fieldset>
        <legend className="mb-1.5 block text-[12px] font-bold text-parch-700">Who is this for?</legend>
        {canTargetAll && (
          <label className="mb-2 flex min-h-[40px] items-center gap-2 text-[12.5px] text-parch-800">
            <input type="checkbox" checked={form.targetAll} onChange={(e) => set('targetAll', e.target.checked)} className={checkboxClass} />
            The whole Sunday School
          </label>
        )}
        {!form.targetAll && (
          <div className="grid gap-1 sm:grid-cols-2">
            {classes.map((c) => (
              <label key={c.id} className="flex min-h-[40px] items-center gap-2 rounded-[10px] px-2 text-[12.5px] text-parch-800 hover:bg-brand-wash">
                <input type="checkbox" checked={form.classIds.includes(c.id)} onChange={() => toggleClass(c.id)} className={checkboxClass} />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {error && <p role="alert" className="text-[12px] font-bold text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !form.title.trim() || !form.date} className={buttonClass('primary')}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Add event'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError('') }} disabled={pending} className={buttonClass('secondary')}>
          <X className="h-4 w-4" aria-hidden /> Cancel
        </button>
      </div>
    </form>
  )

  if (!editing) {
    return open ? (
      <Card title="New event" tone="brand">{formBody}</Card>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className={cn(buttonClass('primary'), 'w-full sm:w-auto')}>
        <CalendarPlus className="h-4 w-4" aria-hidden /> Add event
      </button>
    )
  }

  return (
    <div className="print:hidden">
      {open ? (
        <div className="mt-3 rounded-[12px] border border-parch-200 bg-parch-100/60 p-3.5">{formBody}</div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] px-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-parch-500 transition-colors hover:bg-brand-wash hover:text-brand-800"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </button>
          {confirming ? (
            <>
              <button type="button" disabled={pending} onClick={remove} className="inline-flex min-h-[40px] items-center rounded-[10px] bg-red-700 px-2.5 text-[11px] font-bold text-parch-50 hover:bg-red-800">
                {pending ? 'Deleting…' : 'Delete for good'}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="inline-flex min-h-[40px] items-center rounded-[10px] px-2.5 text-[11px] font-bold text-parch-500 hover:text-brand-800">
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] px-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-parch-500 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          )}
          {error && <p role="alert" className="w-full text-[12px] font-bold text-red-700">{error}</p>}
        </div>
      )}
    </div>
  )
}
