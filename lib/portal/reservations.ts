// Van reservations (2026-11-02). A servant asked: "Can we do something for the
// Vans … To organize using them: Reserve Day, Servants, For how long, Service:
// Middle, Elementary, High School, Men's Meeting, Women's Meeting, Youth
// Meeting", and the answer was "a calendar on who using what". Pure; tested in
// tests/portal/reservations.test.ts.

import { addDays, churchClock, churchDateTime, parseDateOnly } from './dates'
import { STAGE_LABEL, andList, formatDateTime, formatShortDate, formatTimeOfDay } from './format'
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

/** The service a van goes out for when it is none of the listed ones; the reason says what. */
export const SERVICE_OTHER = 'Other'
export const MAX_RESERVATION_SERVANTS = 12
/**
 * Every reservation says where the van is going and what for (2026-11-04, the
 * user: "make reason required … a place, reason on what and for what").
 */
export const RESERVATION_REASON_MAX = 300
export const REASON_NEEDED = 'Say where the van is going and what for.'

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

export interface ServiceGroup {
  label: string
  options: Array<{ value: string; text: string }>
}

const SCHOOL_STAGES = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL'] as const

/**
 * What a van goes out for (2026-11-04, the user: "classes, stages and
 * fellowships"): each Sunday School stage as a whole, then its classes in the
 * classes list's order, then the Fellowship meetings. Every stage is offered
 * though it has no classes yet. A class named like its stage is the stage.
 * Other comes after all of these, on its own.
 */
export function serviceGroups(classes: ReadonlyArray<{ stage: StageKey; name: string }>): ServiceGroup[] {
  const seen = new Set<string>([SERVICE_OTHER])
  const offer = (value: string, text = value) => {
    if (seen.has(value)) return []
    seen.add(value)
    return [{ value, text }]
  }
  const groups: ServiceGroup[] = SCHOOL_STAGES.map((stage) => ({
    label: STAGE_LABEL[stage],
    options: [...offer(STAGE_LABEL[stage], `${STAGE_LABEL[stage]} (all classes)`), ...classes.filter((c) => c.stage === stage).flatMap((c) => offer(c.name))],
  }))
  const meetings = classes.filter((c) => c.stage === 'FELLOWSHIP').flatMap((c) => offer(c.name))
  if (meetings.length > 0) groups.push({ label: 'Fellowship meetings', options: meetings })
  return groups
}

/** Every service a reservation may be for: whatever the groups offer, then Other. */
export function serviceValues(groups: readonly ServiceGroup[]): string[] {
  return [...groups.flatMap((g) => g.options.map((o) => o.value)), SERVICE_OTHER]
}

export function serviceOptions(classes: ReadonlyArray<{ stage: StageKey; name: string }>): string[] {
  return serviceValues(serviceGroups(classes))
}

/**
 * The service someone most likely reserves for: the one class or meeting they
 * serve, or the one stage their classes (or their oversight) are in; else none.
 */
export function defaultService(classes: ReadonlyArray<{ stage: StageKey; name: string }>, oversight: StageKey | null): string {
  if (classes.length === 1) return classes[0]!.name
  const stages = new Set(classes.map((c) => c.stage))
  if (oversight && oversight !== 'FELLOWSHIP') stages.add(oversight)
  const [only] = Array.from(stages)
  return stages.size === 1 && only !== 'FELLOWSHIP' ? STAGE_LABEL[only!] : ''
}

/** What it is for, in a sentence: the service, or the reason when the service is Other. */
export function reservationPurpose(r: { service: string; reason: string | null }): string {
  if (r.service !== SERVICE_OTHER) return r.service
  const reason = r.reason?.trim().replace(/\s+/g, ' ') ?? ''
  if (!reason) return SERVICE_OTHER
  return reason.length > 60 ? `${reason.slice(0, 59)}…` : reason
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

// ── Approval (2026-11-04) ──────────────────────────────────────────────────
// The user: "It also needs approval, it needs to go through" one servant, who
// "gets notifications on this and emails of the details" and can "accept it or
// reject it"; "the person who requests gets the notification and email back of
// the results", and an accepted one "shows on the calendar with who requests,
// approved, when, and what for".

export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** A request waiting for its answer and an approved one keep the van's time; one not approved does not. */
export const HOLDING_STATUSES: ReservationStatus[] = ['PENDING', 'APPROVED']
export const DECISION_NOTE_MAX = 300

/** Approves or rejects van requests: a servant the admin named, and the admin, who has them alone while nobody is named. */
export function mayDecideReservation(user: { role: string; servantId?: string | null }, approverServantIds: readonly string[]): boolean {
  return user.role === 'ADMIN' || (!!user.servantId && approverServantIds.includes(user.servantId))
}

interface Asked {
  itemId: string
  startsAt: Date
  endsAt: Date
  service: string
  reason: string | null
}

/** Whether a change needs approving again: another van, time, service or reason. Who is taking it does not. */
export function needsNewApproval(before: Asked, after: Asked): boolean {
  return (
    before.itemId !== after.itemId ||
    before.startsAt.getTime() !== after.startsAt.getTime() ||
    before.endsAt.getTime() !== after.endsAt.getTime() ||
    before.service !== after.service ||
    (before.reason ?? '').trim() !== (after.reason ?? '').trim()
  )
}

/**
 * Where a reservation stands once it is saved, and its approval: stamped now
 * by the one saving it, kept as it was, or cleared. Someone who may approve
 * gets theirs approved at once, and leaves someone else's request to the
 * Approve and Reject buttons; anyone else waits for an answer, unless an
 * approved one changed only in who is taking it.
 */
export function statusAfterSave(
  before: { status: ReservationStatus; createdById: string | null } | null,
  needsApproval: boolean,
  actor: { accountId: string; decides: boolean },
): { status: ReservationStatus; stamp: 'now' | 'keep' | 'clear' } {
  if (!before) return actor.decides ? { status: 'APPROVED', stamp: 'now' } : { status: 'PENDING', stamp: 'clear' }
  if (actor.decides) {
    if (before.status === 'APPROVED') return { status: 'APPROVED', stamp: needsApproval ? 'now' : 'keep' }
    if (before.createdById === actor.accountId) return { status: 'APPROVED', stamp: 'now' }
    return { status: before.status, stamp: 'keep' }
  }
  if (before.status === 'APPROVED' && !needsApproval) return { status: 'APPROVED', stamp: 'keep' }
  return { status: 'PENDING', stamp: 'clear' }
}

/** Where it stands, in a few words. A request nobody answered before its time is "Not answered". */
export function reservationStatusLabel(status: ReservationStatus, endsAt: Date, now: Date): string {
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Not approved'
  return endsAt <= now ? 'Not answered' : 'Waiting for approval'
}

export interface ReservationSnapshot {
  id: string
  itemName: string
  startsAt: Date
  endsAt: Date
  service: string
  reason: string | null
  status: ReservationStatus
  servantIds: readonly string[]
  /** The servants on it by name, for the email. */
  servantNames: readonly string[]
  /** Who asked: their account, their servant record when they have one, and their name. */
  requester: { accountId: string; servantId: string | null; name: string } | null
  decidedById: string | null
  decidedByName: string | null
  decidedAt: Date | null
  decisionNote: string | null
}

/** Who a notice is for: a servant, or an account with no servant record (the admin, the pastor). */
export type ReservationRecipient = { servantId: string } | { accountId: string }

export interface ReservationNotice {
  to: ReservationRecipient
  title: string
  body: string
  href: string
  /** Lines for the email alone: the van, the time, the reason, the people. */
  details?: string[]
  /** Emailed even when a phone was reached: a request, and its answer. */
  email?: 'always'
}

export interface ReservationNoticeContext {
  actor: { accountId: string; servantId: string | null; name: string }
  /** Told of every request: the approvers, or the admin while none is named. */
  approvers: readonly ReservationRecipient[]
  now: Date
}

function monthHref(r: Span): string {
  return `/portal/reservations?month=${churchClock(r.startsAt).date.slice(0, 7)}`
}

/** "Youth Meeting: Taking the youth to the park"; the reason alone for Other. */
function forWhat(r: { service: string; reason: string | null }): string {
  const reason = (r.reason ?? '').trim().replace(/\s+/g, ' ')
  if (!reason) return r.service
  return r.service === SERVICE_OTHER ? reason : `${r.service}: ${reason}`
}

/** The lines an email gives a reservation's details in. */
export function reservationDetails(r: ReservationSnapshot): string[] {
  const lines = [`Van: ${r.itemName}`, `When: ${formatReservationTime(r)}`, `For: ${r.service}`]
  const reason = r.reason?.trim()
  if (reason) lines.push(`Reason: ${reason}`)
  lines.push(`Servants: ${r.servantNames.length > 0 ? andList(r.servantNames) : 'nobody yet'}`)
  if (r.requester) lines.push(`Requested by: ${r.requester.name}`)
  if (r.status === 'APPROVED' && r.decidedByName) lines.push(`Approved by: ${r.decidedByName}${r.decidedAt ? `, ${formatDateTime(r.decidedAt)}` : ''}`)
  if (r.status === 'REJECTED') {
    if (r.decidedByName) lines.push(`Rejected by: ${r.decidedByName}`)
    const note = r.decisionNote?.trim()
    if (note) lines.push(`Why: ${note}`)
  }
  return lines
}

/** Any change at all a request's approver would want to see again, the servants included. */
function changedAtAll(a: ReservationSnapshot, b: ReservationSnapshot): boolean {
  const servants = (r: ReservationSnapshot) => [...r.servantIds].sort().join()
  return (
    a.itemName !== b.itemName ||
    a.startsAt.getTime() !== b.startsAt.getTime() ||
    a.endsAt.getTime() !== b.endsAt.getTime() ||
    a.service !== b.service ||
    (a.reason ?? '').trim() !== (b.reason ?? '').trim() ||
    servants(a) !== servants(b)
  )
}

/**
 * Who to tell what when a reservation is asked for, changed, answered or
 * cancelled. The approvers hear of each request, on the phone and by email
 * with every detail, and of one withdrawn. The one who asked hears the answer
 * the same way. The servants on it hear only of an approved reservation: when
 * it becomes theirs, when they are added or taken off, when it moves, and when
 * it stops being theirs. The one who did it is never told, and nobody is told
 * about a reservation that is over.
 */
export function reservationNotices(before: ReservationSnapshot | null, after: ReservationSnapshot | null, ctx: ReservationNoticeContext): ReservationNotice[] {
  const { actor, now } = ctx
  const notices: ReservationNotice[] = []
  const isActor = (to: ReservationRecipient) => ('servantId' in to ? to.servantId === actor.servantId : to.accountId === actor.accountId)
  const send = (to: ReservationRecipient, n: Omit<ReservationNotice, 'to'>) => {
    if (!isActor(to)) notices.push({ to, ...n })
  }
  const live = (r: ReservationSnapshot | null): r is ReservationSnapshot => !!r && r.endsAt > now
  const page = (r: ReservationSnapshot) => `/portal/reservations/${r.id}`
  /** The servants on it, and the one who asked when they are not one of them. */
  const people = (r: ReservationSnapshot): ReservationRecipient[] => {
    const list: ReservationRecipient[] = r.servantIds.map((servantId) => ({ servantId }))
    if (r.requester && !(r.requester.servantId && r.servantIds.includes(r.requester.servantId))) list.push({ accountId: r.requester.accountId })
    return list
  }

  // The approvers: a request to answer, or one withdrawn.
  if (live(after) && after.status === 'PENDING' && (!before || before.status !== 'PENDING' || changedAtAll(before, after))) {
    const fresh = !before || before.status === 'REJECTED'
    const asker = after.requester?.name ?? actor.name
    for (const to of ctx.approvers) {
      send(to, {
        title: fresh ? `${after.itemName} request from ${asker}` : `${after.itemName} request changed by ${actor.name}`,
        body: fresh
          ? `${asker} asks for the ${after.itemName}, ${formatReservationTime(after)}, for ${forWhat(after)}.`
          : `${actor.name} changed the request for the ${after.itemName}: ${formatReservationTime(after)}, for ${forWhat(after)}.`,
        href: page(after),
        details: reservationDetails(after),
        email: 'always',
      })
    }
  }
  if (!after && live(before) && before.status === 'PENDING') {
    for (const to of ctx.approvers) {
      send(to, {
        title: `${before.itemName} request withdrawn`,
        body: `${actor.name} withdrew the request for the ${before.itemName}: ${formatReservationTime(before)}.`,
        href: monthHref(before),
      })
    }
  }

  // The one who asked: the answer.
  if (before && live(after) && after.requester && before.status !== after.status && after.status !== 'PENDING') {
    const yes = after.status === 'APPROVED'
    const note = after.decisionNote?.trim()
    send(
      { accountId: after.requester.accountId },
      {
        title: `${after.itemName} request ${yes ? 'approved' : 'not approved'}`,
        body: `${actor.name} ${yes ? 'approved' : 'did not approve'} your request for the ${after.itemName}: ${formatReservationTime(after)}, ${reservationPurpose(after)}.${!yes && note ? ` “${note}”` : ''}`,
        href: page(after),
        details: reservationDetails(after),
        email: 'always',
      },
    )
  }

  // The servants on it, about an approved reservation only.
  const wasOn = live(before) && before.status === 'APPROVED'
  const isOn = live(after) && after.status === 'APPROVED'
  if (isOn && !wasOn) {
    // The one who asked is the one who did it, or was just told the answer.
    const asker = after.requester?.servantId ?? null
    const by = after.requester?.name ?? actor.name
    const approvedBy = after.decidedByName && after.decidedById !== after.requester?.accountId ? ` Approved by ${after.decidedByName}.` : ''
    for (const servantId of after.servantIds) {
      if (servantId === asker) continue
      send(
        { servantId },
        {
          title: `${after.itemName} reserved for you`,
          body: `${by} put you on the ${after.itemName} for ${reservationPurpose(after)}: ${formatReservationTime(after)}.${approvedBy}`,
          href: page(after),
        },
      )
    }
  }
  if (wasOn && isOn) {
    const had = new Set(before.servantIds)
    const has = new Set(after.servantIds)
    for (const servantId of after.servantIds.filter((id) => !had.has(id))) {
      send(
        { servantId },
        {
          title: `${after.itemName} reserved for you`,
          body: `${actor.name} put you on the ${after.itemName} for ${reservationPurpose(after)}: ${formatReservationTime(after)}.`,
          href: page(after),
        },
      )
    }
    for (const servantId of before.servantIds.filter((id) => !has.has(id))) {
      send(
        { servantId },
        {
          title: `Taken off the ${before.itemName}`,
          body: `${actor.name} took you off the ${before.itemName} for ${reservationPurpose(before)}: ${formatReservationTime(before)}.`,
          href: monthHref(before),
        },
      )
    }
    const moved =
      before.itemName !== after.itemName ||
      before.startsAt.getTime() !== after.startsAt.getTime() ||
      before.endsAt.getTime() !== after.endsAt.getTime() ||
      before.service !== after.service
    if (moved) {
      const stayed = people(after).filter((to) => !('servantId' in to) || had.has(to.servantId))
      for (const to of stayed) {
        send(to, {
          title: 'A reservation of yours changed',
          body: `${actor.name} changed it: the ${after.itemName} for ${reservationPurpose(after)}, ${formatReservationTime(after)}.`,
          href: page(after),
        })
      }
    }
  }
  if (wasOn && !isOn) {
    if (!after) {
      for (const to of people(before)) {
        send(to, {
          title: `${before.itemName} reservation cancelled`,
          body: `${actor.name} cancelled the ${before.itemName} for ${reservationPurpose(before)}: ${formatReservationTime(before)}.`,
          href: monthHref(before),
        })
      }
    } else if (after.status === 'PENDING') {
      for (const to of people(before)) {
        send(to, {
          title: 'A reservation of yours changed',
          body: `${actor.name} changed the ${after.itemName} for ${reservationPurpose(after)}, so it waits for approval again: ${formatReservationTime(after)}.`,
          href: page(after),
        })
      }
    } else if (after.status === 'REJECTED') {
      const asker = before.requester?.servantId ?? null
      const note = after.decisionNote?.trim()
      for (const servantId of before.servantIds) {
        if (servantId === asker) continue
        send(
          { servantId },
          {
            title: `${before.itemName} reservation not approved`,
            body: `${actor.name} did not approve the ${after.itemName} for ${reservationPurpose(after)}: ${formatReservationTime(after)}.${note ? ` “${note}”` : ''}`,
            href: page(after),
          },
        )
      }
    }
  }
  return notices
}
