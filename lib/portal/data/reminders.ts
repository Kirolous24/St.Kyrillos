import { prisma } from '@/lib/prisma'
import { NOTICE_AHEAD_DAYS, NOTICE_DAYS, assignedNotice, comingSunday, dailyReminderNotice, notDoneNotice, reminderNotice, type Duty } from '../assignment-notices'
import { addDays, churchToday, mondayOf, toUTCDate } from '../dates'
import { deliverNotices, type OutgoingNotice } from '../notice-delivery'
import { dutiesDueOn, dutiesForSlots } from './duties'

/**
 * The evening reminders, run once a day by Vercel's scheduler at about 6 PM
 * church time.
 *
 * The evening before (2026-10-19): every servant with a part due tomorrow gets
 * one reminder naming all of it, read as things stand now, so a servant taken
 * off since is not reminded. A part its servant has marked done is left out,
 * and the class's Coordinator and Assistant Coordinator get one list of the
 * parts that are not. Email may carry it.
 *
 * Every other evening (2026-10-25: "daily reminders instead of just for
 * Saturday"): each servant gets one reminder of the coming Sunday's parts they
 * have not marked done, so a servant prepares through the week rather than on
 * Saturday night. Lead, Backup and lessons cannot be marked done, so they wait
 * for the evening before; and this one stays in the bell and on the phone, not
 * in email.
 *
 * A week before (2026-11-01): a part given out more than a week ahead was
 * held rather than announced that day (lib/portal/notify-duties.ts). Each
 * evening the held parts now a week or less away are announced to whoever
 * holds them, once per servant, and left out of that evening's daily reminder
 * so nobody hears of one part twice in an evening.
 *
 * The keys are per servant per day, so a second run the same evening sends
 * nothing new. It also clears out notices older than 60 days, with their
 * dismissals.
 */
export async function sendDailyReminders(now: Date = new Date()): Promise<{
  date: string
  servants: number
  coordinators: number
  daily: number
  announced: number
  stored: number
  pushed: number
  emailed: number
  pruned: number
}> {
  const today = churchToday(now)
  const tomorrow = addDays(today, 1)
  const sunday = comingSunday(today)
  const eveningBefore = sunday === tomorrow
  const [due, ahead] = await Promise.all([dutiesDueOn(tomorrow), eveningBefore ? Promise.resolve([] as Duty[]) : dutiesDueOn(sunday)])
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
  const announced = await announceHeldParts(today, notices)
  // Every other evening, the coming Sunday's parts not marked done yet.
  const dailyByServant = new Map<string, Duty[]>()
  for (const d of ahead) {
    if (d.kind !== 'activity' || d.done || announced.has(d.slot)) continue
    dailyByServant.set(d.servantId, [...(dailyByServant.get(d.servantId) ?? []), d])
  }
  for (const [servantId, duties] of Array.from(dailyByServant.entries())) {
    notices.push({ servantId, kind: 'reminder', ...dailyReminderNotice(duties, sunday), dedupeKey: `daily:${servantId}:${today}`, email: false })
  }

  const report = notices.length > 0 ? await deliverNotices(notices) : { stored: 0, pushed: 0, emailed: 0, skipped: 0 }

  const cutoff = new Date(now.getTime() - NOTICE_DAYS * 86_400_000)
  const [pruned] = await Promise.all([
    prisma.notice.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.notificationRead.deleteMany({ where: { key: { startsWith: 'notice:' }, readAt: { lt: cutoff } } }),
  ])

  return {
    date: tomorrow,
    servants: byServant.size,
    coordinators,
    daily: dailyByServant.size,
    announced: new Set(notices.filter((n) => n.dedupeKey.startsWith('ahead:')).map((n) => n.servantId)).size,
    stored: report.stored,
    pushed: report.pushed,
    emailed: report.emailed,
    pruned: pruned.count,
  }
}

/**
 * Add tonight's "a week before" notices to `notices`: the held parts due within
 * the week, told to the servant who holds each now. A part that changed hands
 * or went since is told to nobody; its hold goes either way. Returns the slots
 * announced. A failure here never stops the evening's reminders: the holds stay
 * and the next evening tries again.
 */
export async function announceHeldParts(today: string, notices: OutgoingNotice[]): Promise<Set<string>> {
  const announced = new Set<string>()
  try {
    const horizon = toUTCDate(addDays(today, NOTICE_AHEAD_DAYS))
    const holds = await prisma.dutyNoticeHold.findMany({ where: { due: { lte: horizon } }, select: { slot: true, servantId: true } })
    if (holds.length === 0) return announced
    const now = new Map((await dutiesForSlots(holds.map((h) => h.slot))).map((d) => [d.slot, d]))
    const byServant = new Map<string, Duty[]>()
    for (const h of holds) {
      const d = now.get(h.slot)
      if (!d || d.servantId !== h.servantId || !d.due || d.due <= today) continue
      byServant.set(h.servantId, [...(byServant.get(h.servantId) ?? []), d])
      announced.add(d.slot)
    }
    // Cleared before anything is queued: a hold that cannot be cleared must
    // not be announced tonight and again tomorrow.
    await prisma.dutyNoticeHold.deleteMany({ where: { due: { lte: horizon } } })
    for (const [servantId, duties] of Array.from(byServant.entries())) {
      notices.push({ servantId, kind: 'assigned', ...assignedNotice(duties), dedupeKey: `ahead:${servantId}:${today}` })
    }
  } catch (err) {
    console.error('Week-ahead assignment notices failed:', err)
    announced.clear()
  }
  return announced
}
