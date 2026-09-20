import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Next.js requires every export of a "use server" module to be an async
 * function. Anything else — a Zod schema, a constant, a class — throws
 * "A 'use server' file can only export async functions" the moment any
 * action in that file is invoked, taking every other action down with it.
 *
 * Nothing catches this at build time: tsc is happy, `next build` is happy,
 * and a GET-only smoke test never triggers it. It only surfaces when a user
 * submits the form, as a 500 behind the error boundary. Hence this guard.
 */
const ROOTS = ['app', 'lib', 'components']
const ILLEGAL = /^export\s+(?!type\b|interface\b|default\b)(const|let|var|class|function)\s+(\w+)/gm

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('"use server" modules', () => {
  it('export only async functions', () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8')
        if (!/^\s*['"]use server['"]/m.test(src.slice(0, 200))) continue
        ILLEGAL.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = ILLEGAL.exec(src)) !== null) {
          const tail = src.slice(m.index, m.index + 220)
          if (/^export\s+async\s+function/.test(tail)) continue
          if (m[1] === 'const' && /=\s*async\s*\(/.test(tail)) continue
          offenders.push(`${file}:${src.slice(0, m.index).split('\n').length} — export ${m[1]} ${m[2]}`)
        }
      }
    }
    expect(offenders, `move these out of the "use server" file:\n${offenders.join('\n')}`).toEqual([])
  })
})
