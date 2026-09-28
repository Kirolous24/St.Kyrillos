import { describe, it, expect } from 'vitest'
import { parseCsvRecords } from '@/lib/portal/csv'
import { parseBirthDate } from '@/lib/portal/dates'
import { looksLikeStudentHeader, studentImportColumns } from '@/lib/portal/import-columns'
import {
  findDuplicateStudent,
  isTemplateExample,
  readRowClass,
  STUDENT_TEMPLATE_EXAMPLE,
} from '@/lib/portal/student-dupes'

/**
 * 2026-09-28 — a servant's class list from Google Sheets failed on every row.
 * Its first line was empty, so the import read that as the column names; its
 * Class name column held grades ("11th"); and a third of its birthdays were
 * written 10-26-2009 or 07/10/11. The names and numbers below are made up.
 */

const HEADER = 'ID,First name,Last name,Class,Class name,Grade,Gender,Date of birth,Father phone'

describe('finding the column names', () => {
  it('skips empty rows above them', () => {
    const records = parseCsvRecords([',,,,,,,,', HEADER, ',Marina,Tadros,,11th,11th,female,10-26-2009,615-555-0101'].join('\n'))
    expect(records).toHaveLength(1)
    expect(records[0]!['first name']).toBe('Marina')
    expect(studentImportColumns(Object.keys(records[0]!)).namesGiven).toBe(true)
  })

  it('an empty file, or one of empty rows, has no records', () => {
    expect(parseCsvRecords('')).toEqual([])
    expect(parseCsvRecords(',,,\n,,,\n')).toEqual([])
  })

  it('looks past a title above the column names when told what they look like', () => {
    const csv = ['High School Girls 2026,,,,,,,,', ',,,,,,,,', HEADER, ',Marina,Tadros,,,,,,'].join('\n')
    const records = parseCsvRecords(csv, { isHeader: looksLikeStudentHeader })
    expect(records).toHaveLength(1)
    expect(records[0]!['last name']).toBe('Tadros')
  })

  it('without a match, the first filled row is still the header', () => {
    const records = parseCsvRecords('Colour,Size\nred,big', { isHeader: looksLikeStudentHeader })
    expect(records).toEqual([{ colour: 'red', size: 'big' }])
  })

  it('knows a student header by its names or its IDs', () => {
    expect(looksLikeStudentHeader(['id', 'first name', 'last name'])).toBe(true)
    expect(looksLikeStudentHeader(['id', 'father phone'])).toBe(true)
    expect(looksLikeStudentHeader(['high school girls 2026'])).toBe(false)
  })
})

describe('reading a date of birth the way people type it', () => {
  const today = '2026-09-28'
  it('reads what the portal always read', () => {
    expect(parseBirthDate('2011-07-10', today)).toBe('2011-07-10')
    expect(parseBirthDate('7/10/2011', today)).toBe('2011-07-10')
  })
  it('reads dashes and dots', () => {
    expect(parseBirthDate('10-26-2009', today)).toBe('2009-10-26')
    expect(parseBirthDate('11-4-2009', today)).toBe('2009-11-04')
    expect(parseBirthDate('10.26.2009', today)).toBe('2009-10-26')
  })
  it('reads a two-digit year as the latest one that is not in the future', () => {
    expect(parseBirthDate('07/10/11', today)).toBe('2011-07-10')
    expect(parseBirthDate('6/15/09', today)).toBe('2009-06-15')
    expect(parseBirthDate('1/1/11', today)).toBe('2011-01-01')
    expect(parseBirthDate('03/04/85', today)).toBe('1985-03-04')
    expect(parseBirthDate('09/01/26', today)).toBe('2026-09-01')
    expect(parseBirthDate('10/15/26', today)).toBe('1926-10-15')
  })
  it('still refuses what is not a date', () => {
    expect(parseBirthDate('13/40/2011', today)).toBeNull()
    expect(parseBirthDate('02/30/2011', today)).toBeNull()
    expect(parseBirthDate('n/a', today)).toBeNull()
    expect(parseBirthDate('', today)).toBeNull()
  })
})

describe("a row's Class cell", () => {
  const classes: Record<string, string> = { '7th-8th-girls': '7th-8th-girls', 'high school girls': 'high-school-girls', 'high-school-girls': 'high-school-girls' }
  const findClass = (ref: string) => classes[ref.toLowerCase()] ?? null
  const read = (classRef: string, classImport: boolean, defaultClassId: string | null = 'high-school-girls') =>
    readRowClass({ classRef, findClass, defaultClassId, classImport })

  it('blank: the class the import is for', () => {
    expect(read('', true)).toEqual({ classId: 'high-school-girls', namedClassId: null, clearsClass: false, unknown: false })
    expect(read('', false, null).classId).toBeNull()
  })
  it('a real class, by id or by name', () => {
    expect(read('High School Girls', true).namedClassId).toBe('high-school-girls')
    expect(read('7th-8th-girls', false).classId).toBe('7th-8th-girls')
  })
  it('"none" takes a child off their class', () => {
    expect(read('none', false).clearsClass).toBe(true)
  })
  it('in a class import, a grade in the Class name column is not a class: the row goes into the class', () => {
    expect(read('11th', true)).toEqual({ classId: 'high-school-girls', namedClassId: null, clearsClass: false, unknown: false })
  })
  it("in the admin's import, a class nobody has is still an error, so a typo never sends a child to the default class", () => {
    expect(read('11th', false).unknown).toBe(true)
  })
})

describe('the same child with a different birthday on file', () => {
  const known = [
    { id: 's1', loginId: '1234', firstName: 'Demiana', lastName: 'Shenouda', dob: '2013-01-01', className: '7th & 8th Girls', classId: '7th-8th-girls', phones: ['6155550111', '6155550112'] },
    { id: 's2', loginId: '2345', firstName: 'Irene', lastName: 'Tadros', dob: '2014-05-18', className: '7th & 8th Girls', classId: '7th-8th-girls', phones: ['6155550121'] },
  ]
  it('same name and a shared family phone: the same child, whatever the birthdays say', () => {
    expect(findDuplicateStudent({ firstName: 'Demiana', lastName: 'Shenouda', dob: '2011-01-01', phones: ['6155550112'] }, known)?.loginId).toBe('1234')
  })
  it('same name, different birthday, nothing in common: two children', () => {
    expect(findDuplicateStudent({ firstName: 'Demiana', lastName: 'Shenouda', dob: '2011-01-01', phones: ['6155550199'] }, known)).toBeNull()
    expect(findDuplicateStudent({ firstName: 'Demiana', lastName: 'Shenouda', dob: '2011-01-01' }, known)).toBeNull()
  })
  it('a sister shares the phone but not the name: never merged', () => {
    expect(findDuplicateStudent({ firstName: 'Marina', lastName: 'Tadros', dob: '2011-10-29', phones: ['6155550121'] }, known)).toBeNull()
  })
})

describe("the template's example row", () => {
  it('is recognised, so leaving it in adds nobody', () => {
    expect(isTemplateExample({ firstName: STUDENT_TEMPLATE_EXAMPLE.firstName, lastName: STUDENT_TEMPLATE_EXAMPLE.lastName, fatherPhone: '6155550147' })).toBe(true)
  })
  it('a real child of that name is not the example', () => {
    expect(isTemplateExample({ firstName: 'Mina', lastName: 'Gerges', fatherPhone: '6155550100' })).toBe(false)
    expect(isTemplateExample({ firstName: 'Mina', lastName: 'Gerges', fatherPhone: null })).toBe(false)
  })
  it('no longer puts a grade in the Class name column', () => {
    expect(STUDENT_TEMPLATE_EXAMPLE.className).toBe('')
  })
})
