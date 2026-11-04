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
  mayEditReservation,
  overlaps,
  readReservationTimes,
  reservationDays,
  reservationNotices,
  reservationsByDay,
  serviceOptions,
  type ReservationSnapshot,
} from '@/lib/portal/reservations'

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

describe('serviceOptions', () => {
  it('is the three Sunday School stages, each meeting, then Other', () => {
    expect(serviceOptions(['Men’s Meeting', 'Women’s Meeting', 'Youth Meeting'])).toEqual([
      'Elementary', 'Middle School', 'High School', 'Men’s Meeting', 'Women’s Meeting', 'Youth Meeting', 'Other',
    ])
  })
})

describe('defaultService', () => {
  it('is the stage of the classes someone serves', () => {
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

describe('reservationNotices', () => {
  const base: ReservationSnapshot = {
    id: 'res-1',
    itemName: 'Black Van',
    startsAt: at('2026-11-07T15:00:00.000Z'),
    endsAt: at('2026-11-07T18:00:00.000Z'),
    service: 'Youth Meeting',
    note: null,
    servantIds: ['sv-me', 'sv-a', 'sv-b'],
  }
  const me = { servantId: 'sv-me', name: 'Pat' }

  it('tells the servants someone else put on it, not the one who did', () => {
    const notices = reservationNotices(null, base, me, NOW)
    expect(notices.map((n) => n.servantId)).toEqual(['sv-a', 'sv-b'])
    expect(notices[0]).toEqual({
      servantId: 'sv-a',
      title: 'Black Van reserved for you',
      body: 'Pat put you on the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM.',
      href: '/portal/reservations/res-1',
    })
  })

  it('says what it is for when the service is Other', () => {
    const notices = reservationNotices(null, { ...base, service: 'Other', note: 'Airport pickup' }, me, NOW)
    expect(notices[0]!.body).toBe('Pat put you on the Black Van for Airport pickup: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
  })

  it('tells who was added, who was taken off, and who stayed when the time moved', () => {
    const after = { ...base, startsAt: at('2026-11-07T16:00:00.000Z'), endsAt: at('2026-11-07T19:00:00.000Z'), servantIds: ['sv-me', 'sv-a', 'sv-c'] }
    const notices = reservationNotices(base, after, me, NOW)
    expect(notices.map((n) => [n.servantId, n.title])).toEqual([
      ['sv-c', 'Black Van reserved for you'],
      ['sv-b', 'Taken off the Black Van'],
      ['sv-a', 'A reservation of yours changed'],
    ])
    expect(notices[1]!.body).toBe('Pat took you off the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
    expect(notices[1]!.href).toBe('/portal/reservations?month=2026-11')
    expect(notices[2]!.body).toBe('Pat changed it: the Black Van for Youth Meeting, Sat, Nov 7 · 10:00 AM – 1:00 PM.')
  })

  it('tells nobody who stayed when only the note changed', () => {
    expect(reservationNotices(base, { ...base, note: 'Bring the cooler' }, me, NOW)).toEqual([])
  })

  it('tells the others when it is cancelled', () => {
    const notices = reservationNotices(base, null, { servantId: null, name: 'Admin' }, NOW)
    expect(notices.map((n) => n.servantId)).toEqual(['sv-me', 'sv-a', 'sv-b'])
    expect(notices[0]!.title).toBe('Black Van reservation cancelled')
    expect(notices[0]!.body).toBe('Admin cancelled the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM.')
  })

  it('tells nobody about a reservation that is over', () => {
    const later = at('2026-11-08T00:00:00.000Z')
    expect(reservationNotices(base, null, me, later)).toEqual([])
    expect(reservationNotices(null, base, me, later)).toEqual([])
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
