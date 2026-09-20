import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

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
