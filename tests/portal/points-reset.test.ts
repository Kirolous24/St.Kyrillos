import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Resetting points (2026-11-02): "make it a lot more easier for the admin to go
 * into a certain class and have a button to reset all points … Or to go into
 * children's profiles and reset points for them. Individually." The admin only.
 * A reset deletes the points and stamps when, so a register from before it can
 * be saved again without bringing them back (tests/portal/attendance-award.test.ts).
 */

const world = vi.hoisted(() => ({
  role: 'ADMIN' as string,
  entries: [] as Array<{ studentId: string; points: number }>,
  resetAt: new Map<string, Date>(),
  roster: [] as Array<{ id: string; firstName: string; lastName: string; classId: string | null }>,
  audits: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }))
vi.mock('@/lib/portal/audit', () => ({ audit: async (_u: unknown, _a: string, _t: string, _id: string, text: string) => { world.audits.push(text) } }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-1', role: world.role, displayName: 'Someone', servantId: world.role === 'ADMIN' ? null : 'sv-1',
    classIds: ['kg'], coordinatorOf: ['kg'], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/prisma', () => {
  const tx = {
    pointEntry: {
      aggregate: async (args: { where: { studentId: { in: string[] } } }) => ({
        _sum: { points: world.entries.filter((e) => args.where.studentId.in.includes(e.studentId)).reduce((n, e) => n + e.points, 0) },
      }),
      deleteMany: async (args: { where: { studentId: { in: string[] } } }) => {
        const before = world.entries.length
        world.entries = world.entries.filter((e) => !args.where.studentId.in.includes(e.studentId))
        return { count: before - world.entries.length }
      },
    },
    student: {
      updateMany: async (args: { where: { id: { in: string[] } }; data: { pointsResetAt: Date } }) => {
        for (const id of args.where.id.in) world.resetAt.set(id, args.data.pointsResetAt)
        return { count: args.where.id.in.length }
      },
    },
  }
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      schoolClass: {
        findUnique: async (args: { where: { id: string } }) => (args.where.id === 'kg' ? { id: 'kg', name: 'KG' } : null),
      },
      student: {
        findUnique: async (args: { where: { id: string } }) => world.roster.find((s) => s.id === args.where.id) ?? null,
        findMany: async () => world.roster,
      },
    },
  }
})

import { resetClassPoints, resetStudentPoints } from '@/lib/portal/actions/points'

beforeEach(() => {
  world.role = 'ADMIN'
  world.entries = [
    { studentId: 'mina', points: 40 },
    { studentId: 'mina', points: -2 },
    { studentId: 'sara', points: 25 },
    { studentId: 'teen', points: 9 },
  ]
  world.resetAt.clear()
  world.roster = [
    { id: 'mina', firstName: 'Mina', lastName: 'A', classId: 'kg' },
    { id: 'sara', firstName: 'Sara', lastName: 'B', classId: 'kg' },
    // A member who belongs to another class: one total, shown on this class's leaderboard.
    { id: 'teen', firstName: 'Teen', lastName: 'C', classId: 'high-school' },
  ]
  world.audits = []
})

describe('resetStudentPoints — one child', () => {
  it('sets the child back to 0, stamps when, and logs what they had', async () => {
    const r = await resetStudentPoints('mina')
    expect(r.ok && r.data).toEqual({ points: 38 })
    expect(world.entries.filter((e) => e.studentId === 'mina')).toEqual([])
    expect(world.entries).toHaveLength(2)
    expect(world.resetAt.has('mina')).toBe(true)
    expect(world.audits).toEqual(['Mina A: points reset to 0 (had 38)'])
  })

  it('is for the admin only', async () => {
    world.role = 'SERVANT'
    const r = await resetStudentPoints('mina')
    expect(r.ok).toBe(false)
    expect(world.entries).toHaveLength(4)
  })

  it('says so when the child is not found', async () => {
    expect((await resetStudentPoints('nobody')).ok).toBe(false)
  })
})

describe('resetClassPoints — a whole class', () => {
  it('sets everyone on the class’s list back to 0, members from other classes included', async () => {
    const r = await resetClassPoints('kg')
    expect(r.ok && r.data).toEqual({ children: 3, points: 72 })
    expect(world.entries).toEqual([])
    expect(Array.from(world.resetAt.keys()).sort()).toEqual(['mina', 'sara', 'teen'])
    expect(world.audits).toEqual(['KG: points reset to 0 for 3 children (had 72)'])
  })

  it('is for the admin only', async () => {
    world.role = 'SERVANT'
    expect((await resetClassPoints('kg')).ok).toBe(false)
    expect(world.entries).toHaveLength(4)
  })

  it('says so when the class has nobody on its list', async () => {
    world.roster = []
    const r = await resetClassPoints('kg')
    expect(r.ok).toBe(false)
  })
})

describe('the Danger Zone’s “Clear a class’s points” does the same', () => {
  it('resets everyone on the class’s list and stamps when, so old registers stay at 0', async () => {
    const { clearClassPoints } = await import('@/lib/portal/actions/data-tools')
    const r = await clearClassPoints('kg', 'CLEAR POINTS')
    expect(r.ok).toBe(true)
    expect(world.entries).toEqual([])
    expect(Array.from(world.resetAt.keys()).sort()).toEqual(['mina', 'sara', 'teen'])
  })
})
