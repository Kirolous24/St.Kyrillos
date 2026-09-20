import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  todayInNewYork,
  mondayOf,
  addDays,
  ageOn,
  daysUntilBirthday,
  formatDateOnly,
  newYorkDayStart,
} from '@/lib/portal/dates'

describe('parseDateOnly', () => {
  it('accepts ISO YYYY-MM-DD', () => {
    expect(parseDateOnly('2016-07-06')).toBe('2016-07-06')
  })
  it('accepts M/D/YYYY and pads', () => {
    expect(parseDateOnly('7/12/1994')).toBe('1994-07-12')
    expect(parseDateOnly('12/1/2001')).toBe('2001-12-01')
  })
  it('rejects impossible dates', () => {
    expect(parseDateOnly('2018-17-05')).toBeNull()
    expect(parseDateOnly('2019-02-30')).toBeNull()
    expect(parseDateOnly('13/40/2010')).toBeNull()
  })
  it('rejects garbage and empty', () => {
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly('n/a')).toBeNull()
    expect(parseDateOnly(undefined)).toBeNull()
    expect(parseDateOnly('2016-07-06T00:00:00Z')).toBe('2016-07-06')
  })
})

describe('todayInNewYork', () => {
  it('uses the Eastern calendar day, not UTC', () => {
    // 2026-09-20 02:30 UTC is still Saturday 2026-09-19 22:30 in New York (EDT)
    expect(todayInNewYork(new Date('2026-09-20T02:30:00Z'))).toBe('2026-09-19')
    // 2026-01-10 04:30 UTC is 2026-01-09 23:30 EST
    expect(todayInNewYork(new Date('2026-01-10T04:30:00Z'))).toBe('2026-01-09')
    expect(todayInNewYork(new Date('2026-01-10T05:30:00Z'))).toBe('2026-01-10')
  })
})

describe('mondayOf', () => {
  it('returns the Monday of the week containing the date', () => {
    expect(mondayOf('2026-09-20')).toBe('2026-09-14') // Sunday -> previous Monday
    expect(mondayOf('2026-09-14')).toBe('2026-09-14') // Monday
    expect(mondayOf('2026-09-19')).toBe('2026-09-14') // Saturday
  })
})

describe('addDays / formatDateOnly', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('formats a Date to YYYY-MM-DD in UTC', () => {
    expect(formatDateOnly(new Date('2026-07-06T00:00:00Z'))).toBe('2026-07-06')
  })
})

describe('ageOn', () => {
  it('computes whole years, respecting the birthday not yet reached', () => {
    expect(ageOn('2016-07-06', '2026-07-05')).toBe(9)
    expect(ageOn('2016-07-06', '2026-07-06')).toBe(10)
  })
})

describe('daysUntilBirthday', () => {
  it('is 0 on the birthday', () => {
    expect(daysUntilBirthday('2016-07-06', '2026-07-06')).toBe(0)
  })
  it('counts forward within the year', () => {
    expect(daysUntilBirthday('2016-07-10', '2026-07-06')).toBe(4)
  })
  it('wraps to next year when the birthday has passed', () => {
    expect(daysUntilBirthday('2016-07-01', '2026-07-06')).toBe(360)
  })
  it('treats Feb 29 as Feb 28 in non-leap years', () => {
    expect(daysUntilBirthday('2016-02-29', '2026-02-28')).toBe(0)
  })
})

describe('newYorkDayStart', () => {
  it('is the church own midnight, not UTC midnight', () => {
    // Report windows are picked in church time; PointEntry.createdAt and
    // QuizResult.submittedAt are instants, so an evening Vespers row must not
    // fall into the neighbouring month.
    expect(newYorkDayStart('2026-09-01').toISOString()).toBe('2026-09-01T04:00:00.000Z') // EDT
    expect(newYorkDayStart('2026-01-01').toISOString()).toBe('2026-01-01T05:00:00.000Z') // EST
  })
  it('follows the daylight-saving changeover', () => {
    expect(newYorkDayStart('2026-03-08').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(newYorkDayStart('2026-03-09').toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(newYorkDayStart('2026-11-01').toISOString()).toBe('2026-11-01T04:00:00.000Z')
    expect(newYorkDayStart('2026-11-02').toISOString()).toBe('2026-11-02T05:00:00.000Z')
  })
  it('keeps an evening record inside the month it happened in', () => {
    const sepEnd = newYorkDayStart('2026-10-01')
    const vespers = new Date('2026-10-01T00:30:00.000Z') // 20:30 on 30 Sep in New York
    expect(vespers.getTime() < sepEnd.getTime()).toBe(true)
  })
})
