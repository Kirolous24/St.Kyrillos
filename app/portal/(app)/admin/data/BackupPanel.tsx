'use client'

import { useState, useTransition } from 'react'
import { Database, Download } from 'lucide-react'
import { buildBackup } from '@/lib/portal/actions/data-tools'
import { Card, Callout, buttonClass, checkboxClass, Badge } from '@/components/portal/ui'
import type { BackupSummary } from '@/lib/portal/reports'

/**
 * Downloads a string the server already produced. Written here rather than
 * reusing DownloadButton because that helper prepends a UTF-8 BOM for Excel,
 * which would make the JSON backup unparseable.
 */
function saveFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BackupPanel() {
  const [includePhotos, setIncludePhotos] = useState(false)
  const [summary, setSummary] = useState<BackupSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    setError(null)
    startTransition(async () => {
      const result = await buildBackup(includePhotos)
      if (!result.ok) {
        setSummary(null)
        setError(result.error)
        return
      }
      const data = result.data!
      setSummary(data)
      saveFile(data.filename, data.json, 'application/json')
    })
  }

  const empty = summary?.tables.filter((t) => t.rows === 0) ?? []

  return (
    <Card title="Full backup" icon={<Database className="h-4 w-4" />}>
      <p className="mb-3 text-[12.5px] text-parch-600">
        Every portal table in one JSON file, with a row count per table so nothing can go missing quietly. PIN hashes
        are never exported.
      </p>

      <label className="mb-3.5 flex min-h-[40px] items-center gap-2 text-[12.5px] text-parch-700">
        <input
          type="checkbox"
          checked={includePhotos}
          onChange={(e) => setIncludePhotos(e.target.checked)}
          className={checkboxClass}
        />
        Include photos (much larger file)
      </label>

      <button type="button" onClick={run} disabled={pending} className={buttonClass('primary')}>
        <Download className="h-4 w-4" aria-hidden /> {pending ? 'Collecting…' : 'Create and download backup'}
      </button>

      {error && (
        <div className="mt-3.5">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}

      {summary && (
        <div className="mt-4 space-y-3.5">
          <Callout tone="good" title="Backup downloaded">
            {summary.tables.length} tables · {summary.totalRows.toLocaleString()} rows ·{' '}
            {(summary.bytes / 1_048_576).toFixed(1)} MB
            {summary.photosIncluded ? ' · photos included' : ' · photos excluded'}
          </Callout>

          {empty.length > 0 && (
            <Callout tone="info" title="Empty tables in this export">
              {empty.map((t) => t.table).join(', ')} — exported, but with no rows yet.
            </Callout>
          )}

          {/* Row counts as a compact two-column list, not a table. */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Rows exported</p>
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {summary.tables.map((t) => (
                <li
                  key={t.table}
                  className="flex items-center justify-between gap-2 border-b border-[#F5F2ED] py-1.5 text-[12px]"
                >
                  <span className="truncate text-parch-600">{t.table}</span>
                  {t.rows === 0 ? (
                    <Badge tone="neutral">0</Badge>
                  ) : (
                    <span className="shrink-0 font-bold tabular-nums text-parch-900">{t.rows.toLocaleString()}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => saveFile(summary.filename, summary.json, 'application/json')}
            className={buttonClass('secondary', 'sm')}
          >
            <Download className="h-4 w-4" aria-hidden /> Download again
          </button>
        </div>
      )}
    </Card>
  )
}
