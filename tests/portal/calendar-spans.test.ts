import { describe, it, expect } from 'vitest'
import {
  calendarSpan,
  monthGrid,
  monthLabel,
  monthSundays,
  shiftMonth,
  shiftTerm,
  sundaysBetween,
  termByKey,
  termOf,
} from '@/lib/portal/calendar-spans'

/** The months and semesters the calendars and the rotation work in (2026-11-01). */

describe('semesters', () => {
  it('Fall is September to December, Spring January to May, Summer June to August', () => {
    expect(termOf('2026-11-01')).toEqual({ key: '2026-fall', label: 'Fall 2026', start: '2026-09-01', end: '2026-12-31' })
    expect(termOf('2027-02-14')).toEqual({ key: '2027-spring', label: 'Spring 2027', start: '2027-01-01', end: '2027-05-31' })
    expect(termOf('2027-06-06')).toEqual({ key: '2027-summer', label: 'Summer 2027', start: '2027-06-01', end: '2027-08-31' })
  })

  it('steps from one semester to the next and back', () => {
    expect(shiftTerm('2026-fall', 1).key).toBe('2027-spring')
    expect(shiftTerm('2027-spring', 1).key).toBe('2027-summer')
    expect(shiftTerm('2027-summer', 1).key).toBe('2027-fall')
    expect(shiftTerm('2027-spring', -1).key).toBe('2026-fall')
    expect(shiftTerm('2026-fall', -1).key).toBe('2026-summer')
  })

  it('reads a semester from the address, and nothing else', () => {
    expect(termByKey('2027-spring')?.label).toBe('Spring 2027')
    expect(termByKey('2027-winter')).toBeNull()
    expect(termByKey('fall')).toBeNull()
  })
})

describe('months and Sundays', () => {
  it('names and steps months', () => {
    expect(monthLabel('2026-11')).toBe('November 2026')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('lists the Sundays whose own date is in the month', () => {
    expect(monthSundays('2026-11')).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'])
    expect(monthSundays('2026-12')).toEqual(['2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27'])
  })

  it('lists every Sunday between two days, both included', () => {
    expect(sundaysBetween('2026-09-01', '2026-12-31')).toHaveLength(17)
    expect(sundaysBetween('2026-11-01', '2026-11-08')).toEqual(['2026-11-01', '2026-11-08'])
    expect(sundaysBetween('2026-11-09', '2026-11-14')).toEqual([])
  })

  it('lays a month out as weeks from Sunday to Saturday', () => {
    const nov = monthGrid('2026-11')
    expect(nov).toHaveLength(5)
    expect(nov[0]![0]).toBe('2026-11-01')
    expect(nov[4]).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null])
    const dec = monthGrid('2026-12')
    expect(dec[0]).toEqual([null, null, '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'])
    expect(dec.every((row) => row.length === 7)).toBe(true)
  })
})

describe('calendarSpan — what the page shows, from its address', () => {
  it('shows this month unless asked otherwise', () => {
    const s = calendarSpan({}, '2026-11-01')
    expect(s).toMatchObject({ kind: 'month', key: '2026-11', label: 'November 2026', start: '2026-11-01', end: '2026-11-30', prev: '2026-10', next: '2026-12' })
  })

  it('shows a semester when asked', () => {
    const s = calendarSpan({ span: 'semester' }, '2026-11-01')
    expect(s).toMatchObject({ kind: 'semester', key: '2026-fall', label: 'Fall 2026', start: '2026-09-01', end: '2026-12-31', prev: '2026-summer', next: '2027-spring' })
    expect(calendarSpan({ span: 'semester', term: '2027-spring' }, '2026-11-01').label).toBe('Spring 2027')
  })

  it('falls back to today when the address is not a month or semester', () => {
    expect(calendarSpan({ month: '2026-13' }, '2026-11-01').key).toBe('2026-11')
    expect(calendarSpan({ month: 'nope' }, '2026-11-01').key).toBe('2026-11')
    expect(calendarSpan({ span: 'semester', term: 'nope' }, '2026-11-01').key).toBe('2026-fall')
    expect(calendarSpan({ month: '2027-03' }, '2026-11-01').label).toBe('March 2027')
  })
})
