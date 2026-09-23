'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { mondayOf, parseDateOnly, todayInNewYork, toUTCDate } from '../dates'
import { canMarkServant } from '../qr'
import { loadServantScope, listServantActivities } from '../data/servant-attendance'

/**
 * Writes behind /portal/servant-attendance. Authorization is decided here, not
 * in the grid: an admin may mark anyone, a servant may always mark themselves,
 * and a coordinator or stage overseer may mark the servants in their scope.
 */

const MarkSchema = z.object({
  servantId: z.string().min(1).max(64),
  activityKey: z.string().min(1).max(64),
  status: z.enum(['PRESENT', 'EXCUSED', 'ABSENT', 'CLEAR']),
  reason: z.string().trim().max(120).optional(),
})

const SaveSchema = z.object({
  weekStart: z.string().max(10),
  marks: z.array(MarkSchema).min(1).max(600),
})

export type SaveServantWeekInput = z.infer<typeof SaveSchema>

export async function saveServantWeek(raw: SaveServantWeekInput): Promise<ActionResult<{ saved: number; cleared: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = SaveSchema.parse(raw)

    const date = parseDateOnly(input.weekStart)
    if (!date) throw new PortalError('Pick a valid week.')
    const weekStart = mondayOf(date)
    const week = toUTCDate(weekStart)

    const [scope, activities] = await Promise.all([loadServantScope(user), listServantActivities()])
    const activityKeys = new Set(activities.map((a) => a.key))
    const scopeServantIds = scope.servants.map((s) => s.id)
    const nameById = new Map(scope.servants.map((s) => [s.id, s.name]))

    for (const mark of input.marks) {
      if (!activityKeys.has(mark.activityKey)) throw new PortalError('Unknown servant activity.')
      const denied = canMarkServant({
        role: user.role,
        servantId: user.servantId,
        isCoordinator: scope.isCoordinator,
        hasStageOversight: scope.hasStageOversight,
        targetServantId: mark.servantId,
        scopeServantIds,
      })
      if (denied) throw new PortalError(denied)
      if (!nameById.has(mark.servantId)) throw new PortalError('That servant is outside the classes you oversee.')
    }

    const toClear = input.marks.filter((m) => m.status === 'CLEAR')
    const toSave = input.marks.filter((m) => m.status !== 'CLEAR')

    await prisma.$transaction(
      async (tx) => {
        if (toClear.length > 0) {
          await tx.servantAttendance.deleteMany({
            where: {
              weekStart: week,
              OR: toClear.map((m) => ({ servantId: m.servantId, activityKey: m.activityKey })),
            },
          })
        }
        for (const mark of toSave) {
          const status = mark.status as 'PRESENT' | 'EXCUSED' | 'ABSENT'
          const reason = status === 'EXCUSED' ? mark.reason?.trim() || null : null
          await tx.servantAttendance.upsert({
            where: {
              servantId_activityKey_weekStart: { servantId: mark.servantId, activityKey: mark.activityKey, weekStart: week },
            },
            create: { servantId: mark.servantId, activityKey: mark.activityKey, weekStart: week, status, reason, markedById: user.accountId },
            update: { status, reason, markedById: user.accountId },
          })
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    )

    const servantCount = new Set(input.marks.map((m) => m.servantId)).size
    await audit(
      user,
      'servant-attendance.save',
      'week',
      weekStart,
      `Week of ${weekStart}: ${toSave.length} mark${toSave.length === 1 ? '' : 's'} across ${servantCount} servant${servantCount === 1 ? '' : 's'}${toClear.length ? `, ${toClear.length} cleared` : ''}`,
    )

    revalidatePath('/portal/servant-attendance')
    revalidatePath('/portal/servant-attendance/report')
    revalidatePath('/portal/my-attendance')
    revalidatePath('/portal')
    return { saved: toSave.length, cleared: toClear.length }
  })
}

const SelfSchema = z.object({
  activityKey: z.string().min(1).max(64),
  weekStart: z.string().max(10).optional(),
  status: z.enum(['PRESENT', 'EXCUSED', 'ABSENT']),
})

/**
 * The servant row the signed-in account records its own attendance against,
 * creating one the first time if the account is staff without a profile.
 *
 * Every servant-attendance surface queried the Servant table, so an ADMIN or
 * PASTOR who also serves on a Sunday had nowhere to record themselves — they
 * never appeared as a row, and this action refused outright. The prototype
 * keyed self check-in on the plain account id, so any signed-in person worked.
 */
async function myServantId(user: { accountId: string; role: string; servantId?: string }): Promise<string> {
  if (user.servantId) return user.servantId
  const existing = await prisma.servant.findUnique({ where: { accountId: user.accountId }, select: { id: true } })
  if (existing) return existing.id
  if (user.role !== 'ADMIN' && user.role !== 'PASTOR' && user.role !== 'SERVANT') {
    throw new PortalError('Only servants record servant attendance.')
  }
  const created = await prisma.servant.create({ data: { accountId: user.accountId }, select: { id: true } })
  return created.id
}

/** One-tap self check-in from the dashboard widget and My Attendance. */
export async function markMyServantAttendance(raw: z.infer<typeof SelfSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = SelfSchema.parse(raw)
    const servantId = await myServantId(user)

    const activity = await prisma.servantActivity.findUnique({ where: { key: input.activityKey } })
    if (!activity || !activity.isActive) throw new PortalError('That servant activity no longer exists.')

    const weekStart = mondayOf(parseDateOnly(input.weekStart) ?? todayInNewYork())
    const week = toUTCDate(weekStart)

    await prisma.servantAttendance.upsert({
      where: { servantId_activityKey_weekStart: { servantId, activityKey: activity.key, weekStart: week } },
      create: { servantId, activityKey: activity.key, weekStart: week, status: input.status, markedById: user.accountId },
      update: { status: input.status, markedById: user.accountId },
    })

    await audit(user, 'servant-attendance.self', 'servant', servantId, `${activity.label}, week of ${weekStart}: ${input.status.toLowerCase()}`)
    revalidatePath('/portal/servant-attendance')
    revalidatePath('/portal/my-attendance')
    revalidatePath('/portal')
    return undefined
  })
}
