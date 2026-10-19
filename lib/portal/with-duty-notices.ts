import type { Duty } from './assignment-notices'
import { notifyDutyChanges } from './notify-duties'

/**
 * Wrap a save that can change who holds a part of a Sunday (2026-10-19):
 * read who holds what, write, read again, and tell the servants what changed.
 * The notices can never undo or fail the write. If the first read fails nobody
 * is told, and anything after the write only logs.
 */
export async function withDutyNotices<T>(
  snapshot: () => Promise<Duty[]>,
  actorServantId: string | null,
  write: () => Promise<T>,
): Promise<T> {
  const before = await snapshot().catch((err) => {
    console.error('Assignment snapshot failed:', err)
    return null
  })
  const result = await write()
  if (before) {
    try {
      await notifyDutyChanges(before, await snapshot(), actorServantId)
    } catch (err) {
      console.error('Assignment notices failed:', err)
    }
  }
  return result
}
