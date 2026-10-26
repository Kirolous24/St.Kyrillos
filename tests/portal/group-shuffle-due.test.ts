import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The shuffle every two months (2026-10-25), as the daily job runs it: every
 * class due today or earlier is shuffled once, its next date set two months
 * on, and its servants told. Fellowship meetings never shuffle. A second run,
 * or one running alongside, finds the class already claimed. Stand-ins: the
 * database and the notice delivery.
 */
const world = vi.hoisted(() => ({
  due: [] as Array<{ id: string; name: string }>,
  servants: [] as Array<{ servant: { id: string; account: { displayName: string } } }>,
  dueQuery: null as null | Record<string, unknown>,
  claims: [] as Array<Record<string, unknown>>,
  claimCount: 1,
  classUpdates: [] as Array<Record<string, unknown>>,
  studentUpdates: [] as Array<{ ids: string[]; to: string }>,
  audits: [] as Array<Record<string, unknown>>,
  delivered: [] as Array<Record<string, unknown>>,
}))

const servants = [
  { servant: { id: 'sv-a', account: { displayName: 'Abanoub' } } },
  { servant: { id: 'sv-b', account: { displayName: 'Bishoy' } } },
]
const students = [
  { id: 'k1', firstName: 'Mina', lastName: 'Saad', groupServantId: 'sv-a', groupAssignedAt: null, fatherPhone: null, motherPhone: null },
  { id: 'k2', firstName: 'Mark', lastName: 'Adly', groupServantId: 'sv-a', groupAssignedAt: null, fatherPhone: null, motherPhone: null },
  { id: 'k3', firstName: 'Peter', lastName: 'Fam', groupServantId: 'sv-b', groupAssignedAt: null, fatherPhone: null, motherPhone: null },
  { id: 'k4', firstName: 'John', lastName: 'Hanna', groupServantId: 'sv-b', groupAssignedAt: null, fatherPhone: null, motherPhone: null },
]

vi.mock('@/lib/portal/notice-delivery', () => ({
  deliverNotices: async (notices: Array<Record<string, unknown>>) => {
    world.delivered.push(...notices)
    return { stored: notices.length, pushed: 0, emailed: 0, skipped: 0 }
  },
}))
vi.mock('@/lib/prisma', () => {
  const db = {
    schoolClass: {
      findMany: async (args: { where: Record<string, unknown>; select: Record<string, unknown> }) => {
        if ('servants' in args.select) return world.due.map((c) => ({ id: c.id, name: c.name, stage: 'MIDDLE_SCHOOL', servants: world.servants, students }))
        world.dueQuery = args.where
        return world.due
      },
      updateMany: async (args: Record<string, unknown>) => {
        world.claims.push(args)
        return { count: world.claimCount }
      },
      update: async (args: Record<string, unknown>) => {
        world.classUpdates.push(args)
        return {}
      },
    },
    student: {
      updateMany: async (args: { where: { id: { in: string[] } }; data: { groupServantId: string } }) => {
        world.studentUpdates.push({ ids: args.where.id.in, to: args.data.groupServantId })
        return { count: args.where.id.in.length }
      },
    },
    portalAuditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        world.audits.push(args.data)
        return {}
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { prisma: db }
})

import { shuffleClassGroups, shuffleDueGroups } from '@/lib/portal/data/groups'

// Wednesday Nov 25, 2026, 6:30 PM church time.
const NOV_25 = new Date('2026-11-26T00:30:00Z')

beforeEach(() => {
  world.due = []
  world.servants = servants
  world.dueQuery = null
  world.claims = []
  world.claimCount = 1
  world.classUpdates = []
  world.studentUpdates = []
  world.audits = []
  world.delivered = []
})

describe('shuffleDueGroups', () => {
  it("looks for the children's classes due today or before, already split and still running", async () => {
    await shuffleDueGroups(NOV_25)
    expect(world.dueQuery).toEqual({
      isActive: true,
      stage: { not: 'FELLOWSHIP' },
      groupsSplitAt: { not: null },
      groupsShuffleDueOn: { lte: new Date('2026-11-25T00:00:00.000Z') },
    })
  })

  it('shuffles a class that is due, sets its next shuffle two months on, and tells its servants', async () => {
    world.due = [{ id: 'boys', name: '5th & 6th Boys' }]
    const r = await shuffleDueGroups(NOV_25)
    expect(r).toEqual({ classes: 1, moved: 4 })
    // Claimed first, by moving its date on, so a second run finds it taken.
    expect(world.claims[0]).toEqual({
      where: { id: 'boys', groupsShuffleDueOn: { lte: new Date('2026-11-25T00:00:00.000Z') } },
      data: { groupsShuffleDueOn: new Date('2027-01-25T00:00:00.000Z') },
    })
    const moved = new Map(world.studentUpdates.flatMap((u) => u.ids.map((id) => [id, u.to])))
    expect(moved).toEqual(new Map([['k1', 'sv-b'], ['k2', 'sv-b'], ['k3', 'sv-a'], ['k4', 'sv-a']]))
    expect(world.classUpdates[0]).toMatchObject({ where: { id: 'boys' }, data: { groupsShuffleDueOn: new Date('2027-01-25T00:00:00.000Z') } })
    expect(world.audits).toEqual([expect.objectContaining({ actorName: 'Portal (automatic)', action: 'groups.shuffle', entityId: 'boys' })])
    expect(world.delivered.map((n) => [n.servantId, n.kind, n.email, n.title])).toEqual([
      ['sv-a', 'groups', false, 'Your follow-up group changed'],
      ['sv-b', 'groups', false, 'Your follow-up group changed'],
    ])
  })

  it('a class another run already claimed is left alone', async () => {
    world.due = [{ id: 'boys', name: '5th & 6th Boys' }]
    world.claimCount = 0
    const r = await shuffleDueGroups(NOV_25)
    expect(r).toEqual({ classes: 1, moved: 0 })
    expect(world.studentUpdates).toEqual([])
    expect(world.delivered).toEqual([])
  })

  it('a class with one servant is not shuffled: its date moves on two months, and nothing else', async () => {
    world.due = [{ id: 'boys', name: '5th & 6th Boys' }]
    world.servants = [servants[0]!]
    const r = await shuffleDueGroups(NOV_25)
    expect(r).toEqual({ classes: 1, moved: 0 })
    // Claimed, so the job looks at it again in two months, not every evening…
    expect(world.claims).toEqual([
      { where: { id: 'boys', groupsShuffleDueOn: { lte: new Date('2026-11-25T00:00:00.000Z') } }, data: { groupsShuffleDueOn: new Date('2027-01-25T00:00:00.000Z') } },
    ])
    // …but nobody moves, it is not marked shuffled, nothing is logged and nobody is told.
    expect(world.studentUpdates).toEqual([])
    expect(world.classUpdates).toEqual([])
    expect(world.audits).toEqual([])
    expect(world.delivered).toEqual([])
  })

  it('Shuffle now on a class with fewer than two servants changes nothing', async () => {
    world.due = [{ id: 'boys', name: '5th & 6th Boys' }]
    for (const few of [[servants[0]!], []]) {
      world.servants = few
      expect(await shuffleClassGroups('boys', { now: NOV_25 })).toMatchObject({ shuffled: false, moved: 0 })
    }
    expect(world.claims).toEqual([])
    expect(world.studentUpdates).toEqual([])
    expect(world.classUpdates).toEqual([])
    expect(world.delivered).toEqual([])
  })

  it('Shuffle now on a class with two servants shuffles it', async () => {
    world.due = [{ id: 'boys', name: '5th & 6th Boys' }]
    expect(await shuffleClassGroups('boys', { now: NOV_25 })).toEqual({ moved: 4, nextOn: '2027-01-25', shuffled: true, name: '5th & 6th Boys' })
  })
})
