import { describe, it, expect, vi } from 'vitest'

/**
 * Message families (2026-10-19) lists each family's numbers in the order a
 * message goes. Since 2026-10-25 that is the mother's first unless a servant
 * chose another number for the child. Stand-ins: the roster, the register,
 * the excuses and the log.
 */
const world = vi.hoisted(() => ({
  roster: [] as unknown[],
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findMany: async () => world.roster },
    attendanceRecord: {
      findMany: async () => [
        { studentId: 'kid-1', classId: 'kg', status: 'ABSENT' },
        { studentId: 'kid-2', classId: 'kg', status: 'ABSENT' },
      ],
    },
    followUpLog: { findMany: async () => [] },
  },
}))
vi.mock('@/lib/portal/data/excuses', () => ({ excusesByStudent: async () => new Map() }))

import { loadMissedMeeting } from '@/lib/portal/data/family-messages'

const kid = (id: string, callFirst: string | null) => ({
  id,
  firstName: id,
  lastName: 'Saad',
  createdAt: new Date('2026-09-01T12:00:00Z'),
  classId: 'kg',
  fatherPhone: '6155550101',
  motherPhone: '6155550102',
  callFirst,
  account: { phone: null },
  memberships: [],
})

describe('loadMissedMeeting', () => {
  it("puts the mother's number first, or the one a servant chose for the child", async () => {
    world.roster = [kid('kid-1', null), kid('kid-2', 'FATHER')]
    const { held, kids } = await loadMissedMeeting({
      classId: 'kg',
      session: { key: 'sunday', classId: null },
      date: '2026-10-18',
      today: '2026-10-20',
    })
    expect(held).toBe(true)
    expect(kids.find((k) => k.id === 'kid-1')!.phones.map((p) => p.label)).toEqual(['Mother', 'Father'])
    expect(kids.find((k) => k.id === 'kid-2')!.phones.map((p) => p.label)).toEqual(['Father', 'Mother'])
  })
})
