import { describe, it, expect, beforeEach } from 'vitest'
import { createMember, joinMeeting, leaveMeeting, syncMemberFromServant } from '@/lib/portal/data/fellowship'
import { LOGIN_ID_RE } from '@/lib/portal/login'
import { MEMBER_NO_LOGIN_HASH } from '@/lib/portal/fellowship'

// 2026-10-24 — what joining and leaving a Fellowship meeting writes. A stand-in
// database: the account rows the functions read, and every write they make.

type Row = Record<string, unknown>
let accounts: Row[]
let writes: Array<{ op: string; args: Row }>

function db() {
  const record = (op: string) => async (args: Row) => {
    writes.push({ op, args })
    return op === 'student.create' ? { id: 'st-new' } : op === 'account.create' ? { id: 'acc-new', student: { id: 'st-new' } } : {}
  }
  const byAccount = (pred: (a: Row) => boolean) => accounts.find(pred) ?? null
  return {
    servant: { findUnique: async ({ where }: { where: { id: string } }) => {
      const a = byAccount((x) => (x.servant as Row | null)?.id === where.id)
      return a ? { account: a } : null
    } },
    student: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const a = byAccount((x) => (x.student as Row | null)?.id === where.id)
        return a ? { account: a } : null
      },
      create: record('student.create'),
      update: record('student.update'),
    },
    account: {
      findUnique: async ({ where }: { where: { id: string } }) => byAccount((x) => x.id === where.id),
      create: record('account.create'),
      delete: record('account.delete'),
    },
    classMember: { create: record('classMember.create'), delete: record('classMember.delete') },
    followUpCase: { updateMany: record('followUpCase.updateMany') },
  } as never
}

const mens = { id: 'mens-meeting', name: "Men's Meeting" }
const birthday = new Date('1990-03-04T00:00:00Z')

function servant(over: Row = {}): Row {
  return {
    id: 'acc-sv', role: 'SERVANT', displayName: 'Paul Exampleson',
    servant: { id: 'sv-1', birthday, classes: [{ classId: '5th-6th-boys' }] },
    student: null,
    ...over,
  }
}

beforeEach(() => {
  writes = []
  accounts = []
})

describe('a servant joining a meeting', () => {
  it('gets a member side on their own account, named and dated as their servant profile', async () => {
    accounts = [servant()]
    const r = await joinMeeting(db(), mens, { kind: 'servant', id: 'sv-1' }, 'acc-by')
    expect(r).toEqual({ studentId: 'st-new', name: 'Paul Exampleson', plan: 'create-home' })
    expect(writes).toEqual([
      { op: 'student.create', args: expect.objectContaining({ data: { accountId: 'acc-sv', firstName: 'Paul', lastName: 'Exampleson', dob: birthday, classId: 'mens-meeting' } }) },
    ])
  })

  it('who grew up here brings the record they already have', async () => {
    accounts = [servant({ student: { id: 'st-old', classId: null, memberships: [] } })]
    const r = await joinMeeting(db(), mens, { kind: 'servant', id: 'sv-1' }, 'acc-by')
    expect(r.plan).toBe('set-home')
    expect(writes.map((w) => w.op)).toEqual(['student.update'])
    expect(writes[0]!.args).toMatchObject({ where: { id: 'st-old' }, data: { classId: 'mens-meeting', firstName: 'Paul', lastName: 'Exampleson', dob: birthday } })
  })

  it('already in the Youth Meeting joins the Men’s as a second meeting', async () => {
    accounts = [servant({ student: { id: 'st-y', classId: 'youth-meeting', memberships: [] } })]
    const r = await joinMeeting(db(), mens, { kind: 'servant', id: 'sv-1' }, 'acc-by')
    expect(r.plan).toBe('add-member')
    expect(writes).toEqual([{ op: 'classMember.create', args: { data: { classId: 'mens-meeting', studentId: 'st-y', addedById: 'acc-by' } } }])
  })

  it('who serves the meeting is refused, and nothing is written', async () => {
    accounts = [servant({ servant: { id: 'sv-1', birthday, classes: [{ classId: 'mens-meeting' }] } })]
    await expect(joinMeeting(db(), mens, { kind: 'servant', id: 'sv-1' }, 'acc-by')).rejects.toThrow(/serves Men's Meeting/)
    expect(writes).toEqual([])
  })
})

describe('a new person', () => {
  it('gets an account that can never sign in, and their record in the meeting', async () => {
    const r = await createMember(db(), mens, { firstName: 'Mina', lastName: 'Testwell', phone: '6155550147', email: 'mina@example.com', dob: '1990-03-04', note: 'Brother of Mark' })
    expect(r).toEqual({ studentId: 'st-new', accountId: 'acc-new' })
    const data = (writes[0]!.args as { data: Row }).data
    expect(data.role).toBe('MEMBER')
    expect(LOGIN_ID_RE.test(String(data.loginId))).toBe(false)
    expect(data.pinHash).toBe(MEMBER_NO_LOGIN_HASH)
    expect(data.pinSealed).toBeNull()
    expect(data).toMatchObject({ displayName: 'Mina Testwell', phone: '6155550147', email: 'mina@example.com' })
    expect((data.student as { create: Row }).create).toEqual({
      firstName: 'Mina', lastName: 'Testwell', dob: new Date('1990-03-04T00:00:00.000Z'), notes: 'Brother of Mark', classId: 'mens-meeting',
    })
  })
})

describe('leaving a meeting', () => {
  it('a member who does not serve, leaving their only meeting, keeps their record and history', async () => {
    accounts = [{ id: 'acc-m', role: 'MEMBER', displayName: 'Mina Testwell', servant: null, student: { id: 'st-m', classId: 'mens-meeting', memberships: [] } }]
    expect(await leaveMeeting(db(), mens, 'st-m', 'acc-by')).toEqual({ plan: 'clear-home', name: 'Mina Testwell' })
    expect(writes.map((w) => w.op)).toEqual(['followUpCase.updateMany', 'student.update'])
    expect(writes.some((w) => w.op === 'account.delete')).toBe(false)
  })

  it('leaving their home meeting while in another moves home there, and closes the cases here', async () => {
    accounts = [{
      id: 'acc-m', role: 'MEMBER', displayName: 'Mina Testwell', servant: null,
      student: { id: 'st-m', classId: 'mens-meeting', memberships: [{ classId: 'youth-meeting', class: { stage: 'FELLOWSHIP' } }] },
    }]
    expect(await leaveMeeting(db(), mens, 'st-m', 'acc-by')).toEqual({ plan: 'promote', name: 'Mina Testwell', newHome: 'youth-meeting' })
    expect(writes.map((w) => w.op)).toEqual(['followUpCase.updateMany', 'classMember.delete', 'student.update'])
    expect(writes[0]!.args).toMatchObject({ where: { studentId: 'st-m', classId: 'mens-meeting', status: 'OPEN' }, data: { status: 'DONE' } })
    expect(writes[2]!.args).toMatchObject({ data: { classId: 'youth-meeting', groupServantId: null } })
  })

  it('a servant keeps their login and their record', async () => {
    accounts = [servant({ student: { id: 'st-s', classId: 'mens-meeting', memberships: [] } })]
    expect((await leaveMeeting(db(), mens, 'st-s', 'acc-by')).plan).toBe('clear-home')
    expect(writes.map((w) => w.op)).toEqual(['followUpCase.updateMany', 'student.update'])
    expect(writes.some((w) => w.op === 'account.delete')).toBe(false)
  })
})

describe("a servant's member side follows their servant profile", () => {
  it('takes the new name and birthday when the servant is saved', async () => {
    accounts = [{ id: 'acc-sv', displayName: 'Paul Exampleson Jr', servant: { birthday }, student: { id: 'st-s', class: { stage: 'FELLOWSHIP' }, memberships: [] } }]
    await syncMemberFromServant(db(), 'acc-sv')
    expect(writes).toEqual([{ op: 'student.update', args: { where: { id: 'st-s' }, data: { firstName: 'Paul', lastName: 'Exampleson Jr', dob: birthday } } }])
  })

  it('leaves a childhood record alone when they are in no meeting', async () => {
    accounts = [{ id: 'acc-sv', displayName: 'Paul Exampleson', servant: { birthday }, student: { id: 'st-s', class: null, memberships: [] } }]
    await syncMemberFromServant(db(), 'acc-sv')
    expect(writes).toEqual([])
  })
})
