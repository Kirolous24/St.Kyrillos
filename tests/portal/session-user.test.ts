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

  it('a Coordinator or Assistant Coordinator may also post exams to their class’s partner (2026-10-26)', async () => {
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
          // Serving a paired class without a title: its partner's register, no exams.
          { classId: 'hs-boys', title: null, class: { stage: 'HIGH_SCHOOL', attendancePartnerId: 'hs-girls', attendancePartnerOf: [] } },
        ],
      },
    }
    const user = (await getPortalUser())!
    expect(user.examPostOnly).toEqual(['5th-6th-girls', '7th-8th-girls'])
    expect(user.attendanceOnly).toEqual(['5th-6th-girls', '7th-8th-girls', 'hs-girls'])
  })
})
