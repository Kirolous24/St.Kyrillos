import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// F0086 — the count-up must never animate a value that has no business counting.
// `countableValue` is module-local to ui.tsx (a server-component module with no
// 'use client'), so the rule is re-implemented here from the same regex and the
// source is asserted to still contain it. If ui.tsx's rule changes and this one
// does not, the last assertion fails rather than this test quietly testing a
// copy that no longer matches.
function countableValue(value: unknown): { to: number; suffix: string } | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) && Math.abs(value) > 1 ? { to: value, suffix: '' } : null
  }
  if (typeof value !== 'string') return null
  const m = /^(-?\d[\d,]*)(%?)$/.exec(value.trim())
  if (!m) return null
  const to = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(to) || Math.abs(to) <= 1) return null
  return { to, suffix: m[2] ?? '' }
}

describe('which stat values count up', () => {
  it('counts plain integers and percentages', () => {
    expect(countableValue(187)).toEqual({ to: 187, suffix: '' })
    expect(countableValue('187')).toEqual({ to: 187, suffix: '' })
    expect(countableValue('82%')).toEqual({ to: 82, suffix: '%' })
    expect(countableValue('1,204')).toEqual({ to: 1204, suffix: '' })
  })

  it('leaves alone everything a tile can hold that is not a number', () => {
    // Every one of these appears on a real tile today.
    expect(countableValue('—')).toBeNull()
    expect(countableValue('#3')).toBeNull()
    expect(countableValue('8 of 10')).toBeNull()
    expect(countableValue('Mina Adel')).toBeNull()
    expect(countableValue(null)).toBeNull()
    expect(countableValue(undefined)).toBeNull()
  })

  it('does not animate 0 or 1, where an animation is a flicker and nothing more', () => {
    expect(countableValue(0)).toBeNull()
    expect(countableValue(1)).toBeNull()
    expect(countableValue('1')).toBeNull()
  })

  it('does not animate a non-integer, which would count through fractions', () => {
    expect(countableValue(82.4)).toBeNull()
  })

  it('still matches the rule ui.tsx actually applies', () => {
    const src = readFileSync(path.resolve(__dirname, '../../components/portal/ui.tsx'), 'utf8')
    expect(src).toContain('function countableValue')
    expect(src).toContain('/^(-?\\d[\\d,]*)(%?)$/')
    expect(src).toContain('Math.abs(value) > 1')
  })

  // This one exists because the first version of CountUp took a `render`
  // function, and `tsc`, `npm test` and `next lint` were all clean while every
  // page carrying a stat tile returned 500: "Functions cannot be passed directly
  // to Client Components" is a runtime rule the type checker cannot see. Only
  // `npm run smoke` caught it. StatCard is on nearly every page, so a repeat
  // takes the whole portal down.
  it('takes only serialisable props, because it is a client component', () => {
    const src = readFileSync(path.resolve(__dirname, '../../components/portal/CountUp.tsx'), 'utf8')
    const signature = /export function CountUp\(\{[^}]*\}: \{([^}]*)\}\)/.exec(src)?.[1] ?? ''
    expect(signature).toBeTruthy()
    // No prop may be a function type: `=>` in the prop list is the giveaway.
    expect(signature).not.toContain('=>')
    expect(signature).toMatch(/value: number/)
  })

  it('renders the final value server-side rather than starting from zero', () => {
    const src = readFileSync(path.resolve(__dirname, '../../components/portal/CountUp.tsx'), 'utf8')
    // useState(value), not useState(0): the markup must carry the real number.
    expect(src).toContain('useState(value)')
    expect(src).toContain('prefers-reduced-motion: reduce')
    expect(src).toContain('data-count-to')
    // And it must arrive even if the frames never do: rAF is throttled hard in a
    // backgrounded tab, and without a timer the tile sits on 0 showing a wrong
    // number for as long as the tab stays hidden.
    expect(src).toContain('setTimeout(() => setShown(value)')
    // And it must not skip its own effect on a Strict Mode remount: the first
    // run zeroes the value and the unmount cancels the animation, so a
    // "have I already run" ref leaves every tile reading 0 for good.
    expect(src).not.toContain('started.current')
  })
})
