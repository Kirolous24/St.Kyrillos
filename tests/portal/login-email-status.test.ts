import { describe, it, expect } from 'vitest'
import { loginEmailStates, parseResendTime, fetchSentLoginEmails } from '@/lib/portal/login-email-status'
import { LOGIN_EMAIL_SUBJECT } from '@/lib/portal/login-share'

const at = (s: string) => new Date(s)

describe('Resend timestamps', () => {
  it('reads the format Resend returns, which is not ISO', () => {
    expect(parseResendTime('2026-09-26 22:20:44.996+00')!.toISOString()).toBe('2026-09-26T22:20:44.996Z')
    expect(parseResendTime('2026-09-26 22:20:44.996123+00')!.toISOString()).toBe('2026-09-26T22:20:44.996Z')
    expect(parseResendTime('2026-09-26T22:20:44Z')!.toISOString()).toBe('2026-09-26T22:20:44.000Z')
    expect(parseResendTime('nonsense')).toBeNull()
  })
})

describe('who has been emailed their login', () => {
  const sent = [
    { to: ['a@example.com'], createdAt: at('2026-09-26T22:20:00Z'), lastEvent: 'delivered' },
    { to: ['B@Example.com'], createdAt: at('2026-09-26T22:21:00Z'), lastEvent: 'bounced' },
    { to: ['c@example.com'], createdAt: at('2026-09-26T22:22:00Z'), lastEvent: 'sent' },
    { to: ['d@example.com'], createdAt: at('2026-09-26T22:23:00Z'), lastEvent: 'delivered' },
    { to: ['e@example.com'], createdAt: at('2026-09-26T22:24:00Z'), lastEvent: 'bounced' },
    { to: ['e@example.com'], createdAt: at('2026-09-26T22:40:00Z'), lastEvent: 'delivered' },
  ]
  const states = loginEmailStates(
    [
      { id: 'a', email: 'a@example.com', pinIssuedAt: null },
      { id: 'b', email: 'b@example.com', pinIssuedAt: null },
      { id: 'c', email: 'c@example.com', pinIssuedAt: null },
      // PIN reissued after the email went out: that email is out of date.
      { id: 'd', email: 'd@example.com', pinIssuedAt: at('2026-09-27T10:00:00Z') },
      { id: 'e', email: 'e@example.com', pinIssuedAt: null },
      { id: 'f', email: 'f@example.com', pinIssuedAt: null },
      { id: 'g', email: null, pinIssuedAt: null },
    ],
    sent,
  )

  it('counts a delivered or in-flight email as emailed', () => {
    expect(states.get('a')).toEqual({ state: 'emailed', at: at('2026-09-26T22:20:00Z') })
    expect(states.get('c')).toMatchObject({ state: 'emailed' })
  })
  it('matches the address whatever its case, and reports a bounce', () => {
    expect(states.get('b')).toEqual({ state: 'bounced', at: at('2026-09-26T22:21:00Z') })
  })
  it('ignores an email sent before the PIN was reissued', () => {
    expect(states.get('d')).toEqual({ state: 'none' })
  })
  it('goes by the latest email to the address', () => {
    expect(states.get('e')).toEqual({ state: 'emailed', at: at('2026-09-26T22:40:00Z') })
  })
  it('says none when nothing was sent, or there is no address', () => {
    expect(states.get('f')).toEqual({ state: 'none' })
    expect(states.get('g')).toEqual({ state: 'none' })
  })
})

describe('reading the sent login emails from Resend', () => {
  it('pages through the list and keeps only the login emails', async () => {
    const pages: Record<string, unknown> = {
      first: {
        has_more: true,
        data: [
          { id: 'm1', to: ['a@example.com'], subject: LOGIN_EMAIL_SUBJECT, created_at: '2026-09-26 22:20:44.996+00', last_event: 'delivered' },
          { id: 'm2', to: ['x@example.com'], subject: 'Membership form', created_at: '2026-09-26 22:21:00+00', last_event: 'delivered' },
        ],
      },
      m2: {
        has_more: false,
        data: [{ id: 'm3', to: ['b@example.com'], subject: `[TEST for b@example.com] ${LOGIN_EMAIL_SUBJECT}`, created_at: '2026-09-26 22:22:00+00', last_event: 'delivered' }],
      },
    }
    const calls: string[] = []
    const fakeFetch = async (url: string) => {
      calls.push(url)
      const after = new URL(url).searchParams.get('after') ?? 'first'
      return { ok: true, status: 200, json: async () => pages[after] } as unknown as Response
    }
    const got = await fetchSentLoginEmails('re_test', fakeFetch as unknown as typeof fetch)
    expect(calls).toHaveLength(2)
    expect(got).toEqual([{ to: ['a@example.com'], createdAt: new Date('2026-09-26T22:20:44.996Z'), lastEvent: 'delivered' }])
  })

  it('throws when Resend refuses, so the page can say it could not check', async () => {
    const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response
    await expect(fetchSentLoginEmails('re_bad', fakeFetch as unknown as typeof fetch)).rejects.toThrow()
  })
})
