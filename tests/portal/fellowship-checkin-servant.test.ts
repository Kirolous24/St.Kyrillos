import { describe, it, expect, vi, beforeEach } from 'vitest'

// 2026-10-24 — the servant's side of a Fellowship meeting's QR check-in:
// opening the code, watching who checked themselves in, undoing one, and
// pressing Done so the portal works out who missed the meeting.

const world = vi.hoisted(() => ({
  created: [] as Array<Record<string, unknown>>,
  token: null as null | Record<string, unknown>,
  writes: [] as string[],
  synced: [] as Array<{ studentIds: string[]; asOf: string; key: string }>,
  record: null as null | { id: string; note: string | null; markedById: string | null },
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/headers', () => ({ headers: () => new Map([['host', 'localhost:3000']]) }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/components/portal/QrImage', () => ({ qrSvgDataUrl: async (url: string) => `qr:${url}` }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-sv', role: 'SERVANT', displayName: 'Servant', servantId: 'sv', classIds: ['mens-meeting'],
    coordinatorOf: [], assistantOf: [], stageOversight: null, fellowshipClassIds: ['mens-meeting'],
  }),
}))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async (_u: unknown, classId: string, action: string) => {
    if (classId === 'kg') return { id: 'kg', name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }
    if (action !== 'attendance.write' && action !== 'student.write') throw new Error('unexpected action')
    return { id: 'mens-meeting', name: "Men's Meeting", stage: 'FELLOWSHIP', visitationThreshold: 2, takesOtherClasses: true }
  },
}))
vi.mock('@/lib/portal/followup-sync', () => ({
  syncAutoFollowUps: async (args: { studentIds: string[]; asOf: string; session: { key: string } }) => {
    world.synced.push({ studentIds: args.studentIds, asOf: args.asOf, key: args.session.key })
    return { opened: 1, closed: 0 }
  },
}))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    attendanceSession: { findUnique: async () => ({ key: 'fellowship-mens-meeting', label: "Men's Meeting", isActive: true }) },
    qrToken: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        world.created.push(data)
        return data
      },
      findUnique: async () => world.token,
      update: async () => {
        world.writes.push('token.end')
        return {}
      },
    },
    qrRedemption: {
      findMany: async () => [{ id: 'red-1', accountId: 'acc-mina', name: 'Mina T.', at: new Date() }],
      deleteMany: async () => {
        world.writes.push('redemption.deleteMany')
        return { count: 1 }
      },
    },
    student: {
      findMany: async () => [{ id: 'st-mina', accountId: 'acc-mina', firstName: 'Mina', lastName: 'Testwell' }, { id: 'st-mary', accountId: 'acc-mary', firstName: 'Mary', lastName: 'Sampleton' }],
      findUnique: async () => ({ id: 'st-mina' }),
      count: async () => 2,
    },
    attendanceRecord: {
      count: async () => 1,
      findUnique: async () => world.record,
      delete: async () => {
        world.writes.push('attendance.delete')
        return {}
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  }
  return { prisma }
})

import { checkInList, finishCheckIn, openCheckInCode, undoMemberCheckIn } from '@/lib/portal/actions/fellowship'

const TOKEN = 'b'.repeat(32)

beforeEach(() => {
  world.created = []
  world.writes = []
  world.synced = []
  world.record = null
  world.token = {
    token: TOKEN, kind: 'MEMBER_CHECKIN', classIds: ['mens-meeting'], sessionKey: 'fellowship-mens-meeting', activityLabel: "Men's Meeting",
    date: new Date('2026-10-24T00:00:00Z'), expiresAt: new Date(Date.now() + 60_000), createdById: 'acc-sv',
  }
})

describe('opening the check-in', () => {
  it("makes a five-minute code for the meeting's own register, opened at /portal/checkin", async () => {
    const r = await openCheckInCode('mens-meeting')
    expect(r.ok).toBe(true)
    const data = world.created[0]!
    expect(data).toMatchObject({ kind: 'MEMBER_CHECKIN', classIds: ['mens-meeting'], sessionKey: 'fellowship-mens-meeting', createdById: 'acc-sv' })
    const ttl = (data.expiresAt as Date).getTime() - Date.now()
    expect(ttl).toBeGreaterThan(4 * 60_000)
    expect(ttl).toBeLessThanOrEqual(5 * 60_000)
    expect(r.ok && r.data!.url).toBe(`http://localhost:3000/portal/checkin/${String(data.token)}`)
  })

  it('is only for a Fellowship meeting', async () => {
    expect((await openCheckInCode('kg')).ok).toBe(false)
  })
})

describe('while it is open', () => {
  it('lists who checked themselves in, by their full names, and how many are here', async () => {
    const r = await checkInList(TOKEN)
    expect(r.ok && r.data!.checkedIn.map((c) => c.name)).toEqual(['Mina Testwell'])
    expect(r.ok && r.data!.here).toBe(1)
    expect(r.ok && r.data!.members).toBe(2)
  })

  it("a servant undoes one, keeping any mark a servant made since", async () => {
    world.record = { id: 'rec-1', note: 'Self check-in', markedById: null }
    expect((await undoMemberCheckIn(TOKEN, 'acc-mina')).ok).toBe(true)
    expect(world.writes).toEqual(['redemption.deleteMany', 'attendance.delete'])
    world.writes = []
    world.record = { id: 'rec-1', note: null, markedById: 'acc-other' }
    expect((await undoMemberCheckIn(TOKEN, 'acc-mina')).ok).toBe(true)
    expect(world.writes).toEqual(['redemption.deleteMany'])
  })
})

describe('Done', () => {
  it('closes the code and works out who missed, for the whole list', async () => {
    const r = await finishCheckIn(TOKEN)
    expect(r.ok && r.data).toMatchObject({ opened: 1, here: 1, members: 2 })
    expect(world.writes).toEqual(['token.end'])
    expect(world.synced).toEqual([{ studentIds: ['st-mina', 'st-mary'], asOf: '2026-10-24', key: 'fellowship-mens-meeting' }])
  })
})
