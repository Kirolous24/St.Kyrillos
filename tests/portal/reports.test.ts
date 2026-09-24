import { describe, it, expect } from 'vitest'
import {
  registerStatus,
  occasionKey,
  heldOccasions,
  rateFromCounts,
  attendanceRate,
  countAttendanceCells,
  attendanceBand,
  quizBand,
  average,
  monthRange,
  monthLabel,
  sundaysInMonth,
  weekdaysInMonth,
  dominantWeekday,
  headlineSession,
  sessionTrend,
  headlineRows,
  buildMultiSessionMatrix,
  weeksOverlappingMonth,
  sessionAbbr,
  shiftMonth,
  buildMonthMatrix,
  classSummary,
  churchTotals,
  buildReportCard,
  prettyBadge,
  reportFilename,
  type AttendanceRow,
} from '@/lib/portal/reports'

type S = 'PRESENT' | 'EXCUSED' | 'ABSENT'

const row = (studentId: string, date: string, status: S, sessionKey = 'sunday'): AttendanceRow => ({
  studentId,
  date,
  sessionKey,
  status,
})

// Four consecutive Sundays in September 2026.
const SUN = ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27']

describe('occasionKey / heldOccasions', () => {
  it('keys a session by its Monday, so any day of a week is the same occasion', () => {
    expect(occasionKey('sunday', '2026-09-20')).toBe('sunday@2026-09-14')
    expect(occasionKey('sunday', '2026-09-16')).toBe('sunday@2026-09-14')
  })

  it('counts one occasion per session per week', () => {
    const rows = [
      row('a', '2026-09-20', 'PRESENT'),
      row('b', '2026-09-20', 'ABSENT'),
      row('a', '2026-09-19', 'PRESENT', 'vespers'),
      row('a', '2026-09-27', 'PRESENT'),
    ]
    expect(heldOccasions(rows)).toEqual(['sunday@2026-09-14', 'sunday@2026-09-21', 'vespers@2026-09-14'])
  })
})

describe('attendanceRate — the held/attended rule', () => {
  it('is NOT present/all-rows: a class that marks absences scores below 100%', () => {
    // The prototype's bug (§6): present / rows = 1/1 = 100% for this data.
    const rows = [row('a', SUN[0]!, 'PRESENT'), row('b', SUN[0]!, 'ABSENT')]
    const result = attendanceRate(rows)
    expect(result.occasions).toBe(1)
    expect(result.students).toBe(2)
    expect(result.held).toBe(2)
    expect(result.attended).toBe(1)
    expect(result.rate).toBe(50)
  })

  it('expects every student at every held session, even with no row at all', () => {
    // Two students, two Sundays held; "b" was never marked on the second.
    const rows = [
      row('a', SUN[0]!, 'PRESENT'),
      row('b', SUN[0]!, 'PRESENT'),
      row('a', SUN[1]!, 'PRESENT'),
    ]
    const result = attendanceRate(rows)
    expect(result.held).toBe(4)
    expect(result.attended).toBe(3)
    expect(result.absent).toBe(1)
    expect(result.rate).toBe(75)
  })

  it('an excused absence leaves the denominator, it does not count as attended', () => {
    const rows = [row('a', SUN[0]!, 'PRESENT'), row('a', SUN[1]!, 'EXCUSED')]
    const result = attendanceRate(rows)
    expect(result.excused).toBe(1)
    expect(result.held).toBe(1)
    expect(result.attended).toBe(1)
    expect(result.rate).toBe(100)
  })

  it('scores one student against the whole class calendar when given occasions', () => {
    const classRows = SUN.flatMap((d) => [row('a', d, 'PRESENT'), row('b', d, 'ABSENT')])
    const occasions = heldOccasions(classRows)
    const forB = attendanceRate(classRows.filter((r) => r.studentId === 'b'), {
      occasions,
      studentIds: ['b'],
    })
    expect(forB.held).toBe(4)
    expect(forB.rate).toBe(0)
  })

  it('counts a student with no rows at all as fully absent when the roster is given', () => {
    const rows = [row('a', SUN[0]!, 'PRESENT')]
    const result = attendanceRate(rows, { studentIds: ['a', 'ghost'] })
    expect(result.students).toBe(2)
    expect(result.held).toBe(2)
    expect(result.rate).toBe(50)
  })

  it('collapses two rows for the same student and week, present winning', () => {
    const rows = [row('a', '2026-09-20', 'ABSENT'), row('a', '2026-09-16', 'PRESENT')]
    const result = attendanceRate(rows)
    expect(result.occasions).toBe(1)
    expect(result.attended).toBe(1)
    expect(result.rate).toBe(100)
  })

  it('does not depend on row order', () => {
    const rows = [row('a', SUN[1]!, 'ABSENT'), row('b', SUN[0]!, 'PRESENT'), row('a', SUN[0]!, 'PRESENT')]
    expect(attendanceRate(rows).rate).toBe(attendanceRate([...rows].reverse()).rate)
  })

  it('returns a null rate rather than 0% when nothing was held', () => {
    expect(attendanceRate([]).rate).toBeNull()
    expect(rateFromCounts({ occasions: 0, students: 12, present: 0, excused: 0 }).rate).toBeNull()
  })

  it('ignores rows for students outside the given roster', () => {
    const rows = [row('a', SUN[0]!, 'PRESENT'), row('stranger', SUN[0]!, 'PRESENT')]
    const result = attendanceRate(rows, { studentIds: ['a'] })
    expect(result.students).toBe(1)
    expect(result.attended).toBe(1)
  })
})

describe('rateFromCounts', () => {
  it('matches the row-based rate for the same data', () => {
    const rows = SUN.flatMap((d) => [row('a', d, 'PRESENT'), row('b', d, d === SUN[0] ? 'EXCUSED' : 'ABSENT')])
    const fromRows = attendanceRate(rows)
    const fromCounts = rateFromCounts({ occasions: 4, students: 2, present: 4, excused: 1 })
    expect(fromCounts).toEqual(fromRows)
  })

  it('never lets excused or present exceed what was held', () => {
    const result = rateFromCounts({ occasions: 1, students: 1, present: 99, excused: 0 })
    expect(result.attended).toBe(1)
    expect(result.rate).toBe(100)
  })
})

describe('bands', () => {
  it('uses the §5 attendance bands', () => {
    expect(attendanceBand(80)).toBe('excellent')
    expect(attendanceBand(79)).toBe('good')
    expect(attendanceBand(50)).toBe('good')
    expect(attendanceBand(49)).toBe('low')
    expect(attendanceBand(null)).toBeNull()
  })

  // F0035 — "good" is the pass mark, so the report card and the child's quiz
  // card cannot disagree about the same score.
  it('uses the §5 quiz bands, floored at the pass mark', () => {
    expect(quizBand(90)).toBe('excellent')
    expect(quizBand(70)).toBe('good')
    expect(quizBand(69)).toBe('low')
    expect(quizBand(65)).toBe('low')
    expect(quizBand(null)).toBeNull()
  })

  it('averages to a whole percent', () => {
    expect(average([90, 80, 71])).toBe(80)
    expect(average([])).toBeNull()
  })
})

describe('month helpers', () => {
  it('bounds a month', () => {
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2028-02').to).toBe('2028-02-29')
  })

  it('rejects nonsense', () => {
    expect(() => monthRange('2026-13')).toThrow()
    expect(() => monthRange('nope')).toThrow()
  })

  it('labels and shifts months across a year boundary', () => {
    expect(monthLabel('2026-09')).toBe('September 2026')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('lists the Sundays for a blank form', () => {
    expect(sundaysInMonth('2026-09')).toEqual(SUN)
  })

  // The blank paper form printed Sunday dates whatever session you picked, so a
  // Wednesday Bible-study roll came back with every mark under the wrong day.
  it('walks any weekday, not just Sunday', () => {
    expect(weekdaysInMonth('2026-09', 3)).toEqual(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'])
    expect(weekdaysInMonth('2026-09', 0)).toEqual(sundaysInMonth('2026-09'))
    expect(weekdaysInMonth('2026-02', 6)).toEqual(['2026-02-07', '2026-02-14', '2026-02-21', '2026-02-28'])
  })

  it('learns the session weekday from the dates a class already recorded', () => {
    // Three Wednesdays and one stray Sunday makes it a Wednesday session.
    expect(dominantWeekday(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-06'])).toBe(3)
    // No history at all keeps the old Sunday behaviour.
    expect(dominantWeekday([])).toBe(0)
    expect(dominantWeekday(['2026-09-06', '2026-09-13'])).toBe(0)
  })
})

describe('buildMonthMatrix', () => {
  const students = [
    { id: 'a', name: 'Mina Adel' },
    { id: 'b', name: 'Sara Botros' },
  ]

  it('puts students down the side and recorded dates across', () => {
    const matrix = buildMonthMatrix(
      students,
      [
        { studentId: 'a', date: SUN[0]!, status: 'PRESENT' },
        { studentId: 'b', date: SUN[0]!, status: 'ABSENT' },
        { studentId: 'a', date: SUN[1]!, status: 'EXCUSED' },
      ],
      '2026-09',
    )
    expect(matrix.dates).toEqual([SUN[0], SUN[1]])
    expect(matrix.rows[0]!.marks).toEqual(['PRESENT', 'EXCUSED'])
    // F0204 — Sara has no row of her own for the second Sunday, but a column
    // only exists because somebody in the class was marked that day, so she was
    // absent rather than "not marked". This used to print an empty box while
    // the absence count beside it already said 2, and on a QR Sunday — where a
    // row is written only for the children who scanned — that was every child
    // who did not scan, which reads as a servant who never took the register.
    expect(matrix.rows[1]!.marks).toEqual(['ABSENT', 'ABSENT'])
    // The grid and the number beside it now say the same thing.
    expect(matrix.rows[1]!.absent).toBe(2)
  })

  it('leaves a cell blank only when the class met on no such day', () => {
    // One Sunday recorded, so the matrix has one column: nothing can be
    // inferred about a day the class never met, and nothing is.
    const matrix = buildMonthMatrix(students, [{ studentId: 'a', date: SUN[0]!, status: 'PRESENT' }], '2026-09')
    expect(matrix.dates).toEqual([SUN[0]])
    expect(matrix.rows[1]!.marks).toEqual(['ABSENT'])
  })

  it('scores a student over the dates the class met, excused dropping out', () => {
    const matrix = buildMonthMatrix(
      students,
      [
        { studentId: 'a', date: SUN[0]!, status: 'PRESENT' },
        { studentId: 'b', date: SUN[0]!, status: 'ABSENT' },
        { studentId: 'a', date: SUN[1]!, status: 'EXCUSED' },
      ],
      '2026-09',
    )
    const [mina, sara] = matrix.rows
    expect(mina!.rate).toBe(100) // 1 present of 1 counted (the excused day drops out)
    expect(sara!.rate).toBe(0) // absent on both Sundays the class met
    expect(sara!.absent).toBe(2)
  })

  it('totals the class over every cell', () => {
    const matrix = buildMonthMatrix(
      students,
      [
        { studentId: 'a', date: SUN[0]!, status: 'PRESENT' },
        { studentId: 'b', date: SUN[0]!, status: 'PRESENT' },
        { studentId: 'a', date: SUN[1]!, status: 'PRESENT' },
        { studentId: 'b', date: SUN[1]!, status: 'ABSENT' },
      ],
      '2026-09',
    )
    expect(matrix.totals.held).toBe(4)
    expect(matrix.totals.present).toBe(3)
    expect(matrix.totals.rate).toBe(75)
  })

  it('ignores records from another month', () => {
    const matrix = buildMonthMatrix(students, [{ studentId: 'a', date: '2026-08-30', status: 'PRESENT' }], '2026-09')
    expect(matrix.dates).toEqual(SUN) // falls back to the blank Sunday form
    expect(matrix.totals.rate).toBeNull()
  })

  it('produces a blank form with no rates when nothing was recorded', () => {
    const matrix = buildMonthMatrix(students, [], '2026-09')
    expect(matrix.dates).toEqual(SUN)
    expect(matrix.rows.every((r) => r.marks.every((m) => m === null))).toBe(true)
    expect(matrix.rows[0]!.rate).toBeNull()
    expect(matrix.totals.rate).toBeNull()
  })

  it('honours explicit columns for a printed blank form', () => {
    const matrix = buildMonthMatrix(students, [], '2026-09', { dates: [SUN[2]!, SUN[0]!] })
    expect(matrix.dates).toEqual([SUN[0], SUN[2]])
  })
})

describe('classSummary / churchTotals', () => {
  it('reports attendance the §5 way, not present/all-rows', () => {
    const summary = classSummary({
      classId: '5th-6th-boys',
      className: '5th & 6th Boys',
      students: 10,
      occasions: 4,
      present: 30,
      excused: 2,
      quizAverage: 84,
      quizCount: 12,
      pointsTotal: 260,
    })
    expect(summary.attendance.held).toBe(38)
    expect(summary.attendance.rate).toBe(79)
    expect(summary.attendanceBand).toBe('good')
    expect(summary.quizBand).toBe('good')
    expect(summary.pointsPerStudent).toBe(26)
  })

  it('prefers raw percentages over a pre-averaged one', () => {
    const summary = classSummary({
      classId: 'kg',
      className: 'KG',
      students: 2,
      occasions: 1,
      present: 2,
      excused: 0,
      quizPercentages: [100, 50],
      quizAverage: 12,
      pointsTotal: 4,
    })
    expect(summary.quizAverage).toBe(75)
    expect(summary.quizCount).toBe(2)
  })

  it('leaves an empty class with a null rate, not a zero', () => {
    const summary = classSummary({ classId: 'x', className: 'X', students: 0, occasions: 0, present: 0, excused: 0, pointsTotal: 0 })
    expect(summary.attendance.rate).toBeNull()
    expect(summary.pointsPerStudent).toBeNull()
  })

  it('weights the church-wide quiz average by how many quizzes each class sat', () => {
    const rows = [
      classSummary({ classId: 'a', className: 'A', students: 5, occasions: 2, present: 10, excused: 0, quizAverage: 90, quizCount: 9, pointsTotal: 50 }),
      classSummary({ classId: 'b', className: 'B', students: 5, occasions: 2, present: 5, excused: 0, quizAverage: 50, quizCount: 1, pointsTotal: 10 }),
    ]
    const totals = churchTotals(rows)
    expect(totals.classes).toBe(2)
    expect(totals.students).toBe(10)
    expect(totals.held).toBe(20)
    expect(totals.attended).toBe(15)
    expect(totals.rate).toBe(75)
    expect(totals.quizAverage).toBe(86)
    expect(totals.pointsTotal).toBe(60)
  })
})

describe('buildReportCard', () => {
  it('summarises one student for a printed card', () => {
    const card = buildReportCard({
      studentId: 'a',
      name: 'Mina Adel',
      className: '5th & 6th Boys',
      attendance: rateFromCounts({ occasions: 4, students: 1, present: 3, excused: 0 }),
      quizPercentages: [100, 80],
      pointsTotal: 42,
      badges: ['first-quiz', 'first-quiz', 'bible_reader'],
      rank: 2,
    })
    expect(card.attendance.rate).toBe(75)
    expect(card.attendanceBand).toBe('good')
    expect(card.quizAverage).toBe(90)
    expect(card.quizBand).toBe('excellent')
    expect(card.badges).toEqual(['first-quiz', 'bible_reader'])
    expect(card.rank).toBe(2)
  })

  it('leaves quiz fields null for a student who sat none', () => {
    const card = buildReportCard({
      studentId: 'b',
      name: 'Sara',
      className: 'KG',
      attendance: rateFromCounts({ occasions: 0, students: 1, present: 0, excused: 0 }),
      quizPercentages: [],
      pointsTotal: 0,
      badges: [],
    })
    expect(card.quizAverage).toBeNull()
    expect(card.quizBand).toBeNull()
    expect(card.rank).toBeNull()
  })
})

describe('presentation helpers', () => {
  it('humanises a badge key', () => {
    expect(prettyBadge('first-quiz')).toBe('First Quiz')
    expect(prettyBadge('bible_reader')).toBe('Bible Reader')
    expect(prettyBadge('perfectAttendance')).toBe('Perfect Attendance')
  })

  it('builds a safe filename', () => {
    expect(reportFilename(['attendance', '5th & 6th Boys', '2026-09'], 'csv')).toBe('attendance-5th-6th-boys-2026-09.csv')
    expect(reportFilename([null, undefined], 'json')).toBe('report.json')
  })
})

describe('countAttendanceCells', () => {
  const rows = (list: Array<[string, string, string, 'PRESENT' | 'EXCUSED' | 'ABSENT']>): AttendanceRow[] =>
    list.map(([studentId, date, sessionKey, status]) => ({ studentId, date, sessionKey, status }))

  it('counts one verdict per student and occasion, not one per row', () => {
    // The Saturday and the Sunday of one week are a single held occasion, so a
    // student present at both must not put two marks on one denominator slot.
    const marks = rows([
      ['a', '2026-09-12', 'liturgy', 'PRESENT'],
      ['a', '2026-09-13', 'liturgy', 'PRESENT'],
      ['b', '2026-09-12', 'liturgy', 'PRESENT'],
      ['b', '2026-09-13', 'liturgy', 'ABSENT'],
    ])
    expect(countAttendanceCells(marks)).toEqual({ present: 2, excused: 0 })
    expect(heldOccasions(marks)).toHaveLength(1)
    // …which is what keeps the church-report numerator inside its denominator.
    const rate = rateFromCounts({ occasions: 1, students: 2, ...countAttendanceCells(marks) })
    expect(rate).toMatchObject({ held: 2, attended: 2, rate: 100 })
  })

  it('takes the best mark of the week and drops rows outside the scope', () => {
    const marks = rows([
      ['a', '2026-09-12', 'liturgy', 'ABSENT'],
      ['a', '2026-09-13', 'liturgy', 'EXCUSED'],
      ['gone', '2026-09-13', 'liturgy', 'PRESENT'],
    ])
    expect(countAttendanceCells(marks, { studentIds: ['a'] })).toEqual({ present: 0, excused: 1 })
    expect(countAttendanceCells(marks, { occasions: ['liturgy@2026-09-21'] })).toEqual({ present: 0, excused: 0 })
  })
})

// The prototype's attendance report was one month grid carrying all six weekly
// sessions (OG renderAttendanceMonthTable). The port showed one session at a
// time, so a month meant running and printing the report six times.
describe('buildMultiSessionMatrix', () => {
  const SESSIONS = [
    { key: 'bible', label: 'Bible Study' },
    { key: 'sunday', label: 'Sunday School' },
    { key: 'hymns', label: 'Hymns' },
  ]
  const students = [
    { id: 'a', name: 'Mina' },
    { id: 'b', name: 'Mariam' },
  ]

  it('walks every Monday-to-Sunday week that overlaps the month', () => {
    // September 2026 starts on a Tuesday, so the first week begins in August.
    expect(weeksOverlappingMonth('2026-09')).toEqual([
      '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
    ])
  })

  // The grid draws the whole month — every week, every session — and flags the
  // (week, session) pairs that were actually taken. It used to draw only the
  // pairs with records, which collapsed a month holding one register into a
  // single column: the same data, a page nobody recognised.
  it('draws every week and every session, flagging the ones actually held', () => {
    const m = buildMultiSessionMatrix(
      students,
      [
        { studentId: 'a', date: '2026-09-06', sessionKey: 'sunday', status: 'PRESENT' },
        { studentId: 'a', date: '2026-09-02', sessionKey: 'bible', status: 'PRESENT' },
        { studentId: 'a', date: '2026-09-13', sessionKey: 'sunday', status: 'ABSENT' },
      ],
      SESSIONS,
      '2026-09',
    )
    // Five weeks overlap September 2026, three sessions in each.
    expect(m.columns).toHaveLength(15)
    expect(m.weeks.map((w) => w.span)).toEqual([3, 3, 3, 3, 3])
    // Week of Aug 31 held bible + sunday; week of Sep 7 held sunday only.
    expect(m.columns.filter((c) => c.held).map((c) => `${c.week}:${c.abbr}`)).toEqual([
      '2026-08-31:BS', '2026-08-31:SS', '2026-09-07:SS',
    ])
  })

  it('keeps sessions in the order they were given, not the order recorded', () => {
    const m = buildMultiSessionMatrix(
      students,
      [
        { studentId: 'a', date: '2026-09-06', sessionKey: 'hymns', status: 'PRESENT' },
        { studentId: 'a', date: '2026-09-02', sessionKey: 'bible', status: 'PRESENT' },
      ],
      SESSIONS,
      '2026-09',
    )
    expect(m.columns.filter((c) => c.held).map((c) => c.sessionKey)).toEqual(['bible', 'hymns'])
  })

  it('leaves an excused cell out of that student\'s denominator', () => {
    const m = buildMultiSessionMatrix(
      students,
      [
        { studentId: 'a', date: '2026-09-06', sessionKey: 'sunday', status: 'PRESENT' },
        { studentId: 'b', date: '2026-09-06', sessionKey: 'sunday', status: 'EXCUSED' },
        { studentId: 'a', date: '2026-09-02', sessionKey: 'bible', status: 'PRESENT' },
        { studentId: 'b', date: '2026-09-02', sessionKey: 'bible', status: 'ABSENT' },
      ],
      SESSIONS,
      '2026-09',
    )
    const mina = m.rows.find((r) => r.studentId === 'a')!
    const mariam = m.rows.find((r) => r.studentId === 'b')!
    expect(mina.rate).toBe(100)
    // One of Mariam's two columns was excused, so she is scored 0 of 1.
    expect(mariam.held).toBe(1)
    expect(mariam.rate).toBe(0)
  })

  it('counts a student with no row at all as absent, like the rest of the module', () => {
    const m = buildMultiSessionMatrix(
      students,
      [{ studentId: 'a', date: '2026-09-06', sessionKey: 'sunday', status: 'PRESENT' }],
      SESSIONS,
      '2026-09',
    )
    const mariam = m.rows.find((r) => r.studentId === 'b')!
    expect(mariam.marks).toHaveLength(15)
    expect(mariam.marks.every((mark) => mark === null)).toBe(true)
    // One session was held all month, and she was not marked at it.
    expect(mariam.held).toBe(1)
    expect(mariam.rate).toBe(0)
  })

  it('takes the best of two rows for the same session in one week', () => {
    const m = buildMultiSessionMatrix(
      students,
      [
        { studentId: 'a', date: '2026-09-02', sessionKey: 'bible', status: 'ABSENT' },
        { studentId: 'a', date: '2026-09-04', sessionKey: 'bible', status: 'PRESENT' },
      ],
      SESSIONS,
      '2026-09',
    )
    expect(m.columns.filter((c) => c.held)).toHaveLength(1)
    expect(m.rows.find((r) => r.studentId === 'a')!.marks.filter(Boolean)).toEqual(['PRESENT'])
  })

  // The trap in drawing the whole month: the denominator must stay the sessions
  // actually taken. Counting the boxes instead would read a child who came to
  // the one register held all month as 1-of-15.
  it('divides a rate by the sessions held, never by the boxes drawn', () => {
    const m = buildMultiSessionMatrix(
      students,
      [{ studentId: 'a', date: '2026-09-06', sessionKey: 'sunday', status: 'PRESENT' }],
      SESSIONS,
      '2026-09',
    )
    expect(m.columns).toHaveLength(15)
    expect(m.rows.find((r) => r.studentId === 'a')!.held).toBe(1)
    expect(m.rows.find((r) => r.studentId === 'a')!.rate).toBe(100)
  })

  // A blank form has no records to derive "held" from, so the caller names the
  // sessions the church runs and every one of their cells becomes a tickable
  // box rather than a dash.
  it('marks the named sessions held for a blank form', () => {
    const m = buildMultiSessionMatrix(students, [], SESSIONS, '2026-09', {
      sessionKeys: ['bible', 'sunday'],
    })
    expect(m.weeks).toHaveLength(5)
    expect(m.columns).toHaveLength(15)
    expect(m.columns.filter((c) => c.held)).toHaveLength(10)
    expect(m.rows[0]!.marks.every((v) => v === null)).toBe(true)
  })

  it('abbreviates the six the prototype knew, and initials anything new', () => {
    expect(sessionAbbr('sunday', 'Sunday School')).toBe('SS')
    expect(sessionAbbr('liturgy', 'Liturgy')).toBe('SL')
    expect(sessionAbbr('youth-night', 'Youth Night Meeting')).toBe('YNM')
  })
})

// Every stat card hardcoded 'sunday', so a class whose register is Bible Study
// read "No sessions yet" on every card while its attendance sat in the reports.
describe('headlineSession', () => {
  it('stays on Sunday School when the class records it', () => {
    const rows = [{ sessionKey: 'sunday' }, { sessionKey: 'bible' }]
    expect(headlineSession(rows)).toBe('sunday')
    expect(headlineRows(rows)).toEqual([{ sessionKey: 'sunday' }])
  })

  it('falls back to every session when there is no Sunday at all', () => {
    const rows = [{ sessionKey: 'bible' }, { sessionKey: 'liturgy' }]
    expect(headlineSession(rows)).toBeNull()
    expect(headlineRows(rows)).toHaveLength(2)
  })

  it('has nothing to fall back to when nothing is recorded', () => {
    expect(headlineSession([])).toBeNull()
    expect(headlineRows([])).toEqual([])
  })
})

// The prototype showed a ring per recent date with a one-tap "who was missing".
// The port showed one date and nothing around it, so a child sliding away was
// invisible without opening four separate dates.
describe('sessionTrend', () => {
  const roster = [
    { id: 'a', name: 'Mina' },
    { id: 'b', name: 'Mariam' },
    { id: 'c', name: 'Youssef' },
  ]

  it('names who was not in the room, newest date first', () => {
    const t = sessionTrend(
      ['2026-09-06', '2026-09-13'],
      [
        { studentId: 'a', date: '2026-09-06', status: 'PRESENT' },
        { studentId: 'b', date: '2026-09-06', status: 'ABSENT' },
        { studentId: 'a', date: '2026-09-13', status: 'PRESENT' },
        { studentId: 'b', date: '2026-09-13', status: 'PRESENT' },
      ],
      roster,
    )
    expect(t.map((d) => d.date)).toEqual(['2026-09-13', '2026-09-06'])
    // Youssef has no row at all on either date, so he was not there.
    expect(t[0]!.missing).toEqual(['Youssef'])
    expect(t[1]!.missing).toEqual(['Mariam', 'Youssef'])
  })

  // Different question from the scored rate: "who was not in the room" counts
  // an excused child as away, while the scored rate drops them entirely.
  it('counts an excused student as not in the room', () => {
    const t = sessionTrend(
      ['2026-09-06'],
      [
        { studentId: 'a', date: '2026-09-06', status: 'PRESENT' },
        { studentId: 'b', date: '2026-09-06', status: 'EXCUSED' },
        { studentId: 'c', date: '2026-09-06', status: 'ABSENT' },
      ],
      roster,
    )
    expect(t[0]!.present).toBe(1)
    expect(t[0]!.excused).toBe(1)
    expect(t[0]!.absent).toBe(1)
    expect(t[0]!.missing).toEqual(['Mariam', 'Youssef'])
    expect(t[0]!.rate).toBe(33)
  })

  it('takes the best of two rows for one student on one day', () => {
    const t = sessionTrend(
      ['2026-09-06'],
      [
        { studentId: 'a', date: '2026-09-06', status: 'ABSENT' },
        { studentId: 'a', date: '2026-09-06', status: 'PRESENT' },
      ],
      [{ id: 'a', name: 'Mina' }],
    )
    expect(t[0]!.present).toBe(1)
    expect(t[0]!.missing).toEqual([])
  })

  it('has no rate for a class with nobody on the roster', () => {
    expect(sessionTrend(['2026-09-06'], [], [])[0]!.rate).toBeNull()
  })
})

/**
 * F0164 — was last Sunday's register taken?
 *
 * A coordinator saw "5th & 6th Boys did not take attendance" on the Sunday and
 * could not find it again on the Wednesday, because the dashboard asked the
 * question of *today* rather than of a fixed date. This rule asks it of one
 * Sunday, so the answer keeps until somebody acts on it.
 */
describe('registerStatus', () => {
  const sunday = '2026-09-20'
  const roster = ['a', 'b', 'c', 'd']
  const mark = (studentId: string, date: string, status: 'PRESENT' | 'EXCUSED' | 'ABSENT', sessionKey = 'sunday') =>
    ({ studentId, date, sessionKey, status }) as const

  it('counts who came when the register was taken', () => {
    const r = registerStatus({
      sunday,
      rosterSize: roster.length,
      rows: [mark('a', sunday, 'PRESENT'), mark('b', sunday, 'PRESENT'), mark('c', sunday, 'ABSENT')],
    })
    expect(r.state).toBe('taken')
    expect(r.present).toBe(2)
    // The roster, not the rows: 'd' got no row at all and was still expected.
    expect(r.total).toBe(4)
  })

  it('an excused child is not counted present', () => {
    const r = registerStatus({
      sunday,
      rosterSize: 2,
      rows: [mark('a', sunday, 'PRESENT'), mark('b', sunday, 'EXCUSED')],
    })
    expect(r.present).toBe(1)
  })

  it('counts a child once when two sessions were recorded the same day', () => {
    // Headline session only, as every other figure on the dashboard is scored.
    const r = registerStatus({
      sunday,
      rosterSize: 2,
      rows: [mark('a', sunday, 'PRESENT'), mark('a', sunday, 'PRESENT', 'liturgy')],
    })
    expect(r.present).toBe(1)
  })

  it('says so when nothing was recorded that Sunday', () => {
    const r = registerStatus({
      sunday,
      rosterSize: 4,
      rows: [mark('a', '2026-09-13', 'PRESENT')], // the Sunday before
    })
    expect(r.state).toBe('missing')
    expect(r.total).toBe(4)
  })

  it('and when the class has never recorded anything at all', () => {
    expect(registerStatus({ sunday, rosterSize: 4, rows: [] }).state).toBe('missing')
  })

  /**
   * The false alarm this rule exists to avoid. `headlineSession` is in this
   * file because classes recording only Bible Study read "No sessions yet" on
   * every card; nagging such a class every week for missing a Sunday it never
   * holds would make the whole panel wallpaper, which is the one way a
   * chase-up list fails.
   */
  it('does not nag a class that does not meet on Sundays', () => {
    const r = registerStatus({
      sunday,
      rosterSize: 3,
      rows: [
        mark('a', '2026-09-18', 'PRESENT', 'bible-study'), // Friday
        mark('b', '2026-09-18', 'PRESENT', 'bible-study'),
        mark('a', '2026-09-11', 'PRESENT', 'bible-study'),
      ],
    })
    expect(r.state).toBe('other-day')
    expect(r.date).toBe('2026-09-18')
    expect(r.present).toBe(2)
  })

  it('but does flag a Sunday class that missed this one', () => {
    // Same shape as above, except these dates are Sundays — so the class does
    // meet on Sundays and skipping one is worth saying.
    const r = registerStatus({
      sunday,
      rosterSize: 3,
      rows: [mark('a', '2026-09-13', 'PRESENT'), mark('b', '2026-09-06', 'PRESENT')],
    })
    expect(r.state).toBe('missing')
  })

  it('stays quiet about a class with nobody in it', () => {
    const r = registerStatus({ sunday, rosterSize: 0, rows: [] })
    expect(r.state).toBe('no-students')
  })
})
