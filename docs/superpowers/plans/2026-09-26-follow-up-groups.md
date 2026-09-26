# Follow-up Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every child in a class belongs to one of the class's servants.
- Plain servants follow up their own group.
- Coordinators see everyone, with who each child is assigned to.
- Servants can log a check-in on any kid.

**Architecture:**
- The group is one nullable column, `Student.groupServantId`, resolved at read time against the class's current active servants. A servant who leaves or is deactivated makes their kids "unassigned", without destroying the assignment.
- Splitting, placing, moving and flagging are decided in one pure module, `lib/portal/groups.ts`. `lib/portal/data/groups.ts` loads the rows and writes the result.
- The follow-up list scope is a pure function as well. The page, the bell and the dashboard all use it.
- Contact logs gain `studentId` and an optional `caseId`, so a check-in can stand on its own.

**Tech Stack:** Next.js 14 server actions, Prisma 5 / Postgres, vitest, playwright-core.

**Spec:** `docs/superpowers/specs/2026-09-26-follow-up-groups-design.md`

## Global Constraints

- **`can()` is unchanged for every existing action.** Groups only narrow what a plain servant's **follow-up list** shows. They never hide a kid.
- **After the first split, nothing moves automatically except a kid who is added or moved in.** A servant joining or leaving only raises flags.
- **Uneven** means the biggest group has at least `UNEVEN_GAP = 3` more kids than the smallest. A class with more servants than kids is never flagged.
- **Unassigned kids** show on every servant's follow-up list in that class.
- **`group.manage`** is granted to ADMIN, to the class's stage overseer, and to a servant with the class `COORDINATOR` title. Nobody else has it.
- **Every count that links to `/portal/follow-ups`** uses the same scope as the page: the bell, the sidebar badge, the dashboard total and the dashboard's per-class chips.
- **Portal conventions:**
  - explicit px text sizes only
  - `brand-*` / `parch-*` tokens
  - actions return `ActionResult` via `runAction` and write `audit()`
  - a `'use server'` file exports only async functions
- **Database:** only the Neon dev branch (see the infra notes). Refuse `ep-dark-term-ai3c2hag`.
- **No commits or pushes.**

---

### Task 1: The pure group rules

**Files:**
- Create: `lib/portal/groups.ts`
- Test: `tests/portal/groups.test.ts`

**Interfaces:**
- Produces:
  - `UNEVEN_GAP`
  - `GroupKid { id; name; groupServantId: string | null; groupAssignedAt: string | null; phones: readonly string[] }`
  - `GroupServant { id; name }`
  - `GroupMove { kidId; from: string | null; to: string }`
  - `effectiveServant(groupServantId, activeIds): string | null`
  - `families(kids): string[][]`
  - `planSplit(kids, servants, opts?: { only?: readonly string[]; balance?: boolean }): GroupMove[]`
  - `groupHealth(kids, servants): GroupHealth`
  - `followUpScope(user, classes): { whole: string[]; group: string[] }`

- [ ] **Step 1: Write the failing tests** — `tests/portal/groups.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  effectiveServant, families, planSplit, groupHealth, followUpScope, UNEVEN_GAP,
  type GroupKid, type GroupServant,
} from '@/lib/portal/groups'

const kid = (id: string, over: Partial<GroupKid> = {}): GroupKid => ({
  id, name: id, groupServantId: null, groupAssignedAt: null, phones: [], ...over,
})
const servants: GroupServant[] = [
  { id: 'A', name: 'Abanoub' }, { id: 'B', name: 'Bishoy' }, { id: 'C', name: 'Christina' }, { id: 'D', name: 'Demiana' },
]
const apply = (kids: GroupKid[], moves: ReturnType<typeof planSplit>) => {
  const to = new Map(moves.map((m) => [m.kidId, m.to]))
  return kids.map((k) => (to.has(k.id) ? { ...k, groupServantId: to.get(k.id)!, groupAssignedAt: '2026-10-01T00:00:00.000Z' } : k))
}
const sizes = (kids: GroupKid[], ss: GroupServant[]) =>
  ss.map((s) => kids.filter((k) => k.groupServantId === s.id).length)

describe('effectiveServant', () => {
  it('keeps a servant who still serves the class, and forgets one who left', () => {
    expect(effectiveServant('A', new Set(['A', 'B']))).toBe('A')
    expect(effectiveServant('Z', new Set(['A', 'B']))).toBeNull()
    expect(effectiveServant(null, new Set(['A']))).toBeNull()
  })
})

describe('families', () => {
  it('joins kids who share a parent phone, and ignores a number on too many kids', () => {
    const kids = [
      kid('k1', { phones: ['6155550101'] }), kid('k2', { phones: ['6155550101', '6155550199'] }),
      kid('k3', { phones: ['6155550199'] }), kid('k4'),
      ...['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => kid(id, { phones: ['6150000000'] })),
    ]
    const f = families(kids).map((x) => x.sort().join(',')).sort()
    expect(f).toContain('k1,k2,k3')
    expect(f).toContain('k4')
    expect(f).toContain('p1')
    expect(f).not.toContain('p1,p2,p3,p4,p5')
  })
})

describe('the first split', () => {
  const sixteen = Array.from({ length: 16 }, (_, i) => kid(`k${String(i).padStart(2, '0')}`))

  it('splits evenly: 16 kids, 4 servants, 4 each', () => {
    expect(sizes(apply(sixteen, planSplit(sixteen, servants)), servants)).toEqual([4, 4, 4, 4])
  })

  it('gives the remainder one each: 18 kids across 4 servants', () => {
    const s = sizes(apply(sixteen.concat([kid('k16'), kid('k17')]), planSplit(sixteen.concat([kid('k16'), kid('k17')]), servants)), servants)
    expect(Math.max(...s) - Math.min(...s)).toBe(1)
    expect(s.reduce((a, b) => a + b, 0)).toBe(18)
  })

  it('keeps siblings together', () => {
    const kids = [kid('s1', { phones: ['6155550111'] }), kid('s2', { phones: ['6155550111'] }), ...sixteen.slice(0, 6)]
    const after = apply(kids, planSplit(kids, servants))
    expect(after.find((k) => k.id === 's1')!.groupServantId).toBe(after.find((k) => k.id === 's2')!.groupServantId)
  })

  it('is the same every time', () => {
    expect(planSplit(sixteen, servants)).toEqual(planSplit(sixteen, servants))
  })

  it('never leaves a flag behind, even with three siblings in a small class', () => {
    const kids = [kid('t1', { phones: ['6155550222'] }), kid('t2', { phones: ['6155550222'] }), kid('t3', { phones: ['6155550222'] }), kid('x1')]
    const two = servants.slice(0, 2)
    expect(groupHealth(apply(kids, planSplit(kids, two)), two).flagged).toBe(false)
  })
})

describe('after the split', () => {
  const settled = (): GroupKid[] =>
    Array.from({ length: 16 }, (_, i) => kid(`k${String(i).padStart(2, '0')}`, {
      groupServantId: servants[i % 4]!.id, groupAssignedAt: `2026-09-${String(10 + (i % 9)).padStart(2, '0')}T00:00:00.000Z`,
    }))

  it('moves nobody when the groups are already even', () => {
    expect(planSplit(settled(), servants)).toEqual([])
  })

  it('places a new kid in the smallest group and moves nobody else', () => {
    const kids = settled().filter((k) => k.id !== 'k00').concat([kid('new')])
    const moves = planSplit(kids, servants, { only: ['new'], balance: false })
    expect(moves).toEqual([{ kidId: 'new', from: null, to: 'A' }])
  })

  it("places a new kid with a sibling's servant", () => {
    const kids = settled().map((k) => (k.id === 'k05' ? { ...k, phones: ['6155550333'] } : k)).concat([kid('sib', { phones: ['6155550333'] })])
    expect(planSplit(kids, servants, { only: ['sib'], balance: false })).toEqual([{ kidId: 'sib', from: null, to: 'B' }])
  })

  it('a new servant gets kids from Split evenly with the fewest moves, newest first', () => {
    const five = [...servants, { id: 'E', name: 'Ehab' }]
    const moves = planSplit(settled(), five)
    expect(moves.every((m) => m.to === 'E')).toBe(true)
    expect(moves).toHaveLength(3)
    expect(sizes(apply(settled(), moves), five).sort()).toEqual([3, 3, 3, 3, 4])
  })

  it("places the kids of a servant who left, and moves nobody else's", () => {
    const three = servants.slice(0, 3)
    const moves = planSplit(settled(), three)
    expect(moves.every((m) => m.from === null)).toBe(true)
    expect(moves).toHaveLength(4)
  })
})

describe('groupHealth', () => {
  const even = () => Array.from({ length: 16 }, (_, i) => kid(`k${i}`, { groupServantId: servants[i % 4]!.id }))

  it('is quiet for an even class', () => {
    expect(groupHealth(even(), servants).flagged).toBe(false)
  })

  it('never calls the class uneven because one kid left', () => {
    expect(groupHealth(even().slice(1), servants).uneven).toBe(false)
  })

  it(`calls it uneven at a gap of ${UNEVEN_GAP}`, () => {
    const kids = even().filter((k) => !['k0', 'k4', 'k8'].includes(k.id))
    expect(groupHealth(kids, servants).uneven).toBe(true)
  })

  it('names a servant with no kids, and counts kids with no servant', () => {
    const h = groupHealth(even(), [...servants, { id: 'E', name: 'Ehab' }])
    expect(h.emptyServants).toEqual(['Ehab'])
    const h2 = groupHealth(even(), servants.slice(0, 3))
    expect(h2.unassigned).toBe(4)
  })

  it('does not flag a class with more servants than kids', () => {
    const kids = [kid('a', { groupServantId: 'A' }), kid('b', { groupServantId: 'B' })]
    expect(groupHealth(kids, servants).flagged).toBe(false)
  })
})

describe('followUpScope', () => {
  const classes = [
    { id: 'kg', stage: 'ELEMENTARY' as const }, { id: '1st', stage: 'ELEMENTARY' as const }, { id: '7th', stage: 'MIDDLE_SCHOOL' as const },
  ]
  const base = { role: 'SERVANT' as const, classIds: ['kg'], coordinatorOf: [] as string[], stageOversight: null }

  it('a plain servant gets their own class by group', () => {
    expect(followUpScope(base, classes)).toEqual({ whole: [], group: ['kg'] })
  })
  it('a class coordinator sees their class whole', () => {
    expect(followUpScope({ ...base, coordinatorOf: ['kg'] }, classes)).toEqual({ whole: ['kg'], group: [] })
  })
  it('a stage overseer sees their stage whole, and still has their own group elsewhere', () => {
    expect(followUpScope({ ...base, classIds: ['7th'], stageOversight: 'ELEMENTARY' }, classes)).toEqual({ whole: ['kg', '1st'], group: ['7th'] })
  })
  it('admin and pastor see everything whole', () => {
    expect(followUpScope({ ...base, role: 'ADMIN' }, classes).whole).toEqual(['kg', '1st', '7th'])
    expect(followUpScope({ ...base, role: 'PASTOR' }, classes).whole).toEqual(['kg', '1st', '7th'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/portal/groups.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/portal/groups.ts`**:

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/portal/groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint (no commit).**

---

### Task 2: Schema, migration and the `group.manage` permission

**Files:**
- Modify: `prisma/schema.prisma` (`Student`, `Servant`, `SchoolClass`, `FollowUpLog`)
- Create: `prisma/migrations/20260926200000_follow_up_groups/migration.sql`
- Modify: `lib/portal/permissions.ts` (the `Action` union, `ALL_CLASS_ACTIONS`, `can()`)
- Test: `tests/portal/permissions.test.ts` (new cases)
- Modify: `lib/portal/actions/followups.ts` (logs carry `studentId`)

**Interfaces:**
- Produces:
  - `Student.groupServantId: string | null`
  - `Student.groupAssignedAt: Date | null`
  - `SchoolClass.groupsSplitAt: Date | null`
  - `FollowUpLog.studentId: string`
  - `FollowUpLog.caseId: string | null`
  - `Action` gains `'group.manage'`

- [ ] **Step 1: Write the failing permission tests.** Append to `tests/portal/permissions.test.ts`:

```ts
describe('group.manage', () => {
  it('the admin, the stage overseer and the class Coordinator may arrange groups', () => {
    expect(can(admin, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(stageLead, 'group.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(coordinator, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
  })
  it('a plain servant, the pastor and a student may not', () => {
    expect(can(servant, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(pastor, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(student, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
  })
  it("a Coordinator's reach is their own class, an overseer's their own stage", () => {
    expect(can(coordinator, 'group.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(stageLead, 'group.manage', { classId: '5th-6th-boys', classStage: 'MIDDLE_SCHOOL' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/portal/permissions.test.ts`
Expected: FAIL (a type error in the test, or `false` where `true` was expected).

- [ ] **Step 3: Implement the permission.** In `permissions.ts`:
  - add `| 'group.manage'` to `Action` and to `ALL_CLASS_ACTIONS`
  - in the `SERVANT` switch, add:

```ts
        case 'group.manage':
          // Arranging who follows whom is the coordinator's job: the stage
          // overseer for their stage, the class Coordinator for their class.
          // Plain servants and assistants follow their group; they do not
          // rearrange everyone else's (follow-up groups, 2026-09-26).
          return stageRead || (!!ctx.classId && user.coordinatorOf.includes(ctx.classId))
```

  ADMIN returns true already. PASTOR and STUDENT fall through to `false`.

- [ ] **Step 4: Run the tests.** Run `npx vitest run tests/portal/permissions.test.ts`. Expected: PASS.

- [ ] **Step 5: Schema.** Make these changes in `prisma/schema.prisma`:
  - In `Student`, add:

    ```prisma
      // Follow-up group: the servant who follows this child up. Resolved when
      // read against the class's active servants (lib/portal/groups.ts).
      groupServantId  String?
      groupServant    Servant?  @relation("StudentGroup", fields: [groupServantId], references: [id], onDelete: SetNull)
      groupAssignedAt DateTime?
      contactLogs     FollowUpLog[]
    ```

    and `@@index([groupServantId])`.
  - In `Servant`, add `groupStudents Student[] @relation("StudentGroup")`.
  - In `SchoolClass`, add `groupsSplitAt DateTime? // set once the class has been split into follow-up groups`.
  - In `FollowUpLog`:
    - Make it `caseId String?` with `case FollowUpCase? @relation(fields: [caseId], references: [id], onDelete: Cascade)`.
    - Add `studentId String` and `student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)`.
    - Add `@@index([studentId, at(sort: Desc)])`.

- [ ] **Step 6: Generate, then hand-edit, the migration.** Generate it with `prisma migrate diff` into `prisma/migrations/20260926200000_follow_up_groups/migration.sql`. The generated `studentId TEXT NOT NULL` would fail on existing rows, so edit the file to:
  1. add `studentId` as nullable
  2. backfill it: `UPDATE "FollowUpLog" l SET "studentId" = c."studentId" FROM "FollowUpCase" c WHERE l."caseId" = c."id";`
  3. then `SET NOT NULL`

  Put a comment at the top explaining both halves.

  Apply it to dev only, using the same host guard as the logins plan:

  ```bash
  npx prisma migrate deploy && npx prisma generate
  ```

- [ ] **Step 7: Logs carry `studentId`.** In `lib/portal/actions/followups.ts`, add `studentId: c.studentId` to both `followUpLog.create` data objects (`logContact` and `resolveCase`). `loadCase` already selects `studentId`.

- [ ] **Step 8: Verify.** Run `npm test && npx tsc --noEmit`. Expected: pass.

- [ ] **Step 9: Checkpoint (no commit).**

---

### Task 3: The group data layer and automatic placement

**Files:**
- Create: `lib/portal/data/groups.ts`
- Modify: `lib/portal/actions/students.ts` (`createStudent`, `moveStudent`, `bulkMoveStudents`)
- Modify: `lib/portal/actions/data-tools.ts` (the student CSV import)

**Interfaces:**
- Produces:
  - `interface ClassGroups { classId; name; stage; servants: GroupServant[]; kids: GroupKid[] }`
  - `loadClassGroups(classIds, db?): Promise<ClassGroups[]>`
  - `applyGroupMoves(db, moves, at?): Promise<void>`
  - `placeNewKids(classId, kidIds): Promise<number>`
  - `ensureInitialSplits(): Promise<void>`
  - `followUpCaseWhere(user, classes): Promise<Prisma.FollowUpCaseWhereInput>`
  - `assigneeByStudent(groups): Map<string, { servantId: string; name: string } | null>`
  - `groupSummaries(classIds, sinceDays = 30): Promise<GroupSummary[]>`

- [ ] **Step 1: Implement `lib/portal/data/groups.ts`**:

```ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { effectiveServant, followUpScope, groupHealth, planSplit, type GroupHealth, type GroupKid, type GroupMove, type GroupServant } from '../groups'
import type { PortalUser, StageKey } from '../permissions'
import { studentName } from './students'

type Db = Prisma.TransactionClient | typeof prisma

export interface ClassGroups {
  classId: string
  name: string
  stage: StageKey
  servants: GroupServant[]
  kids: GroupKid[]
}

/** Every class's active servants and all of its kids, with their stored groups. */
export async function loadClassGroups(classIds: readonly string[], db: Db = prisma): Promise<ClassGroups[]> {
  if (classIds.length === 0) return []
  const rows = await db.schoolClass.findMany({
    where: { id: { in: [...classIds] } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      stage: true,
      servants: {
        where: { servant: { account: { isActive: true } } },
        select: { servant: { select: { id: true, account: { select: { displayName: true } } } } },
      },
      students: {
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, groupServantId: true, groupAssignedAt: true, fatherPhone: true, motherPhone: true },
      },
    },
  })
  return rows.map((c) => ({
    classId: c.id,
    name: c.name,
    stage: c.stage,
    servants: c.servants
      .map((cs) => ({ id: cs.servant.id, name: cs.servant.account.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    kids: c.students.map((s) => ({
      id: s.id,
      name: studentName(s),
      groupServantId: s.groupServantId,
      groupAssignedAt: s.groupAssignedAt ? s.groupAssignedAt.toISOString() : null,
      phones: [s.fatherPhone, s.motherPhone].filter((p): p is string => !!p),
    })),
  }))
}

/** Write a plan: one update per destination servant. */
export async function applyGroupMoves(db: Db, moves: readonly GroupMove[], at = new Date()): Promise<void> {
  const byTarget = new Map<string, string[]>()
  for (const m of moves) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), m.kidId])
  for (const [to, ids] of Array.from(byTarget.entries())) {
    await db.student.updateMany({ where: { id: { in: ids } }, data: { groupServantId: to, groupAssignedAt: at } })
  }
}

/**
 * A child added to a class, or moved into one, joins a group: a sibling's, or
 * the smallest. Nobody else moves; that is the church's rule for a new child.
 */
export async function placeNewKids(classId: string, kidIds: readonly string[]): Promise<number> {
  if (kidIds.length === 0) return 0
  const [g] = await loadClassGroups([classId])
  if (!g || g.servants.length === 0) return 0
  const moves = planSplit(g.kids, g.servants, { only: kidIds, balance: false })
  await applyGroupMoves(prisma, moves)
  return moves.length
}

/**
 * The first split, with nobody pressing anything. Every active class that has
 * never been split, and now has both kids and an active servant, is split once.
 *
 * Idempotent and safe under concurrency: the class is claimed by setting
 * groupsSplitAt inside the transaction that writes the groups, so a second
 * request finds it taken. A class whose kids all lack a group gets the full,
 * even split; one that already has some (kids added before this ran) only has
 * its unplaced kids placed, and nobody who has a servant moves.
 */
export async function ensureInitialSplits(): Promise<void> {
  const pending = await prisma.schoolClass.findMany({
    where: {
      groupsSplitAt: null,
      isActive: true,
      students: { some: {} },
      servants: { some: { servant: { account: { isActive: true } } } },
    },
    select: { id: true },
  })
  for (const { id } of pending) {
    await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.schoolClass.updateMany({ where: { id, groupsSplitAt: null }, data: { groupsSplitAt: new Date() } })
        if (claimed.count === 0) return
        const [g] = await loadClassGroups([id], tx)
        if (!g) return
        const active = new Set(g.servants.map((s) => s.id))
        const fresh = g.kids.every((k) => !effectiveServant(k.groupServantId, active))
        const moves = planSplit(g.kids, g.servants, { balance: fresh })
        await applyGroupMoves(tx, moves)
        await tx.portalAuditLog.create({
          data: {
            actorId: null,
            actorName: 'Portal (automatic)',
            action: 'groups.autoSplit',
            entity: 'class',
            entityId: id,
            detail: `${g.name}: ${fresh ? 'split' : 'placed'} ${moves.length} kid${moves.length === 1 ? '' : 's'} across ${g.servants.length} servant${g.servants.length === 1 ? '' : 's'} on first use`,
          },
        })
      },
      { timeout: 30_000, maxWait: 10_000 },
    )
  }
}

/** The kids a person's follow-up list shows, as a where-clause on cases. */
export async function followUpCaseWhere(
  user: PortalUser,
  classes: readonly { id: string; stage: StageKey }[],
): Promise<Prisma.FollowUpCaseWhereInput> {
  const { whole, group } = followUpScope(user, classes)
  if (group.length === 0) return { classId: { in: whole } }
  const allowed: string[] = []
  for (const g of await loadClassGroups(group)) {
    const active = new Set(g.servants.map((s) => s.id))
    for (const k of g.kids) {
      const s = effectiveServant(k.groupServantId, active)
      if (s === null || s === user.servantId) allowed.push(k.id)
    }
  }
  return { OR: [{ classId: { in: whole } }, { classId: { in: group }, studentId: { in: allowed } }] }
}

export function assigneeByStudent(groups: readonly ClassGroups[]): Map<string, { servantId: string; name: string } | null> {
  const out = new Map<string, { servantId: string; name: string } | null>()
  for (const g of groups) {
    const active = new Set(g.servants.map((s) => s.id))
    const nameOf = new Map(g.servants.map((s) => [s.id, s.name]))
    for (const k of g.kids) {
      const s = effectiveServant(k.groupServantId, active)
      out.set(k.id, s ? { servantId: s, name: nameOf.get(s)! } : null)
    }
  }
  return out
}

export interface GroupSummary {
  classId: string
  name: string
  health: GroupHealth
  unassignedKids: number
  rows: Array<{ servantId: string; name: string; kids: number; open: number; contacted: number }>
}

/** Per servant: how many kids, how many open cases, how many reached lately. */
export async function groupSummaries(classIds: readonly string[], sinceDays = 30): Promise<GroupSummary[]> {
  const groups = await loadClassGroups(classIds)
  const kidIds = groups.flatMap((g) => g.kids.map((k) => k.id))
  const since = new Date(Date.now() - sinceDays * 86_400_000)
  const [open, contacted] = await Promise.all([
    prisma.followUpCase.findMany({ where: { status: 'OPEN', studentId: { in: kidIds } }, select: { studentId: true } }),
    prisma.followUpLog.groupBy({ by: ['studentId'], where: { studentId: { in: kidIds }, at: { gte: since } } }),
  ])
  const openSet = new Set(open.map((o) => o.studentId))
  const reached = new Set(contacted.map((c) => c.studentId))
  return groups.map((g) => {
    const active = new Set(g.servants.map((s) => s.id))
    const rows = g.servants.map((s) => {
      const mine = g.kids.filter((k) => effectiveServant(k.groupServantId, active) === s.id)
      return {
        servantId: s.id,
        name: s.name,
        kids: mine.length,
        open: mine.filter((k) => openSet.has(k.id)).length,
        contacted: mine.filter((k) => reached.has(k.id)).length,
      }
    })
    const health = groupHealth(g.kids, g.servants)
    return { classId: g.classId, name: g.name, health, unassignedKids: health.unassigned, rows }
  })
}
```

- [ ] **Step 2: Place new and moved kids.**
  - **`createStudent`:** after `audit(...)`, add:

    ```ts
        // Follow-up groups: a new child joins a group (a sibling's, or the
        // smallest) and nobody else moves. A failure leaves them unassigned,
        // which is flagged, rather than failing the add.
        await placeNewKids(cls.id, [student.id]).catch((err) => console.error('Group placement failed:', err))
    ```

  - **`moveStudent`:** the update data becomes `{ classId, ...(classId ? {} : { groupServantId: null, groupAssignedAt: null }) }`. After it, add `if (classId) await placeNewKids(classId, [studentId]).catch(...)`.
  - **`bulkMoveStudents`:** the same pattern, with `ids`.
  - **Import in `data-tools.ts` (student CSV):** collect `touched: Map<classId, studentId[]>`:
    - for a created row with a class, the new student's id and class
    - for an updated row with `p.classId`, the linked student's id and class

    After the loop, when not previewing, call `placeNewKids(classId, ids)` for each entry, catching errors.

  Import `placeNewKids` from `'../data/groups'`. It is not a `'use server'` module, so the import is legal.

- [ ] **Step 3: Verify.** Run `npm test && npx tsc --noEmit`. Expected: pass.

- [ ] **Step 4: Checkpoint (no commit).**

---

### Task 4: Split evenly, move a kid, and check-ins (server actions)

**Files:**
- Create: `lib/portal/actions/groups.ts`
- Modify: `lib/portal/actions/followups.ts` (add `logCheckIn`)
- Test: `tests/portal/use-server-exports.test.ts` (covers the new files automatically)

**Interfaces:**
- Produces:
  - `previewSplit(classId): Promise<ActionResult<{ moves: Array<{ kid: string; from: string | null; to: string }> }>>`
  - `applySplit(classId): Promise<ActionResult<{ moved: number }>>`
  - `moveKidToGroup(studentId, servantId): Promise<ActionResult>`
  - `logCheckIn({ studentId, method, result?, note? }): Promise<ActionResult<{ onCase: boolean }>>`

- [ ] **Step 1: Create `lib/portal/actions/groups.ts`**:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { planSplit } from '../groups'
import { applyGroupMoves, loadClassGroups } from '../data/groups'
import { studentName } from '../data/students'

function revalidateGroups(classId: string) {
  revalidatePath(`/portal/classes/${classId}`)
  revalidatePath('/portal/my-group')
  revalidatePath('/portal/follow-ups')
  revalidatePath('/portal/my-stage')
}

/** What Split evenly would do, named, before anything moves. */
export async function previewSplit(
  classId: string,
): Promise<ActionResult<{ moves: Array<{ kid: string; from: string | null; to: string }> }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    await assertClassAction(user, classId, 'group.manage')
    const [g] = await loadClassGroups([classId])
    if (!g || g.servants.length === 0) throw new PortalError('This class has no active servants to split between.')
    const names = new Map(g.servants.map((s) => [s.id, s.name]))
    const kidName = new Map(g.kids.map((k) => [k.id, k.name]))
    return {
      moves: planSplit(g.kids, g.servants).map((m) => ({
        kid: kidName.get(m.kidId)!,
        from: m.from ? names.get(m.from) ?? null : null,
        to: names.get(m.to)!,
      })),
    }
  })
}

/** Split evenly: the fewest moves that even the class out. */
export async function applySplit(classId: string): Promise<ActionResult<{ moved: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await assertClassAction(user, classId, 'group.manage')
    const [g] = await loadClassGroups([classId])
    if (!g || g.servants.length === 0) throw new PortalError('This class has no active servants to split between.')
    const moves = planSplit(g.kids, g.servants)
    await prisma.$transaction(async (tx) => {
      await applyGroupMoves(tx, moves)
      await tx.schoolClass.update({ where: { id: classId }, data: { groupsSplitAt: new Date() } })
    })
    const names = new Map(g.servants.map((s) => [s.id, s.name]))
    const kidName = new Map(g.kids.map((k) => [k.id, k.name]))
    await audit(
      user,
      'groups.split',
      'class',
      classId,
      moves.length === 0
        ? `${cls.name}: groups already even`
        : `${cls.name}: ${moves.map((m) => `${kidName.get(m.kidId)} → ${names.get(m.to)}`).slice(0, 30).join(', ')}${moves.length > 30 ? `, and ${moves.length - 30} more` : ''}`,
    )
    revalidateGroups(classId)
    return { moved: moves.length }
  })
}

/** Move one child to another servant of the same class. */
export async function moveKidToGroup(studentId: string, servantId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const s = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, classId: true, firstName: true, lastName: true },
    })
    if (!s || !s.classId) throw new PortalError('Student not found or has no class.')
    const cls = await assertClassAction(user, s.classId, 'group.manage')
    const target = await prisma.classServant.findFirst({
      where: { classId: s.classId, servantId, servant: { account: { isActive: true } } },
      select: { servant: { select: { account: { select: { displayName: true } } } } },
    })
    if (!target) throw new PortalError('That servant does not serve this class.')
    await prisma.student.update({ where: { id: s.id }, data: { groupServantId: servantId, groupAssignedAt: new Date() } })
    await audit(user, 'groups.move', 'student', s.id, `${cls.name}: ${studentName(s)} → ${target.servant.account.displayName}`)
    revalidateGroups(s.classId)
    revalidatePath(`/portal/students/${s.id}`)
    return undefined
  })
}
```

- [ ] **Step 2: Add `logCheckIn` to `followups.ts`**:

```ts
const CheckInSchema = z.object({
  studentId: z.string().min(1),
  method: z.enum(['call', 'text', 'whatsapp', 'email', 'visit', 'other']),
  result: z.enum(['reached', 'no_answer', 'left_message', 'will_come', 'other']).optional(),
  note: z.string().trim().max(1000).optional(),
})

/**
 * A check-in on any child, not only one with an open case: the heart of
 * following up a group is calling everybody, not just the ones who missed.
 * If the child does have an open case, the check-in goes on its timeline, so
 * the case shows what was already tried.
 */
export async function logCheckIn(raw: z.infer<typeof CheckInSchema>): Promise<ActionResult<{ onCase: boolean }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = CheckInSchema.parse(raw)
    const s = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, classId: true, firstName: true, lastName: true },
    })
    if (!s || !s.classId) throw new PortalError('Student not found or has no class.')
    await assertClassAction(user, s.classId, 'followup.write')
    const open = await prisma.followUpCase.findFirst({ where: { studentId: s.id, status: 'OPEN' }, select: { id: true } })
    await prisma.followUpLog.create({
      data: {
        studentId: s.id,
        caseId: open?.id ?? null,
        method: input.method,
        note: input.note || null,
        result: input.result ?? null,
        byId: user.accountId,
      },
    })
    await audit(
      user,
      'followup.checkIn',
      'student',
      s.id,
      `${studentName(s)}: ${input.method}${input.result ? ` (${input.result})` : ''}${open ? ' — on the open case' : ''}`,
    )
    revalidatePath('/portal/my-group')
    revalidatePath(`/portal/students/${s.id}`)
    revalidatePath('/portal/follow-ups')
    if (open) revalidatePath(`/portal/follow-ups/${open.id}`)
    return { onCase: !!open }
  })
}
```

- [ ] **Step 3: Verify.** Run `npm test && npx tsc --noEmit && npm run lint`. The `use-server-exports` guard covers both new files.

- [ ] **Step 4: Checkpoint (no commit).**

---

### Task 5: Scope the follow-up list, the bell and the dashboard

**Files:**
- Modify: `app/portal/(app)/follow-ups/page.tsx`
- Create: `app/portal/(app)/follow-ups/AssigneeFilter.tsx`
- Modify: `lib/portal/data/reports.ts` (`loadNotifications` for SERVANT and ADMIN)
- Modify: `lib/portal/notifications.ts` (new facts `groupAttention` and `groupAttentionHref`, and their rule)
- Test: `tests/portal/notifications.test.ts`
- Modify: `lib/portal/data/dashboard.ts` (`staffOverview` open-case counts)
- Modify: `app/portal/(app)/(home)/page.tsx` (call `ensureInitialSplits`)

- [ ] **Step 1: Write the failing notification test.** Append to `tests/portal/notifications.test.ts`:

```ts
describe('buildNotifications — follow-up groups', () => {
  it('tells a coordinator which classes need their groups looked at', () => {
    const items = buildNotifications('SERVANT', {
      today: '2026-10-05',
      groupAttention: [{ classId: '7th-8th-girls', name: '7th & 8th Girls' }],
      groupAttentionHref: '/portal/classes/7th-8th-girls#groups',
    })
    const n = items.find((i) => i.key.startsWith('groups:attention'))!
    expect(n.title).toBe('Groups need attention in 7th & 8th Girls')
    expect(n.href).toBe('/portal/classes/7th-8th-girls#groups')
    expect(n.tone).toBe('warn')
  })
  it('counts classes, and keys on the count so a new one is not silenced', () => {
    const items = buildNotifications('ADMIN', {
      today: '2026-10-05',
      groupAttention: [{ classId: 'a', name: 'A' }, { classId: 'b', name: 'B' }],
    })
    const n = items.find((i) => i.key.startsWith('groups:attention'))!
    expect(n.key).toBe('groups:attention:2')
    expect(n.title).toBe('Groups need attention in 2 classes')
    expect(n.count).toBe(2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run tests/portal/notifications.test.ts` fails, because no such item exists.

- [ ] **Step 3: Implement the rule.**
  - Add these to `NotificationFacts`:

    ```ts
      /** Classes whose follow-up groups are flagged, for the people who arrange them. */
      groupAttention?: readonly { classId: string; name: string }[]
      /** Where the group notification leads; defaults to the class list. */
      groupAttentionHref?: string
    ```

  - In `buildNotifications`, before the open-cases block, add:

    ```ts
      if (role === 'SERVANT' || role === 'ADMIN') {
        const flagged = facts.groupAttention ?? []
        if (flagged.length > 0) {
          items.push({
            key: `groups:attention:${flagged.length}`,
            count: flagged.length,
            title: flagged.length === 1 ? `Groups need attention in ${flagged[0]!.name}` : `Groups need attention in ${flagged.length} classes`,
            detail: 'A servant has no kids, a kid has no servant, or the groups are uneven.',
            href: facts.groupAttentionHref ?? '/portal/classes',
            tone: 'warn',
          })
        }
      }
    ```

- [ ] **Step 4: Scope the bell.** In `loadNotifications`, in the `SERVANT` branch:
  - Compute `const scopeWhere = await followUpCaseWhere(user, classes)`.
  - Use `where: { AND: [scopeWhere, { status: 'OPEN' }] }` for the count, and `{ AND: [scopeWhere, { status: 'OPEN', origin: 'AUTO', consecutiveAbsences: { gte: 3 } }] }` for the streaks.
  - Compute group attention for the classes this servant may arrange:

  ```ts
      const manages = classes.filter((c) => can(user, 'group.manage', { classId: c.id, classStage: c.stage }))
      const flagged = (await groupSummaries(manages.map((c) => c.id))).filter((g) => g.health.flagged)
      const groupAttentionHref = user.stageOversight ? '/portal/my-stage' : flagged.length === 1 ? `/portal/classes/${flagged[0]!.classId}#groups` : '/portal/classes'
  ```

  Pass `groupAttention: flagged.map((g) => ({ classId: g.classId, name: g.name }))` and `groupAttentionHref`.

  In the `ADMIN` branch, do the same over every active class. The href is `/portal/classes/<id>#groups` for one class, and `/portal/classes` for more.

- [ ] **Step 5: Scope the dashboard.** In `staffOverview`, compute the same `scopeWhere`. Change the open-case `groupBy` to `where: { AND: [scopeWhere, { status: 'OPEN' }] }`, so both the per-class chips and the total match the list. Call `await ensureInitialSplits().catch(...)` at the top of the home page, before `staffOverview`.

- [ ] **Step 6: Scope the Follow-ups page.** In `follow-ups/page.tsx`:
  - At the top of the staff path, call `await ensureInitialSplits().catch((e) => console.error('Initial group split failed:', e))`.
  - Compute:
    - `scope = followUpScope(user, classes)`
    - `scopeWhere = await followUpCaseWhere(user, classes)`
    - `groups = await loadClassGroups(classIds)`
    - `assignee = assigneeByStudent(groups)`
  - Read `searchParams.servant`, which narrows only: `mine` means this servant's group, `unassigned` means kids with no servant, and any other value is a servant id. Turn it into a list of student ids, and add `{ studentId: { in: ids } }` to the `AND`.
  - `where` for the list and both counts becomes `{ AND: [scopeWhere, { status }, …servantFilter] }`.
  - **Each card** gains a `Detail` labelled "Assigned to", reading the assignee's name or, as a warn badge, "No servant yet".
  - **When `scope.whole.length > 0`** (a coordinator, the pastor or the admin):
    - Render `<AssigneeFilter>`: a `<select>` of All / Mine / No servant yet, then each servant grouped by class. On change it navigates, keeping `class` and `show`.
    - Above the new-case form, render a "Who is following up" card: `groupSummaries(scope.whole)` as a table of Servant · Kids · Open · Reached in 30 days.
  - **When `scope.group.length > 0` and `scope.whole.length === 0`** (a plain servant), render a one-line note: "Showing your group and anybody in your class who has no servant yet." with a link to `/portal/my-group`.
  - For a coordinator, show their own group's cases first, by stable-partitioning the list on `assignee.get(studentId)?.servantId === user.servantId`.

  `AssigneeFilter.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { selectClass } from '@/components/portal/ui'

export function AssigneeFilter({
  value,
  hasOwnGroup,
  classes,
}: {
  value: string
  hasOwnGroup: boolean
  classes: Array<{ name: string; servants: Array<{ id: string; name: string }> }>
}) {
  const router = useRouter()
  const params = useSearchParams()
  return (
    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
      Assigned to
      <select
        aria-label="Assigned to"
        value={value}
        className={`${selectClass} max-w-[240px] normal-case tracking-normal`}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString())
          if (e.target.value) next.set('servant', e.target.value)
          else next.delete('servant')
          router.push(`/portal/follow-ups${next.toString() ? `?${next.toString()}` : ''}`)
        }}
      >
        <option value="">Everyone</option>
        {hasOwnGroup && <option value="mine">My group</option>}
        <option value="unassigned">No servant yet</option>
        {classes.map((c) => (
          <optgroup key={c.name} label={c.name}>
            {c.servants.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 7: Verify.** Run `npm test && npx tsc --noEmit && npm run lint`.

- [ ] **Step 8: Checkpoint (no commit).**

---

### Task 6: My Group, the class Groups panel, check-ins and profiles

**Files:**
- Create: `components/portal/CheckInButton.tsx`
- Create: `app/portal/(app)/my-group/page.tsx`
- Create: `app/portal/(app)/classes/[id]/GroupsPanel.tsx`
- Modify: `app/portal/(app)/classes/[id]/page.tsx` (render the panel, with `id="groups"`, and call `ensureInitialSplits`)
- Modify: `app/portal/(app)/students/[id]/page.tsx` (the child's group with Change for managers, contact history, and a check-in)
- Modify: `app/portal/(app)/my-stage/page.tsx` (per-class flags and per-servant summary)
- Modify: `lib/portal/nav.ts` (**My Group** for servants with a class), `components/portal/Shell.tsx` (the `group: UsersRound` icon), `lib/auth.config.ts` (`'/portal/my-group'` in `STAFF_ONLY`)
- Modify: `scripts/portal-smoke.mjs` (routes)

- [ ] **Step 1: `components/portal/CheckInButton.tsx`**:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall } from 'lucide-react'
import { logCheckIn } from '@/lib/portal/actions/followups'
import { CONTACT_METHODS } from '@/lib/portal/followups'
import { buttonClass, selectClass, textareaClass } from './ui'
import { cn } from '@/lib/utils'

const RESULTS = [
  { key: 'reached', label: 'Reached' },
  { key: 'no_answer', label: 'No answer' },
  { key: 'left_message', label: 'Left message' },
  { key: 'will_come', label: 'Will come' },
  { key: 'other', label: 'Other' },
] as const

/** Log a call, text or visit on any child, from My Group or their profile. */
export function CheckInButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<(typeof CONTACT_METHODS)[number]['key']>('call')
  const [result, setResult] = useState<(typeof RESULTS)[number]['key']>('reached')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setOpen(true); setMessage(null) }} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
          <PhoneCall className="h-3.5 w-3.5" aria-hidden /> Log check-in
        </button>
        {message && <span role="status" className={cn('text-[11.5px] font-semibold', message.ok ? 'text-[#15803D]' : 'text-[#B91C1C]')}>{message.text}</span>}
      </div>
    )
  }

  return (
    <form
      className="space-y-2 rounded-[12px] border border-parch-200 bg-parch-50 p-3"
      aria-label={`Check-in for ${studentName}`}
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await logCheckIn({ studentId, method, result, note })
          if (!r.ok) return setMessage({ ok: false, text: r.error })
          setOpen(false)
          setNote('')
          setMessage({ ok: true, text: r.data?.onCase ? 'Logged on their open case.' : 'Check-in logged.' })
          router.refresh()
        })
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="How" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={selectClass}>
          {CONTACT_METHODS.filter((m) => m.key !== 'resolved').map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        <select aria-label="Result" value={result} onChange={(e) => setResult(e.target.value as typeof result)} className={selectClass}>
          {RESULTS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>
      <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} rows={2} maxLength={1000} placeholder="What was said (optional)" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>{pending ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => setOpen(false)} className={cn(buttonClass('ghost', 'sm'), 'min-h-[36px]')}>Cancel</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: `app/portal/(app)/my-group/page.tsx`.** A server component. It calls `requirePortalUser` and `ensureInitialSplits`. The page 404s for students; the edge blocks them too, through `STAFF_ONLY`. It shows:
  - an empty state for anyone without a `servantId` or any group kids
  - otherwise, per group class:
    - a header with the class name and "N kids"
    - one card per kid, sorted open case first, then never contacted, then longest since contact, then name

  Each kid card holds:
  - name with a profile link, and age
  - the last 8 held Sundays as dots (●/–/○)
  - the missed-in-a-row count, from `absenceStreakAgainst`
  - an open-case badge linking to the case
  - "Last contacted N days ago" or "Not contacted yet", from the newest `FollowUpLog.at` per student
  - points, from `classTotals`
  - a birthday badge when it's within 7 days, from `daysUntilBirthday`
  - parent Call and WhatsApp links (`tel:` and `waLink` over father, mother and own phone)
  - `<CheckInButton>`

  Data comes from four queries in `Promise.all`:
  - the kids
  - Sunday attendance rows for the group's classes (`sessionKey: 'sunday'`)
  - open cases
  - `followUpLog.groupBy({ by: ['studentId'], _max: { at: true } })`

  Metadata title: `'My Group'`.

- [ ] **Step 3: `GroupsPanel.tsx`** (client).
  - **Props:** `{ classId, canManage, servants: Array<{ id; name; kids: Array<{ id; name }> }>, unassigned: Array<{ id; name }>, health: GroupHealth }`.
  - **Renders:**
    - `<Card title="Groups" …>` with `id="groups"` on its wrapper
    - a Callout listing the flags ("N kids have no servant", "X has no kids", "The groups are uneven")
    - a grid of servant boxes (name, count, kid links), and an "No servant yet" box when there are unassigned kids
  - **Managers** also get:
    - **Split evenly**, which calls `previewSplit` and shows the named moves with Confirm and Cancel. Confirm calls `applySplit`, then `router.refresh()`. "No moves needed" shows when the list is empty.
    - An "Arrange" toggle that puts a `<select>` of the class's servants under each kid. Changing it calls `moveKidToGroup`.
  - **On the class page:** load `loadClassGroups([cls.id])` and `groupHealth`, and compute `canManage = can(user, 'group.manage', ctx)`. Render the panel after the roster section. Call `ensureInitialSplits` first.

- [ ] **Step 4: Student profile.**
  - In the side column, add a "Group" line: "Followed up by <name>", or "No servant yet". Managers get a `<select>` built on `moveKidToGroup`, as a small client wrapper.
  - Add a "Contact history" card: the last 10 `followUpLog` rows for the student (how, result, note, by, date, with a link to the case when there is one).
  - Render `<CheckInButton>` when `can(user, 'followup.write', ctx)`.

- [ ] **Step 5: My Stage.** For the stage's classes, load `groupSummaries(ids)`. Under each class, show:
  - the flag badges
  - a compact table: Servant · Kids · Open · Reached (30d)
  - a link to `/portal/classes/<id>#groups`

- [ ] **Step 6: Navigation and gates.**
  - In `nav.ts` (the SERVANT rail, Overview section, directly after the class item), add `...(user.classIds.length > 0 ? [{ href: '/portal/my-group', label: 'My Group', icon: 'group', section: 'Overview' } as NavItem] : [])`.
  - In `Shell.tsx`, import `UsersRound` and add `group: UsersRound` to `NAV_ICONS`.
  - In `auth.config.ts`, add `'/portal/my-group'` to `STAFF_ONLY`.
  - In `portal-smoke.mjs`, add `/portal/my-group` to the admin, pastor and servant `ok` lists and to the student `gone` list.

- [ ] **Step 7: Verify.** Run `npm test && npx tsc --noEmit && npm run lint`.

- [ ] **Step 8: Checkpoint (no commit).**

---

### Task 7: End-to-end verification on the dev branch

- [ ] **Step 1:** With no dev server running, run `npm run build`. Expected: it succeeds.
- [ ] **Step 2:** Start `npm run dev` on a clean port, then run `npm run smoke` and `npm run smoke:write`. Expected: all pass.
- [ ] **Step 3: Scratchpad E2E** (`e2e-groups.mjs`, playwright-core, dev branch only):
  1. **Automatic split.** Visit `/portal` as admin, which triggers `ensureInitialSplits`. Every class with kids and servants now has `groupsSplitAt` set. Each class's group sizes differ by at most 2, the `groups.autoSplit` audit rows exist, and **no class is flagged**.
  2. **A servant's view.** As the backup servant, open `/portal/follow-ups`. Every listed case is for a kid in their group or with no servant. The bell count equals the page's open count. `/portal/my-group` lists exactly their group's kids.
  3. **Check-in without a case.** Log a check-in on a kid with no open case. A `FollowUpLog` row now exists with `caseId` null, and My Group shows "Last contacted today".
  4. **Check-in with a case.** Open a manual case for a ZZSMOKE kid, then log a check-in. It lands on that case's timeline.
  5. **Coordinator view.** Using the backup servant as a class Coordinator (or as admin), `/portal/follow-ups` shows "Assigned to" on the cards. The "Who is following up" table matches the database.
  6. **New servant.** Assign a ZZSMOKE servant to a class. The class Groups panel shows the flag "ZZSMOKE … has no kids". **Split evenly** previews moves only into the new servant, and after Confirm the flag is gone and nobody else moved.
  7. **Servant leaves.** Remove the ZZSMOKE servant from the class. Their kids show under "No servant yet", and the flag reads "N kids have no servant". Add the servant back, and the same kids are in their group again.
  8. **New kid.** Add a ZZSMOKE student to the class. They join the smallest group, and nobody else moves.
  9. **Move a kid.** Move one kid between groups, and the audit row exists.
  10. **Cleanup:** delete ZZSMOKE rows, and reset any group moved in step 9 back to its previous servant.
- [ ] **Step 4:** Stop the dev server, and report the results faithfully.

## Self-review against the spec

| Spec item | Task |
|---|---|
| Automatic first split, siblings together, deterministic | 1, 3 (`ensureInitialSplits`) |
| New or moved kid joins the smallest group; a kid leaving moves nothing; servant changes only flag | 1 (`planSplit` `only`/`balance`), 3 (hooks) |
| Flags: kids with no servant, servant with no kids, uneven at a gap of 3; shown on the class, My Stage and the bell | 1, 5, 6 |
| Split evenly with named moves before confirming; move one kid | 4, 6 |
| My Group page with attendance, streak, case, last contacted, points, birthday, parent contacts, check-in | 6 |
| Follow-ups: plain servant sees their group plus unassigned; coordinators see all, with assignee, a filter and a summary | 5 |
| Counts use the same scope (bell, badge, dashboard) | 5 |
| Check-ins on any kid; on the open case when there is one | 2, 4, 6 |
| `can()` unchanged, plus `group.manage` | 2 |
| Group survives a servant edit; servant removal reversible | 1 (read-time resolution), 7 (E2E step 7) |
