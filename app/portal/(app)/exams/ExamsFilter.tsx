'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, FileQuestion, Pencil, Trash2 } from 'lucide-react'
import { deleteExams } from '@/lib/portal/actions/exams'
import type { ExamListRow } from '@/lib/portal/data/exams'
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  IconTile,
  LinkButton,
  ProgressBar,
  buttonClass,
  checkboxClass,
} from '@/components/portal/ui'
import { formatLongDate } from '@/lib/portal/format'
import { scoreBand, SCORE_BAND_TONE } from '@/lib/portal/exams'
import { accentFor } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'

/**
 * The exams grid — the prototype's exam list, one cream card per exam:
 * a solid class-coloured tile, the title in Playfair, a live/past dot, then
 * key/value lines and a submitted-vs-roster bar. Selection and bulk delete
 * behave exactly as they did in the table this replaces.
 */
export function ExamsTable({ rows, today, canWrite }: { rows: ExamListRow[]; today: string; canWrite: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function remove() {
    setMessage(null)
    startTransition(async () => {
      const result = await deleteExams(Array.from(selected))
      if (!result.ok) {
        setConfirming(false)
        return setMessage({ kind: 'err', text: result.error })
      }
      setMessage({ kind: 'ok', text: `Deleted ${result.data?.deleted} exam${result.data?.deleted === 1 ? '' : 's'}.` })
      setSelected(new Set())
      setConfirming(false)
      router.refresh()
    })
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No exams yet"
        hint="Create one question by question, or import a whole quiz from a spreadsheet."
        action={canWrite ? <LinkButton href="/portal/exams/new">New exam</LinkButton> : undefined}
      />
    )
  }

  return (
    <div className="space-y-3">
      {message && <Callout tone={message.kind === 'ok' ? 'good' : 'bad'}>{message.text}</Callout>}

      {canWrite && selected.size > 0 && (
        <Callout tone="warn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {selected.size} exam{selected.size === 1 ? '' : 's'} selected. Deleting also removes their results and the
              points they awarded.
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelected(new Set())} className={buttonClass('secondary', 'sm')}>
                Clear
              </button>
              {confirming ? (
                <button type="button" onClick={remove} disabled={pending} className={buttonClass('danger', 'sm')}>
                  {pending ? 'Deleting…' : 'Yes, delete'}
                </button>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className={buttonClass('danger', 'sm')}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </button>
              )}
            </div>
          </div>
        </Callout>
      )}

      <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <li key={row.id}>
            <ExamCard
              row={row}
              today={today}
              canWrite={canWrite}
              selected={selected.has(row.id)}
              onToggle={() => toggle(row.id)}
            />
          </li>
        ))}
      </ul>

      <p className="flex items-center gap-1.5 text-[11.5px] text-parch-500">
        <FileQuestion className="h-3.5 w-3.5" aria-hidden /> Averages count only students who submitted.
      </p>
    </div>
  )
}

function ExamCard({
  row,
  today,
  canWrite,
  selected,
  onToggle,
}: {
  row: ExamListRow
  today: string
  canWrite: boolean
  selected: boolean
  onToggle: () => void
}) {
  const overdue = !!row.dueDate && row.dueDate < today
  const band = row.averagePercentage === null ? null : scoreBand(row.averagePercentage)
  const accent = accentFor(row.classId ?? row.className)
  const handedIn = row.studentCount > 0 ? Math.round((row.submittedCount / row.studentCount) * 100) : 0

  return (
    <Card
      className={cn('h-full transition-shadow', selected && 'ring-2 ring-brand-gold')}
      bodyClassName="flex h-full flex-col p-0"
    >
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <IconTile accent={accent} size="sm" solid>
          <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
        </IconTile>
        <div className="min-w-0 flex-1">
          <Link
            href={`/portal/exams/${row.id}`}
            className="flex items-start gap-2 font-serif text-[14px] font-bold leading-snug text-parch-900 hover:text-brand-800"
          >
            <span
              aria-hidden
              className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: overdue ? '#A9A49B' : '#22C55E' }}
            />
            <span className="min-w-0">{row.title}</span>
          </Link>
          <p className="mt-1 truncate text-[11px] text-parch-500">
            {row.subject ? `${row.subject} · ` : ''}
            {row.questionCount} question{row.questionCount === 1 ? '' : 's'}
          </p>
        </div>
        {canWrite && (
          <label className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-[10px] hover:bg-brand-wash">
            <input
              type="checkbox"
              className={cn(checkboxClass, 'h-[18px] w-[18px]')}
              checked={selected}
              onChange={onToggle}
              aria-label={`Select ${row.title}`}
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {row.status === 'DRAFT' && <Badge tone="neutral">Draft</Badge>}
        {row.status === 'CLOSED' && <Badge tone="bad">Closed</Badge>}
        {row.status === 'PUBLISHED' && !overdue && <Badge tone="good">Open</Badge>}
        {overdue && <Badge tone="warn">Past due</Badge>}
        {row.reopenedCount > 0 && <Badge tone="info">{row.reopenedCount} reopened</Badge>}
      </div>

      <div className="px-4">
        <Row label="Class" value={row.className} />
        <Row
          label="Due"
          value={row.dueDate ? formatLongDate(row.dueDate) : <span className="text-parch-400">No due date</span>}
        />
        <Row
          label="Average"
          value={
            band ? (
              <Badge tone={SCORE_BAND_TONE[band]}>{row.averagePercentage}%</Badge>
            ) : (
              <span className="text-parch-400">—</span>
            )
          }
        />
      </div>

      <div className="mt-auto px-4 pb-4 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Handed in</span>
          <span className="text-[12px] font-bold tabular-nums text-parch-800">
            {row.submittedCount}
            {row.studentCount > 0 && <span className="font-normal text-parch-500">/{row.studentCount}</span>}
          </span>
        </div>
        <ProgressBar value={handedIn} label={`${row.title} submissions`} />
        <div className="mt-3 flex items-center gap-2 print:hidden">
          <LinkButton href={`/portal/exams/${row.id}`} size="sm" className="flex-1">
            Open
          </LinkButton>
          {canWrite && (
            <LinkButton href={`/portal/exams/${row.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </LinkButton>
          )}
        </div>
      </div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-t border-[#F5F2ED] py-[7px] text-[12px]">
      <span className="shrink-0 text-parch-500">{label}</span>
      <span className="truncate text-right font-semibold text-parch-800">{value}</span>
    </div>
  )
}
