import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Option B keeps an encrypted copy of every PIN the portal issues, and never of
 * a PIN somebody chose. That only holds if no write path can skip the choice,
 * so pinHash may be written in exactly one file, lib/portal/pin-issue.ts, whose
 * two helpers force it. Reading the source is deliberate: the invariant is about
 * where the code is allowed to touch these columns, not about any one path.
 */
const REPO = path.resolve(__dirname, '../..')
const ROOTS = ['app', 'lib', 'components', 'scripts']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|mjs|js)$/.test(entry)) out.push(full)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(path.join(REPO, r)))
const rel = (f: string) => path.relative(REPO, f).split(path.sep).join('/')
const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length

describe('PIN storage', () => {
  it('writes pinHash only through lib/portal/pin-issue.ts', () => {
    // `pinHash: <value>` other than a select (`true`) or a type (`string`), or
    // the shorthand `{ ..., pinHash }`. The whitespace sits inside the
    // lookahead: outside it, `\s*` backtracks and `pinHash: true` would match.
    const WRITE = /pinHash\s*:(?!\s*(?:true|string)\b)|[{,]\s*pinHash\s*(?=[,}])/g
    // A read that has to name the column (a `where` filter, an argument to a
    // pure function) says so on its own line, so every exception is visible in
    // review rather than a whole file being waved through.
    const MARKER = 'pin-guard: not a write'
    const offenders: string[] = []
    for (const file of files) {
      if (rel(file) === 'lib/portal/pin-issue.ts') continue
      const src = readFileSync(file, 'utf8')
      const lines = src.split('\n')
      for (const m of Array.from(src.matchAll(WRITE))) {
        const line = lineOf(src, m.index ?? 0)
        if (lines[line - 1]?.includes(MARKER)) continue
        offenders.push(`${rel(file)}:${line}`)
      }
    }
    expect(offenders, `write PINs with issuedPinFields/selfSetPinFields instead:\n${offenders.join('\n')}`).toEqual([])
  })

  it('touches pinSealed only in the vault, the issuer and the admin logins code', () => {
    const allowed = new Set([
      'lib/portal/pin-vault.ts',
      'lib/portal/pin-issue.ts',
      'lib/portal/actions/logins.ts',
      'lib/portal/data/logins.ts',
    ])
    const offenders: string[] = []
    for (const file of files) {
      if (allowed.has(rel(file))) continue
      const src = readFileSync(file, 'utf8')
      for (const m of Array.from(src.matchAll(/\bpinSealed\b/g))) offenders.push(`${rel(file)}:${lineOf(src, m.index ?? 0)}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('keeps the JSON backup free of PIN fields', () => {
    const src = readFileSync(path.join(REPO, 'lib/portal/actions/data-tools.ts'), 'utf8')
    const start = src.indexOf('export async function buildBackup')
    const end = src.indexOf('export async function', start + 10)
    expect(start).toBeGreaterThan(-1)
    expect(src.slice(start, end)).not.toMatch(/pinHash\s*:\s*true|pinSealed/)
  })
})
