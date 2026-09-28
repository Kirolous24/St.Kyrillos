'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, Star, Trash2 } from 'lucide-react'
import { createActivity, removeActivity, updateActivity } from '@/lib/portal/actions/points'
import { ACTIVITY_POINTS_MAX, ACTIVITY_POINTS_MIN, DEDUCTION_POINTS } from '@/lib/portal/points-math'
import { Card, Callout, Field, buttonClass, inputClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

export interface ActivityRow {
  id: string
  label: string
  points: number
  icon: string | null
}

/** The prototype's twenty-four activity icons (F0181), so nobody has to hunt for an emoji keyboard. */
const ICONS = ['📖', '🙏', '✝️', '⛪', '🕊️', '📿', '🎵', '🎤', '🎶', '🕯️', '✅', '⭐', '🌟', '✨', '🏆', '🎯', '🤝', '👏', '💪', '📝', '🧠', '❤️', '🎁', '😇']

/**
 * A list of point activities to add to, rename, revalue or remove.
 *
 * - With no `forClass`, it is the church-wide list every class gives from; only
 *   the admin edits it, in Sessions & Points.
 * - With `forClass`, it is that class's own activities, at its own values
 *   (2026-09-28), edited by the class's servants on its Points page.
 */
export function ActivityEditor({
  activities,
  forClass = null,
}: {
  activities: ActivityRow[]
  forClass?: { id: string; name: string } | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState(activities)
  const [draft, setDraft] = useState({ label: '', points: 2, icon: '' })
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')

  function set(id: string, patch: Partial<ActivityRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function run(action: () => ReturnType<typeof createActivity>, after?: () => void) {
    setError('')
    setSaved(null)
    startTransition(async () => {
      const r = await action()
      if (!r.ok) return setError(r.error)
      after?.()
      router.refresh()
    })
  }

  // The server re-reads the list after every change; keep the rows in step.
  if (activities.map((a) => a.id).join() !== rows.map((r) => r.id).join()) setRows(activities)

  return (
    <Card
      title={forClass ? `Class activities · ${forClass.name}` : 'Point activities (every class)'}
      icon={<Star className="h-4 w-4" aria-hidden />}
      className="mt-4"
    >
      <p className="mb-3.5 text-[12.5px] text-parch-600">
        {forClass
          ? `Only ${forClass.name} sees these, next to the activities every class has. You choose what each is worth.`
          : 'Every class sees these activities at these values. A class can add its own on its Points page.'}{' '}
        Taking points away always costs {DEDUCTION_POINTS}. A change applies from now on; points already given keep their
        value.
      </p>

      {error && <div className="mb-3" role="alert"><Callout tone="bad">{error}</Callout></div>}

      {rows.length === 0 ? (
        <p className="mb-3 text-[12.5px] text-parch-500">No activities yet. Add the first one below.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-end gap-2.5 rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2.5">
              <label className="w-16">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Icon</span>
                <input value={r.icon ?? ''} onChange={(e) => set(r.id, { icon: e.target.value })} className={cn(inputClass, 'text-center')} maxLength={8} placeholder="⭐" aria-label={`Icon for ${r.label}`} />
              </label>
              <label className="min-w-[10rem] flex-1">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Name</span>
                <input value={r.label} onChange={(e) => set(r.id, { label: e.target.value })} className={inputClass} maxLength={60} aria-label={`Name of ${r.label}`} />
              </label>
              <label className="w-24">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Points</span>
                <input
                  type="number"
                  min={ACTIVITY_POINTS_MIN}
                  max={ACTIVITY_POINTS_MAX}
                  value={r.points}
                  onChange={(e) => set(r.id, { points: Number(e.target.value) })}
                  className={inputClass}
                  aria-label={`Points for ${r.label}`}
                />
              </label>
              <button
                type="button"
                disabled={pending || !r.label.trim()}
                onClick={() => run(() => updateActivity({ activityId: r.id, label: r.label.trim(), points: r.points, icon: r.icon?.trim() || undefined }), () => setSaved(r.id))}
                className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
              >
                {saved === r.id ? <><Check className="h-3.5 w-3.5" aria-hidden /> Saved</> : 'Save'}
              </button>
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove ${r.label}`}
                onClick={() => {
                  if (!window.confirm(`Remove "${r.label}" from ${forClass ? forClass.name : 'every class'}? Points already given for it stay.`)) return
                  run(() => removeActivity(r.id))
                }}
                className={cn(buttonClass('ghost', 'sm'), 'min-h-[40px] text-[#B91C1C]')}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Add an activity</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[72px_1fr_96px]">
          <Field label="Icon" htmlFor="new-act-icon">
            <input id="new-act-icon" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} className={cn(inputClass, 'text-center text-[20px]')} placeholder="⭐" maxLength={8} />
          </Field>
          <Field label="Name" htmlFor="new-act-label">
            <input id="new-act-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className={inputClass} placeholder="e.g. Memorized verse" maxLength={60} />
          </Field>
          <Field label="Points" htmlFor="new-act-points">
            <input id="new-act-points" type="number" min={ACTIVITY_POINTS_MIN} max={ACTIVITY_POINTS_MAX} value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} className={inputClass} />
          </Field>
        </div>
        <div className="mb-3 mt-1 grid grid-cols-8 gap-1 sm:grid-cols-12">
          {ICONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setDraft({ ...draft, icon: emoji })}
              aria-pressed={draft.icon === emoji}
              aria-label={`Use ${emoji} as the icon`}
              className={cn(
                'grid h-9 place-items-center rounded-[8px] border text-[17px] leading-none transition-colors',
                draft.icon === emoji ? 'border-brand-800 bg-parch-50 ring-1 ring-brand-gold/50' : 'border-transparent hover:bg-parch-50',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={pending || !draft.label.trim()}
          onClick={() =>
            run(
              () =>
                createActivity({
                  ...(forClass ? { classId: forClass.id } : {}),
                  label: draft.label.trim(),
                  points: draft.points,
                  icon: draft.icon.trim() || undefined,
                }),
              () => setDraft({ label: '', points: 2, icon: '' }),
            )
          }
          className={cn(buttonClass('primary', 'sm'), 'min-h-[40px]')}
        >
          <Plus className="h-[13px] w-[13px]" aria-hidden /> Add activity
        </button>
      </div>
    </Card>
  )
}
