'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { can, type PortalUser } from '../permissions'
import { CLEAR_UNASSIGNED, cleanUnassignReason } from '../unassigned'
import { placeNewKids } from '../data/groups'
import { studentName } from '../data/students'

/**
 * UNASSIGNED (2026-09-26). Any servant of a class takes a child off it with a
 * required reason. The class Coordinator, the stage overseer or the admin then
 * puts the child back, moves them, or deletes them for good. Nothing here
 * touches attendance, points, quizzes or the child's login.
 */

function revalidateUnassigned(classIds: Array<string | null | undefined>): void {
  // The sidebar count is drawn by the layout on every page.
  revalidatePath('/portal', 'layout')
  revalidatePath('/portal/unassigned')
  revalidatePath('/portal/admin/students')
  revalidatePath('/portal/follow-ups')
  for (const id of classIds) if (id) revalidatePath(`/portal/classes/${id}`)
}

export async function unassignStudent(studentId: string, reason: string): Promise<ActionResult<{ classId: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const s = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classId: true,
        class: { select: { name: true, stage: true } },
        account: { select: { role: true } },
      },
    })
    if (!s || s.account.role !== 'STUDENT') throw new PortalError('Student not found.')
    if (!s.classId || !s.class) throw new PortalError('This child is not in a class.')
    if (!can(user, 'student.write', { classId: s.classId, classStage: s.class.stage, studentId: s.id })) {
      throw new PortalError('You do not have permission to change this class.')
    }
    const clean = cleanUnassignReason(reason)
    if (!clean.ok) throw new PortalError(clean.error)

    const now = new Date()
    // A group belongs to a class, and a follow-up case is the class chasing a
    // child it no longer has, so both end here, with the reason on the case.
    const [, closed] = await prisma.$transaction([
      prisma.student.update({
        where: { id: s.id },
        data: {
          classId: null,
          groupServantId: null,
          groupAssignedAt: null,
          unassignedAt: now,
          unassignedById: user.accountId,
          unassignedReason: clean.reason,
          unassignedFromClassId: s.classId,
        },
      }),
      prisma.followUpCase.updateMany({
        where: { studentId: s.id, status: 'OPEN' },
        data: {
          status: 'DONE',
          resolvedAt: now,
          resolvedById: user.accountId,
          resolveReason: 'other',
          resolveNote: `Unassigned from ${s.class.name}: ${clean.reason}`,
        },
      }),
    ])
    await audit(
      user,
      'student.unassign',
      'student',
      s.id,
      `Unassigned ${studentName(s)} from ${s.class.name}: ${clean.reason}${
        closed.count ? ` (closed ${closed.count} follow-up case${closed.count === 1 ? '' : 's'})` : ''
      }`,
    )
    revalidateUnassigned([s.classId])
    return { classId: s.classId }
  })
}

/**
 * A child on the list, and the class they came from, once this user is known
 * to be allowed to decide about them. A child with no class on record is the
 * admin's alone.
 */
async function loadWaiting(user: PortalUser, studentId: string) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      accountId: true,
      firstName: true,
      lastName: true,
      classId: true,
      unassignedAt: true,
      unassignedReason: true,
      unassignedFromClassId: true,
      unassignedBy: { select: { displayName: true } },
      account: { select: { role: true } },
    },
  })
  if (!s || s.account.role !== 'STUDENT') throw new PortalError('Student not found.')
  if (s.classId) throw new PortalError('This child is already in a class.')
  const from = s.unassignedFromClassId
    ? await prisma.schoolClass.findUnique({
        where: { id: s.unassignedFromClassId },
        select: { id: true, name: true, stage: true, isActive: true },
      })
    : null
  const allowed =
    user.role === 'ADMIN' ||
    (!!from && !!s.unassignedAt && can(user, 'unassigned.manage', { classId: from.id, classStage: from.stage }))
  if (!allowed) throw new PortalError('Only the class Coordinator, the stage overseer or the admin can decide about this child.')
  return { s, from }
}

export async function putBackUnassigned(studentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const { s, from } = await loadWaiting(user, studentId)
    if (!from) throw new PortalError('There is no class on record to put this child back in. Move them instead.')
    if (!from.isActive) throw new PortalError(`${from.name} is no longer an active class. Move this child instead.`)
    await prisma.student.update({ where: { id: s.id }, data: { classId: from.id, ...CLEAR_UNASSIGNED } })
    await placeNewKids(from.id, [s.id]).catch((err) => console.error('Group placement failed:', err))
    await audit(user, 'student.restore', 'student', s.id, `Put ${studentName(s)} back in ${from.name}`)
    revalidateUnassigned([from.id])
    return undefined
  })
}

export async function moveUnassigned(studentId: string, toClassId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const { s, from } = await loadWaiting(user, studentId)
    const to = await prisma.schoolClass.findUnique({
      where: { id: String(toClassId ?? '') },
      select: { id: true, name: true, isActive: true },
    })
    if (!to || !to.isActive) throw new PortalError('Pick an active class.')
    await prisma.student.update({ where: { id: s.id }, data: { classId: to.id, ...CLEAR_UNASSIGNED } })
    await placeNewKids(to.id, [s.id]).catch((err) => console.error('Group placement failed:', err))
    await audit(
      user,
      'student.move',
      'student',
      s.id,
      `Moved ${studentName(s)} (unassigned${from ? ` from ${from.name}` : ''}) to ${to.name}`,
    )
    revalidateUnassigned([to.id])
    return undefined
  })
}

/** For good: the account and everything hanging off it, as the admin's delete does. */
export async function deleteUnassigned(studentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const { s, from } = await loadWaiting(user, studentId)
    await prisma.account.delete({ where: { id: s.accountId } })
    const why = [
      from ? `unassigned from ${from.name}` : 'no class on record',
      s.unassignedBy ? `by ${s.unassignedBy.displayName}` : null,
    ]
      .filter(Boolean)
      .join(' ')
    await audit(
      user,
      'student.delete',
      'student',
      s.id,
      `Deleted ${studentName(s)} from the UNASSIGNED list (${why}${s.unassignedReason ? `: ${s.unassignedReason}` : ''})`,
    )
    revalidateUnassigned([])
    return undefined
  })
}
