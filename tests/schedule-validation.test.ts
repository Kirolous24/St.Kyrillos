import { describe, it, expect } from 'vitest'
import {
  isValidDuration,
  isValidSortOrder,
  isValidDayOfWeek,
  isValidTime24,
  time24ToSortOrder,
  isValidDateStr,
} from '@/lib/schedule-validation'

describe('isValidDuration', () => {
  it('accepts positive minutes up to a full day', () => {
    expect(isValidDuration(30)).toBe(true)
    expect(isValidDuration(1440)).toBe(true)
  })
  it('rejects zero, negative, non-finite, and over-a-day (reported gap: negative durations)', () => {
    expect(isValidDuration(0)).toBe(false)
    expect(isValidDuration(-60)).toBe(false)
    expect(isValidDuration(1441)).toBe(false)
    expect(isValidDuration(NaN)).toBe(false)
    expect(isValidDuration('60' as unknown)).toBe(false)
    expect(isValidDuration(undefined)).toBe(false)
  })
})

describe('isValidSortOrder', () => {
  it('accepts 0..1439', () => {
    expect(isValidSortOrder(0)).toBe(true)
    expect(isValidSortOrder(1080)).toBe(true)
    expect(isValidSortOrder(1439)).toBe(true)
  })
  it('rejects negative, >= 1440, and non-integers', () => {
    expect(isValidSortOrder(-1)).toBe(false)
    expect(isValidSortOrder(1440)).toBe(false)
    expect(isValidSortOrder(12.5)).toBe(false)
  })
})

describe('isValidDayOfWeek', () => {
  it('accepts 0..6, rejects out of range', () => {
    for (let d = 0; d <= 6; d++) expect(isValidDayOfWeek(d)).toBe(true)
    expect(isValidDayOfWeek(7)).toBe(false)
    expect(isValidDayOfWeek(-1)).toBe(false)
    expect(isValidDayOfWeek(99)).toBe(false) // reported gap: dayOfWeek=99 stored
  })
})

describe('isValidTime24', () => {
  it('accepts valid 24-hour times', () => {
    expect(isValidTime24('00:00')).toBe(true)
    expect(isValidTime24('8:00')).toBe(true)
    expect(isValidTime24('23:59')).toBe(true)
  })
  it('rejects malformed times (reported gap: NaN sortOrder)', () => {
    expect(isValidTime24('bad')).toBe(false)
    expect(isValidTime24('24:00')).toBe(false)
    expect(isValidTime24('12:60')).toBe(false)
    expect(isValidTime24('12')).toBe(false)
    expect(isValidTime24('')).toBe(false)
  })
})

describe('time24ToSortOrder', () => {
  it('converts to minutes from midnight', () => {
    expect(time24ToSortOrder('00:00')).toBe(0)
    expect(time24ToSortOrder('08:00')).toBe(480)
    expect(time24ToSortOrder('18:30')).toBe(1110)
  })
})

describe('isValidDateStr', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDateStr('2026-01-04')).toBe(true)
    expect(isValidDateStr('2026-12-31')).toBe(true)
  })
  it('rejects malformed or impossible dates', () => {
    expect(isValidDateStr('2026-13-01')).toBe(false)
    expect(isValidDateStr('2026-02-30')).toBe(false)
    expect(isValidDateStr('not-a-date')).toBe(false)
    expect(isValidDateStr('2026-1-4')).toBe(false)
  })
})
