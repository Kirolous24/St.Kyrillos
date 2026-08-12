import { describe, it, expect } from 'vitest'
import {
  SCHEDULE_WEEKS,
  toUTCDateStr,
  dateStrToNoonUTC,
  weekStartUTC,
  scheduleWindowUTC,
  windowDateStr,
  isWithinWindow,
} from '@/lib/schedule-window'

// Jan 4 2026 is a Sunday (Jan 1 2026 is a Thursday). Use it as a known anchor.
const SUNDAY = new Date('2026-01-04T09:00:00.000Z')
// A midweek anchor to prove week math snaps back to Sunday.
const WEDNESDAY = new Date('2026-01-07T23:30:00.000Z')

describe('weekStartUTC', () => {
  it('returns the containing Sunday at 00:00 UTC', () => {
    expect(toUTCDateStr(weekStartUTC(SUNDAY))).toBe('2026-01-04')
    expect(toUTCDateStr(weekStartUTC(WEDNESDAY))).toBe('2026-01-04')
    expect(weekStartUTC(WEDNESDAY).getUTCHours()).toBe(0)
  })

  it('always lands on a Sunday (getUTCDay === 0) for arbitrary dates', () => {
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 5, 1 + i, 17, 0, 0)) // June 2026, afternoons
      expect(weekStartUTC(d).getUTCDay()).toBe(0)
    }
  })
})

describe('scheduleWindowUTC', () => {
  it('spans exactly 4 weeks (28 inclusive calendar days) ending Saturday night', () => {
    const { weekStart, weekEnd } = scheduleWindowUTC(SUNDAY)
    expect(toUTCDateStr(weekStart)).toBe('2026-01-04') // Sun
    expect(toUTCDateStr(weekEnd)).toBe('2026-01-31') // Sat, 4 weeks later
    expect(weekEnd.getUTCDay()).toBe(6)
    // Inclusive calendar days from the start date to the end date = 28.
    const startDay = Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate())
    const endDay = Date.UTC(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate())
    const inclusiveDays = (endDay - startDay) / 86_400_000 + 1
    expect(inclusiveDays).toBe(SCHEDULE_WEEKS * 7) // 28
    // weekEnd is the final millisecond of the 28th day.
    expect(weekEnd.getUTCHours()).toBe(23)
    expect(weekEnd.getUTCMilliseconds()).toBe(999)
  })
})

describe('windowDateStr', () => {
  it('maps (week, dayOfWeek) to the right calendar date', () => {
    expect(windowDateStr(SUNDAY, 0, 0)).toBe('2026-01-04') // week 0 Sunday
    expect(windowDateStr(SUNDAY, 0, 5)).toBe('2026-01-09') // week 0 Friday
    expect(windowDateStr(SUNDAY, 1, 6)).toBe('2026-01-17') // week 1 Saturday
    expect(windowDateStr(SUNDAY, 3, 6)).toBe('2026-01-31') // last day of window
  })

  it('produces a date whose UTC weekday matches the requested dayOfWeek', () => {
    for (let w = 0; w < SCHEDULE_WEEKS; w++) {
      for (let dow = 0; dow < 7; dow++) {
        const d = dateStrToNoonUTC(windowDateStr(WEDNESDAY, w, dow))
        expect(d.getUTCDay()).toBe(dow)
      }
    }
  })
})

describe('isWithinWindow', () => {
  it('accepts the first and last day, rejects just outside', () => {
    expect(isWithinWindow('2026-01-04', SUNDAY)).toBe(true) // first day
    expect(isWithinWindow('2026-01-31', SUNDAY)).toBe(true) // last day
    expect(isWithinWindow('2026-01-03', SUNDAY)).toBe(false) // day before window
    expect(isWithinWindow('2026-02-01', SUNDAY)).toBe(false) // day after window
  })

  it('rejects malformed dates', () => {
    expect(isWithinWindow('not-a-date', SUNDAY)).toBe(false)
  })
})
