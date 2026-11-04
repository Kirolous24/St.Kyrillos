import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Van reservations, server side (2026-11-02): a servant reserves a van for a
 * time, a service and the servants taking it; two reservations of one van never
 * overlap; the one who made it, the servants on it and the admin change or
 * cancel it; the admin keeps the list of vans. Since 2026-11-04 each one is a
 * request an approver answers. Stand-ins: the signed-in person, the audit
 * trail, notice delivery and a database that keeps what is written.
 */

type Status = 'PENDING' | 'APPROVED' | 'REJECTED'
interface Res {
  id: string
  itemId: string
  startsAt: Date
  endsAt: Date
  service: string
  reason: string | null
  status: Status
  decidedById: string | null
  decidedAt: Date | null
  decisionNote: string | null
  createdById: string | null
  servantIds: string[]
  updatedAt: Date
}

const world = vi.hoisted(() => ({
  user: { accountId: 'acc-me', role: 'SERVANT', displayName: 'Pat', servantId: 'sv-me' as string | undefined },
  items: new Map<string, { id: string; name: string; color: string; isActive: boolean; sortOrder: number; details: string | null; photo: string | null }>(),
  reservations: [] as Res[],
  servants: new Map<string, { name: string; active: boolean }>(),
  accounts: new Map<string, string>(),
  /** Each account's servant record, for those who have one. */
  servantOf: new Map<string, string>(),
  approvers: [] as string[],
  admins: [] as string[],
  meetings: ['Men’s Meeting', 'Women’s Meeting', 'Youth Meeting'],
  locks: [] as string[],
  audits: [] as string[],
  delivered: [] as Array<{ servantId?: string; accountId?: string; kind: string; title: string; body: string; dedupeKey: string; email?: boolean | 'always'; details?: string[] }>,
  /** Makes the next conditional update find the row changed under it. */
  raceOnce: false,
  nextId: 1,
  tick: 1,
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
    const asker = r.createdById ? world.servantOf.get(r.createdById) : undefined
    return {
      ...r,
      item: { name: item.name, color: item.color },
      createdBy: r.createdById ? { displayName: world.accounts.get(r.createdById) ?? 'Someone', servant: asker ? { id: asker } : null } : null,
      decidedBy: r.decidedById ? { displayName: world.accounts.get(r.decidedById) ?? 'Someone' } : null,
      servants: r.servantIds.map((servantId) => ({
        servantId,
        servant: { id: servantId, account: { displayName: world.servants.get(servantId)?.name ?? '?' } },
      })),
    }
  }
  type ResWhere = { id?: string | { not: string }; itemId?: string; startsAt?: { lt: Date }; endsAt?: { gt: Date }; status?: Status | { in: Status[] }; updatedAt?: Date }
  const matches = (r: Res, w: ResWhere) =>
    (w.id === undefined || (typeof w.id === 'string' ? r.id === w.id : r.id !== w.id.not)) &&
    (w.itemId === undefined || r.itemId === w.itemId) &&
    (w.startsAt === undefined || r.startsAt < w.startsAt.lt) &&
    (w.endsAt === undefined || r.endsAt > w.endsAt.gt) &&
    (w.status === undefined || (typeof w.status === 'string' ? r.status === w.status : w.status.in.includes(r.status))) &&
    (w.updatedAt === undefined || r.updatedAt.getTime() === w.updatedAt.getTime())
  type ResData = Partial<Pick<Res, 'itemId' | 'startsAt' | 'endsAt' | 'service' | 'reason' | 'status' | 'decidedById' | 'decidedAt' | 'decisionNote'>> & {
    createdById?: string
    servants?: { create: Array<{ servantId: string }> }
  }
  const write = (r: Res, data: ResData) => {
    const { servants, createdById: _c, ...fields } = data
    Object.assign(r, fields)
    if (servants) r.servantIds = [...r.servantIds, ...servants.create.map((s) => s.servantId)]
    r.updatedAt = new Date(Date.now() + world.tick++)
  }
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
        itemId: '',
        startsAt: new Date(0),
        endsAt: new Date(0),
        service: '',
        reason: null,
        status: 'PENDING',
        decidedById: null,
        decidedAt: null,
        decisionNote: null,
        createdById: args.data.createdById ?? null,
        servantIds: [],
        updatedAt: new Date(0),
      }
      write(r, args.data)
      world.reservations.push(r)
      return shape(r)
    },
    update: async (args: { where: { id: string }; data: ResData }) => {
      const r = world.reservations.find((x) => x.id === args.where.id)!
      write(r, args.data)
      return shape(r)
    },
    updateMany: async (args: { where: ResWhere; data: ResData }) => {
      if (world.raceOnce) {
        world.raceOnce = false
        return { count: 0 }
      }
      const hit = world.reservations.filter((x) => matches(x, args.where))
      for (const r of hit) write(r, args.data)
      return { count: hit.length }
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
  const approverRow = (servantId: string) => ({ servantId, servant: { account: { displayName: world.servants.get(servantId)?.name ?? '?' } } })
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
      reservationApprover: {
        findMany: async () => world.approvers.filter((id) => world.servants.get(id)?.active).map(approverRow),
        findUnique: async (args: { where: { servantId: string } }) => (world.approvers.includes(args.where.servantId) ? approverRow(args.where.servantId) : null),
        upsert: async (args: { where: { servantId: string } }) => {
          if (!world.approvers.includes(args.where.servantId)) world.approvers.push(args.where.servantId)
          return { servantId: args.where.servantId }
        },
        delete: async (args: { where: { servantId: string } }) => {
          world.approvers = world.approvers.filter((id) => id !== args.where.servantId)
          return {}
        },
      },
      account: {
        findMany: async () => world.admins.map((id) => ({ id })),
      },
      servant: {
        count: async (args: { where: { id: { in: string[] }; account: { isActive: boolean } } }) =>
          args.where.id.in.filter((id) => world.servants.get(id)?.active).length,
        findFirst: async (args: { where: { id: string } }) => {
          const s = world.servants.get(args.where.id)
          return s?.active ? { id: args.where.id, account: { displayName: s.name } } : null
        },
      },
      schoolClass: {
        findMany: async () => world.meetings.map((name) => ({ name })),
      },
    },
  }
})

import {
  addReservationApprover,
  cancelReservation,
  decideReservation,
  deleteReservationItem,
  removeReservationApprover,
  saveReservation,
  saveReservationItem,
  setReservationItemActive,
} from '@/lib/portal/actions/reservations'

// Sunday, Nov 1 2026, noon in Antioch. Saturday Nov 7 9:00 AM is 15:00 UTC.
const NOW = new Date('2026-11-01T18:00:00.000Z')
const sat = (h: number) => new Date(Date.UTC(2026, 10, 7, h + 6))
const asServant = (servantId: string, accountId: string, displayName: string) => {
  world.user = { accountId, role: 'SERVANT', displayName, servantId }
}
const asAdmin = () => {
  world.user = { accountId: 'acc-admin', role: 'ADMIN', displayName: 'Admin', servantId: undefined }
}
const asApprover = () => asServant('sv-ap', 'acc-ap', 'Abe A')
const morning = {
  itemId: 'black-van',
  date: '2026-11-07',
  from: '09:00',
  until: '12:00',
  servantIds: ['sv-me', 'sv-a'],
  service: 'Youth Meeting',
  reason: 'Taking the youth to the park',
}
const NO_REASON = { ok: false, error: 'Say where the van is going and what for.' }
/** A reservation already in the database: Pat's approved Saturday morning unless told otherwise. */
const existing = (over: Partial<Res> & { id: string }): Res => ({
  itemId: 'black-van',
  startsAt: sat(9),
  endsAt: sat(12),
  service: 'Youth Meeting',
  reason: 'Taking the youth to the park',
  status: 'APPROVED',
  decidedById: 'acc-ap',
  decidedAt: new Date('2026-10-30T15:00:00.000Z'),
  decisionNote: null,
  createdById: 'acc-me',
  servantIds: ['sv-me', 'sv-a'],
  updatedAt: new Date('2026-10-30T15:00:00.000Z'),
  ...over,
})
const sent = () => world.delivered.map((n) => [n.servantId ?? n.accountId, n.title])

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  asServant('sv-me', 'acc-me', 'Pat E')
  world.items = new Map([
    ['black-van', { id: 'black-van', name: 'Black Van', color: 'black', isActive: true, sortOrder: 0, details: null, photo: null }],
    ['white-van', { id: 'white-van', name: 'White Van', color: 'white', isActive: true, sortOrder: 1, details: null, photo: null }],
  ])
  world.reservations = []
  world.servants = new Map([
    ['sv-me', { name: 'Pat E', active: true }],
    ['sv-a', { name: 'Mina S', active: true }],
    ['sv-b', { name: 'Sara M', active: true }],
    ['sv-ap', { name: 'Abe A', active: true }],
    ['sv-gone', { name: 'Left Us', active: false }],
  ])
  world.accounts = new Map([['acc-me', 'Pat E'], ['acc-b', 'Sara M'], ['acc-ap', 'Abe A'], ['acc-admin', 'Admin'], ['acc-pastor', 'Abouna']])
  world.servantOf = new Map([['acc-me', 'sv-me'], ['acc-b', 'sv-b'], ['acc-ap', 'sv-ap']])
  world.approvers = ['sv-ap']
  world.admins = ['acc-admin']
  world.locks = []
  world.audits = []
  world.delivered = []
  world.raceOnce = false
  world.nextId = 1
  world.tick = 1
})

afterEach(() => {
  vi.useRealTimers()
})

describe('saveReservation', () => {
  // 2026-11-04, the user: "It also needs approval, it needs to go through" one servant.
  it('sends a servant’s request to the approvers, on the phone and by email with the details, under a lock on the van', async () => {
    const result = await saveReservation(morning)
    expect(result).toEqual({ ok: true, data: { id: 'res-1', month: '2026-11', status: 'PENDING' } })
    expect(world.reservations[0]).toMatchObject({
      itemId: 'black-van',
      startsAt: sat(9),
      endsAt: sat(12),
      service: 'Youth Meeting',
      reason: 'Taking the youth to the park',
      status: 'PENDING',
      decidedById: null,
      createdById: 'acc-me',
      servantIds: ['sv-me', 'sv-a'],
    })
    expect(world.locks).toEqual(['black-van'])
    expect(world.audits).toEqual(['Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM (waiting for approval)'])
    expect(sent()).toEqual([['sv-ap', 'Black Van request from Pat E']])
    expect(world.delivered[0]).toMatchObject({ kind: 'reservation', email: 'always' })
    expect(world.delivered[0]!.details).toContain('Reason: Taking the youth to the park')
    expect(world.delivered[0]!.dedupeKey).toMatch(/^reservation:sv-ap:/)
  })

  it('sends it to the admin while no approver is named', async () => {
    world.approvers = []
    expect((await saveReservation(morning)).ok).toBe(true)
    expect(world.delivered.map((n) => [n.accountId, n.title])).toEqual([['acc-admin', 'Black Van request from Pat E']])
  })

  it('approves an approver’s own reservation at once, and tells the servants on it', async () => {
    asApprover()
    const result = await saveReservation({ ...morning, servantIds: ['sv-ap', 'sv-a'] })
    expect(result).toEqual({ ok: true, data: { id: 'res-1', month: '2026-11', status: 'APPROVED' } })
    expect(world.reservations[0]).toMatchObject({ status: 'APPROVED', decidedById: 'acc-ap', decidedAt: NOW })
    expect(world.audits).toEqual(['Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM'])
    expect(sent()).toEqual([['sv-a', 'Black Van reserved for you']])
  })

  it('needs no approval for the admin', async () => {
    asAdmin()
    expect(await saveReservation(morning)).toEqual({ ok: true, data: { id: 'res-1', month: '2026-11', status: 'APPROVED' } })
    expect(world.reservations[0]).toMatchObject({ status: 'APPROVED', decidedById: 'acc-admin' })
    expect(sent()).toEqual([
      ['sv-me', 'Black Van reserved for you'],
      ['sv-a', 'Black Van reserved for you'],
    ])
  })

  it('refuses a time the van is already out, and says who has it', async () => {
    world.reservations.push(existing({ id: 'taken', startsAt: sat(10), endsAt: sat(13), service: 'Middle School', createdById: 'acc-b', servantIds: ['sv-b'] }))
    const result = await saveReservation(morning)
    expect(result).toEqual({ ok: false, error: 'The Black Van is already reserved then: Sat, Nov 7 · 10:00 AM – 1:00 PM, Middle School (Sara M).' })
    expect(world.reservations.map((r) => r.id)).toEqual(['taken'])
    expect(world.delivered).toEqual([])
  })

  it('refuses a time someone has already asked for, while that request waits', async () => {
    world.reservations.push(existing({ id: 'asked', status: 'PENDING', decidedById: null, startsAt: sat(10), endsAt: sat(13), service: 'Middle School', createdById: 'acc-b', servantIds: ['sv-b'] }))
    expect(await saveReservation(morning)).toEqual({
      ok: false,
      error: 'The Black Van is already requested then: Sat, Nov 7 · 10:00 AM – 1:00 PM, Middle School (Sara M). It is waiting for approval.',
    })
  })

  it('lets a time go to someone else once the request for it was rejected', async () => {
    world.reservations.push(existing({ id: 'no', status: 'REJECTED', startsAt: sat(10), endsAt: sat(13), createdById: 'acc-b', servantIds: ['sv-b'] }))
    expect((await saveReservation(morning)).ok).toBe(true)
  })

  it('lets the other van go at the same time, and this one go again once it is back', async () => {
    world.reservations.push(existing({ id: 'taken', service: 'Middle School', createdById: 'acc-b', servantIds: ['sv-b'] }))
    expect((await saveReservation({ ...morning, itemId: 'white-van' })).ok).toBe(true)
    expect((await saveReservation({ ...morning, from: '12:00', until: '15:00' })).ok).toBe(true)
    expect(world.reservations).toHaveLength(3)
  })

  it('is for servants, the admin and the pastor, not a child', async () => {
    world.user = { accountId: 'acc-kid', role: 'STUDENT', displayName: 'Kid', servantId: undefined }
    expect(await saveReservation(morning)).toEqual({ ok: false, error: 'Only servants can reserve a van.' })
    world.user = { accountId: 'acc-pastor', role: 'PASTOR', displayName: 'Abouna', servantId: undefined }
    expect(await saveReservation(morning)).toEqual({ ok: true, data: { id: 'res-1', month: '2026-11', status: 'PENDING' } })
  })

  it('takes only a listed service, Other among them', async () => {
    expect(await saveReservation({ ...morning, service: 'Picnic' })).toEqual({ ok: false, error: 'Pick what the van is for.' })
    expect((await saveReservation({ ...morning, service: 'Other', reason: 'Airport pickup' })).ok).toBe(true)
    expect((await saveReservation({ ...morning, itemId: 'white-van', service: 'Men’s Meeting' })).ok).toBe(true)
  })

  // 2026-11-04, the user: "make reason required … a place, reason on what and for what".
  it('needs the reason, where the van is going and what for, whatever the service', async () => {
    expect(await saveReservation({ ...morning, reason: '' })).toEqual(NO_REASON)
    expect(await saveReservation({ ...morning, reason: '   ' })).toEqual(NO_REASON)
    expect(await saveReservation({ ...morning, reason: undefined })).toEqual(NO_REASON)
    expect(await saveReservation({ ...morning, service: 'Other', reason: '' })).toEqual(NO_REASON)
    expect(await saveReservation({ ...morning, reason: 'x'.repeat(301) })).toEqual({ ok: false, error: 'Keep the reason under 300 characters.' })
    expect(world.reservations).toEqual([])
    expect((await saveReservation({ ...morning, reason: '  To the zoo with the 5th graders ' })).ok).toBe(true)
    expect(world.reservations[0]!.reason).toBe('To the zoo with the 5th graders')
  })

  it('asks for the reason when a reservation made before it was needed is changed', async () => {
    world.reservations.push(existing({ id: 'mine', reason: null, servantIds: ['sv-me'] }))
    const change = { ...morning, id: 'mine', servantIds: ['sv-me'], until: '13:00' }
    expect(await saveReservation({ ...change, reason: '' })).toEqual(NO_REASON)
    expect(world.reservations[0]!.endsAt).toEqual(sat(12))
    expect((await saveReservation(change)).ok).toBe(true)
    expect(world.reservations[0]).toMatchObject({ endsAt: sat(13), reason: 'Taking the youth to the park', status: 'PENDING' })
  })

  it('keeps the service a reservation was made for, though its meeting has been renamed since', async () => {
    world.reservations.push(existing({ id: 'mine', service: 'Young Adults', servantIds: ['sv-me'] }))
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

  it('moves a waiting request without clashing with itself, and tells the approvers it changed', async () => {
    await saveReservation(morning)
    world.delivered = []
    const result = await saveReservation({ ...morning, id: 'res-1', from: '10:00', until: '13:00' })
    expect(result).toEqual({ ok: true, data: { id: 'res-1', month: '2026-11', status: 'PENDING' } })
    expect(world.reservations).toHaveLength(1)
    expect(world.reservations[0]).toMatchObject({ startsAt: sat(10), endsAt: sat(13), servantIds: ['sv-me', 'sv-a'], createdById: 'acc-me' })
    expect(sent()).toEqual([['sv-ap', 'Black Van request changed by Pat E']])
  })

  it('keeps an approved reservation approved when only its servants change, and asks again when its time does', async () => {
    world.reservations.push(existing({ id: 'mine' }))
    expect(await saveReservation({ ...morning, id: 'mine', servantIds: ['sv-me', 'sv-a', 'sv-b'] })).toMatchObject({ ok: true, data: { status: 'APPROVED' } })
    expect(world.reservations[0]).toMatchObject({ status: 'APPROVED', decidedById: 'acc-ap' })
    expect(sent()).toEqual([['sv-b', 'Black Van reserved for you']])
    world.delivered = []
    expect(await saveReservation({ ...morning, id: 'mine', servantIds: ['sv-me', 'sv-a', 'sv-b'], until: '13:00' })).toMatchObject({ ok: true, data: { status: 'PENDING' } })
    expect(world.reservations[0]).toMatchObject({ status: 'PENDING', decidedById: null, decidedAt: null })
    expect(sent()).toEqual([
      ['sv-ap', 'Black Van request changed by Pat E'],
      ['sv-a', 'A reservation of yours changed'],
      ['sv-b', 'A reservation of yours changed'],
    ])
  })

  it('asks again when a rejected request is saved', async () => {
    world.reservations.push(existing({ id: 'mine', status: 'REJECTED', decisionNote: 'The van is in the shop' }))
    expect(await saveReservation({ ...morning, id: 'mine' })).toMatchObject({ ok: true, data: { status: 'PENDING' } })
    expect(world.reservations[0]).toMatchObject({ status: 'PENDING', decidedById: null, decisionNote: null })
    expect(sent()).toEqual([['sv-ap', 'Black Van request from Pat E']])
  })

  it('lets only the one who made it, the servants on it, or the admin change it', async () => {
    world.reservations.push(existing({ id: 'hers', service: 'Middle School', createdById: 'acc-b', servantIds: ['sv-b'] }))
    const change = { ...morning, id: 'hers', servantIds: ['sv-b'], service: 'Middle School', until: '13:00' }
    expect(await saveReservation(change)).toEqual({ ok: false, error: 'Only the one who made this reservation, the servants on it, or the admin can change it.' })
    asAdmin()
    expect((await saveReservation(change)).ok).toBe(true)
    expect(world.reservations[0]!.endsAt).toEqual(sat(13))
  })

  it('keeps a reservation that is over as it was', async () => {
    world.reservations.push(existing({ id: 'old', startsAt: new Date('2026-10-31T15:00:00.000Z'), endsAt: new Date('2026-10-31T18:00:00.000Z'), servantIds: ['sv-me'] }))
    expect(await saveReservation({ ...morning, id: 'old' })).toEqual({ ok: false, error: 'This reservation is over, so it can no longer be changed.' })
  })
})

describe('decideReservation', () => {
  const asked = (over: Partial<Res> = {}) => existing({ id: 'req', status: 'PENDING', decidedById: null, decidedAt: null, ...over })

  it('lets an approver approve a request, and tells the one who asked and the servants on it', async () => {
    world.reservations.push(asked())
    asApprover()
    expect(await decideReservation({ id: 'req', decision: 'APPROVED' })).toEqual({ ok: true, data: { status: 'APPROVED' } })
    expect(world.reservations[0]).toMatchObject({ status: 'APPROVED', decidedById: 'acc-ap', decidedAt: NOW, decisionNote: null })
    expect(world.locks).toEqual(['black-van'])
    expect(world.audits).toEqual(['approved the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM'])
    expect(sent()).toEqual([
      ['acc-me', 'Black Van request approved'],
      ['sv-a', 'Black Van reserved for you'],
    ])
    expect(world.delivered[0]).toMatchObject({ email: 'always' })
    expect(world.delivered[0]!.details).toContain('Approved by: Abe A, Nov 1, 12:00 PM')
  })

  it('rejects one with the approver’s words, which go to the one who asked', async () => {
    world.reservations.push(asked())
    asApprover()
    expect(await decideReservation({ id: 'req', decision: 'REJECTED', note: '  The van is in the shop  ' })).toEqual({ ok: true, data: { status: 'REJECTED' } })
    expect(world.reservations[0]).toMatchObject({ status: 'REJECTED', decidedById: 'acc-ap', decisionNote: 'The van is in the shop' })
    expect(world.audits).toEqual(['rejected the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM (“The van is in the shop”)'])
    expect(sent()).toEqual([['acc-me', 'Black Van request not approved']])
    expect(world.delivered[0]!.body).toContain('“The van is in the shop”')
  })

  it('is for the approvers and the admin, and the admin alone while nobody is named', async () => {
    world.reservations.push(asked())
    const refused = { ok: false, error: 'Only the servants who approve van requests, or the admin, can do that.' }
    expect(await decideReservation({ id: 'req', decision: 'APPROVED' })).toEqual(refused)
    world.approvers = []
    asApprover()
    expect(await decideReservation({ id: 'req', decision: 'APPROVED' })).toEqual(refused)
    asAdmin()
    expect((await decideReservation({ id: 'req', decision: 'APPROVED' })).ok).toBe(true)
  })

  it('will not approve a rejected request whose time someone else has asked for since', async () => {
    world.reservations.push(asked({ status: 'REJECTED' }))
    world.reservations.push(existing({ id: 'other', status: 'PENDING', startsAt: sat(10), endsAt: sat(13), service: 'Middle School', createdById: 'acc-b', servantIds: ['sv-b'] }))
    asApprover()
    expect(await decideReservation({ id: 'req', decision: 'APPROVED' })).toEqual({
      ok: false,
      error: 'The Black Van is already requested then: Sat, Nov 7 · 10:00 AM – 1:00 PM, Middle School (Sara M). It is waiting for approval.',
    })
    expect(world.reservations[0]!.status).toBe('REJECTED')
  })

  it('says when it is already decided, over, or gone', async () => {
    world.reservations.push(asked({ status: 'APPROVED' }))
    world.reservations.push(asked({ id: 'old', startsAt: new Date('2026-10-31T15:00:00.000Z'), endsAt: new Date('2026-10-31T18:00:00.000Z') }))
    asApprover()
    expect(await decideReservation({ id: 'req', decision: 'APPROVED' })).toEqual({ ok: false, error: 'It is already approved.' })
    expect(await decideReservation({ id: 'old', decision: 'REJECTED' })).toEqual({ ok: false, error: 'This reservation is over.' })
    expect(await decideReservation({ id: 'nope', decision: 'APPROVED' })).toEqual({ ok: false, error: 'That reservation is no longer there.' })
  })

  it('refuses when the request changed while the approver was looking at it', async () => {
    world.reservations.push(asked())
    asApprover()
    world.raceOnce = true
    expect(await decideReservation({ id: 'req', decision: 'APPROVED' })).toEqual({ ok: false, error: 'Someone changed this request just now. Look at it again.' })
    expect(world.reservations[0]!.status).toBe('PENDING')
    expect(world.delivered).toEqual([])
  })
})

describe('cancelReservation', () => {
  it('lets a servant on it cancel it, and tells the others', async () => {
    world.reservations.push(existing({ id: 'trip', createdById: 'acc-b', servantIds: ['sv-b', 'sv-me'] }))
    expect(await cancelReservation('trip')).toEqual({ ok: true, data: { month: '2026-11' } })
    expect(world.reservations).toEqual([])
    expect(world.audits).toEqual(['cancelled the Black Van for Youth Meeting: Sat, Nov 7 · 9:00 AM – 12:00 PM'])
    expect(sent()).toEqual([['sv-b', 'Black Van reservation cancelled']])
  })

  it('tells the approvers when a waiting request is withdrawn', async () => {
    world.reservations.push(existing({ id: 'mine', status: 'PENDING', decidedById: null }))
    expect((await cancelReservation('mine')).ok).toBe(true)
    expect(sent()).toEqual([['sv-ap', 'Black Van request withdrawn']])
  })

  it('refuses anyone else, and says when it is gone', async () => {
    world.reservations.push(existing({ id: 'hers', service: 'Middle School', createdById: 'acc-b', servantIds: ['sv-b'] }))
    expect(await cancelReservation('hers')).toEqual({ ok: false, error: 'Only the one who made this reservation, the servants on it, or the admin can cancel it.' })
    expect(world.reservations).toHaveLength(1)
    expect(await cancelReservation('nope')).toEqual({ ok: false, error: 'That reservation is no longer there.' })
  })

  it('leaves a reservation that is over to the admin, who tells nobody', async () => {
    world.reservations.push(existing({ id: 'old', startsAt: new Date('2026-10-31T15:00:00.000Z'), endsAt: new Date('2026-10-31T18:00:00.000Z') }))
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
    expect(await addReservationApprover('sv-a')).toEqual({ ok: false, error: 'Only the Sunday School admin can change the vans.' })
    expect(await removeReservationApprover('sv-ap')).toEqual({ ok: false, error: 'Only the Sunday School admin can change the vans.' })
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
    world.reservations.push(existing({ id: 'trip', servantIds: ['sv-me'] }))
    expect(await deleteReservationItem('black-van')).toEqual({ ok: false, error: 'The Black Van has reservations, so it can only be retired.' })
    expect((await setReservationItemActive('black-van', false)).ok).toBe(true)
    expect(world.items.get('black-van')!.isActive).toBe(false)
    expect((await deleteReservationItem('white-van')).ok).toBe(true)
    expect(world.items.has('white-van')).toBe(false)
  })

  it('names the servants who approve van requests, and takes them off', async () => {
    asAdmin()
    world.approvers = []
    expect(await addReservationApprover('sv-a')).toEqual({ ok: true })
    expect(world.approvers).toEqual(['sv-a'])
    expect(world.audits).toEqual(['Mina S approves van requests'])
    expect(await addReservationApprover('sv-gone')).toEqual({ ok: false, error: 'That servant is no longer here.' })
    expect(await removeReservationApprover('sv-a')).toEqual({ ok: true })
    expect(world.approvers).toEqual([])
    expect(world.audits).toEqual(['Mina S approves van requests', 'Mina S no longer approves van requests'])
    expect(await removeReservationApprover('sv-a')).toEqual({ ok: false, error: 'They no longer approve van requests.' })
  })
})
