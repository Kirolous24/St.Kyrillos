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
