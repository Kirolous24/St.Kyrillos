// Shared between the bulk-edit server action and its client bar. It cannot live
// in the action module: Next.js requires every export of a "use server" file to
// be an async function, and a plain array there fails at build.

/**
 * The fields the prototype's bulk editor could set across a selection. Only
 * flat, low-risk columns: nothing that changes who a student is (name, ID) or
 * where they belong (class — that is `bulkMoveStudents`, admin only).
 */
export const BULK_FIELDS = [
  { key: 'grade', label: 'Grade', max: 20 },
  { key: 'gender', label: 'Gender', max: 10 },
  { key: 'address', label: 'Address', max: 200 },
  { key: 'fatherName', label: "Father's name", max: 80 },
  { key: 'fatherPhone', label: "Father's phone", max: 30 },
  { key: 'motherName', label: "Mother's name", max: 80 },
  { key: 'motherPhone', label: "Mother's phone", max: 30 },
  { key: 'parentEmails', label: 'Parent emails', max: 300 },
  { key: 'notes', label: 'Notes', max: 1000 },
] as const

export type BulkField = (typeof BULK_FIELDS)[number]['key']

export const BULK_FIELD_KEYS: ReadonlySet<string> = new Set(BULK_FIELDS.map((f) => f.key))
