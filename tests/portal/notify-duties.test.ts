import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Duty } from '@/lib/portal/assignment-notices'
import type { OutgoingNotice } from '@/lib/portal/notice-delivery'

/**
 * From one save's before-and-after to the notices it sends (2026-10-19): one
 * notice per servant per save, however many weeks the save touched.
 */
const world = vi.hoisted(() => ({ delivered: [] as OutgoingNotice[][], fail: false }))
vi.mock('@/lib/portal/notice-delivery', () => ({
  deliverNotices: async (notices: OutgoingNotice[]) => {
    if (world.fail) throw new Error('push service down')
    world.delivered.push([...notices])
    return { stored: notices.length, pushed: 0, emailed: 0, skipped: 0 }
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
})

describe('notifyDutyChanges', () => {
  it('import of 4 weeks for 3 servants sends 3 notices', async () => {
    const after = MONDAYS.flatMap((m) => [duty('A', m, 'coptic'), duty('B', m, 'verse', 'Verse'), duty('C', m, 'saint', 'Saint of the Week')])
    await notifyDutyChanges([], after, null, TODAY)
    expect(world.delivered).toHaveLength(1)
    expect(world.delivered[0]!.map((n) => n.servantId)).toEqual(['A', 'B', 'C'])
    expect(world.delivered[0]![0]).toMatchObject({
      kind: 'assigned',
      title: 'New assignments',
      body: 'You have 4 new assignments, Oct 25 – Nov 15 · 5th & 6th Boys',
      href: '/portal/assignments#week-2026-10-19',
    })
    expect(world.delivered[0]![0]!.dedupeKey).toMatch(/^assigned:A:.+/)
    // Every save is news of its own: the keys never collide.
    expect(new Set(world.delivered[0]!.map((n) => n.dedupeKey)).size).toBe(3)
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
