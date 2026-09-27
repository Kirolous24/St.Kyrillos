import { describe, it, expect } from 'vitest'
import { classImportRowProblem, findDuplicateStudent, studentNameKey } from '@/lib/portal/student-dupes'

describe('the same child, whatever the spelling', () => {
  it('ignores case, spacing and the usual spelling swaps', () => {
    expect(studentNameKey('Kirollos', 'Sargyous')).toBe(studentNameKey('kirolos', 'SARGIOUS'))
    expect(studentNameKey('Christina', 'Youssef')).toBe(studentNameKey('Kristina', 'Yousef'))
    expect(studentNameKey('Philopater', 'Mina')).toBe(studentNameKey('Filopater', 'Mina'))
  })
  it('does not care which name is first', () => {
    expect(studentNameKey('Mina', 'Gerges')).toBe(studentNameKey('Gerges', 'Mina'))
  })
  it('keeps different names apart', () => {
    expect(studentNameKey('Mina', 'Gerges')).not.toBe(studentNameKey('Mena', 'Gerges'))
    expect(studentNameKey('Mary', 'Ghaly')).not.toBe(studentNameKey('Marina', 'Ghaly'))
  })
})

describe('finding a child already on file', () => {
  const known = [
    { id: 's1', loginId: '1234', firstName: 'Kirollos', lastName: 'Sargyous', dob: '2014-03-01', className: '5th & 6th Boys' },
    { id: 's2', loginId: '2345', firstName: 'Mina', lastName: 'Gerges', dob: null, className: 'KG' },
  ]
  it('matches a new row to the child already there', () => {
    expect(findDuplicateStudent({ firstName: 'Kirolos', lastName: 'Sargious', dob: null }, known)?.loginId).toBe('1234')
    expect(findDuplicateStudent({ firstName: 'Mina', lastName: 'Gerges', dob: '2020-01-01' }, known)?.loginId).toBe('2345')
  })
  it('two birthdays that differ mean two children', () => {
    expect(findDuplicateStudent({ firstName: 'Kirollos', lastName: 'Sargyous', dob: '2016-07-07' }, known)).toBeNull()
  })
  it('a new name is not a duplicate', () => {
    expect(findDuplicateStudent({ firstName: 'Abanoub', lastName: 'Hanna', dob: null }, known)).toBeNull()
  })
})

describe("a servant's import stays inside their class", () => {
  const base = { className: '3rd', targetClassId: '3rd', rowClassId: null, clearsClass: false, isUpdate: false }
  it('adds new children to the class', () => {
    expect(classImportRowProblem(base)).toBeNull()
    expect(classImportRowProblem({ ...base, rowClassId: '3rd' })).toBeNull()
  })
  it('updates a child already in the class', () => {
    expect(classImportRowProblem({ ...base, isUpdate: true, existingClassId: '3rd' })).toBeNull()
  })
  it('refuses another class in the Class column', () => {
    expect(classImportRowProblem({ ...base, rowClassId: '4th' })).toMatch(/only adds to 3rd/)
  })
  it("refuses to touch a child in another class, or with no class", () => {
    expect(classImportRowProblem({ ...base, isUpdate: true, existingClassId: '4th' })).toMatch(/another class/)
    expect(classImportRowProblem({ ...base, isUpdate: true, existingClassId: null })).toMatch(/another class/)
  })
  it('refuses "none": taking a child off a class is Unassign, with a reason', () => {
    expect(classImportRowProblem({ ...base, clearsClass: true })).toMatch(/Unassign/)
  })
})
