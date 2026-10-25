import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Duty } from '@/lib/portal/assignment-notices'

/**
 * The evening-before reminder (2026-10-19): once a day, at about 6 PM church
 * time, every servant with a part due tomorrow gets one reminder naming all of
 * it. A second run the same evening sends nothing new. Stand-ins: the snapshot
 * of tomorrow, delivery, and the database for the pruning.
 */
const world = vi.hoisted(() => ({
  asked: [] as string[],
  duties: [] as unknown[],
  delivered: [] as Array<Record<string, unknown>>,
  deleted: { notices: null as null | Record<string, unknown>, reads: null as null | Record<string, unknown> },
  coordinators: [] as Array<{ classId: string; servantId: string }>,
  names: [] as Array<{ id: string; account: { displayName: string } }>,
}))
vi.mock('@/lib/portal/data/duties', () => ({
  dutiesDueOn: async (date: string) => {
    world.asked.push(date)
    return world.duties
  },
}))
vi.mock('@/lib/portal/notice-delivery', () => ({
  deliverNotices: async (notices: Array<Record<string, unknown>>) => {
    world.delivered.push(...notices)
    return { stored: notices.length, pushed: 1, emailed: 0, skipped: 0 }
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notice: {
      deleteMany: async (args: Record<string, unknown>) => {
        world.deleted.notices = args
        return { count: 3 }
      },
    },
    classServant: { findMany: async () => world.coordinators },
    servant: { findMany: async () => world.names },
    notificationRead: {
      deleteMany: async (args: Record<string, unknown>) => {
        world.deleted.reads = args
        return { count: 2 }
      },
    },
  },
}))

import { sendTomorrowReminders } from '@/lib/portal/data/reminders'

const SATURDAY_6_30_PM_CDT = new Date('2026-10-24T23:30:00Z')
const duty = (servantId: string, label: string, topic: string | null = null, extra: Partial<Duty> = {}): Duty => ({
  slot: `item:5th-6th-boys:2026-10-19:${label}`,
  kind: 'activity',
  servantId,
  label,
  topic,
  className: '5th & 6th Boys',
  classId: 'boys',
  due: '2026-10-25',
  href: '/portal/assignments#week-2026-10-19',
  done: false,
  ...extra,
})

beforeEach(() => {
  world.asked = []
  world.duties = []
  world.delivered = []
  world.deleted = { notices: null, reads: null }
  world.coordinators = []
  world.names = []
})

describe('sendTomorrowReminders', () => {
  it('at 6 PM Saturday church time it reminds about Sunday', async () => {
    const r = await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    expect(world.asked).toEqual(['2026-10-25'])
    expect(r.date).toBe('2026-10-25')
  })

  it('one reminder per servant, with all of tomorrow', async () => {
    world.duties = [duty('A', 'Coptic', 'Lesson 4 letters'), duty('B', 'Verse'), duty('A', 'Memorization')]
    const r = await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered).toEqual([
      {
        servantId: 'A',
        kind: 'reminder',
        title: 'Reminder for tomorrow',
        body: 'Coptic (Lesson 4 letters) and Memorization · 5th & 6th Boys',
        href: '/portal/assignments#week-2026-10-19',
        dedupeKey: 'reminder:A:2026-10-25',
      },
      expect.objectContaining({ servantId: 'B', body: 'Verse · 5th & 6th Boys', dedupeKey: 'reminder:B:2026-10-25' }),
    ])
    expect(r).toMatchObject({ servants: 2, stored: 2 })
  })

  it('the dedupe key is per servant per day, so a second run sends nothing new', async () => {
    world.duties = [duty('A', 'Coptic')]
    await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    await sendTomorrowReminders(new Date('2026-10-24T23:59:00Z'))
    expect(world.delivered.map((n) => n.dedupeKey)).toEqual(['reminder:A:2026-10-25', 'reminder:A:2026-10-25'])
  })

  it('nothing due tomorrow sends nothing', async () => {
    const r = await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered).toEqual([])
    expect(r).toMatchObject({ servants: 0, stored: 0 })
  })

  it('old notices are pruned, and their dismissals with them', async () => {
    const r = await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    const cutoff = new Date(SATURDAY_6_30_PM_CDT.getTime() - 60 * 86_400_000)
    expect(world.deleted.notices).toEqual({ where: { createdAt: { lt: cutoff } } })
    expect(world.deleted.reads).toEqual({ where: { key: { startsWith: 'notice:' }, readAt: { lt: cutoff } } })
    expect(r.pruned).toBe(3)
  })
})

describe('marked done (2026-10-19)', () => {
  it('a part already marked done is left out of the reminder', async () => {
    world.duties = [duty('A', 'Coptic', null, { done: true }), duty('A', 'Memorization')]
    await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered.filter((n) => n.kind === 'reminder' && String(n.dedupeKey).startsWith('reminder:'))).toEqual([
      expect.objectContaining({ servantId: 'A', body: 'Memorization · 5th & 6th Boys' }),
    ])
  })

  it('a servant with every part done is not reminded', async () => {
    world.duties = [duty('A', 'Coptic', null, { done: true })]
    await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('reminder:'))).toEqual([])
  })

  it('the class’s coordinators get one list of the parts not marked done', async () => {
    world.duties = [
      duty('A', 'Coptic'),
      duty('B', 'Verse'),
      duty('A', 'Memorization', null, { done: true }),
      duty('L', 'Lead', null, { kind: 'lead', slot: 'lead:boys:2026-10-19' }),
    ]
    world.coordinators = [{ classId: 'boys', servantId: 'C' }, { classId: 'boys', servantId: 'D' }]
    world.names = [{ id: 'A', account: { displayName: 'Mina S' } }, { id: 'B', account: { displayName: 'George S' } }]
    const r = await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    const lists = world.delivered.filter((n) => String(n.dedupeKey).startsWith('notdone:'))
    expect(lists).toEqual([
      {
        servantId: 'C',
        kind: 'reminder',
        title: 'Not marked done yet',
        body: 'For tomorrow: Coptic (Mina S) and Verse (George S) · 5th & 6th Boys',
        href: '/portal/agenda?class=boys&week=2026-10-19',
        dedupeKey: 'notdone:C:2026-10-25',
      },
      expect.objectContaining({ servantId: 'D', dedupeKey: 'notdone:D:2026-10-25' }),
    ])
    expect(r).toMatchObject({ coordinators: 2 })
  })

  it('nothing outstanding sends the coordinators nothing', async () => {
    world.duties = [duty('A', 'Coptic', null, { done: true })]
    world.coordinators = [{ classId: 'boys', servantId: 'C' }]
    await sendTomorrowReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('notdone:'))).toEqual([])
  })
})
