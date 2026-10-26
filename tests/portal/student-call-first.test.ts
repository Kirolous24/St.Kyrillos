import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * "Call first" on the child's edit form (2026-10-25): servants choose whose
 * number they reach first, and the mother's is the default. Stand-ins: the
 * signed-in servant, the write check, and a database that records the update.
 */
const world = vi.hoisted(() => ({ updates: [] as Array<Record<string, unknown>> }))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-george', role: 'SERVANT', displayName: 'George', servantId: 'sv-george',
    classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/students', () => ({
  assertStudentWrite: async () => ({ id: 'mina', firstName: 'Mina', lastName: 'Saad', classId: 'kg' }),
  studentName: (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`.trim(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      update: async (args: { data: Record<string, unknown> }) => {
        world.updates.push(args.data)
        return {}
      },
    },
  },
}))

import { updateStudent } from '@/lib/portal/actions/students'

beforeEach(() => {
  world.updates = []
})

describe('call first', () => {
  it("saves the father's number as the one to call first", async () => {
    const r = await updateStudent('mina', { firstName: 'Mina', lastName: 'Saad', callFirst: 'FATHER' })
    expect(r.ok).toBe(true)
    expect(world.updates[0]).toMatchObject({ callFirst: 'FATHER' })
  })

  it('goes back to the default, the mother, when the choice is cleared', async () => {
    await updateStudent('mina', { firstName: 'Mina', lastName: 'Saad', callFirst: '' })
    expect(world.updates[0]).toHaveProperty('callFirst', null)
  })

  it('leaves the choice alone when the request does not carry it', async () => {
    await updateStudent('mina', { firstName: 'Mina', lastName: 'Saad' })
    expect(world.updates[0]).not.toHaveProperty('callFirst')
  })

  it('refuses anything that is not a parent or the child', async () => {
    const r = await updateStudent('mina', { firstName: 'Mina', lastName: 'Saad', callFirst: 'GRANDMA' as never })
    expect(r.ok).toBe(false)
    expect(world.updates).toHaveLength(0)
  })
})
