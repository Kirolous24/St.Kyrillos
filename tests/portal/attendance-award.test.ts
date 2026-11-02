import { describe, it, expect } from 'vitest'
import { awardAttendancePoints, type AttendanceAwardContext } from '@/lib/portal/attendance-award'

/**
 * Attendance points after the admin reset a child's points (2026-11-02). The
 * reset deletes the points; a register from before it, saved again later, must
 * not bring them back, while anything marked after it earns as always.
 */

function fakeTx() {
  const created: Array<Record<string, unknown>> = []
  const tx = {
    pointEntry: {
      create: async (args: { data: Record<string, unknown> }) => {
        created.push(args.data)
        return {}
      },
      update: async () => ({}),
    },
  }
  return { tx, created }
}

const RESET = new Date('2026-11-02T18:00:00Z')
const ctx = (pointsResetAt: Date | null): AttendanceAwardContext => ({
  studentId: 's1',
  classId: 'kg',
  sessionKey: 'sunday',
  sessionLabel: 'Sunday School',
  sessionPoints: 3,
  accountId: 'acc-1',
  pointsResetAt,
})

describe('awardAttendancePoints after a points reset', () => {
  it('a register from before the reset, saved again, earns nothing', async () => {
    const { tx, created } = fakeTx()
    await awardAttendancePoints(tx as never, { id: 'r1', createdAt: new Date('2026-11-01T15:00:00Z'), pointEntry: null }, ctx(RESET))
    expect(created).toEqual([])
  })

  it('a record made after the reset earns its points', async () => {
    const { tx, created } = fakeTx()
    await awardAttendancePoints(tx as never, { id: 'r2', createdAt: new Date('2026-11-08T15:00:00Z'), pointEntry: null }, ctx(RESET))
    expect(created).toEqual([expect.objectContaining({ studentId: 's1', points: 3, attendanceRecordId: 'r2' })])
  })

  it('a child whose points were never reset earns as always', async () => {
    const { tx, created } = fakeTx()
    await awardAttendancePoints(tx as never, { id: 'r3', createdAt: new Date('2026-10-01T15:00:00Z'), pointEntry: null }, ctx(null))
    expect(created).toHaveLength(1)
  })
})
