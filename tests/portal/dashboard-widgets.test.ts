import { describe, it, expect } from 'vitest'
import { timeAgo } from '@/lib/portal/format'
import { topQuizPerformers, attendanceDelta } from '@/lib/portal/reports'

const NOW = new Date('2026-09-22T12:00:00Z')

describe('timeAgo', () => {
  it('says "just now" under a minute', () => {
    expect(timeAgo(new Date('2026-09-22T11:59:40Z'), NOW)).toBe('just now')
  })

  it('counts minutes, then hours, then days', () => {
    expect(timeAgo(new Date('2026-09-22T11:35:00Z'), NOW)).toBe('25m ago')
    expect(timeAgo(new Date('2026-09-22T06:00:00Z'), NOW)).toBe('6h ago')
    expect(timeAgo(new Date('2026-09-19T12:00:00Z'), NOW)).toBe('3d ago')
  })

  it('falls back to a date once a week has passed', () => {
    expect(timeAgo(new Date('2026-09-01T12:00:00Z'), NOW)).toBe('Sep 1')
  })

  it('never reads as the future when a clock skews forward', () => {
    expect(timeAgo(new Date('2026-09-22T12:00:30Z'), NOW)).toBe('just now')
  })
})

describe('topQuizPerformers', () => {
  const rows = [
    { studentId: 'a', name: 'Anba', percentage: 92 },
    { studentId: 'a', name: 'Anba', percentage: 88 },
    { studentId: 'b', name: 'Bishoy', percentage: 100 },
    { studentId: 'c', name: 'Carol', percentage: 85 },
    { studentId: 'c', name: 'Carol', percentage: 85 },
    { studentId: 'c', name: 'Carol', percentage: 85 },
    { studentId: 'd', name: 'Demiana', percentage: 85 },
    { studentId: 'd', name: 'Demiana', percentage: 85 },
  ]

  it('drops anyone with fewer than two quizzes, so one lucky score cannot top the list', () => {
    const top = topQuizPerformers(rows)
    expect(top.map((t) => t.name)).not.toContain('Bishoy')
  })

  it('ranks by mean percentage', () => {
    expect(topQuizPerformers(rows)[0]).toMatchObject({ name: 'Anba', average: 90, count: 2 })
  })

  it('breaks a tie with the number of quizzes sat', () => {
    const names = topQuizPerformers(rows).map((t) => t.name)
    expect(names.indexOf('Carol')).toBeLessThan(names.indexOf('Demiana'))
  })

  it('returns at most four', () => {
    const many = Array.from({ length: 20 }, (_, i) => [
      { studentId: `s${i}`, name: `S${i}`, percentage: 50 + i },
      { studentId: `s${i}`, name: `S${i}`, percentage: 50 + i },
    ]).flat()
    expect(topQuizPerformers(many)).toHaveLength(4)
  })

  it('ignores a null percentage rather than scoring it as zero', () => {
    const withNull = [
      { studentId: 'a', name: 'Anba', percentage: 90 },
      { studentId: 'a', name: 'Anba', percentage: null },
      { studentId: 'a', name: 'Anba', percentage: 80 },
    ]
    expect(topQuizPerformers(withNull)[0]).toMatchObject({ average: 85, count: 2 })
  })
})

describe('attendanceDelta', () => {
  it('compares the last session with the one before it', () => {
    expect(attendanceDelta([{ date: '2026-09-06', rate: 60 }, { date: '2026-09-13', rate: 75 }])).toBe(15)
  })

  it('is null when there is nothing to compare against', () => {
    expect(attendanceDelta([{ date: '2026-09-13', rate: 75 }])).toBeNull()
    expect(attendanceDelta([])).toBeNull()
  })

  it('skips a session whose rate could not be scored', () => {
    expect(
      attendanceDelta([{ date: '2026-09-06', rate: 60 }, { date: '2026-09-13', rate: null }, { date: '2026-09-20', rate: 50 }]),
    ).toBe(-10)
  })
})
