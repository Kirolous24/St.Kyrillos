import Link from 'next/link'
import { BookOpen, CalendarDays, Star, UserCheck } from 'lucide-react'
import type { PortalUser } from '@/lib/portal/permissions'
import { weekAssignmentsForServant } from '@/lib/portal/data/agenda'
import { nextPlannedLesson } from '@/lib/portal/data/lessons'
import { mondayOf, todayInNewYork } from '@/lib/portal/dates'
import { weekLabel, type Assignment } from '@/lib/portal/agenda'
import { formatLongDate } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { Card, Badge, IconTile } from '@/components/portal/ui'

const KIND_ICON = {
  lead: UserCheck,
  backup: UserCheck,
  lesson: BookOpen,
  agenda: Star,
} as const

/**
 * Dashboard column: what this servant is down for this week, and the lesson
 * they should be preparing next. Students and anyone without a servant record
 * get nothing.
 */
export async function LessonsWidget({ user }: { user: PortalUser }): Promise<JSX.Element | null> {
  if (!user.servantId) return null

  const today = todayInNewYork()
  const monday = mondayOf(today)
  const [assignments, lesson] = await Promise.all([
    weekAssignmentsForServant(user.servantId, monday),
    nextPlannedLesson(user.classIds, user.servantId, today),
  ])

  if (assignments.length === 0 && !lesson) return null

  return (
    <Card
      tone="brand"
      title="This week in class"
      icon={<CalendarDays className="h-4 w-4" aria-hidden />}
      action={
        <Link href="/portal/assignments" className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800 hover:underline">
          All assignments
        </Link>
      }
      bodyClassName="p-0"
    >
      <p className="border-b border-[#F0EEE8] px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-[0.8px] text-brand-gold-dark">
        {weekLabel(monday)}
      </p>

      {assignments.length === 0 ? (
        <p className="px-[18px] py-3.5 text-[12.5px] text-parch-500">Nothing assigned to you this week.</p>
      ) : (
        <ul>
          {assignments.slice(0, 6).map((item: Assignment) => {
            const Icon = KIND_ICON[item.kind] ?? Star
            return (
              <li
                key={item.id}
                className="flex items-center gap-2.5 border-b-[0.5px] border-[#F0EEE8] px-[18px] py-2.5 last:border-b-0"
              >
                <IconTile accent={accentFor(item.classId)} size="sm">
                  <Icon className="h-4 w-4" aria-hidden />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <Link href={item.href} className="text-[13px] font-bold text-parch-900 hover:text-brand-800">
                    {item.title}
                  </Link>
                  <p className="truncate text-[12px] text-parch-500">
                    {item.className}
                    {item.detail ? ` · ${item.detail}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {assignments.length > 6 && (
        <p className="px-[18px] py-2 text-[11px] text-parch-500">+{assignments.length - 6} more this week</p>
      )}

      {lesson && (
        <div className="border-t border-[#F0EEE8] px-[18px] py-3.5">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Next lesson</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/portal/lessons?class=${encodeURIComponent(lesson.classId)}`}
              className="font-serif text-[14px] font-bold text-parch-900 hover:text-brand-800"
            >
              {lesson.title}
            </Link>
            {lesson.assignedToId === user.servantId && <Badge tone="gold">Yours</Badge>}
          </div>
          <p className="text-[12px] text-parch-500">
            {lesson.className}
            {lesson.date ? ` · ${formatLongDate(lesson.date)}` : ''}
          </p>
        </div>
      )}
    </Card>
  )
}
