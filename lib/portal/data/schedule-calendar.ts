import { prisma } from '@/lib/prisma'
import { resolveActivityKey } from '../agenda'
import { addDays, formatDateOnly, toUTCDate } from '../dates'
import type { RotationCell, RotationRole } from '../rotation'

/**
 * A class's Schedule over a month or a semester (2026-11-01): who holds which
 * part on each Sunday, for the Calendar tab, and the same as rotation cells,
 * so a rotation counts what is already there and carries each part's turns on.
 */

/** How far back a rotation looks to carry each part's turns on. */
export const ROTATION_LOOKBACK_WEEKS = 26

export interface CalendarCell {
  servantId: string
  name: string
  done: boolean
}

export interface CalendarRow {
  /** The Sunday, YYYY-MM-DD. */
  sunday: string
  /** Its week's Monday, as the Schedule stores it. */
  weekStart: string
  cells: Partial<Record<RotationRole, CalendarCell>>
  /** How many of the ten parts have a topic. */
  topics: number
}

const WEEK_SELECT = {
  weekStart: true,
  leadServantId: true,
  backupServantId: true,
  leadServant: { select: { account: { select: { displayName: true } } } },
  backupServant: { select: { account: { select: { displayName: true } } } },
  items: {
    select: {
      activityKey: true,
      topic: true,
      servantId: true,
      doneAt: true,
      servant: { select: { account: { select: { displayName: true } } } },
    },
  },
} as const

/** Each of these Sundays of one class, filled in where the Schedule has it. */
export async function classCalendar(classId: string, sundays: readonly string[]): Promise<CalendarRow[]> {
  if (sundays.length === 0) return []
  const mondays = sundays.map((s) => addDays(s, -6))
  const weeks = await prisma.agendaWeek.findMany({
    where: { classId, weekStart: { in: mondays.map((m) => toUTCDate(m)) } },
    select: WEEK_SELECT,
  })
  const byMonday = new Map(weeks.map((w) => [formatDateOnly(w.weekStart), w]))
  return sundays.map((sunday, i) => {
    const week = byMonday.get(mondays[i]!)
    const cells: CalendarRow['cells'] = {}
    let topics = 0
    for (const item of week?.items ?? []) {
      const key = resolveActivityKey(item.activityKey)
      if (!key) continue
      if ((item.topic ?? '').trim()) topics++
      if (item.servantId && !cells[key]) {
        cells[key] = { servantId: item.servantId, name: item.servant?.account.displayName ?? 'Unknown', done: !!item.doneAt }
      }
    }
    if (week?.leadServantId) cells.lead = { servantId: week.leadServantId, name: week.leadServant?.account.displayName ?? 'Unknown', done: false }
    if (week?.backupServantId) cells.backup = { servantId: week.backupServantId, name: week.backupServant?.account.displayName ?? 'Unknown', done: false }
    return { sunday, weekStart: mondays[i]!, cells, topics }
  })
}

/** Every part held in a class between two Mondays, both included, as rotation cells. */
export async function heldCells(classId: string, fromMonday: string, toMonday: string): Promise<RotationCell[]> {
  const weeks = await prisma.agendaWeek.findMany({
    where: { classId, weekStart: { gte: toUTCDate(fromMonday), lte: toUTCDate(toMonday) } },
    select: { weekStart: true, leadServantId: true, backupServantId: true, items: { select: { activityKey: true, servantId: true } } },
  })
  const out: RotationCell[] = []
  for (const w of weeks) {
    const weekStart = formatDateOnly(w.weekStart)
    const seen = new Set<string>()
    for (const item of w.items) {
      const key = resolveActivityKey(item.activityKey)
      if (!key || !item.servantId || seen.has(key)) continue
      seen.add(key)
      out.push({ weekStart, role: key, servantId: item.servantId })
    }
    if (w.leadServantId) out.push({ weekStart, role: 'lead', servantId: w.leadServantId })
    if (w.backupServantId) out.push({ weekStart, role: 'backup', servantId: w.backupServantId })
  }
  return out.sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
}
