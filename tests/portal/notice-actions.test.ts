import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * A servant's notification settings (2026-10-19): the phones that asked for
 * notifications, whether to be emailed, and a test. Stand-ins: the signed-in
 * person, the database, and delivery.
 */
const world = vi.hoisted(() => ({
  user: {
    accountId: 'acc-mina', role: 'SERVANT', displayName: 'Mina', servantId: 'sv-mina' as string | undefined,
    classIds: ['kg'], coordinatorOf: [] as string[], assistantOf: [] as string[], stageOversight: null,
  },
  upserts: [] as Array<Record<string, unknown>>,
  deletes: [] as Array<Record<string, unknown>>,
  accountUpdates: [] as Array<Record<string, unknown>>,
  delivered: [] as Array<Record<string, unknown>>,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/session', () => ({ requirePortalUser: async () => world.user }))
vi.mock('@/lib/portal/notice-delivery', () => ({
  deliverNotices: async (notices: Array<Record<string, unknown>>) => {
    world.delivered.push(...notices)
    return { stored: 1, pushed: 1, emailed: 0, skipped: 0 }
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      upsert: async (args: Record<string, unknown>) => {
        world.upserts.push(args)
        return {}
      },
      deleteMany: async (args: Record<string, unknown>) => {
        world.deletes.push(args)
        return { count: 1 }
      },
    },
    account: {
      update: async (args: Record<string, unknown>) => {
        world.accountUpdates.push(args)
        return {}
      },
    },
  },
}))

import { removePushSubscription, savePushSubscription, sendTestNotice, setNoticeEmails } from '@/lib/portal/actions/notices'

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'BPkey', auth: 'authkey' }, userAgent: 'Pixel' }

beforeEach(() => {
  world.user = { ...world.user, role: 'SERVANT', servantId: 'sv-mina' }
  world.upserts = []
  world.deletes = []
  world.accountUpdates = []
  world.delivered = []
  vi.unstubAllEnvs()
})

describe('savePushSubscription', () => {
  it('keeps the phone for whoever is signed in, and says which kind of site saved it', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(await savePushSubscription(SUB)).toEqual({ ok: true, data: undefined })
    expect(world.upserts).toEqual([
      {
        where: { endpoint: SUB.endpoint },
        create: { accountId: 'acc-mina', endpoint: SUB.endpoint, p256dh: 'BPkey', auth: 'authkey', live: true, userAgent: 'Pixel' },
        // A browser now signed in as someone else moves to them.
        update: { accountId: 'acc-mina', p256dh: 'BPkey', auth: 'authkey', live: true, userAgent: 'Pixel' },
      },
    ])
  })

  it('refuses an address that is not secure', async () => {
    expect(await savePushSubscription({ ...SUB, endpoint: 'http://push.example/abc' })).toEqual({ ok: false, error: 'That notification address is not a secure one.' })
    expect(world.upserts).toEqual([])
  })

  it('only takes the browsers’ own push services', async () => {
    expect(await savePushSubscription({ ...SUB, endpoint: 'https://collector.example/abc' })).toEqual({
      ok: false,
      error: 'That is not a notification service this portal knows.',
    })
    expect(world.upserts).toEqual([])
    for (const endpoint of [
      'https://web.push.apple.com/QGuQyavXutnMH',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
      'https://fcm.googleapis.com/fcm/send/abc123',
    ]) {
      expect((await savePushSubscription({ ...SUB, endpoint })).ok).toBe(true)
    }
  })

  it('a student cannot subscribe', async () => {
    world.user = { ...world.user, role: 'STUDENT', servantId: undefined }
    expect((await savePushSubscription(SUB)).ok).toBe(false)
    expect(world.upserts).toEqual([])
  })
})

describe('removePushSubscription', () => {
  it('only touches your own', async () => {
    expect((await removePushSubscription(SUB.endpoint)).ok).toBe(true)
    expect(world.deletes).toEqual([{ where: { endpoint: SUB.endpoint, accountId: 'acc-mina' } }])
  })
})

describe('setNoticeEmails', () => {
  it('stores the choice', async () => {
    expect((await setNoticeEmails(false)).ok).toBe(true)
    expect(world.accountUpdates).toEqual([{ where: { id: 'acc-mina' }, data: { noticeEmails: false } }])
  })
})

describe('sendTestNotice', () => {
  it('sends one test notice to the servant, and says where it went', async () => {
    expect(await sendTestNotice()).toEqual({ ok: true, data: { pushed: 1, emailed: 0 } })
    expect(world.delivered).toEqual([
      expect.objectContaining({ servantId: 'sv-mina', kind: 'test', title: 'Test notification', body: 'Notifications are working.', href: '/portal/settings' }),
    ])
  })

  it('needs a servant', async () => {
    world.user = { ...world.user, servantId: undefined }
    expect((await sendTestNotice()).ok).toBe(false)
  })
})
