import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The Schedule's rotation, server side (2026-11-01): a coordinator makes a
 * rotation for a month or a semester, looks it over, and saves it. Stand-ins:
 * the signed-in coordinator, the class check, the stored weeks, the duty
 * snapshots and a database that keeps what is written.
 */

const world = vi.hoisted(() => ({
  checked: [] as string[],
  denied: false,
  held: [] as Array<{ weekStart: string; role: string; servantId: string }>,
  servants: new Map<string, string>([
    ['sv-a', 'Mina S'],
    ['sv-b', 'Sara M'],
    ['sv-x', 'Kiro F'],
    ['sv-old', 'Old Hand'],
  ]),
  weeks: new Map<string, { id: string; weekStart: string; leadServantId: string | null; backupServantId: string | null }>(),
  items: [] as Array<{ weekId: string; activityKey: string; topic: string | null; servantId: string | null; doneAt: Date | null; doneById: string | null }>,
  dutyCalls: [] as string[][],
  notified: 0,
  audits: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async (_u: unknown, _a: string, _t: string, _id: string, text: string) => { world.audits.push(text) } }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-coord', role: 'SERVANT', displayName: 'Coord', servantId: 'sv-coord',
    classIds: ['girls'], coordinatorOf: ['girls'], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', async () => {
  const { PortalError } = await import('@/lib/portal/action-result')
  return {
    assertClassAction: async (_u: unknown, id: string, action: string) => {
      world.checked.push(action)
      if (world.denied) throw new PortalError('You do not have permission to do that in this class.')
      return { id, name: '5th & 6th Girls', stage: 'MIDDLE_SCHOOL' }
    },
  }
})
vi.mock('@/lib/portal/data/schedule-calendar', () => ({
  ROTATION_LOOKBACK_WEEKS: 26,
  heldCells: async (_c: string, from: string, to: string) => world.held.filter((h) => h.weekStart >= from && h.weekStart <= to),
}))
vi.mock('@/lib/portal/data/duties', () => ({
  weekDuties: async (_c: string, mondays: string[]) => {
    world.dutyCalls.push([...mondays])
    return []
  },
}))
vi.mock('@/lib/portal/notify-duties', () => ({ notifyDutyChanges: async () => { world.notified++ } }))
vi.mock('@/lib/prisma', () => {
  const day = (d: Date) => d.toISOString().slice(0, 10)
  const tx = {
    agendaWeek: {
      findMany: async (args: { where: { weekStart: { in: Date[] } } }) => {
        const wanted = new Set(args.where.weekStart.in.map(day))
        return Array.from(world.weeks.values())
          .filter((w) => wanted.has(w.weekStart))
          .map((w) => ({ ...w, weekStart: new Date(`${w.weekStart}T00:00:00Z`), items: world.items.filter((i) => i.weekId === w.id).map(({ activityKey, servantId }) => ({ activityKey, servantId })) }))
      },
      upsert: async (args: { where: { classId_weekStart: { weekStart: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const ws = day(args.where.classId_weekStart.weekStart)
        const found = world.weeks.get(ws)
        if (found) Object.assign(found, args.update)
        else world.weeks.set(ws, { id: `w-${ws}`, weekStart: ws, leadServantId: null, backupServantId: null, ...(args.create as object) } as never)
        return { id: world.weeks.get(ws)!.id }
      },
    },
    agendaItem: {
      upsert: async (args: { where: { weekId_activityKey: { weekId: string; activityKey: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const { weekId, activityKey } = args.where.weekId_activityKey
        const found = world.items.find((i) => i.weekId === weekId && i.activityKey === activityKey)
        if (found) Object.assign(found, args.update)
        else world.items.push({ topic: null, servantId: null, doneAt: null, doneById: null, ...(args.create as object) } as never)
        return {}
      },
    },
  }
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      servant: {
        findMany: async (args: { where: { id: { in: string[] } } }) =>
          args.where.id.in.filter((id) => world.servants.has(id)).map((id) => ({ id, account: { displayName: world.servants.get(id)! } })),
      },
    },
  }
})

import { planScheduleRotation, saveScheduleRotation } from '@/lib/portal/actions/rotation'

beforeEach(() => {
  // Monday, Nov 2, 2026, mid-morning in church time: the coming Sunday is Nov 8.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-02T15:00:00Z'))
  world.checked = []
  world.denied = false
  world.held = []
  world.weeks.clear()
  world.items = []
  world.dutyCalls = []
  world.notified = 0
  world.audits = []
})
afterEach(() => vi.useRealTimers())

const base = { classId: 'girls', from: '2026-11-01', to: '2026-11-29', keepExisting: true }

describe('planScheduleRotation', () => {
  it('proposes the chosen parts for each Sunday from the coming one, from the chosen servants', async () => {
    world.held = [{ weekStart: '2026-11-09', role: 'lesson', servantId: 'sv-x' }]
    const r = await planScheduleRotation({ ...base, roles: ['lesson', 'song'], servantIds: ['sv-a', 'sv-b'] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(world.checked).toEqual(['group.manage'])
    expect(r.data!.weeks).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'])
    expect(r.data!.clipped).toBe(true)
    expect(r.data!.cells).toHaveLength(7)
    expect(r.data!.cells.find((c) => c.weekStart === '2026-11-09' && c.role === 'lesson')).toBeUndefined()
    expect(r.data!.cells.every((c) => c.servantId === 'sv-a' || c.servantId === 'sv-b')).toBe(true)
    expect(r.data!.kept).toEqual([{ weekStart: '2026-11-09', role: 'lesson', servantId: 'sv-x' }])
    expect(r.data!.names['sv-x']).toBe('Kiro F')
  })

  it('replaces what is there when asked to', async () => {
    world.held = [{ weekStart: '2026-11-09', role: 'lesson', servantId: 'sv-x' }]
    const r = await planScheduleRotation({ ...base, keepExisting: false, roles: ['lesson'], servantIds: ['sv-a', 'sv-b'] })
    expect(r.ok && r.data!.cells).toHaveLength(4)
    expect(r.ok && r.data!.kept).toEqual([])
  })

  it('is for coordinators only', async () => {
    world.denied = true
    const r = await planScheduleRotation({ ...base, roles: ['lesson'], servantIds: ['sv-a'] })
    expect(r.ok).toBe(false)
  })

  it('refuses a servant who no longer serves, and a part that does not exist', async () => {
    expect((await planScheduleRotation({ ...base, roles: ['lesson'], servantIds: ['sv-a', 'sv-gone'] })).ok).toBe(false)
    expect((await planScheduleRotation({ ...base, roles: ['lesson', 'dancing'], servantIds: ['sv-a'] })).ok).toBe(false)
  })

  it('says why when the range has no Sundays left', async () => {
    const r = await planScheduleRotation({ ...base, from: '2026-10-01', to: '2026-10-31', roles: ['lesson'], servantIds: ['sv-a'] })
    expect(!r.ok && r.error).toBe('There are no Sundays left to fill between those days.')
  })
})

describe('saveScheduleRotation', () => {
  function seedWeek(weekStart: string, items: Array<{ activityKey: string; topic: string | null; servantId: string | null; doneAt?: Date }>) {
    world.weeks.set(weekStart, { id: `w-${weekStart}`, weekStart, leadServantId: null, backupServantId: null })
    for (const i of items) world.items.push({ weekId: `w-${weekStart}`, activityKey: i.activityKey, topic: i.topic, servantId: i.servantId, doneAt: i.doneAt ?? null, doneById: i.doneAt ? 'acc-x' : null })
  }
  const item = (weekStart: string, key: string) => world.items.find((i) => i.weekId === `w-${weekStart}` && i.activityKey === key)

  it('puts the servants on their parts, keeps the topics, and clears a done mark that changes hands', async () => {
    seedWeek('2026-11-02', [{ activityKey: 'lesson', topic: 'Joseph forgives', servantId: 'sv-old', doneAt: new Date('2026-11-01T12:00:00Z') }])
    const r = await saveScheduleRotation({
      ...base,
      keepExisting: false,
      cells: [
        { weekStart: '2026-11-02', role: 'lesson', servantId: 'sv-a' },
        { weekStart: '2026-11-02', role: 'lead', servantId: 'sv-b' },
        { weekStart: '2026-11-09', role: 'song', servantId: 'sv-b' },
      ],
    })
    expect(r.ok && r.data).toEqual({ saved: 3, kept: 0, weeks: 2 })
    expect(item('2026-11-02', 'lesson')).toMatchObject({ servantId: 'sv-a', topic: 'Joseph forgives', doneAt: null })
    expect(world.weeks.get('2026-11-02')!.leadServantId).toBe('sv-b')
    expect(item('2026-11-09', 'song')).toMatchObject({ servantId: 'sv-b' })
    // Everyone affected is told once, for the whole rotation.
    expect(world.dutyCalls).toEqual([
      ['2026-11-02', '2026-11-09'],
      ['2026-11-02', '2026-11-09'],
    ])
    expect(world.notified).toBe(1)
    expect(world.audits[0]).toContain('5th & 6th Girls: rotation for Sun, Nov 8 – Sun, Nov 15')
  })

  it('leaves a part someone filled since the rotation was made, when keeping what is there', async () => {
    seedWeek('2026-11-02', [{ activityKey: 'lesson', topic: null, servantId: 'sv-old' }])
    const r = await saveScheduleRotation({
      ...base,
      cells: [
        { weekStart: '2026-11-02', role: 'lesson', servantId: 'sv-a' },
        { weekStart: '2026-11-02', role: 'song', servantId: 'sv-b' },
      ],
    })
    expect(r.ok && r.data).toEqual({ saved: 1, kept: 1, weeks: 1 })
    expect(item('2026-11-02', 'lesson')!.servantId).toBe('sv-old')
    expect(item('2026-11-02', 'song')!.servantId).toBe('sv-b')
  })

  it('refuses a Sunday outside the rotation, or one already past', async () => {
    const past = await saveScheduleRotation({ ...base, cells: [{ weekStart: '2026-10-26', role: 'lesson', servantId: 'sv-a' }] })
    expect(past.ok).toBe(false)
    const later = await saveScheduleRotation({ ...base, cells: [{ weekStart: '2026-12-07', role: 'lesson', servantId: 'sv-a' }] })
    expect(later.ok).toBe(false)
    expect(world.items).toEqual([])
  })

  it('refuses a servant who no longer serves, and the same part twice', async () => {
    expect((await saveScheduleRotation({ ...base, cells: [{ weekStart: '2026-11-02', role: 'lesson', servantId: 'sv-gone' }] })).ok).toBe(false)
    const twice = await saveScheduleRotation({
      ...base,
      cells: [
        { weekStart: '2026-11-02', role: 'lesson', servantId: 'sv-a' },
        { weekStart: '2026-11-02', role: 'lesson', servantId: 'sv-b' },
      ],
    })
    expect(twice.ok).toBe(false)
    expect(world.items).toEqual([])
  })

  it('is for coordinators only', async () => {
    world.denied = true
    expect((await saveScheduleRotation({ ...base, cells: [{ weekStart: '2026-11-02', role: 'lesson', servantId: 'sv-a' }] })).ok).toBe(false)
    expect(world.checked).toEqual(['group.manage'])
  })
})
