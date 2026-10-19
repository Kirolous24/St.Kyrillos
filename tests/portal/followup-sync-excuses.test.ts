import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The automatic follow-up rule and excuses (2026-10-19): a child excused from
 * one date to another gets no case for a Sunday inside it, and those Sundays
 * do not count once it is over. A stand-in database answers the rule's reads
 * and records the cases it opens.
 */
const world = vi.hoisted(() => ({
  held: [] as string[],
  rows: [] as Array<{ studentId: string; date: string; status: 'PRESENT' | 'EXCUSED' | 'ABSENT' }>,
  excuses: [] as Array<{ studentId: string; startsOn: string; endsOn: string }>,
  openCases: [] as Array<{ id: string; studentId: string; origin: 'AUTO' | 'MANUAL' }>,
  created: [] as Array<{ studentId: string; consecutiveAbsences: number }>,
  excuseQueries: 0,
}))

const day = (d: string) => new Date(`${d}T00:00:00.000Z`)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    attendanceRecord: {
      findMany: async (args: { where: { classId?: string }; distinct?: string[] }) =>
        args.distinct
          ? world.held.map((d) => ({ date: day(d) }))
          : world.rows.map((r) => ({ studentId: r.studentId, date: day(r.date), status: r.status })),
    },
    followUpCase: {
      findMany: async () => world.openCases,
      create: async (args: { data: { studentId: string; consecutiveAbsences: number } }) => {
        world.created.push({ studentId: args.data.studentId, consecutiveAbsences: args.data.consecutiveAbsences })
        return {}
      },
      update: async () => ({}),
    },
    student: {
      findMany: async () => [{ id: 'mina', createdAt: day('2026-09-01') }],
    },
    followUpExcuse: {
      findMany: async () => {
        world.excuseQueries++
        return world.excuses.map((e) => ({ studentId: e.studentId, startsOn: day(e.startsOn), endsOn: day(e.endsOn) }))
      },
    },
  },
}))

import { syncAutoFollowUps } from '@/lib/portal/followup-sync'

beforeEach(() => {
  world.held = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']
  world.rows = [
    { studentId: 'mina', date: '2026-09-21', status: 'PRESENT' },
    { studentId: 'mina', date: '2026-09-28', status: 'PRESENT' },
  ]
  world.excuses = []
  world.openCases = []
  world.created = []
  world.excuseQueries = 0
})

const run = () => syncAutoFollowUps({ classId: 'kg', studentIds: ['mina'], threshold: 1, asOf: '2026-10-12' })

describe('syncAutoFollowUps with excuses', () => {
  it('opens a case for two missed Sundays when nobody excused them', async () => {
    const r = await run()
    expect(r.opened).toBe(1)
    expect(world.created).toEqual([{ studentId: 'mina', consecutiveAbsences: 2 }])
  })

  it('opens nothing while the child is excused', async () => {
    world.excuses = [{ studentId: 'mina', startsOn: '2026-10-01', endsOn: '2026-10-31' }]
    const r = await run()
    expect(world.excuseQueries).toBe(1)
    expect(r.opened).toBe(0)
    expect(world.created).toEqual([])
  })

  it('counts only the Sundays outside the excuse', async () => {
    // Excused for the first missed Sunday only: one in a row, not two.
    world.excuses = [{ studentId: 'mina', startsOn: '2026-10-05', endsOn: '2026-10-05' }]
    await run()
    expect(world.created).toEqual([{ studentId: 'mina', consecutiveAbsences: 1 }])
  })

  it('is not fooled by another child’s excuse', async () => {
    world.excuses = [{ studentId: 'someone-else', startsOn: '2026-10-01', endsOn: '2026-10-31' }]
    expect((await run()).opened).toBe(1)
  })
})
