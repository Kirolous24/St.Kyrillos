'use client'

import { useState, useTransition } from 'react'
import { Download, KeyRound, Upload } from 'lucide-react'
import { exportLoginsCsv, recoverPinsBatch } from '@/lib/portal/actions/logins'
import { parseRecoveryCsv, type RecoveryRow } from '@/lib/portal/recover-pins'
import { Callout, Card, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

function saveCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const CAPTION = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500'

/**
 * Option B's admin tools for logins: every ID and PIN as a spreadsheet, and
 * (below) the one-time recovery of the PINs people already use.
 */
export function LoginsPanel({ vaultEnabled }: { vaultEnabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RecoveryRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [progress, setProgress] = useState<{ done: number; sealed: number; already: number; changed: number; unknown: number } | null>(null)

  async function pickFile(file: File | undefined) {
    setError(null)
    setProgress(null)
    if (!file) return setRows(null)
    const parsed = parseRecoveryCsv(await file.text())
    setRows(parsed.rows)
    setSkipped(parsed.skipped)
  }

  // 25 rows per request: each row costs a bcrypt compare on the server.
  function recover() {
    if (!rows?.length) return
    setError(null)
    startTransition(async () => {
      const total = { done: 0, sealed: 0, already: 0, changed: 0, unknown: 0 }
      for (let i = 0; i < rows.length; i += 25) {
        const batch = rows.slice(i, i + 25)
        const r = await recoverPinsBatch(batch)
        if (!r.ok) return setError(r.error)
        total.done += batch.length
        total.sealed += r.data!.sealed
        total.already += r.data!.already
        total.changed += r.data!.changed
        total.unknown += r.data!.unknown
        setProgress({ ...total })
      }
    })
  }

  function exportKind(kind: 'servants' | 'students') {
    setError(null)
    setNote(null)
    startTransition(async () => {
      const r = await exportLoginsCsv(kind)
      if (!r.ok) return setError(r.error)
      saveCsv(r.data!.filename, r.data!.csv)
      setNote(
        `${r.data!.rows} ${kind} exported${
          r.data!.missing ? `; ${r.data!.missing} have no PIN on file yet (reissue them to fill the gap)` : ''
        }.`,
      )
    })
  }

  return (
    <Card title="IDs & PINs" icon={<KeyRound className="h-4 w-4" />}>
      {!vaultEnabled && (
        <div className="mb-3">
          <Callout tone="warn" title="PIN viewing is switched off">
            Set PORTAL_PIN_KEY on the site to keep and show the PINs the portal issues.
          </Callout>
        </div>
      )}
      <span className={CAPTION}>Export</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !vaultEnabled}
          onClick={() => exportKind('servants')}
          className={cn(buttonClass('secondary'), 'min-h-[40px]')}
        >
          <Download className="h-4 w-4" aria-hidden /> Servants — IDs &amp; PINs
        </button>
        <button
          type="button"
          disabled={pending || !vaultEnabled}
          onClick={() => exportKind('students')}
          className={cn(buttonClass('secondary'), 'min-h-[40px]')}
        >
          <Download className="h-4 w-4" aria-hidden /> Students — IDs &amp; PINs
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-parch-500">
        The students file holds every child&rsquo;s login. Print per class (Class → Logins &amp; PINs) rather than forwarding
        the file, and delete it when you are done. Every export is written to the activity log.
      </p>
      <div className="mt-5 border-t border-parch-200 pt-4">
        <span className={CAPTION}>Recover the PINs people already use</span>
        <p className="mb-2 text-[12px] text-parch-700">
          Upload the old app&rsquo;s <strong>id,pin</strong> file. A PIN is kept only if it still matches the one in use, so
          this never changes anybody&rsquo;s PIN. Delete the file afterwards.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={pending || !vaultEnabled}
          onChange={(e) => void pickFile(e.target.files?.[0])}
          className="block text-[12px] text-parch-700"
          aria-label="Old app id,pin file"
        />
        {rows && (
          <p className="mt-2 text-[12px] text-parch-700">
            {rows.length} row{rows.length === 1 ? '' : 's'} ready{skipped ? ` · ${skipped} skipped (not an ID and PIN)` : ''}.
          </p>
        )}
        <button
          type="button"
          disabled={pending || !vaultEnabled || !rows?.length}
          onClick={recover}
          className={cn(buttonClass('primary'), 'mt-2 min-h-[40px]')}
        >
          <Upload className="h-4 w-4" aria-hidden />{' '}
          {pending && progress ? `Working… ${progress.done}/${rows?.length ?? 0}` : `Recover ${rows?.length ?? 0} PINs`}
        </button>
        {progress && (
          <p role="status" className="mt-2 text-[12px] text-parch-800" data-testid="recover-result">
            Kept {progress.sealed} · already on file {progress.already} · changed since {progress.changed} · unknown ID{' '}
            {progress.unknown}
          </p>
        )}
      </div>
      {note && (
        <p role="status" className="mt-2 text-[12px] font-semibold text-[#15803D]">
          {note}
        </p>
      )}
      {error && (
        <div className="mt-3" role="alert">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
    </Card>
  )
}
