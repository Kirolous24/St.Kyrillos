/**
 * Curriculum links between classes, as a graph: `curriculumLinkedToId` says a
 * class follows another's lesson plan. A link joins the two classes one hop, in
 * both directions, so servants of either class may read the other's Lesson
 * Preparation and copy a week of it into their own. Reading is all it grants:
 * never editing, and nothing about the other class's children.
 *
 * Pure, so the rules are testable without a database.
 */

export interface LinkRow {
  id: string
  curriculumLinkedToId: string | null
}

/** The classes linked with this one: the class it follows, and the classes that follow it. */
export function linkedWith(classId: string, rows: readonly LinkRow[]): string[] {
  const out: string[] = []
  const me = rows.find((r) => r.id === classId)
  if (me?.curriculumLinkedToId && me.curriculumLinkedToId !== classId) out.push(me.curriculumLinkedToId)
  for (const r of rows) {
    if (r.curriculumLinkedToId === classId && r.id !== classId && !out.includes(r.id)) out.push(r.id)
  }
  return out
}

/** Classes a user may read through a link, beyond the ones they can already open. */
export function linkedReadable(ownIds: readonly string[], rows: readonly LinkRow[]): string[] {
  const own = new Set(ownIds)
  const out: string[] = []
  for (const id of ownIds) {
    for (const linked of linkedWith(id, rows)) {
      if (!own.has(linked) && !out.includes(linked)) out.push(linked)
    }
  }
  return out
}

/** True when the two classes are directly linked, either way round. */
export function areLinked(a: LinkRow, b: LinkRow): boolean {
  return a.id !== b.id && (a.curriculumLinkedToId === b.id || b.curriculumLinkedToId === a.id)
}
