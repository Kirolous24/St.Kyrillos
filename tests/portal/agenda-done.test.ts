import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Marking a part of Sunday done (2026-10-19): the servant on a part marks it
 * ready once they have, say, updated the slides, and the coordinator sees it on
 * the Schedule. The class's coordinators may mark it for them. Giving the part
 * to someone else clears the mark. Stand-ins: the signed-in person, the class
 * check, and a database that records the writes.
 */
const world = vi.hoisted(() => ({
  user: {
    accountId: 'acc-mina', role: 'SERVANT', displayName: 'Mina', servantId: 'sv-mina' as string | undefined,
    classIds: ['boys'], coordinatorOf: [] as string[], assistantOf: [] as string[], stageOversight: null as string | null,
  },
  item: null as null | Record<string, unknown>,
  updates: [] as Array<Record<string, unknown>>,
  existing: [] as Array<{ activityKey: string; servantId: string | null }>,
  upserts: [] as Array<{ where: unknown; update: Record<string, unknown> }>,
  audits: [] as Array<{ action: string; detail: string }>,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({
  audit: async (_u: unknown, action: string, _e: string, _id: string | null, detail: string) => {
    world.audits.push({ action, detail })
  },
}))
vi.mock('@/lib/portal/session', () => ({ requirePortalUser: async () => world.user }))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async () => ({ id: 'boys', name: '5th & 6th Boys', stage: 'MIDDLE_SCHOOL', visitationThreshold: 1, takesOtherClasses: false }),
}))
vi.mock('@/lib/portal/data/agenda', () => ({
  agendaServantOptions: async () => ({ onClass: [{ id: 'sv-mina', name: 'Mina S' }, { id: 'sv-george', name: 'George S' }], others: [] }),
}))
vi.mock('@/lib/portal/data/curriculum-link', () => ({ applyCurriculumLink: async () => {}, unlinkCurriculumPair: async () => {} }))
vi.mock('@/lib/portal/with-duty-notices', () => ({ withDutyNotices: async (_s: unknown, _a: unknown, write: () => Promise<unknown>) => write() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    agendaWeek: { upsert: async () => ({ id: 'w1' }) },
    agendaItem: {
      findMany: async () => world.existing,
      upsert: async (args: { where: unknown; update: Record<string, unknown> }) => {
        world.upserts.push({ where: args.where, update: args.update })
        return {}
      },
    },
  }
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      agendaItem: {
        findUnique: async () => world.item,
        update: async (args: { data: Record<string, unknown> }) => {
          world.updates.push(args.data)
          return { doneAt: args.data.doneAt ?? null }
        },
      },
    },
  }
})

import { saveAgendaWeek, setAgendaItemDone } from '@/lib/portal/actions/agenda'
import { doneLabel } from '@/lib/portal/agenda'

const ITEM = {
  id: 'it1',
  activityKey: 'coptic',
  servantId: 'sv-mina',
  week: { classId: 'boys', weekStart: new Date('2026-10-19T00:00:00Z'), class: { name: '5th & 6th Boys', stage: 'MIDDLE_SCHOOL' } },
}

beforeEach(() => {
  world.user = { ...world.user, servantId: 'sv-mina', coordinatorOf: [], assistantOf: [], stageOversight: null }
  world.item = { ...ITEM }
  world.updates = []
  world.existing = []
  world.upserts = []
  world.audits = []
})

describe('setAgendaItemDone', () => {
  it('the servant on the part marks it done, and says who and when', async () => {
    const r = await setAgendaItemDone({ itemId: 'it1', done: true })
    expect(r.ok).toBe(true)
    expect(world.updates).toHaveLength(1)
    expect(world.updates[0]!.doneById).toBe('acc-mina')
    expect(world.updates[0]!.doneAt).toBeInstanceOf(Date)
    expect(world.audits[0]).toEqual({ action: 'agenda.done', detail: expect.stringMatching(/5th & 6th Boys.*Coptic.*Oct 25/) })
  })

  it('and can take it back', async () => {
    expect((await setAgendaItemDone({ itemId: 'it1', done: false })).ok).toBe(true)
    expect(world.updates).toEqual([{ doneAt: null, doneById: null }])
    expect(world.audits[0]!.action).toBe('agenda.undone')
  })

  it('a coordinator or assistant of the class may mark it for them', async () => {
    world.user = { ...world.user, servantId: 'sv-george', assistantOf: ['boys'] }
    expect((await setAgendaItemDone({ itemId: 'it1', done: true })).ok).toBe(true)
  })

  it('another servant of the class may not', async () => {
    world.user = { ...world.user, servantId: 'sv-george' }
    expect(await setAgendaItemDone({ itemId: 'it1', done: true })).toEqual({
      ok: false,
      error: 'Only the servant on this part, or the class’s coordinators, can mark it done.',
    })
    expect(world.updates).toEqual([])
  })

  it('a part nobody is on cannot be done', async () => {
    world.item = { ...ITEM, servantId: null }
    expect(await setAgendaItemDone({ itemId: 'it1', done: true })).toEqual({ ok: false, error: 'Nobody is on this part yet.' })
  })

  it('a part that no longer exists says so', async () => {
    world.item = null
    expect((await setAgendaItemDone({ itemId: 'gone', done: true })).ok).toBe(false)
  })
})

describe('saving the week', () => {
  it('giving a part to someone else clears its done mark', async () => {
    world.user = { ...world.user, coordinatorOf: ['boys'] }
    world.existing = [{ activityKey: 'coptic', servantId: 'sv-mina' }, { activityKey: 'verse', servantId: 'sv-george' }]
    const r = await saveAgendaWeek({
      classId: 'boys',
      weekStart: '2026-10-25',
      items: [
        { activityKey: 'coptic', servantId: 'sv-george' },
        { activityKey: 'verse', servantId: 'sv-george', topic: 'John 3:16' },
      ],
    })
    expect(r.ok).toBe(true)
    const byKey = new Map(world.upserts.map((u) => [JSON.stringify(u.where), u.update]))
    const coptic = byKey.get(JSON.stringify({ weekId_activityKey: { weekId: 'w1', activityKey: 'coptic' } }))!
    const verse = byKey.get(JSON.stringify({ weekId_activityKey: { weekId: 'w1', activityKey: 'verse' } }))!
    expect(coptic).toMatchObject({ servantId: 'sv-george', doneAt: null, doneById: null })
    // Same servant, new topic: the mark stays.
    expect(verse).not.toHaveProperty('doneAt')
    expect(verse).toMatchObject({ servantId: 'sv-george', topic: 'John 3:16' })
  })
})

describe('doneLabel', () => {
  it('says who marked it and on which day, in church time', () => {
    // 11:30 PM UTC on Oct 22 is still Thursday evening at church.
    expect(doneLabel(new Date('2026-10-22T23:30:00Z'), 'Mina S')).toBe('Done · Mina S · Thu, Oct 22')
    expect(doneLabel(new Date('2026-10-23T05:30:00Z'), null)).toBe('Done · Fri, Oct 23')
  })
})
