'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rosterWhere } from '../class-members'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { ACTIVITY_POINTS_MAX, ACTIVITY_POINTS_MIN, canUndo, capDeduction, resolveManualPoints } from '../points-math'
import { audit } from '../audit'
import { studentName } from '../data/students'

/**
 * Give: a church-wide activity or one of the class's own, at its set value.
 * Remove: always DEDUCTION_POINTS, with a reason. The page sends which, never
 * how many: this is a public endpoint, and the value is the activity's.
 */
const GiveSchema = z.object({
  classId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).min(1).max(200),
  mode: z.enum(['add', 'remove']),
  activityId: z.string().min(1).max(64).optional(),
  reason: z.string().trim().max(200).optional(),
})

export type GivePointsInput = z.infer<typeof GiveSchema>

export async function givePoints(raw: GivePointsInput): Promise<ActionResult<{ count: number; points: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = GiveSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'points.write')

    const activity =
      input.mode === 'add' && input.activityId
        ? await prisma.pointActivity.findUnique({
            where: { id: input.activityId },
            select: { classId: true, isActive: true, points: true, key: true, label: true },
          })
        : null
    const resolved = resolveManualPoints(input.mode, activity, input.reason, cls.id)
    if (!resolved.ok) throw new PortalError(resolved.error)

    const students = await prisma.student.findMany({
      where: { AND: [{ id: { in: input.studentIds } }, rosterWhere(cls.id)] },
      select: { id: true, firstName: true, lastName: true },
    })
    if (students.length === 0) throw new PortalError('Those students are not in this class.')

    // §5: one student, one deduction — never below zero. A bulk deduction over a
    // whole class is left uncapped, as the rule says.
    let points = resolved.points
    if (points < 0 && students.length === 1) {
      const balance = await prisma.pointEntry.aggregate({ where: { studentId: students[0].id }, _sum: { points: true } })
      points = capDeduction(points, balance._sum.points ?? 0)
      if (points === 0) throw new PortalError(`${studentName(students[0])} has no points left to take away.`)
    }

    await prisma.pointEntry.createMany({
      data: students.map((s) => ({
        studentId: s.id,
        classId: cls.id,
        points,
        source: 'MANUAL' as const,
        activityKey: resolved.activityKey,
        activityLabel: resolved.label,
        reason: resolved.reason,
        createdById: user.accountId,
      })),
    })

    const who = students.length <= 3 ? students.map(studentName).join(', ') : `${students.length} students`
    await audit(user, 'points.give', 'class', cls.id, `${cls.name}: ${points > 0 ? '+' : ''}${points} "${resolved.label}" to ${who}`)

    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    revalidatePath('/portal/leaderboard')
    revalidatePath('/portal')
    return { count: students.length, points }
  })
}

export async function undoPoints(entryId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const entry = await prisma.pointEntry.findUnique({
      where: { id: entryId },
      select: { id: true, studentId: true, classId: true, points: true, source: true, undone: true, undoOfId: true, activityLabel: true, student: { select: { firstName: true, lastName: true, classId: true } } },
    })
    if (!entry) throw new PortalError('Entry not found.')
    const classId = entry.classId ?? entry.student.classId
    if (!classId) throw new PortalError('This student has no class.')
    const cls = await assertClassAction(user, classId, 'points.write')
    if (!canUndo(entry)) throw new PortalError('This entry cannot be undone.')

    await prisma.$transaction([
      prisma.pointEntry.update({ where: { id: entry.id }, data: { undone: true } }),
      prisma.pointEntry.create({
        data: {
          studentId: entry.studentId,
          classId,
          points: -entry.points,
          source: 'UNDO',
          activityLabel: `Undo: ${entry.activityLabel}`,
          undoOfId: entry.id,
          createdById: user.accountId,
        },
      }),
    ])

    await audit(user, 'points.undo', 'student', entry.studentId, `${cls.name}: undid ${entry.points > 0 ? '+' : ''}${entry.points} "${entry.activityLabel}" for ${studentName(entry.student)}`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    revalidatePath(`/portal/students/${entry.studentId}`)
    revalidatePath('/portal/leaderboard')
    return undefined
  })
}

/**
 * Who may change an activity. The church-wide list, which every class sees, is
 * the admin's. A class's own activities, at the class's own values, belong to
 * whoever gives that class points (2026-09-28: the church decided classes may
 * count their own way; they could not for one day, from 2026-09-27).
 */
async function requireActivityScope(classId: string | null) {
  const user = await requirePortalUser()
  if (classId) {
    const cls = await assertClassAction(user, classId, 'points.write')
    return { user, cls }
  }
  if (user.role !== 'ADMIN') throw new PortalError('Only the Sunday School admin can change the activities every class sees.')
  return { user, cls: null }
}

function revalidateActivities(classId: string | null): void {
  revalidatePath('/portal/admin/sessions')
  if (classId) revalidatePath(`/portal/classes/${classId}/points`)
  // The church-wide list is on every class's Points page and the QR pickers.
  else revalidatePath('/portal', 'layout')
}

const ActivitySchema = z.object({
  /** A class's own activity; none for the church-wide list. */
  classId: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(60),
  points: z.number().int().min(ACTIVITY_POINTS_MIN).max(ACTIVITY_POINTS_MAX),
  icon: z.string().trim().max(8).optional(),
})

export async function createActivity(raw: z.infer<typeof ActivitySchema>): Promise<ActionResult> {
  return runAction(async () => {
    const input = ActivitySchema.parse(raw)
    const { user, cls } = await requireActivityScope(input.classId ?? null)
    const classId = cls?.id ?? null
    const key = input.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `activity-${Date.now()}`
    // Matched by name as well as key: activities brought over from the old app
    // carry its random ids as keys, so "Homework" is not keyed "homework".
    const sameName = (a: { key: string; label: string }) => a.key === key || a.label.trim().toLowerCase() === input.label.toLowerCase()
    const listed = await prisma.pointActivity.findMany({
      where: { isActive: true, OR: [{ classId: null }, ...(classId ? [{ classId }] : [])] },
      select: { classId: true, key: true, label: true },
    })
    // Two chips of the same name at different values is the muddle the
    // church-wide list exists to prevent.
    const everyClass = cls ? listed.find((a) => a.classId === null && sameName(a)) : undefined
    if (everyClass) throw new PortalError(`Every class already has "${everyClass.label}". Use that one, or pick another name.`)
    if (listed.some((a) => a.classId === classId && sameName(a))) throw new PortalError('An activity with that name already exists.')
    // findFirst, not findUnique: the compound key cannot be looked up with a null classId.
    const exists = await prisma.pointActivity.findFirst({ where: { classId, key } })
    if (exists) {
      await prisma.pointActivity.update({ where: { id: exists.id }, data: { isActive: true, label: input.label, points: input.points, icon: input.icon || null } })
    } else {
      await prisma.pointActivity.create({
        data: { classId, key, label: input.label, points: input.points, icon: input.icon || null, createdById: user.accountId },
      })
    }
    await audit(
      user,
      'activity.create',
      cls ? 'class' : 'portal',
      classId,
      cls ? `${cls.name}: activity "${input.label}" (+${input.points})` : `Point activity "${input.label}" (+${input.points}) for every class`,
    )
    revalidateActivities(classId)
    return undefined
  })
}

const UpdateActivitySchema = ActivitySchema.omit({ classId: true }).extend({ activityId: z.string().min(1) })

/**
 * Rename an activity or change what it is worth, where it applies: every class
 * for a church-wide one, its own class otherwise. The stable `key` is left
 * alone deliberately: it is what past entries were recorded against. Points
 * already given keep the value they were given at.
 */
export async function updateActivity(raw: z.infer<typeof UpdateActivitySchema>): Promise<ActionResult> {
  return runAction(async () => {
    const input = UpdateActivitySchema.parse(raw)
    await requirePortalUser()
    const act = await prisma.pointActivity.findUnique({ where: { id: input.activityId }, select: { id: true, classId: true, label: true, points: true } })
    if (!act) throw new PortalError('Activity not found.')
    const { user, cls } = await requireActivityScope(act.classId)
    await prisma.pointActivity.update({
      where: { id: act.id },
      data: { label: input.label, points: input.points, icon: input.icon || null },
    })
    await audit(
      user,
      'activity.update',
      cls ? 'class' : 'portal',
      act.classId,
      `${cls ? `${cls.name}: ` : ''}Point activity "${act.label}" (+${act.points}) → "${input.label}" (+${input.points})`,
    )
    revalidateActivities(act.classId)
    return undefined
  })
}

/** Switched off, not deleted: past entries still name it. */
export async function removeActivity(activityId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requirePortalUser()
    const act = await prisma.pointActivity.findUnique({ where: { id: activityId }, select: { id: true, classId: true, label: true } })
    if (!act) throw new PortalError('Activity not found.')
    const { user, cls } = await requireActivityScope(act.classId)
    await prisma.pointActivity.update({ where: { id: act.id }, data: { isActive: false } })
    await audit(user, 'activity.remove', cls ? 'class' : 'portal', act.classId, `${cls ? `${cls.name}: ` : ''}Removed point activity "${act.label}"`)
    revalidateActivities(act.classId)
    return undefined
  })
}
