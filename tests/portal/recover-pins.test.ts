import { describe, it, expect } from 'vitest'
import { parseRecoveryCsv, classifyRecovery } from '@/lib/portal/recover-pins'

describe('recovering PINs', () => {
  it('reads an id,pin file, header or not, and skips junk and duplicates', () => {
    expect(parseRecoveryCsv('id,pin\n1234,0042\n1234,9999\n12,0042\n5678,12\n4321,7777\n')).toEqual({
      rows: [
        { loginId: '1234', pin: '0042' },
        { loginId: '4321', pin: '7777' },
      ],
      skipped: 3,
    })
    expect(parseRecoveryCsv('1111,2222').rows).toEqual([{ loginId: '1111', pin: '2222' }])
  })

  it('accepts its own export back, with the ="0042" text cells', () => {
    const exported = 'Name,Role,ID,PIN,Note\r\nMariam,Servant,"=""1234""","=""0042""",\r\n'
    expect(parseRecoveryCsv(exported).rows).toEqual([{ loginId: '1234', pin: '0042' }])
  })

  it('seals only a PIN that still matches, and never one already on file', async () => {
    const compare = async (pin: string, hash: string) => hash === `hash:${pin}`
    const row = { loginId: '1234', pin: '0042' }
    expect(await classifyRecovery(row, undefined, compare)).toBe('unknown')
    expect(await classifyRecovery(row, { pinHash: 'hash:0042', hasSealed: true }, compare)).toBe('already')
    expect(await classifyRecovery(row, { pinHash: 'hash:9999', hasSealed: false }, compare)).toBe('changed')
    expect(await classifyRecovery(row, { pinHash: 'hash:0042', hasSealed: false }, compare)).toBe('sealed')
  })
})
