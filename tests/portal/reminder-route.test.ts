import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The daily reminder job's door (2026-10-19): only Vercel's scheduler, which
 * sends the cron secret, may run it. A missing secret must never let
 * "Bearer undefined" in.
 */
const world = vi.hoisted(() => ({ runs: 0, shuffles: 0, shuffleFails: false }))
vi.mock('@/lib/portal/data/reminders', () => ({
  sendDailyReminders: async () => {
    world.runs++
    return { date: '2026-10-25', servants: 2, stored: 2, pushed: 1, emailed: 1, pruned: 0 }
  },
}))
// The same daily job shuffles the follow-up groups that are due (2026-10-25).
vi.mock('@/lib/portal/data/groups', () => ({
  shuffleDueGroups: async () => {
    world.shuffles++
    if (world.shuffleFails) throw new Error('database went away')
    return { classes: 1, moved: 9 }
  },
}))

import { GET } from '@/app/api/portal-reminders/cron/route'

const call = (auth?: string) => GET(new Request('https://stkyrillostn.org/api/portal-reminders/cron', { headers: auth ? { authorization: auth } : {} }))

beforeEach(() => {
  world.runs = 0
  world.shuffles = 0
  world.shuffleFails = false
  vi.unstubAllEnvs()
})

describe('the reminder job route', () => {
  it('refuses a call without the cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(world.runs).toBe(0)
  })

  it('refuses everything when no secret is configured', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call('Bearer ')).status).toBe(401)
    expect((await call('Bearer undefined')).status).toBe(401)
    expect(world.runs).toBe(0)
  })

  it('runs and answers the report with the secret', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    const res = await call('Bearer s3cret')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      date: '2026-10-25', servants: 2, stored: 2, pushed: 1, emailed: 1, pruned: 0,
      groups: { classes: 1, moved: 9 },
    })
    expect(world.runs).toBe(1)
    expect(world.shuffles).toBe(1)
  })

  it('a shuffle that fails does not stop the reminders', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    world.shuffleFails = true
    const res = await call('Bearer s3cret')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ servants: 2, groups: { error: 'Shuffling failed' } })
    expect(world.runs).toBe(1)
  })

  it('a refused call shuffles nothing', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    await call('Bearer wrong')
    expect(world.shuffles).toBe(0)
  })
})
