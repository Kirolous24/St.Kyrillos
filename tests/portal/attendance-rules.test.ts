import { describe, it, expect } from 'vitest'
import { absenceStreak, absenceStreakAgainst, decideFollowUp } from '@/lib/portal/attendance-rules'

type S = 'PRESENT' | 'EXCUSED' | 'ABSENT'
const h = (rows: Array<[string, S]>) => rows.map(([date, status]) => ({ date, status }))

describe('absenceStreak', () => {
  it('counts consecutive absences from the latest session backward', () => {
    expect(absenceStreak(h([['2026-09-06', 'PRESENT'], ['2026-09-13', 'ABSENT'], ['2026-09-20', 'ABSENT']]))).toBe(2)
  })
  it('is zero when the latest session was attended', () => {
    expect(absenceStreak(h([['2026-09-13', 'ABSENT'], ['2026-09-20', 'PRESENT']]))).toBe(0)
  })
  it('an excused absence breaks the streak', () => {
    expect(absenceStreak(h([['2026-09-06', 'ABSENT'], ['2026-09-13', 'EXCUSED'], ['2026-09-20', 'ABSENT']]))).toBe(1)
  })
  it('does not depend on input order', () => {
    expect(absenceStreak(h([['2026-09-20', 'ABSENT'], ['2026-09-06', 'PRESENT'], ['2026-09-13', 'ABSENT']]))).toBe(2)
  })
  it('is zero with no history', () => {
    expect(absenceStreak([])).toBe(0)
  })
})

describe('decideFollowUp', () => {
  it('opens a case when the streak reaches the class threshold and none is open', () => {
    expect(decideFollowUp({ streak: 2, threshold: 2, hasOpenAutoCase: false })).toBe('open')
  })
  it('does nothing below the threshold', () => {
    expect(decideFollowUp({ streak: 1, threshold: 2, hasOpenAutoCase: false })).toBe('none')
  })
  it('does not open twice', () => {
    expect(decideFollowUp({ streak: 3, threshold: 2, hasOpenAutoCase: true })).toBe('none')
  })
  it('closes an open automatic case once the student is back', () => {
    expect(decideFollowUp({ streak: 0, threshold: 2, hasOpenAutoCase: true })).toBe('close')
  })
  it('keeps an open case while the streak is merely shrinking but not zero', () => {
    expect(decideFollowUp({ streak: 1, threshold: 2, hasOpenAutoCase: true })).toBe('none')
  })
})

// attendanceRate() used to live here too, but it only ever saw one student's
// own rows and so had no way to notice a session that was held but never
// got a row for this student at all (e.g. the rest of a class group-QR
// check-in). That roster-aware rate now lives solely in lib/portal/reports.ts
// (see tests/portal/reports.test.ts, "scores one student against the whole
// class calendar when given occasions") and every caller uses it.

describe('absenceStreakAgainst', () => {
  const held = ['2026-09-06', '2026-09-13', '2026-09-20']

  it('counts a Sunday the class held that the student has no row for', () => {
    // QR check-in only writes rows for the students who scanned, so the last
    // two Sundays leave no trace on this student at all.
    expect(absenceStreakAgainst(held, h([['2026-09-06', 'PRESENT']]))).toBe(2)
  })

  it('still resets on the most recent attendance', () => {
    expect(absenceStreakAgainst(held, h([['2026-09-06', 'ABSENT'], ['2026-09-20', 'PRESENT']]))).toBe(0)
  })

  it('an excused Sunday breaks the streak, a missing row does not', () => {
    expect(absenceStreakAgainst(held, h([['2026-09-06', 'PRESENT'], ['2026-09-13', 'EXCUSED']]))).toBe(1)
  })

  it('ignores sessions held before the student ever appeared', () => {
    expect(absenceStreakAgainst(held, h([['2026-09-20', 'PRESENT']]))).toBe(0)
    expect(absenceStreakAgainst([...held, '2026-09-27'], h([['2026-09-20', 'PRESENT']]))).toBe(1)
  })

  it('is zero for a student with no record at all', () => {
    expect(absenceStreakAgainst(held, [])).toBe(0)
  })
})
