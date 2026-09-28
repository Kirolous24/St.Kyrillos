import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isFutureWeek, selfMarkNeighbours, selfMarkWeek } from '@/lib/portal/self-mark'

// 2026-09-28 — a servant could only ever mark this week on My Attendance.
const thisWeek = '2026-09-28'
const oldest = '2026-04-06'

describe('the week a servant marks themselves for', () => {
  it('is this week unless another is asked for', () => {
    expect(selfMarkWeek(undefined, thisWeek, oldest)).toBe(thisWeek)
    expect(selfMarkWeek('not a date', thisWeek, oldest)).toBe(thisWeek)
  })
  it('can be any past week the page shows, by any day in it', () => {
    expect(selfMarkWeek('2026-09-21', thisWeek, oldest)).toBe('2026-09-21')
    expect(selfMarkWeek('2026-09-27', thisWeek, oldest)).toBe('2026-09-21') // that Sunday
  })
  it('never a week that has not started, nor one older than the page shows', () => {
    expect(selfMarkWeek('2026-10-12', thisWeek, oldest)).toBe(thisWeek)
    expect(selfMarkWeek('2025-01-05', thisWeek, oldest)).toBe(oldest)
  })
  it('steps back and forward, stopping at both ends', () => {
    expect(selfMarkNeighbours(thisWeek, thisWeek, oldest)).toEqual({ prev: '2026-09-21', next: null })
    expect(selfMarkNeighbours('2026-09-21', thisWeek, oldest)).toEqual({ prev: '2026-09-14', next: thisWeek })
    expect(selfMarkNeighbours(oldest, thisWeek, oldest)).toEqual({ prev: null, next: '2026-04-13' })
  })
})

describe('the server', () => {
  it('knows a week that has not begun', () => {
    expect(isFutureWeek('2026-10-05', '2026-09-28')).toBe(true)
    expect(isFutureWeek('2026-09-28', '2026-10-04')).toBe(false)
    expect(isFutureWeek('2026-09-21', '2026-09-28')).toBe(false)
  })
  it('refuses to record one', () => {
    const source = readFileSync(path.resolve(__dirname, '../../lib/portal/actions/servant-attendance.ts'), 'utf8')
    const body = source.slice(source.indexOf('export async function markMyServantAttendance('))
    expect(body.indexOf('isFutureWeek(weekStart')).toBeGreaterThan(-1)
    expect(body.indexOf('isFutureWeek(weekStart')).toBeLessThan(body.indexOf('prisma.servantAttendance.upsert'))
  })
})
