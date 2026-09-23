import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { CalendarCheck } from 'lucide-react'
import { PageHeader, EmptyState, Card } from '@/components/portal/ui'
import { parseDateOnly, todayInNewYork, toUTCDate, formatDateOnly } from '@/lib/portal/dates'
import { formatShortDate } from '@/lib/portal/format'
import { sessionTrend } from '@/lib/portal/reports'
import { PortalChart } from '@/components/portal/PortalChart'
import { AttendanceTaker } from './AttendanceTaker'
import { RemoveRegister } from './RemoveRegister'

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

  // F0209 — 'sunday' was the unconditional fallback, so once an admin switched
  // that session off the register opened pointed at a key the save path no
  // longer accepts: a servant could mark a full class and lose every mark at
  // save. Prefer 'sunday' while it is live, otherwise the first session that is.
  const active =
    sessions.find((s) => s.key === searchParams.session) ??
    sessions.find((s) => s.key === 'sunday') ??
    sessions[0]

  // With no active session there is nothing to mark against at all. The page
  // used to render the whole roster and a Save button that could never succeed.
  if (!active) {
    return (
      <>
        <PageHeader
          title="Attendance"
          subtitle={`${cls.name} · mark who is present, excused or absent`}
          icon={<CalendarCheck className="h-5 w-5" />}
          back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
        />
        <EmptyState
          title="No attendance sessions are set up"
          hint="An admin turns sessions on under Sessions & Points before a register can be taken."
        />
      </>
    )
  }
  const sessionKey = active.key

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
      LIMIT 26
    `,
  ])

  // The weeks around this one, and who was not in the room on each — the
  // prototype's ring strip with its "who was missing" tap-through.
  const trendDates = recentDates.slice(0, 6).map((r) => r.date.toISOString().slice(0, 10))
  const trendRows = trendDates.length
    ? await prisma.attendanceRecord.findMany({
        where: { classId: cls.id, sessionKey, date: { in: trendDates.map((d) => toUTCDate(d)) } },
        select: { studentId: true, date: true, status: true },
      })
    : []
  const trend = sessionTrend(
    trendDates,
    trendRows.map((r) => ({ studentId: r.studentId, date: formatDateOnly(r.date), status: r.status })),
    students.map((st) => ({ id: st.id, name: studentName(st) })),
  )

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
      {trend.length > 0 && students.length > 0 && (
        <Card className="mb-4 print:hidden" title={`${sessions.find((x) => x.key === sessionKey)?.label ?? 'Session'} — recent weeks`} icon={<CalendarCheck className="h-4 w-4" aria-hidden />}>
          <ul className="flex flex-wrap gap-2.5">
            {trend.map((d) => {
              const tone = d.rate === null ? '#7C7A7A' : d.rate >= 80 ? '#16A34A' : d.rate >= 50 ? '#D97706' : '#DC2626'
              return (
                <li key={d.date} className="min-w-[8.5rem] flex-1">
                  <details className="rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2">
                    <summary className="cursor-pointer list-none">
                      <span className="block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">
                        {formatShortDate(d.date)}
                      </span>
                      <span className="mt-0.5 block text-[19px] font-bold leading-none tabular-nums" style={{ color: tone }}>
                        {d.rate === null ? '—' : `${d.rate}%`}
                      </span>
                      <span className="mt-1 block text-[11px] text-parch-500">
                        {d.present} of {students.length} here
                        {d.missing.length > 0 ? ` · ${d.missing.length} not` : ''}
                      </span>
                    </summary>
                    {d.missing.length > 0 && (
                      <p className="mt-1.5 border-t border-[#EFE9DC] pt-1.5 text-[11px] leading-relaxed text-parch-600">
                        {d.missing.join(', ')}
                      </p>
                    )}
                  </details>
                </li>
              )
            })}
          </ul>
          {/* The same numbers as a line. Reuses sessionTrend rather than a
              second rule, so the chart and the tiles above it cannot disagree —
              and it is reversed, because sessionTrend returns newest first
              while a trend line reads left to right. */}
          {trend.length >= 2 && (
            <div className="mt-4 border-t border-[#F0EBE3] pt-3.5">
              <PortalChart
                kind="line"
                points={trend
                  .slice()
                  .reverse()
                  .map((d) => ({ label: formatShortDate(d.date), value: d.rate }))}
                label="In the room"
                caption="Share of the class present, counting an excused absence as away — the same question as the cards above."
                suffix="%"
                maxY={100}
              />
            </div>
          )}

          <p className="mt-2.5 text-[11px] text-parch-500">
            &ldquo;Not here&rdquo; counts excused absences too — this answers who was not in the room, which is a
            different question from the scored attendance rate.
          </p>
        </Card>
      )}

      {students.length === 0 ? (
        <EmptyState title="No students in this class" />
      ) : (
        <AttendanceTaker
          // Remount when the sheet changes. `marks` is seeded from props via
          // useState, which ignores later prop changes — without this key the
          // previous date/session's marks stay loaded and a save can write one
          // day's register onto another. The prototype re-ran attInitCardStates()
          // on every change for the same reason.
          key={`${date}:${sessionKey}`}
          classId={cls.id}
          date={date}
          today={todayInNewYork()}
          sessionKey={sessionKey}
          sessions={sessions.map((s) => ({ key: s.key, label: s.label, points: s.points }))}
          students={students.map((s) => ({ id: s.id, name: studentName(s), photo: s.account.photo }))}
          existing={existing.map((e) => ({ studentId: e.studentId, status: e.status, reason: e.reason }))}
          lastSaved={lastSaved ? { at: lastSaved.at.toISOString(), by: lastSaved.by } : null}
          recentDates={recentDates.map((r) => r.date.toISOString().slice(0, 10))}
        />
      )}
      {students.length > 0 && (
        <RemoveRegister
          classId={cls.id}
          date={date}
          sessionKey={sessionKey}
          sessionLabel={sessions.find((s) => s.key === sessionKey)?.label ?? sessionKey}
          marks={existing.length}
        />
      )}
    </>
  )
}
