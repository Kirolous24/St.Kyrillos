// Months and semesters, as the calendars and the Schedule's rotation use them
// (2026-11-01): a servant asked to see "what you're preparing over the course
// of a month or semester". Pure; tested in tests/portal/calendar-spans.test.ts.

import { addDays, dayOfWeek, parseDateOnly } from './dates'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** A semester: Fall is September to December, Spring January to May, Summer June to August. */
export interface Term {
  /** "2026-fall", as the address carries it. */
  key: string
  /** "Fall 2026". */
  label: string
  start: string
  end: string
}

const TERMS = [
  { name: 'spring', label: 'Spring', from: 1, to: 5 },
  { name: 'summer', label: 'Summer', from: 6, to: 8 },
  { name: 'fall', label: 'Fall', from: 9, to: 12 },
] as const

const pad = (n: number) => String(n).padStart(2, '0')

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function makeTerm(year: number, index: number): Term {
  const t = TERMS[index]!
  return { key: `${year}-${t.name}`, label: `${t.label} ${year}`, start: `${year}-${pad(t.from)}-01`, end: `${year}-${pad(t.to)}-${pad(lastDay(year, t.to))}` }
}

/** The semester a day falls in. */
export function termOf(date: string): Term {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  return makeTerm(year, TERMS.findIndex((t) => month >= t.from && month <= t.to))
}

/** "2027-spring" → that semester, or null for anything else. */
export function termByKey(key: string | null | undefined): Term | null {
  const m = /^(\d{4})-(spring|summer|fall)$/.exec(key ?? '')
  if (!m) return null
  return makeTerm(Number(m[1]), TERMS.findIndex((t) => t.name === m[2]))
}

/** The semester `by` steps after (or, negative, before) this one. */
export function shiftTerm(key: string, by: number): Term {
  const term = termByKey(key) ?? termOf(key)
  const year = Number(term.key.slice(0, 4))
  const flat = year * TERMS.length + TERMS.findIndex((t) => term.key.endsWith(t.name)) + by
  return makeTerm(Math.floor(flat / TERMS.length), ((flat % TERMS.length) + TERMS.length) % TERMS.length)
}

/** "2026-11" → "November 2026". */
export function monthLabel(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

export function shiftMonth(month: string, by: number): string {
  const flat = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by
  return `${Math.floor(flat / 12)}-${pad((flat % 12) + 1)}`
}

function isMonth(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value) && !!parseDateOnly(`${value}-01`)
}

/** Every Sunday from `start` to `end`, both included. */
export function sundaysBetween(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = addDays(start, (7 - dayOfWeek(start)) % 7); d <= end; d = addDays(d, 7)) out.push(d)
  return out
}

function monthEnd(month: string): string {
  return `${month}-${pad(lastDay(Number(month.slice(0, 4)), Number(month.slice(5, 7))))}`
}

/** The Sundays whose own date is in the month. */
export function monthSundays(month: string): string[] {
  return sundaysBetween(`${month}-01`, monthEnd(month))
}

/** The month as weeks from Sunday to Saturday; days outside it are null. */
export function monthGrid(month: string): Array<Array<string | null>> {
  const first = `${month}-01`
  const end = monthEnd(month)
  const rows: Array<Array<string | null>> = []
  for (let d = addDays(first, -dayOfWeek(first)); d <= end; d = addDays(d, 7)) {
    rows.push(Array.from({ length: 7 }, (_, i) => {
      const day = addDays(d, i)
      return day >= first && day <= end ? day : null
    }))
  }
  return rows
}

/** What a calendar page shows: one month, or one semester. */
export interface CalendarSpan {
  kind: 'month' | 'semester'
  /** "2026-11" or "2026-fall". */
  key: string
  label: string
  start: string
  end: string
  prev: string
  next: string
}

/**
 * The span an address asks for: `?span=semester&term=2027-spring`, or a month,
 * `?month=2026-11`. Anything unreadable falls back to the month or semester
 * today is in.
 */
export function calendarSpan(params: { span?: string; month?: string; term?: string }, today: string): CalendarSpan {
  if (params.span === 'semester') {
    const term = termByKey(params.term) ?? termOf(today)
    return { kind: 'semester', key: term.key, label: term.label, start: term.start, end: term.end, prev: shiftTerm(term.key, -1).key, next: shiftTerm(term.key, 1).key }
  }
  const month = isMonth(params.month) ? params.month : today.slice(0, 7)
  return { kind: 'month', key: month, label: monthLabel(month), start: `${month}-01`, end: monthEnd(month), prev: shiftMonth(month, -1), next: shiftMonth(month, 1) }
}

/** The address of a span, for links: `span=semester&term=…` or `month=…`. */
export function spanQuery(kind: CalendarSpan['kind'], key: string): string {
  return kind === 'semester' ? `span=semester&term=${encodeURIComponent(key)}` : `month=${encodeURIComponent(key)}`
}
