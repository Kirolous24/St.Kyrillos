import type { HistoryRow, Status } from './attendance-rules'
import { isExcusedOn, type ExcuseWindow } from './excuses'

/**
 * The child cards on My Group and Class Groups (2026-09-26; Class Groups
 * 2026-10-19). Pure; lib/portal/data/group-cards.ts loads the rows.
 */

export interface SundayDot {
  date: string
  /** null: a Sunday before they joined. A held Sunday with no mark is ABSENT. */
  status: Status | null
  /** A follow-up excuse covers it and they did not come. */
  excused: boolean
}

/** The last `count` Sundays the class held, oldest first, as the card's dots. */
export function recentSundays(args: {
  held: readonly string[]
  rows: readonly HistoryRow[]
  since: string
  excuses: readonly ExcuseWindow[]
  count: number
}): SundayDot[] {
  const byDate = new Map(args.rows.map((r) => [r.date, r.status]))
  return [...args.held]
    .sort()
    .slice(-args.count)
    .map((date) => {
      const status = date < args.since ? null : byDate.get(date) ?? 'ABSENT'
      return { date, status, excused: status !== null && status !== 'PRESENT' && isExcusedOn(args.excuses, date) }
    })
}

/**
 * Who needs a call first: an open case, then nobody has reached them yet, then
 * the longest since anybody did. A child excused from follow-up goes last —
 * still there, but not a call anybody owes.
 */
export function compareKidCards(
  a: { name: string; excusedNow: boolean; openCase: boolean; daysSinceContact: number | null },
  b: { name: string; excusedNow: boolean; openCase: boolean; daysSinceContact: number | null },
): number {
  return (
    Number(a.excusedNow) - Number(b.excusedNow) ||
    Number(b.openCase) - Number(a.openCase) ||
    (a.daysSinceContact === null ? -1 : 0) - (b.daysSinceContact === null ? -1 : 0) ||
    (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0) ||
    a.name.localeCompare(b.name)
  )
}
