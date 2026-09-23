import { describe, it, expect } from 'vitest'
import { checkRateLimit, isRateLimited, recordFailedAttempt, clearRateLimit } from '@/lib/rate-limit'

// The limiter keeps one Map for the life of the process, so every test here
// uses its own key prefix rather than resetting shared state.
let seq = 0
const key = (suffix = '') => `test-${seq++}:${suffix}`

describe('checkRateLimit', () => {
  it('allows the first five attempts on a key and denies the sixth', () => {
    const k = key()
    const results = Array.from({ length: 6 }, () => checkRateLimit(k))
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false])
    expect(results[4].remaining).toBe(0)
  })

  it('caps the key length so padded identifiers cannot mint fresh buckets', () => {
    const base = `pad-${seq++}:`.padEnd(128, 'a')
    for (let i = 0; i < 5; i++) checkRateLimit(base)
    expect(checkRateLimit(base).allowed).toBe(false)
    // Anything past the cap is the same bucket, not a new one.
    expect(checkRateLimit(`${base}          `).allowed).toBe(false)
    expect(checkRateLimit(`${base}${'b'.repeat(500)}`).allowed).toBe(false)
  })

  it('keeps live counters when the sweep runs', () => {
    const k = key('survivor')
    checkRateLimit(k)
    // Push the Map past the sweep threshold with unrelated keys.
    for (let i = 0; i < 600; i++) checkRateLimit(key(`filler-${i}`))
    // The first key kept its count: four more are allowed, the sixth is not.
    expect(Array.from({ length: 4 }, () => checkRateLimit(k).allowed)).toEqual([true, true, true, true])
    expect(checkRateLimit(k).allowed).toBe(false)
  })
})

// A sign-in that SUCCEEDS must not spend the account's budget. The limiter is
// consulted before the PIN is verified, so if the check itself counts, the
// sixth sign-in of any 15 minutes is refused even when the PIN is correct —
// and an admin PIN reset cannot clear it, because the caller never reaches
// the success path. Failures count; successes release.
describe('failure-only limiting', () => {
  it('isRateLimited does not consume budget, so repeated success never locks', () => {
    const k = key('success')
    for (let i = 0; i < 20; i++) {
      expect(isRateLimited(k)).toBe(false)
      clearRateLimit(k) // what a successful sign-in does
    }
    expect(isRateLimited(k)).toBe(false)
  })

  it('locks after five recorded failures', () => {
    const k = key('failures')
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(k)).toBe(false)
      recordFailedAttempt(k)
    }
    expect(isRateLimited(k)).toBe(true)
  })

  it('a correct PIN after four failures still gets in, and clears the counter', () => {
    const k = key('recover')
    for (let i = 0; i < 4; i++) recordFailedAttempt(k)
    expect(isRateLimited(k)).toBe(false)
    clearRateLimit(k)
    for (let i = 0; i < 4; i++) recordFailedAttempt(k)
    expect(isRateLimited(k)).toBe(false)
  })

  it('clearRateLimit lets an admin PIN reset unlock a locked-out account', () => {
    const k = key('adminreset')
    for (let i = 0; i < 5; i++) recordFailedAttempt(k)
    expect(isRateLimited(k)).toBe(true)
    clearRateLimit(k)
    expect(isRateLimited(k)).toBe(false)
  })
})
