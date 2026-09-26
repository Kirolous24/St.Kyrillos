import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { issuedPinFields, issuedPinFieldsFromHash, hashPin, selfSetPinFields } from '@/lib/portal/pin-issue'
import { openPin } from '@/lib/portal/pin-vault'

describe('issuing a PIN', () => {
  const saved = process.env.PORTAL_PIN_KEY
  beforeAll(() => {
    process.env.PORTAL_PIN_KEY = randomBytes(32).toString('base64')
  })
  afterAll(() => {
    if (saved === undefined) delete process.env.PORTAL_PIN_KEY
    else process.env.PORTAL_PIN_KEY = saved
  })

  it('an issued PIN signs in and reads back under its login ID', async () => {
    const f = await issuedPinFields('0042', '1234')
    expect(await bcrypt.compare('0042', f.pinHash)).toBe(true)
    expect(openPin(f.pinSealed, '1234')).toBe('0042')
  })

  it('a batch can hash first and seal once the login ID is known', async () => {
    const hash = await hashPin('7777')
    const f = issuedPinFieldsFromHash('7777', hash, '5555')
    expect(f.pinHash).toBe(hash)
    expect(openPin(f.pinSealed, '5555')).toBe('7777')
  })

  it('a PIN someone chose keeps no readable copy', async () => {
    const f = await selfSetPinFields('9876')
    expect(await bcrypt.compare('9876', f.pinHash)).toBe(true)
    expect(f.pinSealed).toBeNull()
  })
})
