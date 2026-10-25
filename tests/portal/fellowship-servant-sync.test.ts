import { describe, it, expect, vi, beforeEach } from 'vitest'

// 2026-10-24 — saving a servant who is also a Fellowship member: their member
// side follows the servant profile, a member account is never turned into a
// servant here, and nobody becomes the servant of a meeting they are a member of.

const world = vi.hoisted(() => ({
  account: null as null | Record<string, unknown>,
  writes: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({ accountId: 'acc-admin', role: 'ADMIN', displayName: 'Admin', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null }),
}))
vi.mock('@/lib/prisma', () => {
  const tx = {
    account: {
      findUnique: async () => world.account,
      update: async () => {
        world.writes.push('account.update')
        return {}
      },
    },
    servant: {
      update: async () => {
        world.writes.push('servant.update')
        return { id: 'sv-1' }
      },
      create: async () => {
        world.writes.push('servant.create')
        return { id: 'sv-1' }
      },
    },
    classServant: {
      deleteMany: async () => {
        world.writes.push('classServant.deleteMany')
        return {}
      },
      createMany: async () => {
        world.writes.push('classServant.createMany')
        return {}
      },
    },
    student: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        world.writes.push(`student.update:${String(data.firstName)} ${String(data.lastName)}`)
        return {}
      },
    },
  }
  return { prisma: { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } }
})

import { updateServant } from '@/lib/portal/actions/admin'

const form = (classes: Array<{ classId: string; title?: string }>, displayName = 'Paul Exampleson') => ({
  displayName, email: '', phone: '', role: 'SERVANT' as const, isActive: true, birthday: '', address: '', stageOversight: '' as const,
  classes: classes.map((c) => ({ classId: c.classId, title: (c.title ?? '') as '' })),
})

beforeEach(() => {
  world.writes = []
})

describe('saving a servant who is a Fellowship member', () => {
  it('updates their member side with the new name', async () => {
    world.account = {
      id: 'acc-sv', role: 'SERVANT', displayName: 'Paul Exampleson Jr', servant: { id: 'sv-1', birthday: null },
      student: { id: 'st-s', classId: 'mens-meeting', class: { stage: 'FELLOWSHIP', name: "Men's Meeting" }, memberships: [] },
    }
    const r = await updateServant('acc-sv', form([{ classId: '5th-6th-boys' }], 'Paul Exampleson Jr'))
    expect(r.ok).toBe(true)
    expect(world.writes).toContain('student.update:Paul Exampleson Jr')
  })

  it('will not make them a servant of the meeting they are a member of', async () => {
    world.account = {
      id: 'acc-sv', role: 'SERVANT', displayName: 'Paul Exampleson', servant: { id: 'sv-1', birthday: null },
      student: { id: 'st-s', classId: 'mens-meeting', class: { stage: 'FELLOWSHIP', name: "Men's Meeting" }, memberships: [] },
    }
    const r = await updateServant('acc-sv', form([{ classId: 'mens-meeting' }]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/member of Men's Meeting/)
    expect(world.writes).toEqual([])
  })
})

describe('a member who does not serve', () => {
  it('is not turned into a servant from the servant screens', async () => {
    world.account = { id: 'acc-m', role: 'MEMBER', displayName: 'Mina Testwell', servant: null, student: { id: 'st-m', classId: 'mens-meeting', class: { stage: 'FELLOWSHIP', name: "Men's Meeting" }, memberships: [] } }
    const r = await updateServant('acc-m', form([{ classId: 'kg' }], 'Mina Testwell'))
    expect(r.ok).toBe(false)
    expect(world.writes).toEqual([])
  })
})

describe('the servant spreadsheet import', () => {
  it('keeps the same two rules when it updates a servant', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('lib/portal/actions/data-tools.ts', 'utf8')
    const fn = src.slice(src.indexOf('export async function importServantsCsv'))
    const update = fn.slice(fn.indexOf("if (classification.kind === 'update')"), fn.indexOf('const loginId = p.loginId'))
    expect(update).toMatch(/assertNotMemberOf\(tx, existing\.id/)
    expect(update).toMatch(/syncMemberFromServant\(tx, existing\.id\)/)
  })
})
