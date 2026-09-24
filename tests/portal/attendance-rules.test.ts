import { describe, it, expect } from 'vitest'
import {
  absenceStreak,
  absenceStreakAgainst,
  decideFollowUp,
  latestHeldStatus,
  isFutureDate,
  attendanceChanges,
} from '@/lib/portal/attendance-rules'

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
    expect(decideFollowUp({ streak: 2, threshold: 2, hasOpenAutoCase: false, latestHeld: 'ABSENT' })).toBe('open')
  })
  // The church moved to one missed Sunday on 2026-09-23, so this is the live
  // rule rather than an edge case — a single absence has to raise a case, and
  // an excused Sunday still must not.
  it('opens on the very first miss when the threshold is 1', () => {
    expect(decideFollowUp({ streak: 1, threshold: 1, hasOpenAutoCase: false, latestHeld: 'ABSENT' })).toBe('open')
  })

  it('does not open on an excused Sunday, even at a threshold of 1', () => {
    // An excused week never enters the streak, so there is nothing to act on.
    expect(decideFollowUp({ streak: 0, threshold: 1, hasOpenAutoCase: false, latestHeld: 'EXCUSED' })).toBe('none')
  })

  it('closes on the first Sunday back when the threshold is 1', () => {
    expect(decideFollowUp({ streak: 0, threshold: 1, hasOpenAutoCase: true, latestHeld: 'PRESENT' })).toBe('close')
  })

  it('does nothing below the threshold', () => {
    expect(decideFollowUp({ streak: 1, threshold: 2, hasOpenAutoCase: false, latestHeld: 'ABSENT' })).toBe('none')
  })
  it('does not open twice', () => {
    expect(decideFollowUp({ streak: 3, threshold: 2, hasOpenAutoCase: true, latestHeld: 'ABSENT' })).toBe('none')
  })
  it('closes an open automatic case once the student is actually back', () => {
    expect(decideFollowUp({ streak: 0, threshold: 2, hasOpenAutoCase: true, latestHeld: 'PRESENT' })).toBe('close')
  })
  it('keeps an open case while the streak is merely shrinking but not zero', () => {
    expect(decideFollowUp({ streak: 1, threshold: 2, hasOpenAutoCase: true, latestHeld: 'ABSENT' })).toBe('none')
  })

  /**
   * F0462 — the defect this rule exists to prevent, which had come back through
   * a side door. EXCUSED is not ABSENT, so `absenceStreak` stops at it and the
   * streak reads zero — but excused means the child was NOT in the room. Closing
   * on that wrote "attending_again" and "Back on <date>" into a child's pastoral
   * record when nobody had seen them.
   */
  it('does NOT close a case for a child who was excused, not present', () => {
    expect(decideFollowUp({ streak: 0, threshold: 2, hasOpenAutoCase: true, latestHeld: 'EXCUSED' })).toBe('none')
  })

  it('does not close a case on no evidence at all', () => {
    expect(decideFollowUp({ streak: 0, threshold: 2, hasOpenAutoCase: true, latestHeld: null })).toBe('none')
  })

  it('needs the streak AND the presence, not either one', () => {
    // Present today but still carrying absences behind it: the streak governs.
    expect(decideFollowUp({ streak: 2, threshold: 2, hasOpenAutoCase: true, latestHeld: 'PRESENT' })).toBe('none')
  })
})

/**
 * F0462 — the same rule read off real held Sundays rather than a bare number,
 * which is how the excused case reached production.
 */
describe('latestHeldStatus', () => {
  const held = ['2026-09-06', '2026-09-13', '2026-09-20']

  it('reads the most recent Sunday the class held', () => {
    expect(latestHeldStatus(held, [
      { date: '2026-09-06', status: 'ABSENT' },
      { date: '2026-09-20', status: 'PRESENT' },
    ], '2026-09-01')).toBe('PRESENT')
  })

  it('reports an excused child as excused, not as back', () => {
    expect(latestHeldStatus(held, [
      { date: '2026-09-06', status: 'ABSENT' },
      { date: '2026-09-13', status: 'ABSENT' },
      { date: '2026-09-20', status: 'EXCUSED' },
    ], '2026-09-01')).toBe('EXCUSED')
  })

  it('counts a held Sunday with no row at all as an absence', () => {
    expect(latestHeldStatus(held, [{ date: '2026-09-06', status: 'PRESENT' }], '2026-09-01')).toBe('ABSENT')
  })

  it('is null when there is nothing to score against', () => {
    expect(latestHeldStatus([], [])).toBeNull()
  })

  it('agrees with the streak about which Sunday came last', () => {
    // Both read the same occasion list, so they cannot disagree about "latest".
    const rows = [
      { date: '2026-09-13', status: 'ABSENT' as const },
      { date: '2026-09-20', status: 'ABSENT' as const },
    ]
    expect(absenceStreakAgainst(held, rows, '2026-09-01')).toBeGreaterThan(0)
    expect(latestHeldStatus(held, rows, '2026-09-01')).toBe('ABSENT')
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

// The prototype opened a follow-up case for a child with NO attendance at all —
// its case row even had a dedicated label for them, "No attendance recorded"
// (OG L17245). Scoring only the student's own rows can never do that: a child
// who simply stops coming stops appearing, so the streak sits at zero forever.
// An enrolment anchor gives those held-but-unmarked Sundays something to count from.
describe('absenceStreakAgainst with an enrolment anchor', () => {
  const held = ['2026-09-06', '2026-09-13', '2026-09-20']

  it('counts every held session since enrolment for a student with no rows at all', () => {
    expect(absenceStreakAgainst(held, [], '2026-09-01')).toBe(3)
  })

  it('does not count sessions held before the student enrolled', () => {
    expect(absenceStreakAgainst(held, [], '2026-09-14')).toBe(1)
  })

  it('stays zero with no rows and no anchor — there is nothing to count from', () => {
    expect(absenceStreakAgainst(held, [])).toBe(0)
  })

  it('anchors on whichever is earlier, enrolment or the first row', () => {
    expect(absenceStreakAgainst(held, h([['2026-09-13', 'PRESENT']]), '2026-09-01')).toBe(1)
    expect(absenceStreakAgainst(held, h([['2026-09-06', 'PRESENT']]), '2026-09-20')).toBe(2)
  })

  it('an attended session still resets the streak to zero', () => {
    expect(absenceStreakAgainst(held, h([['2026-09-20', 'PRESENT']]), '2026-09-01')).toBe(0)
  })
})

// The prototype pinned max=today on the attendance date input. The port dropped
// it on both sides, so a register could be saved for a day that has not happened
// — which then counts as a "held" session and corrupts every attendance rate.
describe('isFutureDate', () => {
  it('rejects a date after today', () => {
    expect(isFutureDate('2026-09-22', '2026-09-21')).toBe(true)
    expect(isFutureDate('2027-01-01', '2026-09-21')).toBe(true)
  })

  it('allows today and any past date', () => {
    expect(isFutureDate('2026-09-21', '2026-09-21')).toBe(false)
    expect(isFutureDate('2026-09-20', '2026-09-21')).toBe(false)
    expect(isFutureDate('2025-12-31', '2026-09-21')).toBe(false)
  })

  it('compares calendar days, not clock time, across a month and year edge', () => {
    expect(isFutureDate('2026-10-01', '2026-09-30')).toBe(true)
    expect(isFutureDate('2026-09-30', '2026-10-01')).toBe(false)
    expect(isFutureDate('2027-01-01', '2026-12-31')).toBe(true)
  })
})


// The prototype confirmed before saving, naming who gains and who loses points,
// and refused when nothing had changed. Taking a student off PRESENT silently
// reverses the points they were given, which is the part nobody expects.
describe('attendanceChanges', () => {
  const students = [
    { studentId: 'a', name: 'Mina' },
    { studentId: 'b', name: 'Mariam' },
    { studentId: 'c', name: 'Youssef' },
  ]
  const mark = (id: string, status: 'PRESENT' | 'EXCUSED' | 'ABSENT', reason?: string | null) => ({
    studentId: id,
    name: students.find((s) => s.studentId === id)!.name,
    status,
    reason: reason ?? null,
  })

  it('reports a first save as all gains', () => {
    const r = attendanceChanges({
      marks: [mark('a', 'PRESENT'), mark('b', 'PRESENT'), mark('c', 'ABSENT')],
      existing: [],
      sessionPoints: 2,
    })
    expect(r.gains.map((g) => g.name)).toEqual(['Mina', 'Mariam'])
    expect(r.losses).toEqual([])
    expect(r.netPoints).toBe(4)
    // Three, not two: recording Youssef as absent creates a record, and that
    // absence counts against him in every rate. It is a change.
    expect(r.changed).toBe(3)
  })

  it('counts nothing when the register is unchanged', () => {
    const existing = [
      { studentId: 'a', status: 'PRESENT' as const },
      { studentId: 'b', status: 'ABSENT' as const },
    ]
    const r = attendanceChanges({
      marks: [mark('a', 'PRESENT'), mark('b', 'ABSENT')],
      existing,
      sessionPoints: 2,
    })
    expect(r.changed).toBe(0)
    expect(r.netPoints).toBe(0)
  })

  it('takes points back when a present student is un-marked', () => {
    const r = attendanceChanges({
      marks: [mark('a', 'ABSENT')],
      existing: [{ studentId: 'a', status: 'PRESENT', awarded: 2 }],
      sessionPoints: 2,
    })
    expect(r.losses).toHaveLength(1)
    expect(r.losses[0]!.delta).toBe(-2)
    expect(r.netPoints).toBe(-2)
  })

  // An admin may have changed the session's value since; reversing has to take
  // back what was actually given.
  it('reverses the points actually awarded, not the session value now', () => {
    const r = attendanceChanges({
      marks: [mark('a', 'EXCUSED')],
      existing: [{ studentId: 'a', status: 'PRESENT', awarded: 5 }],
      sessionPoints: 2,
    })
    expect(r.losses[0]!.delta).toBe(-5)
  })

  it('treats an excuse becoming absent as a change with no points', () => {
    const r = attendanceChanges({
      marks: [mark('a', 'ABSENT')],
      existing: [{ studentId: 'a', status: 'EXCUSED' }],
      sessionPoints: 2,
    })
    expect(r.gains).toEqual([])
    expect(r.losses).toEqual([])
    expect(r.reasonOnly).toHaveLength(1)
    expect(r.changed).toBe(1)
  })

  it('counts an edited excuse reason as a change', () => {
    const r = attendanceChanges({
      marks: [mark('a', 'EXCUSED', 'travel')],
      existing: [{ studentId: 'a', status: 'EXCUSED', reason: 'sick' }],
      sessionPoints: 2,
    })
    expect(r.reasonOnly).toHaveLength(1)
    expect(r.changed).toBe(1)
    expect(r.netPoints).toBe(0)
  })

  it('flags an all-absent first save, which is almost always a mis-click', () => {
    const r = attendanceChanges({
      marks: [mark('a', 'ABSENT'), mark('b', 'ABSENT')],
      existing: [],
      sessionPoints: 2,
    })
    expect(r.createsEmptyRegister).toBe(true)
    // Still a real change — those absences count against the students — so the
    // flag exists to warn, not to suppress the save.
    expect(r.changed).toBe(2)
    expect(r.netPoints).toBe(0)
  })

  it('does not flag an all-absent save over an existing register', () => {
    const r = attendanceChanges({
      marks: [mark('a', 'ABSENT')],
      existing: [{ studentId: 'a', status: 'PRESENT', awarded: 2 }],
      sessionPoints: 2,
    })
    expect(r.createsEmptyRegister).toBe(false)
  })
})
