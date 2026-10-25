import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Every save that can change who holds a part of a Sunday tells the servants
 * (2026-10-19): it reads who held what, writes, reads again, and hands the
 * difference over, and a failure to tell anyone never fails the save. Stand-ins:
 * the signed-in coordinator (servant sv-paul), the class check, the snapshots,
 * the notifier and a database that logs the order of things.
 */
const world = vi.hoisted(() => ({
  order: [] as string[],
  weekCalls: [] as Array<[string, string[]]>,
  lessonCalls: [] as string[][],
  snapshots: [] as unknown[][],
  notifyArgs: [] as unknown[][],
  notifyFails: false,
  snapshotFailsAfterWrite: false,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-paul', role: 'SERVANT', displayName: 'Paul', servantId: 'sv-paul',
    classIds: ['5th-6th-boys'], coordinatorOf: ['5th-6th-boys'], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async () => ({ id: '5th-6th-boys', name: '5th & 6th Boys', stage: 'MIDDLE_SCHOOL', visitationThreshold: 1, takesOtherClasses: false }),
}))
vi.mock('@/lib/portal/data/agenda', () => ({
  agendaServantOptions: async () => ({ onClass: [{ id: 'sv-mina', name: 'Mina S' }], others: [] }),
}))
vi.mock('@/lib/portal/data/curriculum-link', () => ({ applyCurriculumLink: async () => {}, unlinkCurriculumPair: async () => {} }))
vi.mock('@/lib/portal/data/lessons', () => ({
  loadLessonForAction: async (id: string) => ({ id, classId: '5th-6th-boys', title: 'Joseph' }),
}))
vi.mock('@/lib/portal/data/duties', () => ({
  weekDuties: async (classId: string, mondays: string[]) => {
    if (world.snapshotFailsAfterWrite && world.order.includes('write')) throw new Error('read failed')
    world.order.push('snapshot')
    world.weekCalls.push([classId, [...mondays]])
    return world.snapshots.shift() ?? []
  },
  lessonDuties: async (ids: string[]) => {
    world.order.push('snapshot')
    world.lessonCalls.push([...ids])
    return world.snapshots.shift() ?? []
  },
}))
vi.mock('@/lib/portal/notify-duties', () => ({
  notifyDutyChanges: async (...args: unknown[]) => {
    world.order.push('notify')
    world.notifyArgs.push(args)
    if (world.notifyFails) throw new Error('push service down')
  },
}))
vi.mock('@/lib/prisma', () => {
  const write = (value: unknown = {}) => async () => {
    world.order.push('write')
    return value
  }
  const tx = { agendaWeek: { upsert: async () => ({ id: 'w1' }) }, agendaItem: { findMany: async () => [], upsert: async () => ({}) } }
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        world.order.push('write')
        return fn(tx)
      },
      agendaWeek: {
        findMany: async (args: { select: Record<string, unknown> }) =>
          'items' in args.select ? [] : [{ id: 'w1', weekStart: new Date('2026-10-19T00:00:00Z') }],
        findUnique: async () => ({ id: 'w1' }),
        delete: write(),
        deleteMany: write({ count: 1 }),
      },
      classServant: { findUnique: async () => ({ servantId: 'sv-mina' }) },
      lesson: { create: write({ id: 'l-new' }), update: write({ id: 'l1' }), delete: write() },
    },
  }
})

import { clearAgendaWeeks, importAgendaCsv, saveAgendaWeek } from '@/lib/portal/actions/agenda'
import { deleteLesson, saveLesson } from '@/lib/portal/actions/lessons'

const BEFORE = [{ slot: 'before' }]
const AFTER = [{ slot: 'after' }]

beforeEach(() => {
  world.order = []
  world.weekCalls = []
  world.lessonCalls = []
  world.snapshots = [BEFORE, AFTER]
  world.notifyArgs = []
  world.notifyFails = false
  world.snapshotFailsAfterWrite = false
})

describe('the Schedule', () => {
  it('saveAgendaWeek snapshots the week before and after writing, and notifies the difference', async () => {
    const r = await saveAgendaWeek({ classId: '5th-6th-boys', weekStart: '2026-10-25', items: [{ activityKey: 'coptic', servantId: 'sv-mina' }] })
    expect(r.ok).toBe(true)
    expect(world.order).toEqual(['snapshot', 'write', 'snapshot', 'notify'])
    expect(world.weekCalls).toEqual([
      ['5th-6th-boys', ['2026-10-19']],
      ['5th-6th-boys', ['2026-10-19']],
    ])
    expect(world.notifyArgs).toEqual([[BEFORE, AFTER, 'sv-paul']])
  })

  it('saveAgendaWeek succeeds when delivery fails', async () => {
    world.notifyFails = true
    expect((await saveAgendaWeek({ classId: '5th-6th-boys', weekStart: '2026-10-25' })).ok).toBe(true)
  })

  it('saveAgendaWeek succeeds when the second snapshot cannot be read', async () => {
    world.snapshotFailsAfterWrite = true
    expect((await saveAgendaWeek({ classId: '5th-6th-boys', weekStart: '2026-10-25' })).ok).toBe(true)
    expect(world.notifyArgs).toEqual([])
  })

  it('an import snapshots all its weeks once before and once after, and notifies once', async () => {
    const csv = 'Week Start,Activity,Topic,Servant\n2026-10-19,Coptic,Letters,Mina S\n2026-10-26,Coptic,Letters,Mina S\n'
    const r = await importAgendaCsv({ classId: '5th-6th-boys', csv })
    expect(r.ok).toBe(true)
    expect(world.weekCalls).toEqual([
      ['5th-6th-boys', ['2026-10-19', '2026-10-26']],
      ['5th-6th-boys', ['2026-10-19', '2026-10-26']],
    ])
    expect(world.notifyArgs).toHaveLength(1)
  })

  it('a preview import notifies nobody', async () => {
    const csv = 'Week Start,Activity,Topic,Servant\n2026-10-19,Coptic,Letters,Mina S\n'
    expect((await importAgendaCsv({ classId: '5th-6th-boys', csv, preview: true })).ok).toBe(true)
    expect(world.weekCalls).toEqual([])
    expect(world.notifyArgs).toEqual([])
  })

  it('clearAgendaWeeks tells the servants of the cleared weeks', async () => {
    world.snapshots = [BEFORE, []]
    const r = await clearAgendaWeeks({ classId: '5th-6th-boys', weekStarts: ['2026-10-19'] })
    expect(r.ok).toBe(true)
    expect(world.order).toEqual(['snapshot', 'write', 'snapshot', 'notify'])
    expect(world.notifyArgs).toEqual([[BEFORE, [], 'sv-paul']])
  })
})

describe('lessons', () => {
  it('saveLesson tells a new lesson’s teacher', async () => {
    world.snapshots = [AFTER]
    const r = await saveLesson({ classId: '5th-6th-boys', title: 'Joseph', date: '2026-10-25', assignedToId: 'sv-mina' })
    expect(r.ok).toBe(true)
    expect(world.lessonCalls).toEqual([['l-new']])
    expect(world.notifyArgs).toEqual([[[], AFTER, 'sv-paul']])
  })

  it('saveLesson on an existing lesson compares before and after', async () => {
    const r = await saveLesson({ id: 'l1', classId: '5th-6th-boys', title: 'Joseph', assignedToId: 'sv-mina' })
    expect(r.ok).toBe(true)
    expect(world.order).toEqual(['snapshot', 'write', 'snapshot', 'notify'])
    expect(world.notifyArgs).toEqual([[BEFORE, AFTER, 'sv-paul']])
  })

  it('deleteLesson tells its teacher', async () => {
    world.snapshots = [BEFORE, []]
    expect((await deleteLesson('l1')).ok).toBe(true)
    expect(world.notifyArgs).toEqual([[BEFORE, [], 'sv-paul']])
  })
})
