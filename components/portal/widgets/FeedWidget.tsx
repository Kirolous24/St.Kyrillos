import Link from 'next/link'
import { BookOpenCheck, Flame, Megaphone, MessageSquare, Trophy } from 'lucide-react'
import type { PortalUser } from '@/lib/portal/permissions'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { countRecentPosts } from '@/lib/portal/data/feed'
import { classCheckInsToday, latestAnnouncementFor, loadAchievements, readingStateFor } from '@/lib/portal/data/community'
import { addDays, todayInNewYork, toUTCDate } from '@/lib/portal/dates'
import { Card, Badge, ProgressBar, IconTile } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

/**
 * Dashboard column for the community area.
 *
 * Students get today's reading check-in, the newest announcement aimed at them
 * and the badge they are closest to; servants get what is new in their class
 * feeds and who has read today. Returns null when a person has neither.
 */
export async function FeedWidget({ user }: { user: PortalUser }): Promise<JSX.Element | null> {
  const today = todayInNewYork()
  return user.studentId ? StudentCards({ user, studentId: user.studentId, today }) : StaffCards({ user, today })
}

async function StudentCards({ user, studentId, today }: { user: PortalUser; studentId: string; today: string }) {
  const [reading, announcement, achievements] = await Promise.all([
    readingStateFor(studentId, today),
    latestAnnouncementFor(user),
    loadAchievements(studentId, today),
  ])
  const nextBadge = achievements.locked[0] ?? null

  return (
    <>
      <Card title="Today" icon={<BookOpenCheck className="h-3.5 w-3.5" aria-hidden />} tone="brand">
        <Link
          href="/portal/readings"
          className={cn(
            'flex min-h-[44px] items-center gap-3 rounded-[12px] border px-3 py-2.5 transition-colors',
            reading.checkedInToday
              ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A] hover:border-[#86EFAC]'
              : 'border-parch-200 bg-parch-100 text-parch-700 hover:border-brand-gold/60 hover:bg-brand-wash hover:text-brand-800',
          )}
        >
          <BookOpenCheck className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1 text-[12.5px] font-bold">
            {reading.checkedInToday ? 'Bible reading checked in' : 'Read your Bible today?'}
          </span>
          {reading.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-[12.5px] font-bold tabular-nums">
              <Flame className="h-4 w-4 text-brand-gold" aria-hidden />
              {reading.streak}
            </span>
          )}
        </Link>

        {nextBadge && (
          <div className="mt-3 rounded-[12px] border border-parch-200 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="text-[22px] leading-none">{nextBadge.badge.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[12.5px] font-bold text-parch-900">
                  <Trophy className="h-3.5 w-3.5 text-brand-gold-dark" aria-hidden />
                  {nextBadge.badge.name}
                </p>
                <p className="truncate text-[11px] text-parch-500">{nextBadge.badge.requirement}</p>
              </div>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-parch-500">
                {nextBadge.current}/{nextBadge.target}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={nextBadge.percent} tone="warn" label={nextBadge.badge.requirement} />
            </div>
            <Link href="/portal/achievements" className="mt-2 inline-block text-[11px] font-bold uppercase tracking-[0.5px] text-brand-800 hover:underline">
              All achievements →
            </Link>
          </div>
        )}
      </Card>

      {announcement && (
        <Card title="Latest announcement" icon={<Megaphone className="h-3.5 w-3.5" aria-hidden />}>
          <Link href="/portal/announcements" className="flex gap-3 rounded-[12px] transition-colors hover:bg-brand-wash/60">
            <IconTile accent="#C89B3C" size="sm">
              <span className="text-[19px] leading-none">{announcement.emoji || '📣'}</span>
            </IconTile>
            <span className="min-w-0">
              <span className="block font-serif text-[13px] font-bold text-parch-900">{announcement.title}</span>
              <span className="mt-0.5 line-clamp-3 block text-[11.5px] leading-[1.6] text-parch-500">{announcement.body}</span>
            </span>
          </Link>
        </Card>
      )}
    </>
  )
}

async function StaffCards({ user, today }: { user: PortalUser; today: string }) {
  const classes = await listVisibleClasses(user)
  if (classes.length === 0) return null

  const classIds = classes.map((c) => c.id)
  const [newPosts, checkIns] = await Promise.all([
    countRecentPosts(classIds, toUTCDate(addDays(today, -7))),
    classCheckInsToday(classes.map((c) => ({ id: c.id, name: c.name })), today),
  ])
  const readers = checkIns.reduce((n, c) => n + c.readers.length, 0)
  const roster = checkIns.reduce((n, c) => n + c.total, 0)
  if (newPosts === 0 && roster === 0) return null

  const rowClass =
    'flex min-h-[44px] items-center gap-3 rounded-[12px] border border-parch-200 px-3 py-2.5 transition-colors hover:border-brand-gold/60 hover:bg-brand-wash'

  return (
    <Card title="Class life" icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}>
      <ul className="space-y-2">
        <li>
          <Link href="/portal/feed" className={rowClass}>
            <MessageSquare className="h-5 w-5 shrink-0 text-brand-gold-dark" aria-hidden />
            <span className="flex-1 text-[12.5px] font-bold text-parch-800">
              {newPosts === 0 ? 'No new posts this week' : `${newPosts} new post${newPosts === 1 ? '' : 's'} this week`}
            </span>
            {newPosts > 0 && <Badge tone="brand">{newPosts}</Badge>}
          </Link>
        </li>
        <li>
          <Link href="/portal/readings" className={rowClass}>
            <BookOpenCheck className="h-5 w-5 shrink-0 text-brand-gold-dark" aria-hidden />
            <span className="flex-1 text-[12.5px] font-bold text-parch-800">Bible reading today</span>
            <span className="text-[12.5px] font-bold tabular-nums text-parch-500">{readers}/{roster}</span>
          </Link>
        </li>
        <li>
          <Link href="/portal/announcements" className={rowClass}>
            <Megaphone className="h-5 w-5 shrink-0 text-brand-gold-dark" aria-hidden />
            <span className="flex-1 text-[12.5px] font-bold text-parch-800">Announcements</span>
          </Link>
        </li>
      </ul>
    </Card>
  )
}
