import { describe, it, expect } from 'vitest'
import { assignmentsByDay, type Assignment } from '@/lib/portal/agenda'

/** My Assignments as a calendar (2026-11-01): each assignment on the day it falls. */

const make = (over: Partial<Assignment>): Assignment => ({
  id: over.id ?? 'x',
  kind: 'agenda',
  weekStart: '2026-11-02',
  classId: 'girls',
  className: '5th & 6th Girls',
  title: 'Song',
  detail: null,
  date: null,
  href: '/portal/agenda',
  ...over,
})

describe('assignmentsByDay', () => {
  it('puts a part of the Schedule on its Sunday, and a lesson on its own date', () => {
    const days = assignmentsByDay(
      [
        make({ id: 'song', title: 'Song', sortHint: 1 }),
        make({ id: 'lead', kind: 'lead', title: 'Lead servant' }),
        make({ id: 'lesson', kind: 'lesson', title: 'Joseph', date: '2026-11-04', weekStart: '2026-11-02' }),
      ],
      '2026-11-01',
      '2026-11-30',
    )
    expect(Array.from(days.keys())).toEqual(['2026-11-04', '2026-11-08'])
    // Lead before the class's parts, as on the list.
    expect(days.get('2026-11-08')!.map((a) => a.id)).toEqual(['lead', 'song'])
  })

  it('leaves out what falls outside the span, and lessons with no date', () => {
    const days = assignmentsByDay(
      [
        make({ id: 'before', weekStart: '2026-10-19' }),
        make({ id: 'after', weekStart: '2026-11-30' }),
        make({ id: 'undated', kind: 'lesson', weekStart: null, date: null }),
        make({ id: 'in', weekStart: '2026-11-23' }),
      ],
      '2026-11-01',
      '2026-11-30',
    )
    expect(Array.from(days.keys())).toEqual(['2026-11-29'])
    expect(days.get('2026-11-29')!.map((a) => a.id)).toEqual(['in'])
  })
})
