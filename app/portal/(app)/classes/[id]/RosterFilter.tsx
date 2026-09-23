'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { inputClass, buttonClass } from '@/components/portal/ui'

export interface RosterItem {
  id: string
  /** Everything this card can be found by, already lowercased. */
  text: string
  node: React.ReactNode
}

/**
 * The prototype's roster search filtered as you typed (F0067); the port made
 * it a form submit, so finding one child in a class of thirty cost a round
 * trip per attempt.
 *
 * The cards are still rendered on the server — they carry per-student figures
 * that belong there — and handed to this component as nodes. It only decides
 * which of them to show, so nothing about a card is duplicated in the client
 * bundle.
 *
 * `initial` comes from `?q=`, so an existing link to a filtered roster still
 * opens filtered, and the form still submits for anyone without JavaScript.
 */
export function RosterFilter({ items, initial, total }: { items: RosterItem[]; initial: string; total: number }) {
  const [q, setQ] = useState(initial)
  const needle = q.trim().toLowerCase()
  const shown = needle ? items.filter((i) => i.text.includes(needle)) : items

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[12px] text-parch-500">
          {needle ? `${shown.length} of ${total} shown` : `${total} on the roster`}
        </p>
      </div>
      <form className="mb-3 flex items-end gap-2" role="search">
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">Search the roster</span>
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
            placeholder="Search by name, ID or grade…"
            autoComplete="off"
          />
        </label>
        {/* A real, visible button rather than a screen-reader-only one. It is
            not redundant with the live filter: submitting puts `?q=` in the
            URL, which is what makes a filtered roster shareable, and it is the
            path for anyone without JavaScript. An sr-only button here was also
            unclickable — 1x1 and clipped, so the card above it takes the
            pointer — which is a control that only looks like it exists. */}
        <button type="submit" className={buttonClass('secondary')}>
          <Search className="h-[13px] w-[13px]" aria-hidden /> Search
        </button>
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="flex shrink-0 items-center gap-1 rounded-[9px] border border-parch-200 px-2.5 py-1.5 text-[12px] font-semibold text-parch-700 transition-colors hover:border-brand-gold hover:text-brand-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        )}
      </form>

      {shown.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-parch-300 px-4 py-8 text-center text-[12.5px] text-parch-500">
          No students match &ldquo;{q}&rdquo;. Try a different name or ID.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((i) => (
            <div key={i.id}>{i.node}</div>
          ))}
        </div>
      )}
    </>
  )
}
