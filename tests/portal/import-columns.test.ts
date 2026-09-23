import { describe, it, expect } from 'vitest'
import { studentImportColumns } from '@/lib/portal/import-columns'

/**
 * F0799 — the live data-loss bug. A sheet that does not mention a column must
 * leave that field alone; only "the column is there and the cell is empty"
 * means clear it.
 */
describe('studentImportColumns', () => {
  it('lets a full sheet write every field', () => {
    const plan = studentImportColumns([
      'id', 'first', 'last', 'grade', 'gender', 'dob', 'address',
      'father name', 'father phone', 'mother name', 'mother phone',
      'parent emails', 'email', 'phone', 'notes',
    ])
    expect(plan.namesGiven).toBe(true)
    expect(plan.writableFields).toEqual([
      'gender', 'dob', 'grade', 'address',
      'fatherName', 'fatherPhone', 'motherName', 'motherPhone',
      'parentEmails', 'notes',
    ])
  })

  it('writes nothing but the name when the sheet is only names', () => {
    const plan = studentImportColumns(['id', 'first', 'last'])
    expect(plan.namesGiven).toBe(true)
    // The whole bug: none of these may be written, so none may be nulled.
    expect(plan.writableFields).toEqual([])
    expect(plan.has('address')).toBe(false)
    expect(plan.has('fatherPhone')).toBe(false)
    expect(plan.has('dob')).toBe(false)
    expect(plan.has('notes')).toBe(false)
    expect(plan.changedLabels).toEqual(['name'])
  })

  it('treats a sheet with no name column as corrections only', () => {
    const plan = studentImportColumns(['id', 'father phone', 'mother phone'])
    expect(plan.namesGiven).toBe(false)
    expect(plan.writableFields).toEqual(['fatherPhone', 'motherPhone'])
    expect(plan.changedLabels).toEqual(["father's phone", "mother's phone"])
  })

  it('accepts a header spelled any of its aliases', () => {
    expect(studentImportColumns(['date of birth']).has('dob')).toBe(true)
    expect(studentImportColumns(['birthday']).has('dob')).toBe(true)
    expect(studentImportColumns(['fathername']).has('fatherName')).toBe(true)
    expect(studentImportColumns(['full name']).namesGiven).toBe(true)
    expect(studentImportColumns(['student name']).namesGiven).toBe(true)
  })

  it('does not confuse the student email column with parent emails', () => {
    const student = studentImportColumns(['email'])
    expect(student.has('email')).toBe(true)
    expect(student.has('parentEmails')).toBe(false)

    const parents = studentImportColumns(['parent emails'])
    expect(parents.has('parentEmails')).toBe(true)
    expect(parents.has('email')).toBe(false)
  })

  it('names in the preview exactly the fields it will write', () => {
    const plan = studentImportColumns(['id', 'address'])
    expect(plan.changedLabels).toEqual(['address'])
  })

  it('reports nothing to change for a sheet of IDs alone', () => {
    const plan = studentImportColumns(['id'])
    expect(plan.namesGiven).toBe(false)
    expect(plan.writableFields).toEqual([])
    expect(plan.changedLabels).toEqual([])
  })
})
