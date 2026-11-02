import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * QR check-ins for several sessions at once (2026-11-01: "Can we make
 * attendance for multiple session? Sometimes vespers & hymns", for "ALL
 * activities"): a code the children scan, a servant scanning their cards, and
 * a servants' meeting code can each cover several sessions or activities, and
 * one check-in records every one, each with its own points. Older codes, which
 * name one session, work as before.
 *
 * Stand-ins: the signed-in user, the class check, the follow-up rule, the QR
 * picture and a database that remembers each session's marks.
 */
type Rec = { id: string; studentId: string; sessionKey: string; classId: string; status: string; points: number }
type Session = { key: string; label: string; points: number; isActive: boolean; classId: string | null }

const world = vi.hoisted(() => ({
  user: null as unknown,
  sessions: {} as Record<string, Session>,
  activities: {} as Record<string, { key: string; label: string; isActive: boolean }>,
  tokens: [] as Array<Record<string, unknown>>,
  token: null as null | Record<string, unknown>,
  records: new Map<string, Rec>(),
  servantMarks: [] as Array<{ activityKey: string; status: string }>,
  redemptions: 0,
  synced: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({ requirePortalUser: async () => world.user }))
vi.mock('@/components/portal/QrImage', () => ({ qrSvgDataUrl: async () => 'data:image/svg+xml;base64,' }))
vi.mock('@/lib/portal/followup-sync', () => ({
  syncAutoFollowUps: async ({ session }: { session: { key: string } }) => {
    world.synced.push(session.key)
    return { opened: 0, closed: 0 }
  },
}))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async (_u: unknown, id: string) => ({ id, name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }),
}))
vi.mock('@/lib/prisma', () => {
  const k = (sessionKey: string, studentId: string) => `${sessionKey}:${studentId}`
  const byId = (id: string) => Array.from(world.records.values()).find((r) => r.id === id)
  const db = {
    qrToken: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        world.tokens.push(data)
        return { ...data }
      },
      findUnique: async () => world.token,
      findFirst: async () => world.token,
    },
    attendanceSession: {
      findUnique: async ({ where }: { where: { key: string } }) => world.sessions[where.key] ?? null,
      findMany: async ({ where }: { where: { key: { in: string[] } } }) => where.key.in.map((key) => world.sessions[key]).filter(Boolean),
    },
    servantActivity: {
      findUnique: async ({ where }: { where: { key: string } }) => world.activities[where.key] ?? null,
      findMany: async ({ where }: { where: { key: { in: string[] } } }) => where.key.in.map((key) => world.activities[key]).filter(Boolean),
    },
    student: {
      findUnique: async () => ({ id: 'k1', firstName: 'Mina', lastName: 'Test', classId: 'kg', memberships: [] }),
      findFirst: async () => ({ id: 'k1', firstName: 'Mina', lastName: 'Test' }),
    },
    attendanceRecord: {
      upsert: async ({ where, create, update }: {
        where: { studentId_date_sessionKey: { studentId: string; sessionKey: string } }
        create: { classId: string; status: string }
        update: { classId: string; status: string }
      }) => {
        const { studentId, sessionKey } = where.studentId_date_sessionKey
        const had = world.records.get(k(sessionKey, studentId))
        const data = had ? update : create
        const id = had?.id ?? `rec-${sessionKey}`
        world.records.set(k(sessionKey, studentId), { id, studentId, sessionKey, classId: data.classId, status: data.status, points: had?.points ?? 0 })
        return { id }
      },
      findUnique: async ({ where }: { where: { id?: string; studentId_date_sessionKey?: { studentId: string; sessionKey: string } } }) => {
        if (where.id) {
          const r = byId(where.id)
          return r ? { ...r, date: new Date('2026-08-29T00:00:00Z'), student: { firstName: 'Mina', lastName: 'Test' } } : null
        }
        const { studentId, sessionKey } = where.studentId_date_sessionKey!
        const r = world.records.get(k(sessionKey, studentId))
        return r ? { id: r.id, status: r.status } : null
      },
      delete: async ({ where }: { where: { id: string } }) => {
        for (const [key, r] of Array.from(world.records.entries())) if (r.id === where.id) world.records.delete(key)
        return {}
      },
    },
    pointEntry: {
      findUnique: async () => null,
      create: async ({ data }: { data: { attendanceRecordId?: string; points: number } }) => {
        const r = data.attendanceRecordId ? byId(data.attendanceRecordId) : undefined
        if (r) r.points += data.points
        return {}
      },
      update: async () => ({}),
    },
    qrRedemption: {
      create: async () => {
        world.redemptions++
        return {}
      },
    },
    servantAttendance: {
      upsert: async ({ create }: { create: { activityKey: string; status: string } }) => {
        world.servantMarks.push({ activityKey: create.activityKey, status: create.status })
        return {}
      },
    },
    schoolClass: { findUnique: async () => ({ visitationThreshold: 1 }) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { prisma: db }
})

import { createGroupCode, createMeetingCode, redeemCode, resolveScan, scanStudent, undoScan } from '@/lib/portal/actions/qr'

const servant = { accountId: 'acc-s', role: 'SERVANT', displayName: 'A Servant', servantId: 'sv-1', classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null }
const child = { accountId: 'acc-k', role: 'STUDENT', displayName: 'Mina Test', studentId: 'k1', classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null }
const TOKEN = 'a'.repeat(43)
const soon = () => new Date(Date.now() + 5 * 60_000)
const codeRow = (over: Record<string, unknown>) => ({
  token: TOKEN, kind: 'STUDENT_ATTENDANCE', classIds: ['kg'], sessionKey: 'vespers', sessionKeys: [], activityKey: null, activityKeys: [],
  activityLabel: null, points: null, date: new Date('2026-08-29T00:00:00Z'), weekStart: null, title: null, expiresAt: soon(), createdById: 'acc-s',
  ...over,
})
const marks = () =>
  Object.fromEntries(Array.from(world.records.values()).sort((a, b) => a.sessionKey.localeCompare(b.sessionKey)).map((r) => [r.sessionKey, `${r.status} +${r.points}`]))

beforeEach(() => {
  world.user = servant
  world.sessions = {
    vespers: { key: 'vespers', label: 'Vespers', points: 2, isActive: true, classId: null },
    hymns: { key: 'hymns', label: 'Hymns', points: 2, isActive: true, classId: null },
    sunday: { key: 'sunday', label: 'Sunday School', points: 3, isActive: true, classId: null },
    off: { key: 'off', label: 'Off', points: 2, isActive: false, classId: null },
  }
  world.activities = {
    saturday_vespers: { key: 'saturday_vespers', label: 'Vespers', isActive: true },
    saturday_hymns: { key: 'saturday_hymns', label: 'Hymns Class', isActive: true },
  }
  world.tokens = []
  world.token = null
  world.records = new Map()
  world.servantMarks = []
  world.redemptions = 0
  world.synced = []
})

describe('a code the children scan, for several sessions', () => {
  it('keeps every session, named together, worth their points added up', async () => {
    const r = await createGroupCode({ mode: 'ATTENDANCE', classIds: ['kg'], sessionKey: 'vespers', alsoSessionKeys: ['hymns'], date: '2026-08-29' })
    expect(r.ok).toBe(true)
    expect(world.tokens[0]).toMatchObject({ sessionKey: 'vespers', sessionKeys: ['vespers', 'hymns'], title: 'Vespers and Hymns', points: 4 })
  })

  it('refuses a session that is not on, before making a code', async () => {
    const r = await createGroupCode({ mode: 'ATTENDANCE', classIds: ['kg'], sessionKey: 'vespers', alsoSessionKeys: ['off'] })
    expect(r.ok).toBe(false)
    expect(world.tokens).toEqual([])
  })

  it('a child scanning it is marked present for each session, with each session’s points, in one check-in', async () => {
    world.user = child
    world.token = codeRow({ sessionKeys: ['vespers', 'hymns'], title: 'Vespers and Hymns', points: 4 })
    const r = await redeemCode(TOKEN)
    expect(r).toMatchObject({ ok: true, data: { title: 'Vespers and Hymns', points: 4, already: false } })
    expect(marks()).toEqual({ hymns: 'PRESENT +2', vespers: 'PRESENT +2' })
    expect(world.redemptions).toBe(1)
  })

  it('runs the follow-up rule for the sessions that have one', async () => {
    world.user = child
    world.token = codeRow({ sessionKey: 'hymns', sessionKeys: ['hymns', 'sunday'] })
    await redeemCode(TOKEN)
    expect(world.synced).toEqual(['sunday'])
  })

  it('an older code naming one session works as before', async () => {
    world.user = child
    world.token = codeRow({ sessionKeys: [] })
    const r = await redeemCode(TOKEN)
    expect(r).toMatchObject({ ok: true, data: { title: 'Vespers', points: 2 } })
    expect(marks()).toEqual({ vespers: 'PRESENT +2' })
  })
})

describe('a servant scanning cards for several sessions', () => {
  const scan = { classId: 'kg', code: '4821', mode: 'ATTENDANCE' as const, sessionKey: 'vespers', alsoSessionKeys: ['hymns'], date: '2026-08-29' }

  it('marks the child present for each, and Undo takes back every one', async () => {
    const r = await scanStudent(scan)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data!.message).toBe('Mina Test marked present for Vespers and Hymns · +4')
    expect(marks()).toEqual({ hymns: 'PRESENT +2', vespers: 'PRESENT +2' })
    expect(r.data!.undo).toMatchObject({ kind: 'ATTENDANCE', ids: ['rec-vespers', 'rec-hymns'] })
    expect((await undoScan(r.data!.undo!)).ok).toBe(true)
    expect(marks()).toEqual({})
  })

  it('already present for one session: marks only the other', async () => {
    world.records.set('vespers:k1', { id: 'old-vespers', studentId: 'k1', sessionKey: 'vespers', classId: 'kg', status: 'PRESENT', points: 2 })
    expect((await resolveScan(scan)).ok && (await resolveScan(scan)) ).toMatchObject({ data: { already: false } })
    const r = await scanStudent(scan)
    expect(r.ok && r.data!.message).toBe('Mina Test marked present for Hymns · +2')
    expect(r.ok && r.data!.undo).toMatchObject({ ids: ['rec-hymns'] })
    expect(marks()).toEqual({ hymns: 'PRESENT +2', vespers: 'PRESENT +2' })
  })

  it('present for every session already: says so, and writes nothing', async () => {
    world.records.set('vespers:k1', { id: 'old-v', studentId: 'k1', sessionKey: 'vespers', classId: 'kg', status: 'PRESENT', points: 2 })
    world.records.set('hymns:k1', { id: 'old-h', studentId: 'k1', sessionKey: 'hymns', classId: 'kg', status: 'PRESENT', points: 2 })
    expect(await resolveScan(scan)).toMatchObject({ ok: true, data: { already: true } })
    expect(await scanStudent(scan)).toMatchObject({ ok: true, data: { already: true, undo: null } })
  })

  it('one session, as before', async () => {
    const r = await scanStudent({ ...scan, alsoSessionKeys: undefined })
    expect(r.ok && r.data!.message).toBe('Mina Test marked present · +2')
    expect(marks()).toEqual({ vespers: 'PRESENT +2' })
  })
})

describe('a servants’ meeting code for several activities', () => {
  it('keeps every activity, and a servant scanning it is marked for each', async () => {
    const r = await createMeetingCode({ activityKey: 'saturday_vespers', alsoActivityKeys: ['saturday_hymns'], weekStart: '2026-08-24' })
    expect(r.ok).toBe(true)
    expect(world.tokens[0]).toMatchObject({ activityKey: 'saturday_vespers', activityKeys: ['saturday_vespers', 'saturday_hymns'], title: 'Vespers and Hymns Class' })
    world.token = codeRow({ kind: 'SERVANT_MEETING', classIds: [], sessionKey: null, activityKey: 'saturday_vespers', activityKeys: ['saturday_vespers', 'saturday_hymns'], weekStart: new Date('2026-08-24T00:00:00Z'), date: null })
    const redeemed = await redeemCode(TOKEN)
    expect(redeemed).toMatchObject({ ok: true, data: { title: 'Vespers and Hymns Class' } })
    expect(world.servantMarks).toEqual([
      { activityKey: 'saturday_vespers', status: 'PRESENT' },
      { activityKey: 'saturday_hymns', status: 'PRESENT' },
    ])
  })
})
