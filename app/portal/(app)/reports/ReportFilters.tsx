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
  from?: string
  to?: string
  sessionKey?: string | null
  sessions?: FilterSession[]
  allowAllSessions?: boolean
  blank?: boolean
  show: { class?: boolean; month?: boolean; range?: boolean; session?: boolean; blank?: boolean }
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
  from,
  to,
  sessionKey,
  sessions = [],
  allowAllSessions = false,
  blank = false,
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

        {show.month && (
          <label className="block min-w-[9rem] flex-1 sm:flex-none">
            <span className={CAPTION}>Month</span>
            <input type="month" name="month" defaultValue={month} className={cn(inputClass, 'min-h-[40px]')} />
          </label>
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

        {show.blank && (
          <label className="flex min-h-[40px] items-center gap-2 text-[12.5px] font-semibold text-parch-700">
            <input type="checkbox" name="blank" value="1" defaultChecked={blank} className={checkboxClass} />
            Blank form for paper
          </label>
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
