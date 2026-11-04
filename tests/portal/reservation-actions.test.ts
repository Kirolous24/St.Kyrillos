import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Van reservations, server side (2026-11-02): a servant reserves a van for a
 * time, a service and the servants taking it; two reservations of one van never
 * overlap; the one who made it, the servants on it and the admin change or
 * cancel it; the admin keeps the list of vans. Stand-ins: the signed-in person,
 * the audit trail, notice delivery and a database that keeps what is written.
 */

interface Res {
  id: string
  itemId: string
  startsAt: Date
  endsAt: Date
  service: string
  note: string | null
  createdById: string | null
  servantIds: string[]
}

const world = vi.hoisted(() => ({
  user: { accountId: 'acc-me', role: 'SERVANT', displayName: 'Pat', servantId: 'sv-me' as string | undefined },
  items: new Map<string, { id: string; name: string; color: string; isActive: boolean; sortOrder: number; details: string | null; photo: string | null }>(),
  reservations: [] as Res[],
  servants: new Map<string, { name: string; active: boolean }>(),
  accounts: new Map<string, string>(),
  meetings: ['Men’s Meeting', 'Women’s Meeting', 'Youth Meeting'],
  locks: [] as string[],
  audits: [] as string[],
  delivered: [] as Array<{ servantId: string; kind: string; title: string; body: string; dedupeKey: string }>,
  nextId: 1,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }))
vi.mock('@/lib/portal/audit', () => ({ audit: async (_u: unknown, _a: string, _t: string, _id: string, text: string) => { world.audits.push(text) } }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({ ...world.user, classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null }),
}))
vi.mock('@/lib/portal/notice-delivery', () => ({
  deliverNotices: async (notices: typeof world.delivered) => {
    world.delivered.push(...notices)
    return { stored: notices.length, pushed: 0, emailed: 0, skipped: 0 }
  },
}))
vi.mock('@/lib/prisma', () => {
  const shape = (r: Res) => {
    const item = world.items.get(r.itemId)!
    return {
      ...r,
      item: { name: item.name, color: item.color },
      createdBy: r.createdById ? { displayName: world.accounts.get(r.createdById) ?? 'Someone' } : null,
      servants: r.servantIds.map((servantId) => ({
        servantId,
        servant: { id: servantId, account: { displayName: world.servants.get(servantId)?.name ?? '?' } },
      })),
    }
  }
  type ResWhere = { id?: string | { not: string }; itemId?: string; startsAt?: { lt: Date }; endsAt?: { gt: Date } }
  const matches = (r: Res, w: ResWhere) =>
    (w.id === undefined || (typeof w.id === 'string' ? r.id === w.id : r.id !== w.id.not)) &&
    (w.itemId === undefined || r.itemId === w.itemId) &&
    (w.startsAt === undefined || r.startsAt < w.startsAt.lt) &&
    (w.endsAt === undefined || r.endsAt > w.endsAt.gt)
  type ResData = { itemId: string; startsAt: Date; endsAt: Date; service: string; note: string | null; createdById?: string; servants: { create: Array<{ servantId: string }> } }
  const reservation = {
    findUnique: async (args: { where: { id: string } }) => {
      const r = world.reservations.find((x) => x.id === args.where.id)
      return r ? shape(r) : null
    },
    findFirst: async (args: { where: ResWhere }) => {
      const r = [...world.reservations].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).find((x) => matches(x, args.where))
      return r ? shape(r) : null
    },
    create: async (args: { data: ResData }) => {
      const r: Res = {
        id: `res-${world.nextId++}`,
        itemId: args.data.itemId,
        startsAt: args.data.startsAt,
        endsAt: args.data.endsAt,
        service: args.data.service,
        note: args.data.note,
        createdById: args.data.createdById ?? null,
        servantIds: args.data.servants.create.map((s) => s.servantId),
      }
      world.reservations.push(r)
      return shape(r)
    },
    update: async (args: { where: { id: string }; data: ResData }) => {
      const r = world.reservations.find((x) => x.id === args.where.id)!
      Object.assign(r, {
        itemId: args.data.itemId,
        startsAt: args.data.startsAt,
        endsAt: args.data.endsAt,
        service: args.data.service,
        note: args.data.note,
        servantIds: [...r.servantIds, ...args.data.servants.create.map((s) => s.servantId)],
      })
      return shape(r)
    },
    deleteMany: async (args: { where: { id: string } }) => {
      const before = world.reservations.length
      world.reservations = world.reservations.filter((r) => r.id !== args.where.id)
      return { count: before - world.reservations.length }
    },
    count: async (args: { where: { itemId: string } }) => world.reservations.filter((r) => r.itemId === args.where.itemId).length,
  }
  const reservationServant = {
    deleteMany: async (args: { where: { reservationId: string } }) => {
      const r = world.reservations.find((x) => x.id === args.where.reservationId)
      if (r) r.servantIds = []
      return { count: 1 }
    },
  }
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('?').includes('FOR UPDATE')) world.locks.push(String(values[0]))
      return []
    },
    reservation,
    reservationServant,
  }
  type ItemWhere = { id?: string | { not: string }; name?: { equals: string; mode: 'insensitive' } }
  const itemMatches = (i: { id: string; name: string }, w: ItemWhere) =>
    (w.id === undefined || (typeof w.id === 'string' ? i.id === w.id : i.id !== w.id.not)) &&
    (w.name === undefined || i.name.toLowerCase() === w.name.equals.toLowerCase())
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      reservation,
      reservationServant,
      reservationItem: {
        findUnique: async (args: { where: { id: string } }) => world.items.get(args.where.id) ?? null,
        findFirst: async (args: { where: ItemWhere }) => Array.from(world.items.values()).find((i) => itemMatches(i, args.where)) ?? null,
        aggregate: async () => ({ _max: { sortOrder: Math.max(-1, ...Array.from(world.items.values()).map((i) => i.sortOrder)) } }),
        create: async (args: { data: { name: string; details: string | null; color: string; sortOrder: number } }) => {
          const item = { id: `item-${world.nextId++}`, isActive: true, photo: null, ...args.data }
          world.items.set(item.id, item)
          return item
        },
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const item = world.items.get(args.where.id)!
          Object.assign(item, args.data)
          return item
        },
        delete: async (args: { where: { id: string } }) => {
          world.items.delete(args.where.id)
          return {}
        },
      },
      servant: {
        count: async (args: { where: { id: { in: string[] }; account: { isActive: boolean } } }) =>
          args.where.id.in.filter((id) => world.servants.get(id)?.active).length,
      },
      schoolClass: {
        findMany: async () => world.meetings.map((name) => ({ name })),
      },
    },
  }
})

import { cancelReservation, deleteReservationItem, saveReservation, saveReservationItem, setReservationItemActive } from '@/lib/portal/actions/reservations'

// Sunday, Nov 1 2026, noon in Antioch. Saturday Nov 7 9:00 AM is 15:00 UTC.
const NOW = new Date('2026-11-01T18:00:00.000Z')
const sat = (h: number) => new Date(Date.UTC(2026, 10, 7, h + 6))
const asServant = (servantId: string, accountId: string, displayName: string) => {
  world.user = { accountId, role: 'SERVANT', displayName, servantId }
}
const asAdmin = () => {
  world.user = { accountId: 'acc-admin', role: 'ADMIN', displayName: 'Admin', servantId: undefined }
}
const morning = { itemId: 'black-van', date: '2026-11-07', from: '09:00', until: '12:00', servantIds: ['sv-me', 'sv-a'], service: 'Youth Meeting' }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  asServant('sv-me', 'acc-me', 'Pat')
  world.items = new Map([
    ['black-van', { id: 'black-van', name: 'Black Van', color: 'black', isActive: true, sortOrder: 0, details: null, photo: null }],
    ['white-van', { id: 'white-van', name: 'White Van', color: 'white', isActive: true, sortOrder: 1, details: null, photo: null }],
  ])
  world.reservations = []
  world.servants = new Map([
    ['sv-me', { name: 'Pat E', active: true }],
    ['sv-a', { name: 'Mina S', active: true }],
    ['sv-b', { name: 'Sara M', active: true }],
    ['sv-gone', { name: 'Left Us', active: false }],
  ])
  world.accounts = new Map([['acc-me', 'Pat E'], ['acc-b', 'Sara M'], ['acc-admin', 'Admin']])
  world.locks = []
  world.audits = []
  world.delivered = []
  world.nextId = 1
})

afterEach(() => {
  vi.useRealTimers()
})

describe('saveReservation', () => {
  it('reserves a van for the servants going, under a lock on the van, and tells the others', async () => {
    const result = await saveReservation(morning)
    expect(result).toEqual({ ok: true, data: { id: 'res-1', month: '2026-11' } })
    expect(world.reservations).toEqual([
      { id: 'res-1', itemId: 'black-van', startsAt: sat(9), endsAt: sat(12), service: 'Youth Meeting', note: null, createdById: 'acc-me', servantIds: ['sv-me', 'sv-a'] },
    ])
    expect(world.locks).toEqual(['black-van'])
    expect(world.audits).toEqual(['Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM'])
    expect(world.delivered.map((n) => [n.servantId, n.kind, n.title])).toEqual([['sv-a', 'reservation', 'Black Van reserved for you']])
    expect(world.delivered[0]!.dedupeKey).toMatch(/^reservation:sv-a:/)
  })

  it('refuses a time the van is already out, and says who has it', async () => {
    world.reservations.push({ id: 'taken', itemId: 'black-van', startsAt: sat(10), endsAt: sat(13), service: 'Middle School', note: null, createdById: 'acc-b', servantIds: ['sv-b'] })
    const result = await saveReservation(morning)
    expect(result).toEqual({ ok: false, error: 'The Black Van is already reserved then: Sat, Nov 7 · 10:00 AM – 1:00 PM, Middle School (Sara M).' })
    expect(world.reservations.map((r) => r.id)).toEqual(['taken'])
    expect(world.delivered).toEqual([])
  })

  it('lets the other van go at the same time, and this one go again once it is back', async () => {
    world.reservations.push({ id: 'taken', itemId: 'black-van', startsAt: sat(9), endsAt: sat(12), service: 'Middle School', note: null, createdById: 'acc-b', servantIds: ['sv-b'] })
    expect((await saveReservation({ ...morning, itemId: 'white-van' })).ok).toBe(true)
    expect((await saveReservation({ ...morning, from: '12:00', until: '15:00' })).ok).toBe(true)
    expect(world.reservations).toHaveLength(3)
  })

  it('is for servants, the admin and the pastor, not a child', async () => {
    world.user = { accountId: 'acc-kid', role: 'STUDENT', displayName: 'Kid', servantId: undefined }
    expect(await saveReservation(morning)).toEqual({ ok: false, error: 'Only servants can reserve a van.' })
    world.user = { accountId: 'acc-pastor', role: 'PASTOR', displayName: 'Abouna', servantId: undefined }
    expect((await saveReservation(morning)).ok).toBe(true)
  })

  it('takes only a listed service, and Other with a note saying what for', async () => {
    expect(await saveReservation({ ...morning, service: 'Picnic' })).toEqual({ ok: false, error: 'Pick what the van is for.' })
    expect(await saveReservation({ ...morning, service: 'Other' })).toEqual({ ok: false, error: 'Say in the note what the van is for.' })
    expect((await saveReservation({ ...morning, service: 'Other', note: 'Airport pickup' })).ok).toBe(true)
    expect((await saveReservation({ ...morning, itemId: 'white-van', service: 'Men’s Meeting' })).ok).toBe(true)
  })

  it('keeps the service a reservation was made for, though its meeting has been renamed since', async () => {
    world.reservations.push({ id: 'mine', itemId: 'black-van', startsAt: sat(9), endsAt: sat(12), service: 'Young Adults', note: null, createdById: 'acc-me', servantIds: ['sv-me'] })
    expect((await saveReservation({ ...morning, id: 'mine', servantIds: ['sv-me'], service: 'Young Adults', until: '13:00' })).ok).toBe(true)
    expect(await saveReservation({ ...morning, service: 'Young Adults', itemId: 'white-van' })).toEqual({ ok: false, error: 'Pick what the van is for.' })
  })

  it('needs a van that can still be reserved and servants who are still here', async () => {
    world.items.get('black-van')!.isActive = false
    expect(await saveReservation(morning)).toEqual({ ok: false, error: 'That van can no longer be reserved. Pick another.' })
    expect(await saveReservation({ ...morning, itemId: 'white-van', servantIds: [] })).toEqual({ ok: false, error: 'Pick the servants taking the van.' })
    expect(await saveReservation({ ...morning, itemId: 'white-van', servantIds: ['sv-me', 'sv-gone'] })).toEqual({
      ok: false,
      error: 'One of those servants is no longer here. Pick them again.',
    })
  })

  it('refuses times it cannot take', async () => {
    expect(await saveReservation({ ...morning, from: '12:00', until: '09:00' })).toEqual({ ok: false, error: '“Until” has to be after “From”.' })
    expect(await saveReservation({ ...morning, date: '2026-10-31' })).toEqual({ ok: false, error: 'That time has already passed.' })
  })

  it('moves a reservation without clashing with itself, and tells who stayed on it', async () => {
    await saveReservation(morning)
    world.delivered = []
    const result = await saveReservation({ ...morning, id: 'res-1', from: '10:00', until: '13:00' })
    expect(result).toEqual({ ok: true, data: { id: 'res-1', month: '2026-11' } })
    expect(world.reservations).toHaveLength(1)
    expect(world.reservations[0]).toMatchObject({ startsAt: sat(10), endsAt: sat(13), servantIds: ['sv-me', 'sv-a'], createdById: 'acc-me' })
    expect(world.delivered.map((n) => [n.servantId, n.title])).toEqual([['sv-a', 'A reservation of yours changed']])
  })

  it('lets only the one who made it, the servants on it, or the admin change it', async () => {
    world.reservations.push({ id: 'hers', itemId: 'black-van', startsAt: sat(9), endsAt: sat(12), service: 'Middle School', note: null, createdById: 'acc-b', servantIds: ['sv-b'] })
    const change = { ...morning, id: 'hers', servantIds: ['sv-b'], service: 'Middle School', until: '13:00' }
    expect(await saveReservation(change)).toEqual({ ok: false, error: 'Only the one who made this reservation, the servants on it, or the admin can change it.' })
    asAdmin()
    expect((await saveReservation(change)).ok).toBe(true)
    expect(world.reservations[0]!.endsAt).toEqual(sat(13))
  })

  it('keeps a reservation that is over as it was', async () => {
    world.reservations.push({ id: 'old', itemId: 'black-van', startsAt: new Date('2026-10-31T15:00:00.000Z'), endsAt: new Date('2026-10-31T18:00:00.000Z'), service: 'Youth Meeting', note: null, createdById: 'acc-me', servantIds: ['sv-me'] })
    expect(await saveReservation({ ...morning, id: 'old' })).toEqual({ ok: false, error: 'This reservation is over, so it can no longer be changed.' })
  })
})

describe('cancelReservation', () => {
  it('lets a servant on it cancel it, and tells the others', async () => {
    world.reservations.push({ id: 'trip', itemId: 'black-van', startsAt: sat(9), endsAt: sat(12), service: 'Youth Meeting', note: null, createdById: 'acc-b', servantIds: ['sv-b', 'sv-me'] })
    expect(await cancelReservation('trip')).toEqual({ ok: true, data: { month: '2026-11' } })
    expect(world.reservations).toEqual([])
    expect(world.audits).toEqual(['cancelled the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM'])
    expect(world.delivered.map((n) => [n.servantId, n.title])).toEqual([['sv-b', 'Black Van reservation cancelled']])
  })

  it('refuses anyone else, and says when it is gone', async () => {
    world.reservations.push({ id: 'hers', itemId: 'black-van', startsAt: sat(9), endsAt: sat(12), service: 'Middle School', note: null, createdById: 'acc-b', servantIds: ['sv-b'] })
    expect(await cancelReservation('hers')).toEqual({ ok: false, error: 'Only the one who made this reservation, the servants on it, or the admin can cancel it.' })
    expect(world.reservations).toHaveLength(1)
    expect(await cancelReservation('nope')).toEqual({ ok: false, error: 'That reservation is no longer there.' })
  })

  it('leaves a reservation that is over to the admin, who tells nobody', async () => {
    world.reservations.push({ id: 'old', itemId: 'black-van', startsAt: new Date('2026-10-31T15:00:00.000Z'), endsAt: new Date('2026-10-31T18:00:00.000Z'), service: 'Youth Meeting', note: null, createdById: 'acc-me', servantIds: ['sv-me', 'sv-a'] })
    expect(await cancelReservation('old')).toEqual({ ok: false, error: 'This reservation is over. Only the admin can take it off.' })
    asAdmin()
    expect((await cancelReservation('old')).ok).toBe(true)
    expect(world.reservations).toEqual([])
    expect(world.delivered).toEqual([])
  })
})

describe('the admin’s list of vans', () => {
  it('is the admin’s alone', async () => {
    expect(await saveReservationItem({ name: 'Bus', color: 'blue' })).toEqual({ ok: false, error: 'Only the Sunday School admin can change the vans.' })
    expect(await setReservationItemActive('black-van', false)).toEqual({ ok: false, error: 'Only the Sunday School admin can change the vans.' })
    expect(await deleteReservationItem('black-van')).toEqual({ ok: false, error: 'Only the Sunday School admin can change the vans.' })
  })

  it('adds a van at the end, renames one, and refuses a name already taken or an unknown color', async () => {
    asAdmin()
    const added = await saveReservationItem({ name: 'Church Bus', details: '24 seats', color: 'green' })
    expect(added.ok).toBe(true)
    const bus = Array.from(world.items.values()).find((i) => i.name === 'Church Bus')!
    expect(bus).toMatchObject({ details: '24 seats', color: 'green', sortOrder: 2 })
    expect(await saveReservationItem({ name: 'black van', color: 'black' })).toEqual({ ok: false, error: 'There is already a van called “Black Van”.' })
    expect(await saveReservationItem({ name: 'Pink Van', color: 'pink' })).toEqual({ ok: false, error: 'Pick one of the colors.' })
    expect((await saveReservationItem({ id: 'black-van', name: 'Black Van', details: 'Keys in the office', color: 'black' })).ok).toBe(true)
    expect(world.items.get('black-van')!.details).toBe('Keys in the office')
  })

  it('retires a van that has reservations instead of deleting it', async () => {
    asAdmin()
    world.reservations.push({ id: 'trip', itemId: 'black-van', startsAt: sat(9), endsAt: sat(12), service: 'Youth Meeting', note: null, createdById: 'acc-me', servantIds: ['sv-me'] })
    expect(await deleteReservationItem('black-van')).toEqual({ ok: false, error: 'The Black Van has reservations, so it can only be retired.' })
    expect((await setReservationItemActive('black-van', false)).ok).toBe(true)
    expect(world.items.get('black-van')!.isActive).toBe(false)
    expect((await deleteReservationItem('white-van')).ok).toBe(true)
    expect(world.items.has('white-van')).toBe(false)
  })
})
