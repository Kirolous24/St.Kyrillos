import Link from 'next/link'
import { QrCode, ScanLine, CalendarCheck, UserX } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { can, type PortalUser } from '@/lib/portal/permissions'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { listServantActivities } from '@/lib/portal/data/servant-attendance'
import { accentFor } from '@/lib/portal/accents'
import { dayOfWeek, mondayOf, todayInNewYork, toUTCDate } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { buildStudentPayload, type CheckInStatus } from '@/lib/portal/qr'
import { Card, Callout, Badge, LinkButton, IconTile } from '@/components/portal/ui'
import { QrImage } from '@/components/portal/QrImage'

/**
 * Dashboard widget for check-in: the Sunday "take attendance" nag and this
 * week's own servant check-ins for a servant, the personal QR card shortcut
 * for a student. Returns null when there is nothing worth a dashboard slot.
 */
export async function CheckInWidget({ user }: { user: PortalUser }): Promise<JSX.Element | null> {
  if (user.studentId) return <StudentCard studentId={user.studentId} />
  if (user.servantId) return <ServantCards user={user} servantId={user.servantId} />
  return null
}

async function StudentCard({ studentId }: { studentId: string }) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { account: { select: { loginId: true } } },
  })
  if (!student) return null

  return (
    <Card
      title="My QR code"
      icon={<QrCode className="h-4 w-4" aria-hidden />}
      action={
        <Link href="/portal/my-qr" className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800 hover:underline">
          Open
        </Link>
      }
    >
      <div className="flex items-center gap-4">
        <QrImage value={buildStudentPayload(student.account.loginId)} size={92} alt="" />
        <div className="min-w-0">
          <p className="text-[12px] leading-relaxed text-parch-500">Show this to a servant to be checked in.</p>
          <p className="mt-1.5 text-[22px] font-bold leading-none tracking-[0.24em] text-brand-800 tabular-nums">
            {student.account.loginId}
          </p>
        </div>
      </div>
    </Card>
  )
}

const STATUS_TONE: Record<CheckInStatus, 'good' | 'warn' | 'bad'> = {
  PRESENT: 'good',
  EXCUSED: 'warn',
  ABSENT: 'bad',
}

async function ServantCards({ user, servantId }: { user: PortalUser; servantId: string }) {
  const today = todayInNewYork()
  const weekStart = mondayOf(today)
  const isSunday = dayOfWeek(today) === 0

  const all = await listVisibleClasses(user)
  const writable = all.filter((c) => can(user, 'attendance.write', { classId: c.id, classStage: c.stage }))
  const classIds = writable.map((c) => c.id)

  const [takenToday, activities, mine, roster, presentToday] = await Promise.all([
    isSunday && classIds.length > 0
      ? prisma.attendanceRecord.groupBy({
          by: ['classId'],
          where: { classId: { in: classIds }, sessionKey: 'sunday', date: toUTCDate(today) },
        })
      : Promise.resolve([] as Array<{ classId: string }>),
    listServantActivities(),
    prisma.servantAttendance.findMany({
      where: { servantId, weekStart: toUTCDate(weekStart) },
      select: { activityKey: true, status: true },
    }),
    // Who is on the roster, and who has a mark today — the prototype's
    // per-student "Not Checked In Today" list. The port tracked only whole
    // classes with no register taken, so a class half-marked showed nothing.
    classIds.length > 0
      ? prisma.student.findMany({
          where: { classId: { in: classIds } },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          select: { id: true, firstName: true, lastName: true, classId: true },
        })
      : Promise.resolve([] as Array<{ id: string; firstName: string; lastName: string; classId: string | null }>),
    classIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: { classId: { in: classIds }, date: toUTCDate(today) },
          select: { studentId: true },
        })
      : Promise.resolve([] as Array<{ studentId: string }>),
  ])

  const done = new Set(takenToday.map((t) => t.classId))
  const missing = isSunday ? writable.filter((c) => !done.has(c.id)) : []
  const byKey = new Map(mine.map((m) => [m.activityKey, m.status as CheckInStatus]))
  const marked = mine.length

  // Any session counts as "checked in" for the day: a child marked for Liturgy
  // is plainly here, so nagging about them would be noise.
  const seen = new Set(presentToday.map((r) => r.studentId))
  const classNameOf = new Map(writable.map((c) => [c.id, c.name]))
  const notIn = roster.filter((s) => !seen.has(s.id))

  if (missing.length === 0 && activities.length === 0 && notIn.length === 0) return null

  return (
    <>
      {/* Per-student, not per-class: this is the list a servant works down on a
          Sunday morning. Capped, because a class nobody has marked yet would
          otherwise render the whole roster. */}
      {notIn.length > 0 && (
        <Card
          title="Not checked in today"
          icon={<UserX className="h-4 w-4" aria-hidden />}
          action={<Badge tone={notIn.length > 0 ? 'warn' : 'good'}>{notIn.length}</Badge>}
        >
          <ul className="space-y-1.5">
            {notIn.slice(0, 12).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/portal/students/${s.id}`}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-[#EFE9DC] bg-parch-100 px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-brand-gold"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-parch-800">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="shrink-0 text-[11px] text-parch-500">{classNameOf.get(s.classId ?? '') ?? ''}</span>
                </Link>
              </li>
            ))}
          </ul>
          {notIn.length > 12 && (
            <p className="mt-2 text-[11px] text-parch-500">and {notIn.length - 12} more</p>
          )}
        </Card>
      )}

      {missing.length > 0 && (
        <Card tone="brand" title="Sunday attendance" icon={<CalendarCheck className="h-4 w-4" aria-hidden />}>
          <Callout tone="warn" title={`${missing.length} class${missing.length === 1 ? '' : 'es'} still to record`}>
            It is Sunday, {formatLongDate(today)}, and Sunday School attendance has not been taken yet.
          </Callout>
          <ul className="mt-3 space-y-2">
            {missing.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] border-[#EFE9DC] bg-parch-50 px-3 py-2.5"
              >
                <IconTile accent={accentFor(c.id)} size="sm" solid>
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                </IconTile>
                <span className="min-w-0 flex-1 truncate font-serif text-[13.5px] font-bold text-parch-900">{c.name}</span>
                <span className="flex shrink-0 gap-1.5">
                  <LinkButton href={`/portal/classes/${c.id}/attendance`} size="sm" variant="secondary">
                    <CalendarCheck className="h-4 w-4" aria-hidden /> Take
                  </LinkButton>
                  <LinkButton href="/portal/qr" size="sm" variant="gold">
                    <QrCode className="h-4 w-4" aria-hidden /> Code
                  </LinkButton>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {activities.length > 0 && (
        <Card
          title="My week"
          icon={<ScanLine className="h-4 w-4" aria-hidden />}
          action={
            <Link
              href="/portal/servant-attendance"
              className="text-[11px] font-bold uppercase tracking-[0.8px] text-brand-800 hover:underline"
            >
              Open grid
            </Link>
          }
        >
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
            Week of {formatLongDate(weekStart)} · {marked} of {activities.length} recorded
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {activities.map((a) => {
              const status = byKey.get(a.key)
              return (
                <li key={a.key}>
                  {status ? (
                    <Badge tone={STATUS_TONE[status]}>{a.label}</Badge>
                  ) : (
                    <Badge tone="neutral">{a.label}</Badge>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <LinkButton href="/portal/qr?tab=scan" size="sm" variant="secondary">
              <ScanLine className="h-4 w-4" aria-hidden /> Scan students
            </LinkButton>
            <LinkButton href="/portal/my-attendance" size="sm" variant="secondary">
              My attendance
            </LinkButton>
          </div>
        </Card>
      )}
    </>
  )
}
