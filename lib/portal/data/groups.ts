import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  effectiveServant,
  followUpScope,
  groupHealth,
  nextShuffleOn,
  planShuffle,
  planSplit,
  SHUFFLE_MIN_SERVANTS,
  shuffleNotice,
  type GroupHealth,
  type GroupKid,
  type GroupMove,
  type GroupServant,
} from '../groups'
import type { PortalUser, StageKey } from '../permissions'
import { studentName } from './students'
import { dueCaseWhere } from './excuses'
import { churchToday, toUTCDate } from '../dates'
import { deliverNotices } from '../notice-delivery'
import { PortalError } from '../action-result'

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

/**
 * The servant whose group this child is in now, or null: no class, no servant,
 * or that servant no longer serves the class. A contact note keeps it
 * (2026-10-19), so the log can say a servant followed up on a colleague's
 * behalf even after the child changes groups.
 */
export async function groupServantOf(studentId: string): Promise<string | null> {
  const s = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true, groupServantId: true } })
  if (!s?.classId || !s.groupServantId) return null
  const serves = await prisma.classServant.findFirst({
    where: { classId: s.classId, servantId: s.groupServantId, servant: { account: { isActive: true } } },
    select: { servantId: true },
  })
  return serves ? s.groupServantId : null
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
        // Its two months until the first shuffle start now (2026-10-25).
        const claimed = await tx.schoolClass.updateMany({
          where: { id, groupsSplitAt: null },
          data: { groupsSplitAt: new Date(), groupsShuffleDueOn: toUTCDate(nextShuffleOn(churchToday())) },
        })
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

/**
 * Shuffle one class's follow-up groups (2026-10-25): every child a new servant
 * where the numbers allow (lib/portal/groups.ts planShuffle), and the next
 * shuffle two months on. With `claimDue` the class is first claimed by moving
 * its due date, so the daily job run twice, or twice at once, shuffles it
 * once. Its servants are told their new groups, in the bell and on the phone.
 * The caller writes the activity log.
 *
 * A class with fewer than two servants is not shuffled (2026-10-26): nobody
 * moves, it is not marked shuffled and `shuffled` comes back false. The daily
 * job's claim still moves its date on, so it is looked at again in two months
 * rather than every evening.
 */
export async function shuffleClassGroups(
  classId: string,
  opts: { now?: Date; claimDue?: boolean } = {},
): Promise<{ moved: number; nextOn: string; shuffled: boolean; name: string }> {
  const now = opts.now ?? new Date()
  const today = churchToday(now)
  const nextOn = nextShuffleOn(today)
  const result = await prisma.$transaction(
    async (tx) => {
      if (opts.claimDue) {
        const claim = await tx.schoolClass.updateMany({
          where: { id: classId, groupsShuffleDueOn: { lte: toUTCDate(today) } },
          data: { groupsShuffleDueOn: toUTCDate(nextOn) },
        })
        if (claim.count === 0) return null
      }
      const [g] = await loadClassGroups([classId], tx)
      if (!g) throw new PortalError('Class not found.')
      if (g.servants.length < SHUFFLE_MIN_SERVANTS) return { g, moves: null }
      const moves = planShuffle(g.kids, g.servants, Math.random)
      await applyGroupMoves(tx, moves, now)
      await tx.schoolClass.update({ where: { id: classId }, data: { groupsShuffledAt: now, groupsShuffleDueOn: toUTCDate(nextOn) } })
      // A class shuffled before its first split counts as split.
      await tx.schoolClass.updateMany({ where: { id: classId, groupsSplitAt: null }, data: { groupsSplitAt: now } })
      return { g, moves }
    },
    { timeout: 30_000, maxWait: 10_000 },
  )
  if (!result) return { moved: 0, nextOn, shuffled: false, name: '' }

  const { g, moves } = result
  if (!moves) return { moved: 0, nextOn, shuffled: false, name: g.name }
  if (moves.length > 0) {
    const to = new Map(moves.map((m) => [m.kidId, m.to]))
    const active = new Set(g.servants.map((sv) => sv.id))
    const groupOf = (k: GroupKid) => to.get(k.id) ?? effectiveServant(k.groupServantId, active)
    const notices = g.servants
      .map((sv) => ({ sv, names: g.kids.filter((k) => groupOf(k) === sv.id).map((k) => k.name) }))
      .filter((x) => x.names.length > 0)
      .map(({ sv, names }) => ({
        servantId: sv.id,
        kind: 'groups' as const,
        ...shuffleNotice(g.name, names),
        dedupeKey: `groups:${classId}:${sv.id}:${now.toISOString()}`,
        email: false,
      }))
    await deliverNotices(notices)
  }
  return { moved: moves.length, nextOn, shuffled: true, name: g.name }
}

/**
 * The daily job's part (2026-10-25): every children's class whose shuffle is
 * due today or earlier is shuffled once. A Fellowship meeting never is.
 */
export async function shuffleDueGroups(now: Date = new Date()): Promise<{ classes: number; moved: number }> {
  const today = churchToday(now)
  const due = await prisma.schoolClass.findMany({
    where: {
      isActive: true,
      stage: { not: 'FELLOWSHIP' },
      groupsSplitAt: { not: null },
      groupsShuffleDueOn: { lte: toUTCDate(today) },
    },
    select: { id: true, name: true },
  })
  let moved = 0
  for (const c of due) {
    try {
      const r = await shuffleClassGroups(c.id, { now, claimDue: true })
      if (!r.shuffled) continue
      moved += r.moved
      await prisma.portalAuditLog.create({
        data: {
          actorId: null,
          actorName: 'Portal (automatic)',
          action: 'groups.shuffle',
          entity: 'class',
          entityId: c.id,
          detail: `${c.name}: shuffled the follow-up groups (${r.moved} moved), as every two months; next ${r.nextOn}`,
        },
      })
    } catch (err) {
      console.error(`Shuffling ${c.id} failed:`, err)
    }
  }
  return { classes: due.length, moved }
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
  return {
    OR: [
      { classId: { in: whole } },
      { classId: { in: group }, studentId: { in: allowed } },
      // Children from other classes are in no group here (their group is in
      // their own class), so their cases are every servant's (2026-09-28).
      ...group.map((classId) => ({ classId, student: { memberships: { some: { classId } } } })),
    ],
  }
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
    // "Open" is the calls still owed: an excused child is not one (2026-10-19).
    prisma.followUpCase.findMany({ where: { status: 'OPEN', studentId: { in: kidIds }, ...dueCaseWhere(churchToday()) }, select: { studentId: true } }),
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
