import { describe, it, expect } from 'vitest'
import {
  assignedNotice,
  changedNotice,
  comingSunday,
  dailyReminderNotice,
  dutyChanges,
  dutyHref,
  notDoneNotice,
  removedNotice,
  reminderNotice,
  shouldEmail,
  type Duty,
} from '@/lib/portal/assignment-notices'

/**
 * Servant assignment notices (2026-10-19): a servant is told the moment they
 * are given, or taken off, a part of a Sunday class, and reminded the evening
 * before. These are the rules for who is told what, and the words.
 */

const TODAY = '2026-10-19' // a Monday; the next Sunday is Oct 25

const duty = (over: Partial<Duty> = {}): Duty => ({
  slot: 'item:5th-6th-boys:2026-10-19:coptic',
  kind: 'activity',
  servantId: 'A',
  label: 'Coptic',
  topic: null,
  className: '5th & 6th Boys',
  due: '2026-10-25',
  href: '/portal/assignments#week-2026-10-19',
  ...over,
})
const opts = { today: TODAY, actorServantId: null }

describe('dutyChanges', () => {
  it('a servant put on a slot gains it, and whoever held it loses it', () => {
    const before = [duty({ servantId: 'A' })]
    const after = [duty({ servantId: 'B' })]
    expect(dutyChanges(before, after, opts)).toEqual([
      { servantId: 'A', added: [], removed: [before[0]] },
      { servantId: 'B', added: [after[0]], removed: [] },
    ])
  })

  it('same servant on the same slot is no change', () => {
    expect(dutyChanges([duty({ topic: 'Letters 1–4' })], [duty({ topic: 'Letters 5–8' })], opts)).toEqual([])
  })

  it('nothing for the servant who made the change', () => {
    const changes = dutyChanges([duty({ servantId: 'A' })], [duty({ servantId: 'B' })], { today: TODAY, actorServantId: 'B' })
    expect(changes.map((c) => c.servantId)).toEqual(['A'])
  })

  it('nothing for a duty due before today, but today still counts', () => {
    expect(dutyChanges([], [duty({ due: '2026-10-18' })], opts)).toEqual([])
    expect(dutyChanges([], [duty({ due: TODAY })], opts)).toHaveLength(1)
  })

  it('an undated lesson is still a change', () => {
    const lesson = duty({ slot: 'lesson:l1', kind: 'lesson', label: 'Lesson “The Good Shepherd”', due: null, href: '/portal/assignments' })
    expect(dutyChanges([], [lesson], opts)).toEqual([{ servantId: 'A', added: [lesson], removed: [] }])
  })

  it('a cleared week takes every part off its servants', () => {
    const before = [duty({ servantId: 'A' }), duty({ slot: 'lead:5th-6th-boys:2026-10-19', kind: 'lead', label: 'Lead', servantId: 'B' })]
    expect(dutyChanges(before, [], opts).map((c) => [c.servantId, c.removed.length])).toEqual([
      ['A', 1],
      ['B', 1],
    ])
  })
})

describe('assignedNotice', () => {
  it('for one Sunday lists every part', () => {
    const memo = duty({ slot: 'item:5th-6th-boys:2026-10-19:memorization', label: 'Memorization' })
    expect(assignedNotice([duty(), memo])).toEqual({
      title: 'New assignments',
      body: 'You’re on Coptic and Memorization for Sunday, Oct 25 · 5th & 6th Boys',
      href: '/portal/assignments#week-2026-10-19',
    })
  })

  it('for one part', () => {
    expect(assignedNotice([duty({ kind: 'lead', label: 'Lead' })])).toMatchObject({
      title: 'New assignment',
      body: 'You’re on Lead for Sunday, Oct 25 · 5th & 6th Boys',
    })
  })

  it('across Sundays counts them', () => {
    const sundays = ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22']
    const duties = sundays.map((due, i) => duty({ slot: `s${i}`, due }))
    expect(assignedNotice(duties)).toEqual({
      title: 'New assignments',
      body: 'You have 5 new assignments, Oct 25 – Nov 22 · 5th & 6th Boys',
      href: '/portal/assignments#week-2026-10-19',
    })
  })

  it('reads three parts as a list, the class’s parts before Lead', () => {
    const parts = [
      duty({ slot: 'lead', kind: 'lead', label: 'Lead' }),
      duty({ slot: 'm', label: 'Memorization' }),
      duty({ slot: 'c', label: 'Coptic' }),
    ]
    expect(assignedNotice(parts).body).toBe('You’re on Memorization, Coptic and Lead for Sunday, Oct 25 · 5th & 6th Boys')
  })

  it('names both classes', () => {
    const other = duty({ slot: 'x', label: 'Verse', className: '7th & 8th Boys' })
    expect(assignedNotice([duty(), other]).body).toBe('You’re on Coptic and Verse for Sunday, Oct 25 · 5th & 6th Boys, 7th & 8th Boys')
  })

  it('for an undated lesson leaves the day out', () => {
    const lesson = duty({ slot: 'lesson:l1', kind: 'lesson', label: 'Lesson “The Good Shepherd”', due: null, href: '/portal/assignments' })
    expect(assignedNotice([lesson])).toEqual({
      title: 'New assignment',
      body: 'You’re on Lesson “The Good Shepherd” · 5th & 6th Boys',
      href: '/portal/assignments',
    })
  })

  it('for a lesson on another day names that day', () => {
    const lesson = duty({ slot: 'lesson:l2', kind: 'lesson', label: 'Lesson “Joseph”', due: '2026-10-24' })
    expect(assignedNotice([lesson]).body).toBe('You’re on Lesson “Joseph” for Saturday, Oct 24 · 5th & 6th Boys')
  })
})

describe('removedNotice', () => {
  it('for one Sunday', () => {
    expect(removedNotice([duty()])).toEqual({
      title: 'Assignment changed',
      body: 'You’re no longer on Coptic for Sunday, Oct 25 · 5th & 6th Boys',
      href: '/portal/assignments#week-2026-10-19',
    })
  })

  it('across Sundays', () => {
    const dues = ['2026-10-25', '2026-11-01', '2026-11-08']
    expect(removedNotice(dues.map((due, i) => duty({ slot: `s${i}`, due }))).body).toBe(
      '3 of your assignments were taken off, Oct 25 – Nov 8 · 5th & 6th Boys',
    )
  })
})

describe('changedNotice', () => {
  it('a servant moved within one save hears it once', () => {
    const verse = duty({ slot: 'v', label: 'Verse' })
    expect(changedNotice([verse], [duty()])).toEqual({
      title: 'Assignments changed',
      body: 'You’re on Verse for Sunday, Oct 25 · 5th & 6th Boys. You’re no longer on Coptic for Sunday, Oct 25 · 5th & 6th Boys',
      href: '/portal/assignments#week-2026-10-19',
    })
  })
})

describe('reminderNotice', () => {
  it('names everything for tomorrow, with its topic', () => {
    const memo = duty({ slot: 'm', label: 'Memorization' })
    expect(reminderNotice([duty({ topic: 'Lesson 4 letters' }), memo])).toEqual({
      title: 'Reminder for tomorrow',
      body: 'Coptic (Lesson 4 letters) and Memorization · 5th & 6th Boys',
      href: '/portal/assignments#week-2026-10-19',
    })
  })
})

describe('notDoneNotice', () => {
  it('names each part still not marked done, and who is on it', () => {
    expect(
      notDoneNotice(
        [
          { label: 'Coptic', servantName: 'Mina S', className: '5th & 6th Boys' },
          { label: 'Verse', servantName: 'George S', className: '5th & 6th Boys' },
        ],
        '/portal/agenda?class=boys&week=2026-10-19',
      ),
    ).toEqual({
      title: 'Not marked done yet',
      body: 'For tomorrow: Coptic (Mina S) and Verse (George S) · 5th & 6th Boys',
      href: '/portal/agenda?class=boys&week=2026-10-19',
    })
  })
})

describe('dutyHref', () => {
  it('opens My Assignments at the week of the day', () => {
    expect(dutyHref('2026-10-25')).toBe('/portal/assignments#week-2026-10-19')
    expect(dutyHref(null)).toBe('/portal/assignments')
  })
})

describe('shouldEmail', () => {
  it('emails a servant with an address whose phones are all off', () => {
    expect(shouldEmail({ email: 'a@b.c', noticeEmails: true, pushDevices: 0 })).toBe(true)
  })

  it('not when a phone is on, there is no address, or they turned email off', () => {
    expect(shouldEmail({ email: 'a@b.c', noticeEmails: true, pushDevices: 1 })).toBe(false)
    expect(shouldEmail({ email: null, noticeEmails: true, pushDevices: 0 })).toBe(false)
    expect(shouldEmail({ email: '  ', noticeEmails: true, pushDevices: 0 })).toBe(false)
    expect(shouldEmail({ email: 'a@b.c', noticeEmails: false, pushDevices: 0 })).toBe(false)
  })
})

// Daily reminders (2026-10-25): every evening but Saturday's, the coming
// Sunday's parts a servant has not marked done.
describe('comingSunday', () => {
  it('is the first Sunday after the day', () => {
    expect(comingSunday('2026-10-19')).toBe('2026-10-25') // Monday
    expect(comingSunday('2026-10-21')).toBe('2026-10-25') // Wednesday
    expect(comingSunday('2026-10-24')).toBe('2026-10-25') // Saturday
  })

  it('on a Sunday, is the next one', () => {
    expect(comingSunday('2026-10-25')).toBe('2026-11-01')
  })
})

describe('dailyReminderNotice', () => {
  it('names the parts still to do, with their topics, and how to stop it', () => {
    expect(
      dailyReminderNotice([duty({ label: 'Agpeya', topic: 'St. Mary' }), duty({ label: 'Coptic' })], '2026-10-25'),
    ).toEqual({
      title: 'Reminder for Sunday, Oct 25',
      body: 'Agpeya (St. Mary) and Coptic · 5th & 6th Boys. Tap Mark done on each once it’s ready.',
      href: '/portal/assignments#week-2026-10-19',
    })
  })

  it('one part is "it"', () => {
    expect(dailyReminderNotice([duty({ label: 'Verse' })], '2026-11-01').body).toBe(
      'Verse · 5th & 6th Boys. Tap Mark done once it’s ready.',
    )
  })
})
