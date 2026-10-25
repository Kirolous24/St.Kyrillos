import { describe, it, expect, vi, beforeEach } from 'vitest'

// 2026-10-24 — who may open a Fellowship member's page. The user's rule: only
// that meeting's servants, the Fellowship overseer, the admin and the pastor.
// A servant who is a member keeps their meeting to the meeting: the people
// they serve 5th & 6th with do not see it.

const world = vi.hoisted(() => ({ student: null as null | Record<string, unknown>, past: [] as unknown[] }))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: () => {
    throw new Error('REDIRECT')
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: async () => world.student },
    // The Fellowship meetings someone has attendance in (past meetings).
    attendanceRecord: { findMany: async () => world.past },
  },
}))

import { requireMemberRead } from '@/lib/portal/data/fellowship'
import type { PortalUser } from '@/lib/portal/permissions'

const base: PortalUser = { accountId: 'acc', role: 'SERVANT', displayName: 'x', servantId: 'sv', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null }
const servantOf = (...classIds: string[]): PortalUser => ({ ...base, classIds })

function member(over: Record<string, unknown> = {}) {
  return {
    id: 'st-1', firstName: 'Paul', lastName: 'Exampleson', classId: 'mens-meeting',
    class: { id: 'mens-meeting', name: "Men's Meeting", stage: 'FELLOWSHIP' },
    memberships: [],
    account: { role: 'SERVANT' },
    ...over,
  }
}

beforeEach(() => {
  world.student = member()
  world.past = []
})

describe("a member's page", () => {
  it("opens for the meeting's servants", async () => {
    const r = await requireMemberRead(servantOf('mens-meeting'), 'st-1')
    expect(r.readable.map((m) => m.id)).toEqual(['mens-meeting'])
  })

  it('stays shut to the servants they teach a class with', async () => {
    await expect(requireMemberRead(servantOf('5th-6th-boys'), 'st-1')).rejects.toThrow('NOT_FOUND')
  })

  it('opens for the Fellowship overseer, the admin and the pastor', async () => {
    expect((await requireMemberRead({ ...base, stageOversight: 'FELLOWSHIP' }, 'st-1')).readable).toHaveLength(1)
    expect((await requireMemberRead({ ...base, role: 'ADMIN', servantId: undefined }, 'st-1')).readable).toHaveLength(1)
    expect((await requireMemberRead({ ...base, role: 'PASTOR', servantId: undefined }, 'st-1')).readable).toHaveLength(1)
  })

  it('shows a servant of one of their meetings only that meeting', async () => {
    world.student = member({ memberships: [{ classId: 'youth-meeting', class: { id: 'youth-meeting', name: 'Youth Meeting', stage: 'FELLOWSHIP' } }] })
    const r = await requireMemberRead(servantOf('youth-meeting'), 'st-1')
    expect(r.meetings.map((m) => m.id)).toEqual(['mens-meeting', 'youth-meeting'])
    expect(r.readable.map((m) => m.id)).toEqual(['youth-meeting'])
  })

  it('is not a page for a child, or for someone in no meeting', async () => {
    world.student = member({ account: { role: 'STUDENT' }, classId: 'kg', class: { id: 'kg', name: 'KG', stage: 'ELEMENTARY' } })
    await expect(requireMemberRead({ ...base, role: 'ADMIN' }, 'st-1')).rejects.toThrow('NOT_FOUND')
    world.student = member({ classId: null, class: null })
    await expect(requireMemberRead({ ...base, role: 'ADMIN' }, 'st-1')).rejects.toThrow('NOT_FOUND')
  })

  it('never opens for a child signed in', async () => {
    await expect(requireMemberRead({ ...base, role: 'STUDENT', classIds: ['mens-meeting'] }, 'st-1')).rejects.toThrow('NOT_FOUND')
  })
})

describe('someone who left', () => {
  it("stays readable to the servants of a meeting they came to, and to nobody else", async () => {
    world.student = member({ classId: null, class: null, account: { role: 'MEMBER' } })
    world.past = [{ classId: 'mens-meeting', class: { id: 'mens-meeting', name: "Men's Meeting", stage: 'FELLOWSHIP' } }]
    const r = await requireMemberRead(servantOf('mens-meeting'), 'st-1')
    expect(r.meetings).toEqual([])
    expect(r.past.map((m) => m.id)).toEqual(['mens-meeting'])
    expect(r.readable.map((m) => m.id)).toEqual(['mens-meeting'])
    await expect(requireMemberRead(servantOf('youth-meeting'), 'st-1')).rejects.toThrow('NOT_FOUND')
  })
})
