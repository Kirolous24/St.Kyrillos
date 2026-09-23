'use client'

import { createContext, useContext, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Undo2, Trash2, FolderInput } from 'lucide-react'
import {
  bulkEditStudents,
  undoBulkEditStudents,
  bulkMoveStudents,
  bulkDeleteStudents,
  type BulkEditUndo,
} from '@/lib/portal/actions/students'
import { BULK_FIELDS } from '@/lib/portal/student-fields'
import { Avatar, Badge, buttonClass, inputClass, selectClass, checkboxClass } from '@/components/portal/ui'
import { formatFullName } from '@/lib/portal/names'
import { MoveStudentSelect } from './MoveStudentSelect'
import { cn } from '@/lib/utils'

export interface BulkStudent {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  classId: string | null
  importNotes: string | null
  account: { loginId: string; photo: string | null }
}

interface SelectionApi {
  selected: ReadonlySet<string>
  toggle: (id: string) => void
  setMany: (ids: string[], on: boolean) => void
  clear: () => void
}

const SelectionContext = createContext<SelectionApi | null>(null)

function useSelection(): SelectionApi {
  const api = useContext(SelectionContext)
  if (!api) throw new Error('Student selection used outside its provider')
  return api
}

/**
 * Selection state for the whole roster. The prototype had checkboxes, a sticky
 * action bar and a bulk editor with Undo; the port had none of it, so changing
 * one field for thirty children meant opening thirty profiles.
 */
export function BulkSelection({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const api = useMemo<SelectionApi>(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        }),
      setMany: (ids, on) =>
        setSelected((prev) => {
          const next = new Set(prev)
          for (const id of ids) {
            if (on) next.add(id)
            else next.delete(id)
          }
          return next
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  )

  return <SelectionContext.Provider value={api}>{children}</SelectionContext.Provider>
}

/** "Select all" for one class group. */
export function GroupSelectAll({ ids, label }: { ids: string[]; label: string }) {
  const { selected, setMany } = useSelection()
  const all = ids.length > 0 && ids.every((id) => selected.has(id))
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10.5px] font-bold text-parch-500">
      <input
        type="checkbox"
        className={checkboxClass}
        checked={all}
        aria-label={`Select every student in ${label}`}
        onChange={(e) => setMany(ids, e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      All
    </label>
  )
}

/** One student card, with its checkbox. */
export function StudentCard({
  student,
  moveOptions,
}: {
  student: BulkStudent
  moveOptions: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const { selected, toggle } = useSelection()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const name = formatFullName(student)
  const isSelected = selected.has(student.id)
  return (
    <div
      className={cn(
        'relative rounded-[12px] border bg-parch-50 px-3.5 pb-3 pt-4 text-center transition-colors',
        isSelected ? 'border-brand-gold ring-1 ring-brand-gold/40' : 'border-[#EFE9DC]',
      )}
    >
      <label className="absolute left-2 top-2 cursor-pointer p-1">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={isSelected}
          aria-label={`Select ${name}`}
          onChange={() => toggle(student.id)}
        />
      </label>
      <Link href={`/portal/students/${student.id}`} className="block">
        <span className="mx-auto mb-2.5 block w-fit">
          <Avatar name={name} photo={student.account.photo} size="lg" />
        </span>
        <span className="block truncate text-[13px] font-bold text-parch-900">{name}</span>
        <span className="mb-1 block truncate text-[11px] text-parch-500">
          ID {student.account.loginId}
          {student.grade ? ` · ${student.grade}` : ''}
        </span>
      </Link>
      {student.importNotes && (
        <span className="mb-2 block">
          <Badge tone="warn">Review</Badge>
        </span>
      )}
      <div className="flex items-center justify-center gap-1.5 border-t border-[#F5F2ED] pt-2.5">
        <MoveStudentSelect studentId={student.id} value={student.classId ?? ''} options={moveOptions} />
        <Link
          href={`/portal/students/${student.id}/edit`}
          aria-label={`Edit ${name}`}
          className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[7px] border border-parch-200 text-parch-700 transition-colors hover:border-brand-gold hover:text-brand-800"
        >
          <Pencil className="h-[13px] w-[13px]" />
        </Link>
        {/* F0571 — the prototype's per-row delete, back on the card. It is the
            one control here that cannot be taken back, so the confirmation
            spells out what goes with the child rather than asking a bare "are
            you sure": their register, their points, their quiz results and their
            badges, none of which can be restored. */}
        <button
          type="button"
          disabled={pending}
          aria-label={`Delete ${name}`}
          title={`Delete ${name}`}
          className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[7px] border border-parch-200 text-parch-700 transition-colors hover:border-[#DC2626] hover:text-[#DC2626] disabled:opacity-50"
          onClick={() => {
            if (
              !window.confirm(
                `Delete ${name}?\n\nThis permanently deletes their account and everything recorded against it — every attendance mark, all their points, their quiz results and answers, their Bible reading days, their badges and any follow-up cases.\n\nIt cannot be undone and there is no way to get it back. If you only want to stop them signing in, open their profile and switch off their login instead.`,
              )
            ) {
              return
            }
            setError('')
            startTransition(async () => {
              const r = await bulkDeleteStudents({ studentIds: [student.id] })
              if (!r.ok) setError(r.error)
              else router.refresh()
            })
          }}
        >
          <Trash2 className="h-[13px] w-[13px]" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[11px] font-semibold text-[#DC2626]">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The sticky action bar. It only appears once something is selected, so it
 * costs nothing on an ordinary visit.
 */
export function BulkBar({ moveOptions }: { moveOptions: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const { selected, clear } = useSelection()
  const [pending, startTransition] = useTransition()
  const [field, setField] = useState<string>(BULK_FIELDS[0].key)
  const [value, setValue] = useState('')
  const [moveTo, setMoveTo] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [undo, setUndo] = useState<BulkEditUndo | null>(null)

  const ids = Array.from(selected)
  if (ids.length === 0) return null

  const fieldLabel = BULK_FIELDS.find((f) => f.key === field)?.label ?? field
  const noun = `${ids.length} student${ids.length === 1 ? '' : 's'}`

  function apply() {
    setMessage(null)
    startTransition(async () => {
      const result = await bulkEditStudents({ studentIds: ids, field, value })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setUndo(result.data!.undo)
      setMessage({ kind: 'ok', text: `Set ${fieldLabel} on ${result.data!.updated} student${result.data!.updated === 1 ? '' : 's'}.` })
      router.refresh()
    })
  }

  function revert() {
    if (!undo) return
    setMessage(null)
    startTransition(async () => {
      const result = await undoBulkEditStudents(undo)
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setUndo(null)
      setMessage({ kind: 'ok', text: `Put ${fieldLabel} back on ${result.data!.restored} student${result.data!.restored === 1 ? '' : 's'}.` })
      router.refresh()
    })
  }

  function move() {
    const name = moveTo ? moveOptions.find((c) => c.id === moveTo)?.name ?? 'that class' : 'no class'
    if (!confirm(`Move ${noun} to ${name}?`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await bulkMoveStudents({ studentIds: ids, classId: moveTo || null })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: `Moved ${result.data!.moved} student${result.data!.moved === 1 ? '' : 's'} to ${name}.` })
      clear()
      router.refresh()
    })
  }

  function destroy() {
    if (!confirm(`Delete ${noun}? This removes their account and every record attached to them. It cannot be undone.`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await bulkDeleteStudents({ studentIds: ids })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({ kind: 'ok', text: `Deleted ${result.data!.deleted} student${result.data!.deleted === 1 ? '' : 's'}.` })
      clear()
      router.refresh()
    })
  }

  return (
    <div className="sticky bottom-0 z-20 mt-3.5 rounded-[16px] border border-brand-gold/35 bg-brand-wash p-3 shadow-panel print:hidden">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-[12px] font-bold text-brand-gold-dark">{noun} selected</span>
        <button type="button" onClick={clear} className={buttonClass('secondary', 'sm')}>
          Clear
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="min-w-[150px] flex-1">
          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Set field</span>
          <select value={field} onChange={(e) => setField(e.target.value)} className={selectClass} aria-label="Field to set">
            {BULK_FIELDS.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[160px] flex-[2]">
          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">To</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
            maxLength={1000}
            placeholder={field === 'gender' ? 'male or female' : `New ${fieldLabel.toLowerCase()} — blank clears it`}
            aria-label={`New ${fieldLabel}`}
          />
        </label>
        <button type="button" onClick={apply} disabled={pending} className={cn(buttonClass('primary'), 'min-h-[40px] shrink-0')}>
          {pending ? 'Working…' : `Apply to ${ids.length}`}
        </button>
        {undo && (
          <button type="button" onClick={revert} disabled={pending} className={cn(buttonClass('secondary'), 'min-h-[40px] shrink-0')}>
            <Undo2 className="h-4 w-4" aria-hidden /> Undo
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2.5 border-t border-brand-gold/25 pt-2.5">
        <label className="min-w-[150px] flex-1">
          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Move to class</span>
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={selectClass} aria-label="Move to class">
            <option value="">No class</option>
            {moveOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={move} disabled={pending} className={cn(buttonClass('secondary'), 'min-h-[40px] shrink-0')}>
          <FolderInput className="h-4 w-4" aria-hidden /> Move {ids.length}
        </button>
        <button type="button" onClick={destroy} disabled={pending} className={cn(buttonClass('danger'), 'min-h-[40px] shrink-0')}>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete {ids.length}
        </button>
      </div>

      {message && (
        <p role="status" className={cn('mt-2 text-[12.5px] font-semibold', message.kind === 'ok' ? 'text-[#15803D]' : 'text-[#B91C1C]')}>
          {message.text}
        </p>
      )}
    </div>
  )
}
