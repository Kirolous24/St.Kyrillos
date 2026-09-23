import { describe, it, expect } from 'vitest'
import { readingMonthDays, readingMonthLabel } from '@/lib/portal/readings'

// F0329 / F0754 — the port drew a rolling 30 days ending today, so a child on
// the 3rd saw 27 squares belonging to last month and "9/30" described a stretch
// nobody thinks in. The prototype drew the calendar month.
describe('readingMonthDays', () => {
  it('covers the whole month the day falls in, not the 30 days before it', () => {
    const days = readingMonthDays('2026-09-03')
    expect(days).toHaveLength(30)
    expect(days[0]!.date).toBe('2026-09-01')
    expect(days[29]!.date).toBe('2026-09-30')
  })

  it('marks days after today as future, so they do not read as missed', () => {
    const days = readingMonthDays('2026-09-03')
    expect(days.filter((d) => !d.future).map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(days[3]!.future).toBe(true)
  })

  it('gets the length of every awkward month right', () => {
    expect(readingMonthDays('2026-02-10')).toHaveLength(28)
    expect(readingMonthDays('2028-02-10')).toHaveLength(29) // a leap year
    expect(readingMonthDays('2026-01-31')).toHaveLength(31)
    expect(readingMonthDays('2026-12-01')).toHaveLength(31)
    expect(readingMonthDays('2026-04-30')).toHaveLength(30)
  })

  it('has nothing in the future on the last day of the month', () => {
    const days = readingMonthDays('2026-09-30')
    expect(days.some((d) => d.future)).toBe(false)
  })

  it('does not slip a month at either boundary', () => {
    expect(readingMonthDays('2026-01-01')[0]!.date).toBe('2026-01-01')
    expect(readingMonthDays('2026-12-31').at(-1)!.date).toBe('2026-12-31')
  })
})

describe('readingMonthLabel', () => {
  it('names the month and year the way the prototype did', () => {
    expect(readingMonthLabel('2026-09-03')).toBe('September 2026')
    expect(readingMonthLabel('2026-01-31')).toBe('January 2026')
    expect(readingMonthLabel('2026-12-25')).toBe('December 2026')
  })
})
