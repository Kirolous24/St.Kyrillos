import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The Coptic day on the website (found 2026-11-01): two pages built at once
 * both miss the cache, both fetch the day and both write it, and the second
 * write is refused as a duplicate. That refusal used to land in the same catch
 * as a failed fetch, so the page got an empty day — no readings, no
 * synaxarium, no feasts — until its next refresh. A cache that cannot be
 * written must never cost the visitor the day. Stand-ins: the database and
 * coptic.io.
 */
const world = vi.hoisted(() => ({ writeError: null as unknown }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    copticDayCache: {
      findUnique: async () => null,
      upsert: async () => {
        if (world.writeError) throw world.writeError
        return {}
      },
    },
  },
}))

import { getCopticDayData } from '@/lib/coptic-api'

const day = {
  Pauline: [{ bookName: 'Romans', chapters: [{ chapterNum: 1, verses: [{ num: 1, text: 'Paul, a servant' }, { num: 3, text: 'concerning His Son' }] }] }],
  Synaxarium: [{ name: 'A saint of the day' }],
  season: 'Nativity Fast',
  seasonDay: '10',
  fullDate: { dateString: 'Hatour 25, 1743' },
}

let errors: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  world.writeError = null
  vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(String(url).includes('/readings/') ? day : [])))
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  errors.mockRestore()
})

describe('getCopticDayData when the cache write is refused', () => {
  it('a duplicate write (another page cached the day first) still gives the day, quietly', async () => {
    world.writeError = Object.assign(new Error('Unique constraint failed on the fields: (`date`)'), { code: 'P2002' })
    const got = await getCopticDayData('2026-11-04')
    expect(got.copticDate).toBe('Hatour 25, 1743')
    expect(got.readings.map((r) => r.reference)).toEqual(['Romans 1:1-3'])
    expect(got.synaxarium).toHaveLength(1)
    expect(got.isFasting).toBe(true)
    expect(errors).not.toHaveBeenCalled()
  })

  it('any other failed write still gives the day, and is logged', async () => {
    world.writeError = new Error('connection reset')
    const got = await getCopticDayData('2026-11-04')
    expect(got.copticDate).toBe('Hatour 25, 1743')
    expect(errors).toHaveBeenCalledTimes(1)
  })

  it('a day that is written normally comes back as fetched', async () => {
    const got = await getCopticDayData('2026-11-04')
    expect(got.copticDate).toBe('Hatour 25, 1743')
    expect(errors).not.toHaveBeenCalled()
  })
})
