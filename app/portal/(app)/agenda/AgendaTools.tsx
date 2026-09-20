'use client'

import { useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Settings2, Share2, Upload } from 'lucide-react'
import { importAgendaCsv, shareAgendaWeek } from '@/lib/portal/actions/agenda'
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
  shareTargets,
}: {
  classId: string
  className: string
  weekStart: string
  csv: string
  shareTargets: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [shareTo, setShareTo] = useState(shareTargets[0]?.id ?? '')
  const fileRef = useRef<HTMLInputElement>(null)

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

  function onFile(file: File) {
    setMessage(null)
    const reader = new FileReader()
    reader.onerror = () => setMessage({ kind: 'err', text: 'That file could not be read.' })
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      if (!text.trim()) return setMessage({ kind: 'err', text: 'That file is empty.' })
      startTransition(async () => {
        const result = await importAgendaCsv({ classId, csv: text })
        if (fileRef.current) fileRef.current.value = ''
        if (!result.ok) return setMessage({ kind: 'err', text: result.error })
        const d = result.data
        const parts = [`Imported ${d?.weeks ?? 0} week${d?.weeks === 1 ? '' : 's'}.`]
        if (d?.skippedRows) parts.push(`${d.skippedRows} row${d.skippedRows === 1 ? '' : 's'} skipped.`)
        if (d?.unmatchedNames?.length) parts.push(`Names not on this class, left blank: ${d.unmatchedNames.join(', ')}.`)
        setMessage({ kind: 'ok', text: parts.join(' ') })
        router.refresh()
      })
    }
    reader.readAsText(file)
  }

  return (
    <Card title="Agenda tools" icon={<Settings2 className="h-4 w-4" aria-hidden />}>
      <div className="space-y-4">
        {message && (
          <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>
            <p role="status">{message.text}</p>
          </Callout>
        )}

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
