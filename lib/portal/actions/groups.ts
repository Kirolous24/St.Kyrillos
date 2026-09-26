'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { planSplit } from '../groups'
import { applyGroupMoves, loadClassGroups } from '../data/groups'
import { studentName } from '../data/students'

function revalidateGroups(classId: string) {
  revalidatePath(`/portal/classes/${classId}`)
  revalidatePath('/portal/my-group')
  revalidatePath('/portal/follow-ups')
  revalidatePath('/portal/my-stage')
}

/** What Split evenly would do, named, before anything moves. */
export async function previewSplit(
  classId: string,
): Promise<ActionResult<{ moves: Array<{ kid: string; from: string | null; to: string }> }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    await assertClassAction(user, classId, 'group.manage')
    const [g] = await loadClassGroups([classId])
    if (!g || g.servants.length === 0) throw new PortalError('This class has no active servants to split between.')
    const names = new Map(g.servants.map((s) => [s.id, s.name]))
    const kidName = new Map(g.kids.map((k) => [k.id, k.name]))
    return {
      moves: planSplit(g.kids, g.servants).map((m) => ({
        kid: kidName.get(m.kidId)!,
        from: m.from ? names.get(m.from) ?? null : null,
        to: names.get(m.to)!,
      })),
    }
  })
}

/** Split evenly: the fewest moves that even the class out. */
export async function applySplit(classId: string): Promise<ActionResult<{ moved: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await assertClassAction(user, classId, 'group.manage')
    const [g] = await loadClassGroups([classId])
    if (!g || g.servants.length === 0) throw new PortalError('This class has no active servants to split between.')
    const moves = planSplit(g.kids, g.servants)
    await prisma.$transaction(async (tx) => {
      await applyGroupMoves(tx, moves)
      await tx.schoolClass.update({ where: { id: classId }, data: { groupsSplitAt: new Date() } })
    })
    const names = new Map(g.servants.map((s) => [s.id, s.name]))
    const kidName = new Map(g.kids.map((k) => [k.id, k.name]))
    await audit(
      user,
      'groups.split',
      'class',
      classId,
      moves.length === 0
        ? `${cls.name}: groups already even`
        : `${cls.name}: ${moves.map((m) => `${kidName.get(m.kidId)} → ${names.get(m.to)}`).slice(0, 30).join(', ')}${moves.length > 30 ? `, and ${moves.length - 30} more` : ''}`,
    )
    revalidateGroups(classId)
    return { moved: moves.length }
  })
}

/** Move one child to another servant of the same class. */
export async function moveKidToGroup(studentId: string, servantId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const s = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, classId: true, firstName: true, lastName: true },
    })
    if (!s || !s.classId) throw new PortalError('Student not found or has no class.')
    const cls = await assertClassAction(user, s.classId, 'group.manage')
    const target = await prisma.classServant.findFirst({
      where: { classId: s.classId, servantId, servant: { account: { isActive: true } } },
      select: { servant: { select: { account: { select: { displayName: true } } } } },
    })
    if (!target) throw new PortalError('That servant does not serve this class.')
    await prisma.student.update({ where: { id: s.id }, data: { groupServantId: servantId, groupAssignedAt: new Date() } })
    await audit(user, 'groups.move', 'student', s.id, `${cls.name}: ${studentName(s)} → ${target.servant.account.displayName}`)
    revalidateGroups(s.classId)
    revalidatePath(`/portal/students/${s.id}`)
    return undefined
  })
}
