import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { PortalError } from '../action-result'
import { audit } from '../audit'
import type { PortalUser } from '../permissions'

/**
 * Curriculum links, written. A class points at most one other class
 * (`curriculumLinkedToId`), and the link joins the pair both ways: servants of
 * either class may read the other's Lesson Preparation and copy from it
 * (lib/portal/lesson-links.ts).
 *
 * A pair may point at each other. That is how the old app stored the boys'
 * and girls' classes that share one curriculum. It used to be refused, back
 * when a link meant "silently follow a source". Now it only grants reading,
 * so it is merely redundant. The callers have already checked that this user
 * may change `classId`.
 */

function revalidateLinks(): void {
  revalidatePath('/portal/admin/classes')
  revalidatePath('/portal/agenda')
  revalidatePath('/portal/agenda/week')
  revalidatePath('/portal/lessons')
}

/** Point this class at another (a link), or clear its own pointer. */
export async function applyCurriculumLink(user: PortalUser, classId: string, linkedToId: string | null): Promise<void> {
  const cls = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { id: true, name: true, curriculumLinkedToId: true },
  })
  if (!cls) throw new PortalError('Class not found.')

  const target = (linkedToId ?? '').trim() || null
  if (target === cls.id) throw new PortalError('A class cannot be linked with itself.')

  let targetName: string | null = null
  if (target) {
    const other = await prisma.schoolClass.findUnique({ where: { id: target }, select: { name: true, isActive: true } })
    if (!other || !other.isActive) throw new PortalError('That class does not exist.')
    targetName = other.name
  }
  if ((cls.curriculumLinkedToId ?? null) === target) return

  await prisma.schoolClass.update({ where: { id: cls.id }, data: { curriculumLinkedToId: target } })
  await audit(
    user,
    'class.curriculumLink',
    'class',
    cls.id,
    target ? `${cls.name} is now linked with ${targetName}` : `${cls.name} no longer points at another class`,
  )
  revalidateLinks()
}

/**
 * End the link between two classes, whichever way it was stored, including a
 * pair that points at each other. Unlinking only takes access away, so either
 * side may end it.
 */
export async function unlinkCurriculumPair(user: PortalUser, classId: string, otherId: string): Promise<void> {
  const pair = await prisma.schoolClass.findMany({
    where: { id: { in: [classId, otherId] } },
    select: { id: true, name: true, curriculumLinkedToId: true },
  })
  const me = pair.find((c) => c.id === classId)
  const other = pair.find((c) => c.id === otherId)
  if (!me || !other || me.id === other.id) throw new PortalError('Class not found.')

  const cleared = await prisma.schoolClass.updateMany({
    where: {
      OR: [
        { id: me.id, curriculumLinkedToId: other.id },
        { id: other.id, curriculumLinkedToId: me.id },
      ],
    },
    data: { curriculumLinkedToId: null },
  })
  if (cleared.count === 0) throw new PortalError(`${me.name} and ${other.name} are not linked.`)
  await audit(user, 'class.curriculumLink', 'class', me.id, `${me.name} and ${other.name} are no longer linked`)
  revalidateLinks()
}
