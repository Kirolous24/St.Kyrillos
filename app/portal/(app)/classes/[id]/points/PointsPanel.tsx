'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Star, History, Plus, X } from 'lucide-react'
import { givePoints, undoPoints, createActivity, removeActivity } from '@/lib/portal/actions/points'
import { Avatar, buttonClass, inputClass, Card, Field, EmptyState } from '@/components/portal/ui'
import { formatDateTime } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

interface Props {
  classId: string
  students: Array<{ id: string; name: string; total: number; rank: number; photo: string | null }>
  activities: Array<{ id: string; key: string; label: string; points: number; icon: string | null }>
  history: Array<{ id: string; points: number; label: string; reason: string | null; undone: boolean; canUndo: boolean; student: string; by: string; at: string }>
}

/** The prototype's activity-chip accent ramp (actColors). */
const ACT_COLORS = ['#166534', '#9A3412', '#1E3A8A', '#B45309', '#991B1B', '#5B21B6', '#0E7490', '#9D174D']

const MEDAL = ['🥇', '🥈', '🥉']

export function PointsPanel({ classId, students, activities, history }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activityId, setActivityId] = useState<string>(activities[0]?.id ?? 'custom')
  const [customLabel, setCustomLabel] = useState('')
  const [customPoints, setCustomPoints] = useState(2)
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [newActivity, setNewActivity] = useState({ label: '', points: 2, icon: '' })
  const [showAdd, setShowAdd] = useState(false)

  const activity = activities.find((a) => a.id === activityId)
  const label = activity ? activity.label : customLabel
  const magnitude = Math.abs(activity ? activity.points : customPoints)
  const points = mode === 'add' ? magnitude : -magnitude

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    setMessage(null)
    if (selected.size === 0) return setMessage({ kind: 'err', text: 'Select at least one student.' })
    if (!label.trim()) return setMessage({ kind: 'err', text: 'Give the points a name.' })
    if (magnitude === 0) return setMessage({ kind: 'err', text: 'Points cannot be zero.' })
    startTransition(async () => {
      const result = await givePoints({
        classId,
        studentIds: Array.from(selected),
        points,
        activityKey: activity?.key ?? null,
        label: label.trim(),
        reason: reason.trim() || undefined,
      })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: `${points > 0 ? 'Added' : 'Removed'} ${magnitude} point${magnitude === 1 ? '' : 's'} for ${result.data?.count} student${result.data?.count === 1 ? '' : 's'}.` })
      setSelected(new Set())
      setReason('')
      router.refresh()
    })
  }

  function undo(id: string) {
    startTransition(async () => {
      const result = await undoPoints(id)
      setMessage(result.ok ? { kind: 'ok', text: 'Entry undone.' } : { kind: 'err', text: result.error })
      router.refresh()
    })
  }

  function addActivity() {
    if (!newActivity.label.trim()) return
    startTransition(async () => {
      const result = await createActivity({ classId, label: newActivity.label.trim(), points: newActivity.points, icon: newActivity.icon.trim() || undefined })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setNewActivity({ label: '', points: 2, icon: '' })
      setShowAdd(false)
      router.refresh()
    })
  }

  function dropActivity(id: string) {
    startTransition(async () => {
      const result = await removeActivity(id)
      if (!result.ok) setMessage({ kind: 'err', text: result.error })
      if (activityId === id) setActivityId('custom')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3.5">
      {/* ── Activities: the prototype's chip grid ─────────────────────────── */}
      <Card title="Activities" icon={<Star className="h-[15px] w-[15px]" />} action={
        <button type="button" onClick={() => setShowAdd((v) => !v)} className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}>
          {showAdd ? 'Cancel' : '+ New activity'}
        </button>
      }>
        {showAdd && (
          <div className="mb-3.5 rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[72px_1fr_96px]">
              <Field label="Icon" htmlFor="act-icon">
                <input id="act-icon" value={newActivity.icon} onChange={(e) => setNewActivity({ ...newActivity, icon: e.target.value })} className={inputClass} placeholder="⭐" maxLength={4} />
              </Field>
              <Field label="Name" htmlFor="act-label">
                <input id="act-label" value={newActivity.label} onChange={(e) => setNewActivity({ ...newActivity, label: e.target.value })} className={inputClass} placeholder="e.g. Memorized verse" maxLength={60} />
              </Field>
              <Field label="Points" htmlFor="act-points">
                <input id="act-points" type="number" value={newActivity.points} onChange={(e) => setNewActivity({ ...newActivity, points: Number(e.target.value) })} className={inputClass} min={-100} max={100} />
              </Field>
            </div>
            <button type="button" onClick={addActivity} disabled={pending || !newActivity.label.trim()} className={cn(buttonClass('primary', 'sm'), 'min-h-[40px]')}>
              <Plus className="h-[13px] w-[13px]" /> Add activity
            </button>
          </div>
        )}
        {/* repeat(auto-fill,minmax(100px,1fr)), gap 10px */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
          {activities.map((a, i) => {
            const on = a.id === activityId
            return (
              <div
                key={a.id}
                className={cn(
                  'relative rounded-[14px] border-[1.5px] bg-parch-50 p-2.5 pt-3.5 text-center transition-all',
                  on ? 'border-brand-800 shadow-nav-on ring-1 ring-brand-gold/50' : 'border-[#EFE9DC]',
                )}
              >
                <button
                  type="button"
                  onClick={() => dropActivity(a.id)}
                  disabled={pending}
                  aria-label={`Delete ${a.label}`}
                  className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#DC2626] text-parch-50"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={3} />
                </button>
                <button type="button" onClick={() => setActivityId(a.id)} aria-pressed={on} className="block w-full">
                  <span className="mb-1.5 block text-[26px] leading-none">{a.icon || '⭐'}</span>
                  <span className="mb-0.5 block truncate text-[12px] font-bold text-parch-900">{a.label}</span>
                  <span className="block text-[12px] font-extrabold" style={{ color: ACT_COLORS[i % ACT_COLORS.length] }}>
                    {a.points > 0 ? '+' : ''}{a.points}
                  </span>
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setActivityId('custom')}
            aria-pressed={!activity}
            className={cn(
              'grid min-h-[92px] place-items-center rounded-[14px] border-[1.5px] border-dashed bg-brand-wash p-2.5 text-center',
              !activity ? 'border-brand-800 ring-1 ring-brand-gold/50' : 'border-brand-gold',
            )}
          >
            <span>
              <span className="block text-[20px] leading-none text-brand-gold">＋</span>
              <span className="block text-[11px] font-bold text-brand-gold-dark">One-off</span>
            </span>
          </button>
        </div>
        {activities.length === 0 && (
          <p className="pt-2.5 text-center text-[11.5px] text-parch-500">No activities yet — add your first one to start giving points.</p>
        )}
        {!activity && (
          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
            <Field label="One-off reason" htmlFor="custom-label">
              <input id="custom-label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} className={inputClass} placeholder="e.g. Memorized verse" maxLength={80} />
            </Field>
            <Field label="Points" htmlFor="custom-points">
              <input id="custom-points" type="number" min={1} max={100} value={customPoints} onChange={(e) => setCustomPoints(Number(e.target.value))} className={inputClass} />
            </Field>
          </div>
        )}
      </Card>

      {/* ── Leaderboard: the multi-select student grid ────────────────────── */}
      <Card
        title="Class leaderboard"
        icon={<Trophy className="h-[15px] w-[15px]" />}
        action={
          <div className="flex gap-2">
            <button type="button" className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')} onClick={() => setSelected(new Set(students.map((s) => s.id)))}>✓ Select all</button>
            <button type="button" className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')} onClick={() => setSelected(new Set())}>✕ Clear</button>
          </div>
        }
      >
        {students.length === 0 ? (
          <EmptyState title="No students yet" hint="Add students to the class to start giving points." />
        ) : (
          <>
            <p className="mb-2.5 text-[11px] text-parch-500">Tap a card to select it — select several and give them all points for the same activity.</p>
            {/* repeat(auto-fill,minmax(92px,1fr)), gap 10px */}
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(104px,1fr))]">
              {students.map((s) => {
                const on = selected.has(s.id)
                const medal = s.rank <= 3 ? MEDAL[s.rank - 1] : ''
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-pressed={on}
                      className={cn(
                        'relative w-full rounded-[14px] border-[1.5px] bg-parch-50 px-2 py-3 text-center transition-all',
                        on ? 'border-brand-800 ring-2 ring-brand-800' : 'border-[#EFE9DC] hover:border-brand-gold/60',
                      )}
                      style={medal ? { background: 'linear-gradient(180deg,#FFFBEB 0%,#FFFDF8 60%)' } : undefined}
                    >
                      {medal && <span aria-hidden className="absolute left-1.5 top-1.5 text-[12px]">{medal}</span>}
                      <span className="mx-auto mb-1.5 block w-fit">
                        <Avatar name={s.name} photo={s.photo} size="md" />
                      </span>
                      <span className="mb-1.5 block truncate text-[10.5px] font-bold leading-tight text-parch-900" title={s.name}>{s.name}</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-[20px] px-2 py-[3px] text-[10.5px] font-extrabold tabular-nums',
                          s.rank <= 3 ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-parch-100 text-parch-700',
                        )}
                      >
                        {s.total} pts
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>

      {/* ── The give bar, sticky while students are selected ──────────────── */}
      <div className="sticky bottom-0 z-10 rounded-[16px] border border-brand-gold/35 bg-brand-wash p-3 shadow-panel print:hidden">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-[12px] font-bold text-brand-gold-dark">{selected.size} selected</span>
          <div className="flex gap-1 rounded-[8px] bg-parch-50 p-[3px]">
            <button
              type="button"
              onClick={() => setMode('add')}
              aria-pressed={mode === 'add'}
              className={cn('min-h-[40px] rounded-[6px] px-3.5 py-1.5 text-[11px] font-bold', mode === 'add' ? 'bg-brand-800 text-brand-gold' : 'text-parch-500')}
            >
              + Give
            </button>
            <button
              type="button"
              onClick={() => setMode('remove')}
              aria-pressed={mode === 'remove'}
              className={cn('min-h-[40px] rounded-[6px] px-3.5 py-1.5 text-[11px] font-bold', mode === 'remove' ? 'bg-[#DC2626] text-parch-50' : 'text-parch-500')}
            >
              − Remove
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={cn(inputClass, 'min-w-[160px] flex-1')}
            maxLength={200}
            aria-label="Reason (optional)"
            placeholder="Reason (optional) — shown on the student's ledger"
          />
          <button type="button" onClick={submit} disabled={pending} className={cn(buttonClass(mode === 'add' ? 'primary' : 'danger'), 'min-h-[40px] shrink-0')}>
            {pending ? 'Saving…' : `${mode === 'add' ? 'Give' : 'Remove'} ${magnitude} pt${magnitude === 1 ? '' : 's'}`}
          </button>
        </div>
        {message && (
          <p role="status" className={cn('mt-2 text-[12.5px] font-semibold', message.kind === 'ok' ? 'text-[#15803D]' : 'text-[#B91C1C]')}>
            {message.text}
          </p>
        )}
      </div>

      {/* ── History with undo ─────────────────────────────────────────────── */}
      <Card title="Recent activity" icon={<History className="h-[15px] w-[15px]" />}>
        {history.length === 0 ? (
          <p className="text-[12.5px] text-parch-500">No points given yet.</p>
        ) : (
          <ul className="divide-y divide-[#F5F2ED]">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                <span
                  className={cn('w-12 shrink-0 text-right text-[13px] font-extrabold tabular-nums')}
                  style={{ color: h.undone ? '#A9A49B' : h.points >= 0 ? '#16A34A' : '#DC2626', textDecoration: h.undone ? 'line-through' : undefined }}
                >
                  {h.points >= 0 ? '+' : ''}{h.points}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-parch-800', h.undone && 'text-parch-400 line-through')}>
                    <span className="font-bold text-parch-900">{h.student}</span> · {h.label}{h.reason ? ` — ${h.reason}` : ''}
                  </p>
                  <p className="text-[11px] text-parch-500">{formatDateTime(new Date(h.at))} · {h.by}</p>
                </div>
                {h.canUndo && (
                  <button type="button" onClick={() => undo(h.id)} disabled={pending} className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px] shrink-0')}>
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
