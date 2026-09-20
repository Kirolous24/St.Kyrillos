import { describe, it, expect } from 'vitest'
import { randomPin } from '@/lib/portal/credentials'

// randomPin() used to be copy-pasted (byte-for-byte) into students.ts,
// admin.ts and data-tools.ts. Consolidated here so the ~270 students' and
// every servant's login PIN policy has exactly one definition and one test.
describe('randomPin', () => {
  it('is always a zero-padded 4-digit string', () => {
    for (let i = 0; i < 200; i++) {
      const pin = randomPin()
      expect(pin).toMatch(/^\d{4}$/)
      expect(Number(pin)).toBeGreaterThanOrEqual(0)
      expect(Number(pin)).toBeLessThanOrEqual(9999)
    }
  })
})
