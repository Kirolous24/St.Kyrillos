import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, ClipboardCheck } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { loadWeekGrid } from '@/lib/portal/data/servant-attendance'
import { addDays, mondayOf, parseDateOnly, todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate, formatShortDate } from '@/lib/portal/format'
import { PageHeader, EmptyState, Callout, LinkButton, Card } from '@/components/portal/ui'
import { ServantGrid } from './ServantGrid'

export const metadata = { title: 'Servants Attendance' }

/** The prototype's 30px square week-stepper arrow. */
const STEP =
  'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] border border-parch-200 bg-parch-50 text-[14px] text-parch-700 transition-colors hover:border-brand-gold/60 hover:text-brand-800'

export default async function ServantAttendancePage({ searchParams }: { searchParams: { week?: string } }) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const today = todayInNewYork()
  const weekStart = mondayOf(parseDateOnly(searchParams.week) ?? today)
  const thisWeek = mondayOf(today)
  const { activities, scope, marks } = await loadWeekGrid(user, weekStart)

  const readOnly = user.role === 'PASTOR'

  return (
    <>
      <PageHeader
        eyebrow="Attendance"
        icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
        title="Servants Attendance"
        subtitle="Track attendance across the weekly servant activities"
        actions={
          <LinkButton href={`/portal/servant-attendance/report?to=${weekStart}`} variant="secondary">
            <BarChart3 className="h-4 w-4" aria-hidden /> Weekly report
          </LinkButton>
        }
      />

      {/* week stepper, housed in its own card like the prototype's */}
      <Card className="mb-4 print:hidden" bodyClassName="px-[18px] py-3.5">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link href={`/portal/servant-attendance?week=${addDays(weekStart, -7)}`} aria-label="Previous week" className={STEP}>
            ‹
          </Link>
          <span className="min-w-[200px] text-center text-[13px] font-bold text-parch-900">
            {formatShortDate(weekStart)} – {formatShortDate(addDays(weekStart, 6))}
          </span>
          <Link href={`/portal/servant-attendance?week=${addDays(weekStart, 7)}`} aria-label="Next week" className={STEP}>
            ›
          </Link>
          {weekStart !== thisWeek && (
            <LinkButton href="/portal/servant-attendance" variant="gold" size="sm">
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
          />
        </>
      ) : (
        <ServantGrid
          key={weekStart}
          weekStart={weekStart}
          activities={activities}
          servants={scope.servants}
          marks={marks}
          writableIds={
            user.role === 'ADMIN' || scope.canMarkOthers
              ? scope.servants.map((s) => s.id)
              : scope.servants.filter((s) => s.isSelf).map((s) => s.id)
          }
        />
      )}
    </>
  )
}
