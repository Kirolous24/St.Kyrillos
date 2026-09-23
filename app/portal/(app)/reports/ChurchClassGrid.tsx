'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Printer } from 'lucide-react'
import { ClassCard, Badge, buttonClass, checkboxClass } from '@/components/portal/ui'
import { accentFor } from '@/lib/portal/accents'
import { STAGE_LABEL } from '@/lib/portal/format'
import { cn } from '@/lib/utils'

export type ReportMode = 'attendance' | 'exams' | 'points'

export interface ChurchClassRow {
  classId: string
  className: string
  stage: string | null
  students: number
  occasions: number
  attended: number
  held: number
  rate: number | null
  band: 'excellent' | 'good' | 'low' | null
  quizAverage: number | null
  quizCount: number
  quizBand: 'excellent' | 'good' | 'low' | null
  pointsTotal: number
  pointsPerStudent: number | null
}

function bandTone(band: 'excellent' | 'good' | 'low' | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (band === 'excellent') return 'good'
  if (band === 'good') return 'warn'
  if (band === 'low') return 'bad'
  return 'neutral'
}

/**
 * The prototype's church-report class grid: pick classes, print just those
 * (OG L7431-7433), and click a class to see the students behind its number
 * (OG L7519-7521). The port rendered inert cards and one print-everything
 * button, so a coordinator could not be handed their own classes' sheet and
 * nobody could see who was dragging a class average down.
 *
 * Selection filters the printout rather than the screen: hiding cards on screen
 * would mean re-picking them every time you wanted to look at another class.
 */
export function ChurchClassGrid({
  rows,
  mode,
  query,
}: {
  rows: ChurchClassRow[]
  mode: ReportMode
  /** The current report's filters, carried into each class's drill-in. */
  query: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const someSelected = selected.size > 0
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.classId))
  /**
   * F0776 — the classes to drop from the printout. Empty when nothing is selected
   * (print everything) and empty again when everything is selected, so the rule
   * is never emitted with no selector in front of it — that is malformed CSS.
   * Ids are filtered to slug characters before being put in a selector.
   */
  const hiddenOnPaper = someSelected
    ? rows
        .filter((r) => !selected.has(r.classId) && /^[A-Za-z0-9_-]+$/.test(r.classId))
        .map((r) => `[data-print-class="${r.classId}"]`)
    : []

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** The metric the chosen mode leads with, as the prototype's modes did. */
  function headlineRow(r: ChurchClassRow) {
    if (mode === 'exams') {
      return {
        key: 'Quiz average',
        value:
          r.quizAverage === null ? (
            <span className="text-parch-400">—</span>
          ) : (
            <Badge tone={bandTone(r.quizBand)}>{r.quizAverage}% · {r.quizCount}</Badge>
          ),
      }
    }
    if (mode === 'points') {
      return {
        key: 'Points per student',
        value:
          r.pointsPerStudent === null ? (
            <span className="text-parch-400">—</span>
          ) : (
            <Badge tone="gold">{r.pointsPerStudent.toLocaleString()}</Badge>
          ),
      }
    }
    return {
      key: 'Attendance',
      value:
        r.rate === null ? <span className="text-parch-400">—</span> : <Badge tone={bandTone(r.band)}>{r.rate}%</Badge>,
    }
  }

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-2 print:hidden">
        <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-[12px] font-bold text-parch-700">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={allSelected}
            aria-label="Select every class"
            onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.classId)) : new Set())}
          />
          Select all
        </label>
        <button
          type="button"
          onClick={() => window.print()}
          className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}
        >
          <Printer className="h-4 w-4" aria-hidden />
          {someSelected ? `Print selected (${selected.size})` : 'Print all classes'}
        </button>
        {someSelected && (
          <button type="button" onClick={() => setSelected(new Set())} className={buttonClass('secondary', 'sm')}>
            Clear
          </button>
        )}
      </div>

      {/* F0776 — the per-class student tables are rendered by the server page, so
          they cannot read this component's state. Rather than reach into the DOM,
          emit one print-media rule naming the classes that are NOT selected: the
          cards and their tables then leave the printout together. Ids are
          filtered to slug characters before going into a selector. */}
      {hiddenOnPaper.length > 0 && (
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `@media print { ${hiddenOnPaper.join(',')} { display: none !important } }`,
          }}
        />
      )}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.classId}
            className={cn(
              'relative',
              // Unselected classes drop out of the printout, not the screen.
              someSelected && !selected.has(r.classId) && 'print:hidden',
            )}
          >
            <label className="absolute right-3 top-3 z-10 cursor-pointer p-1 print:hidden">
              <input
                type="checkbox"
                className={checkboxClass}
                data-class-select=""
                checked={selected.has(r.classId)}
                aria-label={`Select ${r.className}`}
                onChange={() => toggle(r.classId)}
              />
            </label>
            <ClassCard
              href={`/portal/reports/class/${r.classId}${query}`}
              name={r.className}
              accent={accentFor(r.classId)}
              icon={<GraduationCap className="h-5 w-5" />}
              rows={[
                ...(r.stage ? [{ key: 'Stage', value: STAGE_LABEL[r.stage as keyof typeof STAGE_LABEL] }] : []),
                { key: 'Students', value: r.students },
                headlineRow(r),
                { key: 'Sessions held', value: r.occasions },
                {
                  key: 'Attended',
                  value: (
                    <>
                      {r.attended}
                      <span className="text-parch-400"> / {r.held}</span>
                    </>
                  ),
                },
                ...(mode !== 'exams'
                  ? [{
                      key: 'Quiz average',
                      value:
                        r.quizAverage === null ? (
                          <span className="text-parch-400">—</span>
                        ) : (
                          <Badge tone={bandTone(r.quizBand)}>{r.quizAverage}% · {r.quizCount}</Badge>
                        ),
                    }]
                  : []),
                ...(mode !== 'points' ? [{ key: 'Points', value: r.pointsTotal.toLocaleString() }] : []),
              ]}
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-parch-500 print:hidden">
        <Link href={`/portal/reports/class/${rows[0]?.classId ?? ''}${query}`} className="font-semibold text-brand-800 underline">
          Open a class
        </Link>{' '}
        to see the students behind its numbers.
      </p>
    </>
  )
}
