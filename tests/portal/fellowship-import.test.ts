import { describe, it, expect } from 'vitest'
import { MEMBER_TEMPLATE_CSV, membersCsv } from '@/lib/portal/fellowship'
import { parseCsvTable } from '@/lib/portal/csv'

// 2026-10-24 — a Fellowship meeting's members as a spreadsheet, and back in.
// The user's one emphasis was making it easy for servants to add members,
// "through the imports and exports".

describe("a meeting's members as a spreadsheet", () => {
  it('lists each member with their details, what they serve and how often they came', () => {
    const csv = membersCsv([
      {
        firstName: 'Mina', lastName: 'Testwell', phone: '6155550147', email: 'mina@example.com', dob: '1990-03-04', note: 'Brother of Mark',
        serves: ['KG'], otherMeetings: ['Youth Meeting'], memberSince: '2026-10-24', attended: 6, held: 8,
      },
      { firstName: 'Mary', lastName: 'Sampleton', phone: null, email: null, dob: null, note: null, serves: [], otherMeetings: [], memberSince: '2026-10-20', attended: 0, held: 0 },
    ])
    const { records } = parseCsvTable(csv)
    expect(records[0]).toEqual({
      'first name': 'Mina', 'last name': 'Testwell', phone: '(615) 555-0147', email: 'mina@example.com', birthday: '3/4/1990',
      note: 'Brother of Mark', serves: 'KG', 'other meetings': 'Youth Meeting', 'member since': '10/24/2026', attended: '6 of 8',
    })
    expect(records[1]).toMatchObject({ 'first name': 'Mary', phone: '', birthday: '', attended: '' })
  })

  it('keeps a cell that starts like a formula from running in a spreadsheet', () => {
    const csv = membersCsv([{ firstName: '=HYPERLINK("x")', lastName: 'X', phone: null, email: null, dob: null, note: null, serves: [], otherMeetings: [], memberSince: '2026-10-24', attended: 0, held: 0 }])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('the blank template has the columns the import reads, and no example to copy by mistake', () => {
    const { headers, records } = parseCsvTable(MEMBER_TEMPLATE_CSV)
    expect(headers).toEqual(['First Name', 'Last Name', 'Phone', 'Email', 'Birthday', 'Note'])
    expect(records).toEqual([])
  })
})

describe('reading a sheet of members', () => {
  it('reads first and last name columns, phone, email, birthday and note', async () => {
    const { parseMemberSheet } = await import('@/lib/portal/fellowship')
    const sheet = parseMemberSheet('First Name,Last Name,Phone,Email,Birthday,Note\nMina,Testwell,615-555-0147,mina@example.com,3/4/1990,Brother of Mark\n')
    expect(sheet.rows).toEqual([
      { row: 2, value: { firstName: 'Mina', lastName: 'Testwell', phone: '6155550147', email: 'mina@example.com', dob: '1990-03-04', note: 'Brother of Mark' } },
    ])
    expect(sheet.unread).toEqual([])
  })

  it('reads one Name column, and the usual other words for each column', async () => {
    const { parseMemberSheet } = await import('@/lib/portal/fellowship')
    const sheet = parseMemberSheet('Full Name,Cell,E-mail,DOB,Notes,Shirt size\nMary Sampleton,(615) 555-0199,,07/10/1985,,M\n')
    expect(sheet.rows[0]!.value).toMatchObject({ firstName: 'Mary', lastName: 'Sampleton', phone: '6155550199', dob: '1985-07-10' })
    expect(sheet.unread).toEqual(['Shirt size'])
  })

  it('takes cells copied straight from Google Sheets (tabs between them)', async () => {
    const { parseMemberSheet } = await import('@/lib/portal/fellowship')
    const sheet = parseMemberSheet('Name\tPhone\nAbanoub Hollis\t615 555 0123\nMark Tolbert\t\n')
    expect(sheet.rows.map((r) => r.value && `${r.value.firstName} ${r.value.lastName} ${r.value.phone ?? '-'}`)).toEqual(['Abanoub Hollis 6155550123', 'Mark Tolbert -'])
  })

  it('skips empty rows and a title above the headings, and numbers rows as the sheet does', async () => {
    const { parseMemberSheet } = await import('@/lib/portal/fellowship')
    const sheet = parseMemberSheet(',,\nMen’s Meeting list,,\nName,Phone,\n,,\nPeter Walker,6155550100,\n')
    expect(sheet.rows).toEqual([{ row: 5, value: expect.objectContaining({ firstName: 'Peter', lastName: 'Walker' }) }])
  })

  it('names what is wrong with a row, by its row number', async () => {
    const { parseMemberSheet } = await import('@/lib/portal/fellowship')
    const sheet = parseMemberSheet('Name,Phone,Birthday\n,6155550100,\nMina Testwell,12,\nMary Sampleton,,31/31/1990\n')
    expect(sheet.rows).toEqual([
      { row: 2, problem: 'No name' },
      { row: 3, problem: 'That phone number is too short.' },
      { row: 4, problem: 'Write the birthday as month/day/year.' },
    ])
  })

  it('says when the sheet has no name column at all', async () => {
    const { parseMemberSheet } = await import('@/lib/portal/fellowship')
    expect(parseMemberSheet('Phone,Email\n6155550100,a@example.com\n').error).toMatch(/Name/)
  })
})

describe('what importing each row does', () => {
  const people = [
    { kind: 'servant' as const, id: 'sv-1', name: 'Mina Testwell', firstName: 'Mina', lastName: 'Testwell', dob: null, where: 'Servant · KG', phoneEnd: null, blocked: null },
    { kind: 'member' as const, id: 'st-1', name: 'Mary Sampleton', firstName: 'Mary', lastName: 'Sampleton', dob: null, where: 'Member · Youth Meeting', phoneEnd: null, blocked: null },
    { kind: 'member' as const, id: 'st-2', name: 'Peter Walker', firstName: 'Peter', lastName: 'Walker', dob: null, where: 'Member · Men’s Meeting', phoneEnd: null, blocked: 'Already a member' },
    { kind: 'servant' as const, id: 'sv-2', name: 'Paul Exampleson', firstName: 'Paul', lastName: 'Exampleson', dob: null, where: 'Servant · Men’s Meeting', phoneEnd: null, blocked: "Serves Men's Meeting" },
    { kind: 'servant' as const, id: 'sv-3', name: 'Mark Tolbert', firstName: 'Mark', lastName: 'Tolbert', dob: null, where: 'Servant · 1st', phoneEnd: null, blocked: null },
    { kind: 'member' as const, id: 'st-3', name: 'Mark Tolbert', firstName: 'Mark', lastName: 'Tolbert', dob: null, where: 'Member · Youth Meeting', phoneEnd: null, blocked: null },
  ]
  const v = (firstName: string, lastName: string, dob: string | null = null) => ({ firstName, lastName, phone: null, email: null, dob, note: null })

  it('links a servant, and adds a member of another meeting', async () => {
    const { classifyMemberRow } = await import('@/lib/portal/fellowship')
    expect(classifyMemberRow(v('mina', 'TESTWELL'), people)).toEqual({ kind: 'servant', person: people[0] })
    expect(classifyMemberRow(v('Mary', 'Sampleton'), people)).toEqual({ kind: 'joins', person: people[1] })
  })

  it('skips someone already here, and refuses one of the meeting’s servants', async () => {
    const { classifyMemberRow } = await import('@/lib/portal/fellowship')
    expect(classifyMemberRow(v('Peter', 'Walker'), people)).toEqual({ kind: 'already', person: people[2] })
    expect(classifyMemberRow(v('Paul', 'Exampleson'), people)).toEqual({ kind: 'problem', message: "Serves Men's Meeting, so not a member of it" })
  })

  it('adds someone new, including a namesake with another birthday', async () => {
    const { classifyMemberRow } = await import('@/lib/portal/fellowship')
    expect(classifyMemberRow(v('Kiro', 'Newman'), people)).toEqual({ kind: 'new' })
    const withBirthday = people.map((p) => (p.id === 'sv-1' ? { ...p, dob: '1990-03-04' } : p))
    expect(classifyMemberRow(v('Mina', 'Testwell', '1970-01-01'), withBirthday)).toEqual({ kind: 'new' })
  })

  it('leaves two people of one name to be added by hand', async () => {
    const { classifyMemberRow } = await import('@/lib/portal/fellowship')
    expect(classifyMemberRow(v('Mark', 'Tolbert'), people)).toEqual({ kind: 'problem', message: '2 people in the portal are called Mark Tolbert. Add the right one on Add member.' })
  })
})
