import { describe, it, expect } from 'vitest'
import { upcomingBirthdays } from '@/lib/portal/birthdays'

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
