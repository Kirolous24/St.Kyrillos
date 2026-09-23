import { notFound } from 'next/navigation'
import { BarChart3, CalendarCheck, GraduationCap, Sparkles, Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import {
  reportClasses,
  churchReportScope,
  listSessions,
  loadAttendanceMatrix,
  loadAllSessionsMatrix,
  loadChurchReport,
  loadChurchStudentRows,
} from '@/lib/portal/data/reports'
import { exportAttendanceMatrixCsv, exportChurchReportCsv, exportAttendanceDetailCsv } from '@/lib/portal/actions/reports'
import { todayInNewYork, addDays, parseDateOnly } from '@/lib/portal/dates'
import { formatLongDate, STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import {
  monthOf,
  monthLabel,
  monthRange,
  attendanceBand,
  BAND_LABEL,
  type Band,
  schoolYearMonths,
} from '@/lib/portal/reports'
import {
  PageHeader,
  Tabs,
  TabLink,
  Card,
  ClassCard,
  StatCard,
  Badge,
  Callout,
  EmptyState,
  LinkButton,
} from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { AttendanceMatrix } from './AttendanceMatrix'
import { AllSessionsMatrix } from './AllSessionsMatrix'
import { ChurchClassGrid, type ReportMode } from './ChurchClassGrid'
import { ReportLetterhead } from './ReportLetterhead'
import { PortalChart } from '@/components/portal/PortalChart'
import { ReportFilters, CsvExportButton } from './ReportFilters'

export const metadata = { title: 'Reports' }

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function bandTone(band: Band | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (band === 'excellent') return 'good'
  if (band === 'good') return 'warn'
  if (band === 'low') return 'bad'
  return 'neutral'
}

function rateTone(rate: number | null): 'default' | 'good' | 'warn' | 'bad' {
  if (rate === null) return 'default'
  return rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad'
}

interface SearchParams {
  tab?: string
  class?: string
  month?: string
  from?: string
  to?: string
  session?: string
  blank?: string
  /** Church tab: 'range' (default) | 'month' | 'all'. */
  period?: string
  /** Church tab: which metric leads. */
  mode?: string
  /** Attendance tab: 'one' (default) | 'all' — one session, or the month grid. */
  view?: string
}

/**
 * The prototype offered All Time as a period (OG L7415-7429). There is no
 * "beginning of time" to query, so this is simply earlier than any record the
 * church could hold — the portal's own data starts in 2025.
 */
const ALL_TIME_START = '2000-01-01'

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePortalUser()
  // Students have their own progress pages; reports are a servant's tool.
  if (user.role === 'STUDENT') notFound()

  const today = todayInNewYork()
  const [classes, churchScope, sessions] = await Promise.all([
    reportClasses(user),
    churchReportScope(user),
    listSessions(),
  ])
  const tab = searchParams.tab === 'church' && churchScope ? 'church' : 'attendance'

  const tabs = (
    <Tabs>
      <TabLink href="/portal/reports" active={tab === 'attendance'}>
        Attendance
      </TabLink>
      {churchScope && (
        <TabLink href="/portal/reports?tab=church" active={tab === 'church'}>
          Church reports
        </TabLink>
      )}
      <TabLink href="/portal/reports/cards" active={false}>
        Report cards
      </TabLink>
    </Tabs>
  )

  /* ── Church reports ─────────────────────────────────────────────────────── */
  if (tab === 'church') {
    // The port took From/To only and silently defaulted to the last 90 days,
    // with nothing on screen saying so — a pastor reading "62% attendance"
    // had no idea what period it covered.
    const period = searchParams.period === 'month' || searchParams.period === 'all' ? searchParams.period : 'range'
    const periodMonth = searchParams.month && MONTH_RE.test(searchParams.month) ? searchParams.month : monthOf(today)
    let from: string
    let to: string
    if (period === 'all') {
      from = ALL_TIME_START
      to = today
    } else if (period === 'month') {
      const range = monthRange(periodMonth)
      from = range.from
      to = range.to
    } else {
      from = parseDateOnly(searchParams.from) ?? addDays(today, -90)
      to = parseDateOnly(searchParams.to) ?? today
    }
    const sessionKey =
      searchParams.session && searchParams.session !== 'all' && sessions.some((s) => s.key === searchParams.session)
        ? searchParams.session
        : null
    const mode: ReportMode =
      searchParams.mode === 'exams' || searchParams.mode === 'points' ? searchParams.mode : 'attendance'

    const [report, studentRows] = await Promise.all([
      loadChurchReport(user, { from: from <= to ? from : to, to, sessionKey }),
      loadChurchStudentRows(user, { from: from <= to ? from : to, to, sessionKey }),
    ])
    if (!report) notFound()

    const scopeLabel =
      user.role === 'SERVANT' ? `${STAGE_LABEL[user.stageOversight ?? 'ELEMENTARY']} stage` : 'Church-wide'
    // Said in words, not just implied by two date boxes.
    const periodLabel =
      period === 'all'
        ? 'All time'
        : period === 'month'
          ? monthLabel(periodMonth)
          : `${formatLongDate(report.from)} → ${formatLongDate(report.to)}`
    const sessionLabel = sessionKey ? sessions.find((s) => s.key === sessionKey)?.label ?? sessionKey : 'All sessions'
    const classQuery = `?from=${report.from}&to=${report.to}${sessionKey ? `&session=${sessionKey}` : ''}&mode=${mode}`

    return (
      <div className="portal-print-page portal-print-landscape">
        <PageHeader
          title="Church reports"
          icon={<BarChart3 className="h-5 w-5" />}
          subtitle={`${scopeLabel} · ${periodLabel} · ${sessionLabel}`}
          actions={
            /* Printing lives with the class selection below, so there is one
               print control and it knows what was picked. */
            <CsvExportButton run={exportChurchReportCsv.bind(null, { from: report.from, to: report.to, sessionKey })} />
          }
        />
        {tabs}

        {/* The prototype's three report modes (OG L7332-7334). The port was one
            fixed view, and its Points figure was a raw class total, which makes
            a class of thirty look better than a class of ten by construction. */}
        <Tabs>
          {(['attendance', 'exams', 'points'] as const).map((m) => (
            <TabLink
              key={m}
              href={`/portal/reports?tab=church&period=${period}&month=${periodMonth}&from=${report.from}&to=${report.to}${sessionKey ? `&session=${sessionKey}` : ''}&mode=${m}`}
              active={mode === m}
            >
              {m === 'attendance' ? 'Attendance' : m === 'exams' ? 'Exam scores' : 'Points'}
            </TabLink>
          ))}
        </Tabs>

        <ReportFilters
          months={schoolYearMonths(today)}
        basePath="/portal/reports"
          tab="church"
          from={report.from}
          to={report.to}
          month={periodMonth}
          period={period}
          sessionKey={sessionKey}
          sessions={sessions}
          allowAllSessions
          show={{ period: true, range: true, month: true, session: true }}
        />

        <ReportLetterhead title={`${scopeLabel} report`} period={periodLabel} session={sessionLabel} />

        <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
          <StatCard
            label="Classes"
            value={report.totals.classes}
            icon={<GraduationCap className="h-6 w-6" />}
            accent="#4F46E5"
          />
          <StatCard label="Students" value={report.totals.students} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
          <StatCard
            label="Attendance"
            value={report.totals.rate === null ? '—' : `${report.totals.rate}%`}
            hint={`${report.totals.attended} of ${report.totals.held} expected`}
            tone={rateTone(report.totals.rate)}
            icon={<CalendarCheck className="h-6 w-6" />}
          />
          <StatCard
            label="Quiz average"
            value={report.totals.quizAverage === null ? '—' : `${report.totals.quizAverage}%`}
            hint={`${report.totals.quizCount} quizzes sat`}
            icon={<BarChart3 className="h-6 w-6" />}
            accent="#2563EB"
          />
          <StatCard
            label="Points awarded"
            value={report.totals.pointsTotal.toLocaleString()}
            icon={<Sparkles className="h-6 w-6" />}
            accent="#C89B3C"
          />
        </div>

        <div className="mb-5">
          <Callout tone="info" title="How attendance is counted">
            A session counts as held in a week if anyone in the class was marked for it that week. Every student is then
            expected at every held session; excused absences drop out of their denominator.
          </Callout>
        </div>

        {/* The prototype's church-wide bar chart. Straight off the report rows
            that are already loaded — no extra query — and only where there is
            more than one class to compare. */}
        {report.classes.filter((c) => c.quizAverage !== null).length >= 2 && (
          <Card className="mb-5" title="Average score by class" icon={<BarChart3 className="h-4 w-4" aria-hidden />}>
            <PortalChart
              kind="bar"
              colour="#C89B3C"
              points={report.classes
                .filter((c) => c.quizAverage !== null)
                .map((c) => ({ label: c.className, value: c.quizAverage }))}
              label="Average score"
              caption={`Mean quiz percentage per class for ${periodLabel.toLowerCase()}. Classes with nobody sitting a quiz are left out.`}
              suffix="%"
              maxY={100}
            />
          </Card>
        )}

        {report.classes.length === 0 ? (
          <EmptyState title="No classes in scope" />
        ) : (
          <>
            <ChurchClassGrid
              mode={mode}
              query={classQuery}
              rows={report.classes.map((c) => ({
                classId: c.classId,
                className: c.className,
                stage: c.stage ?? null,
                students: c.students,
                occasions: c.attendance.occasions,
                attended: c.attendance.attended,
                held: c.attendance.held,
                rate: c.attendance.rate,
                band: c.attendanceBand,
                quizAverage: c.quizAverage,
                quizCount: c.quizCount,
                quizBand: c.quizBand,
                pointsTotal: c.pointsTotal,
                pointsPerStudent: c.pointsPerStudent,
              }))}
            />

            {/* Print-only: the prototype's per-class student tables
                (OG L7661-7688). On screen these live behind each class card;
                on paper the whole report has to stand on its own. */}
            <div className="hidden print:block">
              {report.classes.map((c) => {
                const students = studentRows.get(c.classId) ?? []
                if (students.length === 0) return null
                return (
                  <section
                    key={`print-${c.classId}`}
                    /* F0776 — tagged so "Print selected" can drop this class's
                       student table from the paper too. Hiding the unselected
                       cards alone left every class's table in the printout, which
                       is the bulk of it: a servant printing one class still got
                       the whole school. ChurchClassGrid emits the print-media
                       rule, because the selection is its state. */
                    data-print-class={c.classId}
                    className="mt-5 break-inside-avoid"
                  >
                    <h2 className="mb-1.5 border-b border-parch-300 pb-1 font-serif text-[13px] font-bold text-brand-950">
                      {c.className}
                      <span className="ml-2 text-[11px] font-semibold text-parch-500">
                        {c.students} students · {c.attendance.rate === null ? '—' : `${c.attendance.rate}%`} attendance
                        {c.quizAverage !== null ? ` · ${c.quizAverage}% quiz average` : ''}
                      </span>
                    </h2>
                    <table className="w-full text-[10.5px]">
                      <thead>
                        <tr className="text-left text-parch-500">
                          <th className="py-0.5 font-semibold">Student</th>
                          <th className="py-0.5 text-right font-semibold">Attended</th>
                          <th className="py-0.5 text-right font-semibold">Attendance</th>
                          <th className="py-0.5 text-right font-semibold">Quiz avg</th>
                          <th className="py-0.5 text-right font-semibold">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((r) => (
                          <tr key={r.studentId} className="border-t border-parch-200">
                            <td className="py-0.5">{r.name}</td>
                            <td className="py-0.5 text-right tabular-nums">{r.attended}/{r.held}</td>
                            <td className="py-0.5 text-right tabular-nums">{r.rate === null ? '—' : `${r.rate}%`}</td>
                            <td className="py-0.5 text-right tabular-nums">{r.quizAverage === null ? '—' : `${r.quizAverage}%`}</td>
                            <td className="py-0.5 text-right tabular-nums">{r.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )
              })}
              <p className="mt-4 border-t border-parch-300 pt-1.5 text-[10px] text-parch-500">
                {scopeLabel} · {periodLabel} · {sessionLabel} · {report.totals.classes} classes ·{' '}
                {report.totals.students} students
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  /* ── Attendance matrix ──────────────────────────────────────────────────── */
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Reports" icon={<BarChart3 className="h-5 w-5" />} />
        {tabs}
        <EmptyState title="No classes yet" hint="Once you are assigned to a class its attendance report appears here." />
      </>
    )
  }

  const classId = classes.some((c) => c.id === searchParams.class) ? searchParams.class! : classes[0]!.id
  const month = searchParams.month && MONTH_RE.test(searchParams.month) ? searchParams.month : monthOf(today)
  const sessionKey =
    searchParams.session && sessions.some((s) => s.key === searchParams.session)
      ? searchParams.session
      : sessions.some((s) => s.key === 'sunday')
        ? 'sunday'
        : sessions[0]?.key
  const blank = searchParams.blank === '1'
  const view = searchParams.view === 'all' ? 'all' : 'one'

  // The prototype's report was one month grid with all six sessions side by
  // side (OG renderAttendanceMonthTable). The port could only show one at a
  // time, so reading a month meant running and printing it six times.
  if (view === 'all') {
    const all = await loadAllSessionsMatrix(user, { classId, month, blank })
    const allBand = attendanceBand(all.matrix.totals.rate)
    return (
      <div className="portal-print-page portal-print-landscape">
        <PageHeader
          title={blank ? `${monthLabel(month)} — blank form` : `Attendance · ${monthLabel(month)}`}
          icon={<CalendarCheck className="h-5 w-5" />}
          subtitle={`${all.cls.name} · every session`}
          actions={<PrintButton label={blank ? 'Print blank form' : 'Print'} />}
        />
        {tabs}
        <ReportFilters
          months={schoolYearMonths(today)}
        basePath="/portal/reports"
          classes={classes}
          classId={classId}
          month={month}
          sessionKey={sessionKey}
          sessions={sessions}
          blank={blank}
          view="all"
          show={{ class: true, month: true, view: true, blank: true }}
        />
        <ReportLetterhead
          title={`${all.cls.name} — attendance`}
          period={monthLabel(month)}
          session="Every session"
        />

        {!blank && (
          <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard label="Students" value={all.matrix.rows.length} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
            <StatCard
              label="Sessions held"
              value={all.matrix.columns.length}
              hint={`across ${all.matrix.weeks.length} week${all.matrix.weeks.length === 1 ? '' : 's'}`}
              icon={<CalendarCheck className="h-6 w-6" />}
              accent={accentFor(classId)}
            />
            <StatCard
              label="Attendance"
              value={all.matrix.totals.rate === null ? '—' : `${all.matrix.totals.rate}%`}
              hint={`${all.matrix.totals.present} of ${all.matrix.totals.held} expected`}
              tone={allBand === 'excellent' ? 'good' : allBand === 'good' ? 'warn' : allBand === 'low' ? 'bad' : 'default'}
              icon={<BarChart3 className="h-6 w-6" />}
            />
            <StatCard
              label="Excused"
              value={all.matrix.totals.excused}
              hint="Left out of the rate"
              icon={<Sparkles className="h-6 w-6" />}
              accent="#D97706"
            />
          </div>
        )}

        <Card
          title={`${all.cls.name} · ${monthLabel(month)}`}
          icon={<CalendarCheck className="h-4 w-4" />}
          action={allBand && !blank ? <Badge tone={bandTone(allBand)}>{BAND_LABEL[allBand]}</Badge> : undefined}
          bodyClassName="p-[18px] sm:p-4"
        >
          <AllSessionsMatrix matrix={all.matrix} blank={blank} />
          <p className="pt-3 text-[11px] text-parch-500">
            {blank
              ? 'One column per session per week. Tick as you take each register, then enter it in the portal.'
              : 'P present · E excused (left out of the rate) · A absent · empty box means nobody marked that student.'}
          </p>
        </Card>
      </div>
    )
  }

  if (!sessionKey) {
    return (
      <>
        <PageHeader title="Reports" icon={<BarChart3 className="h-5 w-5" />} />
        {tabs}
        <EmptyState title="No attendance sessions are set up" hint="An admin defines them under Sessions & Points." />
      </>
    )
  }

  const data = await loadAttendanceMatrix(user, { classId, month, sessionKey, blank })
  const band = attendanceBand(data.matrix.totals.rate)

  return (
    <div className="portal-print-page portal-print-landscape">
      <PageHeader
        title={blank ? `${monthLabel(month)} — blank form` : `Attendance · ${monthLabel(month)}`}
        icon={<CalendarCheck className="h-5 w-5" />}
        subtitle={`${data.cls.name} · ${data.sessionLabel}`}
        actions={
          <>
            <PrintButton label={blank ? 'Print blank form' : 'Print'} />
            {/* F0210 — the blank paper form was a checkbox buried inside the
                filter card, so the servant who wanted a sheet to carry into the
                hall had to already know it existed. It belongs beside Print,
                which is what they came to this page to do. Read-only, so it
                stays outside every write gate — the pastor prints too. The
                checkbox stays as the advanced control. */}
            <LinkButton
              href={`/portal/reports?class=${encodeURIComponent(classId)}&month=${month}&session=${encodeURIComponent(sessionKey)}${blank ? '' : '&blank=1'}`}
              variant="secondary"
              className="print:hidden"
            >
              {blank ? 'Back to the filled report' : 'Blank form'}
            </LinkButton>
            <CsvExportButton run={exportAttendanceMatrixCsv.bind(null, { classId, month, sessionKey })} />
            <CsvExportButton
              label="Download detail"
              run={exportAttendanceDetailCsv.bind(null, {
                classId,
                from: monthRange(month).from,
                to: monthRange(month).to,
                sessionKey,
              })}
            />
          </>
        }
      />
      {tabs}
      <ReportFilters
        months={schoolYearMonths(today)}
        basePath="/portal/reports"
        classes={classes}
        classId={classId}
        month={month}
        sessionKey={sessionKey}
        sessions={sessions}
        blank={blank}
        view="one"
        show={{ class: true, month: true, view: true, session: true, blank: true }}
      />
      <ReportLetterhead
        title={`${data.cls.name} — attendance`}
        period={monthLabel(month)}
        session={data.sessionLabel}
      />

      {!blank && (
        <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard
            label="Students"
            value={data.matrix.rows.length}
            icon={<Users className="h-6 w-6" />}
            accent="#16A34A"
          />
          <StatCard
            label="Sessions held"
            value={data.matrix.dates.length}
            hint={monthLabel(month)}
            icon={<CalendarCheck className="h-6 w-6" />}
            accent={accentFor(classId)}
          />
          <StatCard
            label="Attendance"
            value={data.matrix.totals.rate === null ? '—' : `${data.matrix.totals.rate}%`}
            hint={`${data.matrix.totals.present} of ${data.matrix.totals.held} expected`}
            tone={band === 'excellent' ? 'good' : band === 'good' ? 'warn' : band === 'low' ? 'bad' : 'default'}
            icon={<BarChart3 className="h-6 w-6" />}
          />
          <StatCard
            label="Excused"
            value={data.matrix.totals.excused}
            hint="Left out of the rate"
            icon={<Sparkles className="h-6 w-6" />}
            accent="#D97706"
          />
        </div>
      )}

      <Card
        title={blank ? `${data.cls.name} — ${data.sessionLabel}` : `${data.cls.name} · ${data.sessionLabel}`}
        icon={<CalendarCheck className="h-4 w-4" />}
        action={band && !blank ? <Badge tone={bandTone(band)}>{BAND_LABEL[band]}</Badge> : undefined}
        bodyClassName="p-[18px] sm:p-4"
      >
        <AttendanceMatrix matrix={data.matrix} blank={blank} />
        <p className="pt-3 text-[11px] text-parch-500">
          {blank
            ? 'Columns are the Sundays of the month. Tick each box as you take the register, then enter it in the portal.'
            : 'P present · E excused (left out of the rate) · A absent · empty box means nobody marked that student.'}
        </p>
      </Card>
    </div>
  )
}
