import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The daily reminder job's door (2026-10-19): only Vercel's scheduler, which
 * sends the cron secret, may run it. A missing secret must never let
 * "Bearer undefined" in.
 */
const world = vi.hoisted(() => ({ runs: 0 }))
vi.mock('@/lib/portal/data/reminders', () => ({
  sendTomorrowReminders: async () => {
    world.runs++
    return { date: '2026-10-25', servants: 2, stored: 2, pushed: 1, emailed: 1, pruned: 0 }
  },
}))

import { GET } from '@/app/api/portal-reminders/cron/route'

const call = (auth?: string) => GET(new Request('https://stkyrillostn.org/api/portal-reminders/cron', { headers: auth ? { authorization: auth } : {} }))

beforeEach(() => {
  world.runs = 0
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
    expect(await res.json()).toEqual({ date: '2026-10-25', servants: 2, stored: 2, pushed: 1, emailed: 1, pruned: 0 })
    expect(world.runs).toBe(1)
  })
})
