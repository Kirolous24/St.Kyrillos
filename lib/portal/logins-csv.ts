import { escapeCsvField } from './csv'

/**
 * The admin's ID + PIN export (option B).
 *
 * A PIN like 0042 opened in Excel becomes 42, and a family handed "42" cannot
 * sign in. So the ID and PIN columns are written as ="0042", which Excel,
 * Numbers and Google Sheets all show as the digits. That is a formula, which
 * the portal's CSVs otherwise neutralise; it is safe here only because the
 * value is checked to be digits first. Every other cell goes through
 * escapeCsvField as usual.
 */

export const NOT_ON_FILE_NOTE = 'Not on file — reissue to see it'

export interface LoginRow {
  name: string
  group: string
  loginId: string
  pin: string | null
}

function digitsCell(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error('Only digits may be written as a text formula')
  return `"=""${value}"""`
}

export function loginsCsv(kind: 'servants' | 'students', rows: readonly LoginRow[]): string {
  const header = kind === 'servants' ? ['Name', 'Role', 'ID', 'PIN', 'Note'] : ['Class', 'Name', 'ID', 'PIN', 'Note']
  const lines = [header.map(escapeCsvField).join(',')]
  for (const r of rows) {
    const lead = kind === 'servants' ? [r.name, r.group] : [r.group, r.name]
    lines.push(
      [
        ...lead.map(escapeCsvField),
        digitsCell(r.loginId),
        r.pin ? digitsCell(r.pin) : '',
        escapeCsvField(r.pin ? '' : NOT_ON_FILE_NOTE),
      ].join(','),
    )
  }
  return lines.join('\r\n')
}
