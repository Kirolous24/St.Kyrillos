import { describe, it, expect } from 'vitest'
import { STANDARD_GRADES, pickNewGradeClasses, gradeSlug } from '@/lib/portal/standard-grades'

describe('standard grade classes', () => {
  it('covers Pre-K through 12th in school order', () => {
    expect(STANDARD_GRADES).toHaveLength(14)
    expect(STANDARD_GRADES[0]!.name).toBe('Pre-K')
    expect(STANDARD_GRADES[13]!.name).toBe('12th Grade')
  })

  it('puts each grade in the right stage', () => {
    const stageOf = (name: string) => STANDARD_GRADES.find((g) => g.name === name)!.stage
    expect(stageOf('KG')).toBe('ELEMENTARY')
    expect(stageOf('5th Grade')).toBe('ELEMENTARY')
    expect(stageOf('6th Grade')).toBe('MIDDLE_SCHOOL')
    expect(stageOf('8th Grade')).toBe('MIDDLE_SCHOOL')
    expect(stageOf('9th Grade')).toBe('HIGH_SCHOOL')
  })

  it('adds everything to an empty church', () => {
    expect(pickNewGradeClasses([])).toHaveLength(14)
  })

  it('skips a grade that already exists by name', () => {
    const picked = pickNewGradeClasses([{ id: 'whatever', name: '3rd Grade' }])
    expect(picked.map((g) => g.name)).not.toContain('3rd Grade')
    expect(picked).toHaveLength(13)
  })

  it('ignores case and surrounding space when matching a name', () => {
    const picked = pickNewGradeClasses([{ id: 'x', name: '  pre-k  ' }])
    expect(picked.map((g) => g.name)).not.toContain('Pre-K')
  })

  // The id is a bare slug primary key and names are editable, so a renamed
  // class still holds the slug. Matching on name alone would pass the check
  // and then violate the primary key, rolling back the whole batch.
  it('skips a grade whose slug is already taken by a renamed class', () => {
    const picked = pickNewGradeClasses([{ id: '7th-grade', name: 'Boys — Middle' }])
    expect(picked.map((g) => g.name)).not.toContain('7th Grade')
  })

  it('is a no-op the second time', () => {
    const existing = STANDARD_GRADES.map((g) => ({ id: gradeSlug(g.name), name: g.name }))
    expect(pickNewGradeClasses(existing)).toEqual([])
  })

  it('slugs names the way createClass does', () => {
    expect(gradeSlug('Pre-K')).toBe('pre-k')
    expect(gradeSlug('5th & 6th Boys')).toBe('5th-6th-boys')
  })
})
