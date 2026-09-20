import { describe, it, expect } from 'vitest'
import {
  buildNotifications,
  unreadNotifications,
  ANNOUNCEMENT_FRESH_DAYS,
  STREAK_ALERT,
  type NotificationFacts,
} from '@/lib/portal/notifications'

// A Saturday, so "this week" is the Monday of 2026-09-14.
const TODAY = '2026-09-19'
const base: NotificationFacts = { today: TODAY }
const keys = (facts: Parameters<typeof buildNotifications>[1], role: Parameters<typeof buildNotifications>[0]) =>
  buildNotifications(role, facts).map((n) => n.key)

describe('buildNotifications — student', () => {
  it('lists a quiz the student has not taken, warning when it is due soon', () => {
    const items = buildNotifications('STUDENT', {
      ...base,
      pendingExams: [
        { id: 'e1', title: 'Gospel of St Mark', dueDate: '2026-09-21' },
        { id: 'e2', title: 'Hymns', dueDate: '2026-10-30' },
      ],
    })
    expect(items.map((n) => n.key)).toContain('exam:e1')
    expect(items.find((n) => n.key === 'exam:e1')!.tone).toBe('warn')
    expect(items.find((n) => n.key === 'exam:e2')!.tone).toBe('info')
    expect(items.find((n) => n.key === 'exam:e1')!.href).toBe('/portal/quizzes')
  })

  it('drops a quiz whose due date has already passed', () => {
    const items = buildNotifications('STUDENT', {
      ...base,
      pendingExams: [{ id: 'old', title: 'Last month', dueDate: '2026-09-01' }],
    })
    expect(items).toHaveLength(0)
  })

  it('keeps a quiz with no due date at all', () => {
    const items = buildNotifications('STUDENT', {
      ...base,
      pendingExams: [{ id: 'e', title: 'Open quiz', dueDate: null }],
    })
    expect(items).toHaveLength(1)
    expect(items[0]!.detail).toBe('No due date')
  })

  it('shows announcements newer than five days and nothing older', () => {
    const items = buildNotifications('STUDENT', {
      ...base,
      announcements: [
        { id: 'fresh', title: 'Trip on Saturday', date: '2026-09-18' },
        { id: 'edge', title: 'Five days old', date: '2026-09-14' },
        { id: 'stale', title: 'Six days old', date: '2026-09-13' },
        { id: 'future', title: 'Typo in the date', date: '2026-10-01' },
      ],
    })
    expect(items.map((n) => n.key)).toEqual(['announcement:fresh', 'announcement:edge'])
    expect(ANNOUNCEMENT_FRESH_DAYS).toBe(5)
  })

  it('greets the student on their own birthday only', () => {
    expect(keys({ ...base, ownBirthday: '2012-09-19' }, 'STUDENT')).toEqual([`birthday:self:${TODAY}`])
    expect(keys({ ...base, ownBirthday: '2012-09-20' }, 'STUDENT')).toEqual([])
  })

  it('ignores servant and admin facts entirely', () => {
    const items = buildNotifications('STUDENT', {
      ...base,
      openCases: 9,
      absenceStreaks: [{ studentId: 'x', name: 'X', streak: 7 }],
      classesWithoutServants: [{ id: 'kg', name: 'KG' }],
    })
    expect(items).toEqual([])
  })
})

describe('buildNotifications — servant', () => {
  it('summarises the birthdays falling in the next week', () => {
    const items = buildNotifications('SERVANT', {
      ...base,
      birthdays: [
        { id: 'a', name: 'Mina', dob: '2013-09-20' },
        { id: 'b', name: 'Sara', dob: '2014-09-25' },
        { id: 'c', name: 'Far away', dob: '2014-12-01' },
      ],
    })
    expect(items).toHaveLength(1)
    expect(items[0]!.key).toBe('birthdays:2026-09-14')
    expect(items[0]!.title).toBe('2 birthdays this week')
    expect(items[0]!.detail).toBe('Mina, Sara')
    expect(items[0]!.href).toBe('/portal/birthdays')
  })

  it('names only the first four and counts the rest', () => {
    const items = buildNotifications('SERVANT', {
      ...base,
      birthdays: ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ id: name, name, dob: `2013-09-2${i}` })),
    })
    expect(items[0]!.detail).toBe('A, B, C, D, +1 more')
  })

  it('raises a streak of three or more missed Sundays, worst first', () => {
    const items = buildNotifications('SERVANT', {
      ...base,
      absenceStreaks: [
        { studentId: 's1', name: 'Mina', streak: 3 },
        { studentId: 's2', name: 'Sara', streak: 2 },
      ],
      openCases: 4,
    })
    expect(items[0]!.key).toBe('streak:s1:3')
    expect(items[0]!.tone).toBe('bad')
    expect(items.map((n) => n.key)).not.toContain('streak:s2:2')
    expect(STREAK_ALERT).toBe(3)
  })

  it('embeds the count in the open-cases key so a new case is not silenced', () => {
    expect(keys({ ...base, openCases: 3 }, 'SERVANT')).toEqual(['cases:open:3'])
    expect(keys({ ...base, openCases: 4 }, 'SERVANT')).toEqual(['cases:open:4'])
    expect(keys({ ...base, openCases: 0 }, 'SERVANT')).toEqual([])
  })

  it('does not tell a servant about classes with no servant', () => {
    expect(keys({ ...base, classesWithoutServants: [{ id: 'kg', name: 'KG' }] }, 'SERVANT')).toEqual([])
  })
})

describe('buildNotifications — admin and pastor', () => {
  it('tells the admin about classes with nobody serving them', () => {
    const items = buildNotifications('ADMIN', {
      ...base,
      classesWithoutServants: [
        { id: 'kg', name: 'KG' },
        { id: '1st', name: '1st Grade' },
      ],
      openCases: 2,
    })
    expect(items.map((n) => n.key)).toEqual(['classes-without-servants:2', 'cases:open:2'])
    expect(items[0]!.title).toBe('2 classes without a servant')
    expect(items[0]!.href).toBe('/portal/admin/classes')
  })

  it('gives the pastor only the open cases', () => {
    const items = buildNotifications('PASTOR', {
      ...base,
      openCases: 6,
      classesWithoutServants: [{ id: 'kg', name: 'KG' }],
      birthdays: [{ id: 'a', name: 'Mina', dob: '2013-09-20' }],
    })
    expect(items.map((n) => n.key)).toEqual(['cases:open:6'])
  })

  it('says nothing at all when there is nothing to say', () => {
    expect(buildNotifications('ADMIN', base)).toEqual([])
    expect(buildNotifications('PASTOR', base)).toEqual([])
    expect(buildNotifications('SERVANT', base)).toEqual([])
    expect(buildNotifications('STUDENT', base)).toEqual([])
  })
})

describe('ordering and dismissal', () => {
  it('puts the most urgent tone first and keeps insertion order within a tone', () => {
    const items = buildNotifications('SERVANT', {
      ...base,
      birthdays: [{ id: 'a', name: 'Mina', dob: '2013-09-20' }],
      absenceStreaks: [{ studentId: 's1', name: 'Mina', streak: 4 }],
      openCases: 1,
    })
    expect(items.map((n) => n.tone)).toEqual(['bad', 'warn', 'good'])
  })

  it('every notification carries a stable key, a title, an href and a tone', () => {
    const items = buildNotifications('SERVANT', {
      ...base,
      openCases: 1,
      absenceStreaks: [{ studentId: 's1', name: 'Mina', streak: 4 }],
    })
    for (const n of items) {
      expect(n.key).toMatch(/\S/)
      expect(n.title).toMatch(/\S/)
      expect(n.href.startsWith('/portal')).toBe(true)
      expect(['info', 'good', 'warn', 'bad']).toContain(n.tone)
    }
  })

  it('is deterministic: the same facts produce the same keys', () => {
    const facts: NotificationFacts = { ...base, openCases: 2, absenceStreaks: [{ studentId: 's', name: 'S', streak: 5 }] }
    expect(keys(facts, 'SERVANT')).toEqual(keys(facts, 'SERVANT'))
  })

  it('filters out the keys this person has already dismissed', () => {
    const items = buildNotifications('ADMIN', { ...base, openCases: 2, classesWithoutServants: [{ id: 'kg', name: 'KG' }] })
    expect(unreadNotifications(items, ['cases:open:2']).map((n) => n.key)).toEqual(['classes-without-servants:1'])
    expect(unreadNotifications(items, items.map((n) => n.key))).toEqual([])
    expect(unreadNotifications(items, [])).toHaveLength(2)
  })
})
