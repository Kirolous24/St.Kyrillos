import { describe, it, expect } from 'vitest'
import { rankStudents, canUndo, capDeduction } from '@/lib/portal/points-math'

describe('rankStudents', () => {
  it('orders by total desc then name, sharing rank on ties', () => {
    const rows = rankStudents([
      { studentId: 'a', name: 'Zed', total: 10 },
      { studentId: 'b', name: 'Amy', total: 12 },
      { studentId: 'c', name: 'Bob', total: 10 },
      { studentId: 'd', name: 'Cal', total: 0 },
    ])
    expect(rows.map((r) => [r.studentId, r.rank])).toEqual([['b', 1], ['c', 2], ['a', 2], ['d', 4]])
  })
})

describe('canUndo', () => {
  const entry = { source: 'MANUAL' as const, undone: false, undoOfId: null }
  it('allows undoing a live manual entry', () => {
    expect(canUndo(entry)).toBe(true)
  })
  it('refuses entries already undone, undo entries themselves, and attendance-linked entries', () => {
    expect(canUndo({ ...entry, undone: true })).toBe(false)
    expect(canUndo({ ...entry, source: 'UNDO', undoOfId: 'x' })).toBe(false)
    expect(canUndo({ ...entry, source: 'ATTENDANCE' })).toBe(false)
  })
})

describe('capDeduction', () => {
  it('clamps a single deduction at the balance', () => {
    expect(capDeduction(-50, 6)).toBe(-6)
    expect(capDeduction(-4, 6)).toBe(-4)
    expect(capDeduction(-6, 6)).toBe(-6)
  })
  it('writes nothing when there is nothing left to take', () => {
    expect(capDeduction(-50, 0)).toBe(0)
    expect(capDeduction(-50, -3)).toBe(0)
  })
  it('never touches an award', () => {
    expect(capDeduction(10, 0)).toBe(10)
  })
})
