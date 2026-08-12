// Pure planner that turns day-of-week WeeklyService templates into the concrete
// per-date ScheduleEvent rows that should exist across the rolling window.
//
// This is the single source of truth for "which weekly-service events belong on
// the calendar". It is:
//   • Complete   — it emits an instance for EVERY enabled service in EVERY week
//                  of the window, so weeks auto-populate without the admin
//                  manually selecting each one.
//   • Idempotent — it skips any instance that already exists (matched by a
//                  natural key), so running it repeatedly (cron, admin load,
//                  manual "Apply") never creates duplicates.
//
// Keeping it pure (no DB, no Date.now, no React) makes every rule above unit
// testable.

import { SCHEDULE_WEEKS, windowDateStr } from './schedule-window'

export interface WeeklyServiceInput {
  id: string
  dayOfWeek: number // 0=Sun … 6=Sat
  title: string
  time: string // 24-hr "HH:MM"
  durationMinutes: number
  location: string
  description: string | null
  enabled: boolean
  sortOrder: number // minutes from midnight
}

export interface ExistingEventInput {
  date: string // ISO string or "YYYY-MM-DD" — only the date part is used
  sortOrder: number
  title: string
}

export interface PlannedEvent {
  date: string // "YYYY-MM-DD"
  time: string // display "8:00 AM"
  sortOrder: number
  durationMinutes: number
  title: string
  description: string | null
  location: string | null
}

/** 24-hr "08:00" → display "8:00 AM". Matches the format used everywhere else in the app. */
export function to12h(t24: string): string {
  const [hStr, mStr = '00'] = t24.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) h = 0
  const period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr} ${period}`
}

/**
 * Natural identity of a materialized event: same calendar day + same start
 * minute + same (case-insensitive, trimmed) title. Two events sharing this key
 * are the same service on the same day, so we never create both.
 */
export function eventKey(dateStr: string, sortOrder: number, title: string): string {
  return `${dateStr.slice(0, 10)}|${sortOrder}|${title.trim().toLowerCase()}`
}

/**
 * Compute the ScheduleEvent rows that are MISSING for the enabled weekly
 * services across the rolling window. Returns only rows that need to be created.
 */
export function planWeeklyMaterialization(
  weeklyServices: WeeklyServiceInput[],
  existingEvents: ExistingEventInput[],
  now: Date,
  weeks: number = SCHEDULE_WEEKS,
): PlannedEvent[] {
  const seen = new Set<string>(
    existingEvents.map((e) => eventKey(e.date, e.sortOrder, e.title)),
  )
  const planned: PlannedEvent[] = []

  for (let w = 0; w < weeks; w++) {
    for (const s of weeklyServices) {
      if (!s.enabled) continue
      const dateStr = windowDateStr(now, w, s.dayOfWeek)
      const key = eventKey(dateStr, s.sortOrder, s.title)
      if (seen.has(key)) continue // already exists OR already planned this run — skip
      seen.add(key)
      planned.push({
        date: dateStr,
        time: to12h(s.time),
        sortOrder: s.sortOrder,
        durationMinutes: s.durationMinutes,
        title: s.title,
        description: s.description,
        location: s.location,
      })
    }
  }

  return planned
}
