/**
 * Student imports without duplicates (2026-09-27).
 *
 * The CSV import matched children only by their 4-digit ID, so a class list
 * of names, the sheet servants actually have, added a second copy of every
 * child already in the portal. Before a row creates anyone, it is checked
 * against every child on file by name, spelled any of the usual ways.
 *
 * Pure, so the rules are testable without a database.
 */

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
}

/**
 * The child already on file that a new row names, or null. A birthday on both
 * sides that differs means two children who share a name.
 */
export function findDuplicateStudent(
  row: { firstName: string; lastName: string; dob: string | null },
  known: readonly KnownStudent[],
): KnownStudent | null {
  const key = studentNameKey(row.firstName, row.lastName)
  if (!key) return null
  return (
    known.find(
      (k) => studentNameKey(k.firstName, k.lastName) === key && (!row.dob || !k.dob || row.dob === k.dob),
    ) ?? null
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
