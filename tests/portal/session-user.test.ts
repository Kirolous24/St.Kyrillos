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
})
