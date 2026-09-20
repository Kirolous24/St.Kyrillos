'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { createClass, updateClass, deleteClass, type ClassInput } from '@/lib/portal/actions/admin'
import { Card, ClassCard, Field, inputClass, selectClass, buttonClass, Badge, Callout, EmptyState } from '@/components/portal/ui'
import { STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'

type Row = { id: string; name: string; stage: ClassInput['stage']; visitationThreshold: number; description: string | null; isActive: boolean; sortOrder: number; students: number; servants: number }

const EMPTY: ClassInput = { name: '', stage: 'ELEMENTARY', visitationThreshold: 2, description: '' }

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
  const [editing, setEditing] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ClassInput>(EMPTY)

  function startEdit(c: Row) {
    setEditing(c)
    setOpen(true)
    setForm({ name: c.name, stage: c.stage, visitationThreshold: c.visitationThreshold, description: c.description ?? '' })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() {
    setEditing(null)
    setForm(EMPTY)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const r = editing ? await updateClass(editing.id, form) : await createClass(form)
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
          <button
            type="button"
            onClick={() => { if (open && editing) reset(); setOpen((v) => !v) }}
            aria-expanded={open}
            className={cn(buttonClass('secondary', 'sm'), 'min-h-[40px]')}
          >
            {open ? 'Close' : 'Open'}
            {open ? <ChevronUp className="h-[13px] w-[13px]" /> : <ChevronDown className="h-[13px] w-[13px]" />}
          </button>
        }
        bodyClassName={open ? 'p-[18px]' : 'hidden'}
      >
        <form onSubmit={submit}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Class name" htmlFor="cls-name">
              <input id="cls-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} required maxLength={60} placeholder="e.g. Middle School" />
            </Field>
            <Field label="Stage" htmlFor="cls-stage">
              <select id="cls-stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as ClassInput['stage'] })} className={selectClass}>
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

      {!open && error && <div role="alert"><Callout tone="bad">{error}</Callout></div>}

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
                  { key: 'Servants', value: c.servants === 0 ? 'Not assigned' : `${c.servants} servant${c.servants === 1 ? '' : 's'}` },
                  { key: 'Follow-up after', value: `${c.visitationThreshold} missed` },
                  ...(c.description ? [{ key: 'Notes', value: <span className="font-normal text-parch-500">{c.description}</span> }] : []),
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
