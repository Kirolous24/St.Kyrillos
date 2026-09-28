import { prisma } from '@/lib/prisma'

/**
 * Keep memberships right when children's home class changes to `to`
 * (2026-09-28):
 * - joining a class they were a member of makes it their own, so the
 *   membership goes;
 * - leaving a class that takes children from other classes for a grade class
 *   keeps them in it as a member. A teen created in Pre-Servants and then
 *   moved into High School Girls stays a pre-servant.
 * Taking a child out of every class (`to` null) keeps nothing new.
 */
export async function keepMembershipsOnMove(
  moves: ReadonlyArray<{ studentId: string; from: string | null }>,
  to: string | null,
  addedById: string,
): Promise<void> {
  if (!to || moves.length === 0) return
  await prisma.classMember.deleteMany({ where: { classId: to, studentId: { in: moves.map((m) => m.studentId) } } })
  const fromIds = Array.from(new Set(moves.map((m) => m.from).filter((c): c is string => !!c && c !== to)))
  if (fromIds.length === 0) return
  const open = new Set(
    (await prisma.schoolClass.findMany({ where: { id: { in: fromIds }, takesOtherClasses: true }, select: { id: true } })).map((c) => c.id),
  )
  const rows = moves.filter((m) => m.from && open.has(m.from)).map((m) => ({ classId: m.from!, studentId: m.studentId, addedById }))
  if (rows.length) await prisma.classMember.createMany({ data: rows, skipDuplicates: true })
}

/** The classes each child joined beyond their own, by child. */
export async function membershipsOf(studentIds: readonly string[]): Promise<Map<string, Array<{ id: string; name: string }>>> {
  const out = new Map<string, Array<{ id: string; name: string }>>()
  if (studentIds.length === 0) return out
  const rows = await prisma.classMember.findMany({
    where: { studentId: { in: [...studentIds] } },
    select: { studentId: true, class: { select: { id: true, name: true } } },
    orderBy: { class: { sortOrder: 'asc' } },
  })
  for (const r of rows) out.set(r.studentId, [...(out.get(r.studentId) ?? []), r.class])
  return out
}
