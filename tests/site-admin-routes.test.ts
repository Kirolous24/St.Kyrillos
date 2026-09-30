import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The website-admin API routes answer only the three website admins (session
// kind 'site'). Portal logins, children's included, come from the same
// NextAuth, and middleware.ts guards /admin and /portal pages but never /api,
// so each route has to check the kind itself.
//
// Stand-ins: the session under test, a database that records every call and a
// network that records every request, so a refusal is shown to touch nothing.
const world = vi.hoisted(() => {
  process.env.CRON_SECRET = 'test-cron-secret'
  return { session: null as unknown, calls: [] as string[] }
})

vi.mock('@/lib/auth', () => ({ auth: async () => world.session }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/prisma', () => {
  // Lookups find nothing; lists are empty; writes hand back an empty row.
  const results: Record<string, unknown> = {
    findUnique: null, findFirst: null, findMany: [], count: 0,
    deleteMany: { count: 0 }, createMany: { count: 0 }, updateMany: { count: 0 },
  }
  const record = (name: string) => async () => {
    world.calls.push(name)
    const method = name.split('.').pop()!
    return method in results ? results[method] : {}
  }
  const model = (m: string) => new Proxy({}, { get: (_t, method) => record(`${m}.${String(method)}`) })
  return { prisma: new Proxy({}, { get: (_t, name) => (String(name).startsWith('$') ? record(String(name)) : model(String(name))) }) }
})

const CHILD = { user: { name: 'A Student', kind: 'portal', role: 'STUDENT', accountId: 'acc-child' } }
// The portal's own admin is not a website admin either, even one named like
// the website login that may clear the activity log.
const PORTAL_ADMIN = { user: { name: 'Kirolous', kind: 'portal', role: 'ADMIN', accountId: 'acc-admin' } }
const WEBSITE_ADMIN = { user: { name: 'Kirolous', kind: 'site' } }

const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const byId = { params: { id: 'some-id' } }

type Handler = (...args: unknown[]) => Promise<Response>
const ENDPOINTS: [string, () => Promise<Record<string, unknown>>, string, () => unknown[]][] = [
  ['GET /api/settings', () => import('@/app/api/settings/route'), 'GET', () => [req('GET', '/api/settings?key=autoFillWeeklyServices')]],
  ['PUT /api/settings', () => import('@/app/api/settings/route'), 'PUT', () => [req('PUT', '/api/settings', { key: 'autoFillWeeklyServices', value: 'false' })]],
  ['POST /api/schedule', () => import('@/app/api/schedule/route'), 'POST', () => [req('POST', '/api/schedule', {})]],
  ['PUT /api/schedule/[id]', () => import('@/app/api/schedule/[id]/route'), 'PUT', () => [req('PUT', '/api/schedule/some-id', {}), byId]],
  ['DELETE /api/schedule/[id]', () => import('@/app/api/schedule/[id]/route'), 'DELETE', () => [req('DELETE', '/api/schedule/some-id'), byId]],
  ['POST /api/schedule/batch', () => import('@/app/api/schedule/batch/route'), 'POST', () => [req('POST', '/api/schedule/batch', {})]],
  ['POST /api/schedule/clear', () => import('@/app/api/schedule/clear/route'), 'POST', () => [req('POST', '/api/schedule/clear', {})]],
  ['POST /api/schedule/materialize', () => import('@/app/api/schedule/materialize/route'), 'POST', () => [req('POST', '/api/schedule/materialize')]],
  ['GET /api/templates', () => import('@/app/api/templates/route'), 'GET', () => [req('GET', '/api/templates')]],
  ['POST /api/templates', () => import('@/app/api/templates/route'), 'POST', () => [req('POST', '/api/templates', {})]],
  ['PUT /api/templates/[id]', () => import('@/app/api/templates/[id]/route'), 'PUT', () => [req('PUT', '/api/templates/some-id', {}), byId]],
  ['DELETE /api/templates/[id]', () => import('@/app/api/templates/[id]/route'), 'DELETE', () => [req('DELETE', '/api/templates/some-id'), byId]],
  ['GET /api/weekly-services', () => import('@/app/api/weekly-services/route'), 'GET', () => [req('GET', '/api/weekly-services')]],
  ['POST /api/weekly-services', () => import('@/app/api/weekly-services/route'), 'POST', () => [req('POST', '/api/weekly-services', {})]],
  ['PUT /api/weekly-services/[id]', () => import('@/app/api/weekly-services/[id]/route'), 'PUT', () => [req('PUT', '/api/weekly-services/some-id', {}), byId]],
  ['DELETE /api/weekly-services/[id]', () => import('@/app/api/weekly-services/[id]/route'), 'DELETE', () => [req('DELETE', '/api/weekly-services/some-id'), byId]],
  ['DELETE /api/activity-logs', () => import('@/app/api/activity-logs/route'), 'DELETE', () => [req('DELETE', '/api/activity-logs')]],
  // Renews the YouTube hub subscription; the daily job has its own copy.
  ['POST /api/youtube-webhook/subscribe', () => import('@/app/api/youtube-webhook/subscribe/route'), 'POST', () => [req('POST', '/api/youtube-webhook/subscribe')]],
]

async function call(load: () => Promise<Record<string, unknown>>, method: string, args: unknown[]) {
  return ((await load())[method] as Handler)(...args)
}

describe('website-admin API routes', () => {
  beforeEach(() => {
    world.calls = []
    vi.stubGlobal('fetch', async (url: unknown) => {
      world.calls.push(`fetch ${String(url)}`)
      return new Response('')
    })
  })

  describe.each([
    ["a child's portal login", CHILD],
    ["the portal's admin login", PORTAL_ADMIN],
    ['nobody signed in', null],
  ])('turn away %s without touching the database', (_who, session) => {
    it.each(ENDPOINTS)('%s', async (_label, load, method, args) => {
      world.session = session
      const res = await call(load, method, args())
      expect(res.status).toBe(401)
      expect(world.calls).toEqual([])
    })
  })

  // Guards the other direction: a website admin must still get past the check
  // on every route. What the route then answers is its own business.
  it.each(ENDPOINTS)('let a website admin through: %s', async (_label, load, method, args) => {
    world.session = WEBSITE_ADMIN
    const res = await call(load, method, args())
    expect(res.status).not.toBe(401)
  })

  it('let only the Kirolous website login clear the activity log', async () => {
    const { DELETE } = await import('@/app/api/activity-logs/route')
    world.session = { user: { name: 'Fr. Pachom', kind: 'site' } }
    expect((await DELETE()).status).toBe(401)
    world.session = WEBSITE_ADMIN
    expect((await DELETE()).status).toBe(200)
    expect(world.calls).toEqual(['activityLog.deleteMany'])
  })

  it.each([
    ['POST /api/schedule/materialize', () => import('@/app/api/schedule/materialize/route')],
    ['POST /api/youtube-webhook/subscribe', () => import('@/app/api/youtube-webhook/subscribe/route')],
  ])("let the daily job's secret through with nobody signed in: %s", async (label, load) => {
    world.session = null
    const path = label.split(' ')[1]
    const res = await call(load, 'POST', [req('POST', path, undefined, { authorization: 'Bearer test-cron-secret' })])
    expect(res.status).not.toBe(401)
  })
})
