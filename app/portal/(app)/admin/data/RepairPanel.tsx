'use client'

import { useState, useTransition } from 'react'
import { Wrench, Search } from 'lucide-react'
import { runRepair } from '@/lib/portal/actions/data-tools'
import { Card, Callout, Badge, buttonClass } from '@/components/portal/ui'
import type { RepairResult } from '@/lib/portal/reports'

type Tool =
  | 'recount-classes'
  | 'close-returned-cases'
  | 'orphan-points'
  | 'normalise-phones'
  | 'clear-import-flags'
  | 'check-attendance-points'

const TOOLS: Array<{ key: Tool; label: string; description: string; readOnly?: boolean }> = [
  {
    key: 'recount-classes',
    label: 'Verify class rosters',
    description:
      'Counts the students in every class. Counts are computed live from the students table, so this reports rather than rewrites.',
    readOnly: true,
  },
  {
    key: 'close-returned-cases',
    label: 'Close cases for students who are back',
    description: 'Closes automatic follow-up cases where the student has since been marked present at Sunday School.',
  },
  {
    key: 'orphan-points',
    label: 'Repair orphaned point entries',
    description:
      'Point entries left without a class when a class was deleted: re-linked to the student’s class, or deleted when the student has none.',
  },
  {
    key: 'normalise-phones',
    label: 'Normalise phone numbers',
    description: 'Rewrites parent and account phone numbers to plain digits so they match and dial correctly.',
  },
  {
    key: 'clear-import-flags',
    label: 'Clear review flags',
    description: 'Removes the “needs review” note the migration left on imported students, once you have checked them.',
  },
  {
    /* F0668 — the prototype's "find attendance with missing points", as a check
       and nothing more. Its old version deleted the attendance records it found,
       which here would be a loaded gun aimed at a problem that no longer exists:
       a mark and its point are written in one transaction. The reassurance is
       what the admin wanted; the delete was never the useful part. */
    key: 'check-attendance-points',
    label: 'Check attendance points',
    description:
      'Looks for present marks on a scoring session that have no point entry. Reports only — it never changes anything, and re-saving that day’s register writes any missing points.',
    readOnly: true,
  },
]

export function RepairPanel() {
  const [results, setResults] = useState<Record<string, RepairResult>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function run(tool: Tool, dryRun: boolean) {
    setBusy(`${tool}:${dryRun}`)
    setErrors((prev) => ({ ...prev, [tool]: '' }))
    startTransition(async () => {
      const result = await runRepair({ tool, dryRun })
      setBusy(null)
      if (!result.ok) {
        setErrors((prev) => ({ ...prev, [tool]: result.error }))
        return
      }
      setResults((prev) => ({ ...prev, [tool]: result.data! }))
    })
  }

  return (
    <Card title="Data repair" icon={<Wrench className="h-4 w-4" />}>
      <p className="mb-3.5 text-[12.5px] text-parch-600">
        Every tool checks first and tells you exactly how many rows it would touch. Nothing is written until you press
        Run.
      </p>

      {/* F0843 — an admin trained on the prototype opens this card looking for
          four tools by name, finds five different ones, and has no way to tell
          whether the repair went missing or the damage did. Saying so once is
          cheaper than an admin deciding the portal cannot fix a class list. */}
      <div className="mb-3.5">
        <Callout tone="info" title="Four of the prototype's repair tools are gone on purpose">
          Fix Broken Student Names, Fix Class Servant Lists, Fix Student Birthdates and Fix Servant Stage Names all
          repaired data that had been copied from one record into another. Names, class servant lists, dates of birth
          and stage names are now single rows that everything else points at, so they cannot fall out of step and there
          is nothing left for those four to repair.
        </Callout>
      </div>

      <ul className="divide-y divide-[#F3F0EB]">
        {TOOLS.map((tool) => {
          const result = results[tool.key]
          const checked = result?.dryRun === true
          const error = errors[tool.key]
          return (
            <li key={tool.key} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-parch-900">{tool.label}</p>
                  <p className="mt-0.5 text-[12px] text-parch-600">{tool.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => run(tool.key, true)}
                    disabled={busy !== null}
                    className={buttonClass('secondary', 'sm')}
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden />
                    {busy === `${tool.key}:true` ? 'Checking…' : 'Check'}
                  </button>
                  {!tool.readOnly && (
                    <button
                      type="button"
                      onClick={() => run(tool.key, false)}
                      disabled={busy !== null || !checked || (result?.found ?? 0) === 0}
                      className={buttonClass('primary', 'sm')}
                      title={!checked ? 'Run a check first' : undefined}
                    >
                      {busy === `${tool.key}:false` ? 'Running…' : `Run${result ? ` (${result.found})` : ''}`}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-2.5">
                  <Callout tone="bad">{error}</Callout>
                </div>
              )}

              {result && (
                <div className="mt-2.5 rounded-[12px] border border-parch-200 bg-brand-wash/50 px-3.5 py-2.5 text-[12px]">
                  <p className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={result.dryRun ? 'info' : result.changed > 0 ? 'good' : 'neutral'}>
                      {result.dryRun ? 'Checked' : 'Done'}
                    </Badge>
                    <span className="font-semibold text-parch-700">
                      {result.found} found{result.dryRun ? '' : ` · ${result.changed} changed`}
                    </span>
                  </p>
                  {result.detail.length > 0 && (
                    <ul className="ml-4 list-disc space-y-0.5 text-parch-600">
                      {result.detail.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
