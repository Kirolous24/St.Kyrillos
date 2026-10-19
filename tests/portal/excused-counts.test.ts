import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { dueCaseWhere, excusedCaseWhere, excusedOnWhere } from '@/lib/portal/data/excuses'

/**
 * An excused child is not a call anybody owes (2026-10-19). Every count of
 * open cases — the sidebar badge, the bell, the dashboard, the class digest,
 * the Follow-ups page — must leave them out, or a badge says 12 over a list
 * whose two excused children nobody is meant to ring.
 */

const ROOT = path.resolve(__dirname, '../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.') || / \d+(\.|$)/.test(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

// Counts that are not "waiting on a call": the backup and the end-of-year
// reset count every case there is.
const NOT_A_WORKLOAD = new Set(['lib/portal/actions/data-tools.ts'])

/** The whole call starting at `from`, up to its closing parenthesis. */
function callAt(src: string, from: number): string {
  let depth = 0
  for (let i = src.indexOf('(', from); i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return src.slice(from, i + 1)
  }
  return src.slice(from)
}

describe('every count of open cases leaves excused children out', () => {
  const sites: Array<{ file: string; call: string }> = []
  for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))]) {
    const rel = path.relative(ROOT, file)
    if (NOT_A_WORKLOAD.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    const re = /followUpCase\.(count|groupBy)\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      const call = callAt(src, m.index)
      if (/'OPEN'/.test(call)) sites.push({ file: rel, call })
    }
  }

  it('finds the counts', () => {
    expect(sites.length).toBeGreaterThanOrEqual(6)
  })

  for (const { file, call } of sites) {
    it(`${file}: ${call.slice(0, 60).replace(/\s+/g, ' ')}…`, () => {
      expect(call).toMatch(/dueCaseWhere\(|excusedCaseWhere\(/)
    })
  }

  it('Who is following up counts only cases that are due', () => {
    const groups = readFileSync(path.join(ROOT, 'lib/portal/data/groups.ts'), 'utf8')
    const summaries = groups.slice(groups.indexOf('export async function groupSummaries('))
    expect(summaries).toMatch(/dueCaseWhere\(/)
  })
})

describe('the where-clauses', () => {
  it('an excuse covers its first and last day', () => {
    expect(excusedOnWhere('2026-10-25')).toEqual({
      startsOn: { lte: new Date('2026-10-25T00:00:00.000Z') },
      endsOn: { gte: new Date('2026-10-25T00:00:00.000Z') },
    })
  })

  it('due and excused are the two halves of the same question', () => {
    expect(dueCaseWhere('2026-10-25')).toEqual({ student: { followUpExcuses: { none: excusedOnWhere('2026-10-25') } } })
    expect(excusedCaseWhere('2026-10-25')).toEqual({ student: { followUpExcuses: { some: excusedOnWhere('2026-10-25') } } })
  })
})
