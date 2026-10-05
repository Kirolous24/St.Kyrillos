import { describe, it, expect, vi, beforeEach } from 'vitest'

// KG, 2026-10-04: two servants took the same register at once and the second
// save erased the first, because a save wrote every child on the register. A
// save now writes what the servant changed and only fills in children nobody
// has marked yet, so it can never overwrite another servant's mark.
//
// Stand-ins: the signed-in servant, the class check, the follow-up rule, and a
// database that records the writes a save makes.
const world = vi.hoisted(() => ({
  roster: ['k1', 'k2', 'k3', 'k4'],
  session: { key: 'liturgy', label: 'Liturgy', points: 5, isActive: true, classId: null as string | null },
  upserts: [] as string[],
  fills: [] as Array<{ studentIds: string[]; statuses: string[]; skipDuplicates: boolean }>,
  synced: null as string[] | null,
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
  syncAutoFollowUps: async ({ studentIds }: { studentIds: string[] }) => {
    world.synced = [...studentIds].sort()
    return { opened: 0, closed: 0 }
  },
}))
vi.mock('@/lib/prisma', () => {
  const tx = {
    attendanceRecord: {
      upsert: async (args: { where: { studentId_date_sessionKey: { studentId: string } } }) => {
        world.upserts.push(args.where.studentId_date_sessionKey.studentId)
        return { id: `rec-${args.where.studentId_date_sessionKey.studentId}` }
      },
      createMany: async (args: { data: Array<{ studentId: string; status: string }>; skipDuplicates?: boolean }) => {
        world.fills.push({
          studentIds: args.data.map((d) => d.studentId).sort(),
          statuses: Array.from(new Set(args.data.map((d) => d.status))),
          skipDuplicates: args.skipDuplicates === true,
        })
        return { count: args.data.length }
      },
    },
    pointEntry: { findUnique: async () => null, create: async () => ({}), update: async () => ({}) },
  }
  return {
    prisma: {
      attendanceSession: { findUnique: async () => world.session },
      student: { findMany: async () => world.roster.map((id) => ({ id })) },
      attendanceRecord: { groupBy: async () => [] },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  }
})

import { saveAttendance } from '@/lib/portal/actions/attendance'

beforeEach(() => {
  world.session = { key: 'liturgy', label: 'Liturgy', points: 5, isActive: true, classId: null }
  world.upserts = []
  world.fills = []
  world.synced = null
})

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
