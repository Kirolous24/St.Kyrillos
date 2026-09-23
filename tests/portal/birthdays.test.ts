import { describe, it, expect } from 'vitest'
import { upcomingBirthdays, birthdaysInWeek } from '@/lib/portal/birthdays'

describe('upcomingBirthdays', () => {
  const people = [
    { id: 'a', name: 'Today', dob: '2015-09-20' },
    { id: 'b', name: 'Tomorrow', dob: '2016-09-21' },
    { id: 'c', name: 'Last week', dob: '2014-09-13' },
    { id: 'd', name: 'In 30 days', dob: '2013-10-20' },
    { id: 'e', name: 'No dob', dob: null },
  ]
  it('returns people whose birthday falls within the window, soonest first, with age turning', () => {
    const rows = upcomingBirthdays(people, '2026-09-20', 14)
    expect(rows.map((r) => [r.id, r.daysUntil, r.turning])).toEqual([['a', 0, 11], ['b', 1, 10]])
  })
  it('includes the far one when the window is wide enough', () => {
    expect(upcomingBirthdays(people, '2026-09-20', 30).map((r) => r.id)).toEqual(['a', 'b', 'd'])
  })
})

// The prototype's birthday week was the calendar week, Monday to Sunday in ET.
// The port used a rolling 7 days from today, so by Sunday everyone whose
// birthday fell Monday-to-Saturday had silently dropped off the board — the
// servants who wanted to greet them never saw them. A calendar week has to be
// able to look backwards within the week, which a forward-only "upcoming"
// window structurally cannot.
describe('birthdaysInWeek', () => {
  const people = [
    { id: 'a', name: 'Mon Child', dob: '2015-09-14' },  // Monday of the test week
    { id: 'b', name: 'Wed Child', dob: '2014-09-16' },  // Wednesday
    { id: 'c', name: 'Sun Child', dob: '2016-09-20' },  // Sunday
    { id: 'd', name: 'Next Week', dob: '2015-09-22' },  // outside the week
    { id: 'e', name: 'No Date', dob: null },
  ]

  it('includes the whole Monday-to-Sunday week even when today is Sunday', () => {
    const got = birthdaysInWeek(people, '2026-09-14', '2026-09-20').map((b) => b.id)
    expect(got).toEqual(['a', 'b', 'c'])
  })

  it('reports a birthday already passed this week with a negative daysUntil', () => {
    const [mon] = birthdaysInWeek(people, '2026-09-14', '2026-09-20')
    expect(mon.daysUntil).toBe(-6)
    expect(mon.on).toBe('2026-09-14')
  })

  it('excludes anyone outside the week, and anyone with no date on file', () => {
    const got = birthdaysInWeek(people, '2026-09-14', '2026-09-14').map((b) => b.id)
    expect(got).not.toContain('d')
    expect(got).not.toContain('e')
  })

  it('computes the age they turn on the day itself', () => {
    const [, wed] = birthdaysInWeek(people, '2026-09-14', '2026-09-14')
    expect(wed.turning).toBe(12)
  })

  it('handles a week spanning the new year', () => {
    const nye = [{ id: 'x', name: 'Dec 30', dob: '2015-12-30' }, { id: 'y', name: 'Jan 2', dob: '2015-01-02' }]
    const got = birthdaysInWeek(nye, '2026-12-28', '2026-12-28').map((b) => b.id)
    expect(got).toEqual(['x', 'y'])
  })

  it('orders by the day within the week', () => {
    const got = birthdaysInWeek(people, '2026-09-14', '2026-09-14').map((b) => b.on)
    expect(got).toEqual(['2026-09-14', '2026-09-16', '2026-09-20'])
  })
})

