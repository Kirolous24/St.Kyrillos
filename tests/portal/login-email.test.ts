import { describe, it, expect } from 'vitest'
import { emailRouting, buildLoginEmails, LOGIN_EMAIL_FROM } from '@/lib/portal/login-email'
import { LOGIN_EMAIL_SUBJECT } from '@/lib/portal/login-share'

const item = { accountId: 'a1', name: 'Mina Saad', email: 'mina@example.com', loginId: '1234', pin: '0042' }

describe('login emails', () => {
  it('sends to real addresses only from production', () => {
    expect(emailRouting({ VERCEL_ENV: 'production' })).toEqual({ mode: 'live' })
    expect(emailRouting({ VERCEL_ENV: 'preview' })).toEqual({ mode: 'off' })
    expect(emailRouting({})).toEqual({ mode: 'off' })
    expect(emailRouting({ PORTAL_EMAIL_REDIRECT: ' me@example.com ' })).toEqual({ mode: 'redirect', to: 'me@example.com' })
  })

  it('treats the production database as the live site even if VERCEL_ENV is not exposed', () => {
    const prodDb = 'postgresql://u:p@ep-dark-term-ai3c2hag-pooler.example.test/neondb'
    const devDb = 'postgresql://u:p@ep-some-dev-branch-pooler.example.test/neondb'
    expect(emailRouting({ DATABASE_URL: prodDb })).toEqual({ mode: 'live' })
    expect(emailRouting({ DATABASE_URL: devDb })).toEqual({ mode: 'off' })
    expect(emailRouting({ DATABASE_URL: devDb, PORTAL_EMAIL_REDIRECT: 'me@example.com' })).toEqual({ mode: 'redirect', to: 'me@example.com' })
  })

  it('builds one message per person with only their own login', () => {
    const [m] = buildLoginEmails([item], { mode: 'live' })
    expect(m).toMatchObject({ from: LOGIN_EMAIL_FROM, to: 'mina@example.com', subject: LOGIN_EMAIL_SUBJECT })
    expect(m!.text).toContain('Hi Mina,')
    expect(m!.text).toContain('ID: 1234')
    expect(m!.text).toContain('PIN: 0042')
  })

  it('redirects every message when testing, and says who it was for', () => {
    const [m] = buildLoginEmails([item], { mode: 'redirect', to: 'me@example.com' })
    expect(m!.to).toBe('me@example.com')
    expect(m!.subject).toBe(`[TEST for mina@example.com] ${LOGIN_EMAIL_SUBJECT}`)
  })
})
