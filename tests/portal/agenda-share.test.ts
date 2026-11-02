import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Copying a week of the Schedule into another class (2026-11-01). A
 * coordinator copied 5th & 6th Girls' plan into Boys and Boys' servants were
 * replaced by the Girls'. The plan comes over; the people never do: each class
 * keeps whoever it had on each part, its lead and its backup.
 */

const world = vi.hoisted(() => ({
  weeks: new Map<string, {
    id: string
    classId: string
    weekStart: string
    slideLink: string | null
    notes: string | null
    leadServantId: string | null
    backupServantId: string | null
  }>(),
  items: [] as Array<{ id: string; weekId: string; activityKey: string; topic: string | null; servantId: string | null; doneAt: Date | null; doneById: string | null }>,
  audits: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async (_u: unknown, _a: string, _t: string, _id: string, text: string) => { world.audits.push(text) } }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-coord', role: 'SERVANT', displayName: 'Coord', servantId: 'sv-coord',
    classIds: ['girls', 'boys'], coordinatorOf: ['girls', 'boys'], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async (_u: unknown, id: string) => ({ id, name: id === 'boys' ? '5th & 6th Boys' : '5th & 6th Girls', stage: 'MIDDLE_SCHOOL' }),
}))
vi.mock('@/lib/portal/data/agenda', () => ({ agendaServantOptions: async () => ({ onClass: [], others: [] }) }))
vi.mock('@/lib/portal/data/curriculum-link', () => ({ applyCurriculumLink: async () => {}, unlinkCurriculumPair: async () => {} }))
vi.mock('@/lib/portal/data/duties', () => ({ weekDuties: async () => [] }))
vi.mock('@/lib/portal/notify-duties', () => ({ notifyDutyChanges: async () => {} }))
vi.mock('@/lib/prisma', () => {
  const key = (classId: string, weekStart: Date) => `${classId}:${weekStart.toISOString().slice(0, 10)}`
  const withItems = (w: { id: string } | undefined) =>
    w ? { ...w, items: world.items.filter((i) => i.weekId === w.id).map(({ activityKey, topic, servantId }) => ({ activityKey, topic, servantId })) } : null
  const tx = {
    agendaWeek: {
      upsert: async (args: { where: { classId_weekStart: { classId: string; weekStart: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const { classId, weekStart } = args.where.classId_weekStart
        const k = key(classId, weekStart)
        const found = world.weeks.get(k)
        if (found) Object.assign(found, args.update)
        else world.weeks.set(k, { id: `w-${classId}`, slideLink: null, notes: null, leadServantId: null, backupServantId: null, ...(args.create as object), classId, weekStart: weekStart.toISOString().slice(0, 10) } as never)
        return { id: world.weeks.get(k)!.id }
      },
    },
    agendaItem: {
      findMany: async (args: { where: { weekId: string } }) => world.items.filter((i) => i.weekId === args.where.weekId),
      upsert: async (args: { where: { weekId_activityKey: { weekId: string; activityKey: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const { weekId, activityKey } = args.where.weekId_activityKey
        const found = world.items.find((i) => i.weekId === weekId && i.activityKey === activityKey)
        if (found) Object.assign(found, args.update)
        else world.items.push({ id: `i-${weekId}-${activityKey}`, doneAt: null, doneById: null, topic: null, servantId: null, ...(args.create as object) } as never)
        return {}
      },
    },
  }
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      schoolClass: {
        findUnique: async (args: { where: { id: string } }) => ({
          id: args.where.id,
          name: args.where.id === 'boys' ? '5th & 6th Boys' : '5th & 6th Girls',
          stage: 'MIDDLE_SCHOOL',
          curriculumLinkedToId: args.where.id === 'boys' ? 'girls' : 'boys',
        }),
      },
      agendaWeek: {
        findUnique: async (args: { where: { classId_weekStart: { classId: string; weekStart: Date } } }) =>
          withItems(world.weeks.get(key(args.where.classId_weekStart.classId, args.where.classId_weekStart.weekStart))),
      },
    },
  }
})

import { shareAgendaWeek } from '@/lib/portal/actions/agenda'
import { shareWeekPlan, type WeekPlan } from '@/lib/portal/agenda'

const WEEK = '2026-11-02'
function seed(classId: string, week: Partial<WeekPlan>, items: Array<[string, string | null, string | null, Date?]>) {
  const id = `w-${classId}`
  world.weeks.set(`${classId}:${WEEK}`, {
    id, classId, weekStart: WEEK,
    slideLink: week.slideLink ?? null, notes: week.notes ?? null,
    leadServantId: week.leadServantId ?? null, backupServantId: week.backupServantId ?? null,
  })
  for (const [activityKey, topic, servantId, doneAt] of items) {
    world.items.push({ id: `i-${id}-${activityKey}`, weekId: id, activityKey, topic, servantId, doneAt: doneAt ?? null, doneById: doneAt ? 'acc-x' : null })
  }
}
const itemOf = (classId: string, activityKey: string) => world.items.find((i) => i.weekId === `w-${classId}` && i.activityKey === activityKey)

beforeEach(() => {
  world.weeks.clear()
  world.items = []
  world.audits = []
})

describe('shareWeekPlan — what a copy leaves in the other class', () => {
  const source: WeekPlan = {
    slideLink: 'https://canva.com/girls',
    notes: 'Bring Bibles',
    leadServantId: 'sv-girls-lead',
    backupServantId: 'sv-girls-backup',
    items: [
      { activityKey: 'lesson', topic: 'Joseph forgives', servantId: 'sv-g1' },
      { activityKey: 'song', topic: 'Praise the Lord', servantId: 'sv-g2' },
      { activityKey: 'coptic', topic: null, servantId: 'sv-g3' },
    ],
  }

  it('brings the topics over, and keeps the other class’s topic where the source left a part empty', () => {
    const target: WeekPlan = {
      slideLink: null, notes: null, leadServantId: null, backupServantId: null,
      items: [
        { activityKey: 'lesson', topic: 'Old lesson', servantId: null },
        { activityKey: 'coptic', topic: 'Letter Alpha', servantId: null },
      ],
    }
    const r = shareWeekPlan(source, target)
    const topic = (k: string) => r.items.find((i) => i.activityKey === k)?.topic
    expect(topic('lesson')).toBe('Joseph forgives')
    expect(topic('song')).toBe('Praise the Lord')
    expect(topic('coptic')).toBe('Letter Alpha')
    expect(topic('verse')).toBeNull()
    expect(r.topics).toBe(2)
  })

  it('never brings the people over: each part keeps the other class’s servant, or stays unassigned', () => {
    const target: WeekPlan = {
      slideLink: null, notes: null, leadServantId: 'sv-boys-lead', backupServantId: null,
      items: [{ activityKey: 'lesson', topic: null, servantId: 'sv-b1' }],
    }
    const r = shareWeekPlan(source, target)
    const servant = (k: string) => r.items.find((i) => i.activityKey === k)?.servantId
    expect(servant('lesson')).toBe('sv-b1')
    expect(servant('song')).toBeNull()
    expect(servant('coptic')).toBeNull()
    expect(r.week.leadServantId).toBe('sv-boys-lead')
    expect(r.week.backupServantId).toBeNull()
  })

  it('a class with nothing saved for that week gets the topics and nobody assigned', () => {
    const r = shareWeekPlan(source, null)
    expect(r.items.every((i) => i.servantId === null)).toBe(true)
    expect(r.week.leadServantId).toBeNull()
    expect(r.week.backupServantId).toBeNull()
    expect(r.items).toHaveLength(10)
  })

  it('the presentation link and notes come over only where the other class has none', () => {
    expect(shareWeekPlan(source, null).week).toMatchObject({ slideLink: 'https://canva.com/girls', notes: 'Bring Bibles' })
    const own: WeekPlan = { slideLink: 'https://canva.com/boys', notes: 'Bring crayons', leadServantId: null, backupServantId: null, items: [] }
    expect(shareWeekPlan(source, own).week).toMatchObject({ slideLink: 'https://canva.com/boys', notes: 'Bring crayons' })
  })
})

describe('shareAgendaWeek', () => {
  it('copies Girls’ topics into Boys and leaves Boys’ servants, lead and done marks as they were', async () => {
    const done = new Date('2026-10-30T15:00:00Z')
    seed('girls', { leadServantId: 'sv-girls-lead', slideLink: 'https://canva.com/girls' }, [
      ['lesson', 'Joseph forgives', 'sv-g1'],
      ['song', 'Praise the Lord', 'sv-g2'],
    ])
    seed('boys', { leadServantId: 'sv-boys-lead' }, [['lesson', 'Old lesson', 'sv-b1', done]])

    const r = await shareAgendaWeek({ classId: 'girls', toClassId: 'boys', weekStart: WEEK })
    expect(r.ok).toBe(true)
    expect(r.ok && r.data).toEqual({ topics: 2 })

    expect(itemOf('boys', 'lesson')).toMatchObject({ topic: 'Joseph forgives', servantId: 'sv-b1', doneAt: done })
    expect(itemOf('boys', 'song')).toMatchObject({ topic: 'Praise the Lord', servantId: null })
    expect(world.weeks.get(`boys:${WEEK}`)).toMatchObject({ leadServantId: 'sv-boys-lead', slideLink: 'https://canva.com/girls' })
    // The source is only read.
    expect(itemOf('girls', 'lesson')).toMatchObject({ topic: 'Joseph forgives', servantId: 'sv-g1' })
    expect(world.audits[0]).toContain('Copied 5th & 6th Girls')
  })

  it('says so when the other class has nothing planned for that week', async () => {
    seed('girls', {}, [['lesson', null, 'sv-g1']])
    const r = await shareAgendaWeek({ classId: 'girls', toClassId: 'boys', weekStart: WEEK })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/nothing planned/)
    expect(world.weeks.has(`boys:${WEEK}`)).toBe(false)
  })

  it('refuses when no week is saved there at all', async () => {
    const r = await shareAgendaWeek({ classId: 'girls', toClassId: 'boys', weekStart: WEEK })
    expect(r.ok).toBe(false)
  })
})
