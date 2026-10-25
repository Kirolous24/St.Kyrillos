import { describe, it, expect } from 'vitest'
import { classWorkspaceNav, mobileNavForUser, navForUser } from '@/lib/portal/nav'
import type { PortalUser } from '@/lib/portal/permissions'

// 2026-10-24 — a servant who serves only a Fellowship meeting gets a menu for
// a meeting: attendance, QR check-in, follow-ups, birthdays. None of the
// children's points, quizzes, lessons or posts.

const servant = (over: Partial<PortalUser>): PortalUser => ({
  accountId: 'acc', role: 'SERVANT', displayName: 'Servant', servantId: 'sv',
  classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null, fellowshipClassIds: [],
  ...over,
})

const KIDS_ONLY = [
  '/portal/points',
  '/portal/qr?tab=scan&mode=points',
  '/portal/exams',
  '/portal/leaderboard',
  '/portal/lessons',
  '/portal/feed',
  '/portal/reports/cards',
  '/portal/agenda',
  '/portal/curriculum',
  '/portal/students',
]

describe('the menu of a servant who serves only a Fellowship meeting', () => {
  const onlyMens = servant({ classIds: ['mens-meeting'], fellowshipClassIds: ['mens-meeting'] })
  const hrefs = navForUser(onlyMens).map((i) => i.href)

  it('has nothing that belongs to the children', () => {
    for (const href of KIDS_ONLY) expect(hrefs, href).not.toContain(href)
  })

  it('goes straight to their meeting, its attendance, its QR check-in and its follow-ups', () => {
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/portal',
        '/portal/classes/mens-meeting',
        '/portal/my-group',
        '/portal/attendance',
        '/portal/classes/mens-meeting/checkin',
        '/portal/follow-ups',
        '/portal/birthdays',
        '/portal/my-attendance',
      ]),
    )
  })

  it('lists the meetings when there are two', () => {
    const two = servant({ classIds: ['mens-meeting', 'youth-meeting'], fellowshipClassIds: ['mens-meeting', 'youth-meeting'] })
    const h = navForUser(two).map((i) => i.href)
    expect(h).toContain('/portal/classes')
    expect(h).toContain('/portal/qr')
  })

  it('keeps the phone bar to the meeting too', () => {
    const bar = mobileNavForUser(onlyMens).map((i) => i.href)
    expect(bar).not.toContain('/portal/points')
    expect(bar).not.toContain('/portal/exams')
    expect(bar).toContain('/portal/follow-ups')
  })

  it('is the same for a Fellowship overseer with no class of their own', () => {
    const overseer = servant({ stageOversight: 'FELLOWSHIP' })
    const h = navForUser(overseer).map((i) => i.href)
    for (const href of KIDS_ONLY) expect(h, href).not.toContain(href)
    expect(h).toContain('/portal/my-stage')
  })
})

describe('a servant who also serves a children’s class', () => {
  it('keeps the whole menu', () => {
    const mixed = servant({ classIds: ['kg', 'mens-meeting'], fellowshipClassIds: ['mens-meeting'] })
    const hrefs = navForUser(mixed).map((i) => i.href)
    expect(hrefs).toContain('/portal/points')
    expect(hrefs).toContain('/portal/exams')
  })
})

describe("the admin's workspace for a meeting", () => {
  it('has the meeting’s own rows and none of a class’s', () => {
    const hrefs = classWorkspaceNav('mens-meeting', true, true).map((i) => i.href)
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/portal/classes/mens-meeting',
        '/portal/classes/mens-meeting/attendance',
        '/portal/classes/mens-meeting/checkin',
        '/portal/follow-ups?class=mens-meeting',
        '/portal/classes/mens-meeting/members/new',
      ]),
    )
    expect(hrefs.some((h) => h.includes('/points') || h.includes('exams') || h.includes('lessons') || h.includes('credentials'))).toBe(false)
  })

  it("is unchanged for a children's class", () => {
    expect(classWorkspaceNav('kg', true).map((i) => i.href)).toContain('/portal/classes/kg/points')
  })
})
