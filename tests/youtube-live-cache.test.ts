import { describe, it, expect, vi, beforeEach } from 'vitest'

// The route keeps its state in one database row and asks YouTube only when
// that row is old. These tests stand in for both, so no database or network is
// touched: each test sets the row, calls the route, and reads the answer's
// Cache-Control, which is what Vercel's CDN obeys.
const db = vi.hoisted(() => {
  process.env.YOUTUBE_API_KEY = 'test-key'
  return { row: null as Record<string, unknown> | null }
})

vi.mock('@/lib/prisma', () => {
  const write = (data: Record<string, unknown>) => (db.row = { ...db.row, ...data, updatedAt: new Date() })
  return {
    prisma: {
      livestreamStatus: {
        findUnique: async () => db.row,
        update: async ({ data }: { data: Record<string, unknown> }) => write(data),
        upsert: async ({ update }: { update: Record<string, unknown> }) => write(update),
      },
    },
  }
})

import { GET } from '@/app/api/youtube-live/route'

const LIVE_ON_YOUTUBE = {
  items: [{
    id: { videoId: 'found-by-search' },
    snippet: { title: 'Divine Liturgy', thumbnails: { high: { url: 'https://i.ytimg.com/vi/found-by-search/hqdefault_live.jpg' } } },
  }],
}

function cacheOf(res: Response) {
  const header = res.headers.get('cache-control') ?? ''
  const seconds = (name: string) => {
    const m = header.match(new RegExp(`(?:^|[,\\s])${name}=(\\d+)`))
    return m ? Number(m[1]) : null
  }
  return { header, fresh: seconds('s-maxage'), stale: seconds('stale-while-revalidate') }
}

/**
 * The longest the CDN may keep handing out one answer. An answer without
 * s-maxage is not shared at all. One with s-maxage but no stale-while-revalidate
 * states no limit on serving it stale, so it counts as unbounded.
 */
function longestServed({ fresh, stale }: ReturnType<typeof cacheOf>) {
  if (fresh === null) return 0
  return stale === null ? Infinity : fresh + stale
}

async function answerWhen(row: Record<string, unknown> | null, youtube: unknown = { items: [] }) {
  db.row = row
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(youtube))))
  const res = await GET()
  return { body: await res.clone().json(), cache: cacheOf(res) }
}

// Checked by the route 5 seconds ago, so it trusts the row and asks nobody.
const liveRow = () => ({ id: 'current', isLive: true, videoId: 'on-air', title: 'Divine Liturgy', updatedAt: new Date(Date.now() - 5_000) })
// Nothing stored and never searched, so the route runs the fallback search.
const neverSearchedRow = () => ({ id: 'current', isLive: false, videoId: null, lastSearchAt: null })
// Nothing stored and a search a minute ago, so it is not time to search again.
const offlineRow = () => ({ id: 'current', isLive: false, videoId: null, lastSearchAt: new Date(Date.now() - 60_000), updatedAt: new Date() })

describe('/api/youtube-live answers', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('while a stream is live, viewers share one answer for 20 seconds instead of each running the check', async () => {
    const { body, cache } = await answerWhen(liveRow())
    expect(body.isLive).toBe(true)
    expect(cache.header).toContain('public')
    expect(cache.header).not.toContain('no-store')
    expect(cache.fresh).toBe(20)
  })

  it('a stream found by the fallback search is shared the same way', async () => {
    const { body, cache } = await answerWhen(neverSearchedRow(), LIVE_ON_YOUTUBE)
    expect(body.isLive).toBe(true)
    expect(body.videoId).toBe('found-by-search')
    expect(cache.fresh).toBe(20)
  })

  // A cached "live" once stayed up for five days after the stream ended, so
  // every answer the CDN may keep also says how long it may be served stale.
  it('an ended stream disappears within 30 seconds, and no answer lasts more than a minute', async () => {
    expect(longestServed((await answerWhen(liveRow())).cache)).toBeLessThanOrEqual(30)
    expect(longestServed((await answerWhen(neverSearchedRow(), LIVE_ON_YOUTUBE)).cache)).toBeLessThanOrEqual(30)
    expect(longestServed((await answerWhen(offlineRow())).cache)).toBeLessThanOrEqual(60)
  })
})
