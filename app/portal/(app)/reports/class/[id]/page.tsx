import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, CalendarCheck, GraduationCap, Sparkles, Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listSessions, loadClassStudentRows } from '@/lib/portal/data/reports'
import { todayInNewYork, addDays, parseDateOnly } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { attendanceBand, BAND_LABEL, type Band } from '@/lib/portal/reports'
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  EmptyState,
  TableWrap,
  Th,
  Td,
  Tabs,
  TabLink,
} from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { ReportLetterhead } from '../../ReportLetterhead'

export const metadata = { title: 'Class report' }

type Mode = 'attendance' | 'exams' | 'points'

interface SearchParams {
  from?: string
  to?: string
  session?: string
  mode?: string
}

function bandTone(band: Band | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (band === 'excellent') return 'good'
  if (band === 'good') return 'warn'
  if (band === 'low') return 'bad'
  return 'neutral'
}

/**
 * The students behind one class's church-report numbers, for the period the
 * report was showing.
 *
 * The prototype opened this as a modal from the class card (OG L7519-7521 →
 * L7606-7628). The port's cards were inert, so a pastor looking at "62%" had
 * no way to find out who was missing — and no other screen answers the exact
 * query they just ran, since the class page only shows an all-time Sunday rate.
 */
export default async function ClassReportPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: SearchParams
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const hasChurchReport = user.role === 'ADMIN' || user.role === 'PASTOR' || user.stageOversight !== null
  const today = todayInNewYork()
  const requestedFrom = parseDateOnly(searchParams.from) ?? addDays(today, -90)
  const requestedTo = parseDateOnly(searchParams.to) ?? today
  const from = requestedFrom <= requestedTo ? requestedFrom : requestedTo
  const to = requestedTo
  const sessions = await listSessions()
  const sessionKey =
    searchParams.session && searchParams.session !== 'all' && sessions.some((s) => s.key === searchParams.session)
      ? searchParams.session
      : null
  const mode: Mode =
    searchParams.mode === 'exams' || searchParams.mode === 'points' ? searchParams.mode : 'attendance'

  // Ordinary class access, so a servant can print their own class — not the
  // church-report scope, which a plain servant does not have at all.
  const { cls, rows } = await loadClassStudentRows(user, { classId: params.id, from, to, sessionKey })

  // The chosen mode decides the order, as it did in the prototype: whichever
  // number you came in on is the one you want the list sorted by.
  const sorted = rows.slice().sort((a, b) => {
    if (mode === 'exams') return (b.quizAverage ?? -1) - (a.quizAverage ?? -1)
    if (mode === 'points') return b.points - a.points
    return (b.rate ?? -1) - (a.rate ?? -1)
  })

  const period = `${formatLongDate(from)} → ${formatLongDate(to)}`
  const sessionLabel = sessionKey ? sessions.find((s) => s.key === sessionKey)?.label ?? sessionKey : 'All sessions'
  const query = `?from=${from}&to=${to}${sessionKey ? `&session=${sessionKey}` : ''}`

  const attended = rows.reduce((n, r) => n + r.attended, 0)
  const held = rows.reduce((n, r) => n + r.held, 0)
  const classRate = held === 0 ? null : Math.round((attended / held) * 100)
  const quizzed = rows.filter((r) => r.quizAverage !== null)
  const classQuiz = quizzed.length
    ? Math.round(quizzed.reduce((n, r) => n + (r.quizAverage ?? 0), 0) / quizzed.length)
    : null
  const pointsTotal = rows.reduce((n, r) => n + r.points, 0)

  return (
    <div className="portal-print-page">
      <PageHeader
        title={cls.name}
        icon={<BarChart3 className="h-5 w-5" />}
        subtitle={`${period} · ${sessionLabel}`}
        back={
          // Only admins, the pastor and a stage overseer have a church report to
          // go back to; for everyone else the class itself is the parent.
          hasChurchReport
            ? {
                href: `/portal/reports?tab=church&from=${from}&to=${to}${sessionKey ? `&session=${sessionKey}` : ''}&mode=${mode}`,
                label: 'Church reports',
              }
            : { href: `/portal/classes/${cls.id}`, label: cls.name }
        }
        actions={<PrintButton label="Print this class" />}
      />

      <Tabs>
        {(['attendance', 'exams', 'points'] as const).map((m) => (
          <TabLink key={m} href={`/portal/reports/class/${cls.id}${query}&mode=${m}`} active={mode === m}>
            {m === 'attendance' ? 'Attendance' : m === 'exams' ? 'Exam scores' : 'Points'}
          </TabLink>
        ))}
      </Tabs>

      <ReportLetterhead title={`${cls.name} — class report`} period={period} session={sessionLabel} />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Students" value={rows.length} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
        <StatCard
          label="Attendance"
          value={classRate === null ? '—' : `${classRate}%`}
          hint={`${attended} of ${held} expected`}
          tone={classRate === null ? 'default' : classRate >= 80 ? 'good' : classRate >= 50 ? 'warn' : 'bad'}
          icon={<CalendarCheck className="h-6 w-6" />}
        />
        <StatCard
          label="Quiz average"
          value={classQuiz === null ? '—' : `${classQuiz}%`}
          hint={`${quizzed.length} of ${rows.length} sat one`}
          icon={<GraduationCap className="h-6 w-6" />}
          accent="#2563EB"
        />
        <StatCard
          label="Points"
          value={pointsTotal.toLocaleString()}
          hint={rows.length ? `${Math.round(pointsTotal / rows.length)} per student` : undefined}
          icon={<Sparkles className="h-6 w-6" />}
          accent="#C89B3C"
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No students in this class yet" />
      ) : (
        <Card title={`Students (${sorted.length})`} bodyClassName="p-[18px] sm:p-4">
          <TableWrap>
            <thead>
              <tr>
                <Th align="right">#</Th>
                <Th>Student</Th>
                <Th align="right">Attended</Th>
                <Th align="right">Attendance</Th>
                <Th>Band</Th>
                <Th align="right">Quiz avg</Th>
                <Th align="right">Points</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const band = attendanceBand(r.rate)
                return (
                  <tr key={r.studentId}>
                    <Td align="right" className="tabular-nums text-parch-500">{i + 1}</Td>
                    <Td>
                      <Link href={`/portal/students/${r.studentId}`} className="font-semibold text-brand-900 hover:underline">
                        {r.name}
                      </Link>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {r.attended}
                      <span className="text-parch-400"> / {r.held}</span>
                    </Td>
                    <Td align="right" className="font-bold tabular-nums">{r.rate === null ? '—' : `${r.rate}%`}</Td>
                    <Td>{band ? <Badge tone={bandTone(band)}>{BAND_LABEL[band]}</Badge> : <span className="text-parch-400">—</span>}</Td>
                    <Td align="right" className="tabular-nums">
                      {r.quizAverage === null ? '—' : `${r.quizAverage}%`}
                      {r.quizCount > 0 && <span className="text-parch-400"> · {r.quizCount}</span>}
                    </Td>
                    <Td align="right" className="tabular-nums">{r.points.toLocaleString()}</Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
          <p className="pt-3 text-[11px] text-parch-500">
            Sorted by {mode === 'exams' ? 'quiz average' : mode === 'points' ? 'points' : 'attendance'}, highest first.
            An excused absence is left out of a student&rsquo;s denominator.
          </p>
        </Card>
      )}
    </div>
  )
}
