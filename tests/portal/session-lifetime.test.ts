import { describe, it, expect } from 'vitest'
import {
  portalSessionExpired,
  STAFF_SESSION_SECONDS,
  STUDENT_SESSION_SECONDS,
} from '@/lib/auth.config'

/**
 * F0047 — the 24-hour session that met a servant halfway through Sunday's
 * register. Staff get a rolling month; children are capped from sign-in because
 * they share a household tablet.
 */
describe('portal session lifetimes', () => {
  it('gives staff a month and children half a day', () => {
    expect(STAFF_SESSION_SECONDS).toBe(30 * 24 * 60 * 60)
    expect(STUDENT_SESSION_SECONDS).toBe(12 * 60 * 60)
    expect(STUDENT_SESSION_SECONDS).toBeLessThan(STAFF_SESSION_SECONDS)
  })

  it('never expires a servant, admin or pastor early', () => {
    const longAgo = Date.now() - 29 * 24 * 60 * 60 * 1000
    for (const role of ['SERVANT', 'ADMIN', 'PASTOR'] as const) {
      expect(portalSessionExpired(role, longAgo)).toBe(false)
    }
  })

  it('expires a child past the cap', () => {
    expect(portalSessionExpired('STUDENT', Date.now() - 13 * 60 * 60 * 1000)).toBe(true)
  })

  it('keeps a child signed in within the cap', () => {
    expect(portalSessionExpired('STUDENT', Date.now() - 6 * 60 * 60 * 1000)).toBe(false)
  })

  it('does not sign anyone out over a token issued before this shipped', () => {
    // No stamp means a cookie from the old flat-24-hour config. Treating it as
    // expired would sign every child out the moment this deploys, which is a
    // worse Sunday than the bug.
    expect(portalSessionExpired('STUDENT', undefined)).toBe(false)
    expect(portalSessionExpired(undefined, undefined)).toBe(false)
  })
})
