import { describe, it, expect } from 'vitest'
import { andList } from '@/lib/portal/format'
import { sessionsToRecord } from '@/lib/portal/attendance-rules'

/**
 * Attendance for several sessions at once (2026-11-01: "Can we make attendance
 * for multiple session? Sometimes vespers & hymns"), for every way attendance
 * is taken. These are the shared rules: which sessions one save covers, and how
 * they are named.
 */
describe('sessionsToRecord', () => {
  it('the session being taken first, then the others once each', () => {
    expect(sessionsToRecord('vespers', ['hymns'])).toEqual(['vespers', 'hymns'])
    expect(sessionsToRecord('vespers', ['hymns', 'vespers', 'hymns', 'tasbeha'])).toEqual(['vespers', 'hymns', 'tasbeha'])
  })

  it('no others is the one session, as before', () => {
    expect(sessionsToRecord('sunday', undefined)).toEqual(['sunday'])
    expect(sessionsToRecord('sunday', [])).toEqual(['sunday'])
  })
})

describe('andList', () => {
  it('names one, two or several', () => {
    expect(andList([])).toBe('')
    expect(andList(['Vespers'])).toBe('Vespers')
    expect(andList(['Vespers', 'Hymns'])).toBe('Vespers and Hymns')
    expect(andList(['Vespers', 'Hymns', 'Tasbeha'])).toBe('Vespers, Hymns and Tasbeha')
  })
})
