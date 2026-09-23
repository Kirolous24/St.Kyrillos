'use client'

import { useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Settings2, Share2, Upload } from 'lucide-react'
import { importAgendaCsv, shareAgendaWeek, type AgendaImportReport } from '@/lib/portal/actions/agenda'
import { Card, Callout, Field, buttonClass, inputClass, selectClass } from '@/components/portal/ui'
import { DownloadButton } from '@/components/portal/DownloadButton'
import { cn } from '@/lib/utils'

/** The prototype's inline picker label: 11px uppercase, bold, grey. */
const pickerLabel = 'mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500'
/** Its tool buttons are rounded-20 pills rather than square buttons. */
const toolPill = 'rounded-[20px]'

/** Class and week pickers that keep each other's selection in the URL. */
export function AgendaNav({
  classId,
  week,
  classes,
}: {
  classId: string
  week: string
  classes: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const pathname = usePathname()

  function go(nextClass: string, nextWeek: string) {
    router.push(`${pathname}?class=${encodeURIComponent(nextClass)}&week=${encodeURIComponent(nextWeek)}`)
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
      {classes.length > 1 && (
        <label className="block min-w-[180px] max-w-xs flex-1">
          <span className={pickerLabel}>Class</span>
          <select value={classId} onChange={(e) => go(e.target.value, week)} className={selectClass}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block min-w-[170px]">
        <span className={pickerLabel}>Jump to a date</span>
        <input
          type="date"
          value={week}
          onChange={(e) => e.target.value && go(classId, e.target.value)}
          className={inputClass}
        />
      </label>
    </div>
  )
}

export function AgendaTools({
  classId,
  className,
  weekStart,
  csv,
  blankCsv,
  shareTargets,
}: {
  classId: string
  className: string
  weekStart: string
  csv: string
  /** An empty school year in the importer's own shape (F0593/F0223). */
  blankCsv: string
  shareTargets: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [shareTo, setShareTo] = useState(shareTargets[0]?.id ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingCsv, setPendingCsv] = useState('')
  const [preview, setPreview] = useState<AgendaImportReport | null>(null)

  function share() {
    if (!shareTo) return
    setMessage(null)
    startTransition(async () => {
      const result = await shareAgendaWeek({ classId, weekStart, toClassId: shareTo })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      const dropped = result.data?.dropped ?? 0
      setMessage({
        kind: 'ok',
        text: `Copied this week into ${shareTargets.find((c) => c.id === shareTo)?.name ?? 'the other class'}.${
          dropped > 0 ? ` ${dropped} assignment${dropped === 1 ? '' : 's'} left blank — those servants do not serve there.` : ''
        }`,
      })
      router.refresh()
    })
  }

  /**
   * Choosing a file previews it. It used to import on selection, so a partial
   * spreadsheet could silently blank a term's planning before anyone saw a
   * single row — `writeWeek` writes every activity, which is what makes
   * clearing a field work and what makes a gap in the file destructive.
   */
  function onFile(file: File) {
    setMessage(null)
    setPreview(null)
    const reader = new FileReader()
    reader.onerror = () => setMessage({ kind: 'err', text: 'That file could not be read.' })
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      if (fileRef.current) fileRef.current.value = ''
      if (!text.trim()) return setMessage({ kind: 'err', text: 'That file is empty.' })
      setPendingCsv(text)
      startTransition(async () => {
        const result = await importAgendaCsv({ classId, csv: text, preview: true })
        if (!result.ok) return setMessage({ kind: 'err', text: result.error })
        setPreview(result.data!)
      })
    }
    reader.readAsText(file)
  }

  function commitImport() {
    if (!pendingCsv) return
    setMessage(null)
    startTransition(async () => {
      const result = await importAgendaCsv({ classId, csv: pendingCsv })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      const d = result.data!
      const replaced = d.plan.reduce((n, w) => n + w.willOverwrite + w.willBlank, 0)
      const parts = [
        `Imported ${d.weeks} week${d.weeks === 1 ? '' : 's'}${d.legacyFormat ? ' from the old app\u2019s format' : ''}.`,
      ]
      if (replaced > 0) parts.push(`${replaced} already-filled activit${replaced === 1 ? 'y was' : 'ies were'} replaced.`)
      if (d.skippedRows) {
        // Names the first few rather than only counting them: a servant who
        // imported 40 weeks and lost 3 rows needs to know which.
        const named = d.skippedDetail.map((r) => `row ${r.row} (${r.reason})`).join('; ')
        parts.push(
          `${d.skippedRows} row${d.skippedRows === 1 ? '' : 's'} skipped${named ? ` — ${named}` : ''}.`,
        )
      }
      if (d.unmatchedNames.length) parts.push(`Names not matched, left blank: ${d.unmatchedNames.join(', ')}.`)
      setMessage({ kind: 'ok', text: parts.join(' ') })
      setPreview(null)
      setPendingCsv('')
      router.refresh()
    })
  }

  return (
    <Card title="Agenda tools" icon={<Settings2 className="h-4 w-4" aria-hidden />}>
      <div className="space-y-4">
        {message && (
          <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>
            <p role="status">{message.text}</p>
          </Callout>
        )}

        {preview && (() => {
          const replacing = preview.plan.filter((w) => w.willOverwrite + w.willBlank > 0)
          const blanking = preview.plan.reduce((n, w) => n + w.willBlank, 0)
          return (
            <div className="rounded-[12px] border-[1.5px] border-brand-gold/50 bg-[#FDF5E4] p-3">
              <p className="text-[12.5px] font-bold text-parch-900">
                {preview.weeks} week{preview.weeks === 1 ? '' : 's'} in this file — nothing saved yet
              </p>
              {/* F0216 — say when the old app's format was recognised. An admin
                  who was told these files could not be imported needs to see
                  that it was read, and which reader read it. */}
              {preview.legacyFormat && (
                <p className="mt-1 text-[11.5px] font-semibold text-brand-gold-dark">
                  This is a schedule exported from the old app. Its one-row-per-week layout has been
                  read and converted — check the weeks below before saving.
                </p>
              )}
              {preview.skippedRows > 0 && (
                <div className="mt-1">
                  <p className="text-[11.5px] text-parch-600">
                    {preview.skippedRows} row{preview.skippedRows === 1 ? '' : 's'} could not be read and will be skipped.
                  </p>
                  {/* F0797 — which rows, and why. The bare count told a servant
                      nothing they could act on; both causes are a ten-second fix
                      in the spreadsheet once you know which column it is. */}
                  {preview.skippedDetail.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {preview.skippedDetail.map((r) => (
                        <li key={r.row} className="text-[11px] text-parch-500">
                          Row {r.row}: {r.reason}
                        </li>
                      ))}
                      {preview.skippedRows > preview.skippedDetail.length && (
                        <li className="text-[11px] text-parch-500">
                          …and {preview.skippedRows - preview.skippedDetail.length} more.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              {preview.unmatchedNames.length > 0 && (
                <p className="mt-1 text-[11.5px] text-parch-600">
                  Not matched to a servant, will be left blank: {preview.unmatchedNames.join(', ')}.
                </p>
              )}
              {replacing.length > 0 && (
                <div className="mt-2 rounded-[9px] border border-[#FCA5A5] bg-[#FEF2F2] p-2.5">
                  <p className="text-[12px] font-bold text-[#991B1B]">
                    {replacing.length} week{replacing.length === 1 ? '' : 's'} already have planning that this file changes
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11.5px] text-[#7F1D1D]">
                    {replacing.slice(0, 8).map((w) => (
                      <li key={w.weekStart}>
                        {w.label}: {w.willOverwrite > 0 ? `${w.willOverwrite} replaced` : ''}
                        {w.willOverwrite > 0 && w.willBlank > 0 ? ', ' : ''}
                        {w.willBlank > 0 ? `${w.willBlank} emptied` : ''}
                      </li>
                    ))}
                  </ul>
                  {blanking > 0 && (
                    <p className="mt-1.5 text-[11px] text-[#7F1D1D]">
                      An activity the file leaves empty is cleared, not left alone — that is how clearing a
                      field works. Fill those cells in the sheet if you want to keep them.
                    </p>
                  )}
                </div>
              )}
              <ul className="mt-2 max-h-[140px] space-y-0.5 overflow-y-auto text-[11.5px] text-parch-600">
                {preview.plan.map((w) => (
                  <li key={`all-${w.weekStart}`}>
                    {w.label} — {w.filled}/10 filled{w.existingFilled > 0 ? ` (now ${w.existingFilled}/10)` : ' (new)'}
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={commitImport} disabled={pending} className={buttonClass('primary', 'sm')}>
                  {pending ? 'Importing…' : 'Confirm import'}
                </button>
                <button type="button" onClick={() => { setPreview(null); setPendingCsv('') }} className={buttonClass('secondary', 'sm')}>
                  Cancel
                </button>
              </div>
            </div>
          )
        })()}

        <div>
          <p className="mb-2.5 text-[12.5px] text-parch-600">
            Export every saved week as a spreadsheet, edit it, and bring it back.
          </p>
          <div className="flex flex-wrap gap-2">
            <DownloadButton
              filename={`${classId}-agenda.csv`}
              content={csv}
              label="Export CSV"
              variant="secondary"
              className={toolPill}
            />
            {/* F0593 / F0223 — the prototype's gold "Blank Template" pill. A
                class with nothing saved yet has nothing to export, so without
                this there was no way to get a year to fill in offline. It is
                emitted in the importer's own shape, so what goes out can come
                back. */}
            <DownloadButton
              filename={`${classId}-agenda-blank.csv`}
              content={blankCsv}
              label="Blank template"
              variant="secondary"
              className={toolPill}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className={cn(buttonClass('secondary'), toolPill)}
            >
              <Upload className="h-4 w-4" aria-hidden /> Import CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Agenda CSV file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFile(file)
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-parch-500">
            Servants are matched by name against {className}. A name that does not match is left blank.
          </p>
        </div>

        <div className="border-t border-[#F0EEE8] pt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Share this week</p>
          {shareTargets.length === 0 ? (
            <p className="text-[12.5px] text-parch-500">There is no other class you can write to.</p>
          ) : (
            <div>
              <Field label="Copy into" htmlFor="share-to">
                <select id="share-to" value={shareTo} onChange={(e) => setShareTo(e.target.value)} className={selectClass}>
                  {shareTargets.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                onClick={share}
                disabled={pending}
                className={cn(buttonClass('secondary'), toolPill, 'w-full')}
              >
                <Share2 className="h-4 w-4" aria-hidden /> Copy this week over
              </button>
              <p className="mt-2 text-[11px] text-parch-500">
                {className} keeps its own agenda — sharing copies, it never moves anything.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
