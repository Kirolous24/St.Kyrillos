import { describe, it, expect } from 'vitest'
import { isForeignKeyViolation, uniqueViolationTargets, isUniqueViolationOn } from '@/lib/prisma-errors'
import { runAction, PortalError } from '@/lib/portal/action-result'

// Postgres reports a P2002 target either as the field list or as the index
// name, depending on the constraint, so both shapes have to be understood.
const redemptionClash = { code: 'P2002', meta: { target: ['tokenId', 'accountId'] } }
const redemptionClashByIndex = { code: 'P2002', meta: { target: 'QrRedemption_tokenId_accountId_key' } }
const attendanceClash = { code: 'P2002', meta: { target: ['studentId', 'date', 'sessionKey'] } }
const pointEntryClash = { code: 'P2002', meta: { target: ['attendanceRecordId'] } }

describe('uniqueViolationTargets', () => {
  it('lower-cases a field list', () => {
    expect(uniqueViolationTargets(redemptionClash)).toEqual(['tokenid', 'accountid'])
  })

  it('accepts an index name', () => {
    expect(uniqueViolationTargets(redemptionClashByIndex)).toEqual(['qrredemption_tokenid_accountid_key'])
  })

  it('is empty for anything that is not a unique violation', () => {
    expect(uniqueViolationTargets({ code: 'P2003' })).toEqual([])
    expect(uniqueViolationTargets({ code: 'P2002' })).toEqual([])
    expect(uniqueViolationTargets(new Error('x'))).toEqual([])
    expect(uniqueViolationTargets(null)).toEqual([])
  })
})

describe('isUniqueViolationOn', () => {
  it('matches the redemption constraint in either shape', () => {
    expect(isUniqueViolationOn(redemptionClash, 'QrRedemption', 'tokenId')).toBe(true)
    expect(isUniqueViolationOn(redemptionClashByIndex, 'QrRedemption', 'tokenId')).toBe(true)
  })

  // The bug this guards: a QR check-in writes the redemption row, the
  // attendance row and its point entry in one transaction. Treating any P2002
  // as "you already checked in" told the student they were marked present over
  // a transaction that had rolled back.
  it('does not match a clash on another table in the same transaction', () => {
    expect(isUniqueViolationOn(attendanceClash, 'QrRedemption', 'tokenId')).toBe(false)
    expect(isUniqueViolationOn(pointEntryClash, 'QrRedemption', 'tokenId')).toBe(false)
  })

  it('does not match when the error names nothing', () => {
    expect(isUniqueViolationOn({ code: 'P2002' }, 'QrRedemption', 'tokenId')).toBe(false)
  })
})

describe('isForeignKeyViolation', () => {
  it('is true only for P2003', () => {
    expect(isForeignKeyViolation({ code: 'P2003' })).toBe(true)
    expect(isForeignKeyViolation({ code: 'P2002' })).toBe(false)
    expect(isForeignKeyViolation(new Error('x'))).toBe(false)
    expect(isForeignKeyViolation(undefined)).toBe(false)
  })
})

describe('runAction', () => {
  it('passes a PortalError message through', async () => {
    const r = await runAction(async () => {
      throw new PortalError('Move the students out first.')
    })
    expect(r).toEqual({ ok: false, error: 'Move the students out first.' })
  })

  it('explains a foreign-key violation instead of the generic message', async () => {
    const r = await runAction(async () => {
      throw { code: 'P2003', meta: { field_name: 'AttendanceRecord_markedById_fkey (index)' } }
    })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('still point to this')
  })

  it('still hides anything else behind the generic message', async () => {
    const r = await runAction(async () => {
      throw new Error('connection reset')
    })
    expect(r).toEqual({ ok: false, error: 'Something went wrong. Please try again.' })
  })

  it('rethrows a Next.js redirect', async () => {
    await expect(
      runAction(async () => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/portal' })
      }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })
})
