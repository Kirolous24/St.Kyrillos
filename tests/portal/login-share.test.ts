import { describe, it, expect } from 'vitest'
import { loginMessage, smsHref, whatsappHref, mailtoHref, LOGIN_URL } from '@/lib/portal/login-share'

describe('login share', () => {
  const text = loginMessage({ name: 'Mariam Guirguis', loginId: '1234', pin: '0042' })

  it('greets by first name and keeps the leading zero', () => {
    expect(text).toBe(`Hi Mariam, here is your St. Kyrillos Sunday School portal login.\nID: 1234\nPIN: 0042\nSign in at ${LOGIN_URL}`)
  })

  it('texts a US number in +1 form with the body encoded', () => {
    expect(smsHref('6155550123', 'a b')).toBe('sms:+16155550123?&body=a%20b')
    expect(smsHref('', 'x')).toBeNull()
    expect(smsHref(null, 'x')).toBeNull()
  })

  it('opens WhatsApp with the message', () => {
    expect(whatsappHref('6155550123', 'a b')).toBe('https://wa.me/16155550123?text=a%20b')
    expect(whatsappHref(undefined, 'x')).toBeNull()
  })

  it('opens a mail draft only when there is an address', () => {
    expect(mailtoHref('a@example.com', 'hi')).toMatch(/^mailto:a%40example\.com\?subject=.+&body=hi$/)
    expect(mailtoHref(null, 'hi')).toBeNull()
  })

  it('falls back to "there" when there is no name', () => {
    expect(loginMessage({ name: ' ', loginId: '1', pin: '2' }).startsWith('Hi there,')).toBe(true)
  })
})
