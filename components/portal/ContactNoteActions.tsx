'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContactNote, editContactNote, moveContactNote } from '@/lib/portal/actions/followups'
import { CONTACT_METHODS, CONTACT_RESULTS } from '@/lib/portal/followups'
import { Callout, buttonClass, selectClass, textareaClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Method = 'call' | 'text' | 'whatsapp' | 'email' | 'visit' | 'other'
type Result = 'reached' | 'no_answer' | 'left_message' | 'will_come' | 'other'

/**
 * Edit, move or delete a contact note after it was saved (2026-09-28). A
 * servant logged a call on the wrong child and had no way to fix it short of
 * deleting the whole case. Shown only to whoever may change the note: the
 * servant who wrote it, and the class's coordinator, stage overseer and admin.
 */
export function ContactNoteActions({
  note,
  childName,
  moveTo,
}: {
  note: { id: string; method: string; result: string | null; note: string | null }
  childName: string
  /** The other children the note could be moved to. */
  moveTo: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'edit' | 'move' | null>(null)
  const [method, setMethod] = useState<Method>((CONTACT_METHODS.some((m) => m.key === note.method) ? note.method : 'other') as Method)
  const [result, setResult] = useState<Result | ''>((note.result as Result | null) ?? '')
  const [text, setText] = useState(note.note ?? '')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('')
    startTransition(async () => {
      const r = await action()
      if (!r.ok) return setError(r.error ?? 'Something went wrong.')
      setMode(null)
      router.refresh()
    })
  }

  const small = cn(buttonClass('ghost', 'sm'), 'min-h-[32px] px-2 text-[11px]')

  return (
    <div className="mt-1.5">
      {mode === null && (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={small} onClick={() => setMode('edit')} aria-label={`Edit this note for ${childName}`}>
            Edit
          </button>
          {moveTo.length > 0 && (
            <button type="button" className={small} onClick={() => setMode('move')} aria-label={`Move this note for ${childName} to another child`}>
              Move to another child
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            className={cn(small, 'text-[#B91C1C]')}
            aria-label={`Delete this note for ${childName}`}
            onClick={() => {
              if (!window.confirm(`Delete this note for ${childName}? It cannot be brought back.`)) return
              run(() => deleteContactNote(note.id))
            }}
          >
            Delete
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="space-y-2 rounded-[10px] border border-parch-200 bg-parch-50 p-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className={selectClass} aria-label="How">
              {CONTACT_METHODS.filter((m) => m.key !== 'resolved').map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <select value={result} onChange={(e) => setResult(e.target.value as Result | '')} className={selectClass} aria-label="Result">
              <option value="">No result</option>
              {CONTACT_RESULTS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className={textareaClass} rows={2} maxLength={1000} aria-label="Note" />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}
              onClick={() => run(() => editContactNote({ logId: note.id, method, result: result || null, note: text }))}
            >
              {pending ? 'Saving…' : 'Save note'}
            </button>
            <button type="button" className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')} onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'move' && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-parch-200 bg-parch-50 p-2.5">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={cn(selectClass, 'min-w-0 flex-1')} aria-label="Move the note to">
            <option value="">Which child was it for?</option>
            {moveTo.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !target}
            className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}
            onClick={() => run(() => moveContactNote({ logId: note.id, studentId: target }))}
          >
            {pending ? 'Moving…' : 'Move note'}
          </button>
          <button type="button" className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')} onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      )}

      {error && <div className="mt-1.5" role="alert"><Callout tone="bad">{error}</Callout></div>}
    </div>
  )
}
