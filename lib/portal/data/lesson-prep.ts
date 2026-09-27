import { prisma } from '@/lib/prisma'
import type { PortalUser } from '../permissions'
import { listVisibleClasses } from './classes'
import { linkedReadable } from '../lesson-links'

/**
 * The classes a user can open in Lesson Preparation.
 *
 * - `own`: the classes they could open before. They edit these where their
 *   role allows.
 * - `linked`: classes joined to one of theirs by a curriculum link, which they
 *   may read and copy from, and nothing more.
 *
 * `rows` is every active class with its link, so a page can say who follows
 * whom without a second query.
 */
export async function lessonPrepClasses(user: PortalUser) {
  const [own, rows] = await Promise.all([
    listVisibleClasses(user),
    prisma.schoolClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, stage: true, curriculumLinkedToId: true },
    }),
  ])
  const linkedIds = new Set(linkedReadable(own.map((c) => c.id), rows))
  const linked = rows.filter((r) => linkedIds.has(r.id)).map(({ id, name, stage }) => ({ id, name, stage }))
  return { own, linked, rows }
}
