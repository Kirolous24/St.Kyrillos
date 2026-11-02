import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { announceNow, assignedNotice, changedNotice, dutyChanges, removedNotice, type Duty } from './assignment-notices'
import { deliverNotices, type OutgoingNotice } from './notice-delivery'
import { churchToday, toUTCDate } from './dates'

/**
 * Tell the servants what one save changed for them (2026-10-19): one notice
 * per servant, whether the save touched one week or a whole term. Called after
 * the write with a snapshot from before it and one from after, and it never
 * rejects: a notice that could not go out must not fail the save.
 *
 * A part more than a week away is not news yet (2026-11-01): it is held, and
 * the evening job tells its servant a week before it is due
 * (lib/portal/data/reminders.ts). Taking someone off a part that was still
 * held is not news either: they never heard of it.
 */
export async function notifyDutyChanges(
  before: readonly Duty[],
  after: readonly Duty[],
  actorServantId: string | null,
  today: string = churchToday(),
): Promise<void> {
  try {
    const changes = dutyChanges(before, after, { today, actorServantId })
    if (changes.length === 0) return

    const removedSlots = Array.from(new Set(changes.flatMap((c) => c.removed.map((d) => d.slot))))
    const holds =
      removedSlots.length > 0
        ? await prisma.dutyNoticeHold.findMany({ where: { slot: { in: removedSlots } }, select: { slot: true, servantId: true } })
        : []
    const held = new Set(holds.map((h) => `${h.slot}|${h.servantId}`))

    const notices: OutgoingNotice[] = []
    const later: Array<{ slot: string; servantId: string; due: Date }> = []
    const dropped = new Map<string, string[]>()
    for (const c of changes) {
      const added = c.added.filter((d) => announceNow(d, today))
      for (const d of c.added) if (!announceNow(d, today)) later.push({ slot: d.slot, servantId: c.servantId, due: toUTCDate(d.due!) })
      const wasHeld = (d: Duty) => held.has(`${d.slot}|${c.servantId}`)
      const removed = c.removed.filter((d) => !wasHeld(d))
      const unheld = c.removed.filter(wasHeld).map((d) => d.slot)
      if (unheld.length > 0) dropped.set(c.servantId, unheld)
      if (added.length === 0 && removed.length === 0) continue

      const kind = added.length > 0 ? 'assigned' : 'unassigned'
      const text =
        added.length > 0 && removed.length > 0
          ? changedNotice(added, removed)
          : added.length > 0
            ? assignedNotice(added)
            : removedNotice(removed)
      notices.push({ servantId: c.servantId, kind, ...text, dedupeKey: `${kind}:${c.servantId}:${randomUUID()}` })
    }
    await keepHolds(later, dropped)
    if (notices.length > 0) await deliverNotices(notices)
  } catch (err) {
    console.error('Assignment notices failed:', err)
  }
}

/** Hold the parts that wait, and drop those taken off before they were told. Never stops this week's notices. */
async function keepHolds(later: Array<{ slot: string; servantId: string; due: Date }>, dropped: Map<string, string[]>): Promise<void> {
  try {
    for (const [servantId, slots] of Array.from(dropped.entries())) {
      await prisma.dutyNoticeHold.deleteMany({ where: { servantId, slot: { in: slots } } })
    }
    if (later.length > 0) await prisma.dutyNoticeHold.createMany({ data: later, skipDuplicates: true })
  } catch (err) {
    console.error('Assignment notice holds failed:', err)
  }
}
