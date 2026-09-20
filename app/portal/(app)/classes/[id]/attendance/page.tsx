import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { CalendarCheck } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/portal/ui'
import { parseDateOnly, todayInNewYork, toUTCDate } from '@/lib/portal/dates'
import { AttendanceTaker } from './AttendanceTaker'

export const metadata = { title: 'Attendance' }

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { date?: string; session?: string }
}) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'attendance.write')

  const sessions = await prisma.attendanceSession.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  const date = parseDateOnly(searchParams.date) ?? todayInNewYork()
  const sessionKey = sessions.some((s) => s.key === searchParams.session) ? searchParams.session! : 'sunday'

  const [students, existing, recentDates] = await Promise.all([
    prisma.student.findMany({
      where: { classId: cls.id },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, account: { select: { photo: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { classId: cls.id, date: toUTCDate(date), sessionKey },
      select: { studentId: true, status: true, reason: true, updatedAt: true, markedBy: { select: { displayName: true } } },
    }),
    // Raw, because Prisma applies `distinct` in the query engine: the same
    // query written as findMany({ distinct: ['date'], take: 8 }) emits no LIMIT
    // and downloads every attendance row this class has ever had for the
    // session. DISTINCT + LIMIT in Postgres is served by (classId, date, sessionKey).
    prisma.$queryRaw<{ date: Date }[]>`
      SELECT DISTINCT "date" FROM "AttendanceRecord"
      WHERE "classId" = ${cls.id} AND "sessionKey" = ${sessionKey}
      ORDER BY "date" DESC
      LIMIT 8
    `,
  ])

  const lastSaved = existing.reduce<{ at: Date; by: string } | null>((acc, r) => {
    if (!acc || r.updatedAt > acc.at) return { at: r.updatedAt, by: r.markedBy?.displayName ?? 'a former servant' }
    return acc
  }, null)

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${cls.name} \u00b7 mark who is present, excused or absent`}
        icon={<CalendarCheck className="h-5 w-5" />}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      {students.length === 0 ? (
        <EmptyState title="No students in this class" />
      ) : (
        <AttendanceTaker
          classId={cls.id}
          date={date}
          sessionKey={sessionKey}
          sessions={sessions.map((s) => ({ key: s.key, label: s.label, points: s.points }))}
          students={students.map((s) => ({ id: s.id, name: studentName(s), photo: s.account.photo }))}
          existing={existing.map((e) => ({ studentId: e.studentId, status: e.status, reason: e.reason }))}
          lastSaved={lastSaved ? { at: lastSaved.at.toISOString(), by: lastSaved.by } : null}
          recentDates={recentDates.map((r) => r.date.toISOString().slice(0, 10))}
        />
      )}
    </>
  )
}
