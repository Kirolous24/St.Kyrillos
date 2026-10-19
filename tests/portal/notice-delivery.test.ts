import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Delivering servant notices (2026-10-19): each notice is stored for the bell,
 * pushed to every phone the servant turned notifications on, and emailed only
 * when none is on. Nothing outside the live site reaches a real servant, and
 * nothing here may break the save that caused it. Stand-ins: the database, the
 * push sender and Resend.
 */
type Sub = { id: string; endpoint: string; p256dh: string; auth: string }
const world = vi.hoisted(() => ({
  servants: [] as Array<{
    id: string
    account: { id: string; isActive: boolean; email: string | null; noticeEmails: boolean; pushSubscriptions: Sub[] }
  }>,
  subsQuery: null as null | Record<string, unknown>,
  notices: [] as Array<Record<string, unknown>>,
  duplicate: false,
  push: [] as Array<{ endpoint: string; payload: Record<string, unknown> }>,
  pushResult: 'sent' as 'sent' | 'gone' | 'failed' | 'throw',
  deletedSubs: [] as string[],
  touchedSubs: [] as string[],
  emails: [] as Array<Record<string, unknown>>,
  batches: 0,
  singleSends: 0,
  inflight: 0,
  maxInflight: 0,
  pushDelay: 0,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servant: {
      findMany: async (args: { select: { account: { select: { pushSubscriptions: Record<string, unknown> } } } }) => {
        world.subsQuery = args.select.account.select.pushSubscriptions
        return world.servants
      },
    },
    notice: {
      create: async (args: { data: Record<string, unknown> }) => {
        if (world.duplicate) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
        world.notices.push(args.data)
        return { id: `n${world.notices.length}` }
      },
    },
    pushSubscription: {
      delete: async (args: { where: { id: string } }) => {
        world.deletedSubs.push(args.where.id)
        return {}
      },
      update: async (args: { where: { id: string } }) => {
        world.touchedSubs.push(args.where.id)
        return {}
      },
    },
  },
}))
vi.mock('@/lib/portal/web-push', () => ({
  pushConfigured: (env: Record<string, string | undefined>) => !!env.WEB_PUSH_PUBLIC_KEY && !!env.WEB_PUSH_PRIVATE_KEY,
  sendPush: async (sub: Sub, payload: Record<string, unknown>) => {
    world.push.push({ endpoint: sub.endpoint, payload })
    world.inflight++
    world.maxInflight = Math.max(world.maxInflight, world.inflight)
    await new Promise((r) => setTimeout(r, world.pushDelay))
    world.inflight--
    if (world.pushResult === 'throw') throw new Error('socket hang up')
    return world.pushResult
  },
}))
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (args: Record<string, unknown>) => {
        world.singleSends++
        world.emails.push(args)
        return { data: { id: 'e1' }, error: null }
      },
    }
    batch = {
      send: async (payloads: Array<Record<string, unknown>>) => {
        world.batches++
        world.emails.push(...payloads)
        return { data: { data: payloads.map((_, i) => ({ id: `e${i}` })) }, error: null }
      },
    }
  },
}))

import { deliverNotices, type OutgoingNotice } from '@/lib/portal/notice-delivery'

const LIVE = { VERCEL_ENV: 'production', RESEND_API_KEY: 'k', WEB_PUSH_PUBLIC_KEY: 'pub', WEB_PUSH_PRIVATE_KEY: 'priv' }
const DEV = { DATABASE_URL: 'postgresql://u:p@dev-branch.example/db', RESEND_API_KEY: 'k', WEB_PUSH_PUBLIC_KEY: 'pub', WEB_PUSH_PRIVATE_KEY: 'priv' }

const notice = (over: Partial<OutgoingNotice> = {}): OutgoingNotice => ({
  servantId: 'sv-mina',
  kind: 'assigned',
  title: 'New assignment',
  body: 'You’re on Coptic for Sunday, Oct 25 · 5th & 6th Boys',
  href: '/portal/assignments#week-2026-10-19',
  dedupeKey: 'assigned:sv-mina:1',
  ...over,
})
const sub = (id: string): Sub => ({ id, endpoint: `https://push.example/${id}`, p256dh: 'p', auth: 'a' })
const servant = (subs: Sub[], over: Partial<(typeof world.servants)[number]['account']> = {}) => ({
  id: 'sv-mina',
  account: { id: 'acc-mina', isActive: true, email: 'mina@example.com', noticeEmails: true, pushSubscriptions: subs, ...over },
})

beforeEach(() => {
  world.servants = []
  world.subsQuery = null
  world.notices = []
  world.duplicate = false
  world.push = []
  world.pushResult = 'sent'
  world.deletedSubs = []
  world.touchedSubs = []
  world.emails = []
  world.batches = 0
  world.singleSends = 0
  world.inflight = 0
  world.maxInflight = 0
  world.pushDelay = 0
})

describe('deliverNotices', () => {
  it('stores the notice and pushes it to every live phone', async () => {
    world.servants = [servant([sub('s1'), sub('s2')])]
    const r = await deliverNotices([notice()], LIVE)
    expect(r).toEqual({ stored: 1, pushed: 1, emailed: 0, skipped: 0 })
    expect(world.notices).toEqual([
      {
        accountId: 'acc-mina',
        kind: 'assigned',
        title: 'New assignment',
        body: 'You’re on Coptic for Sunday, Oct 25 · 5th & 6th Boys',
        href: '/portal/assignments#week-2026-10-19',
        dedupeKey: 'assigned:sv-mina:1',
      },
    ])
    expect(world.push.map((p) => p.endpoint)).toEqual(['https://push.example/s1', 'https://push.example/s2'])
    expect(world.push[0]!.payload).toMatchObject({ title: 'New assignment', href: '/portal/assignments#week-2026-10-19' })
    expect(world.touchedSubs).toEqual(['s1', 's2'])
    // Only the phones the live site registered.
    expect(world.subsQuery).toMatchObject({ where: { live: true } })
  })

  it('forgets a phone the push service says is gone, then emails', async () => {
    world.servants = [servant([sub('s1')])]
    world.pushResult = 'gone'
    const r = await deliverNotices([notice()], LIVE)
    expect(world.deletedSubs).toEqual(['s1'])
    expect(r).toMatchObject({ pushed: 0, emailed: 1 })
  })

  it('emails when no phone has notifications on, with the link and the way to stop them', async () => {
    world.servants = [servant([])]
    await deliverNotices([notice()], LIVE)
    expect(world.emails).toHaveLength(1)
    const email = world.emails[0]!
    expect(email).toMatchObject({ to: 'mina@example.com', subject: 'New assignment', from: 'St. Kyrillos Sunday School <noreply@stkyrillostn.org>' })
    expect(String(email.text)).toContain('You’re on Coptic for Sunday, Oct 25 · 5th & 6th Boys')
    expect(String(email.text)).toContain('https://stkyrillostn.org/portal/assignments#week-2026-10-19')
    expect(String(email.text)).toContain('https://stkyrillostn.org/portal/settings')
  })

  it('outside production, no email to real addresses', async () => {
    world.servants = [servant([])]
    await deliverNotices([notice()], DEV)
    expect(world.emails).toEqual([])
    await deliverNotices([notice({ dedupeKey: 'assigned:sv-mina:2' })], { ...DEV, PORTAL_EMAIL_REDIRECT: 'tester@example.com' })
    expect(world.emails).toEqual([expect.objectContaining({ to: 'tester@example.com', subject: '[TEST for mina@example.com] New assignment' })])
  })

  it('a production subscription is not pushed from dev', async () => {
    world.servants = [servant([])] // the query asked only for this site's phones
    await deliverNotices([notice()], DEV)
    expect(world.subsQuery).toMatchObject({ where: { live: false } })
    expect(world.push).toEqual([])
  })

  it('a duplicate dedupeKey is not stored or sent again', async () => {
    world.servants = [servant([sub('s1')])]
    world.duplicate = true
    const r = await deliverNotices([notice({ kind: 'reminder', dedupeKey: 'reminder:sv-mina:2026-10-25' })], LIVE)
    expect(r).toEqual({ stored: 0, pushed: 0, emailed: 0, skipped: 1 })
    expect(world.push).toEqual([])
    expect(world.emails).toEqual([])
  })

  it('inactive or missing accounts get nothing', async () => {
    world.servants = [servant([sub('s1')], { isActive: false })]
    const r = await deliverNotices([notice(), notice({ servantId: 'sv-gone', dedupeKey: 'x' })], LIVE)
    expect(r).toEqual({ stored: 0, pushed: 0, emailed: 0, skipped: 2 })
    expect(world.notices).toEqual([])
  })

  it('a push that throws never rejects', async () => {
    world.servants = [servant([sub('s1')])]
    world.pushResult = 'throw'
    const r = await deliverNotices([notice()], LIVE)
    // The phone is still on (only "gone" forgets it), so no email either.
    expect(r).toEqual({ stored: 1, pushed: 0, emailed: 0, skipped: 0 })
  })

  it('without push keys, phones do not count and email takes over', async () => {
    world.servants = [servant([sub('s1')])]
    const r = await deliverNotices([notice()], { VERCEL_ENV: 'production', RESEND_API_KEY: 'k' })
    expect(world.push).toEqual([])
    expect(r).toMatchObject({ emailed: 1 })
  })

  it('a servant who turned email off is not emailed', async () => {
    world.servants = [servant([], { noticeEmails: false })]
    await deliverNotices([notice()], LIVE)
    expect(world.emails).toEqual([])
  })
})

describe('deliverNotices at scale (a term imported at once, a busy Saturday evening)', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `sv-${i}`,
      account: { id: `acc-${i}`, isActive: true, email: `s${i}@example.com`, noticeEmails: true, pushSubscriptions: [] as Sub[] },
    }))

  it('sends the emails in one batch, not one call per servant', async () => {
    world.servants = many(3)
    const r = await deliverNotices(world.servants.map((s, i) => notice({ servantId: s.id, dedupeKey: `k${i}` })), LIVE)
    expect(r.emailed).toBe(3)
    expect(world.batches).toBe(1)
    expect(world.singleSends).toBe(0)
    expect(world.emails.map((e) => e.to)).toEqual(['s0@example.com', 's1@example.com', 's2@example.com'])
  })

  it('reaches several servants’ phones side by side', async () => {
    world.servants = many(4).map((s, i) => ({ ...s, account: { ...s.account, pushSubscriptions: [sub(`p${i}`)] } }))
    world.pushDelay = 20
    const r = await deliverNotices(world.servants.map((s, i) => notice({ servantId: s.id, dedupeKey: `k${i}` })), LIVE)
    expect(r.pushed).toBe(4)
    expect(world.maxInflight).toBeGreaterThan(1)
  })
})
