'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/portal/Link'
import { Download, Upload, Eye, CheckCircle2 } from 'lucide-react'
import { importMembersCsv, memberTemplateCsv, type ImportMemberRow } from '@/lib/portal/actions/fellowship'
import { Card, Callout, Badge, buttonClass, textareaClass, TableWrap, Th, Td } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

type Result = {
  rows: ImportMemberRow[]
  counts: { added: number; linked: number; joined: number; already: number; problems: number }
  unread: string[]
}

const STATUS: Record<ImportMemberRow['status'], { label: string; tone: 'good' | 'info' | 'neutral' | 'bad' | 'gold' }> = {
  new: { label: 'New member', tone: 'good' },
  servant: { label: 'Servant — their login', tone: 'gold' },
  joins: { label: 'Already in the portal', tone: 'info' },
  already: { label: 'Already here', tone: 'neutral' },
  problem: { label: 'Not added', tone: 'bad' },
}

function downloadCsv(filename: string, csv: string) {
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

/**
 * Import members (2026-10-24): a sheet the servants already keep, uploaded as
 * CSV or pasted straight from Google Sheets. Preview, then import; a servant on
 * the sheet keeps their own login, and nobody is added twice.
 */
export function MemberImport({ classId, meetingName }: { classId: string; meetingName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Result | null>(null)
  const [done, setDone] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function pickFile(file: File | undefined) {
    if (!file) return
    setError('')
    setPreview(null)
    setDone(null)
    if (file.size > 400_000) return setError('That file is too big for a list of members.')
    setFileName(file.name)
    setText(await file.text())
  }

  function run(previewOnly: boolean) {
    setError('')
    startTransition(async () => {
      const r = await importMembersCsv(classId, text, { preview: previewOnly })
      if (!r.ok) {
        setPreview(null)
        return setError(r.error)
      }
      if (previewOnly) setPreview(r.data!)
      else {
        setDone(r.data!)
        setPreview(null)
        router.refresh()
      }
    })
  }

  const shown = done ?? preview
  const toAdd = preview ? preview.counts.added + preview.counts.linked + preview.counts.joined : 0

  return (
    <div className="space-y-5">
      <Card title="How to fill in the sheet" icon={<Download className="h-4 w-4" aria-hidden />}>
        <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-parch-700">
          <li>Use your own list, or the blank template below.</li>
          <li>
            One person per row. A <b>Name</b> column is enough (or <b>First Name</b> and <b>Last Name</b>); <b>Phone</b>,{' '}
            <b>Email</b>, <b>Birthday</b> (month/day/year) and <b>Note</b> are optional.
          </li>
          <li>Servants on the list are matched to their own login, so nobody gets a second one.</li>
          <li>
            Then either <b>copy the cells</b> in Google Sheets or Excel and paste them below, or download the sheet as CSV
            (File → Download → Comma-separated values) and choose the file.
          </li>
        </ol>
        <button
          type="button"
          className={cn(buttonClass('secondary', 'sm'), 'mt-3 min-h-[36px]')}
          onClick={() =>
            startTransition(async () => {
              const r = await memberTemplateCsv()
              if (r.ok) downloadCsv(r.data!.filename, r.data!.csv)
            })
          }
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Blank template
        </button>
      </Card>

      <Card title="Your list" icon={<Upload className="h-4 w-4" aria-hidden />}>
        <label className={cn(buttonClass('secondary', 'sm'), 'mb-3 min-h-[36px] cursor-pointer')}>
          <Upload className="h-3.5 w-3.5" aria-hidden /> Choose a CSV file
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void pickFile(e.target.files?.[0])} />
        </label>
        {fileName && <span className="ml-2 text-[12px] text-parch-600">{fileName}</span>}
        <label htmlFor="member-sheet" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
          Or paste it here
        </label>
        <textarea
          id="member-sheet"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFileName('')
            setPreview(null)
            setDone(null)
          }}
          rows={7}
          className={cn(textareaClass, 'font-mono text-[12px]')}
          placeholder={'Name\tPhone\tBirthday\nMina Testwell\t(615) 555-0147\t3/4/1990'}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending || !text.trim()} onClick={() => run(true)} className={cn(buttonClass('primary'), 'min-h-[40px]')}>
            <Eye className="h-4 w-4" aria-hidden /> {pending && !preview ? 'Reading…' : 'Preview'}
          </button>
          {preview && toAdd > 0 && (
            <button type="button" disabled={pending} onClick={() => run(false)} className={cn(buttonClass('gold'), 'min-h-[40px]')} data-testid="import-confirm">
              {pending ? 'Importing…' : `Add ${toAdd} to ${meetingName}`}
            </button>
          )}
        </div>
        {error && (
          <div role="alert" className="mt-3">
            <Callout tone="bad">{error}</Callout>
          </div>
        )}
      </Card>

      {done && (
        <div role="status">
          <Callout tone="good" title="Imported">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {done.counts.added} new, {done.counts.linked} servant{done.counts.linked === 1 ? '' : 's'}, {done.counts.joined} from other meetings
              {done.counts.already ? `, ${done.counts.already} already here` : ''}
              {done.counts.problems ? `, ${done.counts.problems} not added` : ''}.
            </span>{' '}
            <Link href={`/portal/classes/${classId}`} className="font-bold underline decoration-brand-gold underline-offset-2">
              Back to {meetingName}
            </Link>
          </Callout>
        </div>
      )}

      {shown && (
        <Card title={done ? 'What happened' : 'Preview'} bodyClassName="p-0">
          {shown.unread.length > 0 && (
            <p className="border-b border-[#F5F2ED] px-[18px] py-2.5 text-[12px] text-parch-600">
              Not read: {shown.unread.join(', ')}.
            </p>
          )}
          <TableWrap>
            <thead>
              <tr>
                <Th>Row</Th>
                <Th>Name</Th>
                <Th>{done ? 'Result' : 'Will be'}</Th>
              </tr>
            </thead>
            <tbody data-testid="import-rows">
              {shown.rows.map((r) => (
                <tr key={r.row} data-status={r.status}>
                  <Td className="tabular-nums text-parch-500">{r.row}</Td>
                  <Td className="font-semibold text-parch-900">{r.name || '—'}</Td>
                  <Td>
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    {r.message && <span className="ml-1.5 text-[11.5px] text-parch-600">{r.message}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}
    </div>
  )
}
