import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// 2026-10-24 — a Fellowship member checks in by scanning the meeting's code
// with their phone camera and tapping their own name, with no sign-in. The
// user accepted the catch (someone could tap a friend who isn't there), so the
// brakes are: one name per phone per code, a five-minute code, only that
// meeting's people, and servants see and can undo every self check-in.

const world = vi.hoisted(() => ({
  token: null as null | Record<string, unknown>,
  onRoster: new Map<string, { id: string; accountId: string; firstName: string; lastName: string }>(),
  redemptions: [] as Array<{ tokenId: string; accountId: string; device: string | null; name: string }>,
  record: null as null | { id: string; status: string; note: string | null; markedById: string | null },
  cookie: undefined as string | undefined,
  setCookies: [] as Array<{ name: string; value: string; opts: Record<string, unknown> }>,
  writes: [] as string[],
  synced: [] as string[][],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => (name === 'sk_ci' && world.cookie ? { name, value: world.cookie } : undefined),
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      world.setCookies.push({ name, value, opts })
      world.cookie = value
    },
  }),
}))
vi.mock('@/lib/portal/followup-sync', () => ({
  syncAutoFollowUps: async ({ studentIds }: { studentIds: string[] }) => {
    world.synced.push(studentIds)
    return { opened: 0, closed: 0 }
  },
}))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    qrToken: { findUnique: async () => world.token },
    schoolClass: { findUnique: async () => ({ id: 'mens-meeting', name: "Men's Meeting", visitationThreshold: 2 }) },
    student: {
      findFirst: async ({ where }: { where: { AND: Array<{ id?: string }> } }) => {
        const id = where.AND.find((w) => w.id)?.id
        return (id && world.onRoster.get(id)) ?? null
      },
      findMany: async () => Array.from(world.onRoster.values()),
      findUnique: async ({ where }: { where: { accountId: string } }) =>
        Array.from(world.onRoster.values()).find((s) => s.accountId === where.accountId) ?? null,
    },
    qrRedemption: {
      findMany: async () => world.redemptions,
      findFirst: async ({ where }: { where: { tokenId: string; device: string } }) =>
        world.redemptions.find((r) => r.tokenId === where.tokenId && r.device === where.device) ?? null,
      create: async ({ data }: { data: (typeof world.redemptions)[number] }) => {
        world.writes.push(`redemption:${data.accountId}:${data.device}`)
        world.redemptions.push(data)
        return data
      },
      delete: async () => {
        world.writes.push('redemption.delete')
        return {}
      },
    },
    attendanceRecord: {
      findUnique: async () => world.record,
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        world.writes.push(`attendance:${String(create.status)}:${String(create.note)}:${String(create.markedById)}`)
        return { id: 'rec-1' }
      },
      delete: async () => {
        world.writes.push('attendance.delete')
        return {}
      },
    },
    portalAuditLog: { create: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  }
  return { prisma }
})

import { selfCheckIn, undoSelfCheckIn } from '@/lib/portal/actions/checkin'
import { authConfig } from '@/lib/auth.config'

const TOKEN = 'a'.repeat(32)
const sha = (v: string) => createHash('sha256').update(v).digest('hex')

beforeEach(() => {
  world.token = {
    token: TOKEN, kind: 'MEMBER_CHECKIN', classIds: ['mens-meeting'], sessionKey: 'fellowship-mens-meeting',
    activityLabel: "Men's Meeting", date: new Date('2026-10-24T00:00:00Z'), expiresAt: new Date(Date.now() + 120_000),
  }
  world.onRoster = new Map([
    ['st-mina', { id: 'st-mina', accountId: 'acc-mina', firstName: 'Mina', lastName: 'Testwell' }],
    ['st-mary', { id: 'st-mary', accountId: 'acc-mary', firstName: 'Mary', lastName: 'Sampleton' }],
  ])
  world.redemptions = []
  world.record = null
  world.cookie = undefined
  world.setCookies = []
  world.writes = []
  world.synced = []
})

describe('the check-in page is open without signing in', () => {
  const visit = (pathname: string) =>
    authConfig.callbacks!.authorized!({
      auth: null,
      request: { nextUrl: new URL(`https://stkyrillostn.org${pathname}`) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

  it('lets a phone with no session reach it', () => {
    expect(visit('/portal/checkin')).toBe(true)
    expect(visit(`/portal/checkin/${TOKEN}`)).toBe(true)
  })

  it('and nothing else in the portal', () => {
    expect(visit('/portal/classes')).not.toBe(true)
    expect(visit('/portal/checkinx')).not.toBe(true)
  })
})

describe('checking yourself in', () => {
  it('marks the member present, as their own check-in, and remembers this phone', async () => {
    const r = await selfCheckIn(TOKEN, 'st-mina')
    expect(r).toEqual({ ok: true, data: { name: 'Mina T.', meeting: "Men's Meeting", already: false } })
    expect(world.setCookies).toHaveLength(1)
    expect(world.setCookies[0]!.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/portal/checkin' })
    const device = sha(world.setCookies[0]!.value)
    expect(world.writes).toEqual([`redemption:acc-mina:${device}`, 'attendance:PRESENT:Self check-in:null'])
    expect(world.synced).toEqual([['st-mina']])
  })

  it('will not check in a second name from the same phone', async () => {
    await selfCheckIn(TOKEN, 'st-mina')
    world.writes = []
    const r = await selfCheckIn(TOKEN, 'st-mary')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/already checked in Mina T\./)
    expect(world.writes).toEqual([])
  })

  it('says "already" for the same name again, and writes nothing', async () => {
    await selfCheckIn(TOKEN, 'st-mina')
    world.writes = []
    const r = await selfCheckIn(TOKEN, 'st-mina')
    expect(r.ok && r.data!.already).toBe(true)
    expect(world.writes).toEqual([])
  })

  it('ties the phone to someone a servant already marked, so it cannot then check in a friend', async () => {
    world.record = { id: 'rec-m', status: 'PRESENT', note: null, markedById: 'acc-servant' }
    const r = await selfCheckIn(TOKEN, 'st-mary')
    expect(r.ok && r.data!.already).toBe(true)
    world.record = null
    const friend = await selfCheckIn(TOKEN, 'st-mina')
    expect(friend.ok).toBe(false)
    if (!friend.ok) expect(friend.error).toMatch(/already checked in Mary S\./)
  })

  it('turns away an expired code', async () => {
    world.token = { ...world.token!, expiresAt: new Date(Date.now() - 1000) }
    const r = await selfCheckIn(TOKEN, 'st-mina')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/expired/)
  })

  it('turns away any other kind of code', async () => {
    world.token = { ...world.token!, kind: 'STUDENT_ATTENDANCE' }
    expect((await selfCheckIn(TOKEN, 'st-mina')).ok).toBe(false)
  })

  it('turns away someone who is not on this meeting’s list', async () => {
    const r = await selfCheckIn(TOKEN, 'st-stranger')
    expect(r.ok).toBe(false)
    expect(world.writes).toEqual([])
  })
})

describe('undoing a check-in from the phone', () => {
  it('removes this phone’s own check-in while it is still theirs', async () => {
    await selfCheckIn(TOKEN, 'st-mina')
    world.writes = []
    world.record = { id: 'rec-1', status: 'PRESENT', note: 'Self check-in', markedById: null }
    const r = await undoSelfCheckIn(TOKEN)
    expect(r.ok).toBe(true)
    expect(world.writes).toEqual(['redemption.delete', 'attendance.delete'])
  })

  it('keeps the mark a servant has since made', async () => {
    await selfCheckIn(TOKEN, 'st-mina')
    world.writes = []
    world.record = { id: 'rec-1', status: 'PRESENT', note: null, markedById: 'acc-servant' }
    expect((await undoSelfCheckIn(TOKEN)).ok).toBe(true)
    expect(world.writes).toEqual(['redemption.delete'])
  })

  it('does nothing for a phone that checked nobody in', async () => {
    await selfCheckIn(TOKEN, 'st-mina')
    world.writes = []
    world.cookie = 'another-phone'
    const r = await undoSelfCheckIn(TOKEN)
    expect(r.ok).toBe(false)
    expect(world.writes).toEqual([])
  })
})
