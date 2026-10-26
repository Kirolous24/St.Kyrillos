'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Layers, Link as LinkIcon, HeartHandshake, CalendarCheck } from 'lucide-react'
import { createClass, updateClass, deleteClass, createStandardGradeClasses, setAttendancePartner, setCurriculumLink, type ClassInput } from '@/lib/portal/actions/admin'
import { Card, ClassCard, Field, inputClass, selectClass, buttonClass, Badge, Callout, EmptyState } from '@/components/portal/ui'
import { STAGE_LABEL, TITLE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'
import { FELLOWSHIP_THRESHOLD, isFellowship } from '@/lib/portal/fellowship'

type Row = {
  id: string
  name: string
  stage: ClassInput['stage']
  visitationThreshold: number
  description: string | null
  isActive: boolean
  sortOrder: number
  curriculumLinkedToId: string | null
  /** The class whose register this one's servants also take (2026-10-25). */
  attendancePartnerId: string | null
  takesOtherClasses: boolean
  students: number
  /** Children from other classes in it. */
  members: number
  servants: number
  /**
   * F0541 — who they are, not just how many. Coordinators first. An admin
   * checking cover for a class used to read "3 servants" and go to the roster;
   * the one thing they usually want — which of the three is the coordinator —
   * was not on this screen at all.
   */
  servantNames: Array<{ name: string; title: 'COORDINATOR' | 'ASSISTANT_COORDINATOR' | null }>
}

/**
 * F0536 — the stage starts unchosen.
 *
 * There is no such thing as a Sunday School class with no age group, so the
 * question is not whether one is needed; it is who answers it. The form used to
 * answer it, quietly, with Elementary — so a High School class created in a
 * hurry ended up filed as Elementary, which is what the stage rails and the
 * coordinator's oversight then read. The fix is to stop the form answering,
 * rather than to invent a fourth age group and store it against live classes.
 *
 * `stage: ''` exists only in the form. Nothing with a blank stage ever reaches
 * the server: `submit` refuses it, and the select is `required`.
 */
type ClassForm = Omit<ClassInput, 'stage'> & { stage: ClassInput['stage'] | '' }

const EMPTY: ClassForm = { name: '', stage: '', visitationThreshold: 1, description: '', takesOtherClasses: false }

/** Small square icon button, as the prototype's card-head pencil/trash. */
function iconButtonClass(tone: 'neutral' | 'gold' | 'danger') {
  return cn(
    'grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[7px] border transition-colors disabled:opacity-40',
    tone === 'neutral' && 'border-parch-200 text-parch-700 hover:border-brand-gold hover:text-brand-800',
    tone === 'gold' && 'border-brand-gold text-brand-gold-dark hover:bg-brand-wash',
    tone === 'danger' && 'border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2]',
  )
}

export function ClassManager({ classes }: { classes: Row[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ClassForm>(EMPTY)

  function startEdit(c: Row) {
    setNotice('')
    setError('')
    setEditing(c)
    setOpen(true)
    setForm({ name: c.name, stage: c.stage, visitationThreshold: c.visitationThreshold, description: c.description ?? '', takesOtherClasses: c.takesOtherClasses })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function linkCurriculum(c: Row, target: string | null) {
    setError('')
    setNotice('')
    startTransition(async () => {
      const r = await setCurriculumLink(c.id, target)
      if (!r.ok) return setError(r.error)
      setNotice(
        target
          ? `${c.name} now follows ${classes.find((x) => x.id === target)?.name ?? target}.`
          : `${c.name} follows its own plan again.`,
      )
      router.refresh()
    })
  }

  function pairAttendance(c: Row, target: string | null) {
    setError('')
    setNotice('')
    startTransition(async () => {
      const r = await setAttendancePartner(c.id, target)
      if (!r.ok) return setError(r.error)
      setNotice(
        target
          ? `${c.name} and ${classes.find((x) => x.id === target)?.name ?? target} now take each other's attendance, and nothing else of each other.`
          : `${c.name} takes only its own attendance again.`,
      )
      router.refresh()
    })
  }

  function seedStandard() {
    if (!window.confirm('Add Pre-K through 12th Grade? Any you already have are skipped.')) return
    setError('')
    setNotice('')
    startTransition(async () => {
      const result = await createStandardGradeClasses()
      if (!result.ok) return setError(result.error)
      const { added, skipped } = result.data!
      setNotice(
        added === 0
          ? 'You already have all fourteen standard grade classes.'
          : `Added ${added} class${added === 1 ? '' : 'es'}${skipped > 0 ? `, skipped ${skipped} you already had` : ''}.`,
      )
      router.refresh()
    })
  }

  function reset() {
    setEditing(null)
    setForm(EMPTY)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // F0536 — the one place the blank stage stops. Nothing without an age group
    // ever reaches the server.
    if (!form.stage) {
      setError('Choose an age group for this class.')
      return
    }
    const payload: ClassInput = { ...form, stage: form.stage }
    startTransition(async () => {
      const r = editing ? await updateClass(editing.id, payload) : await createClass(payload)
      if (!r.ok) return setError(r.error)
      // 2026-10-24 — say so. The form used to shut without a word and the new
      // card landed at the foot of a long grid, so a class that had been made
      // looked like a button that did nothing.
      setNotice(
        editing
          ? `Saved ${payload.name}.`
          : isFellowship(payload.stage)
            ? `${payload.name} added. Next, tick it on each of its servants’ pages under Servants.`
            : `${payload.name} added.`,
      )
      reset()
      setOpen(false)
      router.refresh()
    })
  }

  function toggleActive(c: Row) {
    startTransition(async () => {
      const r = await updateClass(c.id, { name: c.name, stage: c.stage, visitationThreshold: c.visitationThreshold, description: c.description ?? '', isActive: !c.isActive })
      if (!r.ok) setError(r.error)
      router.refresh()
    })
  }

  function move(c: Row, dir: -1 | 1) {
    const idx = classes.findIndex((x) => x.id === c.id)
    const other = classes[idx + dir]
    if (!other) return
    startTransition(async () => {
      await updateClass(c.id, { name: c.name, stage: c.stage, visitationThreshold: c.visitationThreshold, description: c.description ?? '', sortOrder: other.sortOrder })
      await updateClass(other.id, { name: other.name, stage: other.stage, visitationThreshold: other.visitationThreshold, description: other.description ?? '', sortOrder: c.sortOrder })
      router.refresh()
    })
  }

  function remove(c: Row) {
    if (!confirm(`Delete ${c.name}? Servants will be unassigned from it.`)) return
    startTransition(async () => {
      const r = await deleteClass(c.id)
      if (!r.ok) setError(r.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3.5">
      {/* 2026-10-24 — the add button is a button that says so. It was a small
          "Open" toggle on the end of an "Add new class" heading; on a phone the
          heading shrank to "A.", tapping it did nothing, and the biggest button
          left, standard grades, cannot make a meeting. */}
      {!open && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setNotice(''); setError(''); setOpen(true) }}
            aria-expanded={false}
            className={cn(buttonClass('primary'), 'min-h-[44px]')}
          >
            <Plus className="h-[14px] w-[14px]" /> Add a class
          </button>
          {/* Never only inside the form: a brand new church needs this one
              button, and it was invisible until you went looking for the form. */}
          <button
            type="button"
            disabled={pending}
            onClick={seedStandard}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
          >
            <Layers className="h-[13px] w-[13px]" /> Add standard grade classes
          </button>
        </div>
      )}
      {/* The prototype's "+ Add New Class" card, shown once asked for. It stays
          in the page while shut so the form keeps its place. */}
      <Card
        className={open ? undefined : 'hidden'}
        title={editing ? `Edit ${editing.name}` : 'Add new class'}
        icon={<Plus className="h-[15px] w-[15px]" />}
        action={
          <button
            type="button"
            onClick={() => { if (editing) reset(); setOpen(false) }}
            aria-expanded={open}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
          >
            Close <ChevronUp className="h-[13px] w-[13px]" />
          </button>
        }
      >
        <form onSubmit={submit}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Class name" htmlFor="cls-name">
              <input id="cls-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} required maxLength={60} placeholder="e.g. Middle School" />
            </Field>
            <Field label="Stage" htmlFor="cls-stage">
              <select
                id="cls-stage"
                value={form.stage}
                onChange={(e) => {
                  const stage = e.target.value as ClassForm['stage']
                  // A meeting follows up after two missed meetings unless the
                  // admin says otherwise (2026-10-24); only the untouched
                  // default moves with the choice.
                  const threshold =
                    isFellowship(stage) && form.visitationThreshold === EMPTY.visitationThreshold
                      ? FELLOWSHIP_THRESHOLD
                      : !isFellowship(stage) && isFellowship(form.stage) && form.visitationThreshold === FELLOWSHIP_THRESHOLD
                        ? EMPTY.visitationThreshold
                        : form.visitationThreshold
                  setForm({ ...form, stage, visitationThreshold: threshold })
                }}
                className={selectClass}
                required
              >
                {/* F0536 — no pre-picked answer. A class filed under the wrong
                    age group is read that way by the stage rails, by a
                    coordinator's oversight and by every stage report. */}
                <option value="">Choose an age group…</option>
                <option value="ELEMENTARY">Elementary</option><option value="MIDDLE_SCHOOL">Middle School</option><option value="HIGH_SCHOOL">High School</option>
                {/* The adults' meetings (2026-10-24). */}
                <option value="FELLOWSHIP">Fellowship (Women&rsquo;s, Men&rsquo;s, Youth meetings)</option>
              </select>
            </Field>
            <Field label="Open a follow-up after" htmlFor="cls-threshold" hint={isFellowship(form.stage) ? 'meetings missed in a row' : 'consecutive missed Sunday School sessions'}>
              <input id="cls-threshold" type="number" min={1} max={10} value={form.visitationThreshold} onChange={(e) => setForm({ ...form, visitationThreshold: Number(e.target.value) })} className={inputClass} />
            </Field>
            <Field label="Description" htmlFor="cls-desc" hint="Optional">
              <input id="cls-desc" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} maxLength={300} placeholder="Brief description…" />
            </Field>
          </div>
          {isFellowship(form.stage) ? (
            /* 2026-10-24 — a meeting takes its members from anywhere, so the
               "other classes" box below is implied rather than offered. */
            <div className="mb-3.5" data-testid="fellowship-note">
              <Callout tone="info" title="A Fellowship meeting">
                Its people are members, not students: servants from any class, and people who don&rsquo;t serve and never
                sign in. It has attendance, a QR check-in members use without signing in, follow-ups and Birthdays, and no
                points, quizzes or grades. Its own register is created with it.
              </Callout>
            </div>
          ) : (
          /* 2026-09-28 — a class like Pre-Servants holds children who stay in their own class. */
          <label className="mb-3.5 flex items-start gap-2.5 text-[12.5px] text-parch-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!form.takesOtherClasses}
              onChange={(e) => setForm({ ...form, takesOtherClasses: e.target.checked })}
            />
            <span>
              <b>Takes children from other classes</b>
              <span className="block text-[11.5px] text-parch-500">
                Children join it and stay in their own class, like Pre-Servants. Give it its own meeting in Sessions &amp;
                Points.
              </span>
            </span>
          </label>
          )}
          {/* Only while open: the shut form stays in the page, and a second,
              hidden copy of a message is a second message to a screen reader. */}
          {open && error && <div role="alert" className="mb-3"><Callout tone="bad">{error}</Callout></div>}
          {open && notice && <div role="status" className="mb-3"><Callout tone="good">{notice}</Callout></div>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={cn(buttonClass('primary'), 'min-h-[40px]')}>
              <Plus className="h-[13px] w-[13px]" /> {pending ? 'Saving…' : editing ? 'Save changes' : 'Create class'}
            </button>
            {editing && (
              <button type="button" className={cn(buttonClass('secondary'), 'min-h-[40px]')} onClick={reset}>Cancel edit</button>
            )}
          </div>
        </form>
      </Card>

      {!open && error && <div role="alert" className="mb-3.5"><Callout tone="bad">{error}</Callout></div>}
      {!open && notice && <div role="status" className="mb-3.5"><Callout tone="good">{notice}</Callout></div>}

      {classes.length === 0 ? (
        <EmptyState title="No classes yet" hint="Add your first class using the form above." />
      ) : (
        /* .classes-grid */
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {classes.map((c, i) => (
            <div key={c.id} className={cn(!c.isActive && 'opacity-70')}>
              <ClassCard
                name={c.name}
                accent={accentFor(c.id)}
                icon={isFellowship(c.stage) ? <HeartHandshake className="h-[19px] w-[19px]" /> : <GraduationCap className="h-[19px] w-[19px]" />}
                rows={[
                  { key: 'Stage', value: <span className="text-brand-gold-dark">{STAGE_LABEL[c.stage]}</span> },
                  // A meeting's people are members, wherever they came from (2026-10-24).
                  isFellowship(c.stage) ? { key: 'Members', value: c.students + c.members } : { key: 'Students', value: c.students },
                  {
                    key: 'Servants',
                    value:
                      c.servants === 0 ? (
                        'Not assigned'
                      ) : c.servantNames.length === 0 ? (
                        `${c.servants} servant${c.servants === 1 ? '' : 's'}`
                      ) : (
                        /* Folded away rather than always open: a class with five
                           servants would otherwise make this card twice as tall
                           as the ones beside it in the grid. */
                        <details className="text-right">
                          <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-2">
                            {c.servants} servant{c.servants === 1 ? '' : 's'}
                          </summary>
                          <ul className="mt-1 space-y-0.5">
                            {c.servantNames.map((sv) => (
                              <li key={sv.name} className="flex items-center justify-end gap-1.5">
                                <span className="truncate font-normal text-parch-700">{sv.name}</span>
                                {sv.title && <Badge tone="gold">{TITLE_LABEL[sv.title]}</Badge>}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ),
                  },
                  { key: 'Follow-up after', value: `${c.visitationThreshold} missed` },
                  ...(c.takesOtherClasses && !isFellowship(c.stage) ? [{ key: 'From other classes', value: `${c.members} child${c.members === 1 ? '' : 'ren'}` }] : []),
                  ...(c.description ? [{ key: 'Notes', value: <span className="font-normal text-parch-500">{c.description}</span> }] : []),
                  ...(c.curriculumLinkedToId
                    ? [{
                        key: 'Linked with',
                        value: (
                          <span className="text-brand-gold-dark">
                            {classes.find((x) => x.id === c.curriculumLinkedToId)?.name ?? c.curriculumLinkedToId}
                          </span>
                        ),
                      }]
                    : []),
                  ...(c.isActive ? [] : [{ key: 'Visibility', value: <Badge tone="neutral">Hidden</Badge> }]),
                ]}
                actions={
                  <>
                    <button type="button" aria-label={`Edit ${c.name}`} className={iconButtonClass('neutral')} onClick={() => startEdit(c)}>
                      <Pencil className="h-[13px] w-[13px]" />
                    </button>
                    <button
                      type="button"
                      aria-label={c.isActive ? `Hide ${c.name}` : `Show ${c.name}`}
                      className={iconButtonClass('gold')}
                      disabled={pending}
                      onClick={() => toggleActive(c)}
                    >
                      {c.isActive ? <EyeOff className="h-[13px] w-[13px]" /> : <Eye className="h-[13px] w-[13px]" />}
                    </button>
                    <button type="button" aria-label={`Move ${c.name} up`} className={iconButtonClass('neutral')} disabled={pending || i === 0} onClick={() => move(c, -1)}>
                      <ChevronUp className="h-[13px] w-[13px]" />
                    </button>
                    <button type="button" aria-label={`Move ${c.name} down`} className={iconButtonClass('neutral')} disabled={pending || i === classes.length - 1} onClick={() => move(c, 1)}>
                      <ChevronDown className="h-[13px] w-[13px]" />
                    </button>
                    <button type="button" aria-label={`Delete ${c.name}`} className={cn(iconButtonClass('danger'), 'ml-auto')} disabled={pending} onClick={() => remove(c)}>
                      <Trash2 className="h-[13px] w-[13px]" />
                    </button>
                  </>
                }
              />
              {/* A link joins two classes both ways: each can read the other's
                  Lesson Preparation and copy weeks from it (2026-09-26).
                  Servants can also link their own class from that page. */}
              <label className="mt-1.5 flex items-center gap-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-parch-500">
                <LinkIcon className="h-3 w-3 shrink-0" aria-hidden />
                Linked with
                <select
                  value={c.curriculumLinkedToId ?? ''}
                  disabled={pending}
                  aria-label={`Class ${c.name} is linked with`}
                  onChange={(e) => linkCurriculum(c, e.target.value || null)}
                  className="min-w-0 flex-1 rounded-[7px] border border-parch-200 bg-parch-50 px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-parch-800 outline-none focus:border-brand-gold"
                >
                  <option value="">No other class</option>
                  {classes.filter((x) => x.id !== c.id).map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </label>
              {/* Attendance partners (2026-10-25): each class's servants may
                  take the other's register, and nothing else of it. */}
              {!isFellowship(c.stage) && (
                <label className="mt-1.5 flex items-center gap-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-parch-500">
                  <CalendarCheck className="h-3 w-3 shrink-0" aria-hidden />
                  Takes attendance with
                  <select
                    value={c.attendancePartnerId ?? ''}
                    disabled={pending}
                    aria-label={`Class ${c.name} takes attendance with`}
                    onChange={(e) => pairAttendance(c, e.target.value || null)}
                    className="min-w-0 flex-1 rounded-[7px] border border-parch-200 bg-parch-50 px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-parch-800 outline-none focus:border-brand-gold"
                  >
                    <option value="">Only its own</option>
                    {classes.filter((x) => x.id !== c.id && x.isActive && !isFellowship(x.stage)).map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
