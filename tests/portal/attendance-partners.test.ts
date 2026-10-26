import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Attendance partners (2026-10-25): "the 5/6th and 7/8th to have access to the
 * other gender only for attendance, nothing else". The servants of a paired
 * class may take its register: the register page, its saving and live sync,
 * removing a register, QR codes and card scans for attendance. Nothing else
 * opens. These guards hold that line in the source, and the admin's pairing
 * is checked below with a stand-in database.
 */
const root = path.resolve(__dirname, '../..')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sources(full))
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}
const files = ['app', 'components', 'lib'].flatMap((d) => sources(path.join(root, d)))
const using = (needle: RegExp) =>
  files.filter((f) => needle.test(readFileSync(f, 'utf8'))).map((f) => path.relative(root, f)).sort()

describe('attendance.take reaches the register and nothing else', () => {
  it('is asked for only where a register is taken', () => {
    expect(using(/'attendance\.take'/)).toEqual(
      [
        'app/portal/(app)/attendance/page.tsx',
        'app/portal/(app)/classes/[id]/attendance/page.tsx',
        'app/portal/(app)/qr/page.tsx',
        'components/portal/widgets/CheckInWidget.tsx',
        'lib/portal/actions/attendance.ts',
        'lib/portal/actions/qr.ts',
        'lib/portal/data/classes.ts',
        'lib/portal/permissions.ts',
      ].sort(),
    )
  })

  it('every register action asks for it, and none still asks for attendance.write', () => {
    const actions = readFileSync(path.join(root, 'lib/portal/actions/attendance.ts'), 'utf8')
    expect(actions).not.toMatch(/'attendance\.write'/)
    expect(actions.match(/assertClassAction\(user, [^)]+, 'attendance\.take'\)/g)).toHaveLength(3)
  })

  it('the pairing itself is read only by the permission rules and the class lists', () => {
    expect(using(/attendanceOnly/)).toEqual(['lib/portal/data/classes.ts', 'lib/portal/permissions.ts', 'lib/portal/portal-user.ts'])
  })
})

const world = vi.hoisted(() => ({
  role: 'ADMIN',
  classes: [] as Array<{ id: string; name: string; stage: string; isActive: boolean }>,
  cleared: [] as Array<Record<string, unknown>>,
  set: [] as Array<{ id: string; partner: string }>,
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
    accountId: 'acc', role: world.role, displayName: 'Admin', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/prisma', () => {
  const db = {
    schoolClass: {
      findMany: async (args: { where: { id: { in: string[] } } }) => world.classes.filter((c) => args.where.id.in.includes(c.id)),
      updateMany: async (args: Record<string, unknown>) => {
        world.cleared.push(args)
        return { count: 1 }
      },
      update: async (args: { where: { id: string }; data: { attendancePartnerId: string } }) => {
        world.set.push({ id: args.where.id, partner: args.data.attendancePartnerId })
        return {}
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { prisma: db }
})

import { setAttendancePartner } from '@/lib/portal/actions/admin'

const cls = (id: string, stage = 'MIDDLE_SCHOOL') => ({ id, name: id, stage, isActive: true })

beforeEach(() => {
  world.role = 'ADMIN'
  world.classes = [cls('5th-6th-boys'), cls('5th-6th-girls'), cls('mens-meeting', 'FELLOWSHIP')]
  world.cleared = []
  world.set = []
  world.audits = []
})

describe('setAttendancePartner', () => {
  it('pairs two classes both ways, first undoing either one’s old pair', async () => {
    const r = await setAttendancePartner('5th-6th-boys', '5th-6th-girls')
    expect(r.ok).toBe(true)
    expect(world.cleared).toEqual([
      {
        where: { OR: [{ id: { in: ['5th-6th-boys', '5th-6th-girls'] } }, { attendancePartnerId: { in: ['5th-6th-boys', '5th-6th-girls'] } }] },
        data: { attendancePartnerId: null },
      },
    ])
    expect(world.set).toEqual([
      { id: '5th-6th-boys', partner: '5th-6th-girls' },
      { id: '5th-6th-girls', partner: '5th-6th-boys' },
    ])
    expect(world.audits.map((a) => a.action)).toEqual(['class.attendancePartner'])
  })

  it('no partner ends the pair, whichever way it was stored', async () => {
    const r = await setAttendancePartner('5th-6th-boys', null)
    expect(r.ok).toBe(true)
    expect(world.cleared).toEqual([
      { where: { OR: [{ id: { in: ['5th-6th-boys'] } }, { attendancePartnerId: { in: ['5th-6th-boys'] } }] }, data: { attendancePartnerId: null } },
    ])
    expect(world.set).toEqual([])
  })

  it('is the admin’s alone', async () => {
    world.role = 'SERVANT'
    const r = await setAttendancePartner('5th-6th-boys', '5th-6th-girls')
    expect(r.ok).toBe(false)
    expect(world.cleared).toEqual([])
  })

  it('refuses a class paired with itself, one that does not exist, and a Fellowship meeting', async () => {
    expect(await setAttendancePartner('5th-6th-boys', '5th-6th-boys')).toEqual({ ok: false, error: 'A class cannot take its own attendance twice. Pick another class.' })
    expect(await setAttendancePartner('5th-6th-boys', 'nowhere')).toEqual({ ok: false, error: 'That class does not exist.' })
    expect(await setAttendancePartner('5th-6th-boys', 'mens-meeting')).toEqual({ ok: false, error: 'A Fellowship meeting takes its own register and cannot be paired.' })
    expect(world.cleared).toEqual([])
  })
})
