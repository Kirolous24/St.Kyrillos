import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The address a calendar app fetches (2026-10-19). Phones fetch it over and
 * over, so the website's cache answers most of them: each fetch that reaches
 * the database can wake it, and the free plan's compute is limited.
 */
const world = vi.hoisted(() => ({ asked: [] as string[], calendars: {} as Record<string, string>, fail: false }))
vi.mock('@/lib/portal/data/birthday-calendar', () => ({
  birthdayCalendarFor: async (token: string) => {
    world.asked.push(token)
    if (world.fail) throw new Error('database asleep')
    return world.calendars[token] ?? null
  },
}))

import { GET } from '@/app/api/portal-calendar/[file]/route'

const TOKEN = 'Abc123_-'.repeat(4)
const call = (file: string) => GET(new Request(`https://www.stkyrillostn.org/api/portal-calendar/${file}`), { params: { file } })

beforeEach(() => {
  world.asked = []
  world.calendars = { [TOKEN]: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' }
  world.fail = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the birthday calendar address', () => {
  it('answers the calendar for a known link, cached by the website for half a day', async () => {
    const res = await call(`${TOKEN}.ics`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=43200, stale-while-revalidate=43200')
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    expect(await res.text()).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')
    expect(world.asked).toEqual([TOKEN])
  })

  it('accepts the link with or without .ics on the end', async () => {
    expect((await call(TOKEN)).status).toBe(200)
  })

  it('turns away anything not shaped like a link without asking the database', async () => {
    for (const file of ['nope.ics', `${TOKEN}x.ics`, '../etc.ics', `${TOKEN}.txt`]) expect((await call(file)).status).toBe(404)
    expect(world.asked).toEqual([])
  })

  it('answers 404 for a link that was reset or never existed, and caches that too', async () => {
    const res = await call(`${'z'.repeat(32)}.ics`)
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600')
  })

  it('answers 503 uncached when the database fails, so the phone keeps what it has and tries again', async () => {
    world.fail = true
    const res = await call(`${TOKEN}.ics`)
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
