import { addDays, mondayOf, parseDateOnly } from './dates'

/**
 * The week a servant is marking themselves for on My Attendance (2026-09-28).
 * The card used to be fixed on this week, so a servant who forgot to mark a
 * Sunday could never go back. Any week the page shows may be marked; a week
 * that has not started may not.
 */
export function selfMarkWeek(requested: string | null | undefined, thisWeek: string, oldestWeek: string): string {
  const asked = requested ? parseDateOnly(requested) : null
  if (!asked) return thisWeek
  const week = mondayOf(asked)
  if (week > thisWeek) return thisWeek
  if (week < oldestWeek) return oldestWeek
  return week
}

/** The weeks either side of `week` that the card may step to, or null at an end. */
export function selfMarkNeighbours(week: string, thisWeek: string, oldestWeek: string): { prev: string | null; next: string | null } {
  const prev = addDays(week, -7)
  const next = addDays(week, 7)
  return { prev: prev >= oldestWeek ? prev : null, next: next <= thisWeek ? next : null }
}

/** A week (its Monday) that has not begun yet in church time. */
export function isFutureWeek(weekStart: string, today: string): boolean {
  return mondayOf(weekStart) > mondayOf(today)
}
