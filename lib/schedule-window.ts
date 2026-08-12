// Single source of truth for the rolling schedule window and all week/day math.
//
// ScheduleEvent rows are stored at NOON UTC and keyed for display by their
// calendar date ("YYYY-MM-DD"). Previously the API computed the window in UTC
// while the client computed it in local time, so "this week" could disagree by
// a day near week boundaries — the single POST would reject dates the client
// offered, and the batch route (which had no validation) would accept dates the
// public window then hid. To keep the admin UI, the public site, the APIs, and
// the server-side materializer in exact agreement, ALL window/day math lives
// here and is done in UTC against the calendar date.

export const SCHEDULE_WEEKS = 4

/** "YYYY-MM-DD" for a Date using its UTC calendar date. */
export function toUTCDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The noon-UTC instant to STORE for a "YYYY-MM-DD" (so the date never shifts by timezone). */
export function dateStrToNoonUTC(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00.000Z`)
}

/** The Sunday at 00:00:00.000 UTC that begins the week containing `now`. */
export function weekStartUTC(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // step back to Sunday
  return d
}

/** Rolling window [weekStart, weekEnd] covering `weeks` weeks from this week's Sunday. */
export function scheduleWindowUTC(now: Date, weeks: number = SCHEDULE_WEEKS): { weekStart: Date; weekEnd: Date } {
  const weekStart = weekStartUTC(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + weeks * 7 - 1)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

/** Calendar date "YYYY-MM-DD" of `dayOfWeek` (0=Sun … 6=Sat) in week `weekIndex` (0-based) of the window. */
export function windowDateStr(now: Date, weekIndex: number, dayOfWeek: number): string {
  const start = weekStartUTC(now)
  const d = new Date(start)
  d.setUTCDate(start.getUTCDate() + weekIndex * 7 + dayOfWeek)
  return toUTCDateStr(d)
}

/** Whether a "YYYY-MM-DD" falls inside the rolling window for `now`. */
export function isWithinWindow(dateStr: string, now: Date, weeks: number = SCHEDULE_WEEKS): boolean {
  const d = dateStrToNoonUTC(dateStr)
  if (isNaN(d.getTime())) return false
  const { weekStart, weekEnd } = scheduleWindowUTC(now, weeks)
  return d >= weekStart && d <= weekEnd
}
