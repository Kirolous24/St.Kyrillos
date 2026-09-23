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

/** The church's own sheet shape (OG L17673-17681) — no Title, just a Day. */
const DAILY_SAMPLE = [
  'Day,Question,Option A,Option B,Option C,Option D,Correct Answer',
  '1,Who baptised the Lord Jesus?,St. John the Baptist,St. Peter,St. Paul,St. Andrew,A',
  '1,Where was the Lord baptised?,The Nile,The Jordan,The Red Sea,Galilee,B',
  '2,Who denied the Lord three times?,St. John,St. Peter,St. Paul,St. Andrew,B',
].join('\r\n')

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
  // Only read for a Day-based sheet. Defaulted to the month in view so the
  // common case needs no thought.
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [pointsPerQuestion, setPointsPerQuestion] = useState(2)
  // The header alone says which shape this is, exactly as the parser decides.
  const isDaily = csv.trim().length > 0 && !/(^|,)\s*"?(title|exam|quiz)"?\s*(,|$)/i.test(csv.split(/\r?\n/)[0] ?? '')

  /**
   * F0038 — an oversized sheet surfaced as "Something went wrong. Please try
   * again.": the only limit was a server-side `z.string().max(500_000)`, and a
   * ZodError is not a PortalError, so it fell into runAction's catch-all and the
   * admin was told nothing they could act on. Both bounds are the prototype's
   * (OG L16239-16265, 2MB and 500 rows), and the file input is cleared so the
   * next pick is not silently the same file again.
   */
  async function readFile(file: File | undefined) {
    if (!file) return
    const MAX_BYTES = 2 * 1024 * 1024
    const MAX_ROWS = 500
    const reject = (text: string) => {
      const el = document.getElementById('import-file')
      if (el instanceof HTMLInputElement) el.value = ''
      setFileName(null)
      setCsv('')
      setReport(null)
      setError(text)
    }
    if (file.size > MAX_BYTES) {
      return reject(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. A quiz sheet is only ever a few KB — check you picked the right file.`,
      )
    }
    const text = await file.text()
    const rows = text.split(/\r?\n/).filter((line) => line.trim()).length
    if (rows > MAX_ROWS) {
      return reject(`That file has ${rows} rows, far more than one quiz — check you picked the right file.`)
    }
    setFileName(file.name)
    setCsv(text)
    setError(null)
    setReport(null)
  }

  function run() {
    setError(null)
    setReport(null)
    if (!classId) return setError('Choose a class.')
    if (!csv.trim()) return setError('Choose a CSV file or paste its contents.')
    startTransition(async () => {
      const result = await importExamsCsv({ classId, csv, status, month, pointsPerQuestion })
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
        <div className="mt-4 flex flex-wrap gap-2">
          <DownloadButton filename="quiz-import-template.csv" content={SAMPLE} label="Download a template" />
          {/* The church's own sheets are this shape; the port rejected every
              row of one with "Missing exam title." */}
          <DownloadButton filename="daily-quiz-template.csv" content={DAILY_SAMPLE} label="Daily-quiz template" />
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

        {isDaily && (
          <div className="mb-3.5">
            <Callout tone="info" title="Daily-quiz sheet">
              This file has no Title column, so each day becomes its own quiz named
              “Daily Quiz — <em>date</em>”. Pick the month those day numbers belong to.
            </Callout>
            <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
              <Field label="Month" htmlFor="import-month">
                <input
                  id="import-month"
                  type="month"
                  className={inputClass}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </Field>
              <Field label="Points per question" htmlFor="import-points">
                <input
                  id="import-points"
                  type="number"
                  min={1}
                  max={100}
                  className={inputClass}
                  value={pointsPerQuestion}
                  onChange={(e) => setPointsPerQuestion(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                />
              </Field>
            </div>
          </div>
        )}

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
