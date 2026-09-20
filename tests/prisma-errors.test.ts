import { describe, it, expect } from 'vitest'
import { isUniqueViolation } from '@/lib/prisma-errors'

describe('isUniqueViolation', () => {
  it('recognizes Prisma P2002 errors', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true)
  })
  it('rejects other errors and non-objects', () => {
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false)
    expect(isUniqueViolation(new Error('x'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation('P2002')).toBe(false)
  })
})
