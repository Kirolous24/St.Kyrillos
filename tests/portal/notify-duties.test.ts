import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Duty } from '@/lib/portal/assignment-notices'
import type { OutgoingNotice } from '@/lib/portal/notice-delivery'

/**
 * From one save's before-and-after to the notices it sends (2026-10-19): one
 * notice per servant per save, however many weeks the save touched.
 */
const world = vi.hoisted(() => ({
  delivered: [] as OutgoingNotice[][],
  fail: false,
  holdsFail: false,
  holds: [] as Array<{ slot: string; servantId: string; due: string }>,
}))
vi.mock('@/lib/portal/notice-delivery', () => ({
  deliverNotices: async (notices: OutgoingNotice[]) => {
    if (world.fail) throw new Error('push service down')
    world.delivered.push([...notices])
    return { stored: notices.length, pushed: 0, emailed: 0, skipped: 0 }
  },
}))
// Parts more than a week away wait in DutyNoticeHold until a week before (2026-11-01).
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dutyNoticeHold: {
      findMany: async (args: { where: { slot: { in: string[] } } }) => world.holds.filter((h) => args.where.slot.in.includes(h.slot)),
      deleteMany: async (args: { where: { servantId: string; slot: { in: string[] } } }) => {
        const before = world.holds.length
        world.holds = world.holds.filter((h) => !(h.servantId === args.where.servantId && args.where.slot.in.includes(h.slot)))
        return { count: before - world.holds.length }
      },
      createMany: async (args: { data: Array<{ slot: string; servantId: string; due: Date }> }) => {
        if (world.holdsFail) throw new Error('database went away')
        for (const h of args.data) {
          if (!world.holds.some((x) => x.slot === h.slot && x.servantId === h.servantId)) world.holds.push({ slot: h.slot, servantId: h.servantId, due: h.due.toISOString().slice(0, 10) })
        }
        return { count: args.data.length }
      },
    },
  },
}))

import { notifyDutyChanges } from '@/lib/portal/notify-duties'

const TODAY = '2026-10-19'
const MONDAYS = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']
const sunday = (monday: string) => {
  const d = new Date(`${monday}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}
const duty = (servantId: string, monday: string, activity = 'coptic', label = 'Coptic'): Duty => ({
  slot: `item:5th-6th-boys:${monday}:${activity}`,
  kind: 'activity',
  servantId,
  label,
  topic: null,
  className: '5th & 6th Boys',
  due: sunday(monday),
  href: `/portal/assignments#week-${monday}`,
})

beforeEach(() => {
  world.delivered = []
  world.fail = false
  world.holdsFail = false
  world.holds = []
})

describe('notifyDutyChanges', () => {
  it('an import of 4 weeks for 3 servants tells each of them once, about this week, and holds the rest', async () => {
    const after = MONDAYS.flatMap((m) => [duty('A', m, 'coptic'), duty('B', m, 'verse', 'Verse'), duty('C', m, 'saint', 'Saint of the Week')])
    await notifyDutyChanges([], after, null, TODAY)
    expect(world.delivered).toHaveLength(1)
    expect(world.delivered[0]!.map((n) => n.servantId)).toEqual(['A', 'B', 'C'])
    expect(world.delivered[0]![0]).toMatchObject({
      kind: 'assigned',
      title: 'New assignment',
      body: 'You’re on Coptic for Sunday, Oct 25 · 5th & 6th Boys',
      href: '/portal/assignments#week-2026-10-19',
    })
    expect(world.delivered[0]![0]!.dedupeKey).toMatch(/^assigned:A:.+/)
    // Every save is news of its own: the keys never collide.
    expect(new Set(world.delivered[0]!.map((n) => n.dedupeKey)).size).toBe(3)
    // The three later Sundays wait until a week before each.
    expect(world.holds).toHaveLength(9)
    expect(world.holds.filter((h) => h.servantId === 'A').map((h) => h.due)).toEqual(['2026-11-01', '2026-11-08', '2026-11-15'])
  })

  it('a servant moved within one save gets one notice', async () => {
    await notifyDutyChanges([duty('A', '2026-10-19')], [duty('A', '2026-10-19', 'verse', 'Verse'), duty('B', '2026-10-19')], null, TODAY)
    const forA = world.delivered[0]!.filter((n) => n.servantId === 'A')
    expect(forA).toHaveLength(1)
    expect(forA[0]).toMatchObject({ kind: 'assigned', title: 'Assignments changed' })
  })

  it('a servant only taken off hears that', async () => {
    await notifyDutyChanges([duty('A', '2026-10-19')], [], null, TODAY)
    expect(world.delivered[0]).toEqual([
      expect.objectContaining({
        servantId: 'A',
        kind: 'unassigned',
        title: 'Assignment changed',
        body: 'You’re no longer on Coptic for Sunday, Oct 25 · 5th & 6th Boys',
      }),
    ])
  })

  it('nothing changed sends nothing', async () => {
    await notifyDutyChanges([duty('A', '2026-10-19')], [{ ...duty('A', '2026-10-19'), topic: 'new topic' }], null, TODAY)
    expect(world.delivered).toEqual([])
  })

  it('never rejects, even when delivery throws', async () => {
    world.fail = true
    await expect(notifyDutyChanges([], [duty('A', '2026-10-19')], null, TODAY)).resolves.toBeUndefined()
  })
})

describe('parts more than a week away are announced a week before (2026-11-01)', () => {
  it('a part more than a week away is held for later, not announced now', async () => {
    await notifyDutyChanges([], [duty('A', '2026-10-26')], null, TODAY)
    expect(world.delivered).toEqual([])
    expect(world.holds).toEqual([{ slot: 'item:5th-6th-boys:2026-10-26:coptic', servantId: 'A', due: '2026-11-01' }])
  })

  it('a part exactly a week away is announced now', async () => {
    await notifyDutyChanges([], [duty('A', '2026-10-19')], null, '2026-10-18')
    expect(world.delivered[0]).toEqual([expect.objectContaining({ servantId: 'A', body: 'You’re on Coptic for Sunday, Oct 25 · 5th & 6th Boys' })])
    expect(world.holds).toEqual([])
  })

  it('taking someone off a part still on hold says nothing, and drops the hold', async () => {
    world.holds = [{ slot: 'item:5th-6th-boys:2026-10-26:coptic', servantId: 'A', due: '2026-11-01' }]
    await notifyDutyChanges([duty('A', '2026-10-26')], [], null, TODAY)
    expect(world.delivered).toEqual([])
    expect(world.holds).toEqual([])
  })

  it('taking someone off a part they were told about tells them, however far off it is', async () => {
    await notifyDutyChanges([duty('A', '2026-11-02')], [], null, TODAY)
    expect(world.delivered[0]).toEqual([
      expect.objectContaining({ servantId: 'A', kind: 'unassigned', body: 'You’re no longer on Coptic for Sunday, Nov 8 · 5th & 6th Boys' }),
    ])
  })

  it('a far part changing hands: the servant who was told hears, the new one waits', async () => {
    await notifyDutyChanges([duty('A', '2026-11-02')], [duty('B', '2026-11-02')], null, TODAY)
    expect(world.delivered[0]!.map((n) => [n.servantId, n.kind])).toEqual([['A', 'unassigned']])
    expect(world.holds).toEqual([{ slot: 'item:5th-6th-boys:2026-11-02:coptic', servantId: 'B', due: '2026-11-08' }])
  })

  it('a lesson with no date is announced at once', async () => {
    const lesson: Duty = { slot: 'lesson:l1', kind: 'lesson', servantId: 'A', label: 'Lesson “Joseph”', topic: null, className: '5th & 6th Boys', due: null, href: '/portal/assignments' }
    await notifyDutyChanges([], [lesson], null, TODAY)
    expect(world.delivered[0]).toEqual([expect.objectContaining({ servantId: 'A', kind: 'assigned' })])
    expect(world.holds).toEqual([])
  })

  it('this week’s notice still goes out when the holds cannot be written', async () => {
    world.holdsFail = true
    await expect(notifyDutyChanges([], [duty('A', '2026-10-19'), duty('A', '2026-11-02')], null, TODAY)).resolves.toBeUndefined()
    expect(world.delivered[0]).toEqual([expect.objectContaining({ servantId: 'A', body: 'You’re on Coptic for Sunday, Oct 25 · 5th & 6th Boys' })])
  })
})
