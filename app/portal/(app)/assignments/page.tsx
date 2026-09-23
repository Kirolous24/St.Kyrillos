import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, CalendarClock, CalendarDays, ClipboardList, History, Star, UserCheck } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { assignmentsForServant } from '@/lib/portal/data/agenda'
import { groupAssignmentsByWeek, weekDistanceLabel, type Assignment, type AssignmentWeek } from '@/lib/portal/agenda'
import { mondayOf, todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, Card, Badge, EmptyState, StatCard, LinkButton, IconTile } from '@/components/portal/ui'

export const metadata = { title: 'My Assignments' }

const KIND_ICON = {
  lead: UserCheck,
  backup: UserCheck,
  lesson: BookOpen,
  agenda: Star,
} as const

const KIND_BADGE: Record<Assignment['kind'], { tone: 'brand' | 'gold' | 'info' | 'neutral'; label: string }> = {
  lead: { tone: 'brand', label: 'Lead' },
  backup: { tone: 'info', label: 'Backup' },
  lesson: { tone: 'gold', label: 'Lesson' },
  agenda: { tone: 'neutral', label: 'Activity' },
}

/** The prototype's group heading: 12px bold uppercase, grey, lightly tracked. */
function GroupTitle({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] font-bold uppercase tracking-[0.5px] text-parch-500">{children}</span>
}

export default async function AssignmentsPage() {
  const user = await requirePortalUser()
  // A staff screen: students have no business here, so it is simply not there
  // for them (same treatment as /portal/exams/new).
  if (user.role === 'STUDENT') notFound()

  if (!user.servantId) {
    return (
      <>
        <PageHeader title="My Assignments" icon={<ClipboardList className="h-5 w-5" aria-hidden />} />
        <EmptyState
          title="Assignments are for servants"
          hint="Anything you are asked to lead or prepare will show up here once you are on a class."
        />
      </>
    )
  }

  const today = todayInNewYork()
  const all = await assignmentsForServant(user.servantId, today)
  const { upcoming, past, undated } = groupAssignmentsByWeek(all, today)
  // `upcoming` holds this week AND every future week, so upcoming[0] is only
  // this week when this week has something in it. Match the Monday explicitly.
  const thisWeek = upcoming.find((w) => w.weekStart === mondayOf(today))
  const upcomingCount = upcoming.reduce((n, w) => n + w.items.length, 0)

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="My Assignments" icon={<ClipboardList className="h-5 w-5" aria-hidden />} />
        <EmptyState
          title="Nothing assigned to you yet"
          hint="Your class's Schedule of the Year is where activities and lead duty are handed out."
          action={<LinkButton href="/portal/agenda" variant="secondary">Open the schedule</LinkButton>}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="My Assignments"
        icon={<ClipboardList className="h-5 w-5" aria-hidden />}
        subtitle="Everything you are down to lead, teach or prepare."
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatCard
          label="This week"
          value={thisWeek?.items.length ?? 0}
          tone="brand"
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Coming up"
          value={upcomingCount}
          icon={<CalendarClock className="h-5 w-5" aria-hidden />}
          accent="#C89B3C"
        />
        <StatCard
          label="Past weeks"
          value={past.length}
          icon={<History className="h-5 w-5" aria-hidden />}
          accent="#7C7A7A"
        />
      </div>

      {upcoming.length === 0 ? (
        <EmptyState title="Nothing coming up" hint="Your past assignments are below." />
      ) : (
        <>
          {/* F0612 — the prototype headed this list "Upcoming (N)". The stat
              tiles carry the number but nothing names the list under them, so a
              servant scrolling past the tiles met a stack of week cards with no
              heading saying what they were — and "Past weeks" below it does have
              one, which made the top half read as the whole page. */}
          <p className="mb-2.5">
            <GroupTitle>Upcoming ({upcomingCount})</GroupTitle>
          </p>
          <div className="space-y-4">
            {upcoming.map((week) => (
              <WeekCard key={week.weekStart} week={week} today={today} />
            ))}
          </div>
        </>
      )}

      {undated.length > 0 && (
        <div className="mt-5">
          <Card title={<GroupTitle>No date yet ({undated.length})</GroupTitle>} bodyClassName="p-0">
            <AssignmentList items={undated} />
          </Card>
        </div>
      )}

      {/* F0613 — the prototype rendered past weeks inline. Collapsed, the
            question a servant asks this page after the fact — did I already lead
            that lesson? — took an extra tap, and a disclosure with nothing
            visible inside it reads as an empty section. It still folds away.
            F0229 — and this block is built from assignmentsForServant's
            eight-week default, so a bare "Past weeks (3)" read as everything
            since September: a servant checking October was told "no" by a list
            that had simply stopped. The window is unchanged; what it covers is
            no longer a secret. */}
      {past.length > 0 && (
        <details open className="mt-5 overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card">
          <summary className="cursor-pointer select-none px-[18px] py-3.5">
            <GroupTitle>Past weeks · last 8 weeks ({past.length})</GroupTitle>
          </summary>
          <div className="border-t border-[#F0EEE8]">
            {past.map((week) => (
              <div key={week.weekStart}>
                <p className="border-b border-[#F0EEE8] bg-parch-100/60 px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                  {week.label} · {weekDistanceLabel(week.weekStart, today)}
                </p>
                <AssignmentList items={week.items} muted />
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  )
}

function WeekCard({ week, today }: { week: AssignmentWeek; today: string }) {
  const distance = weekDistanceLabel(week.weekStart, today)
  const isThisWeek = distance === 'This week'
  return (
    <Card
      tone={isThisWeek ? 'brand' : 'default'}
      title={<GroupTitle>{week.label} ({week.items.length})</GroupTitle>}
      icon={<CalendarDays className="h-4 w-4" aria-hidden />}
      action={<Badge tone={isThisWeek ? 'gold' : 'neutral'}>{distance}</Badge>}
      bodyClassName="p-0"
    >
      <AssignmentList items={week.items} />
    </Card>
  )
}

/**
 * The prototype's assignment row: a soft square icon tile in the class's accent,
 * the role and topic on one bold line, then class · week underneath.
 */
function AssignmentList({ items, muted }: { items: Assignment[]; muted?: boolean }) {
  return (
    <ul>
      {items.map((item) => {
        const Icon = KIND_ICON[item.kind] ?? ClipboardList
        const badge = KIND_BADGE[item.kind]
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 border-b-[0.5px] border-[#F0EEE8] px-[18px] py-3 last:border-b-0"
          >
            <IconTile accent={muted ? '#7C7A7A' : accentFor(item.classId)} size="sm">
              <Icon className="h-[17px] w-[17px]" aria-hidden />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={item.href}
                  className="text-[13px] font-bold text-parch-900 hover:text-brand-800"
                >
                  {item.title}
                </Link>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              <p className="mt-0.5 text-[12px] text-parch-500">
                {item.className}
                {item.date ? ` · ${formatLongDate(item.date)}` : ''}
              </p>
              {item.detail && (
                <p className="mt-0.5 whitespace-pre-line text-[12.5px] text-parch-700">{item.detail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
