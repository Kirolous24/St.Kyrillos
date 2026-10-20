import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The calendar behind a servant's birthday link (2026-10-19). A calendar app
 * opens it without signing in, so the link is the only key: it must show the
 * same children the owner sees on the Birthdays page, and nothing to anyone
 * else. Stand-in: the database.
 */
const world = vi.hoisted(() => ({
  account: null as Record<string, unknown> | null,
  accountWhere: [] as unknown[],
  studentWhere: [] as unknown[],
  classes: [
    { id: 'kg', name: 'KG', stage: 'ELEMENTARY', sortOrder: 0, visitationThreshold: 3, photo: null, description: null, _count: { students: 1, servants: 1 } },
    { id: '1st', name: '1st Grade', stage: 'ELEMENTARY', sortOrder: 1, visitationThreshold: 3, photo: null, description: null, _count: { students: 1, servants: 1 } },
  ],
  students: [
    { id: 'st-mina', firstName: 'Mina', lastName: 'Test', dob: new Date('2020-03-05T00:00:00Z'), class: { name: 'KG' } },
  ],
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: async (args: { where: unknown }) => {
        world.accountWhere.push(args.where)
        return world.account
      },
    },
    schoolClass: { findMany: async () => world.classes },
    student: {
      findMany: async (args: { where: unknown }) => {
        world.studentWhere.push(args.where)
        return world.students
      },
    },
  },
}))

import { birthdayCalendarFor } from '@/lib/portal/data/birthday-calendar'

const TOKEN = 'a'.repeat(32)
const NOW = new Date('2026-10-19T15:00:00Z')

const servant = (over: Record<string, unknown> = {}) => ({
  id: 'acc-sv',
  role: 'SERVANT',
  displayName: 'A Servant',
  photo: null,
  isActive: true,
  student: null,
  servant: { id: 'sv-1', stageOversight: null, classes: [{ classId: 'kg', title: null }] },
  ...over,
})

beforeEach(() => {
  world.account = null
  world.accountWhere = []
  world.studentWhere = []
})

describe('birthdayCalendarFor', () => {
  it('looks the link up by its secret and answers nothing for an unknown one', async () => {
    expect(await birthdayCalendarFor(TOKEN, NOW)).toBeNull()
    expect(world.accountWhere).toEqual([{ calendarToken: TOKEN }])
    expect(world.studentWhere).toEqual([])
  })

  it('lists the children of the classes the owner can see, and only those', async () => {
    world.account = servant()
    const ics = await birthdayCalendarFor(TOKEN, NOW)
    expect(world.studentWhere).toEqual([{ classId: { in: ['kg'] }, dob: { not: null } }])
    expect(ics).toContain('SUMMARY:🎂 Mina T. turns 6')
    expect(ics).toContain('DESCRIPTION:KG')
  })

  it('gives the admin every class, as the Birthdays page does', async () => {
    world.account = servant({ role: 'ADMIN', servant: null })
    await birthdayCalendarFor(TOKEN, NOW)
    expect(world.studentWhere).toEqual([{ classId: { in: ['kg', '1st'] }, dob: { not: null } }])
  })

  it('answers nothing once the account is switched off', async () => {
    world.account = servant({ isActive: false })
    expect(await birthdayCalendarFor(TOKEN, NOW)).toBeNull()
    expect(world.studentWhere).toEqual([])
  })

  it("answers nothing for a child's account, which never has a calendar", async () => {
    world.account = servant({ role: 'STUDENT', servant: null, student: { id: 'st-1', classId: 'kg' } })
    expect(await birthdayCalendarFor(TOKEN, NOW)).toBeNull()
    expect(world.studentWhere).toEqual([])
  })
})
