import type { StudentFormInput } from './actions/students'

/**
 * Every field the student form edits, in the order of StudentFormSchema
 * (lib/portal/actions/students.ts). A guard test holds the two together.
 */
export const STUDENT_FORM_FIELDS = [
  'firstName',
  'lastName',
  'gender',
  'dob',
  'grade',
  'address',
  'fatherName',
  'fatherPhone',
  'motherName',
  'motherPhone',
  'parentEmails',
  'email',
  'phone',
  'notes',
] as const satisfies ReadonlyArray<keyof StudentFormInput>

/**
 * What the form starts from. 2026-09-28: the child's own email and phone were
 * added to the form and the edit page, but not to the form's starting state,
 * so the two boxes always opened empty and every save wiped what was there.
 * Every field is built here, so a field the schema has cannot be left out.
 */
export function studentFormState(initial?: Partial<StudentFormInput>): StudentFormInput {
  const state = {} as Record<(typeof STUDENT_FORM_FIELDS)[number], string>
  for (const field of STUDENT_FORM_FIELDS) state[field] = (initial?.[field] as string | null | undefined) ?? ''
  return state as StudentFormInput
}
