import { randomUUID } from 'node:crypto'
import { assignedNotice, changedNotice, dutyChanges, removedNotice, type Duty } from './assignment-notices'
import { deliverNotices, type OutgoingNotice } from './notice-delivery'
import { churchToday } from './dates'

/**
 * Tell the servants what one save changed for them (2026-10-19): one notice
 * per servant, whether the save touched one week or a whole term. Called after
 * the write with a snapshot from before it and one from after, and it never
 * rejects: a notice that could not go out must not fail the save.
 */
export async function notifyDutyChanges(
  before: readonly Duty[],
  after: readonly Duty[],
  actorServantId: string | null,
  today: string = churchToday(),
): Promise<void> {
  try {
    const notices: OutgoingNotice[] = []
    for (const c of dutyChanges(before, after, { today, actorServantId })) {
      const kind = c.added.length > 0 ? 'assigned' : 'unassigned'
      const text =
        c.added.length > 0 && c.removed.length > 0
          ? changedNotice(c.added, c.removed)
          : c.added.length > 0
            ? assignedNotice(c.added)
            : removedNotice(c.removed)
      notices.push({ servantId: c.servantId, kind, ...text, dedupeKey: `${kind}:${c.servantId}:${randomUUID()}` })
    }
    if (notices.length > 0) await deliverNotices(notices)
  } catch (err) {
    console.error('Assignment notices failed:', err)
  }
}
