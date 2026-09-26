import type { PortalUser, StageKey } from './permissions'

/**
 * Follow-up groups (2026-09-26): each class's kids are split evenly across the
 * class's servants, so every child has one servant who follows them up.
 *
 * Pure. The split, the moves and the flags are decided here and unit-tested;
 * lib/portal/data/groups.ts loads the rows and writes the result.
 *
 * A group is resolved when it is read: a kid whose servant no longer serves
 * the class, or is deactivated, is unassigned. That keeps a servant's group
 * intact through an edit that briefly removes them, and it means nothing here
 * ever depends on ClassServant rows surviving a save.
 */

/** Groups this far apart raise a flag. One kid leaving an even class never does. */
export const UNEVEN_GAP = 3

export interface GroupKid {
  id: string
  name: string
  groupServantId: string | null
  /** ISO time they joined their group; when evening out, the newest move first. */
  groupAssignedAt: string | null
  /** Parent phone numbers, digits only. A shared number marks siblings. */
  phones: readonly string[]
}

export interface GroupServant {
  id: string
  name: string
}

export interface GroupMove {
  kidId: string
  from: string | null
  to: string
}

export interface GroupHealth {
  unassigned: number
  emptyServants: string[]
  uneven: boolean
  flagged: boolean
  loads: Record<string, number>
}

export function effectiveServant(groupServantId: string | null, activeServantIds: ReadonlySet<string>): string | null {
  return groupServantId !== null && activeServantIds.has(groupServantId) ? groupServantId : null
}

/**
 * Siblings: kids in the class who share a parent phone. More than four kids on
 * one number is a placeholder or the church office, not a family.
 */
export function families(kids: readonly GroupKid[]): string[][] {
  const byPhone = new Map<string, string[]>()
  for (const k of kids) {
    for (const p of Array.from(new Set(k.phones))) {
      if (!p || p.length < 7) continue
      byPhone.set(p, [...(byPhone.get(p) ?? []), k.id])
    }
  }
  const parent = new Map<string, string>(kids.map((k) => [k.id, k.id]))
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    parent.set(x, root)
    return root
  }
  for (const ids of Array.from(byPhone.values())) {
    if (ids.length < 2 || ids.length > 4) continue
    for (const id of ids.slice(1)) {
      const a = find(ids[0]!)
      const b = find(id)
      if (a !== b) parent.set(b, a)
    }
  }
  const out = new Map<string, string[]>()
  for (const k of kids) {
    const r = find(k.id)
    out.set(r, [...(out.get(r) ?? []), k.id])
  }
  return Array.from(out.values())
}

/**
 * Where every kid should be, as the fewest moves from where they are.
 *
 * 1. Whoever has no group is placed: with a sibling who has one, otherwise in
 *    the smallest group (families first, biggest first). `only` limits this to
 *    particular kids, which is how an added or moved-in child joins without
 *    anybody else moving.
 * 2. Unless `balance` is false, kids then move from the biggest group to the
 *    smallest, a family at a time and the newest in their group first, until
 *    no two groups differ by more than one. A family is split only if leaving
 *    it whole would still raise a flag.
 */
export function planSplit(
  kids: readonly GroupKid[],
  servants: readonly GroupServant[],
  opts: { only?: readonly string[]; balance?: boolean } = {},
): GroupMove[] {
  if (servants.length === 0 || kids.length === 0) return []
  const active = new Set(servants.map((s) => s.id))
  const rank = new Map(servants.map((s, i) => [s.id, i]))
  const byId = new Map(kids.map((k) => [k.id, k]))
  const start = new Map(kids.map((k) => [k.id, effectiveServant(k.groupServantId, active)]))
  const at = new Map(start)
  const fresh = new Set<string>()
  const fams = families(kids)
  const famOf = new Map<string, string[]>()
  for (const f of fams) for (const id of f) famOf.set(id, f)

  const loads = () => {
    const m = new Map<string, number>(servants.map((s) => [s.id, 0]))
    for (const s of Array.from(at.values())) if (s) m.set(s, m.get(s)! + 1)
    return m
  }
  const ascending = (l: Map<string, number>) =>
    [...servants].sort((a, b) => l.get(a.id)! - l.get(b.id)! || rank.get(a.id)! - rank.get(b.id)!)
  const descending = (l: Map<string, number>) =>
    [...servants].sort((a, b) => l.get(b.id)! - l.get(a.id)! || rank.get(a.id)! - rank.get(b.id)!)
  const recency = (id: string) =>
    fresh.has(id) ? Number.MAX_SAFE_INTEGER : Date.parse(byId.get(id)!.groupAssignedAt ?? '') || 0

  const targets = new Set(opts.only ?? kids.map((k) => k.id))
  const waiting = fams
    .map((f) => f.filter((id) => targets.has(id) && !at.get(id)))
    .filter((f) => f.length > 0)
    .sort((a, b) => b.length - a.length || byId.get(a[0]!)!.name.localeCompare(byId.get(b[0]!)!.name))
  for (const unit of waiting) {
    const sibling = famOf.get(unit[0]!)!.map((id) => at.get(id)).find((s): s is string => !!s)
    const to = sibling ?? ascending(loads())[0]!.id
    for (const id of unit) {
      at.set(id, to)
      fresh.add(id)
    }
  }

  if (opts.balance !== false) {
    for (let guard = 0; guard <= kids.length * servants.length; guard++) {
      const l = loads()
      const small = ascending(l)[0]!.id
      const big = descending(l)[0]!.id
      const gap = l.get(big)! - l.get(small)!
      if (gap <= 1) break
      const inBig = kids.map((k) => k.id).filter((id) => at.get(id) === big)
      const seen = new Set<string>()
      const units: string[][] = []
      for (const id of inBig) {
        if (seen.has(id)) continue
        const unit = famOf.get(id)!.filter((x) => at.get(x) === big)
        for (const x of unit) seen.add(x)
        units.push(unit)
      }
      const newest = (u: string[]) => Math.max(...u.map(recency))
      const movable = units
        .filter((u) => u.length < gap)
        .sort((a, b) => newest(b) - newest(a) || a.length - b.length || byId.get(a[0]!)!.name.localeCompare(byId.get(b[0]!)!.name))
      let unit = movable[0]
      if (!unit) {
        const max = l.get(big)!
        const min = l.get(small)!
        if (max - min < UNEVEN_GAP && !(min === 0 && max >= 2)) break
        unit = [[...inBig].sort((a, b) => recency(b) - recency(a) || byId.get(a)!.name.localeCompare(byId.get(b)!.name))[0]!]
      }
      for (const id of unit) at.set(id, small)
    }
  }

  const moves: GroupMove[] = []
  for (const k of kids) {
    const to = at.get(k.id)
    const from = start.get(k.id) ?? null
    if (to && to !== from) moves.push({ kidId: k.id, from, to })
  }
  return moves
}

export function groupHealth(kids: readonly GroupKid[], servants: readonly GroupServant[]): GroupHealth {
  if (servants.length === 0) return { unassigned: 0, emptyServants: [], uneven: false, flagged: false, loads: {} }
  const active = new Set(servants.map((s) => s.id))
  const loads = new Map<string, number>(servants.map((s) => [s.id, 0]))
  let unassigned = 0
  for (const k of kids) {
    const s = effectiveServant(k.groupServantId, active)
    if (s) loads.set(s, loads.get(s)! + 1)
    else unassigned++
  }
  const counts = Array.from(loads.values())
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const emptyServants = max >= 2 ? servants.filter((s) => loads.get(s.id) === 0).map((s) => s.name) : []
  const uneven = max - min >= UNEVEN_GAP
  return { unassigned, emptyServants, uneven, flagged: unassigned > 0 || emptyServants.length > 0 || uneven, loads: Object.fromEntries(loads) }
}

/**
 * Which classes a person's follow-up list shows whole, and which by group.
 *
 * Admin and the pastor see everything. A stage overseer sees their stage whole,
 * and a class Coordinator their class. A plain servant, assistant coordinators
 * included, sees their own group plus anybody in their class without a servant.
 * This narrows a list; it never changes what anybody may open.
 */
export function followUpScope(
  user: Pick<PortalUser, 'role' | 'classIds' | 'coordinatorOf' | 'stageOversight'>,
  classes: readonly { id: string; stage: StageKey }[],
): { whole: string[]; group: string[] } {
  if (user.role === 'ADMIN' || user.role === 'PASTOR') return { whole: classes.map((c) => c.id), group: [] }
  if (user.role !== 'SERVANT') return { whole: [], group: [] }
  const whole: string[] = []
  const group: string[] = []
  for (const c of classes) {
    if (user.coordinatorOf.includes(c.id) || user.stageOversight === c.stage) whole.push(c.id)
    else if (user.classIds.includes(c.id)) group.push(c.id)
  }
  return { whole, group }
}
