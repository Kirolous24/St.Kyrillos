import type { HistoryRow } from './attendance-rules'
import { churchToday, daysBetween, parseDateOnly } from './dates'
import { formatMonthDay } from './format'

/**
 * Follow-up excuses (2026-10-19): a servant says a child is away — travelling,
 * ill, a family matter — from one date to another, in their own words. While
 * it lasts the child stays on every list, marked excused with the reason and
 * who said so, and nobody is asked to follow them up: no automatic case opens
 * for a Sunday inside it, and those Sundays never count toward a streak.
 *
 * Pure. lib/portal/data/excuses.ts loads them; lib/portal/actions/excuses.ts
 * writes them.
 */

/** Both ends included, as date-only strings in church time. */
export interface ExcuseWindow {
  startsOn: string
  endsOn: string
}

/** What a page shows of an excuse. Plain strings, so it can go to a client component. */
export interface ExcuseView extends ExcuseWindow {
  id: string
  studentId: string
  reason: string
  setBy: string | null
  /** ISO time it was set. */
  setAt: string
  /** Who changed it last, when anybody has since it was set. */
  changedBy: string | null
  changedAt: string | null
}

export const EXCUSE_REASON_MAX = 500
/** A year and a day, both ends counted: long enough for a school year abroad, short enough to catch a mistyped year. */
export const EXCUSE_MAX_DAYS = 366

/** What is wrong with these dates, in words for the servant; null when they make an excuse. */
export function excuseDatesProblem(startsOn: string, endsOn: string): string | null {
  const start = parseDateOnly(startsOn)
  const end = parseDateOnly(endsOn)
  if (!start || !end) return 'Pick a start and an end date.'
  if (end < start) return 'The excuse ends before it starts.'
  if (daysBetween(start, end) + 1 > EXCUSE_MAX_DAYS) return 'An excuse can cover at most a year. Check the dates.'
  return null
}

export type ExcuseState = 'upcoming' | 'active' | 'past'

export function excuseState(w: ExcuseWindow, today: string): ExcuseState {
  if (today < w.startsOn) return 'upcoming'
  if (today > w.endsOn) return 'past'
  return 'active'
}

export function isExcusedOn(windows: readonly ExcuseWindow[], date: string): boolean {
  return windows.some((w) => w.startsOn <= date && date <= w.endsOn)
}

/**
 * The excuse to show beside a child now: the one covering today (the one that
 * runs longest, when two overlap), otherwise the next one to start.
 */
export function currentExcuse<T extends ExcuseWindow>(list: readonly T[], today: string): T | null {
  const active = list.filter((w) => excuseState(w, today) === 'active').sort((a, b) => (a.endsOn < b.endsOn ? 1 : a.endsOn > b.endsOn ? -1 : 0))
  if (active[0]) return active[0]
  const upcoming = list.filter((w) => excuseState(w, today) === 'upcoming').sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0))
  return upcoming[0] ?? null
}

/** "Excused until Nov 10", "Excused Oct 20 – Nov 10", "Excused today", "Was excused Aug 1 – Aug 10". */
export function excuseSummary(w: ExcuseWindow, today: string): string {
  const oneDay = w.startsOn === w.endsOn
  const range = `${formatMonthDay(w.startsOn)} – ${formatMonthDay(w.endsOn)}`
  switch (excuseState(w, today)) {
    case 'active':
      return oneDay ? 'Excused today' : `Excused until ${formatMonthDay(w.endsOn)}`
    case 'upcoming':
      return oneDay ? `Excused on ${formatMonthDay(w.startsOn)}` : `Excused ${range}`
    case 'past':
      return oneDay ? `Was excused on ${formatMonthDay(w.startsOn)}` : `Was excused ${range}`
  }
}

/** "Set by Mary Servant on Oct 19 · changed by George Servant on Oct 21", days in church time. */
export function excuseByLine(e: Pick<ExcuseView, 'setBy' | 'setAt' | 'changedBy' | 'changedAt'>): string {
  const on = (iso: string) => formatMonthDay(churchToday(new Date(iso)))
  const set = `Set by ${e.setBy ?? 'a former servant'} on ${on(e.setAt)}`
  return e.changedAt ? `${set} · changed by ${e.changedBy ?? 'a former servant'} on ${on(e.changedAt)}` : set
}

/**
 * A child's attendance with every held date inside an excuse read as EXCUSED,
 * for the follow-up rule (lib/portal/attendance-rules.ts): an excused Sunday
 * breaks a streak exactly as an excused mark on the register does, and a child
 * who came anyway is still PRESENT, because the best mark of a day wins.
 *
 * Dates before `since` (the day the child joined) are left alone, so an excuse
 * that began before they joined cannot pull the start of their record back.
 */
export function withExcusedDates(
  heldDates: readonly string[],
  history: readonly HistoryRow[],
  windows: readonly ExcuseWindow[],
  since?: string,
): HistoryRow[] {
  if (windows.length === 0) return [...history]
  const excused = heldDates
    .filter((d) => (since === undefined || d >= since) && isExcusedOn(windows, d))
    .map((date) => ({ date, status: 'EXCUSED' as const }))
  return [...history, ...excused]
}
