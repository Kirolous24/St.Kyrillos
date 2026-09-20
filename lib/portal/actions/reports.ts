'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import type { PortalUser } from '../permissions'
import { assertClassAction } from '../data/classes'
import { studentName } from '../data/students'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { toUTCDate, formatDateOnly, parseDateOnly } from '../dates'
import { toCsv } from '../csv'
import { reportFilename, STATUS_MARK } from '../reports'
import { isReportsStaff, loadAttendanceMatrix, loadChurchReport, loadReportCards } from '../data/reports'
import { audit } from '../audit'

// The printable reports build their own CSV on the page, because they are
// small. These actions exist for the exports that would be wasteful to embed in
// every page render — the row-by-row attendance detail above all.

/**
 * A class-wide export is staff-only. `class.read` is not enough on its own:
 * permissions.ts grants a STUDENT `class.read` for their own class, so an
 * export gated on it alone would hand a student the whole roster's attendance
 * — reasons, notes and the servant who marked each row. The `notFound()` on
 * the reports page does not cover these actions: a server action is its own
 * POST endpoint and can be invoked without ever rendering that page.
 */
function assertReportsStaff(user: PortalUser): void {
  if (!isReportsStaff(user)) {
    throw new PortalError('Reports are available to servants and clergy only.')
  }
}

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pick a month.')
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.')
const SessionSchema = z.string().trim().min(1).max(30)

const MatrixSchema = z.object({
  classId: z.string().min(1),
  month: MonthSchema,
  sessionKey: SessionSchema,
})

export async function exportAttendanceMatrixCsv(
  raw: z.infer<typeof MatrixSchema>,
): Promise<ActionResult<{ filename: string; csv: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = MatrixSchema.parse(raw)
    assertReportsStaff(user)
    await assertClassAction(user, input.classId, 'class.read')
    const data = await loadAttendanceMatrix(user, input)

    const header = ['Student', ...data.matrix.dates, 'Present', 'Excused', 'Absent', 'Rate %']
    const rows = data.matrix.rows.map((r) => [
      r.name,
      ...r.marks.map((m) => (m ? STATUS_MARK[m] : '')),
      r.present,
      r.excused,
      r.absent,
      r.rate ?? '',
    ])
    const totals = [
      'Class total',
      ...data.matrix.dates.map(() => ''),
      data.matrix.totals.present,
      data.matrix.totals.excused,
      data.matrix.totals.absent,
      data.matrix.totals.rate ?? '',
    ]
    await audit(user, 'report.export', 'class', input.classId, `Attendance matrix CSV for ${data.cls.name} ${input.month}`)
    return {
      filename: reportFilename(['attendance', data.cls.name, input.month], 'csv'),
      csv: toCsv([header, ...rows, totals]),
    }
  })
}

const PeriodSchema = z.object({
  from: DateSchema,
  to: DateSchema,
  sessionKey: SessionSchema.nullable(),
})

export async function exportChurchReportCsv(
  raw: z.infer<typeof PeriodSchema>,
): Promise<ActionResult<{ filename: string; csv: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = PeriodSchema.parse(raw)
    const data = await loadChurchReport(user, input)
    if (!data) throw new PortalError('You do not have access to the church report.')

    const header = ['Class', 'Stage', 'Students', 'Sessions held', 'Expected', 'Attended', 'Excused', 'Attendance %', 'Quiz average %', 'Quizzes', 'Points']
    const rows = data.classes.map((c) => [
      c.className,
      c.stage ?? '',
      c.students,
      c.attendance.occasions,
      c.attendance.held,
      c.attendance.attended,
      c.attendance.excused,
      c.attendance.rate ?? '',
      c.quizAverage ?? '',
      c.quizCount,
      c.pointsTotal,
    ])
    const totals = ['All classes', '', data.totals.students, '', data.totals.held, data.totals.attended, '', data.totals.rate ?? '', data.totals.quizAverage ?? '', data.totals.quizCount, data.totals.pointsTotal]
    await audit(user, 'report.export', 'church', null, `Church report CSV ${input.from} → ${input.to}`)
    return {
      filename: reportFilename(['church-report', input.from, input.to], 'csv'),
      csv: toCsv([header, ...rows, totals]),
    }
  })
}

const CardsSchema = z.object({
  classId: z.string().min(1),
  from: DateSchema,
  to: DateSchema,
  sessionKey: SessionSchema.nullable(),
})

export async function exportReportCardsCsv(
  raw: z.infer<typeof CardsSchema>,
): Promise<ActionResult<{ filename: string; csv: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = CardsSchema.parse(raw)
    assertReportsStaff(user)
    await assertClassAction(user, input.classId, 'student.read')
    const data = await loadReportCards(user, input)

    const header = ['Student', 'Class', 'Attendance %', 'Sessions held', 'Attended', 'Excused', 'Quiz average %', 'Quizzes', 'Points', 'Rank', 'Badges']
    const rows = data.cards.map((c) => [
      c.name,
      c.className,
      c.attendance.rate ?? '',
      c.attendance.held,
      c.attendance.attended,
      c.attendance.excused,
      c.quizAverage ?? '',
      c.quizCount,
      c.pointsTotal,
      c.rank ?? '',
      c.badges.join(' | '),
    ])
    await audit(user, 'report.export', 'class', input.classId, `Report cards CSV for ${data.cls.name}`)
    return {
      filename: reportFilename(['report-cards', data.cls.name, input.from, input.to], 'csv'),
      csv: toCsv([header, ...rows]),
    }
  })
}

const DetailSchema = z.object({
  classId: z.string().min(1),
  from: DateSchema,
  to: DateSchema,
  sessionKey: SessionSchema.nullable(),
})

/** Every attendance row in the period, one line each — too big to embed in a page. */
export async function exportAttendanceDetailCsv(
  raw: z.infer<typeof DetailSchema>,
): Promise<ActionResult<{ filename: string; csv: string; rows: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = DetailSchema.parse(raw)
    assertReportsStaff(user)
    const cls = await assertClassAction(user, input.classId, 'class.read')
    const from = parseDateOnly(input.from)
    const to = parseDateOnly(input.to)
    if (!from || !to || from > to) throw new PortalError('Pick a valid date range.')

    const records = await prisma.attendanceRecord.findMany({
      where: {
        classId: cls.id,
        date: { gte: toUTCDate(from), lte: toUTCDate(to) },
        ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
      },
      orderBy: [{ date: 'asc' }, { sessionKey: 'asc' }],
      take: 20_000,
      select: {
        date: true,
        sessionKey: true,
        status: true,
        reason: true,
        note: true,
        student: { select: { firstName: true, lastName: true } },
        markedBy: { select: { displayName: true } },
      },
    })

    const header = ['Date', 'Session', 'Student', 'Status', 'Reason', 'Note', 'Marked by']
    const rows = records.map((r) => [
      formatDateOnly(r.date),
      r.sessionKey,
      studentName(r.student),
      r.status,
      r.reason ?? '',
      r.note ?? '',
      r.markedBy?.displayName ?? '',
    ])
    await audit(user, 'report.export', 'class', cls.id, `Attendance detail CSV for ${cls.name} (${records.length} rows)`)
    return {
      filename: reportFilename(['attendance-detail', cls.name, from, to], 'csv'),
      csv: toCsv([header, ...rows]),
      rows: records.length,
    }
  })
}
