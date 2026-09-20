import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone } from '@/lib/portal/phones'

describe('normalizePhone', () => {
  it('reduces US numbers to 10 digits', () => {
    expect(normalizePhone('(615) 555-0142')).toBe('6155550142')
    expect(normalizePhone('615.555.0142')).toBe('6155550142')
    expect(normalizePhone('+1 615-555-0142')).toBe('6155550142')
    expect(normalizePhone('1 (615) 555 0142')).toBe('6155550142')
  })
  it('strips stray unicode and keeps digits', () => {
    expect(normalizePhone('‭(615) 555-0142‬')).toBe('6155550142')
  })
  it('returns null for empty or non-numeric input', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('   ')).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
    expect(normalizePhone('N/A')).toBeNull()
  })
  it('keeps non-standard lengths as raw digits', () => {
    expect(normalizePhone('12345')).toBe('12345')
    expect(normalizePhone('+20 100 123 4567')).toBe('201001234567')
  })
})

describe('formatPhone', () => {
  it('formats 10-digit numbers for display', () => {
    expect(formatPhone('6155550142')).toBe('(615) 555-0142')
  })
  it('leaves other lengths alone', () => {
    expect(formatPhone('12345')).toBe('12345')
    expect(formatPhone(null)).toBe('')
  })
})
