'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Pencil, Trash2, Eye, EyeOff, X } from 'lucide-react'
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  setAnnouncementActive,
} from '@/lib/portal/actions/announcements'
import { STAGE_LABEL } from '@/lib/portal/format'
import { Card, Field, inputClass, selectClass, textareaClass, buttonClass, checkboxClass, InlineNotice } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type StageKey = 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'

export interface ManagedAnnouncement {
  id: string
  title: string
  body: string
  emoji: string | null
  date: string | null
  sortOrder: number
  isActive: boolean
  classId: string | null
  stage: StageKey | null
}

interface Props {
  classes: Array<{ id: string; name: string }>
  /** Church-wide and stage-wide belong to admins and pastors. */
  canChurchWide: boolean
  /**
   * F0285 — the one stage a servant who oversees an age group may address.
   * She has no classes of her own, so without this the form has no target at
   * all and she cannot post anything.
   */
  ownStage?: StageKey | null
  announcement?: ManagedAnnouncement
}

const STAGES: StageKey[] = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']

function targetValue(a?: ManagedAnnouncement, fallback = 'all'): string {
  if (!a) return fallback
  if (a.classId) return `class:${a.classId}`
  if (a.stage) return `stage:${a.stage}`
  return 'all'
}

export function AnnouncementManager({ classes, canChurchWide, ownStage = null, announcement }: Props) {
  const editing = !!announcement
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  /**
   * F0506 — sending or deleting an announcement resolved in silence: the form
   * shut and the page refreshed, which looks the same as a form that threw away
   * what you typed. An admin posting "no class this Sunday" posted it twice.
   */
  const [saved, setSaved] = useState('')
  const defaultTarget = canChurchWide
    ? 'all'
    : classes[0]
      ? `class:${classes[0].id}`
      : ownStage
        ? `stage:${ownStage}`
        : 'all'
  const [form, setForm] = useState({
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    emoji: announcement?.emoji ?? '',
    date: announcement?.date ?? '',
    sortOrder: String(announcement?.sortOrder ?? 0),
    isActive: announcement?.isActive ?? true,
    target: targetValue(announcement, defaultTarget),
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function payload() {
    const [kind, value] = form.target.split(':')
    return {
      title: form.title,
      body: form.body,
      emoji: form.emoji || undefined,
      date: form.date || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      classId: kind === 'class' ? value : '',
      stage: (kind === 'stage' ? value : '') as StageKey | '',
      isActive: form.isActive,
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved('')
    startTransition(async () => {
      const result = editing
        ? await updateAnnouncement({ ...payload(), announcementId: announcement!.id })
        : await createAnnouncement(payload())
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setSaved(editing ? 'Changes saved.' : 'Announcement sent.')
      if (!editing) {
        setForm({ title: '', body: '', emoji: '', date: '', sortOrder: '0', isActive: true, target: defaultTarget })
      }
      router.refresh()
    })
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    setError('')
    setSaved('')
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) setError(result.error ?? 'Something went wrong.')
      else {
        setConfirming(false)
        if (done) setSaved(done)
      }
      router.refresh()
    })
  }

  const id = announcement?.id ?? 'new'
  const formBody = (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <Field label="Emoji" htmlFor={`an-emoji-${id}`}>
          <input id={`an-emoji-${id}`} value={form.emoji} onChange={(e) => set('emoji', e.target.value)} className={inputClass} maxLength={8} placeholder="📣" />
        </Field>
        <Field label="Title" htmlFor={`an-title-${id}`}>
          <input id={`an-title-${id}`} value={form.title} onChange={(e) => set('title', e.target.value)} className={inputClass} maxLength={140} required placeholder="e.g. No Sunday School next week" />
        </Field>
      </div>

      <Field label="Announcement" htmlFor={`an-body-${id}`}>
        {/* F0655 — no `required`: "No class this Sunday" is a complete
            announcement, and the title already says it. */}
        <textarea id={`an-body-${id}`} value={form.body} onChange={(e) => set('body', e.target.value)} className={textareaClass} rows={4} maxLength={4000} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Who sees it" htmlFor={`an-target-${id}`}>
          <select id={`an-target-${id}`} value={form.target} onChange={(e) => set('target', e.target.value)} className={selectClass}>
            {canChurchWide && <option value="all">Everyone (church-wide)</option>}
            {canChurchWide &&
              STAGES.map((s) => (
                <option key={s} value={`stage:${s}`}>All {STAGE_LABEL[s]}</option>
              ))}
            {/* F0285 — her own stage, and nothing wider. */}
            {!canChurchWide && ownStage && (
              <option value={`stage:${ownStage}`}>All {STAGE_LABEL[ownStage]}</option>
            )}
            {classes.map((c) => (
              <option key={c.id} value={`class:${c.id}`}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor={`an-date-${id}`} hint="Optional">
          <input id={`an-date-${id}`} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Order" htmlFor={`an-order-${id}`} hint="Lower shows first">
          <input id={`an-order-${id}`} type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} className={inputClass} min={-999} max={999} />
        </Field>
      </div>

      <label className="flex min-h-[40px] items-center gap-2 text-[12.5px] text-parch-800">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className={checkboxClass} />
        Show it now
      </label>

      {error && <p role="alert" className="text-[12px] font-bold text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !form.title.trim()} className={buttonClass('primary')}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Post announcement'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError('') }} disabled={pending} className={buttonClass('secondary')}>
          <X className="h-4 w-4" aria-hidden /> Cancel
        </button>
      </div>
    </form>
  )

  if (!editing) {
    return open ? (
      <Card title="New announcement" tone="brand">{formBody}</Card>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setSaved(''); setOpen(true) }}
          className={cn(buttonClass('primary'), 'w-full sm:w-auto')}
        >
          <Megaphone className="h-4 w-4" aria-hidden /> New announcement
        </button>
        {/* F0506 — the form used to shut and the page refresh, which looks the
            same as a form that threw away what you typed. Cleared when the
            composer is reopened, so it can never read as a second send. */}
        {saved && <InlineNotice>{saved}</InlineNotice>}
      </div>
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
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => setAnnouncementActive({ announcementId: announcement!.id, isActive: !announcement!.isActive }),
                announcement!.isActive ? 'Hidden from the portal.' : 'Showing in the portal.',
              )
            }
            className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] px-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-parch-500 transition-colors hover:bg-brand-wash hover:text-brand-800"
          >
            {announcement!.isActive ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            {announcement!.isActive ? 'Hide' : 'Show'}
          </button>
          {confirming ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => deleteAnnouncement(announcement!.id), 'Deleted.')} className="inline-flex min-h-[40px] items-center rounded-[10px] bg-red-700 px-2.5 text-[11px] font-bold text-parch-50 hover:bg-red-800">
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
          {/* F0506 — says what happened. Sits beside the controls rather than
              floating: a notice that fades on a timer has told nobody anything
              if they looked away, and it survives the router.refresh() above. */}
          {saved && <InlineNotice className="w-full">{saved}</InlineNotice>}
        </div>
      )}
    </div>
  )
}
