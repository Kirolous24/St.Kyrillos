import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Custom points (2026-10-25): any class may give a number of points it types,
 * with a reason, and keep it as one of its own activities for next time.
 * Stand-ins: the signed-in servant (serves "kg"), the class check, and a
 * database that records what is read and written.
 */
const world = vi.hoisted(() => ({
  roster: [] as Array<{ id: string; firstName: string; lastName: string }>,
  listed: [] as Array<{ classId: string | null; key: string; label: string }>,
  existing: null as null | { id: string },
  created: [] as Array<Record<string, unknown>>,
  updatedActivities: [] as Array<Record<string, unknown>>,
  entries: [] as Array<Record<string, unknown>>,
  audits: [] as Array<{ action: string; detail: string }>,
  reads: 0,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({
  audit: async (_u: unknown, action: string, _e: string, _id: string | null, detail: string) => {
    world.audits.push({ action, detail })
  },
}))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-george', role: 'SERVANT', displayName: 'George', servantId: 'sv-george',
    classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', async () => {
  const { PortalError } = await import('@/lib/portal/action-result')
  return {
    assertClassAction: async (_u: unknown, classId: string, action: string) => {
      if (classId !== 'kg' || action !== 'points.write') throw new PortalError('You do not have permission to do that in this class.')
      return { id: 'kg', name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }
    },
  }
})
vi.mock('@/lib/prisma', () => {
  const db = {
    student: {
      findMany: async (args: { where: { AND: Array<{ id?: { in: string[] } }> } }) => {
        world.reads++
        const ids = args.where.AND[0]!.id!.in
        return world.roster.filter((s) => ids.includes(s.id))
      },
    },
    pointActivity: {
      findMany: async () => {
        world.reads++
        return world.listed
      },
      findFirst: async () => world.existing,
      create: async (args: { data: Record<string, unknown> }) => {
        world.created.push(args.data)
        return { id: 'act-new', key: args.data.key }
      },
      update: async (args: { data: Record<string, unknown> }) => {
        world.updatedActivities.push(args.data)
        return { id: world.existing!.id }
      },
    },
    pointEntry: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        world.entries.push(...args.data)
        return { count: args.data.length }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { prisma: db }
})

import { giveCustomPoints } from '@/lib/portal/actions/points'

const mina = { id: 'mina', firstName: 'Mina', lastName: 'Saad' }
const mark = { id: 'mark', firstName: 'Mark', lastName: 'Adly' }

beforeEach(() => {
  world.roster = [mina, mark]
  world.listed = [{ classId: null, key: 'homework', label: 'Homework' }]
  world.existing = null
  world.created = []
  world.updatedActivities = []
  world.entries = []
  world.audits = []
  world.reads = 0
})

describe('giveCustomPoints', () => {
  it('gives the typed points, with the reason as the ledger line', async () => {
    const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina', 'mark'], points: 5, reason: 'Helped set up chairs' })
    expect(r).toEqual({ ok: true, data: { count: 2, points: 5, saved: false } })
    expect(world.entries).toEqual([
      { studentId: 'mina', classId: 'kg', points: 5, source: 'MANUAL', activityKey: 'manual_custom', activityLabel: 'Helped set up chairs', reason: null, createdById: 'acc-george' },
      { studentId: 'mark', classId: 'kg', points: 5, source: 'MANUAL', activityKey: 'manual_custom', activityLabel: 'Helped set up chairs', reason: null, createdById: 'acc-george' },
    ])
    expect(world.created).toEqual([])
    expect(world.audits.map((a) => a.action)).toEqual(['points.give'])
  })

  it('checks points on that class before reading or writing anything', async () => {
    const r = await giveCustomPoints({ classId: '1st', studentIds: ['mina'], points: 5, reason: 'Helping' })
    expect(r.ok).toBe(false)
    expect(world.reads).toBe(0)
    expect(world.entries).toEqual([])
  })

  for (const points of [0, -3, 101, 2.5]) {
    it(`refuses ${points} points`, async () => {
      const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points, reason: 'Helping' })
      expect(r).toEqual({ ok: false, error: 'Give between 1 and 100 points.' })
      expect(world.entries).toEqual([])
    })
  }

  it('refuses without a reason', async () => {
    const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points: 5, reason: '   ' })
    expect(r).toEqual({ ok: false, error: 'Write what the points are for.' })
    expect(world.entries).toEqual([])
  })

  it('keeps a long reason whole beside a shortened ledger line', async () => {
    const reason = `Read the whole chapter aloud to the class and answered every question ${'well '.repeat(6)}`.trim()
    await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points: 3, reason })
    expect(reason.length).toBeGreaterThan(80)
    expect(world.entries[0]).toMatchObject({ activityLabel: reason.slice(0, 80), reason })
  })

  it('only children on this class’s roster get points', async () => {
    world.roster = [mina]
    const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina', 'someone-else'], points: 2, reason: 'Helping' })
    expect(r).toMatchObject({ ok: true, data: { count: 1 } })
    expect(world.entries.map((e) => e.studentId)).toEqual(['mina'])
  })
})

describe('saving it for next time', () => {
  it('adds a class activity at that value, and the points are given under it', async () => {
    const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points: 4, reason: 'Choir practice', save: true })
    expect(r).toEqual({ ok: true, data: { count: 1, points: 4, saved: true } })
    expect(world.created).toEqual([{ classId: 'kg', key: 'choir-practice', label: 'Choir practice', points: 4, icon: null, createdById: 'acc-george' }])
    expect(world.entries[0]).toMatchObject({ activityKey: 'choir-practice', activityLabel: 'Choir practice', points: 4 })
    expect(world.audits.map((a) => a.action)).toEqual(['activity.create', 'points.give'])
  })

  it('brings back a removed activity of that name rather than adding a second', async () => {
    world.existing = { id: 'act-old' }
    await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points: 6, reason: 'Choir practice', save: true })
    expect(world.created).toEqual([])
    expect(world.updatedActivities).toEqual([{ isActive: true, label: 'Choir practice', points: 6 }])
  })

  it('refuses a name every class already has, and gives nothing', async () => {
    const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points: 4, reason: 'homework', save: true })
    expect(r).toEqual({ ok: false, error: 'Every class already has "Homework". Pick it from the list, or untick Save for next time.' })
    expect(world.entries).toEqual([])
    expect(world.created).toEqual([])
  })

  it('refuses a name this class already has, and gives nothing', async () => {
    world.listed = [...world.listed, { classId: 'kg', key: 'choir-practice', label: 'Choir practice' }]
    const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points: 4, reason: 'Choir Practice', save: true })
    expect(r).toEqual({ ok: false, error: 'This class already has "Choir practice". Pick it from the list, or untick Save for next time.' })
    expect(world.entries).toEqual([])
  })

  it('refuses a name over 60 characters', async () => {
    const r = await giveCustomPoints({ classId: 'kg', studentIds: ['mina'], points: 4, reason: 'x'.repeat(61), save: true })
    expect(r).toEqual({ ok: false, error: 'Keep the reason under 60 characters to save it for next time.' })
    expect(world.entries).toEqual([])
  })
})
