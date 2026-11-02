import { describe, it, expect, vi, beforeEach } from 'vitest'

// KG, 2026-10-04: two servants took the same register at once and the second
// save erased the first, because a save wrote every child on the register. A
// save now writes what the servant changed and only fills in children nobody
// has marked yet, so it can never overwrite another servant's mark.
//
// Stand-ins: the signed-in servant, the class check, the follow-up rule, and a
// database that records the writes a save makes.
type Row = { id: string; studentId: string; sessionKey: string; status: string; reason: string | null; points: number[] }

const world = vi.hoisted(() => ({
  roster: ['k1', 'k2', 'k3', 'k4'],
  session: { key: 'liturgy', label: 'Liturgy', points: 5, isActive: true, classId: null as string | null },
  // Every session by key, for a save that covers several (2026-11-01).
  sessions: {} as Record<string, { key: string; label: string; points: number; isActive: boolean; classId: string | null }>,
  // What the database holds, by session and child.
  store: new Map<string, Row>(),
  upserts: [] as string[],
  fills: [] as Array<{ studentIds: string[]; statuses: string[]; skipDuplicates: boolean }>,
  synced: null as string[] | null,
  syncedSessions: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-servant', role: 'SERVANT', displayName: 'A Servant', servantId: 'sv-1',
    classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async () => ({ id: 'kg', name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }),
}))
vi.mock('@/lib/portal/followup-sync', () => ({
  syncAutoFollowUps: async ({ studentIds, session }: { studentIds: string[]; session: { key: string } }) => {
    world.synced = [...studentIds].sort()
    world.syncedSessions.push(session.key)
    return { opened: 0, closed: 0 }
  },
}))
vi.mock('@/lib/prisma', () => {
  const key = (sessionKey: string, studentId: string) => `${sessionKey}:${studentId}`
  const rowsWhere = (where: { sessionKey?: string; studentId?: { in: string[] }; status?: string }) =>
    Array.from(world.store.values()).filter(
      (r) =>
        (!where.sessionKey || r.sessionKey === where.sessionKey) &&
        (!where.studentId || where.studentId.in.includes(r.studentId)) &&
        (!where.status || r.status === where.status),
    )
  const tx = {
    attendanceRecord: {
      upsert: async (args: {
        where: { studentId_date_sessionKey: { studentId: string; sessionKey: string } }
        create: { status: string; reason: string | null }
        update: { status: string; reason: string | null }
      }) => {
        const { studentId, sessionKey } = args.where.studentId_date_sessionKey
        world.upserts.push(studentId)
        const k = key(sessionKey, studentId)
        const had = world.store.get(k)
        const id = had?.id ?? `rec-${k}`
        const data = had ? args.update : args.create
        world.store.set(k, { id, studentId, sessionKey, status: data.status, reason: data.reason ?? null, points: had?.points ?? [] })
        return { id }
      },
      createMany: async (args: { data: Array<{ studentId: string; sessionKey: string; status: string; reason?: string | null }>; skipDuplicates?: boolean }) => {
        world.fills.push({
          studentIds: args.data.map((d) => d.studentId).sort(),
          statuses: Array.from(new Set(args.data.map((d) => d.status))),
          skipDuplicates: args.skipDuplicates === true,
        })
        let count = 0
        for (const d of args.data) {
          const k = key(d.sessionKey, d.studentId)
          if (world.store.has(k)) continue
          world.store.set(k, { id: `rec-${k}`, studentId: d.studentId, sessionKey: d.sessionKey, status: d.status, reason: d.reason ?? null, points: [] })
          count++
        }
        return { count }
      },
      findMany: async (args: { where: { sessionKey?: string; studentId?: { in: string[] }; status?: string } }) =>
        rowsWhere(args.where).map((r) => ({ ...r, pointEntry: r.points.length ? { id: `pt-${r.id}`, points: r.points[0]!, undone: false } : null })),
    },
    pointEntry: {
      findUnique: async (args: { where: { attendanceRecordId?: string } }) => {
        const r = Array.from(world.store.values()).find((x) => x.id === args.where.attendanceRecordId)
        return r && r.points.length ? { id: `pt-${r.id}`, points: r.points[0]!, undone: false } : null
      },
      create: async (args: { data: { attendanceRecordId?: string; points: number } }) => {
        const r = Array.from(world.store.values()).find((x) => x.id === args.data.attendanceRecordId)
        if (r) r.points.push(args.data.points)
        return {}
      },
      update: async () => ({}),
    },
  }
  return {
    prisma: {
      attendanceSession: {
        findUnique: async (args: { where: { key: string } }) => world.sessions[args.where.key] ?? (args.where.key === world.session.key ? world.session : null),
      },
      student: { findMany: async () => world.roster.map((id) => ({ id })) },
      attendanceRecord: {
        groupBy: async (args: { where: { sessionKey: string } }) => {
          const by = new Map<string, number>()
          for (const r of rowsWhere({ sessionKey: args.where.sessionKey })) by.set(r.status, (by.get(r.status) ?? 0) + 1)
          return Array.from(by.entries()).map(([status, n]) => ({ status, _count: { _all: n } }))
        },
      },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  }
})

import { saveAttendance } from '@/lib/portal/actions/attendance'

const vespers = { key: 'vespers', label: 'Vespers', points: 2, isActive: true, classId: null }
const hymns = { key: 'hymns', label: 'Hymns', points: 2, isActive: true, classId: null }

beforeEach(() => {
  world.session = { key: 'liturgy', label: 'Liturgy', points: 5, isActive: true, classId: null }
  world.sessions = {}
  world.store = new Map()
  world.upserts = []
  world.fills = []
  world.synced = null
  world.syncedSessions = []
})

const stored = (sessionKey: string) =>
  Object.fromEntries(
    Array.from(world.store.values())
      .filter((r) => r.sessionKey === sessionKey)
      .sort((a, b) => a.studentId.localeCompare(b.studentId))
      .map((r) => [r.studentId, `${r.status}${r.points.length ? ` +${r.points.reduce((n, p) => n + p, 0)}` : ''}`]),
  )
const seed = (sessionKey: string, studentId: string, status: string, points: number[] = []) =>
  world.store.set(`${sessionKey}:${studentId}`, { id: `old-${sessionKey}-${studentId}`, studentId, sessionKey, status, reason: null, points })

describe('saveAttendance with two servants on one register', () => {
  it("writes the children this servant changed, and only fills in the others where nothing is stored", async () => {
    const r = await saveAttendance({
      classId: 'kg',
      date: '2026-08-30',
      sessionKey: 'liturgy',
      marks: [{ studentId: 'k2', status: 'PRESENT', reason: null }],
    })
    expect(r.ok).toBe(true)
    expect(world.upserts).toEqual(['k2'])
    expect(world.fills).toEqual([{ studentIds: ['k1', 'k3', 'k4'], statuses: ['ABSENT'], skipDuplicates: true }])
  })

  it('still runs the follow-up rule over the whole class on Sunday School', async () => {
    world.session = { key: 'sunday', label: 'Sunday School', points: 3, isActive: true, classId: null }
    await saveAttendance({
      classId: 'kg',
      date: '2026-08-30',
      sessionKey: 'sunday',
      marks: [{ studentId: 'k2', status: 'PRESENT', reason: null }],
    })
    expect(world.synced).toEqual(['k1', 'k2', 'k3', 'k4'])
  })
})

// "Can we make attendance for multiple session? Sometimes vespers & hymns"
// (2026-11-01): one register saved to several sessions, each by its own rules.
describe('saveAttendance for several sessions at once', () => {
  beforeEach(() => {
    world.sessions = { vespers, hymns, sunday: { key: 'sunday', label: 'Sunday School', points: 3, isActive: true, classId: null } }
  })

  it('records what the servant marked in every session, with each session’s points', async () => {
    const r = await saveAttendance({
      classId: 'kg', date: '2026-08-29', sessionKey: 'vespers', alsoSessionKeys: ['hymns'],
      marks: [{ studentId: 'k2', status: 'PRESENT', reason: null }],
    })
    expect(r.ok).toBe(true)
    expect(stored('vespers')).toEqual({ k1: 'ABSENT', k2: 'PRESENT +2', k3: 'ABSENT', k4: 'ABSENT' })
    expect(stored('hymns')).toEqual({ k1: 'ABSENT', k2: 'PRESENT +2', k3: 'ABSENT', k4: 'ABSENT' })
  })

  it('children nobody marked in the other session get their mark from the first, points and all', async () => {
    // Another servant (or a scanned card) had already marked k3 present for Vespers.
    seed('vespers', 'k3', 'PRESENT', [2])
    await saveAttendance({
      classId: 'kg', date: '2026-08-29', sessionKey: 'vespers', alsoSessionKeys: ['hymns'],
      marks: [{ studentId: 'k2', status: 'PRESENT', reason: null }],
    })
    expect(stored('hymns')).toEqual({ k1: 'ABSENT', k2: 'PRESENT +2', k3: 'PRESENT +2', k4: 'ABSENT' })
  })

  it('never overwrites a mark another servant already saved in the other session', async () => {
    seed('hymns', 'k1', 'EXCUSED')
    seed('hymns', 'k4', 'PRESENT', [2])
    await saveAttendance({
      classId: 'kg', date: '2026-08-29', sessionKey: 'vespers', alsoSessionKeys: ['hymns'],
      marks: [{ studentId: 'k2', status: 'PRESENT', reason: null }],
    })
    expect(stored('hymns')).toEqual({ k1: 'EXCUSED', k2: 'PRESENT +2', k3: 'ABSENT', k4: 'PRESENT +2' })
  })

  it('but a child this servant marked is changed in every session', async () => {
    seed('hymns', 'k2', 'ABSENT')
    await saveAttendance({
      classId: 'kg', date: '2026-08-29', sessionKey: 'vespers', alsoSessionKeys: ['hymns'],
      marks: [{ studentId: 'k2', status: 'PRESENT', reason: null }],
    })
    expect(stored('hymns').k2).toBe('PRESENT +2')
  })

  it('runs the follow-up rule for each session that has one, and reports each session', async () => {
    const r = await saveAttendance({
      classId: 'kg', date: '2026-08-30', sessionKey: 'hymns', alsoSessionKeys: ['sunday'],
      marks: [{ studentId: 'k1', status: 'PRESENT', reason: null }],
    })
    expect(world.syncedSessions).toEqual(['sunday'])
    expect(r.ok && r.data!.also).toEqual([{ label: 'Sunday School', present: 1, excused: 0, absent: 3 }])
  })

  it('refuses a session that is not on, or another class’s meeting, before writing anything', async () => {
    world.sessions.off = { key: 'off', label: 'Off', points: 2, isActive: false, classId: null }
    world.sessions.theirs = { key: 'theirs', label: 'Their meeting', points: 2, isActive: true, classId: 'other-class' }
    for (const also of [['nope'], ['off'], ['theirs']]) {
      const r = await saveAttendance({
        classId: 'kg', date: '2026-08-29', sessionKey: 'vespers', alsoSessionKeys: also,
        marks: [{ studentId: 'k2', status: 'PRESENT', reason: null }],
      })
      expect(r.ok, also[0]).toBe(false)
    }
    expect(world.store.size).toBe(0)
  })
})
