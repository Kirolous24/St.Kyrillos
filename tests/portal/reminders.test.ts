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
  byDate: {} as Record<string, unknown[]>,
  delivered: [] as Array<Record<string, unknown>>,
  deleted: { notices: null as null | Record<string, unknown>, reads: null as null | Record<string, unknown> },
  coordinators: [] as Array<{ classId: string; servantId: string }>,
  names: [] as Array<{ id: string; account: { displayName: string } }>,
  // Parts given out more than a week ahead, and who holds them now (2026-11-01).
  holds: [] as Array<{ slot: string; servantId: string; due: Date }>,
  current: [] as Duty[],
  holdsDeleted: null as null | Record<string, unknown>,
  holdsFail: false,
}))
vi.mock('@/lib/portal/data/duties', () => ({
  dutiesDueOn: async (date: string) => {
    world.asked.push(date)
    return world.byDate[date] ?? world.duties
  },
  dutiesForSlots: async (slots: string[]) => world.current.filter((d) => slots.includes(d.slot)),
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
    dutyNoticeHold: {
      findMany: async (args: { where: { due: { lte: Date } } }) => world.holds.filter((h) => h.due <= args.where.due.lte),
      deleteMany: async (args: Record<string, unknown>) => {
        if (world.holdsFail) throw new Error('database went away')
        world.holdsDeleted = args
        return { count: 1 }
      },
    },
    servant: { findMany: async () => world.names },
    notificationRead: {
      deleteMany: async (args: Record<string, unknown>) => {
        world.deleted.reads = args
        return { count: 2 }
      },
    },
  },
}))

import { sendDailyReminders } from '@/lib/portal/data/reminders'

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
  world.byDate = {}
  world.delivered = []
  world.deleted = { notices: null, reads: null }
  world.coordinators = []
  world.names = []
  world.holds = []
  world.current = []
  world.holdsDeleted = null
  world.holdsFail = false
})

describe('sendDailyReminders', () => {
  it('at 6 PM Saturday church time it reminds about Sunday', async () => {
    const r = await sendDailyReminders(SATURDAY_6_30_PM_CDT)
    expect(world.asked).toEqual(['2026-10-25'])
    expect(r.date).toBe('2026-10-25')
  })

  it('one reminder per servant, with all of tomorrow', async () => {
    world.duties = [duty('A', 'Coptic', 'Lesson 4 letters'), duty('B', 'Verse'), duty('A', 'Memorization')]
    const r = await sendDailyReminders(SATURDAY_6_30_PM_CDT)
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
    await sendDailyReminders(SATURDAY_6_30_PM_CDT)
    await sendDailyReminders(new Date('2026-10-24T23:59:00Z'))
    expect(world.delivered.map((n) => n.dedupeKey)).toEqual(['reminder:A:2026-10-25', 'reminder:A:2026-10-25'])
  })

  it('nothing due tomorrow sends nothing', async () => {
    const r = await sendDailyReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered).toEqual([])
    expect(r).toMatchObject({ servants: 0, stored: 0 })
  })

  it('old notices are pruned, and their dismissals with them', async () => {
    const r = await sendDailyReminders(SATURDAY_6_30_PM_CDT)
    const cutoff = new Date(SATURDAY_6_30_PM_CDT.getTime() - 60 * 86_400_000)
    expect(world.deleted.notices).toEqual({ where: { createdAt: { lt: cutoff } } })
    expect(world.deleted.reads).toEqual({ where: { key: { startsWith: 'notice:' }, readAt: { lt: cutoff } } })
    expect(r.pruned).toBe(3)
  })
})

describe('marked done (2026-10-19)', () => {
  it('a part already marked done is left out of the reminder', async () => {
    world.duties = [duty('A', 'Coptic', null, { done: true }), duty('A', 'Memorization')]
    await sendDailyReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered.filter((n) => n.kind === 'reminder' && String(n.dedupeKey).startsWith('reminder:'))).toEqual([
      expect.objectContaining({ servantId: 'A', body: 'Memorization · 5th & 6th Boys' }),
    ])
  })

  it('a servant with every part done is not reminded', async () => {
    world.duties = [duty('A', 'Coptic', null, { done: true })]
    await sendDailyReminders(SATURDAY_6_30_PM_CDT)
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
    const r = await sendDailyReminders(SATURDAY_6_30_PM_CDT)
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
    await sendDailyReminders(SATURDAY_6_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('notdone:'))).toEqual([])
  })
})

describe('daily reminders (2026-10-25)', () => {
  const WEDNESDAY_6_30_PM_CDT = new Date('2026-10-21T23:30:00Z')
  const SUNDAY_6_30_PM_CDT = new Date('2026-10-25T23:30:00Z')

  it('on a weekday evening it reads tomorrow and the coming Sunday', async () => {
    await sendDailyReminders(WEDNESDAY_6_30_PM_CDT)
    expect(world.asked).toEqual(['2026-10-22', '2026-10-25'])
  })

  it("reminds each servant of the coming Sunday's parts not marked done, by bell and phone only", async () => {
    world.byDate['2026-10-25'] = [
      duty('A', 'Agpeya', 'St. Mary'),
      duty('A', 'Coptic'),
      duty('B', 'Verse', null, { done: true }),
      duty('L', 'Lead', null, { kind: 'lead', slot: 'lead:boys:2026-10-19' }),
    ]
    const r = await sendDailyReminders(WEDNESDAY_6_30_PM_CDT)
    expect(world.delivered).toEqual([
      {
        servantId: 'A',
        kind: 'reminder',
        title: 'Reminder for Sunday, Oct 25',
        body: 'Agpeya (St. Mary) and Coptic · 5th & 6th Boys. Tap Mark done on each once it’s ready.',
        href: '/portal/assignments#week-2026-10-19',
        dedupeKey: 'daily:A:2026-10-21',
        email: false,
      },
    ])
    expect(r).toMatchObject({ daily: 1 })
  })

  it('on a Sunday evening it looks ahead to the next Sunday', async () => {
    await sendDailyReminders(SUNDAY_6_30_PM_CDT)
    expect(world.asked).toEqual(['2026-10-26', '2026-11-01'])
  })

  it('on Saturday evening the evening-before reminder is the only one', async () => {
    world.duties = [duty('A', 'Coptic')]
    const r = await sendDailyReminders(SATURDAY_6_30_PM_CDT)
    expect(world.asked).toEqual(['2026-10-25'])
    expect(world.delivered.map((n) => n.dedupeKey)).toEqual(['reminder:A:2026-10-25'])
    expect(r).toMatchObject({ daily: 0 })
  })

  it('the coordinators’ list still waits for the evening before', async () => {
    world.byDate['2026-10-25'] = [duty('A', 'Coptic')]
    world.coordinators = [{ classId: 'boys', servantId: 'C' }]
    await sendDailyReminders(WEDNESDAY_6_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('notdone:'))).toEqual([])
  })
})

describe('a week before, parts given out further ahead (2026-11-01)', () => {
  const SUNDAY_7_30_PM_CDT = new Date('2026-10-26T00:30:00Z') // Sunday, Oct 25
  const coptic = duty('A', 'Coptic', 'Joseph', { slot: 'item:5th-6th-boys:2026-10-26:coptic', due: '2026-11-01', href: '/portal/assignments#week-2026-10-26' })

  it('tells the servant who holds the part, a week before it is due', async () => {
    world.holds = [{ slot: coptic.slot, servantId: 'A', due: new Date('2026-11-01T00:00:00Z') }]
    world.current = [coptic]
    const r = await sendDailyReminders(SUNDAY_7_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('ahead:'))).toEqual([
      {
        servantId: 'A',
        kind: 'assigned',
        title: 'New assignment',
        body: 'You’re on Coptic for Sunday, Nov 1 · 5th & 6th Boys',
        href: '/portal/assignments#week-2026-10-26',
        dedupeKey: 'ahead:A:2026-10-25',
      },
    ])
    // Told once: the holds a week or less away are cleared.
    expect(world.holdsDeleted).toEqual({ where: { due: { lte: new Date('2026-11-01T00:00:00Z') } } })
    expect(r).toMatchObject({ announced: 1 })
  })

  it('a part that has changed hands since is announced to nobody, and its hold goes', async () => {
    world.holds = [{ slot: coptic.slot, servantId: 'A', due: new Date('2026-11-01T00:00:00Z') }]
    world.current = [{ ...coptic, servantId: 'B' }]
    const r = await sendDailyReminders(SUNDAY_7_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('ahead:'))).toEqual([])
    expect(world.holdsDeleted).not.toBeNull()
    expect(r).toMatchObject({ announced: 0 })
  })

  it('parts further off keep waiting', async () => {
    world.holds = [{ slot: 'item:5th-6th-boys:2026-11-02:coptic', servantId: 'A', due: new Date('2026-11-08T00:00:00Z') }]
    world.current = [{ ...coptic, slot: 'item:5th-6th-boys:2026-11-02:coptic', due: '2026-11-08' }]
    await sendDailyReminders(SUNDAY_7_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('ahead:'))).toEqual([])
    expect(world.holdsDeleted).toBeNull()
  })

  it('that evening’s daily reminder leaves out the part it has just announced', async () => {
    const verse = duty('A', 'Verse', null, { slot: 'item:5th-6th-boys:2026-10-26:verse', due: '2026-11-01', href: '/portal/assignments#week-2026-10-26' })
    world.byDate['2026-11-01'] = [coptic, verse]
    world.holds = [{ slot: coptic.slot, servantId: 'A', due: new Date('2026-11-01T00:00:00Z') }]
    world.current = [coptic]
    await sendDailyReminders(SUNDAY_7_30_PM_CDT)
    const daily = world.delivered.filter((n) => String(n.dedupeKey).startsWith('daily:'))
    expect(daily).toEqual([expect.objectContaining({ servantId: 'A', body: 'Verse · 5th & 6th Boys. Tap Mark done once it’s ready.' })])
  })

  it('when the holds cannot be cleared, nothing is announced and the reminders still go', async () => {
    world.byDate['2026-11-01'] = [coptic]
    world.holds = [{ slot: coptic.slot, servantId: 'A', due: new Date('2026-11-01T00:00:00Z') }]
    world.current = [coptic]
    world.holdsFail = true
    const r = await sendDailyReminders(SUNDAY_7_30_PM_CDT)
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('ahead:'))).toEqual([])
    expect(world.delivered.filter((n) => String(n.dedupeKey).startsWith('daily:'))).toEqual([expect.objectContaining({ servantId: 'A' })])
    expect(r).toMatchObject({ announced: 0 })
  })
})
