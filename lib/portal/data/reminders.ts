import { prisma } from '@/lib/prisma'
import { NOTICE_DAYS, reminderNotice, type Duty } from '../assignment-notices'
import { addDays, churchToday } from '../dates'
import { deliverNotices, type OutgoingNotice } from '../notice-delivery'
import { dutiesDueOn } from './duties'

/**
 * The evening-before reminder (2026-10-19), run once a day by Vercel's
 * scheduler at about 6 PM church time. Every servant with a part due tomorrow
 * gets one reminder naming all of it, read as things stand now, so a servant
 * taken off since is not reminded. The key is per servant per day, so a second
 * run the same evening sends nothing new.
 *
 * It also clears out notices older than 60 days, with their dismissals.
 */
export async function sendTomorrowReminders(now: Date = new Date()): Promise<{
  date: string
  servants: number
  stored: number
  pushed: number
  emailed: number
  pruned: number
}> {
  const tomorrow = addDays(churchToday(now), 1)
  const byServant = new Map<string, Duty[]>()
  for (const d of await dutiesDueOn(tomorrow)) byServant.set(d.servantId, [...(byServant.get(d.servantId) ?? []), d])

  const notices: OutgoingNotice[] = Array.from(byServant.entries()).map(([servantId, duties]) => ({
    servantId,
    kind: 'reminder',
    ...reminderNotice(duties),
    dedupeKey: `reminder:${servantId}:${tomorrow}`,
  }))
  const report = notices.length > 0 ? await deliverNotices(notices) : { stored: 0, pushed: 0, emailed: 0, skipped: 0 }

  const cutoff = new Date(now.getTime() - NOTICE_DAYS * 86_400_000)
  const [pruned] = await Promise.all([
    prisma.notice.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.notificationRead.deleteMany({ where: { key: { startsWith: 'notice:' }, readAt: { lt: cutoff } } }),
  ])

  return { date: tomorrow, servants: byServant.size, stored: report.stored, pushed: report.pushed, emailed: report.emailed, pruned: pruned.count }
}
