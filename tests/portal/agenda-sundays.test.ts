import { describe, it, expect } from 'vitest'
import { isCompleteDateInput, sundayOfWeek, normaliseWeekStart } from '@/lib/portal/agenda'

// Lesson Preparation is keyed by Monday, but Sunday School meets on Sunday. The
// date box used to show the Monday, so picking this Sunday made the box jump
// back to a past date and read as "the page won't take a future day".
describe('Lesson Preparation works in Sundays', () => {
  it('names the Sunday a Monday-keyed week leads up to', () => {
    expect(sundayOfWeek('2026-09-21')).toBe('2026-09-27')
    expect(sundayOfWeek('2026-12-28')).toBe('2027-01-03')
  })

  it('a picked Sunday opens the week that ends on it, and shows that same Sunday', () => {
    const monday = normaliseWeekStart('2026-10-04')!
    expect(monday).toBe('2026-09-28')
    expect(sundayOfWeek(monday)).toBe('2026-10-04')
  })

  it('a weekday opens the week of the coming Sunday', () => {
    expect(sundayOfWeek(normaliseWeekStart('2026-09-29')!)).toBe('2026-10-04')
  })

  it('only jumps once the date box holds a whole, plausible date', () => {
    expect(isCompleteDateInput('2026-10-04')).toBe(true)
    // Typing a year on a computer passes through these on the way to 2026.
    expect(isCompleteDateInput('0002-10-04')).toBe(false)
    expect(isCompleteDateInput('0202-10-04')).toBe(false)
    expect(isCompleteDateInput('')).toBe(false)
    expect(isCompleteDateInput('2026-02-30')).toBe(false)
    expect(isCompleteDateInput('2026-10-4')).toBe(false)
  })
})
