// Pure reporting maths for the portal: attendance rates, the month matrix, the
// per-class church-report row and the printable report card.
//
// The prototype computed attendance as `present / all-rows`, which is always
// 100% or 0% because it only ever stored rows for the people it saw
// (ANALYSIS §6). The rule this module implements instead is the one the church
// actually works to (§5):
//
//   A session counts as HELD in a week if any attendance row exists for that
//   session in that week. Every student in scope is then expected at every held
//   session; an EXCUSED row removes that one occasion from the student's
//   denominator; anything else (absent, or no row at all) counts against them.
//
//   rate = attended / held
//
// No DB access, no React — everything here is unit-tested in
// tests/portal/reports.test.ts.

import { mondayOf, toUTCDate, formatDateOnly, addDays } from './dates'
import { QUIZ_PASS_PERCENT, QUIZ_EXCELLENT_PERCENT } from './exams'

export type AttendanceStatusKey = 'PRESENT' | 'EXCUSED' | 'ABSENT'

export interface AttendanceRow {
  studentId: string
  /** YYYY-MM-DD */
  date: string
  sessionKey: string
  status: AttendanceStatusKey
}

export interface AttendanceRateResult {
  /** Distinct (session, week) occasions that were held. */
  occasions: number
  /** Students expected at those occasions. */
  students: number
  /** Occasions counted against the students (expected minus excused). */
  held: number
  attended: number
  excused: number
  absent: number
  /** Whole-percent rate, or null when nothing was held. */
  rate: number | null
}

/** Stable identity of one held session: "sunday@2026-09-14" (Monday of its week). */
export function occasionKey(sessionKey: string, date: string): string {
  return `${sessionKey}@${mondayOf(date)}`
}

/** The distinct (session, week) occasions these rows prove were held, sorted. */
export function heldOccasions(rows: readonly Pick<AttendanceRow, 'date' | 'sessionKey'>[]): string[] {
  const seen = new Set<string>()
  for (const r of rows) seen.add(occasionKey(r.sessionKey, r.date))
  return Array.from(seen).sort()
}

/** PRESENT beats EXCUSED beats ABSENT when a week holds more than one row. */
const STATUS_RANK: Record<AttendanceStatusKey, number> = { PRESENT: 3, EXCUSED: 2, ABSENT: 1 }

/**
 * The held/attended rate from raw counts. Kept separate so the church report
 * can feed it cheap `groupBy` aggregates instead of downloading every row.
 */
export function rateFromCounts(input: {
  occasions: number
  students: number
  present: number
  excused: number
}): AttendanceRateResult {
  const occasions = Math.max(0, Math.trunc(input.occasions))
  const students = Math.max(0, Math.trunc(input.students))
  const expected = occasions * students
  const excused = Math.max(0, Math.min(expected, Math.trunc(input.excused)))
  const held = Math.max(0, expected - excused)
  const attended = Math.max(0, Math.min(held, Math.trunc(input.present)))
  return {
    occasions,
    students,
    held,
    attended,
    excused,
    absent: held - attended,
    rate: held === 0 ? null : Math.round((attended / held) * 100),
  }
}

/**
 * Attendance rate over a set of rows.
 *
 * By default the held occasions and the roster are both inferred from the rows
 * themselves. Pass `occasions` (from `heldOccasions` over the whole class) and
 * `studentIds` (the full roster) when scoring one student, so a student with no
 * row at all for a held session still counts as absent.
 */
export function attendanceRate(
  rows: readonly AttendanceRow[],
  options: { occasions?: readonly string[]; studentIds?: readonly string[] } = {},
): AttendanceRateResult {
  const occasions = Array.from(new Set(options.occasions ?? heldOccasions(rows)))
  const studentIds = Array.from(new Set(options.studentIds ?? rows.map((r) => r.studentId)))
  const { present, excused } = countAttendanceCells(rows, { occasions, studentIds })
  return rateFromCounts({ occasions: occasions.length, students: studentIds.length, present, excused })
}

/**
 * Collapse rows to one verdict per (student, occasion) and count them.
 *
 * The numerator of a rate has to be counted at the same granularity as the
 * denominator: two rows for one session in one week are one occasion, not two.
 * Split out from `attendanceRate` so the church report — which sizes its
 * denominator from a `groupBy` student count and has no roster of ids — can
 * still feed `rateFromCounts` a numerator counted the same way.
 */
export function countAttendanceCells(
  rows: readonly AttendanceRow[],
  options: { occasions?: readonly string[]; studentIds?: readonly string[] } = {},
): { present: number; excused: number } {
  const known = options.occasions ? new Set(options.occasions) : null
  const inScope = options.studentIds ? new Set(options.studentIds) : null

  // One verdict per (student, occasion), independent of row order.
  const best = new Map<string, AttendanceStatusKey>()
  for (const row of rows) {
    if (inScope && !inScope.has(row.studentId)) continue
    const key = occasionKey(row.sessionKey, row.date)
    if (known && !known.has(key)) continue
    const cell = `${row.studentId}|${key}`
    const prev = best.get(cell)
    if (!prev || STATUS_RANK[row.status] > STATUS_RANK[prev]) best.set(cell, row.status)
  }

  let present = 0
  let excused = 0
  for (const status of Array.from(best.values())) {
    if (status === 'PRESENT') present += 1
    else if (status === 'EXCUSED') excused += 1
  }
  return { present, excused }
}

export type Band = 'excellent' | 'good' | 'low'

/** §5 bands: ≥80 excellent, ≥50 "can do better", below that needs attention. */
export function attendanceBand(rate: number | null): Band | null {
  if (rate === null) return null
  if (rate >= 80) return 'excellent'
  if (rate >= 50) return 'good'
  return 'low'
}

/**
 * §5 quiz bands. The "good" floor is the pass mark — F0035; see
 * QUIZ_PASS_PERCENT for why it is not 60.
 */
export function quizBand(percentage: number | null): Band | null {
  if (percentage === null) return null
  if (percentage >= QUIZ_EXCELLENT_PERCENT) return 'excellent'
  if (percentage >= QUIZ_PASS_PERCENT) return 'good'
  return 'low'
}

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

/* ── Calendar helpers for the month matrix ────────────────────────────────── */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_RE = /^(\d{4})-(\d{2})$/

/** "2026-09" → { from: "2026-09-01", to: "2026-09-30" }. Throws on nonsense. */
export function monthRange(month: string): { from: string; to: string } {
  const m = MONTH_RE.exec(month)
  if (!m) throw new Error(`Invalid month "${month}"`)
  const year = Number(m[1])
  const mon = Number(m[2])
  if (mon < 1 || mon > 12) throw new Error(`Invalid month "${month}"`)
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function monthLabel(month: string): string {
  const m = MONTH_RE.exec(month)
  if (!m) return month
  return `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}`
}

/**
 * Every date in the month that falls on `dayOfWeek` (0 = Sunday) — the blank
 * attendance form's columns. A non-Sunday session (Bible study on a Wednesday,
 * say) printed Sunday dates, so whoever transcribed the paper roll afterwards
 * filed the marks under the wrong days.
 */
export function weekdaysInMonth(month: string, dayOfWeek: number): string[] {
  const { from, to } = monthRange(month)
  const day = ((dayOfWeek % 7) + 7) % 7
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (toUTCDate(d).getUTCDay() === day) out.push(d)
  }
  return out
}

/**
 * The weekday a class actually holds a session on, learned from the dates it
 * has already recorded. There is no day-of-week column on AttendanceSession, so
 * the blank paper form used to hardcode Sunday — a Wednesday Bible study came
 * back with every mark filed under the wrong day. Ties and no history fall back
 * to Sunday, which is what it did before.
 */
export function dominantWeekday(dates: readonly string[]): number {
  const counts = new Array<number>(7).fill(0)
  for (const d of dates) {
    const day = toUTCDate(d).getUTCDay()
    if (Number.isInteger(day)) counts[day] = (counts[day] ?? 0) + 1
  }
  let best = 0
  for (let i = 1; i < 7; i++) if ((counts[i] ?? 0) > (counts[best] ?? 0)) best = i
  return (counts[best] ?? 0) > 0 ? best : 0
}

/** Every Sunday in the month. */
export function sundaysInMonth(month: string): string[] {
  return weekdaysInMonth(month, 0)
}

/** The month a date belongs to, as "YYYY-MM". */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month)
  if (!m) return month
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/* ── Month matrix ─────────────────────────────────────────────────────────── */

export interface MatrixStudent {
  id: string
  name: string
}

export interface MatrixRow {
  studentId: string
  name: string
  /** One cell per column in `dates`; null when no row was recorded. */
  marks: (AttendanceStatusKey | null)[]
  present: number
  excused: number
  absent: number
  rate: number | null
}

export interface MonthMatrix {
  month: string
  label: string
  dates: string[]
  rows: MatrixRow[]
  totals: { present: number; excused: number; absent: number; held: number; rate: number | null }
}

/**
 * Students down the side, dates across, one mark per cell.
 *
 * Columns are the dates attendance was actually taken in that month. When
 * nothing was taken (or `options.dates` is given) the caller's dates are used —
 * that is how the blank paper form gets its Sunday columns.
 */
export function buildMonthMatrix(
  students: readonly MatrixStudent[],
  records: readonly { studentId: string; date: string; status: AttendanceStatusKey }[],
  month: string,
  options: { dates?: readonly string[] } = {},
): MonthMatrix {
  const { from, to } = monthRange(month)
  const inMonth = records.filter((r) => r.date >= from && r.date <= to)

  const dates = options.dates
    ? Array.from(new Set(options.dates)).sort()
    : inMonth.length > 0
      ? Array.from(new Set(inMonth.map((r) => r.date))).sort()
      : sundaysInMonth(month)

  const columnIndex = new Map(dates.map((d, i) => [d, i]))
  const byStudent = new Map<string, (AttendanceStatusKey | null)[]>()
  for (const s of students) byStudent.set(s.id, dates.map(() => null))

  for (const rec of inMonth) {
    const col = columnIndex.get(rec.date)
    const row = byStudent.get(rec.studentId)
    if (col === undefined || !row) continue
    const prev = row[col]
    if (!prev || STATUS_RANK[rec.status] > STATUS_RANK[prev]) row[col] = rec.status
  }

  const anyRecords = inMonth.length > 0
  // F0204 — a column only exists because somebody in the class was marked that
  // day, so a student with no row of their own was absent, not "not marked".
  // The QR flows write a row only for the children who scanned (actions/qr.ts
  // :398-411), so on a QR Sunday everyone who did not scan printed as an empty
  // box: a parent reading the sheet sees a servant who never took the register.
  // The rate column already counts them absent, so this only stops the grid
  // from contradicting the number beside it.
  const heldColumns = new Set<number>()
  for (const rec of inMonth) {
    const col = columnIndex.get(rec.date)
    if (col !== undefined) heldColumns.add(col)
  }
  const rows: MatrixRow[] = students.map((s) => {
    const marks = (byStudent.get(s.id) ?? dates.map(() => null)).map((mark, i) =>
      mark ?? (heldColumns.has(i) ? ('ABSENT' as const) : null),
    )
    let present = 0
    let excused = 0
    for (const mark of marks) {
      if (mark === 'PRESENT') present += 1
      else if (mark === 'EXCUSED') excused += 1
    }
    const held = Math.max(0, dates.length - excused)
    return {
      studentId: s.id,
      name: s.name,
      marks,
      present,
      excused,
      absent: held - present,
      rate: !anyRecords || held === 0 ? null : Math.round((present / held) * 100),
    }
  })

  const present = rows.reduce((n, r) => n + r.present, 0)
  const excused = rows.reduce((n, r) => n + r.excused, 0)
  const held = Math.max(0, dates.length * students.length - excused)
  return {
    month,
    label: monthLabel(month),
    dates,
    rows,
    totals: {
      present,
      excused,
      absent: held - present,
      held,
      rate: !anyRecords || held === 0 ? null : Math.round((present / held) * 100),
    },
  }
}

/* ── Church report ────────────────────────────────────────────────────────── */

export interface ClassSummaryInput {
  classId: string
  className: string
  stage?: string
  students: number
  /** Distinct (session, week) occasions held in the period. */
  occasions: number
  present: number
  excused: number
  quizPercentages?: readonly number[]
  /** Pre-averaged percentage when the caller used a DB aggregate. */
  quizAverage?: number | null
  quizCount?: number
  pointsTotal: number
}

export interface ClassSummaryRow {
  classId: string
  className: string
  stage?: string
  students: number
  attendance: AttendanceRateResult
  attendanceBand: Band | null
  quizAverage: number | null
  quizCount: number
  quizBand: Band | null
  pointsTotal: number
  pointsPerStudent: number | null
}

/** One row of the church report: attendance, exam average and points for a class. */
export function classSummary(input: ClassSummaryInput): ClassSummaryRow {
  const attendance = rateFromCounts({
    occasions: input.occasions,
    students: input.students,
    present: input.present,
    excused: input.excused,
  })
  const quizAverage =
    input.quizPercentages && input.quizPercentages.length > 0
      ? average(input.quizPercentages)
      : input.quizAverage ?? null
  const quizCount = input.quizPercentages ? input.quizPercentages.length : input.quizCount ?? 0
  return {
    classId: input.classId,
    className: input.className,
    stage: input.stage,
    students: input.students,
    attendance,
    attendanceBand: attendanceBand(attendance.rate),
    quizAverage,
    quizCount,
    quizBand: quizBand(quizAverage),
    pointsTotal: input.pointsTotal,
    pointsPerStudent: input.students === 0 ? null : Math.round(input.pointsTotal / input.students),
  }
}

/** Totals across every class in the report. */
export function churchTotals(rows: readonly ClassSummaryRow[]) {
  const students = rows.reduce((n, r) => n + r.students, 0)
  const held = rows.reduce((n, r) => n + r.attendance.held, 0)
  const attended = rows.reduce((n, r) => n + r.attendance.attended, 0)
  const pointsTotal = rows.reduce((n, r) => n + r.pointsTotal, 0)
  const graded = rows.filter((r) => r.quizAverage !== null && r.quizCount > 0)
  const quizCount = graded.reduce((n, r) => n + r.quizCount, 0)
  const quizAverage =
    quizCount === 0
      ? null
      : Math.round(graded.reduce((n, r) => n + (r.quizAverage ?? 0) * r.quizCount, 0) / quizCount)
  return {
    classes: rows.length,
    students,
    held,
    attended,
    rate: held === 0 ? null : Math.round((attended / held) * 100),
    pointsTotal,
    quizAverage,
    quizCount,
  }
}

/* ── Report card ──────────────────────────────────────────────────────────── */

/**
 * One quiz on a report card. The prototype showed a ring per exam with its
 * correct/total and the points it earned (OG L6417-6454); the port carried only
 * a percentage, so the card could say "82% average" and nothing else — a parent
 * could not see which quiz went badly.
 */
export interface ReportCardExam {
  examId: string
  title: string
  percentage: number
  correct: number
  questions: number
  points: number
  submittedAt: string | null
}

export interface ReportCardInput {
  studentId: string
  name: string
  className: string
  attendance: AttendanceRateResult
  quizPercentages: readonly number[]
  exams?: readonly ReportCardExam[]
  pointsTotal: number
  /**
   * F0185 — where the points came from. A card that says only "184 points"
   * cannot answer the question a parent actually asks at the door: is that
   * because he turns up, or because he works? The prototype broke it down.
   */
  pointsBySource?: readonly { source: string; points: number }[]
  badges: readonly string[]
  rank?: number | null
}

export interface ReportCard {
  studentId: string
  name: string
  className: string
  attendance: AttendanceRateResult
  attendanceBand: Band | null
  quizAverage: number | null
  quizCount: number
  quizBand: Band | null
  /** Newest first. */
  exams: ReportCardExam[]
  examCorrect: number
  examQuestions: number
  examPoints: number
  pointsTotal: number
  /** Largest first, zero-point sources dropped. */
  pointsBySource: Array<{ source: string; label: string; points: number }>
  badges: string[]
  rank: number | null
}

export function buildReportCard(input: ReportCardInput): ReportCard {
  const quizAverage = average(input.quizPercentages)
  const exams = (input.exams ?? []).slice()
  return {
    studentId: input.studentId,
    name: input.name,
    className: input.className,
    attendance: input.attendance,
    attendanceBand: attendanceBand(input.attendance.rate),
    quizAverage,
    quizCount: input.quizPercentages.length,
    quizBand: quizBand(quizAverage),
    exams,
    examCorrect: exams.reduce((n, e) => n + e.correct, 0),
    examQuestions: exams.reduce((n, e) => n + e.questions, 0),
    examPoints: exams.reduce((n, e) => n + e.points, 0),
    pointsTotal: input.pointsTotal,
    pointsBySource: (input.pointsBySource ?? [])
      .filter((r) => r.points !== 0)
      .map((r) => ({ source: r.source, label: POINT_SOURCE_LABEL[r.source] ?? r.source, points: r.points }))
      .sort((a, b) => b.points - a.points),
    badges: Array.from(new Set(input.badges)),
    rank: input.rank ?? null,
  }
}

/**
 * F0185 — how each point source reads on a sheet that goes home to a family.
 * "ATTENDANCE" is a database value; "Attending" is what a parent understands.
 */
export const POINT_SOURCE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Attending',
  MANUAL: 'Given by a servant',
  QUIZ: 'Quizzes',
  QR: 'Scanned in',
  UNDO: 'Corrections',
}

/** The medal a top-three place earns on the printed card (the prototype's own). */
export const RANK_MEDAL: Record<number, string> = { 1: '\u{1F947}', 2: '\u{1F948}', 3: '\u{1F949}' }

/**
 * Which session a headline attendance figure should be scored over.
 *
 * Every stat card hardcoded `sessionKey: 'sunday'`, so a class whose main
 * register is Bible Study or Liturgy read "No sessions yet" on every card it
 * looks at day to day, while the reports page had its attendance all along.
 *
 * Deliberately a fallback rather than a redefinition: a class that records
 * Sunday School is still scored on Sunday School, so no existing number moves.
 * Only a class with no Sunday rows at all falls back to everything it does
 * record. Returns null for "all sessions".
 */
export function headlineSession(rows: readonly { sessionKey: string }[]): string | null {
  return rows.some((r) => r.sessionKey === 'sunday') ? 'sunday' : null
}

/** The rows that headline figure is computed from. */
export function headlineRows<T extends { sessionKey: string }>(rows: readonly T[]): T[] {
  const key = headlineSession(rows)
  return key ? rows.filter((r) => r.sessionKey === key) : [...rows]
}

/**
 * Whether a class took its register for a given Sunday, and how it went.
 *
 * F0164 — a coordinator's question midweek is "which of my classes never took
 * last Sunday's register", and the dashboard could only answer it *on* the
 * Sunday. Judging a fixed date rather than "today" is what lets the answer
 * survive to the Wednesday, when there is time to chase it.
 *
 * `other-day` is the state worth being careful about. Not every class's
 * register is a Sunday one — `headlineSession` above exists precisely because
 * classes recording only Bible Study read "No sessions yet" on every card they
 * looked at. Flagging such a class amber every week for missing a Sunday it
 * never holds is a false alarm, and a panel of false alarms stops being read.
 */
export type RegisterState = 'taken' | 'missing' | 'other-day' | 'no-students'

export interface RegisterStatus {
  state: RegisterState
  /** The Sunday the class is being judged on. */
  sunday: string
  /** The date the counts belong to: the Sunday, or the last day it did record. */
  date: string | null
  present: number
  /** The roster, not the rows: a child with no row at all was still expected. */
  total: number
}

export function registerStatus(args: {
  sunday: string
  rosterSize: number
  rows: readonly AttendanceRow[]
}): RegisterStatus {
  const { sunday, rosterSize, rows } = args

  /** Distinct children marked present that day, on that day's headline session. */
  const presentOn = (date: string) =>
    new Set(
      headlineRows(rows.filter((r) => r.date === date))
        .filter((r) => r.status === 'PRESENT')
        .map((r) => r.studentId),
    ).size

  if (rosterSize === 0) return { state: 'no-students', sunday, date: null, present: 0, total: 0 }

  if (rows.some((r) => r.date === sunday)) {
    return { state: 'taken', sunday, date: sunday, present: presentOn(sunday), total: rosterSize }
  }

  /*
   * Does this class record on Sundays at all? Asked of the dates it has
   * actually recorded rather than of its session names — a class can hold
   * "Sunday School" on a Saturday, and `sessionKey` would say Sunday either
   * way. A class that never meets on a Sunday must not be nagged about one.
   */
  if (rows.length > 0 && !rows.some((r) => toUTCDate(r.date).getUTCDay() === 0)) {
    const last = rows.reduce((latest, r) => (r.date > latest ? r.date : latest), rows[0]!.date)
    return { state: 'other-day', sunday, date: last, present: presentOn(last), total: rosterSize }
  }

  return { state: 'missing', sunday, date: null, present: 0, total: rosterSize }
}

export interface SessionTrendDay {
  date: string
  present: number
  excused: number
  absent: number
  /** Roster members with no PRESENT mark that day, in roster order. */
  missing: string[]
  rate: number | null
}

/**
 * The last few times this class held this session, and who was not there.
 *
 * The prototype showed a ring per recent date with a one-tap "who was missing"
 * (OG L5414-5417). The port showed the register for one date and nothing about
 * the weeks around it, so a servant could not see a child quietly sliding away
 * without opening four separate dates.
 *
 * Excused counts as not-present here, deliberately: the question this answers
 * is "who was not in the room", which is the question a servant chasing a
 * child is asking. The scored attendance rate elsewhere still drops excused
 * absences from the denominator; these are different questions and the UI says
 * which one it is showing.
 */
export function sessionTrend(
  dates: readonly string[],
  rows: readonly { studentId: string; date: string; status: AttendanceStatusKey }[],
  roster: readonly MatrixStudent[],
): SessionTrendDay[] {
  const byDate = new Map<string, Map<string, AttendanceStatusKey>>()
  for (const r of rows) {
    const day = byDate.get(r.date) ?? new Map<string, AttendanceStatusKey>()
    const prev = day.get(r.studentId)
    if (!prev || STATUS_RANK[r.status] > STATUS_RANK[prev]) day.set(r.studentId, r.status)
    byDate.set(r.date, day)
  }

  return dates
    .slice()
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => {
      const day = byDate.get(date) ?? new Map<string, AttendanceStatusKey>()
      let present = 0
      let excused = 0
      const missing: string[] = []
      for (const s of roster) {
        const status = day.get(s.id)
        if (status === 'PRESENT') present += 1
        else {
          if (status === 'EXCUSED') excused += 1
          missing.push(s.name)
        }
      }
      const size = roster.length
      return {
        date,
        present,
        excused,
        absent: Math.max(0, size - present - excused),
        missing,
        rate: size === 0 ? null : Math.round((present / size) * 100),
      }
    })
}

/* ── All-sessions month grid ──────────────────────────────────────────────── */

/**
 * The prototype's session abbreviations (OG L8944), so a grid six sessions wide
 * still fits on a sheet of paper.
 */
export const SESSION_ABBR: Readonly<Record<string, string>> = {
  bible: 'BS',
  vespers: 'V',
  tasbeha: 'T',
  liturgy: 'SL',
  sunday: 'SS',
  hymns: 'H',
}

/**
 * The prototype's palette for the six session pills, applied in session order
 * (OG `wrColors`, L6230). The two spare colours are there because the church
 * can add sessions the prototype never had.
 */
const SESSION_PALETTE = [
  '#16A34A', '#EA580C', '#2563EB', '#DC2626', '#CA8A04', '#7C3AED', '#0891B2', '#DB2777',
] as const

/** The colour for a session, by its position in the church's session list. */
export function sessionColor(index: number): string {
  return SESSION_PALETTE[index % SESSION_PALETTE.length]!
}

/** Falls back to initials for a session the church added after the prototype. */
export function sessionAbbr(key: string, label: string): string {
  const known = SESSION_ABBR[key]
  if (known) return known
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join('')
  return (initials || key).slice(0, 3).toUpperCase()
}

export interface SessionMeta {
  key: string
  label: string
}

export interface GridColumn {
  week: string
  sessionKey: string
  abbr: string
  label: string
  /**
   * True when the class actually recorded this session in this week. The grid
   * draws every week × every session regardless, as the prototype did, and a
   * column that was never held shows a dash — but only held columns count
   * towards anybody's rate.
   */
  held: boolean
}

export interface GridWeek {
  week: string
  label: string
  /** How many session columns sit under this week's header. */
  span: number
}

export interface GridRow {
  studentId: string
  name: string
  /** One per column, in `columns` order. */
  marks: (AttendanceStatusKey | null)[]
  present: number
  excused: number
  held: number
  rate: number | null
}

export interface MultiSessionMatrix {
  month: string
  label: string
  weeks: GridWeek[]
  columns: GridColumn[]
  rows: GridRow[]
  totals: { present: number; excused: number; absent: number; held: number; rate: number | null }
}

/** Every Monday-to-Sunday week that overlaps the month (OG L8951-8958). */
export function weeksOverlappingMonth(month: string): string[] {
  const { from, to } = monthRange(month)
  const out: string[] = []
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) out.push(monday)
  return out
}

function weekLabelFor(monday: string): string {
  const sunday = addDays(monday, 6)
  const m = (d: string) => MONTH_NAMES[Number(d.slice(5, 7)) - 1]!.slice(0, 3)
  const day = (d: string) => String(Number(d.slice(8, 10)))
  return m(monday) === m(sunday)
    ? `${m(monday)} ${day(monday)}–${day(sunday)}`
    : `${m(monday)} ${day(monday)} – ${m(sunday)} ${day(sunday)}`
}

/**
 * Students down the side; across the top, one group per week of the month with
 * a column per session inside it.
 *
 * The prototype's attendance report was this grid — all six weekly sessions in
 * one month view (OG renderAttendanceMonthTable, L8938-9017). The port reduced
 * it to a single session at a time, so seeing a month properly meant running
 * and printing the report six times.
 *
 * Every week of the month gets every session as a column, always — the shape
 * the prototype drew (`colspan=activities.length` over `weeks.forEach`, OG
 * L8985-9005) — and a (week, session) the class never recorded is rendered as a
 * dash, which is what its legend means by "Not held that week".
 *
 * Drawing only the columns that had records, as this did until now, collapsed a
 * month with one register taken into a single column: the same data, a page
 * nobody recognised. But the shape and the arithmetic have to stay separate —
 * `column.held` says whether a cell is a real box or a dash, and **only held
 * columns count towards a rate**, so drawing thirty boxes for one register
 * cannot turn a child who came into 1/30.
 *
 * `options.sessionKeys` marks every column held, which is how the blank paper
 * form gets a tickable box in every cell.
 */
export function buildMultiSessionMatrix(
  students: readonly MatrixStudent[],
  records: readonly { studentId: string; date: string; sessionKey: string; status: AttendanceStatusKey }[],
  sessions: readonly SessionMeta[],
  month: string,
  options: { sessionKeys?: readonly string[] } = {},
): MultiSessionMatrix {
  const { from, to } = monthRange(month)
  const inMonth = records.filter((r) => r.date >= from && r.date <= to)
  const weeks = weeksOverlappingMonth(month)
  const known = new Map(sessions.map((s) => [s.key, s]))

  const heldPairs = new Set<string>()
  if (options.sessionKeys) {
    for (const week of weeks) for (const key of options.sessionKeys) if (known.has(key)) heldPairs.add(`${key}@${week}`)
  } else {
    for (const r of inMonth) if (known.has(r.sessionKey)) heldPairs.add(`${r.sessionKey}@${mondayOf(r.date)}`)
  }

  const columns: GridColumn[] = []
  const weekHeaders: GridWeek[] = []
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]!
    // F0443 — the church says "the 3rd week of October"; a bare date range made
    // a servant count Mondays to work out which week of the month they were
    // looking at, which is the one thing this header exists to answer.
    weekHeaders.push({ week, label: `Week ${i + 1} (${weekLabelFor(week)})`, span: sessions.length })
    for (const s of sessions) {
      columns.push({
        week,
        sessionKey: s.key,
        abbr: sessionAbbr(s.key, s.label),
        label: s.label,
        held: heldPairs.has(`${s.key}@${week}`),
      })
    }
  }

  // The denominator is the sessions actually taken, never the boxes drawn.
  const heldColumns = columns.reduce((n, c) => (c.held ? n + 1 : n), 0)

  const columnIndex = new Map(columns.map((c, i) => [`${c.sessionKey}@${c.week}`, i]))
  const byStudent = new Map<string, (AttendanceStatusKey | null)[]>()
  for (const s of students) byStudent.set(s.id, columns.map(() => null))

  for (const rec of inMonth) {
    const col = columnIndex.get(`${rec.sessionKey}@${mondayOf(rec.date)}`)
    const row = byStudent.get(rec.studentId)
    if (col === undefined || !row) continue
    const prev = row[col]
    if (!prev || STATUS_RANK[rec.status] > STATUS_RANK[prev]) row[col] = rec.status
  }

  const rows: GridRow[] = students.map((s) => {
    const marks = byStudent.get(s.id) ?? columns.map(() => null)
    let present = 0
    let excused = 0
    for (const mark of marks) {
      if (mark === 'PRESENT') present += 1
      else if (mark === 'EXCUSED') excused += 1
    }
    const held = Math.max(0, heldColumns - excused)
    return {
      studentId: s.id,
      name: s.name,
      marks,
      present,
      excused,
      held,
      rate: held === 0 ? null : Math.round((present / held) * 100),
    }
  })

  const present = rows.reduce((n, r) => n + r.present, 0)
  const excused = rows.reduce((n, r) => n + r.excused, 0)
  const held = rows.reduce((n, r) => n + r.held, 0)
  return {
    month,
    label: monthLabel(month),
    weeks: weekHeaders,
    columns,
    rows,
    totals: {
      present,
      excused,
      absent: Math.max(0, held - present),
      held,
      rate: held === 0 ? null : Math.round((present / held) * 100),
    },
  }
}

/** "first-quiz" → "First Quiz", so a badge key never reaches a parent raw. */
export function prettyBadge(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export const BAND_LABEL: Record<Band, string> = {
  excellent: 'Excellent',
  good: 'Can do better',
  low: 'Needs attention',
}

/**
 * The month grid's marks (OG legend: "✓ Present  ✗ Absent  — Not held that
 * week"). Separate from STATUS_MARK because the CSV export and the
 * single-session table both need plain letters.
 *
 * EXCUSED is the one thing the prototype's grid could not say — it read
 * `present ? 'present' : 'absent'` and nothing else, so an excused child was
 * printed as absent. Ours keeps a distinct mark rather than copy that, because
 * this report goes home to parents.
 */
export const GRID_MARK: Record<AttendanceStatusKey, string> = {
  PRESENT: '\u2713',
  EXCUSED: 'E',
  ABSENT: '\u2717',
}

export const STATUS_MARK: Record<AttendanceStatusKey, string> = {
  PRESENT: 'P',
  EXCUSED: 'E',
  ABSENT: 'A',
}

/* ── Shared result shapes for the admin data tools ───────────────────────────
 * These are the only pure module in this feature area, so the server actions in
 * lib/portal/actions/data-tools.ts and the panels that render their results
 * agree on their shapes here. ('use server' files may only export async
 * functions, so the types cannot live beside the actions.)
 */

export interface BackupTableCount {
  table: string
  rows: number
}

export interface BackupSummary {
  filename: string
  json: string
  tables: BackupTableCount[]
  totalRows: number
  photosIncluded: boolean
  bytes: number
}

export type ImportRowStatus = 'created' | 'updated' | 'skipped' | 'error'

export interface ImportRowResult {
  /** 1-based data row number, matching what the admin sees in their sheet. */
  row: number
  name: string
  loginId: string | null
  status: ImportRowStatus
  message?: string
  /** Only ever set for an account this import just created. */
  newPin?: string
}

export interface ImportSummary {
  created: number
  updated: number
  skipped: number
  errors: number
  rows: ImportRowResult[]
}

export interface RepairResult {
  tool: string
  label: string
  dryRun: boolean
  /** Rows the tool matched. */
  found: number
  /** Rows it actually changed (0 on a dry run). */
  changed: number
  detail: string[]
}

/**
 * Danger Zone confirmations. The panel asks the admin to type the phrase and
 * the server action checks it again — the client is never believed.
 */
export const CONFIRM_PHRASE = {
  endOfYear: 'RESET YEAR',
  resetActivities: 'RESET ACTIVITIES',
  clearPoints: 'CLEAR POINTS',
  deleteClassStudents: 'DELETE STUDENTS',
  resetClassPins: 'RESET PINS',
  resetAllActivities: 'RESET ALL ACTIVITIES',
} as const

export interface DangerResult {
  action: string
  deleted: BackupTableCount[]
  detail: string
}

export function summariseImport(rows: readonly ImportRowResult[]): ImportSummary {
  return {
    created: rows.filter((r) => r.status === 'created').length,
    updated: rows.filter((r) => r.status === 'updated').length,
    skipped: rows.filter((r) => r.status === 'skipped').length,
    errors: rows.filter((r) => r.status === 'error').length,
    rows: [...rows],
  }
}

/** Convenience for report filenames: "attendance-5th-6th-boys-2026-09.csv". */
export function reportFilename(parts: readonly (string | null | undefined)[], ext: string): string {
  const slug = parts
    .filter((p): p is string => !!p)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'report'}.${ext}`
}

/** Dates helper re-exported for report pages that only import this module. */
export function dateOnly(d: Date): string {
  return formatDateOnly(d)
}

export interface QuizScoreRow {
  studentId: string
  name: string
  percentage: number | null
}

export interface TopPerformer {
  studentId: string
  name: string
  average: number
  count: number
}

/**
 * The prototype's "Top Performing Students" ranking (OG L4291-4305): mean quiz
 * percentage, **minimum two quizzes** so one lucky score cannot outrank a
 * student who is consistently good, ties broken by who has sat more.
 */
export const MIN_QUIZZES_FOR_RANKING = 2

export function topQuizPerformers(rows: readonly QuizScoreRow[], limit = 4): TopPerformer[] {
  const byStudent = new Map<string, { name: string; scores: number[] }>()
  for (const r of rows) {
    if (r.percentage === null || r.percentage === undefined) continue
    const entry = byStudent.get(r.studentId) ?? { name: r.name, scores: [] }
    entry.scores.push(r.percentage)
    byStudent.set(r.studentId, entry)
  }
  return Array.from(byStudent.entries())
    .filter(([, v]) => v.scores.length >= MIN_QUIZZES_FOR_RANKING)
    .map(([studentId, v]) => ({
      studentId,
      name: v.name,
      average: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
      count: v.scores.length,
    }))
    .sort((a, b) => b.average - a.average || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/**
 * The prototype's "vs last session" arrow: how the most recent session's
 * attendance compares with the one before it. Sessions whose rate could not be
 * scored at all are not a comparison, so they are skipped rather than read as
 * zero — which would invent a collapse and then a recovery.
 */
export function attendanceDelta(trend: readonly { date: string; rate: number | null }[]): number | null {
  const scored = trend.filter((t) => t.rate !== null) as { date: string; rate: number }[]
  if (scored.length < 2) return null
  return scored[scored.length - 1]!.rate - scored[scored.length - 2]!.rate
}

export interface SchoolYearMonth {
  /** "2026-09". */
  key: string
  /** "SEP" — the chip's own label. */
  abbr: string
  /** "September 2026" — for the accessible name. */
  label: string
}

// Reuses MONTH_NAMES, declared near the top of this file for the range labels.
const MONTH_ABBRS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/**
 * The twelve months of the school year, September→August (F0139/F0441).
 *
 * The prototype offered these as a row of tappable pills; the port replaced
 * them with a native month input, which is three interactions to reach October
 * and gives no sense of the year as a whole. The pills are also how the church
 * talks about the year — it starts in September, not January.
 */
export function schoolYearMonths(todayKey: string): SchoolYearMonth[] {
  const year = Number(todayKey.slice(0, 4))
  const month = Number(todayKey.slice(5, 7))
  const startYear = month >= 9 ? year : year - 1
  return Array.from({ length: 12 }, (_, i) => {
    const mIdx = (8 + i) % 12
    const mYear = startYear + (mIdx < 8 ? 1 : 0)
    return {
      key: `${mYear}-${String(mIdx + 1).padStart(2, '0')}`,
      abbr: MONTH_ABBRS[mIdx]!,
      label: `${MONTH_NAMES[mIdx]} ${mYear}`,
    }
  })
}
