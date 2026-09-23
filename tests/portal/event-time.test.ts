import { describe, it, expect } from 'vitest'
import { toTimeInputValue, formatTimeOfDay, academicYearLabel } from '@/lib/portal/format'

describe('toTimeInputValue', () => {
  it('reads the free text the church already typed', () => {
    expect(toTimeInputValue('6:00 PM')).toBe('18:00')
    expect(toTimeInputValue('6pm')).toBe('18:00')
    expect(toTimeInputValue('6 p.m.')).toBe('18:00')
    expect(toTimeInputValue('9:30 am')).toBe('09:30')
  })

  it('passes 24-hour values through', () => {
    expect(toTimeInputValue('18:00')).toBe('18:00')
    expect(toTimeInputValue('09:05')).toBe('09:05')
  })

  it('handles midnight and noon, where the 12-hour clock is a trap', () => {
    expect(toTimeInputValue('12:00 AM')).toBe('00:00')
    expect(toTimeInputValue('12:00 PM')).toBe('12:00')
  })

  it('returns null rather than guessing, so the caller can keep the text box', () => {
    // These must NOT be coerced — blanking a time the church recorded is worse
    // than showing it as text.
    expect(toTimeInputValue('after liturgy')).toBeNull()
    expect(toTimeInputValue('6:00 PM - 8:00 PM')).toBeNull()
    expect(toTimeInputValue('25:00')).toBeNull()
    expect(toTimeInputValue('6:75 pm')).toBeNull()
    expect(toTimeInputValue('')).toBeNull()
    expect(toTimeInputValue(null)).toBeNull()
  })
})

describe('formatTimeOfDay', () => {
  it('reads a stored picker value back the way the church says it', () => {
    expect(formatTimeOfDay('18:30')).toBe('6:30 PM')
    expect(formatTimeOfDay('09:00')).toBe('9:00 AM')
    expect(formatTimeOfDay('00:15')).toBe('12:15 AM')
    expect(formatTimeOfDay('12:00')).toBe('12:00 PM')
  })

  it('leaves unparseable text exactly as written', () => {
    expect(formatTimeOfDay('after liturgy')).toBe('after liturgy')
    expect(formatTimeOfDay(null)).toBeNull()
  })
})

describe('academicYearLabel', () => {
  it('names the year the way the prototype did, prefix included', () => {
    // F0169: without the prefix the topbar shows a bare pair of years under the
    // church name, which reads as a date rather than as the year the portal's
    // figures belong to.
    expect(academicYearLabel('2026-10-15')).toBe('Academic Year 2026 – 2027 (1743 Coptic)')
  })

  it('rolls over in September, not January', () => {
    expect(academicYearLabel('2026-08-31')).toContain('2025 – 2026')
    expect(academicYearLabel('2026-09-01')).toContain('2026 – 2027')
  })

  it('carries the Coptic year, which is the start year minus 283', () => {
    expect(academicYearLabel('2026-09-01')).toContain('(1743 Coptic)')
  })
})
