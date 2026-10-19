import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Following up on a colleague's behalf (2026-10-19). Some servants are not at
 * home with the portal, so any servant of the class may log a call on any child
 * in it, and the note records whose group the child was in — the audit trail of
 * who followed up on whom. Stand-ins: George, signed in, serving "kg"; Mina,
 * in Mariam's group.
 */
const world = vi.hoisted(() => ({
  child: { id: 'mina', classId: 'kg', firstName: 'Mina', lastName: 'Saad', groupServantId: 'sv-mariam' as string | null },
  mariamServes: true,
  logs: [] as Array<Record<string, unknown>>,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-george', role: 'SERVANT', displayName: 'George', servantId: 'sv-george',
    classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async () => ({ id: 'kg', name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }),
}))
vi.mock('@/lib/prisma', () => {
  const db = {
    student: { findUnique: async () => world.child },
    classServant: {
      findFirst: async (args: { where: { servantId: string } }) =>
        world.mariamServes && args.where.servantId === 'sv-mariam' ? { servantId: 'sv-mariam' } : null,
    },
    followUpCase: {
      findFirst: async () => null,
      findUnique: async () => ({ id: 'case1', classId: 'kg', status: 'OPEN', studentId: 'mina', student: { firstName: 'Mina', lastName: 'Saad' } }),
      update: (args: unknown) => args,
    },
    followUpLog: {
      create: (args: { data: Record<string, unknown> }) => {
        world.logs.push(args.data)
        return args
      },
    },
    $transaction: async (ops: unknown[]) => ops,
  }
  return { prisma: db }
})

import { logCheckIn, logContact, resolveCase } from '@/lib/portal/actions/followups'

beforeEach(() => {
  world.child = { id: 'mina', classId: 'kg', firstName: 'Mina', lastName: 'Saad', groupServantId: 'sv-mariam' }
  world.mariamServes = true
  world.logs = []
})

describe('a check-in records whose group the child was in', () => {
  it('George logging a call on Mariam’s child says it was for Mariam’s group', async () => {
    expect((await logCheckIn({ studentId: 'mina', method: 'call', result: 'reached' })).ok).toBe(true)
    expect(world.logs[0]).toMatchObject({ studentId: 'mina', byId: 'acc-george', groupServantId: 'sv-mariam' })
  })

  it('records no group when the child has no servant', async () => {
    world.child = { ...world.child, groupServantId: null }
    await logCheckIn({ studentId: 'mina', method: 'call' })
    expect(world.logs[0]).toMatchObject({ groupServantId: null })
  })

  it('records no group when that servant no longer serves the class', async () => {
    world.mariamServes = false
    await logCheckIn({ studentId: 'mina', method: 'call' })
    expect(world.logs[0]).toMatchObject({ groupServantId: null })
  })

  it('a note on a case records it too', async () => {
    expect((await logContact({ caseId: 'case1', method: 'text', result: 'no_answer' })).ok).toBe(true)
    expect(world.logs[0]).toMatchObject({ caseId: 'case1', byId: 'acc-george', groupServantId: 'sv-mariam' })
  })

  it('so does resolving a case', async () => {
    expect((await resolveCase({ caseId: 'case1', reason: 'attending_again' })).ok).toBe(true)
    expect(world.logs[0]).toMatchObject({ method: 'resolved', groupServantId: 'sv-mariam' })
  })
})
