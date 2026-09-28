/**
 * Student imports without duplicates (2026-09-27).
 *
 * The CSV import matched children only by their 4-digit ID, so a class list
 * of names, the sheet servants actually have, added a second copy of every
 * child already in the portal. Before a row creates anyone, it is checked
 * against every child on file by name, spelled any of the usual ways.
 *
 * The rest of a servant's class import lives here too: which class a row's
 * Class cell means, and the template's example row.
 *
 * Pure, so the rules are testable without a database.
 */

import { normalizePhone } from './phones'

const SWAPS: ReadonlyArray<[string, string]> = [
  ['ph', 'f'],
  ['ch', 'k'],
  ['c', 'k'],
  ['q', 'k'],
  ['ee', 'i'],
  ['y', 'i'],
  ['ou', 'o'],
  ['oo', 'o'],
]

function foldWord(word: string): string {
  let s = word.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '')
  for (const [from, to] of SWAPS) s = s.split(from).join(to)
  return s.replace(/(.)\1+/g, '$1')
}

/**
 * The same child whatever the spelling or order: "Kirollos Sargyous",
 * "kirolos sargious" and "Sargious Kirolos" share one key.
 */
export function studentNameKey(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.split(/\s+/).map(foldWord).filter(Boolean).sort().join(' ')
}

export interface KnownStudent {
  id: string
  loginId: string
  firstName: string
  lastName: string
  /** YYYY-MM-DD */
  dob: string | null
  className: string | null
  classId?: string | null
  /** The child's and parents' numbers, as familyPhones gives them. */
  phones?: readonly string[]
}

/** A child's and parents' numbers, digits only; anything too short to be a number is dropped. */
export function familyPhones(...raw: Array<string | null | undefined>): string[] {
  return raw.map((p) => normalizePhone(p)).filter((p): p is string => !!p && p.length >= 7)
}

/**
 * The child already on file that a new row names, or null.
 *
 * A birthday on both sides that differs means two children who share a name,
 * unless they also share a phone number (2026-09-28): then it is one child
 * whose birthday was typed differently. A sister shares the phone but not the
 * name, so a phone alone never matches.
 */
export function findDuplicateStudent(
  row: { firstName: string; lastName: string; dob: string | null; phones?: readonly string[] },
  known: readonly KnownStudent[],
): KnownStudent | null {
  const key = studentNameKey(row.firstName, row.lastName)
  if (!key) return null
  const sameFamily = (k: KnownStudent) => !!row.phones?.some((p) => k.phones?.includes(p))
  return (
    known.find(
      (k) =>
        studentNameKey(k.firstName, k.lastName) === key &&
        (!row.dob || !k.dob || row.dob === k.dob || sameFamily(k)),
    ) ?? null
  )
}

/**
 * Values in a Class column that mean "take this student out of their class".
 * Anything else blank simply leaves the existing assignment alone — a sheet
 * that only carries phone numbers must never detach a roster.
 */
const CLASS_NONE: ReadonlySet<string> = new Set(['none', 'no class', 'unassigned', 'remove', '-'])

/**
 * What a row's Class cell (the Class column, or Class name when that is
 * blank) asks for.
 *
 * - Blank: the class the import is for (with none, the child stays put).
 * - none, remove, -: off their class.
 * - A class id or name: that class.
 * - Anything else is `unknown` in the admin's import, so a typo never sends
 *   a child to the default class. In a class import it is not a class at
 *   all (2026-09-28): servants wrote grades like "11th" under Class name,
 *   copying the template, and every row failed. There the row goes into the
 *   class, like a blank cell.
 */
export function readRowClass(args: {
  classRef: string
  findClass: (ref: string) => string | null
  defaultClassId: string | null
  classImport: boolean
}): { classId: string | null; namedClassId: string | null; clearsClass: boolean; unknown: boolean } {
  const ref = args.classRef.trim()
  const keep = { classId: args.defaultClassId, namedClassId: null, clearsClass: false, unknown: false }
  if (!ref) return keep
  if (CLASS_NONE.has(ref.toLowerCase())) return { classId: null, namedClassId: null, clearsClass: true, unknown: false }
  const found = args.findClass(ref)
  if (found) return { classId: found, namedClassId: found, clearsClass: false, unknown: false }
  return args.classImport ? keep : { classId: null, namedClassId: null, clearsClass: false, unknown: true }
}

/**
 * The template's one example row. Its numbers are 555-01xx, which are never
 * real, so a row still carrying the example's name and father's phone was
 * left in by mistake and adds nobody. The Class name cell is blank: it used
 * to say "Grade 3", and servants copied that and wrote grades there.
 */
export const STUDENT_TEMPLATE_EXAMPLE = {
  id: '',
  firstName: 'Mina',
  lastName: 'Gerges',
  classId: '',
  className: '',
  grade: '3rd',
  gender: 'male',
  dob: '2017-04-09',
  email: '',
  phone: '',
  fatherName: 'Gerges Samir',
  fatherPhone: '615-555-0147',
  motherName: 'Mariam Gerges',
  motherPhone: '615-555-0148',
  parentEmails: 'gerges@example.com; mariam@example.com',
  address: '123 Main St, Antioch TN',
  notes: 'Leave the ID blank for a new student — one is assigned on import.',
} as const

export function isTemplateExample(row: { firstName: string; lastName: string; fatherPhone: string | null }): boolean {
  const example = STUDENT_TEMPLATE_EXAMPLE
  return (
    studentNameKey(row.firstName, row.lastName) === studentNameKey(example.firstName, example.lastName) &&
    normalizePhone(row.fatherPhone) === normalizePhone(example.fatherPhone)
  )
}

/**
 * A servant imports into their own class (2026-09-27). Such an import may add
 * children to that class and update children already in it, and nothing else.
 * Moving children between classes stays with the admin; taking one off a class
 * is Unassign, which asks for a reason. Returns why a row is out of bounds, or
 * null.
 */
export function classImportRowProblem(args: {
  className: string
  targetClassId: string
  /** The row's Class column, resolved; null when blank. */
  rowClassId: string | null
  clearsClass: boolean
  isUpdate: boolean
  /** For an update: the class that child is in now. */
  existingClassId?: string | null
}): string | null {
  if (args.clearsClass) return 'To take a child off the class, use Unassign on their page. It asks for a reason.'
  if (args.rowClassId && args.rowClassId !== args.targetClassId) {
    return `This import only adds to ${args.className}. Ask the admin to move children between classes.`
  }
  if (args.isUpdate && args.existingClassId !== args.targetClassId) {
    return 'That ID belongs to a child in another class. Ask the admin to move children between classes.'
  }
  return null
}
