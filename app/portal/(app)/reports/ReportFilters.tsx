'use client'

import { useState, useTransition } from 'react'
import { Download, SlidersHorizontal } from 'lucide-react'
import { Card, buttonClass, inputClass, selectClass, checkboxClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/portal/action-result'

export interface FilterClass {
  id: string
  name: string
}

export interface FilterSession {
  key: string
  label: string
}

interface Props {
  /** Where the form submits — the page reads its own searchParams back. */
  basePath: string
  /** Carried through so the submitted URL stays on the same tab. */
  tab?: string
  classes?: FilterClass[]
  classId?: string
  month?: string
  /** The twelve school-year pills, from schoolYearMonths(). */
  months: { key: string; abbr: string; label: string }[]
  from?: string
  to?: string
  sessionKey?: string | null
  sessions?: FilterSession[]
  allowAllSessions?: boolean
  blank?: boolean
  /** Church tab only: 'range' | 'month' | 'all'. */
  period?: string
  /** Attendance tab only: 'one' | 'all' — one session, or the month grid. */
  view?: string
  show: {
    class?: boolean
    month?: boolean
    range?: boolean
    session?: boolean
    blank?: boolean
    period?: boolean
    view?: boolean
  }
}

/** The prototype's 11px uppercase field caption (its period bar and `.fs` labels). */
const CAPTION = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500'

/**
 * A plain GET form: the page is the single source of truth for what is shown,
 * every view is a shareable URL, and it still works with no JavaScript — which
 * matters when a servant is on a phone in the church hall.
 *
 * Visually this is the prototype's period bar: one cream card above the report,
 * captions in small uppercase, controls on a single wrapping row.
 */
export function ReportFilters({
  basePath,
  tab,
  classes = [],
  classId,
  month,
  months,
  from,
  to,
  sessionKey,
  sessions = [],
  allowAllSessions = false,
  blank = false,
  period = 'range',
  view = 'one',
  show,
}: Props) {
  return (
    <Card className="mb-5 print:hidden" bodyClassName="p-3.5 sm:p-4">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-3">
        {tab && <input type="hidden" name="tab" value={tab} />}

        <span className="hidden items-center gap-1.5 self-center pr-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 sm:inline-flex">
          <SlidersHorizontal className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden /> Period
        </span>

        {show.class && (
          <label className="block min-w-[10rem] flex-1 sm:flex-none">
            <span className={CAPTION}>Class</span>
            <select name="class" defaultValue={classId} className={cn(selectClass, 'min-h-[40px] sm:min-w-[12rem]')}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* The prototype's three period buttons (OG L7415-7429). The port had
            From/To only, and silently defaulted to the last 90 days with
            nothing on screen saying so. */}
        {show.period && (
          <label className="block min-w-[9rem] flex-1 sm:flex-none">
            <span className={CAPTION}>Period</span>
            <select name="period" defaultValue={period} className={cn(selectClass, 'min-h-[40px] sm:min-w-[10rem]')}>
              <option value="range">Date range</option>
              <option value="month">By month</option>
              <option value="all">All time</option>
            </select>
          </label>
        )}

        {show.view && (
          <label className="block min-w-[9rem] flex-1 sm:flex-none">
            <span className={CAPTION}>View</span>
            <select name="view" defaultValue={view} className={cn(selectClass, 'min-h-[40px] sm:min-w-[10rem]')}>
              <option value="one">One session</option>
              <option value="all">All sessions</option>
            </select>
          </label>
        )}

        {show.month && (
          <label className="block min-w-[9rem] flex-1 sm:flex-none">
            <span className={CAPTION}>Month</span>
            <input type="month" name="month" defaultValue={month} className={cn(inputClass, 'min-h-[40px]')} />
          </label>
        )}

        {/* F0139 / F0441 — the prototype's row of twelve month pills. The native
            month input above is three interactions to reach October and gives no
            sense of the school year at all; these are one tap each and are how
            the church talks about the year, which starts in September. The input
            stays for any month outside it. */}
        {show.month && (
          <div className="flex w-full flex-wrap gap-1.5 print:hidden">
            {months.map((m) => {
              const active = m.key === month
              return (
                <button
                  key={m.key}
                  type="submit"
                  name="month"
                  value={m.key}
                  aria-label={m.label}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'rounded-[20px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] transition-colors',
                    active
                      ? 'border-brand-gold bg-brand-wash text-brand-800'
                      : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800',
                  )}
                >
                  {m.abbr}
                </button>
              )
            })}
          </div>
        )}

        {show.range && (
          <>
            <label className="block min-w-[9rem] flex-1 sm:flex-none">
              <span className={CAPTION}>From</span>
              <input type="date" name="from" defaultValue={from} className={cn(inputClass, 'min-h-[40px]')} />
            </label>
            <label className="block min-w-[9rem] flex-1 sm:flex-none">
              <span className={CAPTION}>To</span>
              <input type="date" name="to" defaultValue={to} className={cn(inputClass, 'min-h-[40px]')} />
            </label>
          </>
        )}

        {show.session && (
          <label className="block min-w-[9rem] flex-1 sm:flex-none">
            <span className={CAPTION}>Session</span>
            <select
              name="session"
              defaultValue={sessionKey ?? (allowAllSessions ? 'all' : '')}
              className={cn(selectClass, 'min-h-[40px] sm:min-w-[10rem]')}
            >
              {allowAllSessions && <option value="all">All sessions</option>}
              {sessions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* F0439 — the prototype had one button and it produced a print-ready
            blank grid covering the whole month, every session. Here it was a
            checkbox, then "Show report", then "Print" — and because the view
            defaults to one session, the form a servant carried into the hall
            covered one register out of six. One tap, all sessions, the month
            already on screen. */}
        {show.blank && (
          <a
            data-blank-form=""
            aria-current={blank ? 'page' : undefined}
            href={`${basePath}?${new URLSearchParams({
              ...(tab ? { tab } : {}),
              ...(classId ? { class: classId } : {}),
              ...(month ? { month } : {}),
              view: 'all',
              blank: '1',
            })}`}
            className={cn(buttonClass('gold'), 'min-h-[40px]')}
          >
            <Download className="h-4 w-4" aria-hidden /> Blank form for paper
          </a>
        )}

        <button type="submit" className={cn(buttonClass('primary'), 'min-h-[40px]')}>
          Show report
        </button>
      </form>
    </Card>
  )
}

/**
 * Runs a CSV export server action and hands the result straight to the browser.
 * The CSV is built on demand so a page render never carries it.
 */
export function CsvExportButton({
  run,
  label = 'Download CSV',
  variant = 'secondary',
}: {
  run: () => Promise<ActionResult<{ filename: string; csv: string }>>
  label?: string
  variant?: 'primary' | 'secondary' | 'gold'
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function download() {
    setError(null)
    startTransition(async () => {
      const result = await run()
      if (!result.ok) {
        setError(result.error)
        return
      }
      const data = result.data
      if (!data) {
        setError('Nothing to export.')
        return
      }
      const blob = new Blob([`﻿${data.csv}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1 print:hidden">
      <button type="button" onClick={download} disabled={pending} className={buttonClass(variant)}>
        <Download className="h-4 w-4" aria-hidden /> {pending ? 'Preparing…' : label}
      </button>
      {error && (
        <span role="alert" className="text-[11px] font-bold text-[#DC2626]">
          {error}
        </span>
      )}
    </span>
  )
}
