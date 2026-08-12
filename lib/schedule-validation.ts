// Shared, pure input validators for the scheduling APIs. Previously each route
// hand-rolled partial checks (e.g. `typeof durationMinutes === 'number'`), which
// let negative durations, out-of-range dayOfWeek, and malformed times through and
// corrupt scheduling data. Centralizing them here makes every route consistent
// and the rules unit-testable.

export const MAX_MINUTES_IN_DAY = 24 * 60 // 1440

/** durationMinutes must be a positive number no longer than a full day. */
export function isValidDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_MINUTES_IN_DAY
}

/** sortOrder is minutes-from-midnight: an integer in [0, 1440). */
export function isValidSortOrder(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MAX_MINUTES_IN_DAY
}

/** dayOfWeek is an integer 0 (Sun) … 6 (Sat). */
export function isValidDayOfWeek(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

/** 24-hour "HH:MM" / "H:MM" clock string. */
export function isValidTime24(value: unknown): value is string {
  return typeof value === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(value)
}

/** Minutes from midnight for a validated 24-hour time string. */
export function time24ToSortOrder(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** "YYYY-MM-DD" calendar-date string. */
export function isValidDateStr(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00.000Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}
