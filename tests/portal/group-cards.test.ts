import { describe, it, expect } from 'vitest'
import { compareKidCards, recentSundays } from '@/lib/portal/group-cards'

/**
 * The child cards on My Group and Class Groups (2026-09-26, Class Groups
 * 2026-10-19): the last few Sundays as dots, and who needs a call first.
 */

describe('recentSundays', () => {
  const held = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']

  it('is the last few Sundays the class held, oldest first', () => {
    const dots = recentSundays({ held, rows: [], since: '2026-01-01', excuses: [], count: 3 })
    expect(dots.map((d) => d.date)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })

  it('reads a Sunday with no mark as missed, and one before they joined as nothing', () => {
    const dots = recentSundays({ held, rows: [{ date: '2026-10-05', status: 'PRESENT' }], since: '2026-09-25', excuses: [], count: 4 })
    expect(dots.map((d) => d.status)).toEqual([null, 'ABSENT', 'PRESENT', 'ABSENT'])
  })

  it('marks the Sundays a follow-up excuse covers, unless they came anyway', () => {
    const dots = recentSundays({
      held,
      rows: [{ date: '2026-10-05', status: 'PRESENT' }],
      since: '2026-01-01',
      excuses: [{ startsOn: '2026-09-28', endsOn: '2026-10-31' }],
      count: 4,
    })
    expect(dots.map((d) => [d.status, d.excused])).toEqual([
      ['ABSENT', false],
      ['ABSENT', true],
      ['PRESENT', false],
      ['ABSENT', true],
    ])
  })
})

describe('compareKidCards', () => {
  const card = (name: string, over: Partial<Parameters<typeof compareKidCards>[0]> = {}) => ({
    name,
    excusedNow: false,
    openCase: false,
    daysSinceContact: 3 as number | null,
    ...over,
  })

  it('puts an open case first, then nobody reached yet, then the longest since a call, and the excused last', () => {
    const cards = [
      card('Excused', { excusedNow: true, openCase: true }),
      card('Recent', { daysSinceContact: 1 }),
      card('Long ago', { daysSinceContact: 40 }),
      card('Never', { daysSinceContact: null }),
      card('Case', { openCase: true }),
    ]
    expect([...cards].sort(compareKidCards).map((c) => c.name)).toEqual(['Case', 'Never', 'Long ago', 'Recent', 'Excused'])
  })

  it('falls back to the name', () => {
    expect([card('Bishoy'), card('Abanoub')].sort(compareKidCards).map((c) => c.name)).toEqual(['Abanoub', 'Bishoy'])
  })
})
