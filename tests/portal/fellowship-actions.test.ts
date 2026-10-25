import { describe, it, expect, vi, beforeEach } from 'vitest'

// 2026-10-24 — the Add member page and the member actions a meeting's servants
// use. Stand-ins: the signed-in servant, the class check, and the membership
// data layer (tested on its own in fellowship-member-writes.test.ts).

const world = vi.hoisted(() => ({
  meeting: { id: 'mens-meeting', name: "Men's Meeting", stage: 'FELLOWSHIP', visitationThreshold: 2, takesOtherClasses: true },
  people: [] as Array<Record<string, unknown>>,
  calls: [] as string[],
  student: null as null | Record<string, unknown>,
  canWrite: true,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-sv', role: 'SERVANT', displayName: 'Servant', servantId: 'sv-x',
    classIds: ['mens-meeting'], coordinatorOf: [], assistantOf: [], stageOversight: null, fellowshipClassIds: ['mens-meeting'],
  }),
}))
vi.mock('@/lib/portal/data/classes', () => ({
  assertClassAction: async (_u: unknown, classId: string) => {
    if (!world.canWrite) throw new Error('You do not have permission to do that in this class.')
    if (classId === 'kg') return { id: 'kg', name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, takesOtherClasses: false }
    return world.meeting
  },
}))
vi.mock('@/lib/portal/data/groups', () => ({
  placeNewKids: async (classId: string, ids: string[]) => {
    world.calls.push(`place:${classId}:${ids.join(',')}`)
    return ids.length
  },
}))
vi.mock('@/lib/portal/data/fellowship', () => ({
  knownPeople: async () => world.people,
  joinMeeting: async (_db: unknown, meeting: { id: string }, ref: { kind: string; id: string }) => {
    world.calls.push(`join:${meeting.id}:${ref.kind}:${ref.id}`)
    return { studentId: 'st-joined', name: 'Paul Exampleson', plan: ref.id === 'sv-again' ? 'already' : 'create-home' }
  },
  createMember: async (_db: unknown, meeting: { id: string }, value: { firstName: string }) => {
    world.calls.push(`create:${meeting.id}:${value.firstName}`)
    return { studentId: 'st-new', accountId: 'acc-new' }
  },
  leaveMeeting: async (_db: unknown, meeting: { id: string }, studentId: string) => {
    world.calls.push(`leave:${meeting.id}:${studentId}`)
    return studentId === 'st-two' ? { plan: 'promote', name: 'Mina Testwell', newHome: 'youth-meeting' } : { plan: 'clear-home', name: 'Mina Testwell' }
  },
}))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    student: {
      findUnique: async () => world.student,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        world.calls.push(`student.update:${JSON.stringify(data)}`)
        return {}
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  }
  return { prisma }
})

import { addNewMember, addPersonToMeeting, removeMemberFromMeeting, searchPeopleToAdd, updateMember } from '@/lib/portal/actions/fellowship'

const known = (over: Record<string, unknown> = {}) => ({
  kind: 'servant', id: 'sv-1', name: 'Mina Testwell', firstName: 'Mina', lastName: 'Testwell', dob: null, where: 'Servant · KG', phoneEnd: '0147', blocked: null, ...over,
})

beforeEach(() => {
  world.calls = []
  world.people = []
  world.student = null
  world.canWrite = true
})

describe('only in a Fellowship meeting', () => {
  it('refuses the member actions in a children’s class', async () => {
    const r = await addNewMember('kg', { firstName: 'Mina' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Fellowship meeting/)
    expect(world.calls).toEqual([])
  })

  it('refuses someone who may not add members there', async () => {
    world.canWrite = false
    expect((await searchPeopleToAdd('mens-meeting', 'mina')).ok).toBe(false)
  })
})

describe('finding someone already in the portal', () => {
  it('searches servants and members by name', async () => {
    world.people = [known(), known({ id: 'sv-2', name: 'Paul Exampleson', firstName: 'Paul', lastName: 'Exampleson' })]
    const r = await searchPeopleToAdd('mens-meeting', 'min')
    expect(r.ok && r.data!.map((p) => p.id)).toEqual(['sv-1'])
  })

  it('adds a servant, and places them in a follow-up group', async () => {
    const r = await addPersonToMeeting('mens-meeting', { kind: 'servant', id: 'sv-1' })
    expect(r).toEqual({ ok: true, data: { studentId: 'st-joined', name: 'Paul Exampleson', already: false } })
    expect(world.calls).toEqual(['join:mens-meeting:servant:sv-1', 'place:mens-meeting:st-joined'])
  })

  it('says so when they were already there', async () => {
    const r = await addPersonToMeeting('mens-meeting', { kind: 'servant', id: 'sv-again' })
    expect(r.ok && r.data!.already).toBe(true)
    expect(world.calls).toEqual(['join:mens-meeting:servant:sv-again'])
  })
})

describe('adding someone new', () => {
  it('asks first when the name is already in the portal', async () => {
    world.people = [known()]
    const r = await addNewMember('mens-meeting', { firstName: 'mina', lastName: 'TESTWELL' })
    expect(r.ok && 'matches' in r.data! && r.data.matches.map((m) => m.id)).toEqual(['sv-1'])
    expect(world.calls).toEqual([])
  })

  it('adds them once the servant says it is someone else', async () => {
    world.people = [known()]
    const r = await addNewMember('mens-meeting', { firstName: 'Mina', lastName: 'Testwell' }, { confirmNew: true })
    expect(r.ok && 'added' in r.data! && r.data.added).toEqual({ studentId: 'st-new', name: 'Mina Testwell' })
    expect(world.calls).toEqual(['create:mens-meeting:Mina', 'place:mens-meeting:st-new'])
  })

  it('does not ask about someone who is already in this meeting under that name', async () => {
    world.people = [known({ blocked: 'Already a member' })]
    const r = await addNewMember('mens-meeting', { firstName: 'Mina', lastName: 'Testwell' })
    expect(r.ok && 'matches' in r.data! && r.data.matches.map((m) => m.blocked)).toEqual(['Already a member'])
  })

  it('says what is wrong with the form', async () => {
    const r = await addNewMember('mens-meeting', { firstName: 'Mina', phone: '12' })
    expect(r).toEqual({ ok: false, error: 'That phone number is too short.' })
  })
})

describe('editing and removing', () => {
  it("edits a member who does not serve", async () => {
    world.student = { id: 'st-m', firstName: 'Mina', lastName: 'Testwell', classId: 'mens-meeting', memberships: [], account: { role: 'MEMBER' } }
    const r = await updateMember('st-m', { firstName: 'Mina', lastName: 'Testwell', phone: '615-555-0100', note: 'New number' })
    expect(r.ok).toBe(true)
    expect(world.calls[0]).toContain('"phone":"6155550100"')
  })

  it("leaves a servant's details to their servant profile", async () => {
    world.student = { id: 'st-s', firstName: 'Paul', lastName: 'Exampleson', classId: 'mens-meeting', memberships: [], account: { role: 'SERVANT' } }
    const r = await updateMember('st-s', { firstName: 'Paul' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/servant profile/)
  })

  it('removes someone, and when another meeting becomes their home, places them in its groups', async () => {
    const r = await removeMemberFromMeeting('mens-meeting', 'st-two')
    expect(r.ok).toBe(true)
    expect(world.calls).toEqual(['leave:mens-meeting:st-two', 'place:youth-meeting:st-two'])
  })
})

describe('importing a sheet of members', () => {
  const sheet = 'Name,Phone\nMina Testwell,6155550147\nKiro Newman,6155550100\nPeter Walker,\n,6155550111\n'

  it('previews what each row will do, and writes nothing', async () => {
    world.people = [known(), known({ id: 'st-9', kind: 'member', name: 'Peter Walker', firstName: 'Peter', lastName: 'Walker', blocked: 'Already a member' })]
    const { importMembersCsv } = await import('@/lib/portal/actions/fellowship')
    const r = await importMembersCsv('mens-meeting', sheet, { preview: true })
    expect(r.ok).toBe(true)
    expect(r.ok && r.data!.rows.map((x) => [x.row, x.status])).toEqual([
      [2, 'servant'],
      [3, 'new'],
      [4, 'already'],
      [5, 'problem'],
    ])
    expect(world.calls).toEqual([])
  })

  it('imports: links the servant, adds the new person, skips the rest, and places them in groups', async () => {
    world.people = [known(), known({ id: 'st-9', kind: 'member', name: 'Peter Walker', firstName: 'Peter', lastName: 'Walker', blocked: 'Already a member' })]
    const { importMembersCsv } = await import('@/lib/portal/actions/fellowship')
    const r = await importMembersCsv('mens-meeting', sheet, {})
    expect(r.ok && r.data!.counts).toEqual({ added: 1, linked: 1, joined: 0, already: 1, problems: 1 })
    expect(world.calls).toEqual([
      'join:mens-meeting:servant:sv-1',
      'create:mens-meeting:Kiro',
      'place:mens-meeting:st-joined,st-new',
    ])
  })

  it('says plainly when the sheet has no name column', async () => {
    const { importMembersCsv } = await import('@/lib/portal/actions/fellowship')
    const r = await importMembersCsv('mens-meeting', 'Phone\n6155550147\n', { preview: true })
    expect(r).toEqual({ ok: false, error: 'The sheet needs a Name column, or First Name and Last Name.' })
  })
})
