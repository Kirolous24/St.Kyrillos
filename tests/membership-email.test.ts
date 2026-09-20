import { describe, it, expect } from 'vitest'
import { escapeHtml, isValidEmail, buildMembershipEmail } from '@/lib/membership-email'

const base = {
  firstName: 'Mina',
  lastName: 'Gerges',
  email: 'mina@example.com',
  phone: '615-555-0100',
  address: '1 Main St',
  city: 'Antioch',
  state: 'TN',
  zip: '37013',
  dob: '1990-01-01',
  gender: 'Male',
  maritalStatus: 'Single',
  hasChildren: 'No',
}

describe('escapeHtml', () => {
  it('neutralizes markup and attribute breakouts', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml(`"onmouseover="x`)).toBe('&quot;onmouseover=&quot;x')
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s')
  })
  it('stringifies non-strings safely', () => {
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(42)).toBe('42')
  })
})

describe('isValidEmail', () => {
  it('accepts ordinary addresses and rejects junk / header injection', () => {
    expect(isValidEmail('mina@example.com')).toBe(true)
    expect(isValidEmail('first.last+tag@sub.example.co')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('x@example.com\r\nBcc: victim@example.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
  })
})

describe('buildMembershipEmail', () => {
  it('escapes every submitted field before it lands in the HTML (reported issue)', () => {
    const { html } = buildMembershipEmail({
      ...base,
      firstName: '<img src=x onerror=alert(1)>',
      city: 'Antioch"><script>x</script>',
    })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('Antioch&quot;&gt;&lt;script&gt;x&lt;/script&gt;')
  })

  it('does not let the name break out of the subject line', () => {
    const { subject } = buildMembershipEmail({ ...base, firstName: 'A\r\nBcc: x@y.z', lastName: 'B' })
    expect(subject).not.toMatch(/[\r\n]/)
  })

  it('uses the submitter email as reply-to only when it is valid', () => {
    expect(buildMembershipEmail(base).replyTo).toBe('mina@example.com')
    expect(buildMembershipEmail({ ...base, email: 'bad' }).replyTo).toBeUndefined()
  })

  it('renders the plain fields readably', () => {
    const { html, subject } = buildMembershipEmail(base)
    expect(subject).toBe('New Member — Mina Gerges')
    expect(html).toContain('Mina Gerges')
    expect(html).toContain('1 Main St, Antioch, TN, 37013')
    expect(html).toContain('href="mailto:mina@example.com"')
  })
})
