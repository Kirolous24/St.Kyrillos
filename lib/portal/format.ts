import { toUTCDate } from './dates'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Sun, Sep 20" from "2026-09-20". */
export function formatShortDate(dateStr: string): string {
  const d = toUTCDate(dateStr)
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** "Sep 20, 2026" from "2026-09-20". */
export function formatLongDate(dateStr: string): string {
  const d = toUTCDate(dateStr)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

/** "Sep 20" from "2026-09-20". */
export function formatMonthDay(dateStr: string): string {
  const d = toUTCDate(dateStr)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export const STAGE_LABEL: Record<'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL', string> = {
  ELEMENTARY: 'Elementary',
  MIDDLE_SCHOOL: 'Middle School',
  HIGH_SCHOOL: 'High School',
}

export const ROLE_LABEL: Record<'STUDENT' | 'SERVANT' | 'ADMIN' | 'PASTOR', string> = {
  STUDENT: 'Student',
  SERVANT: 'Servant',
  ADMIN: 'Admin',
  PASTOR: 'Pastor',
}

export const TITLE_LABEL: Record<'COORDINATOR' | 'ASSISTANT_COORDINATOR', string> = {
  COORDINATOR: 'Coordinator',
  ASSISTANT_COORDINATOR: 'Assistant Coordinator',
}

/**
 * "Academic Year 2026 – 2027 (1743 Coptic)". The school year runs
 * September→August, and the Coptic year is the Gregorian start year minus 283.
 *
 * The prefix is the prototype's (OG L1541): without it the topbar shows a bare
 * pair of years under the church name, which reads as a date rather than as the
 * year the portal's figures belong to (F0169).
 */
export function academicYearLabel(dateStr: string): string {
  const year = Number(dateStr.slice(0, 4))
  const month = Number(dateStr.slice(5, 7))
  const start = month >= 9 ? year : year - 1
  return `Academic Year ${start} \u2013 ${start + 1} (${start - 283} Coptic)`
}

/** "Good morning" / "Good afternoon" / "Good evening" in church time. */
export function greetingFor(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now),
  )
  if (hour < 12) return 'Good morning'
  // F0096 — the prototype flipped at 18:00 (OG getGreeting, L1711-1714). At 17
  // the portal was saying "Good evening" to servants who were still in class.
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * "just now" / "25m ago" / "6h ago" / "3d ago", then a plain date — the
 * prototype's own ladder (OG L1910-1921), which it used on the dashboard's
 * activity feed.
 *
 * `now` is a parameter rather than a call to Date.now() so this is testable
 * and so a server render and its hydration agree on one instant.
 */
export function timeAgo(at: Date | string | null | undefined, now: Date = new Date()): string {
  if (!at) return ''
  const then = typeof at === 'string' ? new Date(at) : at
  if (Number.isNaN(then.getTime())) return ''
  // A row written a few seconds ahead of this clock reads "just now" rather
  // than "-1m ago": server and database clocks are not the same clock.
  const mins = Math.round(Math.max(0, now.getTime() - then.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${MONTHS[then.getMonth()]} ${then.getDate()}`
}

/**
 * A stored event time as "HH:MM" for a native <input type="time">, or null when
 * it cannot be read confidently.
 *
 * Event times were free text ("6:00 PM", "6pm", "18:00"), so switching the field
 * to a time picker would blank every time already recorded. Callers render the
 * picker when this returns a value and keep a text box when it returns null, so
 * an entry nobody can parse is preserved rather than destroyed (F0317).
 */
export function toTimeInputValue(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/\./g, '')
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!m) return null
  let hour = Number(m[1])
  const min = Number(m[2] ?? '0')
  const mer = m[3]
  if (min > 59) return null
  if (mer) {
    if (hour < 1 || hour > 12) return null
    if (mer === 'pm' && hour !== 12) hour += 12
    if (mer === 'am' && hour === 12) hour = 0
  } else if (hour > 23) return null
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** "18:30" → "6:30 PM", for reading back what the picker stored. */
export function formatTimeOfDay(raw: string | null | undefined): string | null {
  const hhmm = toTimeInputValue(raw)
  if (!hhmm) return raw?.trim() || null
  const [h, m] = hhmm.split(':').map(Number)
  const mer = h! < 12 ? 'AM' : 'PM'
  const hour12 = h! % 12 === 0 ? 12 : h! % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${mer}`
}
