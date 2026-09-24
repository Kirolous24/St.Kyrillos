'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Layers, Link as LinkIcon } from 'lucide-react'
import { createClass, updateClass, deleteClass, createStandardGradeClasses, setCurriculumLink, type ClassInput } from '@/lib/portal/actions/admin'
import { Card, ClassCard, Field, inputClass, selectClass, buttonClass, Badge, Callout, EmptyState } from '@/components/portal/ui'
import { STAGE_LABEL, TITLE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'

type Row = {
  id: string
  name: string
  stage: ClassInput['stage']
  visitationThreshold: number
  description: string | null
  isActive: boolean
  sortOrder: number
  curriculumLinkedToId: string | null
  students: number
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

const EMPTY: ClassForm = { name: '', stage: '', visitationThreshold: 1, description: '' }

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
    setEditing(c)
    setOpen(true)
    setForm({ name: c.name, stage: c.stage, visitationThreshold: c.visitationThreshold, description: c.description ?? '' })
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
      {/* The prototype's collapsible "+ Add New Class" card */}
      <Card
        title={editing ? `Edit ${editing.name}` : 'Add new class'}
        icon={<Plus className="h-[15px] w-[15px]" />}
        action={
          <>
            {/* Outside the form on purpose. It first sat inside, which is a Card
                whose body is `hidden` until opened — so the one button a brand
                new church needs was invisible until you went looking for the
                add-a-class form. */}
            <button
              type="button"
              disabled={pending}
              onClick={seedStandard}
              className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
            >
              <Layers className="h-[13px] w-[13px]" /> Add standard grade classes
            </button>
          <button
            type="button"
            onClick={() => { if (open && editing) reset(); setOpen((v) => !v) }}
            aria-expanded={open}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
          >
            {open ? 'Close' : 'Open'}
            {open ? <ChevronUp className="h-[13px] w-[13px]" /> : <ChevronDown className="h-[13px] w-[13px]" />}
          </button>
          </>
        }
        bodyClassName={open ? 'p-[18px]' : 'hidden'}
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
                onChange={(e) => setForm({ ...form, stage: e.target.value as ClassForm['stage'] })}
                className={selectClass}
                required
              >
                {/* F0536 — no pre-picked answer. A class filed under the wrong
                    age group is read that way by the stage rails, by a
                    coordinator's oversight and by every stage report. */}
                <option value="">Choose an age group…</option>
                <option value="ELEMENTARY">Elementary</option><option value="MIDDLE_SCHOOL">Middle School</option><option value="HIGH_SCHOOL">High School</option>
              </select>
            </Field>
            <Field label="Open a follow-up after" htmlFor="cls-threshold" hint="consecutive missed Sunday School sessions">
              <input id="cls-threshold" type="number" min={1} max={10} value={form.visitationThreshold} onChange={(e) => setForm({ ...form, visitationThreshold: Number(e.target.value) })} className={inputClass} />
            </Field>
            <Field label="Description" htmlFor="cls-desc" hint="Optional">
              <input id="cls-desc" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} maxLength={300} placeholder="Brief description…" />
            </Field>
          </div>
          {error && <div role="alert" className="mb-3"><Callout tone="bad">{error}</Callout></div>}
          {notice && <div role="status" className="mb-3"><Callout tone="good">{notice}</Callout></div>}
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
                icon={<GraduationCap className="h-[19px] w-[19px]" />}
                rows={[
                  { key: 'Stage', value: <span className="text-brand-gold-dark">{STAGE_LABEL[c.stage]}</span> },
                  { key: 'Students', value: c.students },
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
                  ...(c.description ? [{ key: 'Notes', value: <span className="font-normal text-parch-500">{c.description}</span> }] : []),
                  ...(c.curriculumLinkedToId
                    ? [{
                        key: 'Follows',
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
              {/* The schema has carried curriculumLinkedToId since the import
                  and nothing read or wrote it. Admin-only by the church's
                  decision: linking changes what a whole class is taught. */}
              <label className="mt-1.5 flex items-center gap-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-parch-500">
                <LinkIcon className="h-3 w-3 shrink-0" aria-hidden />
                Follows curriculum of
                <select
                  value={c.curriculumLinkedToId ?? ''}
                  disabled={pending}
                  aria-label={`Class whose curriculum ${c.name} follows`}
                  onChange={(e) => linkCurriculum(c, e.target.value || null)}
                  className="min-w-0 flex-1 rounded-[7px] border border-parch-200 bg-parch-50 px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-parch-800 outline-none focus:border-brand-gold"
                >
                  <option value="">Nothing — its own plan</option>
                  {classes.filter((x) => x.id !== c.id).map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
