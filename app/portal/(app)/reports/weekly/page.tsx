import { notFound } from 'next/navigation'
import { BarChart3, CalendarRange, Percent, Users } from 'lucide-react'
import Link from '@/components/portal/Link'
import { requirePortalUser } from '@/lib/portal/session'
import { churchReportScope, reportClasses } from '@/lib/portal/data/reports'
import { kidWeeklyReport } from '@/lib/portal/data/kid-weekly-report'
import { addDays, mondayOf, parseDateOnly, churchToday } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { rateBand, RATE_BAND_LABEL, RATE_BAND_TONE } from '@/lib/portal/qr'
import { monthRange, schoolYearMonths, sessionAbbr } from '@/lib/portal/reports'
import type { KidReportRow } from '@/lib/portal/kid-weekly-report'
import { PageHeader, Card, StatCard, TableWrap, Th, Td, Badge, EmptyState, ProgressBar } from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { PortalChart } from '@/components/portal/PortalChart'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { WeekMatrix } from '@/components/portal/WeekMatrix'
import { ReportsTabs } from '../ReportsTabs'

export const metadata = { title: 'Weekly attendance report' }

const RANGES = [4, 8, 13, 26] as const
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toneFor(rate: number | null): 'brand' | 'good' | 'warn' | 'bad' {
  if (rate === null) return 'brand'
  return rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad'
}

const byRate = (a: KidReportRow, b: KidReportRow) => (b.rate ?? -1) - (a.rate ?? -1) || a.name.localeCompare(b.name)

/**
 * The servants' weekly attendance report, for the children (2026-10-19). The
 * Middle School overseer asked for it ("have this report for the kids too, not
 * just the servants"), so it has the same shape: the same ranges and months, the
 * rate by meeting, the week-by-week grid and every child's row. It counts the
 * church's way (lib/portal/kid-weekly-report.ts).
 */
export default async function KidWeeklyReportPage({
  searchParams,
}: {
  searchParams: { class?: string; from?: string; to?: string; weeks?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const [classes, churchScope] = await Promise.all([reportClasses(user), churchReportScope(user)])
  const header = (subtitle?: string) => (
    <PageHeader
      eyebrow="Reports"
      icon={<BarChart3 className="h-5 w-5" aria-hidden />}
      title="Weekly attendance report"
      subtitle={subtitle}
      actions={<PrintButton label="Print report" />}
    />
  )
  const tabs = <ReportsTabs active="weekly" church={!!churchScope} />
  if (classes.length === 0) {
    return (
      <>
        {header()}
        {tabs}
        <EmptyState title="No classes yet" hint="Once you are assigned to a class its weekly report appears here." />
      </>
    )
  }

  // The class asked for, every class in view, or by default the viewer's own.
  const asked = classes.find((c) => c.id === searchParams.class)
  const classParam = asked
    ? asked.id
    : searchParams.class === 'all' && classes.length > 1
      ? 'all'
      : ((classes.find((c) => user.classIds.includes(c.id)) ?? (classes.length === 1 ? classes[0] : null))?.id ?? 'all')
  const inView = classParam === 'all' ? classes : classes.filter((c) => c.id === classParam)
  const single = inView.length === 1

  const toWeek = mondayOf(parseDateOnly(searchParams.to) ?? churchToday())
  const weeks = RANGES.includes(Number(searchParams.weeks) as (typeof RANGES)[number]) ? Number(searchParams.weeks) : 8
  const fromWeek = parseDateOnly(searchParams.from) ? mondayOf(parseDateOnly(searchParams.from)!) : addDays(toWeek, -7 * (weeks - 1))

  const report = await kidWeeklyReport(user, { classIds: inView.map((c) => c.id), fromWeek, toWeek })
  const students = new Set(report.rows.map((r) => r.studentId)).size
  const scopeName = single ? inView[0]!.name : 'All classes'
  const keep: Record<string, string> = searchParams.from && searchParams.to ? { from: searchParams.from, to: searchParams.to } : { to: toWeek, weeks: String(weeks) }
  const sessions = report.sessions.map((s) => ({ ...s, abbr: sessionAbbr(s.key, s.label) }))

  return (
    <div className="portal-print-page">
      {header(`${scopeName} · ${formatLongDate(fromWeek)} — ${formatLongDate(addDays(toWeek, 6))} · ${report.weeks.length} week${report.weeks.length === 1 ? '' : 's'} recorded`)}
      {tabs}

      {classes.length > 1 && (
        <div className="mb-3 flex flex-wrap items-end gap-3 print:hidden">
          <ClassPicker value={classParam} options={classes.map((c) => ({ id: c.id, name: c.name }))} allowAll keep={keep} />
        </div>
      )}

      {/* The servant report's range chips, then the school-year months. */}
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        {RANGES.map((n) => (
          <Link
            key={n}
            href={`/portal/reports/weekly?class=${classParam}&to=${toWeek}&weeks=${n}`}
            aria-current={!searchParams.from && n === weeks ? 'page' : undefined}
            className={`rounded-[10px] px-3.5 py-2 text-[12px] font-bold transition-all ${
              !searchParams.from && n === weeks
                ? 'bg-[linear-gradient(120deg,#6F1D1B_0%,#7A2A2A_50%,#C89B3C_100%)] text-white shadow-[0_4px_12px_rgba(90,31,31,.28)]'
                : 'border border-parch-200 bg-parch-100 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800'
            }`}
          >
            Last {n} weeks
          </Link>
        ))}
      </div>
      <div className="mb-5 flex w-full flex-wrap gap-1.5 print:hidden">
        {schoolYearMonths(churchToday()).map((m) => {
          const range = monthRange(m.key)
          const active = searchParams.from === range.from && searchParams.to === range.to
          return (
            <Link
              key={m.key}
              href={`/portal/reports/weekly?class=${classParam}&from=${range.from}&to=${range.to}`}
              aria-label={m.label}
              aria-current={active ? 'page' : undefined}
              className={`rounded-[20px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] transition-colors ${
                active
                  ? 'border-brand-gold bg-brand-wash text-brand-800'
                  : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800'
              }`}
            >
              {m.abbr}
            </Link>
          )
        })}
      </div>

      {report.rows.length === 0 || report.weeks.length === 0 ? (
        <EmptyState
          title="Nothing recorded in this range"
          hint="A week only counts once a register has been taken for it. Take a register first, or pick a longer range."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Overall rate"
              value={report.total.rate === null ? '—' : `${report.total.rate}%`}
              tone="brand"
              icon={<Percent className="h-6 w-6" aria-hidden />}
              hint={`${report.total.attended} of ${report.total.held} recorded`}
            />
            <StatCard
              label="Students"
              value={students}
              icon={<Users className="h-6 w-6" aria-hidden />}
              accent="#2563EB"
              hint={single ? inView[0]!.name : `${inView.length} classes`}
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
            <Card title="By meeting">
              <ul className="space-y-3.5">
                {report.perSession.map((a) => (
                  <li key={a.key}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[12.5px] font-bold text-parch-800">
                        {a.label}
                        {a.weekday !== null && <span className="ml-1.5 text-[11px] font-normal text-parch-500">{DAY_LABEL[a.weekday]}</span>}
                      </span>
                      <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-parch-700">
                        {a.rate === null ? 'not held' : `${a.rate}%`}
                        <span className="ml-1.5 text-[11px] font-normal text-parch-400">({a.attended}/{a.held})</span>
                      </span>
                    </div>
                    <ProgressBar value={a.rate ?? 0} tone={toneFor(a.rate)} label={a.label} />
                  </li>
                ))}
              </ul>
              {report.notHeld.length > 0 && (
                <p className="mt-3.5 text-[11px] text-parch-500" data-testid="not-held">
                  No register in this range for {report.notHeld.map((s) => s.label).join(', ')}.
                </p>
              )}
            </Card>
          </div>

          {report.perSession.filter((a) => a.rate !== null).length >= 2 && (
            <div className="mb-4">
              <Card title="Attendance by meeting" icon={<BarChart3 className="h-4 w-4" aria-hidden />}>
                <PortalChart
                  kind="bar"
                  points={report.perSession.filter((a) => a.rate !== null).map((a) => ({ label: a.label, value: a.rate }))}
                  label="Attendance"
                  caption="Share of the weeks each meeting was held that the children in view attended. An excused week is left out rather than counted against them."
                  suffix="%"
                  maxY={100}
                />
              </Card>
            </div>
          )}

          {!single && (
            <div className="mb-4">
              <Card title="By class">
                <TableWrap>
                  <thead>
                    <tr>
                      <Th className="sticky left-0 z-10 bg-parch-50">Class</Th>
                      <Th align="right">Students</Th>
                      {sessions.map((s) => (
                        <Th key={s.key} align="center" className="border-l-2 border-l-brand-gold/30 bg-brand-wash text-[9.5px] text-brand-800">
                          <abbr title={s.label} className="no-underline">{s.abbr}</abbr>
                        </Th>
                      ))}
                      <Th align="right">Rate</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.classes.map((c) => (
                      <tr key={c.classId}>
                        <Td className="sticky left-0 z-10 bg-parch-50">
                          <Link href={`/portal/reports/weekly?${new URLSearchParams({ ...keep, class: c.classId }).toString()}`} className="whitespace-nowrap text-[12.5px] font-bold text-parch-900 hover:text-brand-800">
                            {c.name}
                          </Link>
                        </Td>
                        <Td align="right" className="tabular-nums">{c.students}</Td>
                        {sessions.map((s) => {
                          const t = c.bySession[s.key]
                          return (
                            <Td key={s.key} align="center" className="px-2 text-[11px] font-semibold tabular-nums">
                              {!t || t.held === 0 ? <span className="text-[#D1CBBE]">—</span> : `${Math.round((t.attended / t.held) * 100)}%`}
                            </Td>
                          )
                        })}
                        <Td align="right">
                          <Badge tone={RATE_BAND_TONE[rateBand(c.rate)]}>{c.rate === null ? RATE_BAND_LABEL.none : `${c.rate}%`}</Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </Card>
            </div>
          )}

          {/* Which week was missed, not just how many — for one class at a time. */}
          <div className="mb-4">
            <Card title="Week by week">
              {single ? (
                <WeekMatrix
                  weeks={report.weeks}
                  activities={sessions}
                  rows={report.rows.map((r) => ({ id: `${r.classId}:${r.studentId}`, name: r.name, href: `/portal/students/${r.studentId}`, cells: r.cells }))}
                  personLabel="Student"
                  legend="✓ there · E excused (left out of the rate) · ✗ absent · — not marked, which counts as absent · blank: before they joined the class."
                />
              ) : (
                <p className="text-[12.5px] text-parch-600">Pick one class above to see each child week by week.</p>
              )}
            </Card>
          </div>

          <Card title="By student">
            <p className="mb-3 flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px] font-semibold text-parch-500">
              {sessions.map((s) => (
                <span key={s.key}>
                  <span className="font-bold text-brand-gold-dark">{s.abbr}</span> = {s.label}
                </span>
              ))}
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <Th className="sticky left-0 z-10 bg-parch-50">Student</Th>
                  {sessions.map((s) => (
                    <Th key={s.key} align="center" className="border-l-2 border-l-brand-gold/30 bg-brand-wash text-[9.5px] text-brand-800">
                      <abbr title={s.label} className="no-underline">{s.abbr}</abbr>
                    </Th>
                  ))}
                  <Th align="right" className="min-w-[8.5rem]">Rate</Th>
                </tr>
              </thead>
              {report.classes
                .filter((c) => c.students > 0 && c.held > 0)
                .map((c) => (
                  <tbody key={c.classId} data-testid="weekly-class" data-class={c.classId}>
                    {!single && (
                      <tr>
                        <td colSpan={sessions.length + 2} className="bg-brand-wash px-3 py-1.5 text-[11px] font-bold text-brand-800">
                          {c.name}
                        </td>
                      </tr>
                    )}
                    {report.rows
                      .filter((r) => r.classId === c.classId)
                      .sort(byRate)
                      .map((r) => {
                        const band = rateBand(r.rate)
                        return (
                          <tr key={`${r.classId}:${r.studentId}`} data-testid="weekly-student" data-student={r.studentId}>
                            <Td className="sticky left-0 z-10 bg-parch-50">
                              <Link href={`/portal/students/${r.studentId}`} className="whitespace-nowrap text-[12.5px] font-bold text-parch-900 hover:text-brand-800">
                                {r.name}
                              </Link>
                            </Td>
                            {sessions.map((s) => {
                              const cell = r.bySession[s.key] ?? { attended: 0, held: 0 }
                              return (
                                <Td key={s.key} align="center" className="px-2 text-[11px] font-semibold tabular-nums">
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
                                <Badge tone={RATE_BAND_TONE[band]}>{r.rate === null ? RATE_BAND_LABEL[band] : `${r.rate}%`}</Badge>
                              </div>
                            </Td>
                          </tr>
                        )
                      })}
                  </tbody>
                ))}
            </TableWrap>
            {!single && report.classes.some((c) => c.students > 0 && c.held === 0) && (
              <p className="pt-3 text-[11.5px] text-parch-600" data-testid="no-register-classes">
                No register in this range for{' '}
                {report.classes
                  .filter((c) => c.students > 0 && c.held === 0)
                  .map((c) => c.name)
                  .join(', ')}
                , so their children are not listed.
              </p>
            )}
            <p className="pt-3 text-[11px] text-parch-500">
              A meeting counts for a week once its register is taken. An excused week is left out; a week before a child joined the
              class is not held against them.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
