import { describe, it, expect } from 'vitest'
import { DEDUCTION_POINTS, resolveManualPoints } from '@/lib/portal/points-math'

// Give uses an activity at its set value: one every class has, or one of the
// class's own (2026-09-28: classes may count their own way again). Remove
// always costs the same, for any reason. Nothing typed on the page decides an
// amount.
const homework = { classId: null, isActive: true, points: 2, key: 'homework', label: 'Homework' }
const choirs = { classId: '7th-8th-boys', isActive: true, points: 5, key: 'choirs', label: 'Choirs' }

describe('giving points', () => {
  it('gives a church-wide activity at its set value', () => {
    expect(resolveManualPoints('add', homework, undefined, 'kg')).toEqual({ ok: true, points: 2, activityKey: 'homework', label: 'Homework', reason: null })
  })
  it("gives the class's own activity at the value the class set", () => {
    expect(resolveManualPoints('add', choirs, undefined, '7th-8th-boys')).toMatchObject({ ok: true, points: 5, activityKey: 'choirs' })
  })
  it("never another class's activity", () => {
    expect(resolveManualPoints('add', choirs, undefined, 'kg')).toMatchObject({ ok: false })
  })
  it('keeps an optional note', () => {
    expect(resolveManualPoints('add', homework, '  Luke 2  ', 'kg')).toMatchObject({ ok: true, reason: 'Luke 2' })
  })
  it('refuses anything that is not an active activity worth something', () => {
    expect(resolveManualPoints('add', null, undefined, 'kg')).toMatchObject({ ok: false })
    expect(resolveManualPoints('add', { ...homework, isActive: false }, undefined, 'kg')).toMatchObject({ ok: false })
    expect(resolveManualPoints('add', { ...homework, points: 0 }, undefined, 'kg')).toMatchObject({ ok: false })
  })
})

describe('taking points away', () => {
  it('always costs the same, in every class', () => {
    expect(DEDUCTION_POINTS).toBe(2)
    expect(resolveManualPoints('remove', null, 'Being late', 'kg')).toEqual({ ok: true, points: -2, activityKey: 'manual_remove', label: 'Being late', reason: null })
  })
  it('ignores any activity: the amount never comes from the page', () => {
    expect(resolveManualPoints('remove', { ...homework, points: 50 }, 'Misbehaving', 'kg')).toMatchObject({ ok: true, points: -2 })
  })
  it('needs a reason', () => {
    expect(resolveManualPoints('remove', null, '   ', 'kg')).toMatchObject({ ok: false })
    expect(resolveManualPoints('remove', null, undefined, 'kg')).toMatchObject({ ok: false })
  })
  it('keeps a long reason whole, with a short label for the ledger', () => {
    const long = 'x'.repeat(120)
    expect(resolveManualPoints('remove', null, long, 'kg')).toMatchObject({ ok: true, label: 'x'.repeat(80), reason: long })
  })
})
