'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { addDays, churchToday, formatDateOnly, toUTCDate } from '../dates'
import { formatShortDate } from '../format'
import { agendaActivityOrder, normaliseWeekStart } from '../agenda'
import { MAX_ROTATION_SUNDAYS, isRotationRole, planRotation, rotationSundays, type RotationCell, type RotationRole } from '../rotation'
import { ROTATION_LOOKBACK_WEEKS, heldCells } from '../data/schedule-calendar'
import { weekDuties } from '../data/duties'
import { withDutyNotices } from '../with-duty-notices'
import { audit } from '../audit'

/**
 * The Schedule's rotation (2026-11-01): a coordinator fills a month or a
 * semester of Sunday parts at once, taking turns so nobody does a part again
 * before everyone has (lib/portal/rotation.ts). Making one writes nothing; the
 * coordinator looks it over, makes another if they like, and saves it. The
 * class's Coordinator and Assistant Coordinator, its stage overseer and the
 * admin may do it: the same people who arrange its follow-up groups.
 */

const RangeSchema = z.object({
  classId: z.string().min(1).max(100),
  from: z.string().min(1).max(20),
  to: z.string().min(1).max(20),
  /** Leave parts that already have someone as they are. */
  keepExisting: z.boolean(),
})

const PlanSchema = RangeSchema.extend({
  roles: z.array(z.string().min(1).max(40)).min(1).max(12),
  servantIds: z.array(z.string().min(1).max(100)).min(1).max(60),
})

const SaveSchema = RangeSchema.extend({
  cells: z
    .array(z.object({ weekStart: z.string().min(1).max(20), role: z.string().min(1).max(40), servantId: z.string().min(1).max(100) }))
    .min(1)
    .max(MAX_ROTATION_SUNDAYS * 12),
})

/** The weeks (Mondays) a rotation covers: never today or a past Sunday. */
function rotationWeeks(from: string, to: string): { weeks: string[]; clipped: boolean } {
  const range = rotationSundays(from, to, churchToday())
  if ('error' in range) throw new PortalError(range.error)
  return { weeks: range.sundays.map((s) => addDays(s, -6)), clipped: range.clipped }
}

/** These servants' names, refusing anyone who no longer serves. */
async function servingNames(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids))
  const rows = await prisma.servant.findMany({
    where: { id: { in: unique }, account: { isActive: true } },
    select: { id: true, account: { select: { displayName: true } } },
  })
  if (rows.length !== unique.length) throw new PortalError('One of those servants no longer serves. Refresh the page and try again.')
  return new Map(rows.map((r) => [r.id, r.account.displayName]))
}

export interface RotationPreview {
  /** The weeks it fills, as Mondays. */
  weeks: string[]
  roles: RotationRole[]
  /** Who it would put on each part. */
  cells: RotationCell[]
  /** Parts already held in those weeks that stay as they are. */
  kept: RotationCell[]
  names: Record<string, string>
  /** Parts given to someone again early, because nobody else could take them. */
  repeats: number
  /** The range began before the coming Sunday, so it starts there instead. */
  clipped: boolean
}

export async function planScheduleRotation(raw: z.infer<typeof PlanSchema>): Promise<ActionResult<RotationPreview>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = PlanSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'group.manage')
    const roles = Array.from(new Set(input.roles))
    if (!roles.every(isRotationRole)) throw new PortalError('Pick the parts from the list.')
    const { weeks, clipped } = rotationWeeks(input.from, input.to)
    const names = await servingNames(input.servantIds)

    const first = weeks[0]!
    const [held, history] = await Promise.all([
      heldCells(cls.id, first, weeks[weeks.length - 1]!),
      heldCells(cls.id, addDays(first, -7 * ROTATION_LOOKBACK_WEEKS), addDays(first, -7)),
    ])
    const chosen = new Set<string>(roles)
    const kept = held.filter((c) => input.keepExisting || !chosen.has(c.role))
    const plan = planRotation({ weeks, roles, servants: Array.from(names.keys()), kept, history })

    // Someone from another class may be kept on a part; the preview names them too.
    const others = Array.from(new Set(kept.map((c) => c.servantId).filter((id) => !names.has(id))))
    if (others.length > 0) {
      const rows = await prisma.servant.findMany({ where: { id: { in: others } }, select: { id: true, account: { select: { displayName: true } } } })
      for (const r of rows) names.set(r.id, r.account.displayName)
    }
    return { weeks, roles, cells: plan.cells, kept, names: Object.fromEntries(names), repeats: plan.repeats, clipped }
  })
}

/**
 * Save a rotation the coordinator has looked over. Each part keeps its topic;
 * a part that changes hands loses its done mark, as on the Schedule. When
 * keeping what is there, a part someone filled since the rotation was made is
 * left alone. Everyone who gains or loses a part is told once for the lot.
 */
export async function saveScheduleRotation(
  raw: z.infer<typeof SaveSchema>,
): Promise<ActionResult<{ saved: number; kept: number; weeks: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = SaveSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, 'group.manage')
    const inRange = new Set(rotationWeeks(input.from, input.to).weeks)

    const seen = new Set<string>()
    const cells: RotationCell[] = []
    for (const c of input.cells) {
      const weekStart = normaliseWeekStart(c.weekStart)
      if (!weekStart || weekStart !== c.weekStart || !inRange.has(weekStart)) throw new PortalError('That rotation covers other Sundays. Make it again.')
      if (!isRotationRole(c.role)) throw new PortalError('Pick the parts from the list.')
      if (seen.has(`${weekStart}|${c.role}`)) throw new PortalError('A part appears twice in that rotation. Make it again.')
      seen.add(`${weekStart}|${c.role}`)
      cells.push({ weekStart, role: c.role, servantId: c.servantId })
    }
    await servingNames(cells.map((c) => c.servantId))
    const touched = Array.from(new Set(cells.map((c) => c.weekStart))).sort()

    let saved = 0
    let kept = 0
    const written = new Set<string>()
    await withDutyNotices(
      () => weekDuties(cls.id, touched),
      user.servantId ?? null,
      () =>
        prisma.$transaction(
          async (tx) => {
            const current = await tx.agendaWeek.findMany({
              where: { classId: cls.id, weekStart: { in: touched.map((w) => toUTCDate(w)) } },
              select: { weekStart: true, leadServantId: true, backupServantId: true, items: { select: { activityKey: true, servantId: true } } },
            })
            const holder = new Map<string, string | null>()
            for (const w of current) {
              const monday = formatDateOnly(w.weekStart)
              holder.set(`${monday}|lead`, w.leadServantId)
              holder.set(`${monday}|backup`, w.backupServantId)
              for (const i of w.items) holder.set(`${monday}|${i.activityKey}`, i.servantId)
            }
            for (const weekStart of touched) {
              const all = cells.filter((c) => c.weekStart === weekStart)
              const mine = all.filter((c) => !(input.keepExisting && holder.get(`${weekStart}|${c.role}`)))
              kept += all.length - mine.length
              if (mine.length === 0) continue
              const duties: { leadServantId?: string; backupServantId?: string } = {}
              for (const c of mine) {
                if (c.role === 'lead') duties.leadServantId = c.servantId
                if (c.role === 'backup') duties.backupServantId = c.servantId
              }
              const row = await tx.agendaWeek.upsert({
                where: { classId_weekStart: { classId: cls.id, weekStart: toUTCDate(weekStart) } },
                create: { classId: cls.id, weekStart: toUTCDate(weekStart), ...duties },
                update: duties,
                select: { id: true },
              })
              for (const c of mine) {
                saved++
                written.add(weekStart)
                if (c.role === 'lead' || c.role === 'backup') continue
                const before = holder.get(`${weekStart}|${c.role}`)
                const handedOver = before !== undefined && before !== c.servantId
                await tx.agendaItem.upsert({
                  where: { weekId_activityKey: { weekId: row.id, activityKey: c.role } },
                  create: { weekId: row.id, activityKey: c.role, servantId: c.servantId, sortOrder: agendaActivityOrder(c.role) },
                  update: { servantId: c.servantId, ...(handedOver ? { doneAt: null, doneById: null } : {}) },
                })
              }
            }
          },
          { timeout: 60_000, maxWait: 10_000 },
        ),
    )

    if (saved > 0) {
      const sundays = Array.from(written).sort().map((w) => addDays(w, 6))
      await audit(
        user,
        'agenda.rotation',
        'class',
        cls.id,
        `${cls.name}: rotation for ${formatShortDate(sundays[0]!)} – ${formatShortDate(sundays[sundays.length - 1]!)} (${sundays.length} Sunday${sundays.length === 1 ? '' : 's'}, ${saved} part${saved === 1 ? '' : 's'}${kept > 0 ? `; ${kept} already filled, left as they were` : ''})`,
      )
      revalidatePath('/portal/agenda')
      revalidatePath('/portal/agenda/week')
      revalidatePath('/portal/agenda/calendar')
      revalidatePath('/portal/assignments')
      revalidatePath('/portal')
    }
    return { saved, kept, weeks: written.size }
  })
}
