import { describe, it, expect, vi } from 'vitest'

// getPortalUser builds the signed-in user once per request, and every scope in
// the portal reads its class lists. Stand-ins: the session, the account row,
// and React's per-request cache (node's React has none).
const world = vi.hoisted(() => ({ account: null as unknown }))

vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }))
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { kind: 'portal', role: 'SERVANT', accountId: 'acc-1' } }) }))
vi.mock('@/lib/prisma', () => ({ prisma: { account: { findUnique: async () => world.account } } }))

import { getPortalUser } from '@/lib/portal/session'

describe('getPortalUser', () => {
  it('reads each class title for the class it is held in', async () => {
    world.account = {
      id: 'acc-1',
      role: 'SERVANT',
      displayName: 'A Servant',
      photo: null,
      isActive: true,
      student: null,
      servant: {
        id: 'sv-1',
        stageOversight: null,
        classes: [
          { classId: 'kg', title: 'ASSISTANT_COORDINATOR' },
          { classId: '1st', title: 'COORDINATOR' },
          { classId: '2nd', title: null },
        ],
      },
    }
    expect(await getPortalUser()).toMatchObject({
      classIds: ['kg', '1st', '2nd'],
      coordinatorOf: ['1st'],
      assistantOf: ['kg'],
    })
  })

  it('collects the classes whose registers they may also take, stored either way (2026-10-25)', async () => {
    world.account = {
      id: 'acc-1',
      role: 'SERVANT',
      displayName: 'A Servant',
      photo: null,
      isActive: true,
      student: null,
      servant: {
        id: 'sv-1',
        stageOversight: null,
        classes: [
          { classId: '5th-6th-boys', title: null, class: { stage: 'MIDDLE_SCHOOL', attendancePartnerId: '5th-6th-girls', attendancePartnerOf: [] } },
          { classId: '7th-8th-boys', title: null, class: { stage: 'MIDDLE_SCHOOL', attendancePartnerId: null, attendancePartnerOf: [{ id: '7th-8th-girls' }] } },
          // A pair of two classes they serve already adds nothing.
          { classId: 'kg', title: null, class: { stage: 'ELEMENTARY', attendancePartnerId: '1st', attendancePartnerOf: [{ id: '1st' }] } },
          { classId: '1st', title: null, class: { stage: 'ELEMENTARY', attendancePartnerId: 'kg', attendancePartnerOf: [{ id: 'kg' }] } },
        ],
      },
    }
    expect((await getPortalUser())!.attendanceOnly).toEqual(['5th-6th-girls', '7th-8th-girls'])
  })

  // "Coords and asst coords have FULL accessibility" to the other class of a
  // 5th & 6th or 7th & 8th pair (2026-11-01): it is one of their classes,
  // with the title they hold in theirs. Plain servants keep its register only.
  it('a pair’s Coordinator or Assistant Coordinator has the other class as their own, with the same title', async () => {
    world.account = {
      id: 'acc-1',
      role: 'SERVANT',
      displayName: 'A Servant',
      photo: null,
      isActive: true,
      student: null,
      servant: {
        id: 'sv-1',
        stageOversight: null,
        classes: [
          { classId: '5th-6th-boys', title: 'COORDINATOR', class: { stage: 'MIDDLE_SCHOOL', attendancePartnerId: '5th-6th-girls', attendancePartnerOf: [] } },
          { classId: '7th-8th-boys', title: 'ASSISTANT_COORDINATOR', class: { stage: 'MIDDLE_SCHOOL', attendancePartnerId: null, attendancePartnerOf: [{ id: '7th-8th-girls' }] } },
          // Serving a paired class without a title: its partner's register, nothing more.
          { classId: 'hs-boys', title: null, class: { stage: 'HIGH_SCHOOL', attendancePartnerId: 'hs-girls', attendancePartnerOf: [] } },
        ],
      },
    }
    const user = (await getPortalUser())!
    expect(user.classIds).toEqual(['5th-6th-boys', '7th-8th-boys', 'hs-boys', '5th-6th-girls', '7th-8th-girls'])
    expect(user.coordinatorOf).toEqual(['5th-6th-boys', '5th-6th-girls'])
    expect(user.assistantOf).toEqual(['7th-8th-boys', '7th-8th-girls'])
    expect(user.attendanceOnly).toEqual(['hs-girls'])
  })

  it('where they already serve the other class, their title there stands', async () => {
    const servantIn = (classes: unknown[]) => ({
      id: 'acc-1', role: 'SERVANT', displayName: 'A Servant', photo: null, isActive: true, student: null,
      servant: { id: 'sv-1', stageOversight: null, classes },
    })
    const boys = { stage: 'MIDDLE_SCHOOL', attendancePartnerId: '7th-8th-girls', attendancePartnerOf: [{ id: '7th-8th-girls' }] }
    const girls = { stage: 'MIDDLE_SCHOOL', attendancePartnerId: '7th-8th-boys', attendancePartnerOf: [{ id: '7th-8th-boys' }] }

    // Assistant Coordinator of the boys and Coordinator of the girls: no promotion either way.
    world.account = servantIn([
      { classId: '7th-8th-boys', title: 'ASSISTANT_COORDINATOR', class: boys },
      { classId: '7th-8th-girls', title: 'COORDINATOR', class: girls },
    ])
    let user = (await getPortalUser())!
    expect([user.classIds, user.coordinatorOf, user.assistantOf, user.attendanceOnly]).toEqual([
      ['7th-8th-boys', '7th-8th-girls'], ['7th-8th-girls'], ['7th-8th-boys'], [],
    ])

    // Coordinator of the boys who the admin made a plain servant of the girls.
    world.account = servantIn([
      { classId: '7th-8th-boys', title: 'COORDINATOR', class: boys },
      { classId: '7th-8th-girls', title: null, class: girls },
    ])
    user = (await getPortalUser())!
    expect([user.classIds, user.coordinatorOf, user.assistantOf]).toEqual([['7th-8th-boys', '7th-8th-girls'], ['7th-8th-boys'], []])
  })
})
