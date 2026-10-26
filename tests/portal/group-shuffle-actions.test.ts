import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Shuffle now (2026-10-25): the class's Coordinator, Assistant Coordinator,
 * stage overseer or the admin shuffle the groups and start the two months
 * again. Stand-ins: the signed-in coordinator (of "boys"), the class check and
 * the shuffle itself.
 */
const world = vi.hoisted(() => ({
  stage: 'MIDDLE_SCHOOL',
  result: { moved: 12, nextOn: '2026-12-25', shuffled: true },
  shuffled: [] as Array<{ classId: string; opts: Record<string, unknown> }>,
  audits: [] as Array<{ action: string; detail: string }>,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({
  audit: async (_u: unknown, action: string, _e: string, _id: string | null, detail: string) => {
    world.audits.push({ action, detail })
  },
}))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-c', role: 'SERVANT', displayName: 'Coordinator', servantId: 'sv-c',
    classIds: ['boys'], coordinatorOf: ['boys'], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', async () => {
  const { PortalError } = await import('@/lib/portal/action-result')
  return {
    assertClassAction: async (_u: unknown, classId: string, action: string) => {
      if (classId !== 'boys' || action !== 'group.manage') throw new PortalError('You do not have permission to do that in this class.')
      return { id: 'boys', name: '5th & 6th Boys', stage: world.stage, visitationThreshold: 1, takesOtherClasses: false }
    },
  }
})
vi.mock('@/lib/portal/data/groups', () => ({
  loadClassGroups: async () => [],
  applyGroupMoves: async () => {},
  shuffleClassGroups: async (classId: string, opts: Record<string, unknown>) => {
    world.shuffled.push({ classId, opts })
    return world.result
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { shuffleGroupsNow } from '@/lib/portal/actions/groups'

beforeEach(() => {
  world.stage = 'MIDDLE_SCHOOL'
  world.result = { moved: 12, nextOn: '2026-12-25', shuffled: true }
  world.shuffled = []
  world.audits = []
})

describe('shuffleGroupsNow', () => {
  it('shuffles the class and starts the two months again', async () => {
    const r = await shuffleGroupsNow('boys')
    expect(r).toEqual({ ok: true, data: { moved: 12, nextOn: '2026-12-25' } })
    expect(world.shuffled.map((x) => x.classId)).toEqual(['boys'])
    expect(world.audits.map((a) => a.action)).toEqual(['groups.shuffle'])
  })

  it('needs the right to arrange the groups', async () => {
    const r = await shuffleGroupsNow('girls')
    expect(r.ok).toBe(false)
    expect(world.shuffled).toEqual([])
  })

  it('a Fellowship meeting keeps its groups', async () => {
    world.stage = 'FELLOWSHIP'
    const r = await shuffleGroupsNow('boys')
    expect(r).toEqual({ ok: false, error: 'A Fellowship meeting keeps its groups; they are not shuffled.' })
    expect(world.shuffled).toEqual([])
  })

  it('a class with fewer than two servants is not shuffled, and nothing is logged', async () => {
    world.result = { moved: 0, nextOn: '2026-12-25', shuffled: false }
    const r = await shuffleGroupsNow('boys')
    expect(r).toEqual({ ok: false, error: 'This class has fewer than two servants, so there is nobody to shuffle the children between.' })
    expect(world.audits).toEqual([])
  })
})
