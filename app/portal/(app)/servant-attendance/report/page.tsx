import { notFound } from 'next/navigation'
import { BarChart3, CalendarRange, Percent, Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { servantAttendanceReport } from '@/lib/portal/data/servant-attendance'
import { addDays, mondayOf, parseDateOnly, todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { rateBand, RATE_BAND_LABEL, RATE_BAND_TONE } from '@/lib/portal/qr'
import { monthRange, schoolYearMonths } from '@/lib/portal/reports'
import { ServantWeekMatrix } from './WeekMatrix'
import { PageHeader, Card, StatCard, TableWrap, Th, Td, Badge, EmptyState, ProgressBar } from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { ServantAttendanceTabs } from '../Tabs'
import { PortalChart } from '@/components/portal/PortalChart'

export const metadata = { title: 'Servant attendance report' }

const RANGES = [4, 8, 13, 26] as const
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The prototype abbreviates an activity to its initials in matrix headers. */
function abbreviate(label: string): string {
  return (label.match(/\b\w/g) ?? []).join('').slice(0, 3).toUpperCase()
}

function toneFor(rate: number | null): 'brand' | 'good' | 'warn' | 'bad' {
  if (rate === null) return 'brand'
  return rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad'
}

export default async function ServantAttendanceReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; weeks?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const toWeek = mondayOf(parseDateOnly(searchParams.to) ?? todayInNewYork())
  const weeks = RANGES.includes(Number(searchParams.weeks) as (typeof RANGES)[number]) ? Number(searchParams.weeks) : 8
  const fromWeek = parseDateOnly(searchParams.from) ? mondayOf(parseDateOnly(searchParams.from)!) : addDays(toWeek, -7 * (weeks - 1))

  const report = await servantAttendanceReport(user, fromWeek, toWeek)
  const rows = [...report.rows].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.name.localeCompare(b.name))
  const attended = rows.reduce((n, r) => n + r.attended, 0)
  const held = rows.reduce((n, r) => n + r.held, 0)
  const overall = held === 0 ? null : Math.round((attended / held) * 100)

  return (
    <div className="portal-print-page">
      <PageHeader
        eyebrow="Attendance"
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        title="Servant attendance report"
        subtitle={`${formatLongDate(fromWeek)} — ${formatLongDate(addDays(toWeek, 6))} · ${report.weeks.length} week${report.weeks.length === 1 ? '' : 's'} recorded`}
        back={{ href: '/portal/servant-attendance', label: 'Servants Attendance' }}
        actions={<PrintButton label="Print report" />}
      />

      <ServantAttendanceTabs active="report" weekStart={toWeek} />

      {/* range chips, in the prototype's month-chip shape */}
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        {RANGES.map((n) => (
          <a
            key={n}
            href={`/portal/servant-attendance/report?to=${toWeek}&weeks=${n}`}
            aria-current={!searchParams.from && n === weeks ? 'page' : undefined}
            className={`rounded-[10px] px-3.5 py-2 text-[12px] font-bold transition-all ${
              !searchParams.from && n === weeks
                ? 'bg-[linear-gradient(120deg,#6F1D1B_0%,#7A2A2A_50%,#C89B3C_100%)] text-white shadow-[0_4px_12px_rgba(90,31,31,.28)]'
                : 'border border-parch-200 bg-parch-100 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800'
            }`}
          >
            Last {n} weeks
          </a>
        ))}
      </div>

      {/* F0295 — the twelve school-year months, as the prototype had them. With
          only "Last N weeks" the furthest anyone could look back was 26 weeks,
          so last October was unreachable without hand-editing ?from= and ?to=
          in the address bar — and October is exactly the month somebody asks
          about in March, when a servant's attendance comes up. September-first,
          because that is how the church counts a year. */}
      <div className="mb-5 flex w-full flex-wrap gap-1.5 print:hidden">
        {schoolYearMonths(todayInNewYork()).map((m) => {
          const range = monthRange(m.key)
          const active = searchParams.from === range.from && searchParams.to === range.to
          return (
            <a
              key={m.key}
              href={`/portal/servant-attendance/report?from=${range.from}&to=${range.to}`}
              aria-label={m.label}
              aria-current={active ? 'page' : undefined}
              className={`rounded-[20px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] transition-colors ${
                active
                  ? 'border-brand-gold bg-brand-wash text-brand-800'
                  : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800'
              }`}
            >
              {m.abbr}
            </a>
          )
        })}
      </div>

      {rows.length === 0 || report.weeks.length === 0 ? (
        <EmptyState
          title="Nothing recorded in this range"
          hint="A week only counts once somebody has marked it. Record a week on the grid first."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Overall rate"
              value={overall === null ? '—' : `${overall}%`}
              tone="brand"
              icon={<Percent className="h-6 w-6" aria-hidden />}
              hint={`${attended} of ${held} recorded`}
            />
            <StatCard
              label="Servants"
              value={rows.length}
              icon={<Users className="h-6 w-6" aria-hidden />}
              accent="#2563EB"
              hint="In your scope"
            />
            <StatCard
              label="Weeks"
              value={report.weeks.length}
              icon={<CalendarRange className="h-6 w-6" aria-hidden />}
              accent="#CA8A04"
              hint={`Week of ${formatLongDate(report.weeks[0]!)} onward`}
            />
          </div>

          <div className="mb-4">
            <Card title="By activity">
              <ul className="space-y-3.5">
                {report.perActivity.map((a) => {
                  const activity = report.activities.find((x) => x.key === a.key)
                  return (
                    <li key={a.key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[12.5px] font-bold text-parch-800">
                          {a.label}
                          {activity && (
                            <span className="ml-1.5 text-[11px] font-normal text-parch-500">{DAY_LABEL[activity.dayOfWeek]}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-parch-700">
                          {a.rate === null ? 'not held' : `${a.rate}%`}
                          <span className="ml-1.5 text-[11px] font-normal text-parch-400">({a.attended}/{a.held})</span>
                        </span>
                      </div>
                      <ProgressBar value={a.rate ?? 0} tone={toneFor(a.rate)} label={a.label} />
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>

          {report.perActivity.filter((a) => a.rate !== null).length >= 2 && (
            <div className="mb-4">
              <Card title="Attendance by activity" icon={<BarChart3 className="h-4 w-4" aria-hidden />}>
                <PortalChart
                  kind="bar"
                  points={report.perActivity
                    .filter((a) => a.rate !== null)
                    .map((a) => ({ label: a.label, value: a.rate }))}
                  label="Attendance"
                  caption="Share of the weeks each activity was held that servants in view attended. An excused week is left out rather than counted against them."
                  suffix="%"
                  maxY={100}
                />
              </Card>
            </div>
          )}

          {/* Which week was missed, not just how many — the prototype's grid. */}
          <div className="mb-4">
            <Card title="Week by week">
              <ServantWeekMatrix report={report} />
            </Card>
          </div>

          <Card title="By servant">
            {/* legend: the initials used across the matrix header */}
            <p className="mb-3 flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px] font-semibold text-parch-500">
              {report.activities.map((a) => (
                <span key={a.key}>
                  <span className="font-bold text-brand-gold-dark">{abbreviate(a.label)}</span> = {a.label}
                </span>
              ))}
            </p>

            <TableWrap>
              <thead>
                <tr>
                  <Th className="sticky left-0 z-10 bg-parch-50">Servant</Th>
                  {report.activities.map((a) => (
                    <Th
                      key={a.key}
                      align="center"
                      className="border-l-2 border-l-brand-gold/30 bg-brand-wash text-[9.5px] text-brand-800"
                    >
                      <abbr title={a.label} className="no-underline">{abbreviate(a.label)}</abbr>
                    </Th>
                  ))}
                  <Th align="right" className="min-w-[8.5rem]">Rate</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const band = rateBand(r.rate)
                  return (
                    <tr key={r.servantId}>
                      <Td className="sticky left-0 z-10 bg-parch-50">
                        <p className="whitespace-nowrap text-[12.5px] font-bold text-parch-900">{r.name}</p>
                        {r.classNames.length > 0 && (
                          <p className="max-w-[12rem] truncate text-[11px] text-parch-500">{r.classNames.join(', ')}</p>
                        )}
                      </Td>
                      {report.activities.map((a) => {
                        const cell = r.byActivity[a.key] ?? { attended: 0, held: 0 }
                        return (
                          <Td key={a.key} align="center" className="px-2 text-[11px] font-semibold tabular-nums">
                            {cell.held === 0 ? (
                              <span className="text-[#D1CBBE]">—</span>
                            ) : (
                              <span className={cell.attended === cell.held ? 'text-[#16A34A]' : 'text-parch-700'}>
                                {cell.attended}/{cell.held}
                              </span>
                            )}
                          </Td>
                        )
                      })}
                      <Td align="right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="hidden w-20 sm:block">
                            <ProgressBar value={r.rate ?? 0} tone={toneFor(r.rate)} label={`${r.name} rate`} />
                          </span>
                          <Badge tone={RATE_BAND_TONE[band]}>
                            {r.rate === null ? RATE_BAND_LABEL[band] : `${r.rate}%`}
                          </Badge>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
          </Card>
        </>
      )}
    </div>
  )
}
