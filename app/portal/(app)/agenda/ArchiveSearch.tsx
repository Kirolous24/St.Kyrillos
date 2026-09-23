'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Link2, Search, X } from 'lucide-react'
import { inputClass } from '@/components/portal/ui'

export interface ArchiveSearchRow {
  weekStart: string
  label: string
  ordinal: string | null
  searchText: string
  filledCount: number
  href: string
  /**
   * F0262 — the week's slide deck, straight from the archive. The prototype put
   * "Open Slides" on the archive row; here the link was dropped at the data
   * layer, so finding last month's deck meant opening the week first.
   */
  slideLink: string | null
  /**
   * F0256 — what was actually in the week. A hit that says only "2nd Week of SEP
   * · 6 filled" makes a servant who searched for a saint open the week to find
   * out whether it is the one they meant.
   */
  topics: string[]
}

/**
 * The prototype's "Search lessons, saints, verses…" box above the archive
 * (OG L8614). It searched the saved **topics**, which is how a servant
 * actually looks for a week: "when did we do St. Moses?", not "what was the
 * week of the 14th?".
 *
 * With the box empty it renders the month accordion it was given, so the
 * ordinary view is untouched; typing replaces it with a flat list of hits,
 * because a match buried inside a collapsed month is not a search result.
 */
export function ArchiveSearch({ rows, children }: { rows: ArchiveSearchRow[]; children: React.ReactNode }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const hits = needle ? rows.filter((r) => r.searchText.includes(needle)) : []

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <label className="relative block w-full">
          <span className="sr-only">Search the archive</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
            placeholder="Search lessons, saints, verses…"
            autoComplete="off"
          />
        </label>
        {q ? (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Clear the search"
            className="shrink-0 rounded-[9px] border border-parch-200 p-2 text-parch-700 transition-colors hover:border-brand-gold hover:text-brand-800"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <Search className="h-4 w-4 shrink-0 text-parch-500" aria-hidden />
        )}
      </div>

      {!needle ? (
        children
      ) : hits.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-parch-300 px-4 py-8 text-center text-[12.5px] text-parch-500">
          Nothing in the archive matches &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card">
          <li className="border-b border-[#F3F0EB] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
            {hits.length} week{hits.length === 1 ? '' : 's'} match
          </li>
          {hits.map((r) => (
            <li
              key={r.weekStart}
              className="flex items-center gap-2 border-b-[0.5px] border-[#F0EEE8] pr-3 last:border-b-0"
            >
              <Link href={r.href} className="block flex-1 px-4 py-2.5 transition-colors hover:bg-brand-wash">
                <span className="block text-[12.5px] font-semibold text-parch-900">{r.ordinal ?? r.label}</span>
                <span className="block text-[11px] text-parch-500">
                  {r.ordinal ? `${r.label} · ` : ''}
                  {r.filledCount} filled
                </span>
                {r.topics.length > 0 && (
                  <span className="mt-0.5 block truncate text-[11px] text-parch-600">
                    {r.topics.slice(0, 3).join(' · ')}
                    {r.topics.length > 3 ? ` +${r.topics.length - 3} more` : ''}
                  </span>
                )}
              </Link>
              {/* F0262 — a sibling of the week link, not nested inside it: an
                  anchor within an anchor is invalid, and tapping the deck must
                  not also navigate to the week sheet. */}
              {r.slideLink && (
                <a
                  href={r.slideLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[10px] border border-parch-200 bg-parch-100 px-2.5 text-[11px] font-bold text-brand-800 transition-colors hover:border-brand-gold/60 hover:bg-brand-wash"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden />
                  Slides
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
