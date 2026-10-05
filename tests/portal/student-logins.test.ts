import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PortalUser } from '@/lib/portal/permissions'

// A child's ID and PIN for the people who look after them (2026-10-04): the
// servants of the child's class, the stage overseer over it, and the admin —
// exactly the people who could already reset that PIN. Each view is logged,
// and a refused request opens no PIN at all.
//
// Stand-ins: the signed-in user, the activity log, and a database holding a
// few children with their sealed PINs. The vault itself is real, with a test key.
const world = vi.hoisted(() => {
  process.env.PORTAL_PIN_KEY = Buffer.alloc(32, 7).toString('base64')
  return {
    user: null as unknown,
    kids: [] as Array<Record<string, unknown>>,
    accounts: [] as Array<{ id: string; loginId: string; pinSealed: string | null }>,
    pinReads: 0,
    updates: [] as Array<{ id: string; data: Record<string, unknown> }>,
    audits: [] as Array<{ action: string; detail: string }>,
  }
})

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/rate-limit', () => ({ clearRateLimit: () => {} }))
vi.mock('@/lib/portal/session', () => ({ requirePortalUser: async () => world.user }))
vi.mock('@/lib/portal/audit', () => ({
  audit: async (_u: unknown, action: string, _e: string, _id: string | null, detail: string) => {
    world.audits.push({ action, detail })
  },
}))
vi.mock('@/lib/prisma', () => {
  const account = {
    findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
      world.pinReads++
      return world.accounts.filter((a) => where.id.in.includes(a.id))
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      world.updates.push({ id: where.id, data })
      return {}
    },
  }
  return {
    prisma: {
      student: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => world.kids.filter((k) => where.id.in.includes(k.id as string)) },
      account,
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    },
  }
})

import { revealStudentLogins, reissueStudentPins } from '@/lib/portal/actions/student-logins'
import { openPin, sealPin } from '@/lib/portal/pin-vault'

const base = { displayName: 'X', coordinatorOf: [] as string[], assistantOf: [] as string[], stageOversight: null }
const kgServant: PortalUser = { ...base, accountId: 's1', role: 'SERVANT', servantId: 'sv1', classIds: ['kg'] }
const firstServant: PortalUser = { ...base, accountId: 's2', role: 'SERVANT', servantId: 'sv2', classIds: ['1st'] }
// Oversees Elementary and serves a Middle School class that is not kidC's.
const elementaryOverseer: PortalUser = { ...base, accountId: 's3', role: 'SERVANT', servantId: 'sv3', classIds: ['5th'], stageOversight: 'ELEMENTARY' }
const admin: PortalUser = { ...base, accountId: 'a', role: 'ADMIN', classIds: [] }
const pastor: PortalUser = { ...base, accountId: 'p', role: 'PASTOR', classIds: [] }
const child: PortalUser = { ...base, accountId: 'k', role: 'STUDENT', studentId: 'kidA', classIds: ['kg'] }

const kid = (id: string, classId: string, stage: string, accountId: string, loginId: string, role = 'STUDENT') => ({
  id,
  firstName: id,
  lastName: 'Test',
  classId,
  class: { name: classId.toUpperCase(), stage },
  account: { id: accountId, loginId, role },
})

beforeEach(() => {
  world.kids = [
    kid('kidA', 'kg', 'ELEMENTARY', 'accA', '1001'),
    kid('kidB', 'kg', 'ELEMENTARY', 'accB', '1002'),
    kid('kidC', '7th', 'MIDDLE_SCHOOL', 'accC', '1003'),
    // A grown-up who serves now and kept their Student row (F0850).
    kid('kidD', 'kg', 'ELEMENTARY', 'accD', '1004', 'SERVANT'),
  ]
  world.accounts = [
    { id: 'accA', loginId: '1001', pinSealed: sealPin('4821', '1001') },
    { id: 'accB', loginId: '1002', pinSealed: null }, // chose their own on My PIN
    { id: 'accC', loginId: '1003', pinSealed: sealPin('7310', '1003') },
    { id: 'accD', loginId: '1004', pinSealed: sealPin('5555', '1004') },
  ]
  world.pinReads = 0
  world.updates = []
  world.audits = []
})

describe("revealStudentLogins: a child's PIN for the people who look after them", () => {
  it("shows a servant of the child's class the PIN on file, and logs the view", async () => {
    world.user = kgServant
    const r = await revealStudentLogins(['kidA'])
    expect(r.ok && r.data!.rows).toEqual([{ studentId: 'kidA', accountId: 'accA', loginId: '1001', pin: '4821' }])
    expect(world.audits).toEqual([{ action: 'login.reveal', detail: 'Viewed the PIN for kidA Test' }])
  })

  it('shows nothing for a PIN the child chose themselves', async () => {
    world.user = kgServant
    const r = await revealStudentLogins(['kidB'])
    expect(r.ok && r.data!.rows[0]!.pin).toBeNull()
  })

  it('shows a stage overseer the children of their stage, and the admin any child', async () => {
    world.user = elementaryOverseer
    expect((await revealStudentLogins(['kidA'])).ok).toBe(true)
    world.user = admin
    const r = await revealStudentLogins(['kidC'])
    expect(r.ok && r.data!.rows[0]!.pin).toBe('7310')
  })

  it('refuses a servant of another class, and opens no PIN', async () => {
    world.user = firstServant
    expect((await revealStudentLogins(['kidA'])).ok).toBe(false)
    world.user = elementaryOverseer
    expect((await revealStudentLogins(['kidC'])).ok).toBe(false)
    expect(world.pinReads).toBe(0)
    expect(world.audits).toEqual([])
  })

  it('refuses a request that slips in one child from another class', async () => {
    world.user = kgServant
    expect((await revealStudentLogins(['kidA', 'kidC'])).ok).toBe(false)
    expect(world.pinReads).toBe(0)
  })

  it('refuses the pastor and a child', async () => {
    world.user = pastor
    expect((await revealStudentLogins(['kidA'])).ok).toBe(false)
    world.user = child
    expect((await revealStudentLogins(['kidA'])).ok).toBe(false)
    expect(world.pinReads).toBe(0)
  })

  it("never shows a servant's PIN through the Student row they kept", async () => {
    world.user = kgServant
    expect((await revealStudentLogins(['kidD'])).ok).toBe(false)
    expect(world.pinReads).toBe(0)
  })
})

describe('reissueStudentPins: new PINs for children with none on file', () => {
  it('needs the typed phrase', async () => {
    world.user = kgServant
    expect((await reissueStudentPins(['kidB'], 'yes')).ok).toBe(false)
    expect(world.updates).toEqual([])
  })

  it("gives the class's children new PINs that are kept on file, and logs it", async () => {
    world.user = kgServant
    const r = await reissueStudentPins(['kidB'], 'RESET PINS')
    expect(r.ok).toBe(true)
    const row = r.ok ? r.data!.rows[0]! : null
    expect(row).toMatchObject({ studentId: 'kidB', accountId: 'accB', loginId: '1002' })
    expect(row!.pin).toMatch(/^\d{4}$/)
    const written = world.updates.find((u) => u.id === 'accB')!.data
    expect(openPin(written.pinSealed as string, '1002')).toBe(row!.pin)
    expect(written).toMatchObject({ failedAttempts: 0, lockedUntil: null })
    expect(world.audits.map((a) => a.action)).toEqual(['login.reissue'])
  })

  it('refuses a servant of another class, and changes nothing', async () => {
    world.user = firstServant
    expect((await reissueStudentPins(['kidA'], 'RESET PINS')).ok).toBe(false)
    expect(world.updates).toEqual([])
  })
})
