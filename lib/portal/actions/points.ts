'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { canUndo, capDeduction } from '../points-math'
import { audit } from '../audit'
import { studentName } from '../data/students'

const GiveSchema = z.object({
  classId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).min(1).max(200),
  points: z.number().int().min(-100).max(100).refine((n) => n !== 0, 'Points cannot be zero'),
  activityKey: z.string().max(64).nullable().optional(),
  label: z.string().trim().min(1).max(80),
  reason: z.string().trim().max(200).optional(),
})

export type GivePointsInput = z.infer<typeof GiveSchema>

export async function givePoints(raw: GivePointsInput): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = GiveSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'points.write')

    const students = await prisma.student.findMany({
      where: { id: { in: input.studentIds }, classId: cls.id },
      select: { id: true, firstName: true, lastName: true },
    })
    if (students.length === 0) throw new PortalError('Those students are not in this class.')

    // §5: one student, one deduction — never below zero. A bulk deduction over a
    // whole class is left uncapped, as the rule says.
    let points = input.points
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
        activityKey: input.activityKey ?? null,
        activityLabel: input.label,
        reason: input.reason || null,
        createdById: user.accountId,
      })),
    })

    const who = students.length <= 3 ? students.map(studentName).join(', ') : `${students.length} students`
    await audit(user, 'points.give', 'class', cls.id, `${cls.name}: ${points > 0 ? '+' : ''}${points} "${input.label}" to ${who}`)

    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    revalidatePath('/portal/leaderboard')
    revalidatePath('/portal')
    return { count: students.length }
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

const ActivitySchema = z.object({
  classId: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  points: z.number().int().min(-100).max(100),
  icon: z.string().trim().max(8).optional(),
})

export async function createActivity(raw: z.infer<typeof ActivitySchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ActivitySchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'points.write')
    const key = input.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `activity-${Date.now()}`
    const exists = await prisma.pointActivity.findUnique({ where: { classId_key: { classId: cls.id, key } } })
    if (exists) {
      if (exists.isActive) throw new PortalError('An activity with that name already exists.')
      await prisma.pointActivity.update({ where: { id: exists.id }, data: { isActive: true, label: input.label, points: input.points, icon: input.icon || null } })
    } else {
      await prisma.pointActivity.create({
        data: { classId: cls.id, key, label: input.label, points: input.points, icon: input.icon || null, createdById: user.accountId },
      })
    }
    await audit(user, 'activity.create', 'class', cls.id, `${cls.name}: activity "${input.label}" (${input.points})`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    return undefined
  })
}

const UpdateActivitySchema = z.object({
  activityId: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  points: z.number().int().min(-100).max(100),
  icon: z.string().trim().max(8).optional(),
})

/**
 * Rename an activity or change what it is worth.
 *
 * The port could create and delete activities but never edit one, so fixing a
 * typo or adjusting a value meant deleting and recreating — which orphans the
 * label already written onto every past point entry. The stable `key` is left
 * alone deliberately: it is what past entries were recorded against.
 */
export async function updateActivity(raw: z.infer<typeof UpdateActivitySchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = UpdateActivitySchema.parse(raw)
    const act = await prisma.pointActivity.findUnique({
      where: { id: input.activityId },
      select: { id: true, classId: true, label: true },
    })
    if (!act || !act.classId) throw new PortalError('Activity not found.')
    const cls = await assertClassAction(user, act.classId, 'points.write')
    await prisma.pointActivity.update({
      where: { id: act.id },
      data: { label: input.label, points: input.points, icon: input.icon || null },
    })
    await audit(user, 'activity.update', 'class', cls.id, `${cls.name}: activity "${act.label}" → "${input.label}" (${input.points})`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    return undefined
  })
}

export async function removeActivity(activityId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const act = await prisma.pointActivity.findUnique({ where: { id: activityId }, select: { id: true, classId: true, label: true } })
    if (!act || !act.classId) throw new PortalError('Activity not found.')
    const cls = await assertClassAction(user, act.classId, 'points.write')
    await prisma.pointActivity.update({ where: { id: act.id }, data: { isActive: false } })
    await audit(user, 'activity.remove', 'class', cls.id, `${cls.name}: removed activity "${act.label}"`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    return undefined
  })
}
