// Which columns a student CSV actually carries, and therefore which fields an
// import is allowed to overwrite.
//
// F0799 — the import used to write every field on every matched row, so a
// column the sheet did not have was written as null. An admin uploading three
// columns of corrected spellings silently erased each matched child's address,
// parents' names and phone numbers, date of birth, grade and notes, and the
// preview said only "Would update". Splitting "the cell is empty" from "the
// file has no such column" is what makes a partial sheet safe, so the rule
// lives here, away from the database, where it can be tested directly.

/**
 * F0799 — every column a student sheet may carry, with the header spellings
 * that map onto it.
 *
 * Both the value and the question "does this file have that column at all?"
 * are answered from this one table, so the aliases a field is read with can
 * never drift from the aliases its presence is judged by. That distinction is
 * the whole point: a column the sheet does not have is not an empty column.
 * An update must leave such a field exactly as it was, or a three-column
 * spreadsheet of corrected spellings silently erases every matched child's
 * address, parents' names and phones, date of birth and notes.
 */
export const STUDENT_IMPORT_COLUMNS = {
  loginId: ['id', 'login id', 'loginid', 'student id'],
  name: ['name', 'full name', 'student', 'student name'],
  firstName: ['first', 'first name', 'firstname'],
  lastName: ['last', 'last name', 'lastname'],
  classRef: ['class', 'class id', 'classid', 'class name'],
  grade: ['grade'],
  gender: ['gender', 'sex'],
  dob: ['dob', 'date of birth', 'birthday', 'birth date'],
  fatherName: ['father name', 'father', 'fathername'],
  fatherPhone: ['father phone', 'fatherphone'],
  motherName: ['mother name', 'mother', 'mothername'],
  motherPhone: ['mother phone', 'motherphone'],
  parentEmails: ['parentemails', 'parent emails', 'parent email', 'parentemail', 'emails'],
  email: ['student email', 'studentemail', 'email'],
  phone: ['student phone', 'studentphone', 'phone', 'mobile', 'cell'],
  address: ['address'],
  notes: ['notes', 'note'],
} as const

export type StudentImportColumn = keyof typeof STUDENT_IMPORT_COLUMNS

/** The Student fields a sheet may overwrite, in the order the preview lists them. */
export const STUDENT_DATA_COLUMNS = [
  'gender',
  'dob',
  'grade',
  'address',
  'fatherName',
  'fatherPhone',
  'motherName',
  'motherPhone',
  'parentEmails',
  'notes',
] as const satisfies readonly StudentImportColumn[]

export type StudentImportDataColumn = (typeof STUDENT_DATA_COLUMNS)[number]

/** Plain-English names for the preview's "would change" line. */
const STUDENT_COLUMN_LABELS: Record<string, string> = {
  name: 'name',
  gender: 'gender',
  dob: 'date of birth',
  grade: 'grade',
  address: 'address',
  fatherName: "father's name",
  fatherPhone: "father's phone",
  motherName: "mother's name",
  motherPhone: "mother's phone",
  parentEmails: 'parent emails',
  notes: 'notes',
  email: 'email',
  phone: 'phone',
}


export interface StudentImportPlan {
  /** True when the sheet carries a name column and may therefore create rows. */
  namesGiven: boolean
  /** The Student fields this sheet is allowed to overwrite. */
  writableFields: readonly StudentImportDataColumn[]
  /** True when the sheet carries that column at all. */
  has: (column: StudentImportColumn) => boolean
  /** Plain-English list for the preview's "would update …" line. */
  changedLabels: string[]
}

/**
 * `headers` are the normalised header keys of the uploaded file — for a file
 * parsed by `parseCsvRecords`, the keys of any one row, since every row is
 * given a key per header whether its cell is filled or not.
 */
export function studentImportColumns(headers: Iterable<string>): StudentImportPlan {
  const keys = new Set(headers)
  const has = (column: StudentImportColumn) =>
    STUDENT_IMPORT_COLUMNS[column].some((alias) => keys.has(alias))
  const namesGiven = has('name') || has('firstName') || has('lastName')
  const writableFields = STUDENT_DATA_COLUMNS.filter(has)
  return {
    namesGiven,
    writableFields,
    has,
    changedLabels: [
      ...(namesGiven ? ['name'] : []),
      ...writableFields.map((f) => STUDENT_COLUMN_LABELS[f] ?? f),
      ...(has('email') ? ['email'] : []),
      ...(has('phone') ? ['phone'] : []),
    ],
  }
}
