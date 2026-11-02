// The Schedule's rotation (2026-11-01): a coordinator fills a month or a
// semester of Sunday parts at once. A servant asked for it: "assign the
// assignments of Sunday school randomly and evenly throughout a given month or
// semester, without repeating assignments until every servant has been able to
// do it once". Pure, so the rules are testable without a database
// (tests/portal/rotation.test.ts).

import { AGENDA_ACTIVITIES, type AgendaActivityKey } from './agenda'
import { comingSunday } from './assignment-notices'
import { sundaysBetween } from './calendar-spans'
import { daysBetween, parseDateOnly } from './dates'

/** A part of a Sunday: one of the ten activities, or Lead or Backup for the week. */
export type RotationRole = AgendaActivityKey | 'lead' | 'backup'

/** The parts a rotation can fill, in the Schedule's running order, then Lead and Backup. */
export const ROTATION_ROLES: ReadonlyArray<{ key: RotationRole; label: string }> = [
  ...AGENDA_ACTIVITIES.map((a) => ({ key: a.key as RotationRole, label: a.label })),
  { key: 'lead', label: 'Lead servant' },
  { key: 'backup', label: 'Backup servant' },
]

const ROLE_KEYS = new Set<string>(ROTATION_ROLES.map((r) => r.key))

export function isRotationRole(key: string): key is RotationRole {
  return ROLE_KEYS.has(key)
}

export function rotationRoleLabel(role: string): string {
  return ROTATION_ROLES.find((r) => r.key === role)?.label ?? role
}

/** The label a narrow column has room for. */
export function rotationRoleShort(role: string): string {
  return ({ saint: 'Saint', bibleStudy: 'Bible Study', lead: 'Lead', backup: 'Backup' } as Record<string, string>)[role] ?? rotationRoleLabel(role)
}

/**
 * The parts a rotation fills unless the coordinator changes it: the parts the
 * class has given anyone lately, or all ten when it has given none (a new
 * class, a new year), plus Lead and Backup if it names them. A class that
 * never names a servant for, say, the Agpeya is not suddenly handed one.
 */
export function defaultRotationRoles(recent: readonly RotationCell[]): RotationRole[] {
  const used = new Set(recent.map((c) => c.role))
  const anyPart = ROTATION_ROLES.some((r) => !isDuty(r.key) && used.has(r.key))
  return ROTATION_ROLES.filter((r) => (isDuty(r.key) ? used.has(r.key) : !anyPart || used.has(r.key))).map((r) => r.key)
}

/** A semester is 17 to 22 Sundays; one run fills at most this many. */
export const MAX_ROTATION_SUNDAYS = 30

/**
 * The Sundays a rotation fills between two days, both included. It starts no
 * earlier than the coming Sunday: today's and past Sundays have happened, and
 * nobody is to be told they are on one. `clipped` says the range was cut so.
 */
export function rotationSundays(from: string, to: string, today: string): { sundays: string[]; clipped: boolean } | { error: string } {
  const first = parseDateOnly(from)
  const last = parseDateOnly(to)
  if (!first || !last) return { error: 'Pick the first and last Sunday.' }
  if (last < first) return { error: 'The last Sunday is before the first.' }
  const earliest = comingSunday(today)
  const sundays = sundaysBetween(first > earliest ? first : earliest, last)
  if (sundays.length === 0) return { error: 'There are no Sundays left to fill between those days.' }
  if (sundays.length > MAX_ROTATION_SUNDAYS) return { error: `That is ${sundays.length} Sundays. Fill ${MAX_ROTATION_SUNDAYS} or fewer at a time.` }
  return { sundays, clipped: first < earliest }
}

/** One servant on one part of one week (its Monday). */
export interface RotationCell {
  weekStart: string
  role: RotationRole
  servantId: string
}

export interface RotationInput {
  /** The weeks to fill, as Monday keys. */
  weeks: readonly string[]
  /** The parts to fill. */
  roles: readonly RotationRole[]
  /** Who takes turns. */
  servants: readonly string[]
  /** Parts already held in these weeks that stay as they are. They count toward everything. */
  kept: readonly RotationCell[]
  /** Parts held in the weeks before, so each part's turns carry on where they were. */
  history: readonly RotationCell[]
  random?: () => number
}

export interface RotationPlan {
  /** The parts to give out; the kept ones are not repeated here. */
  cells: RotationCell[]
  /** Parts given to someone again before everyone had them: only when nothing else fitted. */
  repeats: number
}

// What a choice costs, most important first; each outweighs all of those below.
/** A part again before everyone in the rotation has had it. */
const REPEAT = 10_000_000
/** Each further part one servant holds on the same Sunday. */
const CROWD = 10_000
/** The same part as one Sunday ago (twice this) or two Sundays ago, when a new round starts. */
const RECENT = 2_000
/** Each part the servant already holds in the range: keeps the totals even. */
const UNEVEN = 1_000
/** Lead or Backup for someone who already has many parts that Sunday. */
const BUSY = 100
/** The random part: it only ever breaks ties. */
const NOISE = 10

const isDuty = (role: RotationRole) => role === 'lead' || role === 'backup'

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/**
 * Plan the rotation, one Sunday at a time. Each part keeps a round: the
 * servants who have had it since everyone last did. Only someone still due
 * takes it unless nobody due can, and the round starts again once everyone
 * has had it. Within that, each Sunday's parts are shared out as evenly as
 * the Sunday allows (no one holds more than their share), the totals over the
 * range stay level, a servant does not get the part they did one or two
 * Sundays ago, and chance settles the rest. Each Sunday is solved as a whole
 * (the cheapest assignment), not part by part, so an early choice never forces
 * a repeat that a different arrangement would have avoided.
 *
 * Lead and Backup are their own rotations and never go to one servant on the
 * same Sunday; with one servant, Backup stays empty.
 */
export function planRotation(input: RotationInput): RotationPlan {
  const servants = Array.from(new Set(input.servants))
  const roles = Array.from(new Set(input.roles))
  const weeks = Array.from(new Set(input.weeks)).sort()
  if (servants.length === 0 || roles.length === 0 || weeks.length === 0) return { cells: [], repeats: 0 }
  const random = input.random ?? Math.random
  const inRotation = new Set(servants)
  const first = weeks[0]!
  const index = (week: string) => Math.round(daysBetween(first, week) / 7)

  const round = new Map<RotationRole, Set<string>>()
  const lastHad = new Map<string, number>()
  const had = (role: RotationRole, servant: string, at: number) => {
    if (!inRotation.has(servant)) return
    let r = round.get(role)
    if (!r) round.set(role, (r = new Set()))
    r.add(servant)
    if (r.size >= servants.length) r.clear()
    lastHad.set(`${role}|${servant}`, at)
  }
  const due = (role: RotationRole, servant: string) => !round.get(role)?.has(servant)
  const recent = (role: RotationRole, servant: string, at: number) => {
    const last = lastHad.get(`${role}|${servant}`)
    return last === undefined ? 0 : RECENT * Math.max(0, 3 - (at - last))
  }

  const before = input.history.filter((c) => c.weekStart < first).sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
  for (const c of before) had(c.role, c.servantId, index(c.weekStart))

  const keptByWeek = new Map<string, RotationCell[]>()
  for (const c of input.kept) {
    const list = keptByWeek.get(c.weekStart)
    if (list) list.push(c)
    else keptByWeek.set(c.weekStart, [c])
  }

  const parts = roles.filter((r) => !isDuty(r))
  const duties = (['lead', 'backup'] as const).filter((r) => roles.includes(r))
  const total = new Map<string, number>()
  const dutyTotal = new Map<string, number>()
  const cells: RotationCell[] = []
  let repeats = 0

  for (const week of weeks) {
    const at = index(week)
    const kept = keptByWeek.get(week) ?? []
    const keptRoles = new Set(kept.map((c) => c.role))
    const today = new Map<string, number>()
    const onDuty = new Set<string>()
    for (const c of kept) {
      had(c.role, c.servantId, at)
      if (isDuty(c.role)) {
        onDuty.add(c.servantId)
        bump(dutyTotal, c.servantId)
      } else {
        bump(today, c.servantId)
        bump(total, c.servantId)
      }
    }
    const load = (s: string) => today.get(s) ?? 0

    const open = parts.filter((r) => !keptRoles.has(r))
    if (open.length > 0) {
      // Nobody holds more than the Sunday's fair share; raised only when the
      // kept parts leave too little room under it.
      let cap = Math.ceil((open.length + servants.reduce((n, s) => n + load(s), 0)) / servants.length)
      const room = () => servants.reduce((n, s) => n + Math.max(0, cap - load(s)), 0)
      while (room() < open.length) cap++
      const slots: Array<{ servant: string; nth: number }> = []
      for (const servant of servants) for (let nth = load(servant); nth < cap; nth++) slots.push({ servant, nth })
      const cost = open.map((role) =>
        slots.map(({ servant, nth }) =>
          (due(role, servant) ? 0 : REPEAT) +
          CROWD * nth +
          recent(role, servant, at) +
          UNEVEN * ((total.get(servant) ?? 0) + nth - load(servant)) +
          NOISE * random(),
        ),
      )
      const chosen = assignMinCost(cost).map((col) => slots[col]!.servant)
      open.forEach((role, i) => {
        if (!due(role, chosen[i]!)) repeats++
        cells.push({ weekStart: week, role, servantId: chosen[i]! })
      })
      // Recorded once the whole Sunday is chosen, so its parts never change each other's costs.
      open.forEach((role, i) => {
        had(role, chosen[i]!, at)
        bump(today, chosen[i]!)
        bump(total, chosen[i]!)
      })
    }

    const free = servants.filter((s) => !onDuty.has(s))
    const fill = duties.filter((r) => !keptRoles.has(r)).slice(0, free.length)
    if (fill.length > 0) {
      const cost = fill.map((role) =>
        free.map((servant) =>
          (due(role, servant) ? 0 : REPEAT) + recent(role, servant, at) + UNEVEN * (dutyTotal.get(servant) ?? 0) + BUSY * load(servant) + NOISE * random(),
        ),
      )
      const chosen = assignMinCost(cost).map((col) => free[col]!)
      fill.forEach((role, i) => {
        if (!due(role, chosen[i]!)) repeats++
        cells.push({ weekStart: week, role, servantId: chosen[i]! })
      })
      fill.forEach((role, i) => {
        had(role, chosen[i]!, at)
        bump(dutyTotal, chosen[i]!)
      })
    }
  }

  return { cells, repeats }
}

/**
 * The cheapest way to give every row its own column (the Hungarian method).
 * `cost` has at least as many columns as rows. Returns each row's column.
 */
export function assignMinCost(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length
  if (n === 0) return []
  const m = cost[0]!.length
  if (m < n) throw new Error('assignMinCost needs at least as many columns as rows')
  const u = new Array<number>(n + 1).fill(0)
  const v = new Array<number>(m + 1).fill(0)
  const p = new Array<number>(m + 1).fill(0)
  const way = new Array<number>(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array<number>(m + 1).fill(Infinity)
    const used = new Array<boolean>(m + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]!
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!
        if (cur < minv[j]!) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j]! < delta) {
          delta = minv[j]!
          j1 = j
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]!] = u[p[j]!]! + delta
          v[j] = v[j]! - delta
        } else {
          minv[j] = minv[j]! - delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]!
      p[j0] = p[j1]!
      j0 = j1
    } while (j0 !== 0)
  }
  const out = new Array<number>(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j]! > 0) out[p[j]! - 1] = j - 1
  return out
}
