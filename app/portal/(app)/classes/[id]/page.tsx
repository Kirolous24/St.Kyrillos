import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Users, UserCog, Star, CalendarCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { classTotals } from '@/lib/portal/data/dashboard'
import { studentName } from '@/lib/portal/data/students'
import { can } from '@/lib/portal/permissions'
import { rankStudents } from '@/lib/portal/points-math'
import { attendanceRate, heldOccasions, type AttendanceRow } from '@/lib/portal/reports'
import { PageHeader, Card, StatCard, Avatar, Badge, EmptyState, LinkButton, SectionTitle } from '@/components/portal/ui'
import { STAGE_LABEL, TITLE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { formatDateOnly, todayInNewYork, ageOn } from '@/lib/portal/dates'

export default async function ClassPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  // `class.read` is granted to a student for their own class (the feed and
  // leaderboard need it), but the staff roster below shows every classmate's
  // attendance rate, follow-up flag and import notes. Staff only.
  if (user.role === 'STUDENT') notFound()
  const cls = await requireClassAccess(user, params.id, 'class.read')
  const ctx = { classId: cls.id, classStage: cls.stage }
  const canWrite = can(user, 'attendance.write', ctx)
  const canEditStudents = can(user, 'student.write', ctx)

  const [students, servants, openCases, sundayRows] = await Promise.all([
    prisma.student.findMany({
      where: { classId: cls.id },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, dob: true, grade: true, importNotes: true, account: { select: { photo: true, loginId: true } } },
    }),
    prisma.classServant.findMany({
      where: { classId: cls.id },
      orderBy: [{ title: 'asc' }, { sortOrder: 'asc' }],
      select: { title: true, servant: { select: { id: true, account: { select: { displayName: true, photo: true, phone: true } } } } },
    }),
    prisma.followUpCase.findMany({ where: { classId: cls.id, status: 'OPEN' }, select: { studentId: true } }),
    prisma.attendanceRecord.findMany({
      where: { classId: cls.id, sessionKey: 'sunday' },
      select: { studentId: true, date: true, status: true },
    }),
  ])
  const totals = await classTotals([cls.id])
  const ranked = new Map(
    rankStudents(students.map((s) => ({ studentId: s.id, name: studentName(s), total: totals.get(s.id) ?? 0 }))).map((r) => [r.studentId, r]),
  )
  const openSet = new Set(openCases.map((c) => c.studentId))
  const today = todayInNewYork()

  // Scored the same way as the official Reports page: one verdict per (student,
  // week), every student on the roster expected at every Sunday the class held,
  // and an EXCUSED row taken out of that student's denominator. Counting rows
  // instead would score a student against only the Sundays they have a row for.
  const marks: AttendanceRow[] = sundayRows.map((r) => ({
    studentId: r.studentId,
    sessionKey: 'sunday',
    date: formatDateOnly(r.date),
    status: r.status,
  }))
  const occasions = heldOccasions(marks)
  const roster = students.map((s) => s.id)
  const perStudent = new Map(
    roster.map((id) => [id, attendanceRate(marks.filter((m) => m.studentId === id), { occasions, studentIds: [id] })]),
  )
  const classWide = attendanceRate(marks, { occasions, studentIds: roster })
  const classPresent = classWide.attended
  const classHeld = classWide.held
  const classRate = classWide.rate
  const pointsSum = students.reduce((n, s) => n + (totals.get(s.id) ?? 0), 0)
  const avgPoints = students.length ? Math.round(pointsSum / students.length) : 0

  return (
    <>
      <PageHeader
        title={cls.name}
        subtitle={`${STAGE_LABEL[cls.stage]} · ${students.length} students · ${servants.length} servants`}
        back={{ href: '/portal/classes', label: 'Classes' }}
        actions={
          canWrite ? (
            <>
              <LinkButton href={`/portal/classes/${cls.id}/attendance`}>Take attendance</LinkButton>
              <LinkButton href={`/portal/classes/${cls.id}/points`} variant="secondary">Points</LinkButton>
              {canEditStudents && <LinkButton href={`/portal/classes/${cls.id}/students/new`} variant="secondary">Add student</LinkButton>}
            </>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Students" value={students.length} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
        <StatCard label="Servants" value={servants.length} icon={<UserCog className="h-6 w-6" />} accent="#DC2626" />
        <StatCard label="Avg points" value={avgPoints} hint="per student" icon={<Star className="h-6 w-6" />} accent="#D97706" />
        <StatCard
          label="Sunday rate"
          value={classRate === null ? '—' : `${classRate}%`}
          hint={classHeld ? `${classPresent} of ${classHeld}` : 'No sessions yet'}
          tone={classRate === null ? 'default' : classRate >= 85 ? 'good' : classRate >= 60 ? 'warn' : 'bad'}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent={classRate === null ? '#7C7A7A' : classRate >= 85 ? '#16A34A' : classRate >= 60 ? '#D97706' : '#DC2626'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle hint={`${students.length} on the roster`}>Roster</SectionTitle>
          {students.length === 0 ? (
            <EmptyState
              title="No students in this class yet"
              hint="Add your first student to get started."
              action={canEditStudents ? <LinkButton href={`/portal/classes/${cls.id}/students/new`}>Add student</LinkButton> : undefined}
            />
          ) : (
            /* .students-card-grid — repeat(auto-fill,minmax(130px,1fr)), gap 12px */
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]">
              {students.map((s) => {
                const r = ranked.get(s.id)
                const pct = perStudent.get(s.id)?.rate ?? null
                const accent = accentFor(s.id)
                return (
                  <Link
                    key={s.id}
                    href={`/portal/students/${s.id}`}
                    className="rounded-[14px] border border-parch-200 bg-parch-50 px-3.5 py-[18px] text-center shadow-card transition-shadow hover:shadow-panel"
                    style={{ borderTop: `3px solid ${accent}` }}
                  >
                    <span className="mx-auto mb-2.5 block w-fit">
                      <Avatar name={studentName(s)} photo={s.account.photo} size="lg" />
                    </span>
                    <span className="block truncate text-[13px] font-bold text-parch-900">{studentName(s)}</span>
                    <span className="mb-3 block truncate text-[11px] text-parch-500">
                      {s.grade || (s.dob ? `Age ${ageOn(formatDateOnly(s.dob), today)}` : '—')}
                    </span>
                    <span className="flex flex-wrap items-center justify-center gap-1.5">
                      {pct !== null && (
                        <span
                          className="rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold"
                          style={
                            pct >= 85
                              ? { background: '#F0FDF4', color: '#166534' }
                              : pct >= 60
                                ? { background: '#FDF5E4', color: '#8B5A0F' }
                                : { background: '#FEF2F2', color: '#991B1B' }
                          }
                        >
                          {pct}%
                        </span>
                      )}
                      <span className="rounded-[20px] bg-brand-wash px-2 py-[3px] text-[10.5px] font-bold text-brand-gold-dark tabular-nums">
                        {r?.total ?? 0} pts
                      </span>
                      {openSet.has(s.id) && <Badge tone="bad">Follow-up</Badge>}
                      {s.importNotes && <Badge tone="warn">Review</Badge>}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <Card title="Servants" icon={<UserCog className="h-[15px] w-[15px]" />}>
          {servants.length === 0 ? (
            <p className="text-[12.5px] text-parch-500">No servants assigned.</p>
          ) : (
            <ul className="space-y-2.5">
              {servants.map((m) => (
                <li key={m.servant.id} className="flex items-center gap-2.5">
                  <Avatar name={m.servant.account.displayName} photo={m.servant.account.photo} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-parch-900">{m.servant.account.displayName}</p>
                    <p className="text-[11px] text-parch-500">{m.title ? TITLE_LABEL[m.title] : 'Servant'}</p>
                  </div>
                  {m.title && <Badge tone="gold">{TITLE_LABEL[m.title]}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
