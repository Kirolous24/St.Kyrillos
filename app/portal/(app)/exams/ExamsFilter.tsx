'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, FileQuestion, Pencil, Trash2, Unlock } from 'lucide-react'
import { deleteExams, bulkReopenExams } from '@/lib/portal/actions/exams'
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
import { monthLabel } from '@/lib/portal/reports'
import { accentFor } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'

/**
 * The exams grid — the prototype's exam list, one cream card per exam:
 * a solid class-coloured tile, the title in Playfair, a live/past dot, then
 * key/value lines and a submitted-vs-roster bar. Selection and bulk delete
 * behave exactly as they did in the table this replaces.
 */
interface MonthGroup {
  key: string
  label: string
  rows: ExamListRow[]
  isCurrent: boolean
  past: number
}

/**
 * The prototype's month sections (OG L5202-5254). A year of quizzes in one flat
 * grid is unreadable: it grouped by due month, marked the current one CURRENT,
 * counted how many of each group had already closed, opened the current month
 * and collapsed the rest, and always put undated exams last.
 */
function groupByMonth(rows: readonly ExamListRow[], today: string): MonthGroup[] {
  const thisMonth = today.slice(0, 7)
  const buckets = new Map<string, ExamListRow[]>()
  for (const row of rows) {
    const key = row.dueDate ? row.dueDate.slice(0, 7) : 'nodate'
    const list = buckets.get(key)
    if (list) list.push(row)
    else buckets.set(key, [row])
  }

  const groups: MonthGroup[] = Array.from(buckets.entries()).map(([key, list]) => ({
    key,
    label: key === 'nodate' ? 'No due date' : monthLabel(key),
    rows: list,
    isCurrent: key === thisMonth,
    past: list.filter((r) => r.dueDate !== null && r.dueDate < today).length,
  }))

  // Months still to come first, newest-first within each half, undated last.
  return groups.sort((a, b) => {
    if (a.key === 'nodate') return 1
    if (b.key === 'nodate') return -1
    const aPast = a.key < thisMonth
    const bPast = b.key < thisMonth
    if (aPast !== bPast) return aPast ? 1 : -1
    return a.key < b.key ? 1 : -1
  })
}

export function ExamsTable({
  rows,
  today,
  canWrite,
  roster = [],
}: {
  rows: ExamListRow[]
  today: string
  canWrite: boolean
  /** Students of the classes this user may write exams for — the bulk-reopen picker. */
  roster?: Array<{ id: string; name: string; classId: string | null }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reopenFor, setReopenFor] = useState<Set<string>>(new Set())
  const groups = useMemo(() => groupByMonth(rows, today), [rows, today])

  // Only past-due exams can be "reopened" — a live one is already open.
  const selectedRows = rows.filter((r) => selected.has(r.id))
  const overdue = selectedRows.filter((r) => r.dueDate !== null && r.dueDate < today)
  const reopenClassIds = new Set(overdue.map((r) => r.classId).filter(Boolean))
  const reopenRoster = roster.filter((s) => s.classId && reopenClassIds.has(s.classId))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function reopen() {
    setMessage(null)
    startTransition(async () => {
      const result = await bulkReopenExams({
        examIds: overdue.map((r) => r.id),
        studentIds: Array.from(reopenFor),
      })
      if (!result.ok) return setMessage({ kind: 'err', text: result.error })
      setMessage({
        kind: 'ok',
        text: `Reopened ${result.data!.exams} exam${result.data!.exams === 1 ? '' : 's'} for ${result.data!.students} student${result.data!.students === 1 ? '' : 's'}.`,
      })
      setReopening(false)
      setReopenFor(new Set())
      setSelected(new Set())
      router.refresh()
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
              {/* Acting on a term's worth of overdue quizzes at once — the
                  prototype's "Reopen Selected (N)" — had no equivalent here. */}
              {overdue.length > 0 && (
                <button type="button" onClick={() => setReopening((v) => !v)} className={buttonClass('secondary', 'sm')}>
                  <Unlock className="h-4 w-4" aria-hidden /> Reopen selected ({overdue.length})
                </button>
              )}
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

      {canWrite && reopening && overdue.length > 0 && (
        <Card title={`Reopen ${overdue.length} exam${overdue.length === 1 ? '' : 's'} for…`}>
          {reopenRoster.length === 0 ? (
            <p className="text-[12.5px] text-parch-500">Those exams have no class roster to pick from.</p>
          ) : (
            <>
              <p className="mb-2.5 text-[12px] text-parch-500">
                These students are added to each exam&rsquo;s existing list — nobody already granted access loses it.
              </p>
              <ul className="max-h-[220px] space-y-1 overflow-y-auto rounded-[10px] border border-parch-200 bg-parch-50 p-2">
                {reopenRoster.map((s) => (
                  <li key={s.id}>
                    <label className="flex min-h-[32px] cursor-pointer items-center gap-2.5 px-1 text-[12.5px]">
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={reopenFor.has(s.id)}
                        onChange={() =>
                          setReopenFor((prev) => {
                            const next = new Set(prev)
                            if (next.has(s.id)) next.delete(s.id)
                            else next.add(s.id)
                            return next
                          })
                        }
                      />
                      <span className="truncate text-parch-800">{s.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={reopen}
                  disabled={pending || reopenFor.size === 0}
                  className={buttonClass('primary', 'sm')}
                >
                  {pending ? 'Reopening…' : `Reopen for ${reopenFor.size}`}
                </button>
                <button type="button" onClick={() => setReopening(false)} className={buttonClass('secondary', 'sm')}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {groups.map((group) => (
        <details
          key={group.key}
          open={group.isCurrent || groups.length === 1}
          className="overflow-hidden rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 shadow-panel"
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-[18px] py-3.5">
            <span className="flex items-center gap-2">
              <span className="font-serif text-[14.5px] font-bold text-brand-800">{group.label}</span>
              {group.isCurrent && <Badge tone="gold">Current</Badge>}
            </span>
            <span className="flex items-center gap-2 text-[10.5px] font-semibold text-brand-gold-dark">
              {group.rows.length} exam{group.rows.length === 1 ? '' : 's'}
              {group.past > 0 && ` · ${group.past} past`}
              <span aria-hidden className="text-[13px] text-parch-500">▾</span>
            </span>
          </summary>
          <ul className="grid gap-3.5 border-t border-[#F0EBE3] p-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.rows.map((row) => (
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
        </details>
      ))}

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
          {/* F0480 — reopening is the only thing anyone wants from a past-due
              quiz, and it was three steps away: Open, read the page, find the
              card. Offered only once the exam is actually overdue, because a
              live quiz is already open and the word would mean nothing. Goes to
              the detail page, where "Reopen for students" is the first card. */}
          {canWrite && overdue && (
            <LinkButton
              href={`/portal/exams/${row.id}`}
              variant="gold"
              size="sm"
              data-reopen-link={row.id}
              title={`Reopen ${row.title} for students`}
            >
              <Unlock className="h-3.5 w-3.5" aria-hidden /> Reopen
            </LinkButton>
          )}
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
