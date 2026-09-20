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

/** §5 quiz bands: ≥90 excellent, ≥60 good. */
export function quizBand(percentage: number | null): Band | null {
  if (percentage === null) return null
  if (percentage >= 90) return 'excellent'
  if (percentage >= 60) return 'good'
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

/** Every Sunday in the month — the blank attendance form's columns. */
export function sundaysInMonth(month: string): string[] {
  const { from, to } = monthRange(month)
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (toUTCDate(d).getUTCDay() === 0) out.push(d)
  }
  return out
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
  const rows: MatrixRow[] = students.map((s) => {
    const marks = byStudent.get(s.id) ?? dates.map(() => null)
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

export interface ReportCardInput {
  studentId: string
  name: string
  className: string
  attendance: AttendanceRateResult
  quizPercentages: readonly number[]
  pointsTotal: number
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
  pointsTotal: number
  badges: string[]
  rank: number | null
}

export function buildReportCard(input: ReportCardInput): ReportCard {
  const quizAverage = average(input.quizPercentages)
  return {
    studentId: input.studentId,
    name: input.name,
    className: input.className,
    attendance: input.attendance,
    attendanceBand: attendanceBand(input.attendance.rate),
    quizAverage,
    quizCount: input.quizPercentages.length,
    quizBand: quizBand(quizAverage),
    pointsTotal: input.pointsTotal,
    badges: Array.from(new Set(input.badges)),
    rank: input.rank ?? null,
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
