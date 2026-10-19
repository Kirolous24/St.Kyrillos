import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { PortalUser } from '../permissions'
import { rostersWhere } from '../class-members'
import { addDays, churchToday, formatDateOnly, toUTCDate } from '../dates'
import { buildKidWeeklyReport, type KidReportInput, type KidWeeklyReport } from '../kid-weekly-report'
import { isReportsStaff, reportClasses } from './reports'
import { studentName } from './students'

/**
 * The children's weekly attendance report (2026-10-19, lib/portal/kid-weekly-report.ts)
 * for the classes asked for, narrowed to the ones this person may report on.
 * Staff only, like every class-wide report.
 */
export async function kidWeeklyReport(
  user: PortalUser,
  input: { classIds: readonly string[]; fromWeek: string; toWeek: string },
): Promise<KidWeeklyReport> {
  if (!isReportsStaff(user)) notFound()
  const classes = (await reportClasses(user)).filter((c) => input.classIds.includes(c.id))
  if (classes.length === 0) return buildKidWeeklyReport({ classes: [], roster: [], sessions: [], records: [] })
  const ids = classes.map((c) => c.id)

  const [students, sessions, records, firsts] = await Promise.all([
    prisma.student.findMany({
      where: rostersWhere(ids),
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true, firstName: true, lastName: true, classId: true, createdAt: true,
        memberships: { where: { classId: { in: ids } }, select: { classId: true, addedAt: true } },
      },
    }),
    prisma.attendanceSession.findMany({
      where: { isActive: true, OR: [{ classId: null }, { classId: { in: ids } }] },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: { key: true, label: true, classId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { classId: { in: ids }, date: { gte: toUTCDate(input.fromWeek), lte: toUTCDate(addDays(input.toWeek, 6)) } },
      select: { studentId: true, classId: true, date: true, sessionKey: true, status: true },
    }),
    // When each child was first marked in each class, ever: a child the old
    // app had marked before they were added here joined then.
    prisma.attendanceRecord.groupBy({
      by: ['studentId', 'classId'],
      where: { classId: { in: ids } },
      _min: { date: true },
    }),
  ])

  const firstOf = new Map(firsts.map((f) => [`${f.classId}|${f.studentId}`, f._min.date ? formatDateOnly(f._min.date) : null]))
  const roster: Array<KidReportInput['roster'][number]> = []
  for (const s of students) {
    const name = studentName(s)
    if (s.classId && ids.includes(s.classId)) {
      roster.push({
        studentId: s.id, name, classId: s.classId, member: false,
        joinedOn: churchToday(s.createdAt), firstMarkedOn: firstOf.get(`${s.classId}|${s.id}`) ?? null,
      })
    }
    for (const m of s.memberships) {
      if (m.classId === s.classId) continue
      roster.push({
        studentId: s.id, name, classId: m.classId, member: true,
        joinedOn: churchToday(m.addedAt), firstMarkedOn: firstOf.get(`${m.classId}|${s.id}`) ?? null,
      })
    }
  }

  return buildKidWeeklyReport({
    classes: classes.map((c) => ({ id: c.id, name: c.name })),
    roster,
    sessions,
    records: records.map((r) => ({ ...r, date: formatDateOnly(r.date) })),
  })
}
