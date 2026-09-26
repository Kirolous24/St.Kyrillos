import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { sealPin, openPin, pinVaultEnabled } from '@/lib/portal/pin-vault'

const KEY_A = randomBytes(32).toString('base64')
const KEY_B = randomBytes(32).toString('base64')

describe('pin vault', () => {
  const saved = process.env.PORTAL_PIN_KEY
  beforeEach(() => {
    process.env.PORTAL_PIN_KEY = KEY_A
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.PORTAL_PIN_KEY
    else process.env.PORTAL_PIN_KEY = saved
  })

  it('opens what it sealed, for the same login ID', () => {
    const sealed = sealPin('0042', '1234')!
    expect(sealed.startsWith('v1.')).toBe(true)
    expect(sealed).not.toContain('0042')
    expect(openPin(sealed, '1234')).toBe('0042')
  })

  it('uses a fresh IV every time', () => {
    expect(sealPin('0042', '1234')).not.toBe(sealPin('0042', '1234'))
  })

  it('will not open under another login ID', () => {
    expect(openPin(sealPin('0042', '1234'), '4321')).toBeNull()
  })

  it('will not open under another key', () => {
    const sealed = sealPin('0042', '1234')
    process.env.PORTAL_PIN_KEY = KEY_B
    expect(openPin(sealed, '1234')).toBeNull()
  })

  it('rejects a tampered body and a truncated tag', () => {
    const [v, iv, tag, body] = sealPin('0042', '1234')!.split('.')
    const flipped = Buffer.from(body!, 'base64url')
    flipped[0] = flipped[0]! ^ 1
    expect(openPin([v, iv, tag, flipped.toString('base64url')].join('.'), '1234')).toBeNull()
    expect(openPin([v, iv, tag!.slice(0, 8), body].join('.'), '1234')).toBeNull()
  })

  it('is off without a valid key', () => {
    delete process.env.PORTAL_PIN_KEY
    expect(pinVaultEnabled()).toBe(false)
    expect(sealPin('0042', '1234')).toBeNull()
    process.env.PORTAL_PIN_KEY = Buffer.from('too short').toString('base64')
    expect(pinVaultEnabled()).toBe(false)
    expect(sealPin('0042', '1234')).toBeNull()
  })

  it('opens nothing when there is nothing sealed', () => {
    expect(openPin(null, '1234')).toBeNull()
    expect(openPin('garbage', '1234')).toBeNull()
  })
})
