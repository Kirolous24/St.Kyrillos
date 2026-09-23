'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Star, History, Plus, X, Search, Pencil, Eye } from 'lucide-react'
import { givePoints, undoPoints, createActivity, removeActivity, updateActivity } from '@/lib/portal/actions/points'
import { Avatar, buttonClass, inputClass, selectClass, Card, Field, EmptyState } from '@/components/portal/ui'
import { formatDateTime } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

interface Props {
  classId: string
  students: Array<{ id: string; name: string; total: number; rank: number; photo: string | null }>
  activities: Array<{ id: string; key: string; label: string; points: number; icon: string | null }>
  history: Array<{
    id: string
    points: number
    label: string
    reason: string | null
    /** PointEntry.source — the prototype's Type column. */
    source: 'ATTENDANCE' | 'MANUAL' | 'QUIZ' | 'UNDO' | 'QR'
    undone: boolean
    canUndo: boolean
    student: string
    by: string
    at: string
  }>
}

/** The prototype's activity-chip accent ramp (actColors). */
const ACT_COLORS = ['#166534', '#9A3412', '#1E3A8A', '#B45309', '#991B1B', '#5B21B6', '#0E7490', '#9D174D']

const MEDAL = ['🥇', '🥈', '🥉']

/**
 * Where an entry came from — the prototype's Type column. Without it a servant
 * reading the ledger cannot tell a quiz score from a hand-given point, which is
 * exactly the question that comes up when a total looks wrong.
 */
const SOURCE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Attendance',
  MANUAL: 'Given',
  QUIZ: 'Quiz',
  UNDO: 'Undo',
  QR: 'QR scan',
}

/** Points history controls, restored from the prototype's Points > History tab. */
const HIST_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'added', label: 'Added points' },
  { key: 'removed', label: 'Removed points' },
] as const
const HIST_GROUPS = [
  { key: 'flat', label: 'Flat' },
  { key: 'student', label: 'By student' },
  { key: 'date', label: 'By date' },
  { key: 'by', label: 'By servant' },
] as const
type HistFilter = (typeof HIST_FILTERS)[number]['key']
type HistGroup = (typeof HIST_GROUPS)[number]['key']

const DAY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
})

/**
 * The prototype's ten canned reasons for taking points away, verbatim, plus its
 * "Other" escape hatch. These records document a child's behaviour, so the OG
 * refused to submit without one; the port made the field optional free text and
 * the ledger filled with blank and inconsistent entries.
 */
const REMOVE_REASONS = [
  'Misbehaving',
  'Being late',
  'Distracting others',
  'Talking at the wrong time',
  'Being disrespectful',
  'Using a phone when not allowed',
  'Not respecting prayer time',
  'Not following instructions',
  'Disrupting the class',
  'Breaking class rules',
] as const

export function PointsPanel({ classId, students, activities, history }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activityId, setActivityId] = useState<string>(activities[0]?.id ?? 'custom')
  const [customLabel, setCustomLabel] = useState('')
  const [customPoints, setCustomPoints] = useState(2)
  /**
   * F0415 — Remove mode had no amount of its own, so `magnitude` fell through to
   * whichever activity was still selected from Add mode: a servant who had just
   * given "Memory verse (5)" and switched to Remove was about to take away five
   * points, with nothing on screen saying so. The prototype gave Remove its own
   * field. Defaults to 1, the smallest correction.
   */
  const [removeAmount, setRemoveAmount] = useState(1)
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [histQuery, setHistQuery] = useState('')
  const [histFilter, setHistFilter] = useState<HistFilter>('all')
  const [histGroup, setHistGroup] = useState<HistGroup>('flat')
  // Editing an activity, which the port could only create and delete. Deleting
  // and recreating orphans the label already written onto past point entries.
  const [editing, setEditing] = useState<{ id: string; label: string; points: number; icon: string } | null>(null)
  /**
   * F0179 / F0410 — the prototype let a servant reorder the leaderboard A-Z,
   * highest or lowest. Fixed on rank, the grid answers "who is winning?" and
   * nothing else: finding one child by name in a class of thirty meant reading
   * every tile, and "who has fallen behind?" — the question that actually leads
   * to a phone call — could not be asked at all.
   *
   * The rank badge and the medals stay tied to the child's real standing, not to
   * their position in the list, so reordering never changes what a card claims.
   */
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'lowest'>('rank')
  const sortedStudents = useMemo(() => {
    const rows = [...students]
    if (sortBy === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'lowest') return rows.sort((a, b) => a.total - b.total || a.name.localeCompare(b.name))
    return rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
  }, [students, sortBy])

  /**
   * The prototype's history tab could be searched, filtered to added/removed
   * and grouped four ways with a net-points subtotal per group. The port
   * shipped a flat, unsearchable "Recent activity" list; with a class's whole
   * term of points in it, finding one entry meant scrolling.
   */
  const histGroups = useMemo(() => {
    const needle = histQuery.trim().toLowerCase()
    const rows = history.filter((h) => {
      if (histFilter === 'added' && h.points < 0) return false
      if (histFilter === 'removed' && h.points >= 0) return false
      if (!needle) return true
      return (
        h.student.toLowerCase().includes(needle) ||
        h.label.toLowerCase().includes(needle) ||
        (SOURCE_LABEL[h.source] ?? '').toLowerCase().includes(needle) ||
        (h.reason ?? '').toLowerCase().includes(needle) ||
        h.by.toLowerCase().includes(needle)
      )
    })
    if (histGroup === 'flat') return [{ key: 'all', title: null as string | null, rows }]
    const keyOf = (h: (typeof history)[number]) =>
      histGroup === 'student' ? h.student : histGroup === 'by' ? h.by : DAY_FMT.format(new Date(h.at))
    const buckets = new Map<string, typeof rows>()
    for (const h of rows) {
      const k = keyOf(h)
      const list = buckets.get(k) ?? []
      list.push(h)
      buckets.set(k, list)
    }
    return Array.from(buckets.entries()).map(([key, rows]) => ({ key, title: key, rows }))
  }, [history, histQuery, histFilter, histGroup])

  const histShown = histGroups.reduce((n, g) => n + g.rows.length, 0)
  const [reason, setReason] = useState('')
  // '' = nothing picked yet, 'other' = type your own into `reason`.
  const [removeReason, setRemoveReason] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [newActivity, setNewActivity] = useState({ label: '', points: 2, icon: '' })
  const [showAdd, setShowAdd] = useState(false)

  const activity = activities.find((a) => a.id === activityId)
  const label = activity ? activity.label : customLabel
  // Remove reads its own field; Add reads the activity, or the custom amount
  // when no activity is chosen. They must not borrow each other's number.
  const magnitude =
    mode === 'remove' ? Math.abs(removeAmount || 0) : Math.abs(activity ? activity.points : customPoints)
  const points = mode === 'add' ? magnitude : -magnitude
  const effectiveReason = mode === 'remove' ? (removeReason === 'other' ? reason.trim() : removeReason) : reason.trim()

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
    if (mode === 'remove' && !effectiveReason) {
      return setMessage({ kind: 'err', text: 'Pick a reason before taking points away.' })
    }
    if (mode === 'add' && !label.trim()) return setMessage({ kind: 'err', text: 'Give the points a name.' })
    if (magnitude === 0) return setMessage({ kind: 'err', text: 'Points cannot be zero.' })
    startTransition(async () => {
      // F0172 — in the prototype the remove flow had no activity chips at all:
      // the reason WAS the entry. Sending the chip's label instead wrote
      // "Ali · Memorized verse — Misbehaving  -2" onto a child's ledger, which
      // reads as points given for memorising. The reason becomes the row, and
      // 'manual_remove' is the key the prototype stamped on a deduction so
      // these can be found later. GiveSchema caps label at 80, so a longer
      // "Other" reason keeps its full text in `reason`; a short one is not
      // repeated, because the row would then read "Misbehaving — Misbehaving".
      const removeLabel = effectiveReason.slice(0, 80)
      const result = await givePoints({
        classId,
        studentIds: Array.from(selected),
        points,
        activityKey: mode === 'remove' ? 'manual_remove' : activity?.key ?? null,
        label: mode === 'remove' ? removeLabel : label.trim(),
        reason:
          mode === 'remove'
            ? effectiveReason.length > 80
              ? effectiveReason
              : undefined
            : effectiveReason || undefined,
      })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: `${points > 0 ? 'Added' : 'Removed'} ${magnitude} point${magnitude === 1 ? '' : 's'} for ${result.data?.count} student${result.data?.count === 1 ? '' : 's'}.` })
      setSelected(new Set())
      setReason('')
      setRemoveReason('')
      router.refresh()
    })
  }

  function undo(id: string) {
    // F0423 — the Undo button sits at the end of every history row, one
    // mis-tap from writing a reversing entry into a child's points ledger, and
    // it fired straight through. The prototype named the entry and asked
    // first; the admin bulk actions here already do the same (BulkTools.tsx:200,
    // :212). The entry is looked up rather than threaded through the call site
    // so the row markup does not have to change.
    const entry = history.find((h) => h.id === id)
    const what = entry
      ? `"${entry.label}" (${entry.points >= 0 ? '+' : ''}${entry.points} pts) for ${entry.student}`
      : 'this entry'
    if (!confirm(`Undo ${what}? This adds a reversing entry — the original stays on the ledger.`)) return
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

  function saveActivity() {
    if (!editing) return
    startTransition(async () => {
      const result = await updateActivity({
        activityId: editing.id,
        label: editing.label,
        points: editing.points,
        icon: editing.icon || undefined,
      })
      if (result.ok) {
        setEditing(null)
        router.refresh()
      }
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
                <input id="act-icon" value={newActivity.icon} onChange={(e) => setNewActivity({ ...newActivity, icon: e.target.value })} className={cn(inputClass, 'text-center text-[20px]')} placeholder="⭐" maxLength={4} />
                {/* F0181 — the prototype's twenty-four icons, verbatim (OG
                    L19578-19602). The port left a four-character box, so adding an
                    activity on a phone meant hunting for the emoji keyboard or
                    pasting one in, and most activities ended up with no icon at all —
                    which is the one thing that tells the chips apart at a glance on
                    Sunday. Typing still works; this only means nobody has to.
                    Rendered inline rather than as the prototype's floating popover on
                    purpose: this panel already opens and closes, and an absolutely
                    positioned overlay inside page content is the thing .portal-enter's
                    transform traps. */}
                <div className="mt-2 grid grid-cols-8 gap-1 sm:grid-cols-6">
                  {['📖', '🙏', '✝️', '⛪', '🕊️', '📿', '🎵', '🎤', '🎶', '🕯️', '✅', '⭐', '🌟', '✨', '🏆', '🎯', '🤝', '👏', '💪', '📝', '🧠', '❤️', '🎁', '😇'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewActivity({ ...newActivity, icon: emoji })}
                      aria-pressed={newActivity.icon === emoji}
                      aria-label={`Use ${emoji} as the icon`}
                      className={cn(
                        'grid h-10 place-items-center rounded-[8px] border text-[18px] leading-none transition-colors',
                        newActivity.icon === emoji
                          ? 'border-brand-800 bg-parch-50 ring-1 ring-brand-gold/50'
                          : 'border-transparent hover:bg-parch-50',
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
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
        {editing && (
          <div className="mb-3 rounded-[12px] border-[1.5px] border-brand-gold bg-[#FDF5E4] p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Edit activity</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[8rem] flex-1">
                <span className="sr-only">Name</span>
                <input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className={inputClass}
                  maxLength={60}
                  placeholder="Name"
                />
              </label>
              <label className="w-20">
                <span className="sr-only">Points</span>
                <input
                  type="number"
                  value={editing.points}
                  onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) })}
                  className={inputClass}
                  min={-100}
                  max={100}
                />
              </label>
              <label className="w-16">
                <span className="sr-only">Icon</span>
                <input
                  value={editing.icon}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  className={inputClass}
                  maxLength={8}
                  placeholder="⭐"
                />
              </label>
              <button type="button" onClick={saveActivity} disabled={pending || !editing.label.trim()} className={buttonClass('primary', 'sm')}>
                Save
              </button>
              <button type="button" onClick={() => setEditing(null)} className={buttonClass('secondary', 'sm')}>
                Cancel
              </button>
            </div>
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
                <button
                  type="button"
                  onClick={() => setEditing({ id: a.id, label: a.label, points: a.points, icon: a.icon ?? '' })}
                  disabled={pending}
                  aria-label={`Edit ${a.label}`}
                  className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-800 text-parch-50"
                >
                  <Pencil className="h-2.5 w-2.5" strokeWidth={3} />
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
          <div className="flex flex-wrap items-center gap-2">
            {/* F0179 / F0410 — "Select all" acts on every student in the class,
                not on the visible order, so sorting can never change what it
                selects. */}
            <div className="flex overflow-hidden rounded-[10px] border border-parch-200" role="group" aria-label="Sort the leaderboard">
              {([
                { key: 'rank', label: 'Highest' },
                { key: 'lowest', label: 'Lowest' },
                { key: 'name', label: 'A–Z' },
              ] as const).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setSortBy(o.key)}
                  aria-pressed={sortBy === o.key}
                  data-sort={o.key}
                  className={cn(
                    'min-h-[40px] px-2.5 text-[11.5px] font-bold transition-colors',
                    sortBy === o.key ? 'bg-brand-800 text-parch-50' : 'bg-parch-50 text-parch-600 hover:bg-brand-wash',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button type="button" className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')} onClick={() => setSelected(new Set(students.map((s) => s.id)))}>✓ Select all</button>
            <button type="button" className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')} onClick={() => setSelected(new Set())}>✕ Clear</button>
          </div>
        }
      >
        {students.length === 0 ? (
          <EmptyState title="No students yet" hint="Add students to the class to start giving points." />
        ) : (
          <>
            <p className="mb-2.5 text-[11px] text-parch-500">
              Tap a card to select it — select several and give them all points for the same activity.{' '}
              {/* F0180 — the prototype taught this sentence beside the grid, because
                  without it the only thing a card does is get selected: a servant who
                  wanted to look at a child's ledger had to leave the page, go to the
                  roster and find them again. */}
              Tap the eye on a card to open that child&rsquo;s profile instead.
            </p>
            {/* repeat(auto-fill,minmax(92px,1fr)), gap 10px */}
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(104px,1fr))]">
              {sortedStudents.map((s) => {
                const on = selected.has(s.id)
                const medal = s.rank <= 3 ? MEDAL[s.rank - 1] : ''
                return (
                  <li key={s.id} className="relative">
                    <Link
                      href={`/portal/students/${s.id}`}
                      aria-label={`View ${s.name}'s profile`}
                      title="View profile"
                      className="absolute right-1 top-1 z-10 grid h-8 w-8 place-items-center rounded-full border border-parch-200 bg-parch-50 text-parch-500 shadow-card transition-colors hover:border-brand-gold hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-gold"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    </Link>
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
          {/* F0413 — the activity chips are at the top of the page and the give
              bar is what is still on screen once a servant has scrolled down
              the leaderboard, so changing "which activity" meant scrolling back
              up and losing their place. This writes the same `activityId` the
              chips write — one answer to one question, so the bar and the grid
              cannot disagree about what is about to be given. Give mode only,
              as the prototype had it (OG #lb-act-select, :5779). */}
          {mode === 'add' && activities.length > 0 && (
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className={cn(selectClass, 'min-w-[150px] flex-1')}
              aria-label="Activity"
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon ? `${a.icon} ` : ''}{a.label} ({a.points > 0 ? '+' : ''}{a.points})
                </option>
              ))}
              <option value="custom">One-off…</option>
            </select>
          )}
          {mode === 'remove' ? (
            <>
              <input
                type="number"
                min={1}
                max={100}
                value={removeAmount}
                onChange={(e) => setRemoveAmount(Number(e.target.value))}
                className={cn(inputClass, 'w-[86px] shrink-0')}
                aria-label="Points to remove"
                data-remove-amount
              />
              <select
                value={removeReason}
                onChange={(e) => {
                  setRemoveReason(e.target.value)
                  if (e.target.value !== 'other') setReason('')
                }}
                className={cn(selectClass, 'min-w-[170px] flex-1')}
                aria-label="Reason"
                required
              >
                <option value="">Select reason…</option>
                {REMOVE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="other">Other (specify)</option>
              </select>
              {removeReason === 'other' && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={cn(inputClass, 'min-w-[140px] flex-1')}
                  maxLength={200}
                  aria-label="Reason"
                  placeholder="Type the reason…"
                />
              )}
            </>
          ) : (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={cn(inputClass, 'min-w-[160px] flex-1')}
              maxLength={200}
              aria-label="Reason (optional)"
              placeholder="Reason (optional) — shown on the student's ledger"
            />
          )}
          <button type="button" onClick={submit} disabled={pending || (mode === 'remove' && !effectiveReason)} className={cn(buttonClass(mode === 'add' ? 'primary' : 'danger'), 'min-h-[40px] shrink-0')}>
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
      <Card title="Points history" icon={<History className="h-[15px] w-[15px]" />}>
        {history.length === 0 ? (
          <p className="text-[12.5px] text-parch-500">No points given yet.</p>
        ) : (
          <>
            <div className="mb-3 space-y-2.5">
              <label className="relative block">
                <span className="sr-only">Search the points history</span>
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-parch-500" />
                <input
                  value={histQuery}
                  onChange={(e) => setHistQuery(e.target.value)}
                  className={cn(inputClass, 'pl-9')}
                  placeholder="Search by student, activity, reason or servant…"
                />
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {HIST_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setHistFilter(f.key)}
                    aria-pressed={histFilter === f.key}
                    className={cn(
                      'rounded-[20px] border px-2.5 py-[3px] text-[11px] font-bold transition-colors',
                      histFilter === f.key
                        ? 'border-brand-800 bg-brand-800 text-parch-50'
                        : 'border-[#E7E2DA] bg-parch-50 text-parch-500 hover:bg-brand-wash',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                <span aria-hidden className="mx-1 h-4 w-px bg-[#E7E2DA]" />
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-parch-500">
                  Group
                  <select
                    value={histGroup}
                    onChange={(e) => setHistGroup(e.target.value as HistGroup)}
                    className="rounded-[9px] border border-[#E7E2DA] bg-parch-50 px-2 py-[3px] text-[11px] font-bold text-parch-900"
                  >
                    {HIST_GROUPS.map((g) => (
                      <option key={g.key} value={g.key}>{g.label}</option>
                    ))}
                  </select>
                </label>
                {/* F0418 — the ledger is loaded 500 rows deep (points/page.tsx:30)
                    and the counter read "480 of 500", which is how a servant
                    checking why a total looks wrong concludes the entry they are
                    hunting was never made. Fourth instance of this after the hymn
                    book, the follow-up list and the feed: the rows beyond 500 are
                    still unreachable, but the page no longer claims 500 is all of
                    them. */}
                <span className="ml-auto text-[11px] text-parch-500">
                  {histShown} of {history.length}
                  {history.length >= 500 ? ' · most recent 500 only' : ''}
                </span>
              </div>
            </div>

            {histShown === 0 ? (
              <p className="py-3 text-[12.5px] text-parch-500">Nothing matches those filters.</p>
            ) : (
              histGroups.map((g) => {
                const net = g.rows.reduce((n, r) => n + r.points, 0)
                return (
                  <section key={g.key}>
                    {g.title && (
                      <header className="mt-2 flex items-baseline justify-between gap-3 border-b border-[#EFE9DC] pb-1">
                        <h4 className="truncate text-[12px] font-bold text-parch-900">{g.title}</h4>
                        <span
                          className="shrink-0 text-[11.5px] font-extrabold tabular-nums"
                          style={{ color: net >= 0 ? '#16A34A' : '#DC2626' }}
                        >
                          {net >= 0 ? '+' : ''}{net}
                        </span>
                      </header>
                    )}
                    <ul className="divide-y divide-[#F5F2ED]">
                      {g.rows.map((h) => (
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
                            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-parch-500">
                              {/* F0422 — add and remove were told apart only by
                                  the sign and the colour of the number, which is
                                  the first thing lost when a servant scans a
                                  term's ledger for "when did we take points
                                  off?". The filter chips above already say
                                  "Added points" / "Removed points"; the rows now
                                  say the same words. The badge beside it names
                                  where the entry came from, which is a different
                                  question. */}
                              <span
                                className={cn(
                                  'rounded-[20px] px-2 py-[1px] font-bold',
                                  h.points >= 0 ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]',
                                )}
                              >
                                {h.points >= 0 ? 'Added' : 'Removed'}
                              </span>
                              <span className="rounded-[20px] bg-parch-200/70 px-2 py-[1px] font-bold text-parch-600">
                                {SOURCE_LABEL[h.source] ?? h.source}
                              </span>
                              {formatDateTime(new Date(h.at))} · {h.by}
                            </p>
                          </div>
                          {h.canUndo ? (
                            <button type="button" onClick={() => undo(h.id)} disabled={pending} className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px] shrink-0')}>
                              Undo
                            </button>
                          ) : h.source === 'ATTENDANCE' && !h.undone ? (
                            /* F0178 — attendance points follow the register, so an Undo
                               here would put the ledger and the sheet out of step. The
                               rule stays; the dead end does not. A servant who marked the
                               wrong child present is sent to the sheet that owns the row
                               instead of finding no control at all and assuming the points
                               are stuck. */
                            <Link
                              href={`/portal/classes/${classId}/attendance`}
                              className={cn(
                                buttonClass('ghost', 'sm'),
                                'min-h-[40px] max-w-[104px] shrink-0 whitespace-normal px-2 text-right text-[11px] leading-tight',
                              )}
                            >
                              Fix on the attendance sheet
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })
            )}
          </>
        )}
      </Card>
    </div>
  )
}
