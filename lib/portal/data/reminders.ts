import { prisma } from '@/lib/prisma'
import { NOTICE_DAYS, notDoneNotice, reminderNotice, type Duty } from '../assignment-notices'
import { addDays, churchToday, mondayOf } from '../dates'
import { deliverNotices, type OutgoingNotice } from '../notice-delivery'
import { dutiesDueOn } from './duties'

/**
 * The evening-before reminder (2026-10-19), run once a day by Vercel's
 * scheduler at about 6 PM church time. Every servant with a part due tomorrow
 * gets one reminder naming all of it, read as things stand now, so a servant
 * taken off since is not reminded. The key is per servant per day, so a second
 * run the same evening sends nothing new.
 *
 * A part its servant has marked done (2026-10-19) is left out, and the class's
 * Coordinator and Assistant Coordinator get one list of the parts that are not.
 *
 * It also clears out notices older than 60 days, with their dismissals.
 */
export async function sendTomorrowReminders(now: Date = new Date()): Promise<{
  date: string
  servants: number
  coordinators: number
  stored: number
  pushed: number
  emailed: number
  pruned: number
}> {
  const tomorrow = addDays(churchToday(now), 1)
  const due = await dutiesDueOn(tomorrow)
  const byServant = new Map<string, Duty[]>()
  for (const d of due) {
    if (d.done) continue
    byServant.set(d.servantId, [...(byServant.get(d.servantId) ?? []), d])
  }

  const notices: OutgoingNotice[] = Array.from(byServant.entries()).map(([servantId, duties]) => ({
    servantId,
    kind: 'reminder',
    ...reminderNotice(duties),
    dedupeKey: `reminder:${servantId}:${tomorrow}`,
  }))

  // The coordinators' list: the class's parts nobody has marked done.
  const pending = due.filter((d) => d.kind === 'activity' && !d.done && d.classId)
  let coordinators = 0
  if (pending.length > 0) {
    const classIds = Array.from(new Set(pending.map((d) => d.classId!)))
    const [heads, people] = await Promise.all([
      prisma.classServant.findMany({
        where: { classId: { in: classIds }, title: { in: ['COORDINATOR', 'ASSISTANT_COORDINATOR'] }, servant: { account: { isActive: true } } },
        select: { classId: true, servantId: true },
      }),
      prisma.servant.findMany({
        where: { id: { in: Array.from(new Set(pending.map((d) => d.servantId))) } },
        select: { id: true, account: { select: { displayName: true } } },
      }),
    ])
    const nameOf = new Map(people.map((p) => [p.id, p.account.displayName]))
    const byHead = new Map<string, Duty[]>()
    for (const h of heads) byHead.set(h.servantId, [...(byHead.get(h.servantId) ?? []), ...pending.filter((d) => d.classId === h.classId)])
    for (const [servantId, duties] of Array.from(byHead.entries())) {
      notices.push({
        servantId,
        kind: 'reminder',
        ...notDoneNotice(
          duties.map((d) => ({ label: d.label, servantName: nameOf.get(d.servantId) ?? 'a servant', className: d.className })),
          `/portal/agenda?class=${encodeURIComponent(duties[0]!.classId!)}&week=${mondayOf(tomorrow)}`,
        ),
        dedupeKey: `notdone:${servantId}:${tomorrow}`,
      })
    }
    coordinators = byHead.size
  }
  const report = notices.length > 0 ? await deliverNotices(notices) : { stored: 0, pushed: 0, emailed: 0, skipped: 0 }

  const cutoff = new Date(now.getTime() - NOTICE_DAYS * 86_400_000)
  const [pruned] = await Promise.all([
    prisma.notice.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.notificationRead.deleteMany({ where: { key: { startsWith: 'notice:' }, readAt: { lt: cutoff } } }),
  ])

  return { date: tomorrow, servants: byServant.size, coordinators, stored: report.stored, pushed: report.pushed, emailed: report.emailed, pruned: pruned.count }
}
