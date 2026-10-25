import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Snapshots of who holds which part of a Sunday (2026-10-19), read before and
 * after a save and for the evening-before reminder. Stand-in: the database.
 */
const world = vi.hoisted(() => ({
  weeks: [] as unknown[],
  lessons: [] as unknown[],
  weekQueries: [] as Array<Record<string, unknown>>,
  lessonQueries: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agendaWeek: {
      findMany: async (args: Record<string, unknown>) => {
        world.weekQueries.push(args)
        return world.weeks
      },
    },
    lesson: {
      findMany: async (args: Record<string, unknown>) => {
        world.lessonQueries.push(args)
        return world.lessons
      },
    },
  },
}))

import { dutiesDueOn, lessonDuties, weekDuties } from '@/lib/portal/data/duties'

const WEEK = {
  weekStart: new Date('2026-10-19T00:00:00Z'),
  classId: '5th-6th-boys',
  leadServantId: 'sv-lead',
  backupServantId: null,
  class: { name: '5th & 6th Boys' },
  items: [
    { activityKey: 'coptic', topic: 'Letters 1–4', servantId: 'sv-mina', doneAt: new Date('2026-10-22T18:00:00Z') },
    { activityKey: 'verse', topic: null, servantId: null, doneAt: null },
  ],
}

beforeEach(() => {
  world.weeks = []
  world.lessons = []
  world.weekQueries = []
  world.lessonQueries = []
})

describe('weekDuties', () => {
  it('lists every held part of the week, due its Sunday, with stable slots', async () => {
    world.weeks = [WEEK]
    expect(await weekDuties('5th-6th-boys', ['2026-10-19'])).toEqual([
      {
        slot: 'item:5th-6th-boys:2026-10-19:coptic',
        kind: 'activity',
        servantId: 'sv-mina',
        label: 'Coptic',
        topic: 'Letters 1–4',
        className: '5th & 6th Boys',
        classId: '5th-6th-boys',
        due: '2026-10-25',
        href: '/portal/assignments#week-2026-10-19',
        done: true,
      },
      {
        slot: 'lead:5th-6th-boys:2026-10-19',
        kind: 'lead',
        servantId: 'sv-lead',
        label: 'Lead',
        topic: null,
        className: '5th & 6th Boys',
        classId: '5th-6th-boys',
        due: '2026-10-25',
        href: '/portal/assignments#week-2026-10-19',
        done: false,
      },
    ])
    expect(world.weekQueries[0]).toMatchObject({ where: { classId: '5th-6th-boys', weekStart: { in: [new Date('2026-10-19T00:00:00Z')] } } })
  })

  it('asks nothing for no weeks', async () => {
    expect(await weekDuties('5th-6th-boys', [])).toEqual([])
    expect(world.weekQueries).toEqual([])
  })
})

describe('lessonDuties', () => {
  it('a dated lesson is due its day; an undated one has no day; an unassigned one is nobody’s', async () => {
    world.lessons = [
      { id: 'l1', title: 'Joseph', date: new Date('2026-10-25T00:00:00Z'), assignedToId: 'sv-mina', class: { name: '5th & 6th Boys' } },
      { id: 'l2', title: 'Ruth', date: null, assignedToId: 'sv-mina', class: { name: '5th & 6th Boys' } },
      { id: 'l3', title: 'Esther', date: null, assignedToId: null, class: { name: '5th & 6th Boys' } },
    ]
    const duties = await lessonDuties(['l1', 'l2', 'l3'])
    expect(duties.map((d) => [d.slot, d.label, d.due, d.href])).toEqual([
      ['lesson:l1', 'Lesson “Joseph”', '2026-10-25', '/portal/assignments#week-2026-10-19'],
      ['lesson:l2', 'Lesson “Ruth”', null, '/portal/assignments'],
    ])
  })
})

describe('dutiesDueOn', () => {
  it('on a Sunday: that week’s parts and that day’s lessons, in active classes', async () => {
    world.weeks = [WEEK]
    const duties = await dutiesDueOn('2026-10-25')
    expect(duties.map((d) => d.slot)).toEqual(['item:5th-6th-boys:2026-10-19:coptic', 'lead:5th-6th-boys:2026-10-19'])
    expect(world.weekQueries[0]).toMatchObject({ where: { weekStart: new Date('2026-10-19T00:00:00Z'), class: { isActive: true } } })
    expect(world.lessonQueries[0]).toMatchObject({ where: { date: new Date('2026-10-25T00:00:00Z'), assignedToId: { not: null } } })
  })

  it('on another day: only lessons, as the Schedule is Sunday’s', async () => {
    await dutiesDueOn('2026-10-24')
    expect(world.weekQueries).toEqual([])
    expect(world.lessonQueries).toHaveLength(1)
  })
})
