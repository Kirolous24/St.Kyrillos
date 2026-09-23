// Date-only helpers. Every value is a "YYYY-MM-DD" string; arithmetic is done
// in UTC so it never drifts with the server's timezone. "Today" is computed
// in America/New_York because that is where the church is.

export const CHURCH_TIMEZONE = 'America/New_York'

const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})/
const US_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function build(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Parse "YYYY-MM-DD", "YYYY-MM-DDT…", or "M/D/YYYY" into "YYYY-MM-DD"; null when invalid. */
export function parseDateOnly(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  let m = ISO_RE.exec(value)
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]))
  m = US_RE.exec(value)
  if (m) return build(Number(m[3]), Number(m[1]), Number(m[2]))
  return null
}

export function toUTCDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** How far the church's wall clock is ahead of UTC at that instant, in ms. */
function churchOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHURCH_TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const hour = get('hour') % 24 // some ICU builds render midnight as "24"
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')) - at.getTime()
}

/**
 * The instant midnight begins in the church's timezone on that date.
 *
 * `toUTCDate` is right for the `@db.Date` columns, which carry no time at all.
 * Timestamp columns (PointEntry.createdAt, QuizResult.submittedAt) are real
 * instants, so filtering them on UTC midnight would shift the report window
 * 4-5 hours early and file an evening Vespers row into the wrong month.
 */
export function newYorkDayStart(dateStr: string): Date {
  const utcMidnight = toUTCDate(dateStr)
  const guess = new Date(utcMidnight.getTime() - churchOffsetMs(utcMidnight))
  // Re-read the offset at the candidate instant so a DST changeover lands right.
  return new Date(utcMidnight.getTime() - churchOffsetMs(guess))
}

export function todayInNewYork(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHURCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addDays(dateStr: string, days: number): string {
  const d = toUTCDate(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return formatDateOnly(d)
}

/** Monday of the ISO week containing the date. */
export function mondayOf(dateStr: string): string {
  const d = toUTCDate(dateStr)
  const day = d.getUTCDay() // 0 = Sunday
  const back = day === 0 ? 6 : day - 1
  return addDays(dateStr, -back)
}

export function dayOfWeek(dateStr: string): number {
  return toUTCDate(dateStr).getUTCDay()
}

export function ageOn(dob: string, on: string): number {
  const b = toUTCDate(dob)
  const t = toUTCDate(on)
  let age = t.getUTCFullYear() - b.getUTCFullYear()
  const beforeBirthday =
    t.getUTCMonth() < b.getUTCMonth() ||
    (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

function nextOccurrence(dob: string, from: string): string {
  const b = toUTCDate(dob)
  const f = toUTCDate(from)
  const tryYear = (y: number) => {
    // Feb 29 falls back to Feb 28 in non-leap years.
    const cand = new Date(Date.UTC(y, b.getUTCMonth(), b.getUTCDate()))
    if (cand.getUTCMonth() !== b.getUTCMonth()) cand.setUTCDate(0)
    return cand
  }
  let cand = tryYear(f.getUTCFullYear())
  if (cand.getTime() < f.getTime()) cand = tryYear(f.getUTCFullYear() + 1)
  return formatDateOnly(cand)
}

export function daysUntilBirthday(dob: string, from: string): number {
  const next = toUTCDate(nextOccurrence(dob, from))
  return Math.round((next.getTime() - toUTCDate(from).getTime()) / 86_400_000)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / 86_400_000)
}

/** Day-of-week names, indexed 0 = Sunday, as ServantActivity.dayOfWeek stores them. */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/**
 * F0354 — the hour of the day in church time, 0–23.
 *
 * Used to decide when Sunday's "attendance has not been taken" reminder stops
 * being a note in the corner and becomes a banner: before classes have met, a
 * prompt to take the register is nagging, and after they have finished it is the
 * most useful thing on the page. The server's clock is wherever Vercel put it,
 * so the church's own hour has to be asked for explicitly.
 */
export function hourInNewYork(at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: CHURCH_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(at)
  const parsed = Number(hour)
  // hour12:false can render midnight as "24" in some ICU versions.
  return Number.isFinite(parsed) ? parsed % 24 : 0
}

/**
 * F0316 — the weekday a date-only string falls on, for echoing beside a date
 * picker.
 *
 * The prototype's event form had a separate day-of-week box, which is two
 * fields for one fact: fill in 14 March and pick Tuesday and the event now
 * disagrees with itself, and the card that reads it has to choose which to
 * believe. The day is worked out from the date instead; this is what makes it
 * visible while the date is being typed, so nothing is lost by not asking.
 *
 * Parsed as UTC noon rather than midnight so a browser behind UTC cannot roll
 * the answer back to the previous day.
 */
export function weekdayName(dateOnly: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null
  const at = Date.parse(`${dateOnly}T12:00:00.000Z`)
  if (Number.isNaN(at)) return null
  return DAY_NAMES[new Date(at).getUTCDay()] ?? null
}
