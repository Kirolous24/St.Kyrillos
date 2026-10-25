import { describe, it, expect } from 'vitest'
import {
  joinPlan,
  leavePlan,
  parseMemberInput,
  samePersonMatches,
  type KnownPerson,
  type PersonState,
} from '@/lib/portal/fellowship'

// 2026-10-24 — who may join a Fellowship meeting, and what leaving one does.
// A member's first meeting is their home (Student.classId), because follow-up
// groups live there; a second meeting is a ClassMember row.

const mens = { id: 'mens-meeting', name: "Men's Meeting" }

function person(over: Partial<PersonState> = {}): PersonState {
  return { role: 'MEMBER', student: null, serves: [], ...over }
}

describe('joining a meeting', () => {
  it("a servant with no member side yet gets one, in this meeting", () => {
    expect(joinPlan(person({ role: 'SERVANT', serves: ['5th-6th-boys'] }), mens)).toEqual({ kind: 'create-home' })
  })

  it('a servant who grew up here keeps the record they have (F0850)', () => {
    const grownUp = person({ role: 'SERVANT', serves: ['kg'], student: { id: 'st-1', classId: null, memberOf: [] } })
    expect(joinPlan(grownUp, mens)).toEqual({ kind: 'set-home' })
  })

  it('someone already in another meeting joins this one as well', () => {
    const youth = person({ student: { id: 'st-2', classId: 'youth-meeting', memberOf: [] } })
    expect(joinPlan(youth, mens)).toEqual({ kind: 'add-member' })
  })

  it('someone already here is already here', () => {
    expect(joinPlan(person({ student: { id: 'st-3', classId: 'mens-meeting', memberOf: [] } }), mens)).toEqual({ kind: 'already' })
    expect(joinPlan(person({ student: { id: 'st-3', classId: 'youth-meeting', memberOf: ['mens-meeting'] } }), mens)).toEqual({ kind: 'already' })
  })

  it("a meeting's own servant is not also its member", () => {
    const plan = joinPlan(person({ role: 'SERVANT', serves: ['mens-meeting'] }), mens)
    expect(plan.kind).toBe('refuse')
    if (plan.kind === 'refuse') expect(plan.reason).toMatch(/serves Men's Meeting/)
  })

  it('a child is not a member', () => {
    expect(joinPlan(person({ role: 'STUDENT', student: { id: 'st-4', classId: 'kg', memberOf: [] } }), mens).kind).toBe('refuse')
  })

  it('the shared admin and the pastor accounts are not members', () => {
    expect(joinPlan(person({ role: 'ADMIN' }), mens).kind).toBe('refuse')
    expect(joinPlan(person({ role: 'PASTOR' }), mens).kind).toBe('refuse')
  })
})

describe('leaving a meeting', () => {
  it('someone who joined from another meeting simply leaves this one', () => {
    const p = person({ student: { id: 'st-1', classId: 'youth-meeting', memberOf: ['mens-meeting'] } })
    expect(leavePlan(p, 'mens-meeting')).toEqual({ kind: 'drop-membership' })
  })

  it('leaving their first meeting while in another makes that one their home', () => {
    const p = person({ student: { id: 'st-1', classId: 'mens-meeting', memberOf: ['youth-meeting'] } })
    expect(leavePlan(p, 'mens-meeting')).toEqual({ kind: 'promote', newHome: 'youth-meeting' })
  })

  it('a member who does not serve, leaving their only meeting, keeps their record (the user, 2026-10-24)', () => {
    expect(leavePlan(person({ student: { id: 'st-1', classId: 'mens-meeting', memberOf: [] } }), 'mens-meeting')).toEqual({ kind: 'clear-home' })
  })

  it('a servant leaving their only meeting keeps their login and their record', () => {
    const p = person({ role: 'SERVANT', serves: ['kg'], student: { id: 'st-1', classId: 'mens-meeting', memberOf: [] } })
    expect(leavePlan(p, 'mens-meeting')).toEqual({ kind: 'clear-home' })
  })

  it('someone not in the meeting cannot leave it', () => {
    expect(leavePlan(person({ student: { id: 'st-1', classId: 'youth-meeting', memberOf: [] } }), 'mens-meeting')).toEqual({ kind: 'not-member' })
    expect(leavePlan(person(), 'mens-meeting')).toEqual({ kind: 'not-member' })
  })
})

describe('is this the same person?', () => {
  const people: KnownPerson[] = [
    { kind: 'servant', id: 'sv-1', firstName: 'Mina', lastName: 'Testwell', dob: '1990-03-04', where: 'Servant · 5th & 6th Boys' },
    { kind: 'member', id: 'st-9', firstName: 'Mary', lastName: 'Sampleton', dob: null, where: 'Member · Youth Meeting' },
  ]

  it('matches the same name in any order or case, and not a different name', () => {
    expect(samePersonMatches({ firstName: 'mena', lastName: 'testwell' }, people).map((p) => p.id)).toEqual([])
    expect(samePersonMatches({ firstName: 'Mina', lastName: 'Tastwell' }, people).map((p) => p.id)).toEqual([])
    expect(samePersonMatches({ firstName: 'Testwell', lastName: 'Mina' }, people).map((p) => p.id)).toEqual(['sv-1'])
    expect(samePersonMatches({ firstName: 'MARY', lastName: 'sampleton' }, people).map((p) => p.id)).toEqual(['st-9'])
  })

  it('two different birthdays are two different people', () => {
    expect(samePersonMatches({ firstName: 'Mina', lastName: 'Testwell', dob: '1988-01-01' }, people)).toEqual([])
    expect(samePersonMatches({ firstName: 'Mina', lastName: 'Testwell', dob: '1990-03-04' }, people).map((p) => p.id)).toEqual(['sv-1'])
  })

  it('a missing birthday on either side does not tell them apart', () => {
    expect(samePersonMatches({ firstName: 'Mary', lastName: 'Sampleton', dob: '1999-09-09' }, people).map((p) => p.id)).toEqual(['st-9'])
  })
})

describe('the add-member form', () => {
  it('reads a name, a phone, an email, a birthday and a note', () => {
    const r = parseMemberInput({ firstName: ' Mina ', lastName: 'Testwell', phone: '(615) 555-0147', email: ' Mina@Example.com ', birthday: '3/4/1990', note: 'Comes with his brother' })
    expect(r).toEqual({
      ok: true,
      value: { firstName: 'Mina', lastName: 'Testwell', phone: '6155550147', email: 'mina@example.com', dob: '1990-03-04', note: 'Comes with his brother' },
    })
  })

  it('needs only a first name', () => {
    expect(parseMemberInput({ firstName: 'Abanoub' })).toEqual({
      ok: true,
      value: { firstName: 'Abanoub', lastName: '', phone: null, email: null, dob: null, note: null },
    })
  })

  it('says what is wrong', () => {
    expect(parseMemberInput({ firstName: '' })).toEqual({ ok: false, error: 'Write their first name.' })
    expect(parseMemberInput({ firstName: 'Mina', phone: '12' })).toEqual({ ok: false, error: 'That phone number is too short.' })
    expect(parseMemberInput({ firstName: 'Mina', email: 'mina@' })).toEqual({ ok: false, error: 'That email address does not look right.' })
    expect(parseMemberInput({ firstName: 'Mina', birthday: '31/31/1990' })).toEqual({ ok: false, error: 'Write the birthday as month/day/year.' })
  })
})

describe('searching for someone to add', () => {
  const people = [
    { kind: 'servant' as const, id: 'sv-1', name: 'Mina Testwell', firstName: 'Mina', lastName: 'Testwell', dob: null, where: 'Servant · KG', phoneEnd: '0147', blocked: null },
    { kind: 'member' as const, id: 'st-1', name: 'Mary Sampleton', firstName: 'Mary', lastName: 'Sampleton', dob: null, where: 'Member · Youth Meeting', phoneEnd: null, blocked: null },
    { kind: 'servant' as const, id: 'sv-2', name: 'Marco Mina', firstName: 'Marco', lastName: 'Mina', dob: null, where: 'Servant', phoneEnd: null, blocked: null },
  ]

  it('finds people by the start of any of their names', async () => {
    const { searchPeople } = await import('@/lib/portal/fellowship')
    expect(searchPeople(people, 'mi').map((p) => p.id)).toEqual(['sv-1', 'sv-2'])
    expect(searchPeople(people, 'mar sam').map((p) => p.id)).toEqual(['st-1'])
    expect(searchPeople(people, 'testw').map((p) => p.id)).toEqual(['sv-1'])
  })

  it('needs something typed, and gives at most twenty', async () => {
    const { searchPeople } = await import('@/lib/portal/fellowship')
    expect(searchPeople(people, '  ')).toEqual([])
    const many = Array.from({ length: 40 }, (_, i) => ({ ...people[0]!, id: `sv-${i}` }))
    expect(searchPeople(many, 'mina')).toHaveLength(20)
  })
})

describe("the tags on a member's card", () => {
  it('names the classes a servant serves and their other meetings', async () => {
    const { memberTags } = await import('@/lib/portal/fellowship')
    const tags = memberTags(
      {
        classId: 'mens-meeting',
        className: "Men's Meeting",
        memberships: [
          { classId: 'youth-meeting', name: 'Youth Meeting', stage: 'FELLOWSHIP' },
          { classId: 'pre-servants', name: 'Pre-Servants', stage: 'HIGH_SCHOOL' },
        ],
        serves: ['KG', '5th & 6th Boys'],
      },
      'mens-meeting',
    )
    expect(tags).toEqual({ serves: ['KG', '5th & 6th Boys'], alsoIn: ['Youth Meeting'] })
  })

  it('names their home meeting when this one is their second', async () => {
    const { memberTags } = await import('@/lib/portal/fellowship')
    const tags = memberTags(
      { classId: 'youth-meeting', className: 'Youth Meeting', memberships: [{ classId: 'mens-meeting', name: "Men's Meeting", stage: 'FELLOWSHIP' }], serves: [] },
      'mens-meeting',
    )
    expect(tags).toEqual({ serves: [], alsoIn: ['Youth Meeting'] })
  })
})
