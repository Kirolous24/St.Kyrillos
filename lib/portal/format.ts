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
 * "2026 – 2027 (1743 Coptic)". The school year runs September→August, and the
 * Coptic year is the Gregorian start year minus 283.
 */
export function academicYearLabel(dateStr: string): string {
  const year = Number(dateStr.slice(0, 4))
  const month = Number(dateStr.slice(5, 7))
  const start = month >= 9 ? year : year - 1
  return `${start} \u2013 ${start + 1} (${start - 283} Coptic)`
}

/** "Good morning" / "Good afternoon" / "Good evening" in church time. */
export function greetingFor(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
