import { describe, it, expect } from 'vitest'
import {
  EXCUSE_MAX_DAYS,
  currentExcuse,
  excuseByLine,
  excuseDatesProblem,
  excuseState,
  excuseSummary,
  isExcusedOn,
  withExcusedDates,
  type ExcuseView,
} from '@/lib/portal/excuses'
import { absenceStreakAgainst, decideFollowUp, latestHeldStatus, type HistoryRow } from '@/lib/portal/attendance-rules'

/**
 * Follow-up excuses (2026-10-19): a servant says a child is away — travelling,
 * ill, a family matter — from one date to another. While it lasts the child
 * stays on every list, marked excused, and nobody is asked to follow them up.
 */

describe('excuseDatesProblem', () => {
  it('accepts a range, a single day, and a start in the past', () => {
    expect(excuseDatesProblem('2026-10-20', '2026-11-10')).toBeNull()
    expect(excuseDatesProblem('2026-10-25', '2026-10-25')).toBeNull()
    expect(excuseDatesProblem('2026-09-01', '2026-10-30')).toBeNull()
  })

  it('refuses an end before the start', () => {
    expect(excuseDatesProblem('2026-11-10', '2026-10-20')).toMatch(/ends before it starts/)
  })

  it('refuses a missing or impossible date', () => {
    expect(excuseDatesProblem('', '2026-10-20')).toMatch(/start and an end/)
    expect(excuseDatesProblem('2026-10-20', '2026-02-30')).toMatch(/start and an end/)
  })

  it(`allows at most ${EXCUSE_MAX_DAYS} days, which catches a mistyped year`, () => {
    expect(excuseDatesProblem('2026-01-01', '2026-12-31')).toBeNull()
    expect(excuseDatesProblem('2026-10-20', '2027-10-20')).toBeNull()
    expect(excuseDatesProblem('2026-10-20', '2027-10-21')).toMatch(/at most a year/)
  })
})

describe('excuseState and isExcusedOn', () => {
  const trip = { startsOn: '2026-10-20', endsOn: '2026-11-10' }

  it('is upcoming before it starts, active from the first day to the last, and past after', () => {
    expect(excuseState(trip, '2026-10-19')).toBe('upcoming')
    expect(excuseState(trip, '2026-10-20')).toBe('active')
    expect(excuseState(trip, '2026-11-10')).toBe('active')
    expect(excuseState(trip, '2026-11-11')).toBe('past')
  })

  it('covers a date when any excuse does', () => {
    const other = { startsOn: '2026-12-20', endsOn: '2026-12-31' }
    expect(isExcusedOn([trip, other], '2026-11-01')).toBe(true)
    expect(isExcusedOn([trip, other], '2026-12-25')).toBe(true)
    expect(isExcusedOn([trip, other], '2026-11-20')).toBe(false)
    expect(isExcusedOn([], '2026-11-01')).toBe(false)
  })
})

describe('currentExcuse', () => {
  const a = { id: 'a', startsOn: '2026-10-01', endsOn: '2026-10-25' }
  const b = { id: 'b', startsOn: '2026-10-15', endsOn: '2026-11-05' }
  const later = { id: 'later', startsOn: '2026-12-01', endsOn: '2026-12-10' }
  const old = { id: 'old', startsOn: '2026-08-01', endsOn: '2026-08-10' }

  it('is the active one that runs longest when two overlap', () => {
    expect(currentExcuse([a, b, later, old], '2026-10-20')?.id).toBe('b')
  })

  it('is the next one to start when none is active', () => {
    expect(currentExcuse([old, later], '2026-11-20')?.id).toBe('later')
  })

  it('is nothing when every excuse is over', () => {
    expect(currentExcuse([old], '2026-11-20')).toBeNull()
  })
})

describe('excuseSummary', () => {
  it('says until when for an excuse that is on', () => {
    expect(excuseSummary({ startsOn: '2026-10-20', endsOn: '2026-11-10' }, '2026-10-25')).toBe('Excused until Nov 10')
  })

  it('says the range for one that has not started', () => {
    expect(excuseSummary({ startsOn: '2026-10-20', endsOn: '2026-11-10' }, '2026-10-01')).toBe('Excused Oct 20 – Nov 10')
  })

  it('says a single day as one day', () => {
    expect(excuseSummary({ startsOn: '2026-10-25', endsOn: '2026-10-25' }, '2026-10-01')).toBe('Excused on Oct 25')
    expect(excuseSummary({ startsOn: '2026-10-25', endsOn: '2026-10-25' }, '2026-10-25')).toBe('Excused today')
  })

  it('says it is over for one that has ended', () => {
    expect(excuseSummary({ startsOn: '2026-08-01', endsOn: '2026-08-10' }, '2026-10-01')).toBe('Was excused Aug 1 – Aug 10')
  })
})

describe('excuseByLine', () => {
  const base: ExcuseView = {
    id: 'ex1',
    studentId: 'mina',
    startsOn: '2026-10-20',
    endsOn: '2026-11-10',
    reason: 'Travelling to Egypt',
    setBy: 'Mary Servant',
    // 8 PM in Tennessee on the 19th is already the 20th in UTC: church time decides.
    setAt: '2026-10-20T01:00:00.000Z',
    changedBy: null,
    changedAt: null,
  }

  it('names who set it and on which day, in church time', () => {
    expect(excuseByLine(base)).toBe('Set by Mary Servant on Oct 19')
  })

  it('adds who changed it last', () => {
    expect(excuseByLine({ ...base, changedBy: 'George Servant', changedAt: '2026-10-21T15:00:00.000Z' })).toBe(
      'Set by Mary Servant on Oct 19 · changed by George Servant on Oct 21',
    )
  })

  it('still reads when the servant’s account is gone', () => {
    expect(excuseByLine({ ...base, setBy: null })).toBe('Set by a former servant on Oct 19')
  })
})

describe('withExcusedDates and the follow-up rule', () => {
  // A class that meets every Sunday. The child came on 9-28, then went to
  // Egypt with their family from 10-05 to 10-26, and nobody marked the register
  // for them while they were gone.
  const held = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']
  const history: HistoryRow[] = [
    { date: '2026-09-21', status: 'PRESENT' },
    { date: '2026-09-28', status: 'PRESENT' },
  ]
  const trip = [{ startsOn: '2026-10-05', endsOn: '2026-10-26' }]
  const upTo = (date: string) => held.filter((d) => d <= date)

  it('without an excuse, the trip opens a case the first Sunday', () => {
    expect(absenceStreakAgainst(upTo('2026-10-05'), history)).toBe(1)
    expect(decideFollowUp({ streak: 1, threshold: 1, hasOpenAutoCase: false, latestHeld: 'ABSENT' })).toBe('open')
  })

  it('with one, no Sunday inside it counts against them', () => {
    for (const day of ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']) {
      const rows = withExcusedDates(upTo(day), history, trip)
      const streak = absenceStreakAgainst(upTo(day), rows)
      expect(streak, day).toBe(0)
      expect(decideFollowUp({ streak, threshold: 1, hasOpenAutoCase: false, latestHeld: latestHeldStatus(upTo(day), rows) })).toBe('none')
    }
  })

  it('after it ends, only the Sundays missed since count', () => {
    const rows = withExcusedDates(held, history, trip)
    expect(absenceStreakAgainst(held, rows)).toBe(1)
  })

  it('an open case is not closed by an excuse: the child has to be seen', () => {
    const rows = withExcusedDates(upTo('2026-10-12'), history, trip)
    expect(latestHeldStatus(upTo('2026-10-12'), rows)).toBe('EXCUSED')
    expect(decideFollowUp({ streak: 0, threshold: 1, hasOpenAutoCase: true, latestHeld: 'EXCUSED' })).toBe('none')
  })

  it('a child who came anyway is still present', () => {
    const came: HistoryRow[] = [...history, { date: '2026-10-12', status: 'PRESENT' }]
    const rows = withExcusedDates(upTo('2026-10-12'), came, trip)
    expect(latestHeldStatus(upTo('2026-10-12'), rows)).toBe('PRESENT')
  })

  it('never reaches back before the child joined', () => {
    // Joined 10-10. An excuse that began before then must not make the
    // Sundays before they joined count against them.
    const joined = '2026-10-10'
    const early = [{ startsOn: '2026-09-01', endsOn: '2026-10-05' }]
    const rows = withExcusedDates(held, [], early, joined)
    expect(rows).toEqual([])
    expect(absenceStreakAgainst(held, rows, joined)).toBe(absenceStreakAgainst(held, [], joined))
  })

  it('changes nothing when there is no excuse', () => {
    expect(withExcusedDates(held, history, [])).toEqual(history)
  })
})
