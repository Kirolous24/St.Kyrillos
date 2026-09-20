import Link from 'next/link'
import { CalendarClock, ClipboardList, FileQuestion } from 'lucide-react'
import type { PortalUser } from '@/lib/portal/permissions'
import { listExams, studentExams } from '@/lib/portal/data/exams'
import { todayInNewYork } from '@/lib/portal/dates'
import { formatMonthDay } from '@/lib/portal/format'
import {
  examStatusFor,
  daysUntilDue,
  scoreBand,
  SCORE_BAND_LABEL,
  SCORE_BAND_TONE,
  type ExamStudentStatus,
} from '@/lib/portal/exams'
import { Badge, Card, LinkButton, ProgressBar } from '@/components/portal/ui'

/**
 * Dashboard column: a student's pending quizzes and next deadline, or a
 * servant's open exams and how many have handed in. Returns null when there is
 * nothing worth a card.
 */
export async function ExamsWidget({ user }: { user: PortalUser }): Promise<JSX.Element | null> {
  return user.role === 'STUDENT' ? studentCard(user) : staffCard(user)
}

async function studentCard(user: PortalUser): Promise<JSX.Element | null> {
  if (!user.studentId) return null
  const { today, rows } = await studentExams(user.studentId)
  if (rows.length === 0) return null

  const submitted = rows.filter((r) => r.result).map((r) => r.id)
  const grouped: Record<ExamStudentStatus, typeof rows> = { available: [], completed: [], missed: [], upcoming: [] }
  for (const row of rows) grouped[examStatusFor(row, user.studentId, submitted, today)].push(row)

  const pending = grouped.available
  const next = pending.filter((r) => r.dueDate).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0]
  const days = next ? daysUntilDue(next.dueDate, today) : null
  const last = grouped.completed[0]

  if (pending.length === 0 && !last) return null

  return (
    <Card
      title="Quizzes"
      icon={<ClipboardList className="h-4 w-4" aria-hidden />}
      tone="brand"
      action={<LinkButton href="/portal/quizzes" variant="ghost" size="sm">Open</LinkButton>}
    >
      {pending.length === 0 ? (
        <p className="text-[12.5px] text-parch-500">Nothing waiting — you are all caught up.</p>
      ) : (
        <>
          <p className="text-[30px] font-bold leading-none tracking-[-0.5px] text-brand-800 tabular-nums">
            {pending.length}
          </p>
          <p className="mt-1 text-[12px] text-parch-500">
            quiz{pending.length === 1 ? '' : 'zes'} waiting for you
          </p>
          {next && (
            <p className="mt-2.5 flex items-center gap-1.5 rounded-[10px] bg-brand-wash px-2.5 py-1.5 text-[12px] font-bold text-brand-gold-dark">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">
                {days === null
                  ? next.title
                  : days <= 0
                    ? `"${next.title}" is due today`
                    : days === 1
                      ? `"${next.title}" is due tomorrow`
                      : `"${next.title}" — ${days} days left`}
              </span>
            </p>
          )}
          <ul className="mt-2.5">
            {pending.slice(0, 3).map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-2 border-t border-[#F5F2ED] py-[7px] text-[12px] first:border-0">
                <Link href={`/portal/quizzes/${q.id}`} className="min-w-0 flex-1 truncate font-semibold text-brand-900 hover:underline">
                  {q.title}
                </Link>
                <span className="shrink-0 text-[11px] text-parch-500">
                  {q.dueDate ? formatMonthDay(q.dueDate) : 'No deadline'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {last?.result && (
        <div className="mt-3.5 border-t border-parch-200 pt-3">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate text-parch-500">Last: {last.title}</span>
            <Badge tone={SCORE_BAND_TONE[scoreBand(last.result.percentage)]}>
              {last.result.percentage}% · {SCORE_BAND_LABEL[scoreBand(last.result.percentage)]}
            </Badge>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={last.result.percentage}
              tone={SCORE_BAND_TONE[scoreBand(last.result.percentage)]}
              label="Last quiz score"
            />
          </div>
        </div>
      )}
    </Card>
  )
}

async function staffCard(user: PortalUser): Promise<JSX.Element | null> {
  const today = todayInNewYork()
  const rows = await listExams(user, null)
  const open = rows
    .filter((r) => r.status === 'PUBLISHED' && (!r.dueDate || r.dueDate >= today))
    .sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    })
  if (open.length === 0) return null

  const waiting = open.reduce((n, r) => n + Math.max(0, r.studentCount - r.submittedCount), 0)

  return (
    <Card
      title="Open exams"
      icon={<FileQuestion className="h-4 w-4" aria-hidden />}
      action={<LinkButton href="/portal/exams" variant="ghost" size="sm">All exams</LinkButton>}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] font-bold leading-none tracking-[-0.5px] text-brand-800 tabular-nums">
          {open.length}
        </span>
        <span className="text-[12px] text-parch-500">
          open · {waiting} paper{waiting === 1 ? '' : 's'} still to come in
        </span>
      </div>
      <ul className="mt-3">
        {open.slice(0, 4).map((r) => {
          const pct = r.studentCount > 0 ? Math.round((r.submittedCount / r.studentCount) * 100) : 0
          return (
            <li key={r.id} className="flex items-center gap-3 border-t border-[#F5F2ED] py-2 first:border-0">
              <div className="min-w-0 flex-1">
                <Link href={`/portal/exams/${r.id}`} className="block truncate text-[12.5px] font-semibold text-brand-900 hover:underline">
                  {r.title}
                </Link>
                <p className="truncate text-[11px] text-parch-500">
                  {r.className}
                  {r.dueDate ? ` · due ${formatMonthDay(r.dueDate)}` : ' · no due date'}
                </p>
                {r.studentCount > 0 && (
                  <span className="mt-1 block w-full max-w-[140px]">
                    <ProgressBar value={pct} label={`${r.title} submissions`} />
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-parch-800">
                {r.submittedCount}
                {r.studentCount > 0 && <span className="font-normal text-parch-500">/{r.studentCount}</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
