import { notFound } from 'next/navigation'
import { BarChart3, CalendarCheck, GraduationCap, Sparkles, Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import {
  reportClasses,
  churchReportScope,
  listSessions,
  loadAttendanceMatrix,
  loadChurchReport,
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
} from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { AttendanceMatrix } from './AttendanceMatrix'
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
}

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
    const from = parseDateOnly(searchParams.from) ?? addDays(today, -90)
    const to = parseDateOnly(searchParams.to) ?? today
    const sessionKey =
      searchParams.session && searchParams.session !== 'all' && sessions.some((s) => s.key === searchParams.session)
        ? searchParams.session
        : null
    const report = await loadChurchReport(user, { from: from <= to ? from : to, to, sessionKey })
    if (!report) notFound()

    const scopeLabel =
      user.role === 'SERVANT' ? `${STAGE_LABEL[user.stageOversight ?? 'ELEMENTARY']} stage` : 'Church-wide'

    return (
      <div className="portal-print-page">
        <PageHeader
          title="Church reports"
          icon={<BarChart3 className="h-5 w-5" />}
          subtitle={`${scopeLabel} · ${formatLongDate(report.from)} → ${formatLongDate(report.to)}${sessionKey ? ` · ${sessions.find((s) => s.key === sessionKey)?.label}` : ' · all sessions'}`}
          actions={
            <>
              <PrintButton />
              <CsvExportButton run={exportChurchReportCsv.bind(null, { from: report.from, to: report.to, sessionKey })} />
            </>
          }
        />
        {tabs}
        <ReportFilters
          basePath="/portal/reports"
          tab="church"
          from={report.from}
          to={report.to}
          sessionKey={sessionKey}
          sessions={sessions}
          allowAllSessions
          show={{ range: true, session: true }}
        />

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

        {report.classes.length === 0 ? (
          <EmptyState title="No classes in scope" />
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {report.classes.map((c) => (
              <ClassCard
                key={c.classId}
                name={c.className}
                accent={accentFor(c.classId)}
                icon={<GraduationCap className="h-5 w-5" />}
                rows={[
                  ...(c.stage
                    ? [{ key: 'Stage', value: STAGE_LABEL[c.stage as keyof typeof STAGE_LABEL] }]
                    : []),
                  { key: 'Students', value: c.students },
                  { key: 'Sessions held', value: c.attendance.occasions },
                  {
                    key: 'Attended',
                    value: (
                      <>
                        {c.attendance.attended}
                        <span className="text-parch-400"> / {c.attendance.held}</span>
                      </>
                    ),
                  },
                  {
                    key: 'Attendance',
                    value:
                      c.attendance.rate === null ? (
                        <span className="text-parch-400">—</span>
                      ) : (
                        <Badge tone={bandTone(c.attendanceBand)}>{c.attendance.rate}%</Badge>
                      ),
                  },
                  {
                    key: 'Quiz average',
                    value:
                      c.quizAverage === null ? (
                        <span className="text-parch-400">—</span>
                      ) : (
                        <Badge tone={bandTone(c.quizBand)}>
                          {c.quizAverage}% · {c.quizCount}
                        </Badge>
                      ),
                  },
                  { key: 'Points', value: c.pointsTotal.toLocaleString() },
                ]}
              />
            ))}
          </div>
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
    <div className="portal-print-page">
      <PageHeader
        title={blank ? `${monthLabel(month)} — blank form` : `Attendance · ${monthLabel(month)}`}
        icon={<CalendarCheck className="h-5 w-5" />}
        subtitle={`${data.cls.name} · ${data.sessionLabel}`}
        actions={
          <>
            <PrintButton label={blank ? 'Print blank form' : 'Print'} />
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
        basePath="/portal/reports"
        classes={classes}
        classId={classId}
        month={month}
        sessionKey={sessionKey}
        sessions={sessions}
        blank={blank}
        show={{ class: true, month: true, session: true, blank: true }}
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
