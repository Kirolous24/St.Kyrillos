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
  dashboardExams,
} from '@/lib/portal/exams'
import { Badge, Card, LinkButton, ProgressBar } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

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
          {/* F0091 — the next deadline was one gold pill that read the same
              whether a quiz was due tomorrow or in three weeks. A child scans
              this card; the prototype gave the number the room and the colour
              so "2 DAYS" in amber lands without reading a sentence. The three
              tiers are the OG's own (due today / within two days / later);
              daysUntilDue already does the arithmetic in church time. */}
          {next && days !== null && (
            <div
              className={cn(
                'mt-2.5 flex items-center gap-3 rounded-[12px] border-[1.5px] px-3 py-2.5',
                days <= 0
                  ? 'border-[#F09595] bg-[#FCEBEB] text-[#791F1F]'
                  : days <= 2
                    ? 'border-[#FAC775] bg-[#FAEEDA] text-[#633806]'
                    : 'border-[#C0DD97] bg-[#EAF3DE] text-[#27500A]',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1px]">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Next exam
                </p>
                <p className="mt-0.5 truncate text-[13px] font-bold text-parch-900">{next.title}</p>
                <p className="mt-0.5 text-[12px] font-bold">
                  {days <= 0 ? 'Due today!' : days === 1 ? '1 day left' : `${days} days left`}
                </p>
              </div>
              {/* data-next-exam-days is a test hook: "2" on its own is not a
                  string a page check can tell from any other number here. */}
              <div className="shrink-0 text-center" data-next-exam-days={days}>
                <p className="font-serif text-[40px] font-bold leading-none">{Math.max(days, 0)}</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.5px]">{days === 1 ? 'Day' : 'Days'}</p>
              </div>
            </div>
          )}
          {next && days === null && (
            <p className="mt-2.5 flex items-center gap-1.5 rounded-[10px] bg-brand-wash px-2.5 py-1.5 text-[12px] font-bold text-brand-gold-dark">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{next.title}</span>
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
  /**
   * F0094 — the prototype's widget was "Recent Exams"; the port made it "Open
   * exams" and filtered on `dueDate >= today`, which quietly excluded the most
   * common case there is: a servant types up last Sunday's quiz on the Tuesday
   * after and dates it to the Sunday. That exam is born past due, so it never
   * appeared on the dashboard at all — the one surface that was supposed to say
   * "this exists now".
   *
   * A just-written exam therefore shows for two days whatever its due date says,
   * and is marked so nobody reads it as still open for submissions.
   */
  const { stillOpen, shown: open } = dashboardExams(rows, today, new Date())
  if (open.length === 0) return null

  // Counts only what is actually still open, so the headline number cannot be
  // inflated by an exam whose due date has already passed.
  const waiting = stillOpen.reduce((n, r) => n + Math.max(0, r.studentCount - r.submittedCount), 0)

  return (
    <Card
      title="Open exams"
      icon={<FileQuestion className="h-4 w-4" aria-hidden />}
      action={<LinkButton href="/portal/exams" variant="ghost" size="sm">All exams</LinkButton>}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] font-bold leading-none tracking-[-0.5px] text-brand-800 tabular-nums">
          {stillOpen.length}
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
                  {/* F0094 — says why a past-due exam is on this list, so it is
                      never read as still taking submissions. */}
                  {r.dueDate && r.dueDate < today && (
                    <Badge tone="neutral" data-fresh-exam={r.id}>
                      just added
                    </Badge>
                  )}
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
