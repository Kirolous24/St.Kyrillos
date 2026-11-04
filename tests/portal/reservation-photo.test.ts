import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * A van's picture (2026-11-02): the servant who asked for van reservations
 * offered pictures of the vans. The admin sets one, like a class photo.
 */

const world = vi.hoisted(() => ({
  role: 'ADMIN' as string,
  photos: new Map<string, string | null>([['black-van', null]]),
  audits: [] as string[],
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }))
vi.mock('@/lib/portal/audit', () => ({ audit: async (_u: unknown, _a: string, _t: string, _id: string, text: string) => { world.audits.push(text) } }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({ accountId: 'acc-1', role: world.role, displayName: 'Someone', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    reservationItem: {
      findUnique: async (args: { where: { id: string } }) => (world.photos.has(args.where.id) ? { id: args.where.id, name: 'Black Van' } : null),
      update: async (args: { where: { id: string }; data: { photo: string | null } }) => {
        world.photos.set(args.where.id, args.data.photo)
        return {}
      },
    },
  },
}))

import { removeReservationItemPhoto, setReservationItemPhoto } from '@/lib/portal/actions/photos'

const JPEG = `data:image/jpeg;base64,${'A'.repeat(64)}`

beforeEach(() => {
  world.role = 'ADMIN'
  world.photos = new Map([['black-van', null]])
  world.audits = []
})

describe('a van’s picture', () => {
  it('is set and removed by the admin', async () => {
    expect(await setReservationItemPhoto('black-van', JPEG)).toEqual({ ok: true, data: undefined })
    expect(world.photos.get('black-van')).toBe(JPEG)
    expect(world.audits).toEqual(['Updated the picture of the Black Van'])
    expect((await removeReservationItemPhoto('black-van')).ok).toBe(true)
    expect(world.photos.get('black-van')).toBeNull()
  })

  it('is the admin’s alone', async () => {
    world.role = 'SERVANT'
    expect(await setReservationItemPhoto('black-van', JPEG)).toEqual({ ok: false, error: 'Only the Sunday School admin can change the vans.' })
    expect(await removeReservationItemPhoto('black-van')).toEqual({ ok: false, error: 'Only the Sunday School admin can change the vans.' })
    expect(world.photos.get('black-van')).toBeNull()
  })

  it('takes only a picture, for a van that is there', async () => {
    expect(await setReservationItemPhoto('black-van', 'not a picture at all, just words')).toEqual({ ok: false, error: 'Only JPEG or PNG images can be used.' })
    expect(await setReservationItemPhoto('gone-van', JPEG)).toEqual({ ok: false, error: 'That van is no longer there.' })
  })
})
