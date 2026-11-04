'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { addReservationApprover, removeReservationApprover } from '@/lib/portal/actions/reservations'
import { InlineNotice, inputClass } from '@/components/portal/ui'

/**
 * Who approves van requests (2026-11-04): "it needs to go through" one
 * servant. The admin names them here; with nobody named, requests come to the
 * admin.
 */
export function ApproversEditor({
  approvers,
  servants,
}: {
  approvers: Array<{ servantId: string; name: string }>
  servants: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const named = new Set(approvers.map((a) => a.servantId))
  const matches = query.trim()
    ? servants.filter((s) => !named.has(s.id) && s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setMessage({ tone: 'bad', text: result.error ?? 'Something went wrong.' })
        return
      }
      setMessage({ tone: 'good', text: done })
      setQuery('')
      router.refresh()
    })
  }

  return (
    <div data-testid="approvers">
      {approvers.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" data-testid="approvers-named">
          {approvers.map((a) => (
            <li key={a.servantId} className="inline-flex items-center gap-1 rounded-full border border-brand-gold/50 bg-brand-wash py-1 pl-3 pr-1 text-[12.5px] font-semibold text-parch-900">
              {a.name}
              <button
                type="button"
                onClick={() => run(() => removeReservationApprover(a.servantId), `${a.name} no longer approves van requests.`)}
                disabled={pending}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-parch-500 hover:bg-parch-200 hover:text-parch-900"
                aria-label={`Stop ${a.name} approving van requests`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-[12px] text-parch-500">Nobody yet, so van requests come to the admin.</p>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add someone who approves: type a name"
        aria-label="Add someone who approves van requests"
        className={inputClass}
      />
      {matches.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-[10px] border border-parch-200 bg-parch-50" data-testid="approver-matches">
          {matches.map((s) => (
            <li key={s.id} className="border-b border-[#F0EEE8] last:border-b-0">
              <button
                type="button"
                onClick={() => run(() => addReservationApprover(s.id), `${s.name} now approves van requests.`)}
                disabled={pending}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-parch-900 hover:bg-brand-wash"
              >
                <Plus className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && <p className="mt-1.5 text-[12px] text-parch-500">No servant by that name.</p>}
      {message && (
        <InlineNotice tone={message.tone} className="mt-2">
          {message.text}
        </InlineNotice>
      )}
    </div>
  )
}
