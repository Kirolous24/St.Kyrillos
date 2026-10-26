import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The planner and the week's presentation (2026-10-25): "The planner is
 * universal and permanent for all classes … But the presentation should be
 * there for all class uniquely." The planner is one link the admin keeps; each
 * class's week has its own presentation, which any servant of the class may
 * add or change. Stand-ins: the signed-in user, the class check (the servant
 * teaches "kg"), and a database that records the writes.
 */
const world = vi.hoisted(() => ({
  role: 'ADMIN' as string,
  settings: [] as Array<Record<string, unknown>>,
  cleared: [] as Array<Record<string, unknown>>,
  weeks: [] as Array<Record<string, unknown>>,
  audits: [] as Array<{ action: string; detail: string }>,
  stored: null as null | { value: unknown },
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({
  audit: async (_u: unknown, action: string, _e: string, _id: string | null, detail: string) => {
    world.audits.push({ action, detail })
  },
}))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-1', role: world.role, displayName: 'Someone', servantId: 'sv-1',
    classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', async () => {
  const { PortalError } = await import('@/lib/portal/action-result')
  return {
    assertClassAction: async (_u: unknown, classId: string, action: string) => {
      if (classId !== 'kg' || action !== 'attendance.write') throw new PortalError('You do not have permission to do that in this class.')
      return { id: 'kg', name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }
    },
  }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    portalSetting: {
      upsert: async (args: Record<string, unknown>) => {
        world.settings.push(args)
        return {}
      },
      deleteMany: async (args: Record<string, unknown>) => {
        world.cleared.push(args)
        return { count: 1 }
      },
      findUnique: async () => world.stored,
    },
    agendaWeek: {
      upsert: async (args: Record<string, unknown>) => {
        world.weeks.push(args)
        return {}
      },
    },
  },
}))

import { setPlannerLink, setWeekPresentation } from '@/lib/portal/actions/agenda'
import { plannerLink } from '@/lib/portal/data/planner'

beforeEach(() => {
  world.role = 'ADMIN'
  world.settings = []
  world.cleared = []
  world.weeks = []
  world.audits = []
  world.stored = null
})

describe('the planner link', () => {
  it('the admin keeps one link for every class', async () => {
    const r = await setPlannerLink('https://www.canva.com/design/planner/view')
    expect(r).toEqual({ ok: true, data: { url: 'https://www.canva.com/design/planner/view' } })
    expect(world.settings).toEqual([
      {
        where: { key: 'planner.link' },
        create: { key: 'planner.link', value: { url: 'https://www.canva.com/design/planner/view' } },
        update: { value: { url: 'https://www.canva.com/design/planner/view' } },
      },
    ])
    expect(world.audits.map((a) => a.action)).toEqual(['planner.link'])
  })

  it('nobody but the admin may change it', async () => {
    world.role = 'SERVANT'
    const r = await setPlannerLink('https://example.com/planner')
    expect(r).toEqual({ ok: false, error: 'Only the Sunday School admin can change the planner link.' })
    expect(world.settings).toEqual([])
  })

  it('takes only a web address', async () => {
    const r = await setPlannerLink('javascript:alert(1)')
    expect(r).toEqual({ ok: false, error: 'The planner link must be a web address, starting https://' })
    expect(world.settings).toEqual([])
  })

  it('an empty link takes it away', async () => {
    const r = await setPlannerLink('  ')
    expect(r).toEqual({ ok: true, data: { url: null } })
    expect(world.cleared).toEqual([{ where: { key: 'planner.link' } }])
  })

  it('reads back what was stored, and nothing unsafe', async () => {
    world.stored = { value: { url: 'https://example.com/planner' } }
    expect(await plannerLink()).toBe('https://example.com/planner')
    world.stored = { value: { url: 'javascript:alert(1)' } }
    expect(await plannerLink()).toBeNull()
    world.stored = null
    expect(await plannerLink()).toBeNull()
  })
})

describe("a class's presentation for the week", () => {
  it("any servant of the class sets it on that week's Monday", async () => {
    world.role = 'SERVANT'
    const r = await setWeekPresentation({ classId: 'kg', weekStart: '2026-10-25', url: 'https://www.canva.com/design/abc/edit' })
    expect(r).toEqual({ ok: true, data: { url: 'https://www.canva.com/design/abc/edit' } })
    const monday = new Date('2026-10-19T00:00:00.000Z')
    expect(world.weeks).toEqual([
      {
        where: { classId_weekStart: { classId: 'kg', weekStart: monday } },
        create: { classId: 'kg', weekStart: monday, slideLink: 'https://www.canva.com/design/abc/edit' },
        update: { slideLink: 'https://www.canva.com/design/abc/edit' },
      },
    ])
    expect(world.audits.map((a) => a.action)).toEqual(['agenda.presentation'])
  })

  it('a servant of another class may not', async () => {
    world.role = 'SERVANT'
    const r = await setWeekPresentation({ classId: '1st', weekStart: '2026-10-25', url: 'https://www.canva.com/design/abc/edit' })
    expect(r.ok).toBe(false)
    expect(world.weeks).toEqual([])
  })

  it('takes only a web address, and an empty one clears it', async () => {
    const bad = await setWeekPresentation({ classId: 'kg', weekStart: '2026-10-25', url: 'javascript:alert(1)' })
    expect(bad).toEqual({ ok: false, error: 'The presentation link must be a web address, starting https://' })
    const cleared = await setWeekPresentation({ classId: 'kg', weekStart: '2026-10-25', url: '' })
    expect(cleared).toEqual({ ok: true, data: { url: null } })
    expect(world.weeks).toHaveLength(1)
    expect(world.weeks[0]).toMatchObject({ update: { slideLink: null } })
  })

  it('refuses a week that is not a date', async () => {
    const r = await setWeekPresentation({ classId: 'kg', weekStart: 'soon', url: 'https://www.canva.com/design/abc/edit' })
    expect(r).toEqual({ ok: false, error: 'Pick a valid week.' })
  })
})
