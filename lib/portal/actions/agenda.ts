'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { formatDateOnly, toUTCDate } from '../dates'
import { parseCsvRecords } from '../csv'
import {
  AGENDA_ACTIVITIES,
  agendaActivityOrder,
  csvRowsToAgenda,
  isLegacyAgendaCsv,
  legacyAgendaCsvToRecords,
  normaliseWeekStart,
  resolveActivityKey,
  safeUrl,
  weekLabel,
  TEACHING_WRITE,
  type AgendaActivityKey,
} from '../agenda'
import { agendaServantOptions } from '../data/agenda'
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

/**
 * Any active servant may be named on a class's agenda, not only its own team.
 * The prototype grouped the dropdown 'This Class' / 'Other Classes' precisely
 * so a borrowed servant could be recorded; scoping the allow-list to the class
 * made that impossible and the server rejected the id even if it got there.
 */
async function assignableServantIds(classId: string): Promise<Set<string>> {
  const { onClass, others } = await agendaServantOptions(classId)
  return new Set([...onClass, ...others].map((s) => s.id))
}

function requireServant(allowed: Set<string>, id: string | undefined, what: string): string | null {
  const value = (id ?? '').trim()
  if (!value) return null
  if (!allowed.has(value)) throw new PortalError(`The ${what} must be an active servant.`)
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

    const allowed = await assignableServantIds(cls.id)
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

    const allowed = await assignableServantIds(target.id)
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
  /** Report what the file would do, and write nothing. */
  preview: z.boolean().optional(),
})

/** One week of an agenda import, and what it would do to what is already there. */
export interface AgendaImportWeek {
  weekStart: string
  label: string
  /** Activities the file fills in for this week. */
  filled: number
  /** Activities already filled in on the stored week. */
  existingFilled: number
  /** Already-filled activities this import would replace. */
  willOverwrite: number
  /** Already-filled activities the file leaves empty, which the write blanks. */
  willBlank: number
}

export interface AgendaImportReport {
  weeks: number
  skippedRows: number
  /**
   * F0797 — which rows, and why. "12 rows skipped" told a servant nothing they
   * could act on; this names the line and the column. Capped at 12, and the count
   * above stays the true total so the list can never read as the whole story.
   */
  skippedDetail: Array<{ row: number; reason: string }>
  unmatchedNames: string[]
  preview: boolean
  plan: AgendaImportWeek[]
  /**
   * F0216 — true when the file was recognised as one exported from the old
   * Firebase app and pivoted before importing. Surfaced so the preview can say
   * so: an admin who expected the file to fail should be told why it did not,
   * and one whose file goes in wrong needs to know which reader ran.
   */
  legacyFormat: boolean
}

/**
 * Import the CSV this page exports. Servants are matched by display name
 * against the class's own servants; a name that does not match is left blank
 * rather than silently attached to the wrong person.
 */
export async function importAgendaCsv(raw: z.infer<typeof ImportSchema>): Promise<ActionResult<AgendaImportReport>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ImportSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, TEACHING_WRITE)

    // F0216 — a schedule exported from the old Firebase app is a different file:
    // one row per week, 26 columns, with the date in its own column and the ten
    // activities spread across pairs of columns. It used to import as nothing at
    // all, because its "Week" column reads "1st Week of SEP" and every row was
    // skipped for having no date. It is pivoted into this portal's shape and then
    // goes through exactly the same importer, so there is one set of rules about
    // what a valid week is.
    const parsed = parseCsvRecords(input.csv)
    const legacyFormat = isLegacyAgendaCsv(parsed)
    const rows = legacyFormat ? legacyAgendaCsvToRecords(parsed) : parsed

    const { weeks, skipped, skippedRowDetail } = csvRowsToAgenda(rows)
    if (weeks.length === 0) {
      throw new PortalError(
        legacyFormat
          ? 'That looks like a schedule from the old app, but none of its rows had a usable date in the "Date" column.'
          : 'No usable rows found. The file needs a "Week Start" and an "Activity" column.',
      )
    }
    if (weeks.length > 60) throw new PortalError('That file covers more than 60 weeks. Split it up first.')

    const options = await agendaServantOptions(cls.id)
    const servants = [...options.onClass, ...options.others]
    const byName = new Map(servants.map((s) => [s.name.trim().toLowerCase(), s.id]))
    const unmatched = new Set<string>()
    const match = (name: string | null): string | null => {
      if (!name) return null
      const id = byName.get(name.trim().toLowerCase())
      if (!id) unmatched.add(name.trim())
      return id ?? null
    }

    // What the file would do to weeks that already have content. `writeWeek`
    // writes every activity so that clearing a field really clears it — which
    // also means an import silently blanks anything the file leaves empty.
    // Nobody was told, and an agenda planned for a term could vanish behind a
    // partial spreadsheet.
    const stored = await prisma.agendaWeek.findMany({
      where: { classId: cls.id, weekStart: { in: weeks.map((w) => toUTCDate(w.weekStart)) } },
      select: {
        weekStart: true,
        items: { select: { activityKey: true, topic: true, servantId: true } },
      },
    })
    const storedByWeek = new Map(stored.map((w) => [formatDateOnly(w.weekStart), w.items]))

    const plan: AgendaImportWeek[] = weeks.map((week) => {
      const incoming = new Map<string, (typeof week.items)[number]>(week.items.map((i) => [String(i.activityKey), i]))
      const existing = storedByWeek.get(week.weekStart) ?? []
      const existingFilled = existing.filter((i) => i.topic || i.servantId)
      let willOverwrite = 0
      let willBlank = 0
      for (const e of existingFilled) {
        const next = incoming.get(e.activityKey)
        if (next && (next.topic || next.servantName)) willOverwrite += 1
        else willBlank += 1
      }
      return {
        weekStart: week.weekStart,
        label: weekLabel(week.weekStart),
        filled: week.items.filter((i) => i.topic || i.servantName).length,
        existingFilled: existingFilled.length,
        willOverwrite,
        willBlank,
      }
    })

    if (input.preview) {
      // Nothing written, so nothing logged and nothing invalidated.
      return {
        weeks: weeks.length,
        skippedRows: skipped,
        skippedDetail: skippedRowDetail.slice(0, 12),
        unmatchedNames: Array.from(unmatched).slice(0, 12),
        preview: true,
        plan,
        legacyFormat,
      }
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

    const overwritten = plan.reduce((n, w) => n + w.willOverwrite + w.willBlank, 0)
    await audit(
      user,
      'agenda.import',
      'class',
      cls.id,
      `${cls.name}: imported ${weeks.length} week${weeks.length === 1 ? '' : 's'} of agenda${overwritten > 0 ? `, replacing ${overwritten} filled activit${overwritten === 1 ? 'y' : 'ies'}` : ''}`,
    )
    revalidateAgenda(cls.id)
    return {
      weeks: weeks.length,
      skippedRows: skipped,
      skippedDetail: skippedRowDetail.slice(0, 12),
      unmatchedNames: Array.from(unmatched).slice(0, 12),
      preview: false,
      plan,
      legacyFormat,
    }
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

const ClearManySchema = z.object({
  classId: z.string().min(1),
  weekStarts: z.array(z.string().min(1)).min(1).max(60),
})

/**
 * F0221 / F0490 / F0585 / F0586 — clear several weeks of the year plan at once.
 *
 * A servant who filled September against the wrong class, or imported a
 * schedule a week out of step, had to open and clear each week one at a time.
 * The old app had tick boxes on the year list and a "Clear Selected Weeks"
 * button, and this is that.
 *
 * It deletes a servant's lesson planning, so the caller confirms with the count
 * and the weeks in front of them. Weeks that were never filled are skipped
 * rather than failing the batch — ticking an empty week is harmless, and an
 * all-or-nothing batch would make the whole action fail on one stale tile.
 */
export async function clearAgendaWeeks(raw: z.infer<typeof ClearManySchema>): Promise<ActionResult<{ cleared: number; skipped: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ClearManySchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, TEACHING_WRITE)

    const mondays: string[] = []
    for (const raw of Array.from(new Set(input.weekStarts))) {
      const monday = normaliseWeekStart(raw)
      if (!monday) throw new PortalError(`"${raw}" is not a valid week.`)
      mondays.push(monday)
    }

    const weeks = await prisma.agendaWeek.findMany({
      where: { classId: cls.id, weekStart: { in: mondays.map((m) => toUTCDate(m)) } },
      select: { id: true, weekStart: true },
    })
    if (weeks.length === 0) throw new PortalError('None of those weeks has anything saved.')

    await prisma.agendaWeek.deleteMany({ where: { id: { in: weeks.map((w) => w.id) } } })
    const labels = weeks
      .map((w) => weekLabel(formatDateOnly(w.weekStart)))
      .slice(0, 12)
      .join(', ')
    await audit(
      user,
      'agenda.clearMany',
      'class',
      cls.id,
      `${cls.name}: cleared ${weeks.length} week${weeks.length === 1 ? '' : 's'} — ${labels}${weeks.length > 12 ? `, and ${weeks.length - 12} more` : ''}`,
    )
    revalidateAgenda(cls.id)
    return { cleared: weeks.length, skipped: mondays.length - weeks.length }
  })
}
