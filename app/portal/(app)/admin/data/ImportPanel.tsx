'use client'

import { useState, useTransition } from 'react'
import { Download, Upload, KeyRound, FileSpreadsheet, Eye } from 'lucide-react'
import {
  exportStudentsCsv,
  exportServantsCsv,
  importStudentsCsv,
  importServantsCsv,
  studentImportTemplateCsv,
  servantImportTemplateCsv,
} from '@/lib/portal/actions/data-tools'
import {
  Card,
  Callout,
  Badge,
  buttonClass,
  selectClass,
  TableWrap,
  Th,
  Td,
} from '@/components/portal/ui'
import { cn } from '@/lib/utils'
import type { ImportSummary } from '@/lib/portal/reports'

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

const STATUS_TONE = {
  created: 'good',
  updated: 'info',
  skipped: 'neutral',
  error: 'bad',
} as const

const CAPTION = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500'

export function ImportPanel({ classes }: { classes: Array<{ id: string; name: string }> }) {
  const [kind, setKind] = useState<'students' | 'servants'>('students')
  const [classId, setClassId] = useState<string>('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [csv, setCsv] = useState<string>('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  // A summary the admin has seen but not committed. The Help page promises a
  // preview before anything is written; the port wrote on file selection.
  const [isPreview, setIsPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function pickFile(file: File | undefined) {
    setError(null)
    setSummary(null)
    setIsPreview(false)
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setError('That file is larger than 4 MB. Split it into smaller batches.')
      return
    }
    setFileName(file.name)
    setCsv(await file.text())
  }

  function downloadTemplate() {
    setError(null)
    startTransition(async () => {
      // F0546 — servants had no template, so an admin adding the year's servants
      // in bulk guessed the column names. The two nobody guesses are `classes`
      // (semicolon-separated names or ids) and `titles`, which lines up
      // positionally with it.
      const result = kind === 'students' ? await studentImportTemplateCsv() : await servantImportTemplateCsv()
      if (!result.ok) return setError(result.error)
      saveCsv(result.data!.filename, result.data!.csv)
    })
  }

  function previewImport() {
    if (!csv.trim()) return setError('Choose a CSV file first.')
    setError(null)
    startTransition(async () => {
      // F0547 — servants get a preview too. Theirs is the more dangerous import:
      // a wrong `role` column makes somebody an ADMIN, and a `classes` column
      // rewrites who serves which class. It committed on the first click.
      const result =
        kind === 'students'
          ? await importStudentsCsv(csv, classId || null, { preview: true })
          : await importServantsCsv(csv, { preview: true })
      if (!result.ok) {
        setSummary(null)
        setIsPreview(false)
        return setError(result.error)
      }
      setSummary(result.data!)
      setIsPreview(true)
    })
  }

  function exportCsv() {
    setError(null)
    startTransition(async () => {
      const result = kind === 'students' ? await exportStudentsCsv(classId || null) : await exportServantsCsv()
      if (!result.ok) {
        setError(result.error)
        return
      }
      saveCsv(result.data!.filename, result.data!.csv)
    })
  }

  function runImport() {
    if (!csv.trim()) {
      setError('Choose a CSV file first.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result =
        kind === 'students' ? await importStudentsCsv(csv, classId || null) : await importServantsCsv(csv)
      if (!result.ok) {
        setSummary(null)
        setIsPreview(false)
        setError(result.error)
        return
      }
      setSummary(result.data!)
      setIsPreview(false)
    })
  }

  const newPins = summary?.rows.filter((r) => r.newPin) ?? []

  return (
    <Card title="Import & export" icon={<Upload className="h-4 w-4" />}>
      {/* The prototype's mode pills: the active one takes the burgundy→gold gradient. */}
      <div className="mb-4 flex gap-2">
        {(['students', 'servants'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k)
              setSummary(null)
              setError(null)
            }}
            className={cn(
              'min-h-[40px] rounded-[10px] px-4 py-2 text-[12px] font-bold capitalize transition-all',
              kind === k
                ? 'bg-[linear-gradient(120deg,#6F1D1B_0%,#7A2A2A_50%,#C89B3C_100%)] text-parch-50 shadow-[0_4px_12px_rgba(90,31,31,.28)]'
                : 'border border-parch-200 bg-parch-50 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      {kind === 'students' && (
        <label className="mb-3.5 block">
          <span className={CAPTION}>Class</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={cn(selectClass, 'min-h-[40px]')}
          >
            <option value="">All classes (export) · no default (import)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-[11px] text-parch-500">
            On import this is only used for rows whose Class column is blank. With
            no default picked, a blank Class leaves the student in the class they
            are already in — write <code>none</code> in that column to take them out.
          </span>
        </label>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={exportCsv} disabled={pending} className={buttonClass('secondary')}>
          <Download className="h-4 w-4" aria-hidden /> Export {kind} CSV
        </button>
        <button type="button" onClick={downloadTemplate} disabled={pending} className={buttonClass('secondary')}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden /> Download template
        </button>
        <label className={cn(buttonClass('secondary'), 'cursor-pointer')}>
          <Upload className="h-4 w-4" aria-hidden /> Choose CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void pickFile(e.target.files?.[0])} />
        </label>
        {fileName && <span className="text-[11px] text-parch-500">{fileName}</span>}
        <button type="button" onClick={previewImport} disabled={pending || !csv} className={buttonClass('secondary')}>
          <Eye className="h-4 w-4" aria-hidden /> Preview
        </button>
        <button type="button" onClick={runImport} disabled={pending || !csv} className={buttonClass('primary')}>
          {pending ? 'Working…' : isPreview ? 'Confirm import' : `Import ${kind}`}
        </button>
      </div>

      <Callout tone="info" title="How the import behaves">
        Rows are matched on the 4-digit ID: a known ID updates that person, a blank or unused ID creates a new account
        with a fresh PIN. An existing PIN is never changed, and no export ever contains a PIN or a hash.
      </Callout>

      {error && (
        <div className="mt-3.5">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}

      {summary && (
        <div className="mt-4 space-y-3.5">
          {isPreview && (
            <Callout tone="warn" title="Preview — nothing has been written yet">
              This is what the file would do. Check the rows below, then press{' '}
              <strong>Confirm import</strong> to apply it.
            </Callout>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge tone="good">{summary.created} {isPreview ? 'to add' : 'created'}</Badge>
            <Badge tone="info">{summary.updated} {isPreview ? 'to update' : 'updated'}</Badge>
            {summary.skipped > 0 && <Badge tone="neutral">{summary.skipped} skipped</Badge>}
            {summary.errors > 0 && <Badge tone="bad">{summary.errors} failed</Badge>}
          </div>

          {newPins.length > 0 && (
            <Callout tone="warn" title="New PINs — write these down now">
              <span className="mb-1 flex items-center gap-1.5 text-[11px]">
                <KeyRound className="h-3.5 w-3.5" aria-hidden /> They are not stored in readable form and cannot be
                shown again.
              </span>
              <ul className="mt-1 grid gap-0.5 text-[12.5px] tabular-nums sm:grid-cols-2">
                {newPins.map((r) => (
                  <li key={`${r.row}-${r.loginId}`}>
                    {r.name} — ID {r.loginId}, PIN {r.newPin}
                  </li>
                ))}
              </ul>
            </Callout>
          )}

          <TableWrap>
            <thead>
              <tr>
                <Th align="right">Row</Th>
                <Th>Name</Th>
                <Th>ID</Th>
                <Th>Result</Th>
                <Th>Message</Th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={`${r.row}-${r.loginId ?? 'new'}`}>
                  <Td align="right" className="tabular-nums text-parch-500">{r.row}</Td>
                  <Td className="font-semibold text-parch-900">{r.name}</Td>
                  <Td className="tabular-nums">{r.loginId ?? '—'}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  </Td>
                  <Td className="text-parch-600">{r.message ?? ''}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}
    </Card>
  )
}
