// The prototype's "Add Standard Grade Classes" list (OG L3516-3541), plus the
// pure part of deciding which of them are missing.
//
// Kept out of the 'use server' action module deliberately: such a module may
// only export async functions (tests/portal/use-server-exports.test.ts), so a
// const list exported from there would fail the build — and a non-exported one
// could not be unit-tested at all.

import type { StageKey } from './permissions'

export interface StandardGrade {
  name: string
  stage: StageKey
}

/** Pre-K through 12th, in school order, with the stage each belongs to. */
export const STANDARD_GRADES: readonly StandardGrade[] = [
  { name: 'Pre-K', stage: 'ELEMENTARY' },
  { name: 'KG', stage: 'ELEMENTARY' },
  { name: '1st Grade', stage: 'ELEMENTARY' },
  { name: '2nd Grade', stage: 'ELEMENTARY' },
  { name: '3rd Grade', stage: 'ELEMENTARY' },
  { name: '4th Grade', stage: 'ELEMENTARY' },
  { name: '5th Grade', stage: 'ELEMENTARY' },
  { name: '6th Grade', stage: 'MIDDLE_SCHOOL' },
  { name: '7th Grade', stage: 'MIDDLE_SCHOOL' },
  { name: '8th Grade', stage: 'MIDDLE_SCHOOL' },
  { name: '9th Grade', stage: 'HIGH_SCHOOL' },
  { name: '10th Grade', stage: 'HIGH_SCHOOL' },
  { name: '11th Grade', stage: 'HIGH_SCHOOL' },
  { name: '12th Grade', stage: 'HIGH_SCHOOL' },
]

/** The same slug rule `createClass` uses, so ids stay consistent either way. */
export function gradeSlug(name: string): string {
  return name.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'class'
}

export interface ExistingClass {
  id: string
  name: string
}

/**
 * Which standard grades are not already present.
 *
 * Matched on **name or id**, not name alone. `SchoolClass.id` is a bare slug
 * primary key with no default and names are freely editable, so a class whose
 * name was changed after import still holds the slug — matching on name only
 * would pass the check and then violate the primary key, and inside one
 * transaction that single collision rolls back all fourteen behind a generic
 * error.
 */
export function pickNewGradeClasses(existing: readonly ExistingClass[]): StandardGrade[] {
  const names = new Set(existing.map((c) => c.name.trim().toLowerCase()))
  const ids = new Set(existing.map((c) => c.id))
  return STANDARD_GRADES.filter((g) => !names.has(g.name.toLowerCase()) && !ids.has(gradeSlug(g.name)))
}
