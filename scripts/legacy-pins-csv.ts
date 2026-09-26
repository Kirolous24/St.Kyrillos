/**
 * Write the old app's IDs and PINs as a two-column CSV for Admin → Data →
 * IDs & PINs → Recover. Reads the gitignored Firebase export. It prints counts
 * and never prints a PIN; the file it writes is mode 600 and should be deleted
 * once uploaded.
 *
 *   node --import tsx scripts/legacy-pins-csv.ts <backup.json> <out.csv>
 */
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { transformBackup, type BackupJson } from '../lib/portal/import-transform'

const [file, out] = process.argv.slice(2)
if (!file || !out) {
  console.error('usage: legacy-pins-csv.ts <backup.json> <out.csv>')
  process.exit(1)
}
const result = transformBackup(JSON.parse(readFileSync(file, 'utf8')) as BackupJson)
const lines = result.accounts.filter((a) => a.loginId && a.pin).map((a) => `${a.loginId},${a.pin}`)
writeFileSync(out, `id,pin\n${lines.join('\n')}\n`, { mode: 0o600 })
chmodSync(out, 0o600)
console.log(`Wrote ${lines.length} rows to ${out} (mode 600). Delete it after the upload.`)
