import Link from 'next/link'
import {
  GraduationCap, Users, UserCog, HeartHandshake, Cake, Trophy, Sparkles,
  CalendarCheck, UserPlus, ClipboardList, BookOpen,
} from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { staffOverview, studentOverview } from '@/lib/portal/data/dashboard'
import {
  HeroBanner, Card, StatCard, ClassCard, ActionCard, Badge, EmptyState, LinkButton, SectionTitle,
} from '@/components/portal/ui'
import { formatShortDate, formatMonthDay, STAGE_LABEL } from '@/lib/portal/format'
import { accentByOrder } from '@/lib/portal/accents'
import { NotificationsWidget } from '@/components/portal/widgets/NotificationsWidget'
import { CheckInWidget } from '@/components/portal/widgets/CheckInWidget'
import { ExamsWidget } from '@/components/portal/widgets/ExamsWidget'
import { LessonsWidget } from '@/components/portal/widgets/LessonsWidget'
import { FeedWidget } from '@/components/portal/widgets/FeedWidget'

export default async function PortalHome() {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') return <StudentHome />
  return <StaffHome />
}

async function StaffHome() {
  const user = await requirePortalUser()
  const data = await staffOverview(user)
  const isSunday = new Date(`${data.today}T12:00:00Z`).getUTCDay() === 0
  const roleTag = user.role === 'ADMIN' ? 'Administrator' : user.role === 'PASTOR' ? 'Pastor' : 'Servant'

  return (
    <>
      <HeroBanner
        tag={`Sunday School · ${roleTag}`}
        title={`Welcome back, ${user.displayName.split(' ')[0]}!`}
        verse="&ldquo;Let the little children come to me&hellip;&rdquo;"
        reference="Mark 10:14"
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes" value={data.classes.length} icon={<GraduationCap className="h-6 w-6" />} accent="#4F46E5" />
        <StatCard label="Servants" value={data.totals.servants} icon={<UserCog className="h-6 w-6" />} accent="#DC2626" />
        <StatCard label="Students" value={data.totals.students} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
        <StatCard
          label="Open follow-ups"
          value={data.totals.openCases}
          tone={data.totals.openCases > 0 ? 'warn' : 'good'}
          icon={<HeartHandshake className="h-6 w-6" />}
          accent={data.totals.openCases > 0 ? '#D97706' : '#16A34A'}
          hint={data.totals.openCases > 0 ? 'Students who need a check-in' : 'Everyone is accounted for'}
        />
      </div>

      {user.role === 'ADMIN' && (
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <ActionCard
            href="/portal/admin/classes"
            title="Manage classes"
            description="Add or remove classes"
            icon={<GraduationCap className="h-6 w-6" />}
            accent="#4F46E5"
          />
          <ActionCard
            href="/portal/admin/servants/new"
            title="Add a servant"
            description="Register a new servant account"
            icon={<UserPlus className="h-6 w-6" />}
            accent="#16A34A"
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <SectionTitle hint={isSunday ? 'It is Sunday — remember to take attendance.' : formatShortDate(data.today)}>
              {user.role === 'SERVANT' ? 'My classes' : 'All classes'}
            </SectionTitle>
            {data.classes.length === 0 ? (
              <EmptyState
                title="No classes assigned yet"
                hint="Ask the Sunday School admin to add you to a class."
              />
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {data.classes.map((c) => (
                  <ClassCard
                    key={c.id}
                    href={`/portal/classes/${c.id}`}
                    name={c.name}
                    accent={accentByOrder(c.sortOrder)}
                    icon={<GraduationCap className="h-5 w-5" />}
                    rows={[
                      { key: 'Stage', value: STAGE_LABEL[c.stage] },
                      { key: 'Students', value: c.studentCount },
                      { key: 'Servants', value: c.servantCount },
                      ...(c.sundayRate4w !== null
                        ? [{ key: 'Sundays (4 wks)', value: `${c.sundayRate4w}%` }]
                        : []),
                    ]}
                    actions={
                      user.role === 'PASTOR' ? undefined : (
                        <>
                          <LinkButton href={`/portal/classes/${c.id}/attendance`} size="sm">
                            Attendance
                          </LinkButton>
                          <LinkButton href={`/portal/classes/${c.id}/points`} variant="secondary" size="sm">
                            Points
                          </LinkButton>
                        </>
                      )
                    }
                  />
                ))}
              </div>
            )}
            {data.classes.some((c) => c.openCases > 0 || (isSunday && c.sessionsToday.length === 0)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.classes.map((c) =>
                  c.openCases > 0 ? (
                    <Link key={`case-${c.id}`} href="/portal/follow-ups">
                      <Badge tone="bad">
                        {c.name}: {c.openCases} open follow-up{c.openCases > 1 ? 's' : ''}
                      </Badge>
                    </Link>
                  ) : isSunday && c.sessionsToday.length === 0 ? (
                    <Link key={`att-${c.id}`} href={`/portal/classes/${c.id}/attendance`}>
                      <Badge tone="warn">{c.name}: no attendance yet today</Badge>
                    </Link>
                  ) : null,
                )}
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <LessonsWidget user={user} />
            <ExamsWidget user={user} />
          </div>
        </div>

        <div className="space-y-5">
          <NotificationsWidget user={user} />
          <CheckInWidget user={user} />
          <Card title="Upcoming birthdays" icon={<Cake className="h-4 w-4" />}>
            {data.birthdays.length === 0 ? (
              <p className="text-[12.5px] text-parch-500">None in the next two weeks.</p>
            ) : (
              <ul className="space-y-2">
                {data.birthdays.slice(0, 8).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <Link href={`/portal/students/${b.id}`} className="truncate font-semibold text-parch-800 hover:text-brand-800">
                      {b.name}
                    </Link>
                    <span className="shrink-0 tabular-nums text-parch-500">
                      {b.daysUntil === 0 ? 'Today' : b.daysUntil === 1 ? 'Tomorrow' : formatMonthDay(b.on)} · {b.turning}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <FeedWidget user={user} />
        </div>
      </div>
    </>
  )
}

async function StudentHome() {
  const user = await requirePortalUser()
  const data = await studentOverview(user)
  if (!data) return <EmptyState title="Your student record is missing" hint="Please tell your servant." />

  return (
    <>
      <HeroBanner
        tag={`Sunday School · ${data.className}`}
        title={`Hi, ${data.me.firstName}!`}
        verse="&ldquo;Let the little children come to me&hellip;&rdquo;"
        reference="Mark 10:14"
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My points" value={data.total} icon={<Sparkles className="h-6 w-6" />} accent="#CA8A04" />
        <StatCard
          label="My rank"
          value={data.rank ? `#${data.rank}` : '—'}
          hint={`of ${data.classSize} in class`}
          icon={<Trophy className="h-6 w-6" />}
          accent="#7C3AED"
        />
        <StatCard
          label="Sunday attendance"
          value={data.rate.rate === null ? '—' : `${data.rate.rate}%`}
          hint={`${data.rate.attended} of ${data.rate.held} Sundays`}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent="#16A34A"
        />
        <StatCard label="Birthdays soon" value={data.birthdays.length} icon={<Cake className="h-6 w-6" />} accent="#DB2777" />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <NotificationsWidget user={user} />
        <ExamsWidget user={user} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Recent points" icon={<Sparkles className="h-4 w-4" />}>
          {data.entries.length === 0 ? (
            <p className="text-[12.5px] text-parch-500">No points yet. Come to Sunday School to start earning!</p>
          ) : (
            <ul className="divide-y divide-[#F5F2ED]">
              {data.entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                  <div className="min-w-0">
                    <p className={e.undone ? 'text-parch-400 line-through' : 'text-parch-800'}>{e.activityLabel}</p>
                    {e.reason && <p className="text-[11px] text-parch-500">{e.reason}</p>}
                  </div>
                  <span className={`shrink-0 font-bold tabular-nums ${e.points >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    {e.points >= 0 ? '+' : ''}
                    {e.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Top of the class" icon={<Trophy className="h-4 w-4" />}>
            <ol className="space-y-1.5 text-[12.5px]">
              {data.top3.map((r) => (
                <li
                  key={r.studentId}
                  className={`flex justify-between gap-2 rounded-lg px-2 py-1.5 ${r.studentId === data.me.id ? 'bg-brand-wash font-semibold' : ''}`}
                >
                  <span className="truncate">
                    #{r.rank} {r.name}
                    {r.studentId === data.me.id ? ' (you)' : ''}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{r.total}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="My Sundays" icon={<CalendarCheck className="h-4 w-4" />}>
            {data.sunday.length === 0 ? (
              <p className="text-[12.5px] text-parch-500">No attendance recorded yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {data.sunday.map((s) => (
                  <li key={s.date}>
                    <Badge tone={s.status === 'PRESENT' ? 'good' : s.status === 'EXCUSED' ? 'warn' : 'bad'}>
                      {formatMonthDay(s.date)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <FeedWidget user={user} />
          <CheckInWidget user={user} />
        </div>
      </div>
    </>
  )
}
