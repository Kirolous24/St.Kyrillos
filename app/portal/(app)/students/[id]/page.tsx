import Link from 'next/link'
import { Star, CalendarCheck, Trophy, AlertTriangle, History, User, HeartHandshake } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireStudentRead, studentName } from '@/lib/portal/data/students'
import { classTotals } from '@/lib/portal/data/dashboard'
import { can } from '@/lib/portal/permissions'
import { rankStudents } from '@/lib/portal/points-math'
import { absenceStreakAgainst } from '@/lib/portal/attendance-rules'
import { attendanceRate, heldOccasions } from '@/lib/portal/reports'
import { formatDateOnly, todayInNewYork, ageOn } from '@/lib/portal/dates'
import { formatPhone } from '@/lib/portal/phones'
import { formatLongDate, formatMonthDay, formatDateTime } from '@/lib/portal/format'
import { PageHeader, Card, StatCard, Avatar, Badge, Callout, LinkButton } from '@/components/portal/ui'
import { accentFor } from '@/lib/portal/accents'
import { StudentProfileActions } from './StudentProfileActions'

export default async function StudentPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const s = await requireStudentRead(user, params.id)
  const ctx = { classId: s.classId ?? undefined, classStage: s.class?.stage, studentId: s.id }
  const canWrite = can(user, 'student.write', ctx)
  const isSelf = user.studentId === s.id
  const today = todayInNewYork()

  const [entries, attendance, sundayRows, cases, classmates, heldSundays] = await Promise.all([
    prisma.pointEntry.findMany({
      where: { studentId: s.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, points: true, activityLabel: true, reason: true, undone: true, createdAt: true, createdBy: { select: { displayName: true } } },
    }),
    // Display only: the most recent marks across every session, for the card.
    prisma.attendanceRecord.findMany({
      where: { studentId: s.id },
      orderBy: { date: 'desc' },
      take: 60,
      select: { id: true, date: true, sessionKey: true, status: true, reason: true },
    }),
    // The Sunday rate is scored over the whole record, not a slice of it: a
    // window of 60 rows across every session would leave a class that records
    // six sessions a week with ten Sundays and a Sunday-only class with sixty.
    prisma.attendanceRecord.findMany({
      where: { studentId: s.id, sessionKey: 'sunday' },
      orderBy: { date: 'desc' },
      select: { date: true, status: true },
    }),
    prisma.followUpCase.findMany({ where: { studentId: s.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, status: true, createdAt: true } }),
    s.classId ? prisma.student.findMany({ where: { classId: s.classId }, select: { id: true, firstName: true, lastName: true } }) : Promise.resolve([]),
    // Class-wide, not student-scoped: a Sunday the class held but this
    // student has no row for (e.g. everyone else checked in by group QR)
    // still has to count against them.
    s.classId
      ? prisma.attendanceRecord.findMany({ where: { classId: s.classId, sessionKey: 'sunday' }, distinct: ['date'], select: { date: true } })
      : Promise.resolve([]),
  ])
  const totals = await classTotals(s.classId ? [s.classId] : [])
  const total = entries.length ? (await prisma.pointEntry.aggregate({ where: { studentId: s.id }, _sum: { points: true } }))._sum.points ?? 0 : 0
  const rank = rankStudents(classmates.map((c) => ({ studentId: c.id, name: studentName(c), total: totals.get(c.id) ?? 0 }))).find((r) => r.studentId === s.id)?.rank
  const sunday = sundayRows.map((a) => ({ date: formatDateOnly(a.date), status: a.status }))
  const heldDates = heldSundays.map((r) => formatDateOnly(r.date))
  const rate = attendanceRate(
    sunday.map((r) => ({ studentId: s.id, sessionKey: 'sunday', ...r })),
    { occasions: heldOccasions(heldDates.map((date) => ({ sessionKey: 'sunday', date }))), studentIds: [s.id] },
  )
  const streak = absenceStreakAgainst(heldDates, sunday)
  const sessionLabels = new Map((await prisma.attendanceSession.findMany({ select: { key: true, label: true } })).map((x) => [x.key, x.label]))
  const accent = accentFor(s.id)

  return (
    <>
      <PageHeader
        title={studentName(s)}
        subtitle={
          <>
            {!s.class ? 'No class' : isSelf ? (
              s.class.name
            ) : (
              <Link href={`/portal/classes/${s.class.id}`} className="underline-offset-2 hover:underline">{s.class.name}</Link>
            )}
            {s.dob && ` · ${ageOn(formatDateOnly(s.dob), today)} years old · born ${formatLongDate(formatDateOnly(s.dob))}`}
            {!isSelf && ` · ID ${s.account.loginId}`}
          </>
        }
        back={s.class && !isSelf ? { href: `/portal/classes/${s.class.id}`, label: s.class.name } : undefined}
        actions={canWrite ? <LinkButton href={`/portal/students/${s.id}/edit`} variant="secondary">Edit</LinkButton> : undefined}
      />

      {s.importNotes && canWrite && (
        <div className="mb-3.5">
          <Callout tone="warn" title="Needs review">{s.importNotes}</Callout>
        </div>
      )}

      {/* Profile header: large avatar on a cream card with a gold left edge */}
      <div className="mb-3.5 flex flex-wrap items-center gap-4 rounded-[16px] border border-parch-200 border-l-4 border-l-brand-gold bg-parch-50 p-5 shadow-panel">
        <span className="shrink-0" style={{ borderRadius: '9999px', boxShadow: `0 0 0 3px ${accent}33` }}>
          <Avatar name={studentName(s)} photo={s.account.photo} size="xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[21px] font-bold leading-tight text-parch-900">{studentName(s)}</p>
          <p className="mt-0.5 text-[12.5px] text-parch-500">
            {[s.grade ? `Grade ${s.grade}` : null, s.gender ? (s.gender === 'male' ? 'Boy' : 'Girl') : null, s.class?.name ?? 'No class']
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rank && <Badge tone="gold">Rank #{rank}{classmates.length ? ` of ${classmates.length}` : ''}</Badge>}
            {streak >= (s.class?.visitationThreshold ?? 2) && <Badge tone="bad">{streak} missed in a row</Badge>}
            {!isSelf && <Badge tone="neutral">ID {s.account.loginId}</Badge>}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Points" value={total} icon={<Star className="h-6 w-6" />} accent="#D97706" />
        <StatCard
          label="Sunday attendance"
          value={rate.rate === null ? '—' : `${rate.rate}%`}
          hint={`${rate.attended} of ${rate.held}`}
          tone={rate.rate === null ? 'default' : rate.rate >= 80 ? 'good' : rate.rate >= 50 ? 'warn' : 'bad'}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent={rate.rate === null ? '#7C7A7A' : rate.rate >= 80 ? '#16A34A' : rate.rate >= 50 ? '#D97706' : '#DC2626'}
        />
        <StatCard
          label="Class rank"
          value={rank ? `#${rank}` : '—'}
          hint={classmates.length ? `of ${classmates.length}` : undefined}
          icon={<Trophy className="h-6 w-6" />}
          accent="#4F46E5"
        />
        <StatCard
          label="Missed in a row"
          value={streak}
          tone={streak >= (s.class?.visitationThreshold ?? 2) ? 'bad' : streak > 0 ? 'warn' : 'good'}
          icon={<AlertTriangle className="h-6 w-6" />}
          accent={streak >= (s.class?.visitationThreshold ?? 2) ? '#DC2626' : streak > 0 ? '#D97706' : '#16A34A'}
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <div className="space-y-3.5 lg:col-span-2">
          <Card title="Points ledger" icon={<History className="h-[15px] w-[15px]" />}>
            {entries.length === 0 ? <p className="text-[12.5px] text-parch-500">No points yet.</p> : (
              <ul className="divide-y divide-[#F5F2ED]">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                    <span
                      className="w-12 shrink-0 text-right text-[13px] font-extrabold tabular-nums"
                      style={{ color: e.undone ? '#A9A49B' : e.points >= 0 ? '#16A34A' : '#DC2626', textDecoration: e.undone ? 'line-through' : undefined }}
                    >
                      {e.points >= 0 ? '+' : ''}{e.points}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={e.undone ? 'text-parch-400 line-through' : 'text-parch-800'}>{e.activityLabel}{e.reason ? ` — ${e.reason}` : ''}</p>
                      <p className="text-[11px] text-parch-500">{formatDateTime(e.createdAt)}{!isSelf && e.createdBy ? ` · ${e.createdBy.displayName}` : ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Attendance" icon={<CalendarCheck className="h-[15px] w-[15px]" />}>
            {attendance.length === 0 ? <p className="text-[12.5px] text-parch-500">No attendance recorded yet.</p> : (
              <ul className="divide-y divide-[#F5F2ED] text-[12.5px]">
                {attendance.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-parch-800">{formatMonthDay(formatDateOnly(a.date))} · {sessionLabels.get(a.sessionKey) ?? a.sessionKey}</span>
                    <Badge tone={a.status === 'PRESENT' ? 'good' : a.status === 'EXCUSED' ? 'warn' : 'bad'}>
                      {a.status === 'PRESENT' ? 'Present' : a.status === 'EXCUSED' ? `Excused${a.reason ? ` (${a.reason})` : ''}` : 'Absent'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-3.5">
          {!isSelf && (
            <Card title="Family & contact" icon={<User className="h-[15px] w-[15px]" />}>
              <dl className="space-y-2.5 text-[12.5px]">
                {s.fatherName || s.fatherPhone ? (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Father</dt>
                    <dd className="text-parch-800">{s.fatherName}{s.fatherPhone && <> · <a className="font-semibold text-brand-800" href={`tel:${s.fatherPhone}`}>{formatPhone(s.fatherPhone)}</a></>}</dd>
                  </div>
                ) : null}
                {s.motherName || s.motherPhone ? (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Mother</dt>
                    <dd className="text-parch-800">{s.motherName}{s.motherPhone && <> · <a className="font-semibold text-brand-800" href={`tel:${s.motherPhone}`}>{formatPhone(s.motherPhone)}</a></>}</dd>
                  </div>
                ) : null}
                {s.parentEmails.length > 0 && (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Email</dt>
                    <dd className="break-all">{s.parentEmails.map((e) => <a key={e} href={`mailto:${e}`} className="block font-semibold text-brand-800">{e}</a>)}</dd>
                  </div>
                )}
                {s.address && <div><dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Address</dt><dd className="text-parch-800">{s.address}</dd></div>}
                {s.notes && <div><dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Notes</dt><dd className="whitespace-pre-wrap text-parch-800">{s.notes}</dd></div>}
                <div><dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Last sign-in</dt><dd className="text-parch-800">{s.account.lastLoginAt ? formatDateTime(s.account.lastLoginAt) : 'Never'}</dd></div>
              </dl>
            </Card>
          )}

          {!isSelf && cases.length > 0 && (
            <Card title="Follow-up cases" icon={<HeartHandshake className="h-[15px] w-[15px]" />}>
              <ul className="space-y-2 text-[12.5px]">
                {cases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/portal/follow-ups/${c.id}`} className="truncate text-parch-800 underline-offset-2 hover:text-brand-800 hover:underline">{c.title}</Link>
                    <Badge tone={c.status === 'OPEN' ? 'bad' : 'neutral'}>{c.status === 'OPEN' ? 'Open' : 'Done'}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {canWrite && (
            <StudentProfileActions studentId={s.id} hasImportNotes={!!s.importNotes} isAdmin={user.role === 'ADMIN'} />
          )}
        </div>
      </div>
    </>
  )
}
