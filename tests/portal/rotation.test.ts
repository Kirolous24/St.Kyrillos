import { describe, it, expect } from 'vitest'
import { assignMinCost, defaultRotationRoles, planRotation, rotationSundays, type RotationCell, type RotationRole } from '@/lib/portal/rotation'
import { addDays } from '@/lib/portal/dates'

/**
 * The Schedule's rotation (2026-11-01): a coordinator fills a month or a
 * semester of Sunday parts at once, "randomly and evenly … without repeating
 * assignments until every servant has been able to do it once".
 */

/** A seeded generator, so a plan can be checked twice. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = '2026-11-02' // a Monday
const weeks = (n: number, from = FIRST) => Array.from({ length: n }, (_, i) => addDays(from, 7 * i))
const TEN: RotationRole[] = ['agpeya', 'song', 'seasons', 'lesson', 'bibleStudy', 'coptic', 'ritual', 'verse', 'memorization', 'saint']

const who = (cells: RotationCell[], week: string, role: RotationRole) => cells.find((c) => c.weekStart === week && c.role === role)?.servantId
const sequence = (cells: RotationCell[], ws: string[], role: RotationRole) => ws.map((w) => who(cells, w, role))
const perSunday = (cells: RotationCell[], week: string, servant: string) => cells.filter((c) => c.weekStart === week && c.servantId === servant).length
const totals = (cells: RotationCell[], servants: string[]) => servants.map((s) => cells.filter((c) => c.servantId === s).length)

describe('assignMinCost — the cheapest way to give each row its own column', () => {
  it('finds the cheapest assignment', () => {
    const cols = assignMinCost([
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ])
    expect(cols).toEqual([1, 0, 2])
  })

  it('works with more columns than rows, and never gives two rows one column', () => {
    const cols = assignMinCost([
      [9, 1, 9, 9],
      [9, 1, 2, 9],
    ])
    expect(cols).toEqual([1, 2])
  })
})

describe('planRotation', () => {
  it('fills every chosen part of every Sunday, with servants from the rotation only', () => {
    const ws = weeks(4)
    const { cells } = planRotation({ weeks: ws, roles: ['lesson', 'song', 'coptic'], servants: ['a', 'b', 'c', 'd'], kept: [], history: [], random: seeded(1) })
    expect(cells).toHaveLength(12)
    for (const w of ws) for (const r of ['lesson', 'song', 'coptic'] as const) expect(who(cells, w, r)).toBeDefined()
    expect(new Set(cells.map((c) => c.servantId))).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('nobody does a part again until everyone in the rotation has done it once', () => {
    const ws = weeks(9)
    const { cells, repeats } = planRotation({ weeks: ws, roles: ['lesson'], servants: ['a', 'b', 'c'], kept: [], history: [], random: seeded(2) })
    const seq = sequence(cells, ws, 'lesson')
    for (let i = 0; i < 9; i += 3) expect(new Set(seq.slice(i, i + 3))).toEqual(new Set(['a', 'b', 'c']))
    expect(repeats).toBe(0)
  })

  it('holds for all ten parts with four servants, with no early repeats at all', () => {
    for (const seed of [3, 4, 5, 6]) {
      const ws = weeks(8)
      const servants = ['a', 'b', 'c', 'd']
      const { cells, repeats } = planRotation({ weeks: ws, roles: TEN, servants, kept: [], history: [], random: seeded(seed) })
      expect(repeats).toBe(0)
      for (const role of TEN) {
        const seq = sequence(cells, ws, role)
        expect(new Set(seq.slice(0, 4))).toEqual(new Set(servants))
        expect(new Set(seq.slice(4, 8))).toEqual(new Set(servants))
      }
    }
  })

  it('spreads the parts evenly: over the range and on each Sunday', () => {
    const ws = weeks(8)
    const servants = ['a', 'b', 'c', 'd']
    const { cells } = planRotation({ weeks: ws, roles: TEN, servants, kept: [], history: [], random: seeded(7) })
    const t = totals(cells, servants)
    expect(Math.max(...t) - Math.min(...t)).toBeLessThanOrEqual(1)
    for (const w of ws) for (const s of servants) expect(perSunday(cells, w, s)).toBeLessThanOrEqual(3)
  })

  it('with as many servants as parts, each servant has one part a Sunday and does each part once', () => {
    const roles: RotationRole[] = ['lesson', 'song', 'coptic', 'verse', 'saint']
    const servants = ['a', 'b', 'c', 'd', 'e']
    const ws = weeks(5)
    const { cells, repeats } = planRotation({ weeks: ws, roles, servants, kept: [], history: [], random: seeded(8) })
    expect(repeats).toBe(0)
    for (const w of ws) for (const s of servants) expect(perSunday(cells, w, s)).toBe(1)
    for (const r of roles) expect(new Set(sequence(cells, ws, r))).toEqual(new Set(servants))
  })

  it('picks up the rotation from the weeks before the range', () => {
    const ws = weeks(2)
    const history: RotationCell[] = [{ weekStart: addDays(FIRST, -7), role: 'lesson', servantId: 'b' }]
    for (const seed of [9, 10, 11, 12]) {
      const { cells } = planRotation({ weeks: ws, roles: ['lesson'], servants: ['a', 'b', 'c'], kept: [], history, random: seeded(seed) })
      expect(sequence(cells, ws, 'lesson')).not.toContain('b')
    }
  })

  it('keeps what is already assigned, and counts it toward the rotation', () => {
    const ws = weeks(3)
    const kept: RotationCell[] = [{ weekStart: ws[0]!, role: 'lesson', servantId: 'a' }]
    const { cells } = planRotation({ weeks: ws, roles: ['lesson'], servants: ['a', 'b', 'c'], kept, history: [], random: seeded(13) })
    expect(who(cells, ws[0]!, 'lesson')).toBeUndefined()
    expect(new Set(sequence(cells, ws.slice(1), 'lesson'))).toEqual(new Set(['b', 'c']))
  })

  it('counts kept parts toward that Sunday’s load', () => {
    const [w] = weeks(1)
    const kept: RotationCell[] = [
      { weekStart: w!, role: 'agpeya', servantId: 'a' },
      { weekStart: w!, role: 'saint', servantId: 'a' },
    ]
    const { cells } = planRotation({ weeks: [w!], roles: ['lesson', 'song', 'coptic', 'verse'], servants: ['a', 'b'], kept, history: [], random: seeded(14) })
    expect(perSunday(cells, w!, 'a')).toBe(1)
    expect(perSunday(cells, w!, 'b')).toBe(3)
  })

  it('gives Lead and Backup to two different servants, each in turn', () => {
    const ws = weeks(6)
    const { cells, repeats } = planRotation({ weeks: ws, roles: ['lead', 'backup'], servants: ['a', 'b', 'c'], kept: [], history: [], random: seeded(15) })
    for (const w of ws) expect(who(cells, w, 'lead')).not.toBe(who(cells, w, 'backup'))
    for (const role of ['lead', 'backup'] as const) {
      const seq = sequence(cells, ws, role)
      expect(new Set(seq.slice(0, 3))).toEqual(new Set(['a', 'b', 'c']))
      expect(new Set(seq.slice(3, 6))).toEqual(new Set(['a', 'b', 'c']))
    }
    expect(repeats).toBe(0)
  })

  it('leaves Backup empty when only one servant is in the rotation', () => {
    const ws = weeks(2)
    const { cells } = planRotation({ weeks: ws, roles: ['lead', 'backup'], servants: ['a'], kept: [], history: [], random: seeded(16) })
    expect(cells.filter((c) => c.role === 'lead')).toHaveLength(2)
    expect(cells.filter((c) => c.role === 'backup')).toHaveLength(0)
  })

  it('does not give a servant the same part two Sundays running when a new round starts', () => {
    const ws = weeks(8)
    for (const seed of [17, 18, 19]) {
      const { cells } = planRotation({ weeks: ws, roles: ['lesson'], servants: ['a', 'b'], kept: [], history: [], random: seeded(seed) })
      const seq = sequence(cells, ws, 'lesson')
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
    }
  })

  it('is random, and repeatable from the same seed', () => {
    const input = { weeks: weeks(4), roles: TEN, servants: ['a', 'b', 'c', 'd', 'e'], kept: [], history: [] }
    const one = planRotation({ ...input, random: seeded(20) }).cells
    expect(planRotation({ ...input, random: seeded(20) }).cells).toEqual(one)
    const others = [21, 22, 23].map((s) => JSON.stringify(planRotation({ ...input, random: seeded(s) }).cells))
    expect(others.some((o) => o !== JSON.stringify(one))).toBe(true)
  })

  it('uses nobody outside the rotation, even someone kept on another part', () => {
    const ws = weeks(3)
    const kept: RotationCell[] = [{ weekStart: ws[0]!, role: 'saint', servantId: 'x' }]
    const { cells } = planRotation({ weeks: ws, roles: ['lesson', 'song'], servants: ['a', 'b'], kept, history: [], random: seeded(24) })
    expect(cells.some((c) => c.servantId === 'x')).toBe(false)
  })

  it('makes nothing without servants or parts', () => {
    expect(planRotation({ weeks: weeks(2), roles: ['lesson'], servants: [], kept: [], history: [] }).cells).toEqual([])
    expect(planRotation({ weeks: weeks(2), roles: [], servants: ['a'], kept: [], history: [] }).cells).toEqual([])
  })
})

describe('rotationSundays — the Sundays a rotation fills', () => {
  it('starts at the coming Sunday: never today, never the past', () => {
    expect(rotationSundays('2026-11-01', '2026-11-30', '2026-11-01')).toEqual({
      sundays: ['2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'],
      clipped: true,
    })
    expect(rotationSundays('2026-11-01', '2026-11-08', '2026-10-31')).toEqual({ sundays: ['2026-11-01', '2026-11-08'], clipped: false })
  })

  it('takes every Sunday between the two days', () => {
    const r = rotationSundays('2026-11-15', '2026-12-31', '2026-11-03')
    expect('sundays' in r && r.sundays).toEqual(['2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27'])
  })

  it('says why when there is nothing to fill', () => {
    expect(rotationSundays('2026-12-01', '2026-11-01', '2026-10-01')).toEqual({ error: 'The last Sunday is before the first.' })
    expect(rotationSundays('2026-10-01', '2026-10-31', '2026-11-01')).toEqual({ error: 'There are no Sundays left to fill between those days.' })
    expect(rotationSundays('nope', '2026-10-31', '2026-11-01')).toEqual({ error: 'Pick the first and last Sunday.' })
  })

  it('fills at most 30 Sundays at a time', () => {
    expect(rotationSundays('2026-11-08', '2027-05-30', '2026-11-01')).toEqual({ sundays: expect.any(Array), clipped: false })
    expect(rotationSundays('2026-11-08', '2027-06-06', '2026-11-01')).toEqual({ error: 'That is 31 Sundays. Fill 30 or fewer at a time.' })
  })
})

describe('defaultRotationRoles — the parts ticked to begin with', () => {
  const at = (role: RotationRole): RotationCell => ({ weekStart: FIRST, role, servantId: 'a' })

  it('all ten parts for a class that has given none out lately, and not Lead or Backup', () => {
    expect(defaultRotationRoles([])).toEqual(TEN)
  })

  it('the parts and duties the class has given out lately, in running order', () => {
    expect(defaultRotationRoles([at('lesson'), at('lead'), at('song'), at('lesson')])).toEqual(['song', 'lesson', 'lead'])
  })

  it('a class that only names a Lead still gets all ten parts, and its Lead', () => {
    expect(defaultRotationRoles([at('lead')])).toEqual([...TEN, 'lead'])
  })
})
