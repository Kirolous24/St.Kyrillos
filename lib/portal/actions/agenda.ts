'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { toUTCDate } from '../dates'
import { parseCsvRecords } from '../csv'
import {
  AGENDA_ACTIVITIES,
  agendaActivityOrder,
  csvRowsToAgenda,
  normaliseWeekStart,
  resolveActivityKey,
  safeUrl,
  weekLabel,
  TEACHING_WRITE,
  type AgendaActivityKey,
} from '../agenda'
import { classServants } from '../data/agenda'
import { audit } from '../audit'

const ItemSchema = z.object({
  activityKey: z.string().min(1).max(40),
  topic: z.string().trim().max(200).optional(),
  servantId: z.string().trim().optional(),
})

const WeekSchema = z.object({
  classId: z.string().min(1),
  weekStart: z.string().min(1),
  slideLink: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  leadServantId: z.string().trim().optional(),
  backupServantId: z.string().trim().optional(),
  items: z.array(ItemSchema).max(40).optional(),
})

export type SaveAgendaWeekInput = z.infer<typeof WeekSchema>

/** Only servants who serve the class may be named on its agenda. */
async function servantIdsOn(classId: string): Promise<Set<string>> {
  const rows = await prisma.classServant.findMany({ where: { classId }, select: { servantId: true } })
  return new Set(rows.map((r) => r.servantId))
}

function requireServant(allowed: Set<string>, id: string | undefined, what: string): string | null {
  const value = (id ?? '').trim()
  if (!value) return null
  if (!allowed.has(value)) throw new PortalError(`The ${what} must be a servant on this class.`)
  return value
}

interface ResolvedItem {
  activityKey: AgendaActivityKey
  topic: string | null
  servantId: string | null
}

/**
 * Write one week and its ten activities in a single transaction: a half-saved
 * agenda (the prototype's unbatched writes, §7) would silently lose rows.
 */
async function writeWeek(
  classId: string,
  weekStart: string,
  week: {
    slideLink: string | null
    notes: string | null
    leadServantId: string | null
    backupServantId: string | null
  },
  items: ResolvedItem[],
): Promise<void> {
  const monday = toUTCDate(weekStart)
  await prisma.$transaction(async (tx) => {
    const row = await tx.agendaWeek.upsert({
      where: { classId_weekStart: { classId, weekStart: monday } },
      create: { classId, weekStart: monday, ...week },
      update: week,
      select: { id: true },
    })
    for (const item of items) {
      const payload = {
        topic: item.topic,
        servantId: item.servantId,
        sortOrder: agendaActivityOrder(item.activityKey),
      }
      await tx.agendaItem.upsert({
        where: { weekId_activityKey: { weekId: row.id, activityKey: item.activityKey } },
        create: { weekId: row.id, activityKey: item.activityKey, ...payload },
        update: payload,
      })
    }
  })
}

function revalidateAgenda(classId: string): void {
  revalidatePath('/portal/agenda')
  revalidatePath('/portal/agenda/week')
  revalidatePath('/portal/assignments')
  revalidatePath('/portal')
  void classId
}

export async function saveAgendaWeek(raw: SaveAgendaWeekInput): Promise<ActionResult<{ weekStart: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = WeekSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, TEACHING_WRITE)

    const monday = normaliseWeekStart(input.weekStart)
    if (!monday) throw new PortalError('Pick a valid week.')

    const allowed = await servantIdsOn(cls.id)
    const lead = requireServant(allowed, input.leadServantId, 'lead servant')
    const backup = requireServant(allowed, input.backupServantId, 'backup servant')
    const slideLink = input.slideLink ? safeUrl(input.slideLink) : null
    if (input.slideLink && !slideLink) throw new PortalError('The slide link must be a http or https address.')

    const byKey = new Map<AgendaActivityKey, ResolvedItem>()
    for (const item of input.items ?? []) {
      const key = resolveActivityKey(item.activityKey)
      if (!key || byKey.has(key)) continue
      byKey.set(key, {
        activityKey: key,
        topic: (item.topic ?? '').trim() || null,
        servantId: requireServant(allowed, item.servantId, `servant for ${key}`),
      })
    }
    // Every activity is written, so clearing a field actually clears it.
    const items: ResolvedItem[] = AGENDA_ACTIVITIES.map(
      (a) => byKey.get(a.key) ?? { activityKey: a.key, topic: null, servantId: null },
    )

    await writeWeek(cls.id, monday, { slideLink, notes: input.notes || null, leadServantId: lead, backupServantId: backup }, items)

    const filled = items.filter((i) => i.topic || i.servantId).length
    await audit(user, 'agenda.save', 'class', cls.id, `${cls.name}: agenda for ${weekLabel(monday)} (${filled}/10 filled)`)
    revalidateAgenda(cls.id)
    return { weekStart: monday }
  })
}

const ShareSchema = z.object({
  classId: z.string().min(1),
  weekStart: z.string().min(1),
  toClassId: z.string().min(1),
})

/**
 * Copy this week's agenda into another class. The prototype swapped the two
 * documents (ANALYSIS §6), which wiped the source; this only reads the source.
 * Servant assignments carry over only for servants who also serve the target.
 */
export async function shareAgendaWeek(
  raw: z.infer<typeof ShareSchema>,
): Promise<ActionResult<{ carried: number; dropped: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ShareSchema.parse(raw)
    if (input.classId === input.toClassId) throw new PortalError('Pick a different class to share with.')

    const source = await assertClassAction(user, input.classId, 'class.read')
    const target = await assertClassAction(user, input.toClassId, TEACHING_WRITE)
    const monday = normaliseWeekStart(input.weekStart)
    if (!monday) throw new PortalError('Pick a valid week.')

    const week = await prisma.agendaWeek.findUnique({
      where: { classId_weekStart: { classId: source.id, weekStart: toUTCDate(monday) } },
      select: {
        slideLink: true,
        notes: true,
        leadServantId: true,
        backupServantId: true,
        items: { select: { activityKey: true, topic: true, servantId: true } },
      },
    })
    if (!week) throw new PortalError(`${source.name} has no agenda saved for that week.`)

    const allowed = await servantIdsOn(target.id)
    const keep = (id: string | null) => (id && allowed.has(id) ? id : null)
    let carried = 0
    let dropped = 0

    const byKey = new Map<AgendaActivityKey, ResolvedItem>()
    for (const item of week.items) {
      const key = resolveActivityKey(item.activityKey)
      if (!key) continue
      const servantId = keep(item.servantId)
      if (item.servantId) {
        if (servantId) carried++
        else dropped++
      }
      byKey.set(key, { activityKey: key, topic: item.topic, servantId })
    }
    const items: ResolvedItem[] = AGENDA_ACTIVITIES.map(
      (a) => byKey.get(a.key) ?? { activityKey: a.key, topic: null, servantId: null },
    )

    await writeWeek(
      target.id,
      monday,
      {
        slideLink: week.slideLink,
        notes: week.notes,
        leadServantId: keep(week.leadServantId),
        backupServantId: keep(week.backupServantId),
      },
      items,
    )

    await audit(user, 'agenda.share', 'class', target.id, `Copied ${source.name}'s agenda for ${weekLabel(monday)} into ${target.name}`)
    revalidateAgenda(target.id)
    return { carried, dropped }
  })
}

const ImportSchema = z.object({
  classId: z.string().min(1),
  csv: z.string().min(1).max(500_000),
})

/**
 * Import the CSV this page exports. Servants are matched by display name
 * against the class's own servants; a name that does not match is left blank
 * rather than silently attached to the wrong person.
 */
export async function importAgendaCsv(
  raw: z.infer<typeof ImportSchema>,
): Promise<ActionResult<{ weeks: number; skippedRows: number; unmatchedNames: string[] }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ImportSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, TEACHING_WRITE)

    const { weeks, skipped } = csvRowsToAgenda(parseCsvRecords(input.csv))
    if (weeks.length === 0) {
      throw new PortalError('No usable rows found. The file needs a "Week Start" and an "Activity" column.')
    }
    if (weeks.length > 60) throw new PortalError('That file covers more than 60 weeks. Split it up first.')

    const servants = await classServants(cls.id)
    const byName = new Map(servants.map((s) => [s.name.trim().toLowerCase(), s.id]))
    const unmatched = new Set<string>()
    const match = (name: string | null): string | null => {
      if (!name) return null
      const id = byName.get(name.trim().toLowerCase())
      if (!id) unmatched.add(name.trim())
      return id ?? null
    }

    for (const week of weeks) {
      await writeWeek(
        cls.id,
        week.weekStart,
        {
          slideLink: week.slideLink ? safeUrl(week.slideLink) : null,
          notes: week.notes,
          leadServantId: match(week.leadServantName),
          backupServantId: match(week.backupServantName),
        },
        week.items.map((i) => ({
          activityKey: i.activityKey,
          topic: i.topic,
          servantId: match(i.servantName),
        })),
      )
    }

    await audit(user, 'agenda.import', 'class', cls.id, `${cls.name}: imported ${weeks.length} week${weeks.length === 1 ? '' : 's'} of agenda`)
    revalidateAgenda(cls.id)
    return { weeks: weeks.length, skippedRows: skipped, unmatchedNames: Array.from(unmatched).slice(0, 12) }
  })
}

const ClearSchema = z.object({ classId: z.string().min(1), weekStart: z.string().min(1) })

export async function clearAgendaWeek(raw: z.infer<typeof ClearSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ClearSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, TEACHING_WRITE)
    const monday = normaliseWeekStart(input.weekStart)
    if (!monday) throw new PortalError('Pick a valid week.')

    const week = await prisma.agendaWeek.findUnique({
      where: { classId_weekStart: { classId: cls.id, weekStart: toUTCDate(monday) } },
      select: { id: true },
    })
    if (!week) throw new PortalError('There is nothing saved for that week.')

    await prisma.agendaWeek.delete({ where: { id: week.id } })
    await audit(user, 'agenda.clear', 'class', cls.id, `${cls.name}: cleared the agenda for ${weekLabel(monday)}`)
    revalidateAgenda(cls.id)
    return undefined
  })
}
