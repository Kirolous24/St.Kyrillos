import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * A servant's birthday calendar link (2026-10-19): made the first time they
 * ask for it, the same every time after, and replaceable if it gets passed
 * around. Children have none. Stand-ins: the signed-in person and the database.
 */
const world = vi.hoisted(() => ({
  user: {
    accountId: 'acc-mina', role: 'SERVANT', displayName: 'Mina', servantId: 'sv-mina' as string | undefined,
    classIds: ['kg'], coordinatorOf: [] as string[], assistantOf: [] as string[], stageOversight: null,
  },
  stored: null as string | null,
  writes: [] as Array<Record<string, unknown>>,
  audits: [] as string[],
}))

vi.mock('@/lib/portal/session', () => ({ requirePortalUser: async () => world.user }))
vi.mock('@/lib/portal/audit', () => ({ audit: async (_u: unknown, action: string) => void world.audits.push(action) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: async () => ({ calendarToken: world.stored }),
      updateMany: async (args: { where: { calendarToken?: null }; data: { calendarToken: string } }) => {
        world.writes.push(args)
        // Only fills an empty slot, as the database would.
        if (world.stored === null) world.stored = args.data.calendarToken
        return { count: 1 }
      },
      update: async (args: { data: { calendarToken: string } }) => {
        world.writes.push(args)
        world.stored = args.data.calendarToken
        return {}
      },
    },
  },
}))

import { getBirthdayCalendarLink, resetBirthdayCalendarLink } from '@/lib/portal/actions/birthday-calendar'

beforeEach(() => {
  world.user = { ...world.user, role: 'SERVANT' }
  world.stored = null
  world.writes = []
  world.audits = []
})

describe('getBirthdayCalendarLink', () => {
  it('makes a link the first time and hands back the same one after', async () => {
    const first = await getBirthdayCalendarLink()
    expect(first.ok).toBe(true)
    const token = first.ok ? first.data?.token : undefined
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(world.writes).toEqual([{ where: { id: 'acc-mina', calendarToken: null }, data: { calendarToken: token } }])

    world.writes = []
    expect(await getBirthdayCalendarLink()).toEqual({ ok: true, data: { token } })
    expect(world.writes).toEqual([])
  })

  it('refuses a child', async () => {
    world.user = { ...world.user, role: 'STUDENT' }
    expect(await getBirthdayCalendarLink()).toEqual({ ok: false, error: 'Only servants have a birthday calendar.' })
    expect(world.writes).toEqual([])
  })
})

describe('resetBirthdayCalendarLink', () => {
  it('replaces the link, so the old one stops working, and records it', async () => {
    world.stored = 'o'.repeat(32)
    const res = await resetBirthdayCalendarLink()
    const token = res.ok ? res.data?.token : undefined
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(token).not.toBe('o'.repeat(32))
    expect(world.stored).toBe(token)
    expect(world.writes).toEqual([{ where: { id: 'acc-mina' }, data: { calendarToken: token } }])
    expect(world.audits).toEqual(['account.resetCalendarLink'])
  })

  it('refuses a child', async () => {
    world.user = { ...world.user, role: 'STUDENT' }
    expect(await resetBirthdayCalendarLink()).toEqual({ ok: false, error: 'Only servants have a birthday calendar.' })
  })
})
