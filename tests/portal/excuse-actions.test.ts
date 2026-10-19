import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Setting, changing and removing a follow-up excuse (2026-10-19). Any servant
 * who follows the child up in one of their classes may do all three, and every
 * change says who made it. Stand-ins: the signed-in servant, the class check
 * (the servant serves "kg" only) and a database that records the writes.
 */
const world = vi.hoisted(() => ({
  child: { id: 'mina', firstName: 'Mina', lastName: 'Saad', classId: 'kg' as string | null, memberships: [] as Array<{ classId: string }> },
  excuse: { id: 'ex1', studentId: 'mina', startsOn: new Date('2026-10-20T00:00:00Z'), endsOn: new Date('2026-11-10T00:00:00Z'), reason: 'Travelling to Egypt' },
  created: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
  deleted: [] as string[],
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
    accountId: 'acc-george', role: 'SERVANT', displayName: 'George', servantId: 'sv-george',
    classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', async () => {
  const { PortalError } = await import('@/lib/portal/action-result')
  return {
    assertClassAction: async (_u: unknown, classId: string) => {
      if (classId !== 'kg') throw new PortalError('You do not have permission to do that in this class.')
      return { id: 'kg', name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }
    },
  }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: async () => world.child },
    followUpExcuse: {
      findUnique: async () => world.excuse,
      create: async (args: { data: Record<string, unknown> }) => {
        world.created.push(args.data)
        return { id: 'new-ex' }
      },
      update: async (args: { data: Record<string, unknown> }) => {
        world.updated.push(args.data)
        return { id: world.excuse.id }
      },
      delete: async (args: { where: { id: string } }) => {
        world.deleted.push(args.where.id)
        return {}
      },
    },
  },
}))

import { addExcuse, removeExcuse, updateExcuse } from '@/lib/portal/actions/excuses'

beforeEach(() => {
  world.child = { id: 'mina', firstName: 'Mina', lastName: 'Saad', classId: 'kg', memberships: [] }
  world.created = []
  world.updated = []
  world.deleted = []
  world.audits = []
})

describe('addExcuse', () => {
  it('saves the dates and the reason, says who set it, and logs it', async () => {
    const r = await addExcuse({ studentId: 'mina', startsOn: '2026-10-20', endsOn: '2026-11-10', reason: '  Travelling to Egypt  ' })
    expect(r).toEqual({ ok: true, data: { id: 'new-ex' } })
    expect(world.created).toEqual([
      {
        studentId: 'mina',
        startsOn: new Date('2026-10-20T00:00:00.000Z'),
        endsOn: new Date('2026-11-10T00:00:00.000Z'),
        reason: 'Travelling to Egypt',
        createdById: 'acc-george',
      },
    ])
    expect(world.audits[0]!.action).toBe('followup.excuse.add')
    expect(world.audits[0]!.detail).toMatch(/Mina Saad.*2026-10-20.*2026-11-10.*Travelling to Egypt/)
  })

  it('works for any child in the class, whoever’s group they are in', async () => {
    // Nothing about groups is asked: the class is what counts.
    expect((await addExcuse({ studentId: 'mina', startsOn: '2026-10-20', endsOn: '2026-10-20', reason: 'Sick' })).ok).toBe(true)
  })

  it('works for a child who is in the servant’s class only as a member', async () => {
    world.child = { ...world.child, classId: 'high-school-girls', memberships: [{ classId: 'kg' }] }
    expect((await addExcuse({ studentId: 'mina', startsOn: '2026-10-20', endsOn: '2026-10-21', reason: 'Retreat' })).ok).toBe(true)
  })

  it('refuses a child in a class the servant does not serve', async () => {
    world.child = { ...world.child, classId: 'high-school-girls' }
    const r = await addExcuse({ studentId: 'mina', startsOn: '2026-10-20', endsOn: '2026-11-10', reason: 'Trip' })
    expect(r.ok).toBe(false)
    expect(world.created).toEqual([])
  })

  it('refuses a child with no class', async () => {
    world.child = { ...world.child, classId: null }
    expect((await addExcuse({ studentId: 'mina', startsOn: '2026-10-20', endsOn: '2026-11-10', reason: 'Trip' })).ok).toBe(false)
    expect(world.created).toEqual([])
  })

  it('says what is wrong with the dates, in words', async () => {
    const r = await addExcuse({ studentId: 'mina', startsOn: '2026-11-10', endsOn: '2026-10-20', reason: 'Trip' })
    expect(r).toEqual({ ok: false, error: 'The excuse ends before it starts.' })
    expect(world.created).toEqual([])
  })

  it('needs a reason', async () => {
    const r = await addExcuse({ studentId: 'mina', startsOn: '2026-10-20', endsOn: '2026-11-10', reason: '   ' })
    expect(r).toEqual({ ok: false, error: 'Say why they are excused.' })
    expect(world.created).toEqual([])
  })
})

describe('updateExcuse', () => {
  it('changes it and says who changed it', async () => {
    const r = await updateExcuse({ excuseId: 'ex1', startsOn: '2026-10-20', endsOn: '2026-11-17', reason: 'Travelling to Egypt, back a week later' })
    expect(r.ok).toBe(true)
    expect(world.updated).toEqual([
      {
        startsOn: new Date('2026-10-20T00:00:00.000Z'),
        endsOn: new Date('2026-11-17T00:00:00.000Z'),
        reason: 'Travelling to Egypt, back a week later',
        updatedById: 'acc-george',
      },
    ])
    expect(world.audits[0]!.action).toBe('followup.excuse.edit')
    // What it said before is kept in the log.
    expect(world.audits[0]!.detail).toMatch(/2026-11-10.*2026-11-17/)
  })

  it('refuses someone who cannot follow the child up', async () => {
    world.child = { ...world.child, classId: 'high-school-girls' }
    expect((await updateExcuse({ excuseId: 'ex1', startsOn: '2026-10-20', endsOn: '2026-11-17', reason: 'x' })).ok).toBe(false)
    expect(world.updated).toEqual([])
  })
})

describe('removeExcuse', () => {
  it('removes it and keeps what it said in the activity log', async () => {
    const r = await removeExcuse('ex1')
    expect(r.ok).toBe(true)
    expect(world.deleted).toEqual(['ex1'])
    expect(world.audits[0]!.action).toBe('followup.excuse.remove')
    expect(world.audits[0]!.detail).toMatch(/2026-10-20.*2026-11-10.*Travelling to Egypt/)
  })

  it('refuses someone who cannot follow the child up', async () => {
    world.child = { ...world.child, classId: 'high-school-girls' }
    expect((await removeExcuse('ex1')).ok).toBe(false)
    expect(world.deleted).toEqual([])
  })
})
