// Van reservations (2026-11-02). A servant asked: "Can we do something for the
// Vans … To organize using them: Reserve Day, Servants, For how long, Service:
// Middle, Elementary, High School, Men's Meeting, Women's Meeting, Youth
// Meeting", and the answer was "a calendar on who using what". Pure; tested in
// tests/portal/reservations.test.ts.

import { addDays, churchClock, churchDateTime, parseDateOnly } from './dates'
import { STAGE_LABEL, formatShortDate, formatTimeOfDay } from './format'
import type { StageKey } from './permissions'

/** The longest a van may be out at once, and how far ahead it may be reserved. */
export const MAX_RESERVATION_DAYS = 14
export const BOOK_AHEAD_DAYS = 366

/** How the calendar tells the vans apart. A white van is drawn white with a grey edge. */
export const RESERVATION_COLORS = {
  black: { label: 'Black', bg: '#1F2937', fg: '#FFFFFF', border: '#1F2937' },
  white: { label: 'White', bg: '#FFFFFF', fg: '#1F2937', border: '#94A3B8' },
  gray: { label: 'Gray', bg: '#6B7280', fg: '#FFFFFF', border: '#6B7280' },
  blue: { label: 'Blue', bg: '#1D4ED8', fg: '#FFFFFF', border: '#1D4ED8' },
  red: { label: 'Red', bg: '#B91C1C', fg: '#FFFFFF', border: '#B91C1C' },
  green: { label: 'Green', bg: '#15803D', fg: '#FFFFFF', border: '#15803D' },
  gold: { label: 'Gold', bg: '#B45309', fg: '#FFFFFF', border: '#B45309' },
  purple: { label: 'Purple', bg: '#6D28D9', fg: '#FFFFFF', border: '#6D28D9' },
} as const

export type ReservationColor = keyof typeof RESERVATION_COLORS

export function isReservationColor(key: string): key is ReservationColor {
  return Object.prototype.hasOwnProperty.call(RESERVATION_COLORS, key)
}

export function colorOf(key: string): (typeof RESERVATION_COLORS)[ReservationColor] {
  return isReservationColor(key) ? RESERVATION_COLORS[key] : RESERVATION_COLORS.blue
}

/** The service a van goes out for when it is none of the listed ones; the note says what. */
export const SERVICE_OTHER = 'Other'
export const MAX_RESERVATION_SERVANTS = 12
export const RESERVATION_NOTE_MAX = 300

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_MS = 86_400_000

export interface ReservationTimesInput {
  date: string
  from: string
  until: string
  /** The day it comes back, when that is not `date`. */
  untilDate?: string | null
}

export type ReservationTimes = { ok: true; startsAt: Date; endsAt: Date } | { ok: false; error: string }

function isDay(value: string): boolean {
  return DAY_RE.test(value) && parseDateOnly(value) !== null
}

/** The form's day and times, read on the church's clock, or what is wrong with them. */
export function readReservationTimes(input: ReservationTimesInput, now: Date): ReservationTimes {
  const date = input.date.trim()
  const back = input.untilDate?.trim() || date
  if (!isDay(date)) return { ok: false, error: 'Pick the day.' }
  if (!TIME_RE.test(input.from)) return { ok: false, error: 'Pick the time in “From”.' }
  if (!TIME_RE.test(input.until)) return { ok: false, error: 'Pick the time in “Until”.' }
  if (!isDay(back)) return { ok: false, error: 'Pick the day it comes back.' }
  const startsAt = churchDateTime(date, input.from)
  const endsAt = churchDateTime(back, input.until)
  if (!startsAt || !endsAt) return { ok: false, error: 'Pick the day.' }
  if (endsAt <= startsAt) return { ok: false, error: '“Until” has to be after “From”.' }
  if (endsAt.getTime() - startsAt.getTime() > MAX_RESERVATION_DAYS * DAY_MS) {
    return { ok: false, error: `A reservation can be ${MAX_RESERVATION_DAYS} days at most.` }
  }
  if (endsAt <= now) return { ok: false, error: 'That time has already passed.' }
  if (startsAt.getTime() > now.getTime() + BOOK_AHEAD_DAYS * DAY_MS) return { ok: false, error: 'You can reserve up to a year ahead.' }
  return { ok: true, startsAt, endsAt }
}

interface Span {
  startsAt: Date
  endsAt: Date
}

/** Whether two times share any part. One may start the minute the other is back. */
export function overlaps(a: Span, b: Span): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

/** "Sat, Nov 7 · 9:00 AM – 12:00 PM", or both days when it comes back on another. */
export function formatReservationTime(r: Span): string {
  const from = churchClock(r.startsAt)
  const until = churchClock(r.endsAt)
  const fromTime = formatTimeOfDay(from.time)
  const untilTime = formatTimeOfDay(until.time)
  if (from.date === until.date) return `${formatShortDate(from.date)} · ${fromTime} – ${untilTime}`
  return `${formatShortDate(from.date)}, ${fromTime} – ${formatShortDate(until.date)}, ${untilTime}`
}

/** When a van that is out comes back: the time if that is today, else the day and the time. */
export function formatBackAt(endsAt: Date, today: string): string {
  const back = churchClock(endsAt)
  const time = formatTimeOfDay(back.time) ?? back.time
  return back.date === today ? time : `${formatShortDate(back.date)}, ${time}`
}

/** "9 AM", "12:30 PM": a time as short as a calendar square needs. */
function shortTime(hhmm: string): string {
  return (formatTimeOfDay(hhmm) ?? hhmm).replace(':00 ', ' ')
}

/** What a calendar day says about a reservation: its hours, or when it leaves, all day, or when it is back. */
export function dayLabel(r: Span, day: string): string {
  const from = churchClock(r.startsAt)
  const days = reservationDays(r)
  const until = churchClock(r.endsAt)
  if (days.length === 1) return `${shortTime(from.time)}–${shortTime(until.time)}`
  if (day === days[0]) return `from ${shortTime(from.time)}`
  if (day === days[days.length - 1]) return `until ${shortTime(until.time)}`
  return 'all day'
}

/** The church days a reservation is out on. Back at midnight does not take the next day. */
export function reservationDays(r: Span): string[] {
  const first = churchClock(r.startsAt).date
  const last = churchClock(new Date(Math.max(r.startsAt.getTime(), r.endsAt.getTime() - 1))).date
  const days: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d)
  return days
}

/** Each reservation under every day from `start` to `end` that it covers, in time order. */
export function reservationsByDay<T extends Span>(list: readonly T[], start: string, end: string): Map<string, T[]> {
  const days = new Map<string, T[]>()
  for (const r of [...list].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    for (const day of reservationDays(r)) {
      if (day < start || day > end) continue
      const list = days.get(day)
      if (list) list.push(r)
      else days.set(day, [r])
    }
  }
  return days
}

/** The services a van goes out for: the three Sunday School stages, each meeting, and Other. */
export function serviceOptions(meetingNames: readonly string[]): string[] {
  return [STAGE_LABEL.ELEMENTARY, STAGE_LABEL.MIDDLE_SCHOOL, STAGE_LABEL.HIGH_SCHOOL, ...meetingNames, SERVICE_OTHER]
}

/** The service someone most likely reserves for: the one stage or meeting they serve, else none. */
export function defaultService(classes: ReadonlyArray<{ stage: StageKey; name: string }>, oversight: StageKey | null): string {
  const labels = new Set(classes.map((c) => (c.stage === 'FELLOWSHIP' ? c.name : STAGE_LABEL[c.stage])))
  if (oversight && oversight !== 'FELLOWSHIP') labels.add(STAGE_LABEL[oversight])
  return labels.size === 1 ? Array.from(labels)[0]! : ''
}

/** What it is for, in a sentence: the service, or the note when the service is Other. */
export function reservationPurpose(r: { service: string; note: string | null }): string {
  if (r.service !== SERVICE_OTHER) return r.service
  const note = r.note?.trim().replace(/\s+/g, ' ') ?? ''
  if (!note) return SERVICE_OTHER
  return note.length > 60 ? `${note.slice(0, 59)}…` : note
}

interface Changer {
  role: string
  accountId: string
  servantId?: string | null
}

interface Owned {
  createdById: string | null
  servantIds: readonly string[]
  endsAt: Date
}

function ownsReservation(user: Changer, r: Owned): boolean {
  return r.createdById === user.accountId || (!!user.servantId && r.servantIds.includes(user.servantId))
}

/** Changed by whoever made it, the servants on it, or the admin; by nobody once it is over. */
export function mayEditReservation(user: Changer, r: Owned, now: Date): boolean {
  if (r.endsAt <= now) return false
  return user.role === 'ADMIN' || ownsReservation(user, r)
}

/** Cancelled by the same people until it is over; after that, taken off by the admin only. */
export function mayCancelReservation(user: Changer, r: Owned, now: Date): boolean {
  if (user.role === 'ADMIN') return true
  return r.endsAt > now && ownsReservation(user, r)
}

/** Who may reserve and see the reservations: servants, the admin and the pastor. */
export function canReserve(role: string): boolean {
  return role === 'SERVANT' || role === 'ADMIN' || role === 'PASTOR'
}

export interface ReservationSnapshot {
  id: string
  itemName: string
  startsAt: Date
  endsAt: Date
  service: string
  note: string | null
  servantIds: readonly string[]
}

export interface ReservationNotice {
  servantId: string
  title: string
  body: string
  href: string
}

function monthHref(r: Span): string {
  return `/portal/reservations?month=${churchClock(r.startsAt).date.slice(0, 7)}`
}

/**
 * What to tell the servants on a reservation that someone else made, changed
 * or cancelled: who was put on it, who was taken off, and who stayed while its
 * van or time or service moved. The one who did it is not told, and nobody is
 * told about a reservation that is over.
 */
export function reservationNotices(
  before: ReservationSnapshot | null,
  after: ReservationSnapshot | null,
  actor: { servantId: string | null; name: string },
  now: Date,
): ReservationNotice[] {
  const notices: ReservationNotice[] = []
  const others = (ids: readonly string[]) => ids.filter((id) => id !== actor.servantId)
  if (!after) {
    if (!before || before.endsAt <= now) return notices
    for (const servantId of others(before.servantIds)) {
      notices.push({
        servantId,
        title: `${before.itemName} reservation cancelled`,
        body: `${actor.name} cancelled the ${before.itemName} for ${reservationPurpose(before)}: ${formatReservationTime(before)}.`,
        href: monthHref(before),
      })
    }
    return notices
  }

  const had = new Set(before?.servantIds ?? [])
  const has = new Set(after.servantIds)
  if (after.endsAt > now) {
    for (const servantId of others(after.servantIds.filter((id) => !had.has(id)))) {
      notices.push({
        servantId,
        title: `${after.itemName} reserved for you`,
        body: `${actor.name} put you on the ${after.itemName} for ${reservationPurpose(after)}: ${formatReservationTime(after)}.`,
        href: `/portal/reservations/${after.id}`,
      })
    }
  }
  if (!before) return notices

  if (before.endsAt > now) {
    for (const servantId of others(before.servantIds.filter((id) => !has.has(id)))) {
      notices.push({
        servantId,
        title: `Taken off the ${before.itemName}`,
        body: `${actor.name} took you off the ${before.itemName} for ${reservationPurpose(before)}: ${formatReservationTime(before)}.`,
        href: monthHref(before),
      })
    }
  }
  const moved =
    before.itemName !== after.itemName ||
    before.startsAt.getTime() !== after.startsAt.getTime() ||
    before.endsAt.getTime() !== after.endsAt.getTime() ||
    before.service !== after.service
  if (moved && after.endsAt > now) {
    for (const servantId of others(after.servantIds.filter((id) => had.has(id)))) {
      notices.push({
        servantId,
        title: 'A reservation of yours changed',
        body: `${actor.name} changed it: the ${after.itemName} for ${reservationPurpose(after)}, ${formatReservationTime(after)}.`,
        href: `/portal/reservations/${after.id}`,
      })
    }
  }
  return notices
}
