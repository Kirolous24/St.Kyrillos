import { randomBytes } from 'node:crypto'
import { addDays, daysUntilBirthday } from './dates'

/**
 * The children's birthdays as a calendar a servant subscribes to (2026-10-19).
 * A servant asked for the kids' birthdays "automatically" in their Apple
 * calendar "with notifications": a subscription does that, because the phone
 * fetches the link again by itself, so a new child or a corrected birthday
 * arrives without anyone re-adding anything.
 *
 * Each birthday is an all-day event for this year and next, rather than one
 * event repeating yearly, so the title can say how old the child turns. The
 * window moves along by itself each time the calendar is fetched.
 *
 * Names are first name and last initial. Calendars get shared with family and
 * shown on lock screens, and the servant already knows who "Mina K." is.
 */

export interface CalendarKid {
  id: string
  firstName: string
  lastName: string
  /** YYYY-MM-DD, or null when no birthday is on file. */
  dob: string | null
  className: string
}

/** What the calendar is called in the servant's list of calendars. */
export const CALENDAR_NAME = 'Sunday School birthdays'

/** How often calendar apps are asked to check back; the link's cache matches it. */
export const REFRESH_HOURS = 12

/** The reminder, as hours after the start of the all-day event: 9 AM on the day. */
const REMINDER = 'PT9H'

const PRODID = '-//St. Kyrillos Coptic Orthodox Church//Sunday School Portal//EN'
const UID_DOMAIN = 'birthdays.stkyrillostn.org'

/** iCalendar TEXT escaping (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/**
 * Lines longer than 75 bytes continue on the next line after one space
 * (RFC 5545 §3.1). Counting bytes, not characters, and never cutting inside a
 * character: an emoji is four bytes, and Apple shows a broken name otherwise.
 */
function fold(line: string): string {
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8')
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (dateOnly: string) => dateOnly.replace(/-/g, '')

function stamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function shortName(kid: CalendarKid): string {
  const first = kid.firstName.trim()
  const initial = Array.from(kid.lastName.trim())[0]
  return initial ? `${first} ${initial}.` : first
}

/** The child's birthday in a given year; 29 February falls back to the 28th. */
function birthdayIn(dob: string, year: number): string {
  const jan1 = `${year}-01-01`
  return addDays(jan1, daysUntilBirthday(dob, jan1))
}

export function birthdayCalendarIcs({ kids, today, now }: { kids: CalendarKid[]; today: string; now: Date }): string {
  const thisYear = Number(today.slice(0, 4))
  const occurrences: Array<{ kid: CalendarKid; on: string; turning: number; year: number }> = []
  for (const kid of kids) {
    if (!kid.dob) continue
    const born = Number(kid.dob.slice(0, 4))
    for (const year of [thisYear, thisYear + 1]) {
      const turning = year - born
      if (turning < 1) continue
      occurrences.push({ kid, on: birthdayIn(kid.dob, year), turning, year })
    }
  }
  occurrences.sort((a, b) => a.on.localeCompare(b.on) || shortName(a.kid).localeCompare(shortName(b.kid)))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:PT${REFRESH_HOURS}H`,
    `X-PUBLISHED-TTL:PT${REFRESH_HOURS}H`,
  ]
  const dtstamp = stamp(now)
  for (const { kid, on, turning, year } of occurrences) {
    const summary = escapeText(`🎂 ${shortName(kid)} turns ${turning}`)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${kid.id}-${year}@${UID_DOMAIN}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compactDate(on)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(on, 1))}`,
      `SUMMARY:${summary}`,
    )
    if (kid.className.trim()) lines.push(`DESCRIPTION:${escapeText(kid.className.trim())}`)
    lines.push(
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${summary}`,
      `TRIGGER:${REMINDER}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/**
 * The secret in a servant's calendar link. Calendar apps cannot sign in, so
 * whoever holds the link sees the birthdays; 24 random bytes cannot be guessed,
 * and the servant can replace it.
 */
export function newCalendarToken(): string {
  return randomBytes(24).toString('base64url')
}

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/

/** Only something shaped like a token is looked up, so stray requests never wake the database. */
export function isCalendarToken(value: string): boolean {
  return TOKEN_RE.test(value)
}
