import { describe, it, expect, vi, beforeEach } from 'vitest'

// The website's Home and Schedule pages are built once and reused, so the daily
// job is what moves them on to a new day. These tests stand in for the Coptic
// calendar and the weekly-services writer and record which pages the job asks
// Next.js to rebuild.
const state = vi.hoisted(() => {
  process.env.CRON_SECRET = 'test-secret'
  return { rebuilt: [] as string[], created: 0 }
})

vi.mock('next/cache', () => ({ revalidatePath: (path: string) => { state.rebuilt.push(path) } }))
vi.mock('@/lib/coptic-api', () => ({ getCopticDayDataBatch: async () => ({ '2026-10-04': {} }) }))
vi.mock('@/lib/weekly-services-materialize', () => ({
  materializeWeeklyServices: async () => ({ created: state.created, skipped: 0 }),
}))

import { GET } from '@/app/api/coptic/cron/route'

const run = (authorization = 'Bearer test-secret') =>
  GET(new Request('http://localhost/api/coptic/cron', { headers: { authorization } }))

describe('daily Coptic job', () => {
  beforeEach(() => {
    state.rebuilt = []
    state.created = 0
  })

  it('rebuilds the Home and Schedule pages every day, even when it added no events', async () => {
    const res = await run()
    expect(res.status).toBe(200)
    expect(state.rebuilt).toEqual(expect.arrayContaining(['/', '/schedule']))
  })

  it('rebuilds them when it added events', async () => {
    state.created = 3
    await run()
    expect(state.rebuilt).toEqual(expect.arrayContaining(['/', '/schedule']))
  })

  it('a call without the cron secret rebuilds nothing', async () => {
    const res = await run('Bearer wrong')
    expect(res.status).toBe(401)
    expect(state.rebuilt).toEqual([])
  })
})
