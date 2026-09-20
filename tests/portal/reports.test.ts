import { describe, it, expect } from 'vitest'
import {
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

  it('uses the §5 quiz bands', () => {
    expect(quizBand(90)).toBe('excellent')
    expect(quizBand(60)).toBe('good')
    expect(quizBand(59)).toBe('low')
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
    expect(matrix.rows[1]!.marks).toEqual(['ABSENT', null])
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
    expect(sara!.rate).toBe(0) // absent, then not marked at all
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
