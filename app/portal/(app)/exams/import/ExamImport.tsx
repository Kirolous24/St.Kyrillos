'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileSpreadsheet, ListChecks, Upload } from 'lucide-react'
import { importExamsCsv, type ImportReport } from '@/lib/portal/actions/exams'
import {
  Badge,
  Callout,
  Card,
  Field,
  LinkButton,
  TableWrap,
  Td,
  Th,
  buttonClass,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/portal/ui'
import { DownloadButton } from '@/components/portal/DownloadButton'
import { formatLongDate } from '@/lib/portal/format'

const SAMPLE = [
  'Title,Subject,Due Date,Bible Reading,Question,Option A,Option B,Option C,Option D,Correct',
  'St. Mark Chapter 1,Bible,2026-10-05,Mark 1,Who baptised the Lord Jesus?,St. John the Baptist,St. Peter,St. Paul,St. Andrew,A',
  'St. Mark Chapter 1,Bible,2026-10-05,Mark 1,Where was the Lord baptised?,The Nile,The Jordan,The Red Sea,Galilee,B',
].join('\r\n')

/** The prototype's numbered step: a burgundy disc with a gold numeral. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-800 text-[11px] font-bold text-brand-gold"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-parch-900">{title}</p>
        <p className="text-[12px] leading-relaxed text-parch-500">{children}</p>
      </div>
    </li>
  )
}

export function ExamImport({ classes }: { classes: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED')
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)

  async function readFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setCsv(await file.text())
    setError(null)
    setReport(null)
  }

  function run() {
    setError(null)
    setReport(null)
    if (!classId) return setError('Choose a class.')
    if (!csv.trim()) return setError('Choose a CSV file or paste its contents.')
    startTransition(async () => {
      const result = await importExamsCsv({ classId, csv, status })
      if (!result.ok) return setError(result.error)
      setReport(result.data ?? null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {error && <Callout tone="bad" title="Nothing was imported">{error}</Callout>}

      {report && (
        <Card
          title="Import finished"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          tone="brand"
          action={<Badge tone="good">{report.created.length} created</Badge>}
        >
          <p className="mb-3 text-[12.5px] text-parch-700">
            Created {report.created.length} quiz{report.created.length === 1 ? '' : 'zes'}
            {report.errors.length > 0 ? `, skipped ${report.errors.length} row${report.errors.length === 1 ? '' : 's'}.` : '.'}
          </p>
          <ul className="mb-4 space-y-1.5">
            {report.created.map((c) => (
              <li key={`${c.title}-${c.dueDate ?? ''}`} className="flex flex-wrap items-center gap-2 border-t border-[#F5F2ED] py-1.5 text-[12.5px] first:border-0">
                <Badge tone="good">{c.questions} question{c.questions === 1 ? '' : 's'}</Badge>
                <span className="font-semibold text-parch-900">{c.title}</span>
                {c.dueDate && <span className="text-parch-500">due {formatLongDate(c.dueDate)}</span>}
              </li>
            ))}
          </ul>
          {report.errors.length > 0 && (
            <TableWrap>
              <thead>
                <tr>
                  <Th className="w-20">Row</Th>
                  <Th>Why it was skipped</Th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((e) => (
                  <tr key={`${e.row}-${e.message}`}>
                    <Td className="tabular-nums">{e.row}</Td>
                    <Td className="text-[#991B1B]">{e.message}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          <div className="mt-4">
            <LinkButton href="/portal/exams" size="sm">Back to exams</LinkButton>
          </div>
        </Card>
      )}

      <Card title="How it works" icon={<ListChecks className="h-4 w-4" aria-hidden />}>
        <ol className="space-y-2.5">
          <Step n={1} title="Prepare the sheet">
            One row per question. Rows that share a title and due date become one quiz. Columns:{' '}
            <span className="font-semibold text-parch-800">Title</span>, Subject, Due Date,{' '}
            <span className="font-semibold text-parch-800">Question</span>, Option A–D (up to F),{' '}
            <span className="font-semibold text-parch-800">Correct</span> (a letter, a number, or the answer text),
            Bible Reading, Reading Message, Points Per Question.
          </Step>
          <Step n={2} title="Upload once">
            Fewer than four answers? Leave those Option columns out entirely — no need for blanks. A bad row is reported
            and skipped; the rest still import.
          </Step>
          <Step n={3} title="Done">
            Each quiz appears for the students on its due date. Import as drafts first if you want to check them over.
          </Step>
        </ol>
        <div className="mt-4">
          <DownloadButton filename="quiz-import-template.csv" content={SAMPLE} label="Download a template" />
        </div>
      </Card>

      <Card title="Import" icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Class" htmlFor="import-class">
            <select id="import-class" className={selectClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Visibility" htmlFor="import-status" hint="Import as drafts to check them first">
            <select id="import-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </Field>
        </div>

        <Field label="CSV file" htmlFor="import-file" hint={fileName ? `Loaded ${fileName}` : 'Or paste the rows below'}>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            className={inputClass}
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </Field>

        <Field label="Or paste CSV" htmlFor="import-text">
          <textarea
            id="import-text"
            className={textareaClass}
            rows={8}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value)
              setFileName(null)
            }}
            placeholder={SAMPLE}
          />
        </Field>

        <button type="button" onClick={run} disabled={pending || classes.length === 0} className={buttonClass('primary')}>
          <Upload className="h-4 w-4" aria-hidden /> {pending ? 'Importing…' : 'Import quizzes'}
        </button>
      </Card>
    </div>
  )
}
