import { describe, it, expect } from 'vitest'
import { transformBackup, slugifyClassId, type BackupJson } from '@/lib/portal/import-transform'

const backup: BackupJson = {
  exportedAt: '2026-09-18T20:52:48.509Z',
  users: [
    {
      id: 'uid-admin', role: 'admin', name: 'Admin', email: 'admin@x.com', loginId: '1001', pin: '1111',
      createdAt: '2026-06-01T12:58:10.485Z',
    },
    {
      id: 'uid-pastor', role: 'pastor', name: 'Fr. Sample', email: 'fr@x.com', loginId: '1002', pin: '2222',
      classId: '', stage: '', createdAt: '2026-09-08T01:18:16.768Z', photo: 'data:image/jpeg;base64,AAA',
    },
    {
      id: 'uid-pastor-2', role: 'pastor', name: 'Fr Pachom', email: '', createdAt: '2026-09-08T01:18:16.768Z',
    },
    {
      id: 'uid-servant', role: 'servant', name: 'Mina Sample', email: 'mina.sample@example.com', loginId: '1003', pin: '3333',
      classId: '5th-&-6th-boys', stage: '5th & 6th Boys', birthday: '7/12/1990', phone: '(555) 010-0000',
      address: '439 valley spring dr', createdAt: '2026-08-31T18:23:01.835Z', stageOversight: 'middle_school',
    },
    {
      id: 'uid-unassigned', role: 'servant', name: 'Mona Nady', email: '', loginId: '7001', pin: '4444',
      classId: '', stage: '', createdAt: '2026-08-31T18:23:01.835Z',
    },
    {
      id: 'uid-student', role: 'student', name: 'Tawadrous, Maronia', email: 'mom@x.com', loginId: '3869', pin: '5555',
      classId: 'kg', stage: 'KG', grade: 'KG', dob: '2020-07-06', gender: 'female', phone: '',
      fatherName: 'F', fatherPhone: '555-010-0001', motherName: 'M', motherPhone: '', parentEmails: 'a@x.com; b@x.com',
      address: 'Welchcrest Dr.', createdAt: '2026-09-02T17:43:35.374Z',
    },
    {
      id: 'uid-student-dup', role: 'student', name: 'Maronia Tawadrous', email: '', loginId: '3870', pin: '6666',
      classId: 'pre-k', stage: 'Pre-K', dob: '2020-07-06', createdAt: '2026-09-02T17:43:35.374Z',
    },
    {
      id: 'uid-student-baddob', role: 'student', name: 'Jounier Fady', email: '', loginId: '3871', pin: '7777',
      classId: 'kg', stage: 'KG', dob: '2018-17-05', createdAt: '2026-09-02T17:43:35.374Z',
    },
    {
      id: 'uid-student-nologin', role: 'student', name: 'No Login', email: '', classId: 'kg', createdAt: '2026-09-02T17:43:35.374Z',
    },
  ],
  classes: [
    {
      id: 'kg', name: 'KG', stage: 'elementary', visitationThreshold: 1, createdAt: '2026-08-31T03:39:08.060Z',
      servants: [{ id: 'uid-servant', name: 'Mina Sample', title: 'Coordinator' }],
    },
    {
      id: 'pre-k', name: 'Pre-K', stage: 'elementary', createdAt: '2026-08-31T03:38:49.615Z', servants: [],
    },
    {
      id: '5th-&-6th-boys', name: '5th & 6th Boys', stage: 'middle_school', curriculumLinkedTo: '5th-&-6th-girls',
      createdAt: '2026-08-31T03:39:58.867Z',
      servants: [{ id: 'uid-servant', name: 'Mina Sample' }, { id: 'uid-ghost', name: 'Deleted Person' }],
    },
  ],
  settings: [
    { id: 'attendanceSessionPoints', liturgy: 2, sunday: 2, bible: 2, tasbeha: 5, hymns: 2, vespers: 2,
      extraSessions: [{ key: 'youth', label: 'Youth Meeting', pts: 3, icon: '⭐' }] },
    { id: 'church', phone: '' },
  ],
  activities: [
    { id: 'H3', key: 'H3', label: 'Homework', icon: '⭐', pts: 10, classId: 'kg', createdBy: 'uid-servant' },
    { id: '4th_liturgy', key: 'liturgy', label: 'Sunday Liturgy', icon: '<svg/>', pts: 2, classId: 'kg', createdBy: 'uid-servant' },
  ],
}

describe('slugifyClassId', () => {
  it('drops ampersands and collapses dashes', () => {
    expect(slugifyClassId('5th-&-6th-boys')).toBe('5th-6th-boys')
    expect(slugifyClassId('kg')).toBe('kg')
    expect(slugifyClassId('High School Girls')).toBe('high-school-girls')
  })
})

describe('transformBackup', () => {
  const out = transformBackup(backup)

  it('maps classes with normalized ids, stages and thresholds, in school order', () => {
    expect(out.classes.map((c) => c.id)).toEqual(['pre-k', 'kg', '5th-6th-boys'])
    const kg = out.classes.find((c) => c.id === 'kg')!
    expect(kg).toMatchObject({ name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1, sortOrder: 1 })
    const boys = out.classes.find((c) => c.id === '5th-6th-boys')!
    // The backup names no threshold for this class, so it falls back to the
    // church's rule — one missed Sunday, not the prototype's two.
    expect(boys).toMatchObject({ stage: 'MIDDLE_SCHOOL', visitationThreshold: 1, curriculumLinkedToId: '5th-6th-girls' })
  })

  it('creates one account per user with a login, keeping ids and PINs', () => {
    const byLegacy = Object.fromEntries(out.accounts.map((a) => [a.legacyUid, a]))
    expect(byLegacy['uid-admin']).toMatchObject({ loginId: '1001', pin: '1111', role: 'ADMIN', displayName: 'Admin' })
    expect(byLegacy['uid-pastor']).toMatchObject({ loginId: '1002', pin: '2222', role: 'PASTOR', photo: 'data:image/jpeg;base64,AAA' })
    expect(byLegacy['uid-servant']).toMatchObject({ role: 'SERVANT', email: 'mina.sample@example.com', phone: '5550100000' })
  })

  it('skips users without a loginId and reports them', () => {
    expect(out.accounts.find((a) => a.legacyUid === 'uid-pastor-2')).toBeUndefined()
    expect(out.accounts.find((a) => a.legacyUid === 'uid-student-nologin')).toBeUndefined()
    expect(out.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ legacyUid: 'uid-pastor-2', reason: 'no loginId' }),
        expect.objectContaining({ legacyUid: 'uid-student-nologin', reason: 'no loginId' }),
      ]),
    )
  })

  it('builds student profiles with split names, parsed dates, phones, parent emails', () => {
    const s = out.accounts.find((a) => a.legacyUid === 'uid-student')!
    expect(s.student).toMatchObject({
      firstName: 'Maronia',
      lastName: 'Tawadrous',
      classId: 'kg',
      dob: '2020-07-06',
      gender: 'female',
      grade: 'KG',
      fatherPhone: '5550100001',
      motherPhone: null,
      parentEmails: ['mom@x.com', 'a@x.com', 'b@x.com'],
    })
    expect(s.displayName).toBe('Maronia Tawadrous')
    expect(s.email).toBeNull()
  })

  it('flags invalid birthdays instead of failing', () => {
    const s = out.accounts.find((a) => a.legacyUid === 'uid-student-baddob')!
    expect(s.student?.dob).toBeNull()
    expect(s.student?.importNotes).toContain('Invalid birthday "2018-17-05"')
  })

  it('flags probable duplicates on both records', () => {
    const a = out.accounts.find((x) => x.legacyUid === 'uid-student')!
    const b = out.accounts.find((x) => x.legacyUid === 'uid-student-dup')!
    expect(a.student?.importNotes).toContain('Possible duplicate of Maronia Tawadrous (ID 3870, Pre-K)')
    expect(b.student?.importNotes).toContain('Possible duplicate of Maronia Tawadrous (ID 3869, KG)')
  })

  it('builds servant profiles with birthday, stage oversight and class memberships from the class docs', () => {
    const s = out.accounts.find((a) => a.legacyUid === 'uid-servant')!
    expect(s.servant).toMatchObject({ birthday: '1990-07-12', stageOversight: 'MIDDLE_SCHOOL' })
    expect(s.servant?.classes).toEqual([
      { classId: 'kg', title: 'COORDINATOR' },
      { classId: '5th-6th-boys', title: null },
    ])
    const unassigned = out.accounts.find((a) => a.legacyUid === 'uid-unassigned')!
    expect(unassigned.servant?.classes).toEqual([])
    expect(out.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Mona Nady')]))
  })

  it('ignores class servant entries that point at deleted users', () => {
    expect(out.warnings).toEqual(expect.arrayContaining([expect.stringContaining('uid-ghost')]))
  })

  it('maps attendance sessions from settings including extras', () => {
    expect(out.sessions).toEqual([
      { key: 'bible', label: 'Bible Study', points: 2, sortOrder: 0 },
      { key: 'vespers', label: 'Vespers', points: 2, sortOrder: 1 },
      { key: 'tasbeha', label: 'Tasbeha', points: 5, sortOrder: 2 },
      { key: 'liturgy', label: 'Liturgy', points: 2, sortOrder: 3 },
      { key: 'sunday', label: 'Sunday School', points: 2, sortOrder: 4 },
      { key: 'hymns', label: 'Hymns', points: 2, sortOrder: 5 },
      { key: 'youth', label: 'Youth Meeting', points: 3, sortOrder: 6, icon: '⭐' },
    ])
  })

  it('maps custom activities, dropping raw SVG icons', () => {
    expect(out.activities).toEqual([
      { classId: 'kg', key: 'H3', label: 'Homework', icon: '⭐', points: 10, createdByLegacyUid: 'uid-servant' },
      { classId: 'kg', key: 'liturgy', label: 'Sunday Liturgy', icon: null, points: 2, createdByLegacyUid: 'uid-servant' },
    ])
  })

  it('rejects duplicate loginIds', () => {
    const dup: BackupJson = { ...backup, users: [...backup.users, { ...backup.users[0], id: 'uid-x' }] }
    expect(() => transformBackup(dup)).toThrow(/duplicate loginId 1001/)
  })
})
