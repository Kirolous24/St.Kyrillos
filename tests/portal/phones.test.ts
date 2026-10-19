import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone, waLink, kidPhoneList } from '@/lib/portal/phones'

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

// The prototype's waLink (OG L16751): US numbers are stored without a country
// code, and WhatsApp needs the international form, so a bare 10-digit number
// gets a 1 prepended. Without this the follow-up row's WhatsApp link 404s.
describe('waLink', () => {
  it('prepends the US country code to a 10-digit number', () => {
    expect(waLink('6155550123')).toBe('https://wa.me/16155550123')
    expect(waLink('(615) 555-0123')).toBe('https://wa.me/16155550123')
  })

  it('leaves an already-qualified number alone', () => {
    expect(waLink('16155550123')).toBe('https://wa.me/16155550123')
    expect(waLink('+1 615-555-0123')).toBe('https://wa.me/16155550123')
  })

  it('passes through a non-US length unchanged', () => {
    expect(waLink('20 100 123 4567')).toBe('https://wa.me/201001234567')
  })

  it('is null for nothing usable', () => {
    expect(waLink(null)).toBeNull()
    expect(waLink('')).toBeNull()
    expect(waLink('n/a')).toBeNull()
  })
})


// A child's numbers on every card a servant sees (2026-10-19): the family's
// first, labelled, each once.
describe('kidPhoneList', () => {
  it('lists the father, the mother and the child’s own, in that order', () => {
    expect(kidPhoneList({ fatherPhone: '615-555-0101', motherPhone: '(615) 555-0102', ownPhone: '6155550103' })).toEqual([
      { label: 'Father', digits: '6155550101', display: '(615) 555-0101', tel: 'tel:6155550101' },
      { label: 'Mother', digits: '6155550102', display: '(615) 555-0102', tel: 'tel:6155550102' },
      { label: 'Student', digits: '6155550103', display: '(615) 555-0103', tel: 'tel:6155550103' },
    ])
  })

  it('shows a number the parents share once', () => {
    expect(kidPhoneList({ fatherPhone: '615-555-0101', motherPhone: '+1 615 555 0101' }).map((p) => p.label)).toEqual(['Parents'])
  })

  it('leaves out the child’s own when it is a parent’s', () => {
    expect(kidPhoneList({ motherPhone: '615-555-0102', ownPhone: '615.555.0102' }).map((p) => p.label)).toEqual(['Mother'])
  })

  it('skips blanks and says nothing when there is no number', () => {
    expect(kidPhoneList({ fatherPhone: '', motherPhone: null, ownPhone: '  ' })).toEqual([])
    expect(kidPhoneList({})).toEqual([])
  })

  it('keeps a number it cannot format as it was typed, digits only', () => {
    expect(kidPhoneList({ fatherPhone: '20 100 555 0101' })[0]).toMatchObject({ display: '201005550101', tel: 'tel:201005550101' })
  })
})
