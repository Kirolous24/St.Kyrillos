import { parseCsv } from './csv'
import { LOGIN_ID_RE, PIN_RE } from './login'

/**
 * One-time recovery of the PINs people already use (option B).
 *
 * Nearly every PIN in the portal came from the old app's export, which still
 * holds them in plain text. Given that file as id,pin rows, the server seals a
 * PIN only when it still matches the stored hash. So this can never change
 * anybody's PIN, and never stores a wrong one.
 */

export interface RecoveryRow {
  loginId: string
  pin: string
}

export type RecoveryOutcome = 'sealed' | 'already' | 'changed' | 'unknown'

/** Our own export writes ="0042" so spreadsheets keep the zero; read it back as 0042. */
function cell(raw: string | undefined): string {
  const v = (raw ?? '').trim()
  const m = /^="(.*)"$/.exec(v)
  return (m ? m[1]! : v).trim()
}

export function parseRecoveryCsv(text: string): { rows: RecoveryRow[]; skipped: number } {
  const matrix = parseCsv(text).filter((r) => r.some((c) => c.trim()))
  if (matrix.length === 0) return { rows: [], skipped: 0 }
  const header = matrix[0]!.map((c) => c.trim().toLowerCase())
  let idCol = header.findIndex((h) => h === 'id' || h === 'login id' || h === 'loginid')
  let pinCol = header.findIndex((h) => h === 'pin')
  let body = matrix.slice(1)
  if (idCol === -1 || pinCol === -1) {
    idCol = 0
    pinCol = 1
    body = matrix
  }
  const rows: RecoveryRow[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const r of body) {
    const loginId = cell(r[idCol])
    const pin = cell(r[pinCol])
    if (!LOGIN_ID_RE.test(loginId) || !PIN_RE.test(pin) || seen.has(loginId)) {
      skipped++
      continue
    }
    seen.add(loginId)
    rows.push({ loginId, pin })
  }
  return { rows, skipped }
}

export async function classifyRecovery(
  row: RecoveryRow,
  account: { pinHash: string; hasSealed: boolean } | undefined,
  compare: (pin: string, hash: string) => Promise<boolean>,
): Promise<RecoveryOutcome> {
  if (!account) return 'unknown'
  if (account.hasSealed) return 'already'
  return (await compare(row.pin, account.pinHash)) ? 'sealed' : 'changed'
}
