import { notFound } from 'next/navigation'
import Link from '@/components/portal/Link'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { lessonPrepClasses } from '@/lib/portal/data/lesson-prep'
import { classServants } from '@/lib/portal/data/agenda'
import { ROTATION_LOOKBACK_WEEKS, classCalendar, heldCells } from '@/lib/portal/data/schedule-calendar'
import { calendarSpan, spanQuery, sundaysBetween, termOf, type CalendarSpan } from '@/lib/portal/calendar-spans'
import { ROTATION_ROLES, defaultRotationRoles, type RotationRole } from '@/lib/portal/rotation'
import { agendaPageTitle } from '@/lib/portal/agenda'
import { comingSunday } from '@/lib/portal/assignment-notices'
import { addDays, churchToday, mondayOf } from '@/lib/portal/dates'
import { can } from '@/lib/portal/permissions'
import { EmptyState, PageHeader, TabLink, Tabs } from '@/components/portal/ui'
import { ScheduleGrid, gridKey, type GridCell } from '@/components/portal/ScheduleGrid'
import { CalendarClassPicker } from './CalendarClassPicker'
import { RotationPanel } from './RotationPanel'

export const metadata = { title: 'Schedule calendar' }

/**
 * A class's Schedule over a month or a semester (2026-11-01): who is on which
 * part each Sunday, and, for its coordinators, a rotation that fills a stretch
 * of Sundays at once, so nobody has to assign every Sunday by hand.
 */
export default async function ScheduleCalendarPage({
  searchParams,
}: {
  searchParams: { class?: string; span?: string; month?: string; term?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const { own: classes, linked } = await lessonPrepClasses(user)
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title={agendaPageTitle(user.role)} icon={<CalendarDays className="h-5 w-5" aria-hidden />} />
        <EmptyState title="No classes yet" hint="Ask the Sunday School admin to add you to a class." />
      </>
    )
  }

  // Like the Schedule: own classes, and linked ones to read.
  const linkedPick = linked.find((c) => c.id === searchParams.class) ?? null
  const classId = classes.some((c) => c.id === searchParams.class) ? searchParams.class! : linkedPick?.id ?? classes[0]!.id
  const cls = linkedPick ?? (await requireClassAccess(user, classId, 'class.read'))
  const canRotate = !linkedPick && can(user, 'group.manage', { classId: cls.id, classStage: cls.stage })

  const today = churchToday()
  const thisMonday = mondayOf(today)
  const span = calendarSpan(searchParams, today)
  const sundays = sundaysBetween(span.start, span.end)
  // The Sunday this week leads up to: today, on a Sunday.
  const nextSunday = comingSunday(addDays(today, -1))
  const firstFillable = comingSunday(today)

  const [rows, servants, recent] = await Promise.all([
    classCalendar(cls.id, sundays),
    canRotate ? classServants(cls.id) : Promise.resolve([]),
    canRotate ? heldCells(cls.id, addDays(thisMonday, -7 * ROTATION_LOOKBACK_WEEKS), thisMonday) : Promise.resolve([]),
  ])

  const cells: Record<string, GridCell> = {}
  for (const row of rows) {
    for (const [role, cell] of Object.entries(row.cells)) {
      if (cell) cells[gridKey(row.weekStart, role as RotationRole)] = { name: cell.name, tone: cell.done ? 'done' : undefined }
    }
  }
  // Lead and Backup only take a column when someone holds one in this span.
  const roles = ROTATION_ROLES.map((r) => r.key).filter((k) => (k !== 'lead' && k !== 'backup') || rows.some((r) => r.cells[k]))
  const assigned = rows.reduce((n, r) => n + Object.keys(r.cells).length, 0)

  const base = `/portal/agenda/calendar?class=${encodeURIComponent(cls.id)}`
  const hrefFor = (kind: CalendarSpan['kind'], key: string) => `${base}&${spanQuery(kind, key)}`
  const monthKey = span.kind === 'month' ? span.key : today >= span.start && today <= span.end ? today.slice(0, 7) : span.start.slice(0, 7)
  const termKey = span.kind === 'semester' ? span.key : termOf(span.start).key
  const tab = (path: string, extra = '') => `${path}?class=${encodeURIComponent(cls.id)}&week=${thisMonday}${extra}`
  // The rotation starts on the span's first Sunday still to come, and ends on its last.
  const fillable = sundays.filter((s) => s >= firstFillable)

  return (
    <>
      <PageHeader title={agendaPageTitle(user.role)} icon={<CalendarDays className="h-5 w-5" aria-hidden />} subtitle={`${cls.name} · ${span.label}`} />

      <Tabs>
        <TabLink href={tab('/portal/agenda')} active={false}>
          This week
        </TabLink>
        <TabLink href={tab('/portal/agenda/week')} active={false}>
          Weekly assignments
        </TabLink>
        <TabLink href={hrefFor(span.kind, span.key)} active>
          Calendar
        </TabLink>
        <TabLink href={tab('/portal/agenda', '&view=archive')} active={false}>
          Archive
        </TabLink>
      </Tabs>

      <CalendarClassPicker
        classId={cls.id}
        classes={[...classes.map((c) => ({ id: c.id, name: c.name })), ...linked.map((c) => ({ id: c.id, name: `${c.name} (linked, read-only)` }))]}
        query={spanQuery(span.kind, span.key)}
      />

      <nav aria-label="Month or semester" className="mb-5 flex flex-wrap items-center gap-2 print:hidden" data-testid="calendar-span">
        <TabLink href={hrefFor('month', monthKey)} active={span.kind === 'month'}>
          Month
        </TabLink>
        <TabLink href={hrefFor('semester', termKey)} active={span.kind === 'semester'}>
          Semester
        </TabLink>
        <span className="ml-auto flex items-center gap-1.5">
          <Link href={hrefFor(span.kind, span.prev)} className="inline-flex min-h-[40px] items-center rounded-[20px] border border-parch-200 bg-parch-50 px-3 text-[12px] font-bold text-parch-700 hover:border-brand-gold/60" aria-label="Earlier">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="min-w-[120px] text-center text-[13px] font-bold text-parch-900">{span.label}</span>
          <Link href={hrefFor(span.kind, span.next)} className="inline-flex min-h-[40px] items-center rounded-[20px] border border-parch-200 bg-parch-50 px-3 text-[12px] font-bold text-parch-700 hover:border-brand-gold/60" aria-label="Later">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </span>
      </nav>

      {canRotate &&
        (fillable.length === 0 ? (
          <p className="mb-5 rounded-[12px] border border-parch-200 bg-parch-50 px-4 py-2.5 text-[12px] text-parch-600">
            {span.label} is over. Open a coming month or semester to assign it by rotation.
          </p>
        ) : (
          // Keyed on class and span: Next keeps a component's state when only the address's query changes.
          <RotationPanel
            key={`${cls.id}:${span.key}`}
            classId={cls.id}
            className={cls.name}
            from={fillable[0]!}
            to={fillable[fillable.length - 1]!}
            servants={servants}
            defaultRoles={defaultRotationRoles(recent)}
          />
        ))}

      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-bold text-parch-900">{span.label} as it stands</h2>
        <p className="text-[11px] text-parch-500">
          {assigned} part{assigned === 1 ? '' : 's'} assigned · ✓ marked done · tap a Sunday to open it
        </p>
      </div>
      <ScheduleGrid
        rows={rows.map((r) => ({
          weekStart: r.weekStart,
          sunday: r.sunday,
          href: `/portal/agenda?class=${encodeURIComponent(cls.id)}&week=${r.weekStart}`,
          past: r.sunday < today,
          next: r.sunday === nextSunday,
        }))}
        roles={roles}
        cells={cells}
        testId="schedule-calendar"
      />
    </>
  )
}
