import { describe, it, expect } from 'vitest'
import { loginsCsv, NOT_ON_FILE_NOTE } from '@/lib/portal/logins-csv'
import { parseCsv } from '@/lib/portal/csv'

describe('logins CSV', () => {
  const rows = [
    { name: 'Mariam G', group: 'Servant', loginId: '1234', pin: '0042' },
    { name: '=HYPERLINK("x")', group: 'Servant', loginId: '5678', pin: null },
  ]

  it('keeps leading zeros by writing ID and PIN as text formulas', () => {
    const m = parseCsv(loginsCsv('servants', rows))
    expect(m[0]).toEqual(['Name', 'Role', 'ID', 'PIN', 'Note'])
    expect(m[1]).toEqual(['Mariam G', 'Servant', '="1234"', '="0042"', ''])
  })

  it('says why a PIN is missing, and still neutralises a formula in a name', () => {
    const m = parseCsv(loginsCsv('servants', rows))
    expect(m[2]).toEqual(["'=HYPERLINK(\"x\")", 'Servant', '="5678"', '', NOT_ON_FILE_NOTE])
  })

  it('leads with the class for students', () => {
    const m = parseCsv(loginsCsv('students', [{ name: 'Kid', group: '4th', loginId: '1111', pin: '2222' }]))
    expect(m[0]).toEqual(['Class', 'Name', 'ID', 'PIN', 'Note'])
    expect(m[1]).toEqual(['4th', 'Kid', '="1111"', '="2222"', ''])
  })

  it('refuses anything but digits in the text-formula columns', () => {
    expect(() => loginsCsv('servants', [{ name: 'x', group: 'y', loginId: '12a4', pin: null }])).toThrow()
  })
})
