import { describe, it, expect } from 'vitest'
import { DEDUCTION_POINTS, resolveManualPoints } from '@/lib/portal/points-math'

// Points are the same in every class (2026-09-27): Give uses one church-wide
// activity at the value the admin set; Remove always costs the same, for any
// reason. Nothing typed on the page decides an amount.
const homework = { classId: null, isActive: true, points: 2, key: 'homework', label: 'Homework' }

describe('giving points', () => {
  it('gives a church-wide activity at its set value', () => {
    expect(resolveManualPoints('add', homework)).toEqual({ ok: true, points: 2, activityKey: 'homework', label: 'Homework', reason: null })
  })
  it('keeps an optional note', () => {
    expect(resolveManualPoints('add', homework, '  Luke 2  ')).toMatchObject({ ok: true, reason: 'Luke 2' })
  })
  it('refuses anything that is not an active church-wide activity', () => {
    expect(resolveManualPoints('add', null)).toMatchObject({ ok: false })
    expect(resolveManualPoints('add', { ...homework, isActive: false })).toMatchObject({ ok: false })
    expect(resolveManualPoints('add', { ...homework, classId: 'kg' })).toMatchObject({ ok: false })
    expect(resolveManualPoints('add', { ...homework, points: 0 })).toMatchObject({ ok: false })
  })
})

describe('taking points away', () => {
  it('always costs the same, in every class', () => {
    expect(DEDUCTION_POINTS).toBe(2)
    expect(resolveManualPoints('remove', null, 'Being late')).toEqual({ ok: true, points: -2, activityKey: 'manual_remove', label: 'Being late', reason: null })
  })
  it('ignores any activity: the amount never comes from the page', () => {
    expect(resolveManualPoints('remove', { ...homework, points: 50 }, 'Misbehaving')).toMatchObject({ ok: true, points: -2 })
  })
  it('needs a reason', () => {
    expect(resolveManualPoints('remove', null, '   ')).toMatchObject({ ok: false })
    expect(resolveManualPoints('remove', null)).toMatchObject({ ok: false })
  })
  it('keeps a long reason whole, with a short label for the ledger', () => {
    const long = 'x'.repeat(120)
    expect(resolveManualPoints('remove', null, long)).toMatchObject({ ok: true, label: 'x'.repeat(80), reason: long })
  })
})
