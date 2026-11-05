import { describe, it, expect } from 'vitest'
import {
  BOOK_AHEAD_DAYS,
  MAX_RESERVATION_DAYS,
  colorOf,
  dayLabel,
  defaultService,
  formatBackAt,
  formatReservationTime,
  mayCancelReservation,
  mayDecideReservation,
  mayEditReservation,
  needsNewApproval,
  overlaps,
  readReservationTimes,
  reservationDays,
  reservationNotices,
  reservationPurpose,
  reservationStatusLabel,
  reservationsByDay,
  serviceGroups,
  serviceOptions,
  statusAfterSave,
  type ReservationNotice,
  type ReservationRecipient,
  type ReservationSnapshot,
  type ReservationStatus,
} from '@/lib/portal/reservations'
import type { StageKey } from '@/lib/portal/permissions'

/**
 * Van reservations (2026-11-02), from a servant's request: "Can we do something
 * for the Vans … To organize using them: Reserve Day, Servants, For how long,
 * Service: Middle, Elementary, High School, Men's Meeting, Women's Meeting,
 * Youth Meeting", and "a calendar on who using what".
 */

const at = (iso: string) => new Date(iso)
// Sunday, Nov 1 2026, noon in Antioch.
const NOW = at('2026-11-01T18:00:00.000Z')

describe('readReservationTimes', () => {
  it('reads a day with a from and an until on the church clock', () => {
    const r = readReservationTimes({ date: '2026-11-07', from: '09:00', until: '12:00' }, NOW)
    expect(r).toEqual({ ok: true, startsAt: at('2026-11-07T15:00:00.000Z'), endsAt: at('2026-11-07T18:00:00.000Z') })
  })

  it('reads a van that comes back on a later day', () => {
    const r = readReservationTimes({ date: '2026-11-06', from: '17:00', untilDate: '2026-11-08', until: '14:00' }, NOW)
    expect(r).toEqual({ ok: true, startsAt: at('2026-11-06T23:00:00.000Z'), endsAt: at('2026-11-08T20:00:00.000Z') })
  })

  it('treats a blank or same return day as the same day', () => {
    const same = readReservationTimes({ date: '2026-11-07', from: '09:00', untilDate: '2026-11-07', until: '12:00' }, NOW)
    const blank = readReservationTimes({ date: '2026-11-07', from: '09:00', untilDate: '', until: '12:00' }, NOW)
    expect(same).toEqual(blank)
    expect(same.ok).toBe(true)
  })

  it('refuses an until that is not after the from', () => {
    expect(readReservationTimes({ date: '2026-11-07', from: '12:00', until: '09:00' }, NOW)).toEqual({ ok: false, error: '“Until” has to be after “From”.' })
    expect(readReservationTimes({ date: '2026-11-07', from: '09:00', until: '09:00' }, NOW)).toEqual({ ok: false, error: '“Until” has to be after “From”.' })
  })

  it(`refuses more than ${MAX_RESERVATION_DAYS} days`, () => {
    const r = readReservationTimes({ date: '2026-11-07', from: '09:00', untilDate: '2026-11-22', until: '09:00' }, NOW)
    expect(r).toEqual({ ok: false, error: `A reservation can be ${MAX_RESERVATION_DAYS} days at most.` })
    expect(readReservationTimes({ date: '2026-11-07', from: '09:00', untilDate: '2026-11-21', until: '09:00' }, NOW).ok).toBe(true)
  })

  it('refuses a time that has already passed, but takes one under way', () => {
    expect(readReservationTimes({ date: '2026-11-01', from: '08:00', until: '11:00' }, NOW)).toEqual({ ok: false, error: 'That time has already passed.' })
    expect(readReservationTimes({ date: '2026-11-01', from: '11:00', until: '15:00' }, NOW).ok).toBe(true)
  })

  it(`refuses more than ${BOOK_AHEAD_DAYS} days ahead`, () => {
    expect(readReservationTimes({ date: '2027-11-03', from: '09:00', until: '12:00' }, NOW)).toEqual({ ok: false, error: 'You can reserve up to a year ahead.' })
    expect(readReservationTimes({ date: '2027-11-01', from: '09:00', until: '12:00' }, NOW).ok).toBe(true)
  })

  it('names the field it cannot read', () => {
    expect(readReservationTimes({ date: '', from: '09:00', until: '12:00' }, NOW)).toEqual({ ok: false, error: 'Pick the day.' })
    expect(readReservationTimes({ date: '2026-11-07', from: '', until: '12:00' }, NOW)).toEqual({ ok: false, error: 'Pick the time in “From”.' })
    expect(readReservationTimes({ date: '2026-11-07', from: '09:00', until: '25:00' }, NOW)).toEqual({ ok: false, error: 'Pick the time in “Until”.' })
    expect(readReservationTimes({ date: '2026-11-07', from: '09:00', untilDate: 'soon', until: '12:00' }, NOW)).toEqual({ ok: false, error: 'Pick the day it comes back.' })
  })
})

describe('overlaps', () => {
  const r = (from: string, to: string) => ({ startsAt: at(`2026-11-07T${from}:00.000Z`), endsAt: at(`2026-11-07T${to}:00.000Z`) })
  it('sees two times that share any part', () => {
    expect(overlaps(r('15:00', '18:00'), r('17:00', '19:00'))).toBe(true)
    expect(overlaps(r('15:00', '18:00'), r('16:00', '17:00'))).toBe(true)
    expect(overlaps(r('16:00', '17:00'), r('15:00', '18:00'))).toBe(true)
  })
  it('lets one start when the other comes back', () => {
    expect(overlaps(r('15:00', '18:00'), r('18:00', '20:00'))).toBe(false)
    expect(overlaps(r('18:00', '20:00'), r('15:00', '18:00'))).toBe(false)
  })
})

describe('formatReservationTime', () => {
  it('writes one day once', () => {
    expect(formatReservationTime({ startsAt: at('2026-11-07T15:00:00.000Z'), endsAt: at('2026-11-07T18:00:00.000Z') })).toBe('Sat, Nov 7 · 9:00 AM – 12:00 PM')
  })
  it('writes both days when it comes back later', () => {
    expect(formatReservationTime({ startsAt: at('2026-11-06T23:00:00.000Z'), endsAt: at('2026-11-08T20:00:00.000Z') })).toBe('Fri, Nov 6, 5:00 PM – Sun, Nov 8, 2:00 PM')
  })
})

describe('reservationDays', () => {
  it('is the one day of a same-day reservation', () => {
    expect(reservationDays({ startsAt: at('2026-11-07T15:00:00.000Z'), endsAt: at('2026-11-07T18:00:00.000Z') })).toEqual(['2026-11-07'])
  })
  it('is every day it is out', () => {
    expect(reservationDays({ startsAt: at('2026-11-06T23:00:00.000Z'), endsAt: at('2026-11-08T20:00:00.000Z') })).toEqual(['2026-11-06', '2026-11-07', '2026-11-08'])
  })
  it('leaves out the next day when it is back at midnight', () => {
    expect(reservationDays({ startsAt: at('2026-11-07T23:00:00.000Z'), endsAt: at('2026-11-08T06:00:00.000Z') })).toEqual(['2026-11-07'])
  })
  it('counts a late evening on its own church day', () => {
    // 9:30 PM to 11:30 PM on Saturday, which is already Sunday in UTC.
    expect(reservationDays({ startsAt: at('2026-11-08T03:30:00.000Z'), endsAt: at('2026-11-08T05:30:00.000Z') })).toEqual(['2026-11-07'])
  })
})

describe('reservationsByDay', () => {
  it('files each reservation under every day it covers, within the span', () => {
    const a = { id: 'a', startsAt: at('2026-10-30T23:00:00.000Z'), endsAt: at('2026-11-02T18:00:00.000Z') }
    const b = { id: 'b', startsAt: at('2026-11-07T15:00:00.000Z'), endsAt: at('2026-11-07T18:00:00.000Z') }
    const c = { id: 'c', startsAt: at('2026-12-05T15:00:00.000Z'), endsAt: at('2026-12-05T18:00:00.000Z') }
    const days = reservationsByDay([b, a, c], '2026-11-01', '2026-11-30')
    expect(Array.from(days.keys()).sort()).toEqual(['2026-11-01', '2026-11-02', '2026-11-07'])
    expect(days.get('2026-11-01')!.map((r) => r.id)).toEqual(['a'])
    expect(days.get('2026-11-07')!.map((r) => r.id)).toEqual(['b'])
  })
  it('keeps each day in time order', () => {
    const late = { id: 'late', startsAt: at('2026-11-07T20:00:00.000Z'), endsAt: at('2026-11-07T22:00:00.000Z') }
    const early = { id: 'early', startsAt: at('2026-11-07T14:00:00.000Z'), endsAt: at('2026-11-07T16:00:00.000Z') }
    expect(reservationsByDay([late, early], '2026-11-01', '2026-11-30').get('2026-11-07')!.map((r) => r.id)).toEqual(['early', 'late'])
  })
})

// 2026-11-04, the user: "for the service it should pick from the classes list", then "classes, stages and fellowships".
describe('serviceGroups', () => {
  const classes: Array<{ stage: StageKey; name: string }> = [
    { stage: 'ELEMENTARY', name: 'KG' },
    { stage: 'ELEMENTARY', name: '1st Grade' },
    { stage: 'MIDDLE_SCHOOL', name: '5th & 6th Boys' },
    { stage: 'FELLOWSHIP', name: 'Men’s Meeting' },
    { stage: 'HIGH_SCHOOL', name: 'High School' },
    { stage: 'FELLOWSHIP', name: 'Youth Meeting' },
  ]
  it('is each stage as a whole, then its classes in the classes list’s order, then the Fellowship meetings', () => {
    expect(serviceGroups(classes)).toEqual([
      {
        label: 'Elementary',
        options: [
          { value: 'Elementary', text: 'Elementary (all classes)' },
          { value: 'KG', text: 'KG' },
          { value: '1st Grade', text: '1st Grade' },
        ],
      },
      {
        label: 'Middle School',
        options: [
          { value: 'Middle School', text: 'Middle School (all classes)' },
          { value: '5th & 6th Boys', text: '5th & 6th Boys' },
        ],
      },
      // A class named like its stage is the stage.
      { label: 'High School', options: [{ value: 'High School', text: 'High School (all classes)' }] },
      {
        label: 'Fellowship meetings',
        options: [
          { value: 'Men’s Meeting', text: 'Men’s Meeting' },
          { value: 'Youth Meeting', text: 'Youth Meeting' },
        ],
      },
    ])
  })
  it('offers every stage though it has no classes yet, and no Fellowship group without meetings', () => {
    expect(serviceGroups([]).map((g) => [g.label, g.options.map((o) => o.value)])).toEqual([
      ['Elementary', ['Elementary']],
      ['Middle School', ['Middle School']],
      ['High School', ['High School']],
    ])
  })
  it('never offers a class named Other twice', () => {
    expect(serviceOptions([{ stage: 'ELEMENTARY', name: 'Other' }])).toEqual(['Elementary', 'Middle School', 'High School', 'Other'])
  })
})

describe('serviceOptions', () => {
  it('is everything the groups offer, then Other', () => {
    expect(
      serviceOptions([
        { stage: 'MIDDLE_SCHOOL', name: '5th & 6th Boys' },
        { stage: 'FELLOWSHIP', name: 'Youth Meeting' },
      ]),
    ).toEqual(['Elementary', 'Middle School', '5th & 6th Boys', 'High School', 'Youth Meeting', 'Other'])
  })
})

describe('defaultService', () => {
  it('is the one class someone serves', () => {
    expect(defaultService([{ stage: 'MIDDLE_SCHOOL', name: '5th & 6th Boys' }], null)).toBe('5th & 6th Boys')
  })
  it('is the stage of the classes someone serves, when they serve several in it', () => {
    expect(defaultService([{ stage: 'MIDDLE_SCHOOL', name: '5th & 6th Boys' }, { stage: 'MIDDLE_SCHOOL', name: '7th & 8th Boys' }], null)).toBe('Middle School')
  })
  it('is the meeting of someone who serves one', () => {
    expect(defaultService([{ stage: 'FELLOWSHIP', name: 'Youth Meeting' }], null)).toBe('Youth Meeting')
  })
  it('is the stage someone oversees', () => {
    expect(defaultService([], 'HIGH_SCHOOL')).toBe('High School')
  })
  it('is left to them when they serve more than one', () => {
    expect(defaultService([{ stage: 'ELEMENTARY', name: 'KG' }, { stage: 'FELLOWSHIP', name: 'Youth Meeting' }], null)).toBe('')
    expect(defaultService([], null)).toBe('')
  })
})

describe('reservationPurpose', () => {
  it('is the service; the reason is shown on its own', () => {
    expect(reservationPurpose({ service: 'Youth Meeting', reason: 'Taking the youth to the park' })).toBe('Youth Meeting')
  })
  it('is the reason when the service is Other, cut short past 60 letters', () => {
    expect(reservationPurpose({ service: 'Other', reason: '  Airport\n  pickup ' })).toBe('Airport pickup')
    expect(reservationPurpose({ service: 'Other', reason: 'a'.repeat(70) })).toBe(`${'a'.repeat(59)}…`)
  })
  it('is Other for an Other made before the reason was needed', () => {
    expect(reservationPurpose({ service: 'Other', reason: null })).toBe('Other')
  })
})

describe('colorOf', () => {
  it('knows black and white, and falls back to blue', () => {
    expect(colorOf('black').bg).toBe('#1F2937')
    expect(colorOf('white').bg).toBe('#FFFFFF')
    expect(colorOf('nope')).toEqual(colorOf('blue'))
  })
})

describe('who may change a reservation', () => {
  const r = { createdById: 'acc-booker', servantIds: ['sv-driver'], endsAt: at('2026-11-07T18:00:00.000Z') }
  const servant = (accountId: string, servantId: string) => ({ role: 'SERVANT' as const, accountId, servantId })
  it('is the one who made it, the servants on it, and the admin', () => {
    expect(mayEditReservation(servant('acc-booker', 'sv-booker'), r, NOW)).toBe(true)
    expect(mayEditReservation(servant('acc-driver', 'sv-driver'), r, NOW)).toBe(true)
    expect(mayEditReservation({ role: 'ADMIN', accountId: 'acc-admin' }, r, NOW)).toBe(true)
    expect(mayEditReservation(servant('acc-other', 'sv-other'), r, NOW)).toBe(false)
    expect(mayEditReservation({ role: 'PASTOR', accountId: 'acc-pastor' }, r, NOW)).toBe(false)
  })
  it('is nobody once it is over, though the admin may still take it off', () => {
    const later = at('2026-11-08T00:00:00.000Z')
    expect(mayEditReservation(servant('acc-booker', 'sv-booker'), r, later)).toBe(false)
    expect(mayEditReservation({ role: 'ADMIN', accountId: 'acc-admin' }, r, later)).toBe(false)
    expect(mayCancelReservation(servant('acc-booker', 'sv-booker'), r, later)).toBe(false)
    expect(mayCancelReservation({ role: 'ADMIN', accountId: 'acc-admin' }, r, later)).toBe(true)
  })
  it('lets the same people cancel it before then', () => {
    expect(mayCancelReservation(servant('acc-driver', 'sv-driver'), r, NOW)).toBe(true)
    expect(mayCancelReservation(servant('acc-other', 'sv-other'), r, NOW)).toBe(false)
  })
})

describe('who may approve a van request', () => {
  const servant = (servantId: string) => ({ role: 'SERVANT', accountId: `acc-${servantId}`, servantId })
  it('is a servant the admin named, and the admin', () => {
    expect(mayDecideReservation(servant('sv-ap'), ['sv-ap'])).toBe(true)
    expect(mayDecideReservation(servant('sv-me'), ['sv-ap'])).toBe(false)
    expect(mayDecideReservation({ role: 'ADMIN' }, ['sv-ap'])).toBe(true)
    expect(mayDecideReservation({ role: 'PASTOR' }, ['sv-ap'])).toBe(false)
  })
  it('is the admin alone while nobody is named', () => {
    expect(mayDecideReservation(servant('sv-ap'), [])).toBe(false)
    expect(mayDecideReservation({ role: 'ADMIN' }, [])).toBe(true)
  })
})

describe('needsNewApproval', () => {
  const r = { itemId: 'black-van', startsAt: at('2026-11-07T15:00:00.000Z'), endsAt: at('2026-11-07T18:00:00.000Z'), service: 'Youth Meeting', reason: 'Taking the youth to the park' }
  it('is another van, time, service or reason', () => {
    expect(needsNewApproval(r, { ...r, itemId: 'white-van' })).toBe(true)
    expect(needsNewApproval(r, { ...r, endsAt: at('2026-11-07T19:00:00.000Z') })).toBe(true)
    expect(needsNewApproval(r, { ...r, service: 'High School' })).toBe(true)
    expect(needsNewApproval(r, { ...r, reason: 'Taking the youth to the lake' })).toBe(true)
  })
  it('is not the same reservation saved again, or spaces around the reason', () => {
    expect(needsNewApproval(r, { ...r })).toBe(false)
    expect(needsNewApproval(r, { ...r, reason: '  Taking the youth to the park ' })).toBe(false)
  })
})

describe('statusAfterSave', () => {
  const servant = { accountId: 'acc-me', decides: false }
  const approver = { accountId: 'acc-ap', decides: true }
  const mine = (status: ReservationStatus) => ({ status, createdById: 'acc-me' })
  it('waits for approval when someone who cannot approve asks; one who can gets it at once', () => {
    expect(statusAfterSave(null, false, servant)).toEqual({ status: 'PENDING', stamp: 'clear' })
    expect(statusAfterSave(null, false, approver)).toEqual({ status: 'APPROVED', stamp: 'now' })
  })
  it('keeps an approved one approved when only its servants change, and asks again when more does', () => {
    expect(statusAfterSave(mine('APPROVED'), false, servant)).toEqual({ status: 'APPROVED', stamp: 'keep' })
    expect(statusAfterSave(mine('APPROVED'), true, servant)).toEqual({ status: 'PENDING', stamp: 'clear' })
  })
  it('asks again when a waiting or rejected one is saved by one who cannot approve', () => {
    expect(statusAfterSave(mine('PENDING'), false, servant)).toEqual({ status: 'PENDING', stamp: 'clear' })
    expect(statusAfterSave(mine('REJECTED'), false, servant)).toEqual({ status: 'PENDING', stamp: 'clear' })
  })
  it('lets an approver’s change to an approved one stand, approved by them when it needed approval', () => {
    expect(statusAfterSave(mine('APPROVED'), true, approver)).toEqual({ status: 'APPROVED', stamp: 'now' })
    expect(statusAfterSave(mine('APPROVED'), false, approver)).toEqual({ status: 'APPROVED', stamp: 'keep' })
  })
  it('approves an approver’s own waiting request when they save it, but leaves someone else’s to the buttons', () => {
    expect(statusAfterSave({ status: 'PENDING', createdById: 'acc-ap' }, false, approver)).toEqual({ status: 'APPROVED', stamp: 'now' })
    expect(statusAfterSave(mine('PENDING'), true, approver)).toEqual({ status: 'PENDING', stamp: 'keep' })
    expect(statusAfterSave(mine('REJECTED'), true, approver)).toEqual({ status: 'REJECTED', stamp: 'keep' })
  })
})

describe('reservationStatusLabel', () => {
  const soon = at('2026-11-07T18:00:00.000Z')
  it('names where it stands', () => {
    expect(reservationStatusLabel('PENDING', soon, NOW)).toBe('Waiting for approval')
    expect(reservationStatusLabel('APPROVED', soon, NOW)).toBe('Approved')
    expect(reservationStatusLabel('REJECTED', soon, NOW)).toBe('Not approved')
  })
  it('says a request was not answered once its time has passed', () => {
    expect(reservationStatusLabel('PENDING', at('2026-10-31T18:00:00.000Z'), NOW)).toBe('Not answered')
  })
})

describe('reservationNotices', () => {
  const approved: ReservationSnapshot = {
    id: 'res-1',
    itemName: 'Black Van',
    startsAt: at('2026-11-07T15:00:00.000Z'),
    endsAt: at('2026-11-07T18:00:00.000Z'),
    service: 'Youth Meeting',
    reason: 'Taking the youth to the park',
    status: 'APPROVED',
    servantIds: ['sv-me', 'sv-a', 'sv-b'],
    servantNames: ['Mina S', 'Pat E', 'Sara M'],
    requester: { accountId: 'acc-me', servantId: 'sv-me', name: 'Pat E' },
    decidedById: 'acc-ap',
    decidedByName: 'Abe A',
    decidedAt: at('2026-11-04T21:15:00.000Z'),
    decisionNote: null,
  }
  const waiting: ReservationSnapshot = { ...approved, status: 'PENDING', decidedById: null, decidedByName: null, decidedAt: null }
  const me = { accountId: 'acc-me', servantId: 'sv-me', name: 'Pat E' }
  const approver = { accountId: 'acc-ap', servantId: 'sv-ap', name: 'Abe A' }
  const admin = { accountId: 'acc-admin', servantId: null, name: 'Admin' }
  const told = (actor: { accountId: string; servantId: string | null; name: string }, over: { approvers?: ReservationRecipient[]; now?: Date } = {}) => ({
    actor,
    approvers: over.approvers ?? [{ servantId: 'sv-ap' }],
    now: over.now ?? NOW,
  })
  const who = (notices: ReservationNotice[]) => notices.map((n) => ['servantId' in n.to ? n.to.servantId : n.to.accountId, n.title])
  const DETAILS = [
    'Van: Black Van',
    'When: Sat, Nov 7 · 9:00 AM – 12:00 PM',
    'For: Youth Meeting',
    'Reason: Taking the youth to the park',
    'Servants: Mina S, Pat E and Sara M',
    'Requested by: Pat E',
  ]
  const moved = { startsAt: at('2026-11-07T16:00:00.000Z'), endsAt: at('2026-11-07T19:00:00.000Z') }

  // 2026-11-04, the user: "make sure he gets notifications on this and emails of the details".
  it('sends a new request to the approvers, on the phone and by email, with every detail, and tells nobody else yet', () => {
    expect(reservationNotices(null, waiting, told(me))).toEqual([
      {
        to: { servantId: 'sv-ap' },
        title: 'Black Van request from Pat E',
        body: 'Pat E asks for the Black Van, Sat, Nov 7 · 9:00 AM – 12:00 PM, for Youth Meeting: Taking the youth to the park.',
        href: '/portal/reservations/res-1',
        details: DETAILS,
        email: 'always',
      },
    ])
  })

  it('sends it to the admin while no approver is named', () => {
    expect(who(reservationNotices(null, waiting, told(me, { approvers: [{ accountId: 'acc-admin' }] })))).toEqual([['acc-admin', 'Black Van request from Pat E']])
  })

  it('tells the approvers again when a waiting request changes, but not when it is saved unchanged', () => {
    const notices = reservationNotices(waiting, { ...waiting, ...moved }, told(me))
    expect(who(notices)).toEqual([['sv-ap', 'Black Van request changed by Pat E']])
    expect(notices[0]!.body).toBe('Pat E changed the request for the Black Van: Sat, Nov 7 · 10:00 AM – 1:00 PM, for Youth Meeting: Taking the youth to the park.')
    expect(reservationNotices(waiting, { ...waiting }, told(me))).toEqual([])
  })

  // "the person who requests gets the notification and email back of the results".
  it('tells the one who asked when it is approved, on the phone and by email, and the servants on it that the van is theirs', () => {
    const notices = reservationNotices(waiting, approved, told(approver))
    expect(who(notices)).toEqual([
      ['acc-me', 'Black Van request approved'],
      ['sv-a', 'Black Van reserved for you'],
      ['sv-b', 'Black Van reserved for you'],
    ])
    expect(notices[0]).toMatchObject({
      body: 'Abe A approved your request for the Black Van: Sat, Nov 7 · 9:00 AM – 12:00 PM, Youth Meeting.',
      href: '/portal/reservations/res-1',
      email: 'always',
      details: [...DETAILS, 'Approved by: Abe A, Nov 4, 3:15 PM'],
    })
    expect(notices[1]!.body).toBe('Pat E put you on the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM. Approved by Abe A.')
    expect(notices[1]).not.toHaveProperty('email')
  })

  it('tells the one who asked when it is rejected, with the approver’s words, and nobody else', () => {
    const rejected: ReservationSnapshot = { ...waiting, status: 'REJECTED', decidedById: 'acc-ap', decidedByName: 'Abe A', decidedAt: at('2026-11-04T21:15:00.000Z'), decisionNote: 'The van is in the shop that week' }
    const notices = reservationNotices(waiting, rejected, told(approver))
    expect(who(notices)).toEqual([['acc-me', 'Black Van request not approved']])
    expect(notices[0]).toMatchObject({
      body: 'Abe A did not approve your request for the Black Van: Sat, Nov 7 · 9:00 AM – 12:00 PM, Youth Meeting. “The van is in the shop that week”',
      email: 'always',
      details: [...DETAILS, 'Rejected by: Abe A', 'Why: The van is in the shop that week'],
    })
  })

  it('when an approved one is rejected after all, tells the one who asked and the servants who had the van', () => {
    const rejected: ReservationSnapshot = { ...approved, status: 'REJECTED', decisionNote: 'The van is in the shop' }
    const notices = reservationNotices(approved, rejected, told(approver))
    expect(who(notices)).toEqual([
      ['acc-me', 'Black Van request not approved'],
      ['sv-a', 'Black Van reservation not approved'],
      ['sv-b', 'Black Van reservation not approved'],
    ])
    expect(notices[1]!.body).toBe('Abe A did not approve the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM. “The van is in the shop”')
  })

  it('approves an approver’s own request at once, and tells only the servants on it', () => {
    const own = { ...approved, requester: { accountId: 'acc-ap', servantId: 'sv-ap', name: 'Abe A' } }
    const notices = reservationNotices(null, own, told(approver))
    expect(who(notices)).toEqual([
      ['sv-me', 'Black Van reserved for you'],
      ['sv-a', 'Black Van reserved for you'],
      ['sv-b', 'Black Van reserved for you'],
    ])
    expect(notices[0]!.body).toBe('Abe A put you on the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
  })

  it('says what it is for when the service is Other', () => {
    const own = { ...approved, service: 'Other', reason: 'Airport pickup', requester: { accountId: 'acc-ap', servantId: 'sv-ap', name: 'Abe A' } }
    expect(reservationNotices(null, own, told(approver))[0]!.body).toBe('Abe A put you on the Black Van for Airport pickup: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
  })

  it('sends an approved one back to the approvers when its time changes, and tells the servants on it', () => {
    const notices = reservationNotices(approved, { ...waiting, ...moved }, told(me))
    expect(who(notices)).toEqual([
      ['sv-ap', 'Black Van request changed by Pat E'],
      ['sv-a', 'A reservation of yours changed'],
      ['sv-b', 'A reservation of yours changed'],
    ])
    expect(notices[1]!.body).toBe('Pat E changed the Black Van for Youth Meeting, so it waits for approval again: Sat, Nov 7 · 10:00 AM – 1:00 PM.')
  })

  it('while it stays approved, tells who was added, who was taken off, and who stayed when the time moved', () => {
    const after = { ...approved, ...moved, servantIds: ['sv-me', 'sv-a', 'sv-c'] }
    const notices = reservationNotices(approved, after, told(approver))
    expect(who(notices)).toEqual([
      ['sv-c', 'Black Van reserved for you'],
      ['sv-b', 'Taken off the Black Van'],
      ['sv-me', 'A reservation of yours changed'],
      ['sv-a', 'A reservation of yours changed'],
    ])
    expect(notices[0]!.body).toBe('Abe A put you on the Black Van for Youth Meeting: Sat, Nov 7 · 10:00 AM – 1:00 PM.')
    expect(notices[1]!.body).toBe('Abe A took you off the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
    expect(notices[1]!.href).toBe('/portal/reservations?month=2026-11')
    expect(notices[2]!.body).toBe('Abe A changed it: the Black Van for Youth Meeting, Sat, Nov 7 · 10:00 AM – 1:00 PM.')
  })

  it('tells the one who asked, when they are not on it, that someone else moved it', () => {
    const forPastor = { ...approved, servantIds: ['sv-a'], servantNames: ['Mina S'], requester: { accountId: 'acc-pastor', servantId: null, name: 'Abouna' } }
    expect(who(reservationNotices(forPastor, { ...forPastor, ...moved }, told(approver)))).toEqual([
      ['sv-a', 'A reservation of yours changed'],
      ['acc-pastor', 'A reservation of yours changed'],
    ])
  })

  it('tells nobody who stayed when only the reason changed', () => {
    expect(reservationNotices(approved, { ...approved, reason: 'Taking the youth to the lake' }, told(approver))).toEqual([])
  })

  it('tells the others when an approved one is cancelled', () => {
    const notices = reservationNotices(approved, null, told(admin))
    expect(who(notices)).toEqual([
      ['sv-me', 'Black Van reservation cancelled'],
      ['sv-a', 'Black Van reservation cancelled'],
      ['sv-b', 'Black Van reservation cancelled'],
    ])
    expect(notices[0]!.body).toBe('Admin cancelled the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
  })

  it('tells the approvers when a waiting request is withdrawn, and not the servants, who never heard of it', () => {
    const notices = reservationNotices(waiting, null, told(me))
    expect(who(notices)).toEqual([['sv-ap', 'Black Van request withdrawn']])
    expect(notices[0]!.body).toBe('Pat E withdrew the request for the Black Van: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
    expect(notices[0]).not.toHaveProperty('email')
  })

  it('never tells the one who did it', () => {
    expect(reservationNotices(null, waiting, told(admin, { approvers: [{ accountId: 'acc-admin' }] }))).toEqual([])
  })

  it('tells nobody about a reservation that is over', () => {
    const later = at('2026-11-08T00:00:00.000Z')
    expect(reservationNotices(approved, null, told(me, { now: later }))).toEqual([])
    expect(reservationNotices(null, waiting, told(me, { now: later }))).toEqual([])
    expect(reservationNotices(waiting, approved, told(approver, { now: later }))).toEqual([])
  })
})

describe('dayLabel', () => {
  const trip = { startsAt: at('2026-11-06T23:00:00.000Z'), endsAt: at('2026-11-09T20:30:00.000Z') }
  it('gives a one-day reservation its hours, dropping :00', () => {
    expect(dayLabel({ startsAt: at('2026-11-07T15:00:00.000Z'), endsAt: at('2026-11-07T18:30:00.000Z') }, '2026-11-07')).toBe('9 AM–12:30 PM')
  })
  it('says when a longer one leaves, that it is out all day, and when it is back', () => {
    expect(dayLabel(trip, '2026-11-06')).toBe('from 5 PM')
    expect(dayLabel(trip, '2026-11-07')).toBe('all day')
    expect(dayLabel(trip, '2026-11-09')).toBe('until 2:30 PM')
  })
})

describe('formatBackAt', () => {
  it('is just the time when it is back today', () => {
    expect(formatBackAt(at('2026-11-07T18:00:00.000Z'), '2026-11-07')).toBe('12:00 PM')
  })
  it('names the day when it is back on another', () => {
    expect(formatBackAt(at('2026-11-08T20:00:00.000Z'), '2026-11-07')).toBe('Sun, Nov 8, 2:00 PM')
  })
})
