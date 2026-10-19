import { describe, it, expect } from 'vitest'
import { buildKidWeeklyReport, type KidReportInput } from '@/lib/portal/kid-weekly-report'

/**
 * The servants' weekly attendance report, for the children (2026-10-19,
 * asked for by the Middle School overseer). It counts the church's way
 * (ANALYSIS §5): a meeting is held in a week when the class has any row for it,
 * an excused mark leaves that week out, and anything else counts against the
 * child. As in the follow-up rule, weeks before a child joined do not count.
 */

const SESSIONS = [
  { key: 'sunday', label: 'Sunday School', classId: null },
  { key: 'liturgy', label: 'Liturgy', classId: null },
  { key: 'bible', label: 'Bible Study', classId: null },
  { key: 'pre-servants', label: 'Pre-Servants Meeting', classId: 'pre' },
]
const CLASSES = [
  { id: 'boys', name: '5th & 6th Boys' },
  { id: 'girls', name: '5th & 6th Girls' },
]
const kid = (studentId: string, classId = 'boys', joinedOn = '2026-09-01', extra: Partial<KidReportInput['roster'][number]> = {}) => ({
  studentId,
  name: studentId,
  classId,
  member: false,
  joinedOn,
  firstMarkedOn: null,
  ...extra,
})
const row = (studentId: string, date: string, sessionKey: string, status: 'PRESENT' | 'EXCUSED' | 'ABSENT', classId = 'boys') => ({
  studentId,
  classId,
  date,
  sessionKey,
  status,
})

describe('buildKidWeeklyReport', () => {
  it('scores each child against the meetings their class held, a missing row counting as absent', () => {
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      roster: [kid('mina'), kid('mark')],
      records: [
        // Week of Oct 5: Sunday School only. Week of Oct 12: Bible Study (Fri) and Sunday School.
        row('mina', '2026-10-11', 'sunday', 'PRESENT'),
        row('mark', '2026-10-11', 'sunday', 'ABSENT'),
        row('mina', '2026-10-16', 'bible', 'PRESENT'),
        row('mina', '2026-10-18', 'sunday', 'PRESENT'),
        row('mark', '2026-10-18', 'sunday', 'PRESENT'),
      ],
    })
    expect(report.weeks).toEqual(['2026-10-05', '2026-10-12'])
    const mina = report.rows.find((r) => r.studentId === 'mina')!
    const mark = report.rows.find((r) => r.studentId === 'mark')!
    expect([mina.attended, mina.held, mina.rate]).toEqual([3, 3, 100])
    // Mark has no Bible Study row: the class held it, so it counts against him.
    expect([mark.attended, mark.held, mark.rate]).toEqual([1, 3, 33])
    expect(mark.bySession).toEqual({ sunday: { attended: 1, held: 2 }, bible: { attended: 0, held: 1 } })
    expect(mark.cells).toContainEqual({ sessionKey: 'bible', week: '2026-10-12', status: null })
  })

  it('leaves an excused week out rather than counting it against the child', () => {
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      roster: [kid('mina')],
      records: [row('mina', '2026-10-11', 'sunday', 'EXCUSED'), row('mina', '2026-10-18', 'sunday', 'PRESENT')],
    })
    expect(report.rows[0]).toMatchObject({ attended: 1, held: 1, rate: 100 })
  })

  it('does not hold the weeks before a child joined against them', () => {
    const records = [
      row('old', '2026-10-04', 'sunday', 'PRESENT'),
      row('old', '2026-10-11', 'sunday', 'PRESENT'),
      row('old', '2026-10-18', 'sunday', 'PRESENT'),
      row('new', '2026-10-18', 'sunday', 'PRESENT'),
    ]
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      roster: [kid('old'), kid('new', 'boys', '2026-10-14')],
      records,
    })
    expect(report.rows.find((r) => r.studentId === 'new')).toMatchObject({ attended: 1, held: 1, rate: 100 })
  })

  it('anchors on the earlier of joining and the first register that marked them', () => {
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      // Added to the portal on the 14th, but the old app had marked them since the 4th.
      roster: [kid('moved', 'boys', '2026-10-14', { firstMarkedOn: '2026-10-04' })],
      records: [
        row('moved', '2026-10-04', 'sunday', 'PRESENT'),
        row('other', '2026-10-11', 'sunday', 'PRESENT'),
        row('moved', '2026-10-18', 'sunday', 'PRESENT'),
      ],
    })
    expect(report.rows[0]).toMatchObject({ attended: 2, held: 3, rate: 67 })
  })

  it('keeps each class to its own meetings', () => {
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      roster: [kid('mina', 'boys'), kid('mary', 'girls')],
      records: [
        row('mina', '2026-10-16', 'bible', 'PRESENT', 'boys'),
        row('mina', '2026-10-18', 'sunday', 'PRESENT', 'boys'),
        row('mary', '2026-10-18', 'sunday', 'PRESENT', 'girls'),
      ],
    })
    // The boys' Bible Study is not a meeting the girls missed.
    expect(report.rows.find((r) => r.studentId === 'mary')).toMatchObject({ attended: 1, held: 1, rate: 100 })
    expect(report.classes).toEqual([
      expect.objectContaining({ classId: 'boys', students: 1, attended: 2, held: 2, rate: 100 }),
      expect.objectContaining({ classId: 'girls', students: 1, attended: 1, held: 1, rate: 100 }),
    ])
  })

  it('counts a Pre-Servants member only at that class’s own meeting', () => {
    const report = buildKidWeeklyReport({
      classes: [{ id: 'pre', name: 'Pre-Servants' }],
      sessions: SESSIONS,
      roster: [kid('own', 'pre'), kid('teen', 'pre', '2026-09-01', { member: true })],
      records: [
        row('own', '2026-10-18', 'sunday', 'PRESENT', 'pre'),
        row('own', '2026-10-17', 'pre-servants', 'PRESENT', 'pre'),
        row('teen', '2026-10-17', 'pre-servants', 'PRESENT', 'pre'),
      ],
    })
    // The teen is marked for Sunday School in their own class, not here.
    expect(report.rows.find((r) => r.studentId === 'teen')).toMatchObject({ attended: 1, held: 1 })
    expect(report.rows.find((r) => r.studentId === 'own')).toMatchObject({ attended: 2, held: 2 })
  })

  it('totals each meeting across the children, with the weekday it is held on', () => {
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      roster: [kid('mina'), kid('mark')],
      records: [
        row('mina', '2026-10-09', 'bible', 'PRESENT'),
        row('mina', '2026-10-16', 'bible', 'ABSENT'),
        row('mark', '2026-10-16', 'bible', 'PRESENT'),
        row('mina', '2026-10-18', 'sunday', 'PRESENT'),
        row('mark', '2026-10-18', 'sunday', 'PRESENT'),
      ],
    })
    expect(report.sessions).toEqual([
      { key: 'sunday', label: 'Sunday School', weekday: 0 },
      { key: 'bible', label: 'Bible Study', weekday: 5 },
    ])
    expect(report.notHeld).toEqual([{ key: 'liturgy', label: 'Liturgy' }])
    expect(report.perSession).toEqual([
      { key: 'sunday', label: 'Sunday School', weekday: 0, attended: 2, held: 2, rate: 100 },
      // Mark was never marked the week of Oct 5: absent, as the class held it.
      { key: 'bible', label: 'Bible Study', weekday: 5, attended: 2, held: 4, rate: 50 },
    ])
    expect(report.total).toEqual({ attended: 4, held: 6, rate: 67 })
  })

  it('takes two marks for one meeting in one week as one occasion, the best mark winning', () => {
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      roster: [kid('mina')],
      records: [row('mina', '2026-10-13', 'bible', 'ABSENT'), row('mina', '2026-10-16', 'bible', 'PRESENT')],
    })
    expect(report.rows[0]).toMatchObject({ attended: 1, held: 1 })
  })

  it('ignores marks for a meeting that is no longer running', () => {
    const report = buildKidWeeklyReport({
      classes: CLASSES,
      sessions: SESSIONS,
      roster: [kid('mina')],
      records: [row('mina', '2026-10-17', 'retired', 'ABSENT'), row('mina', '2026-10-18', 'sunday', 'PRESENT')],
    })
    expect(report.rows[0]).toMatchObject({ attended: 1, held: 1 })
    expect(report.sessions.map((s) => s.key)).toEqual(['sunday'])
  })

  it('says nothing was held when no register was taken', () => {
    const report = buildKidWeeklyReport({ classes: CLASSES, sessions: SESSIONS, roster: [kid('mina')], records: [] })
    expect(report.weeks).toEqual([])
    expect(report.rows[0]).toMatchObject({ attended: 0, held: 0, rate: null })
    expect(report.total.rate).toBeNull()
  })
})
