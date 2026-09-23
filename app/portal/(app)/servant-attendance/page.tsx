import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, CalendarClock, ClipboardCheck, History } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { loadWeekGrid, listMeetingHistory, type MeetingHistoryRow } from '@/lib/portal/data/servant-attendance'
import { addDays, mondayOf, parseDateOnly, todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate, formatShortDate } from '@/lib/portal/format'
import { PageHeader, EmptyState, Callout, LinkButton, Card, Badge } from '@/components/portal/ui'
import { ServantGrid } from './ServantGrid'
import { ServantAttendanceTabs } from './Tabs'

export const metadata = { title: 'Servants Attendance' }

/** The prototype's 30px square week-stepper arrow. */
const STEP =
  'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] border border-parch-200 bg-parch-50 text-[14px] text-parch-700 transition-colors hover:border-brand-gold/60 hover:text-brand-800'

export default async function ServantAttendancePage({
  searchParams,
}: {
  searchParams: { week?: string; activity?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const today = todayInNewYork()
  const weekStart = mondayOf(parseDateOnly(searchParams.week) ?? today)
  const thisWeek = mondayOf(today)
  const [{ activities: allActivities, scope, marks }, history] = await Promise.all([
    loadWeekGrid(user, weekStart),
    listMeetingHistory(user),
  ])

  /**
   * F0297 — the prototype marked one activity at a time; the port draws all
   * seven as columns, which on the phone a servant actually holds on a Friday
   * night means scrolling sideways past six meetings to reach the one being
   * marked. Picking a column is optional — the full matrix stays the default,
   * because seeing the whole week at once is the one thing this grid gained
   * over the prototype and it is worth keeping for anyone at a desk.
   *
   * An unknown ?activity= falls back to all of them rather than an empty grid.
   */
  const activeActivity = allActivities.some((a) => a.key === searchParams.activity) ? searchParams.activity! : null
  const activities = activeActivity ? allActivities.filter((a) => a.key === activeActivity) : allActivities
  const keepActivity = activeActivity ? `&activity=${activeActivity}` : ''

  const readOnly = user.role === 'PASTOR'

  return (
    <>
      <PageHeader
        eyebrow="Attendance"
        icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
        title="Servants Attendance"
        subtitle="Track attendance across the weekly servant activities"
        actions={
          <>
            <LinkButton href={`/portal/servant-attendance/report?to=${weekStart}`} variant="secondary">
              <BarChart3 className="h-4 w-4" aria-hidden /> Weekly report
            </LinkButton>
            {/* ADMIN only: this page is open to the pastor and to every servant,
                and /portal/admin/sessions turns all of them away — an ungated
                button here would be a 404 for most of the people looking at it. */}
            {user.role === 'ADMIN' && (
              <LinkButton href="/portal/admin/sessions" variant="secondary">
                <CalendarClock className="h-4 w-4" aria-hidden /> Edit activity days
              </LinkButton>
            )}
          </>
        }
      />

      <ServantAttendanceTabs active="take" weekStart={weekStart} />

      {/* Activity picker. Every chip is a real destination on this same week,
          and "All activities" is always offered so the filter can never strand
          somebody on one column. */}
      {allActivities.length > 1 && (
        <div className="mb-4 flex w-full flex-wrap gap-1.5 print:hidden">
          <a
            href={`/portal/servant-attendance?week=${weekStart}`}
            aria-current={activeActivity === null ? 'page' : undefined}
            className={`rounded-[20px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] transition-colors ${
              activeActivity === null
                ? 'border-brand-gold bg-brand-wash text-brand-800'
                : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800'
            }`}
          >
            All activities
          </a>
          {allActivities.map((a) => (
            <a
              key={a.key}
              href={`/portal/servant-attendance?week=${weekStart}&activity=${a.key}`}
              aria-current={activeActivity === a.key ? 'page' : undefined}
              className={`rounded-[20px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] transition-colors ${
                activeActivity === a.key
                  ? 'border-brand-gold bg-brand-wash text-brand-800'
                  : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800'
              }`}
            >
              {a.label}
            </a>
          ))}
        </div>
      )}

      {/* week stepper, housed in its own card like the prototype's */}
      <Card className="mb-4 print:hidden" bodyClassName="px-[18px] py-3.5">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link href={`/portal/servant-attendance?week=${addDays(weekStart, -7)}${keepActivity}`} aria-label="Previous week" className={STEP}>
            ‹
          </Link>
          <span className="min-w-[200px] text-center text-[13px] font-bold text-parch-900">
            {formatShortDate(weekStart)} – {formatShortDate(addDays(weekStart, 6))}
          </span>
          <Link href={`/portal/servant-attendance?week=${addDays(weekStart, 7)}${keepActivity}`} aria-label="Next week" className={STEP}>
            ›
          </Link>
          {weekStart !== thisWeek && (
            <LinkButton href={`/portal/servant-attendance?week=${thisWeek}${keepActivity}`} variant="gold" size="sm">
              This week
            </LinkButton>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
          Week of {formatLongDate(weekStart)}
        </p>
      </Card>

      {scope.servants.length === 0 ? (
        <EmptyState
          title="No servants in view"
          hint="You see the servants of your own classes, or of the stage you oversee. Ask an admin if this looks wrong."
        />
      ) : readOnly ? (
        <>
          <div className="mb-4">
            <Callout tone="info" title="Read-only">
              Servant attendance is recorded by admins and class coordinators. This page shows you the week as it stands.
            </Callout>
          </div>
          <ServantGrid
            key={weekStart}
            weekStart={weekStart}
            activities={activities}
            servants={scope.servants}
            marks={marks}
            writableIds={[]}
            canOpenProfiles={user.role === 'ADMIN'}
          />
        </>
      ) : (
        <>
          {/* Every servant on screen is markable by any servant, which is the
              prototype's rule and what the church asked for: whoever runs the
              meeting marks the room. The scope is still the limit — the grid
              only ever shows your own classes, or the stage you oversee. */}
          <ServantGrid
            key={weekStart}
            weekStart={weekStart}
            activities={activities}
            servants={scope.servants}
            marks={marks}
            writableIds={scope.servants.map((s) => s.id)}
            canOpenProfiles={user.role === 'ADMIN'}
          />
        </>
      )}

      {/* Meeting history — read-only, and deliberately outside every write
          branch: the pastor reads this page and is the role that wants the
          oversight view. Editing a past week already worked through the stepper
          above; what was missing was any list of what had been held. */}
      {history.length > 0 && (
        <div className="mt-5">
          {/* F0003 — the history is cut into months and says how many meetings
              it is showing. Sixteen weeks in one unbroken column answers none
              of the questions a coordinator actually asks ("how many did we
              hold in October?"), and a list that stops at sixteen without
              saying so reads as though sixteen is all there has ever been. */}
          <Card title={`Past meetings (${history.length} held)`} icon={<History className="h-4 w-4" aria-hidden />}>
            {monthSections(history).map(([month, rows]) => (
              <section key={month} className="mt-3 first:mt-0">
                <p
                  data-meeting-month={month}
                  className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500"
                >
                  {month} · {rows.length} held
                </p>
                <ul className="divide-y divide-[#F5F2ED]">
                  {rows.map((h) => (
                    <li key={`${h.activityKey}-${h.weekStart}`} className="py-2">
                      <details>
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-bold text-parch-900">{h.label}</span>
                            <span className="block text-[11px] text-parch-500">Week of {formatLongDate(h.weekStart)}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge tone={h.present > 0 ? 'good' : 'neutral'}>{h.present} attended</Badge>
                            {h.excused > 0 && <Badge tone="warn">{h.excused} excused</Badge>}
                            {/* F0009 / F0605 — how the marks arrived. Worked out
                                from the scan receipts, which have been kept
                                since the portal opened, so this reads correctly
                                for meetings held long before it was asked for. A
                                meeting nobody scanned shows nothing rather than
                                a bare "0 scanned". */}
                            {h.scanned > 0 && (
                              <Badge tone="info">
                                {h.scanned === h.present ? 'all scanned in' : `${h.scanned} scanned in`}
                              </Badge>
                            )}
                            <Link
                              href={`/portal/servant-attendance?week=${h.weekStart}`}
                              className="text-[11px] font-bold text-brand-800 underline"
                            >
                              Open
                            </Link>
                          </span>
                        </summary>
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-parch-600">
                          {h.attendees.length > 0 ? h.attendees.join(', ') : 'Nobody was marked present.'}
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {history.length >= MEETING_HISTORY_SHOWN && (
              <p className="mt-3 border-t border-[#F5F2ED] pt-3 text-[11px] text-parch-500">
                Showing the {MEETING_HISTORY_SHOWN} most recent meetings. Step back through the weeks above to reach
                anything older.
              </p>
            )}
          </Card>
        </div>
      )}
    </>
  )
}

/**
 * Mirrors `listMeetingHistory`'s own default limit. It lives here because this
 * is the only place that has to admit to the reader that the list has stopped.
 */
const MEETING_HISTORY_SHOWN = 16

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * "September 2026" → that month's meetings, newest month first (the rows
 * already arrive newest-week-first).
 *
 * The month is read straight off the `YYYY-MM-DD` week start rather than by
 * constructing a Date, so the grouping cannot slip a month at either end the
 * way a UTC parse of a church date does.
 */
function monthSections(rows: MeetingHistoryRow[]): Array<[string, MeetingHistoryRow[]]> {
  const out: Array<[string, MeetingHistoryRow[]]> = []
  for (const row of rows) {
    const label = `${MONTH_NAMES[Number(row.weekStart.slice(5, 7)) - 1]} ${row.weekStart.slice(0, 4)}`
    const bucket = out.find(([m]) => m === label)
    if (bucket) bucket[1].push(row)
    else out.push([label, [row]])
  }
  return out
}
