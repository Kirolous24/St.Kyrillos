import Link from 'next/link'
import {
  GraduationCap, Users, UserCog, HeartHandshake, Cake, Trophy, Sparkles,
  CalendarCheck, UserPlus, ClipboardList, BookOpen, Printer, QrCode, BarChart3, TrendingDown, TrendingUp,
  Clock, Flame, BarChart2,
} from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { staffOverview, studentOverview } from '@/lib/portal/data/dashboard'
import { can } from '@/lib/portal/permissions'
import {
  HeroBanner, Card, StatCard, ClassCard, ActionCard, Badge, EmptyState, LinkButton, SectionTitle, ProgressBar, IconTile, Avatar,
} from '@/components/portal/ui'
import { formatShortDate, formatMonthDay, STAGE_LABEL } from '@/lib/portal/format'
import { accentByOrder } from '@/lib/portal/accents'
import { PortalChart } from '@/components/portal/PortalChart'
import { NotificationsWidget } from '@/components/portal/widgets/NotificationsWidget'
import { CheckInWidget } from '@/components/portal/widgets/CheckInWidget'
import { ExamsWidget } from '@/components/portal/widgets/ExamsWidget'
import { LessonsWidget } from '@/components/portal/widgets/LessonsWidget'
import { FeedWidget } from '@/components/portal/widgets/FeedWidget'
import { NotCheckedInWidget, TopPerformersWidget, RecentActivityWidget } from '@/components/portal/widgets/ActivityWidgets'
import { scoreBand, SCORE_BAND_TONE } from '@/lib/portal/exams'
import { hourInNewYork } from '@/lib/portal/dates'

export default async function PortalHome() {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') return <StudentHome />
  return <StaffHome />
}

async function StaffHome() {
  const user = await requirePortalUser()
  const data = await staffOverview(user)
  const isSunday = new Date(`${data.today}T12:00:00Z`).getUTCDay() === 0
  /**
   * F0354 — when the reminder stops being a note and becomes a banner.
   *
   * A badge in the corner of a long page is not read on a phone, and by Sunday
   * evening an unmarked register is the most important thing the portal has to
   * say. A full banner all morning would be nagging servants before their class
   * has even met, so it waits until early afternoon, once classes have finished.
   * Church time, not the server's.
   */
  const afterClasses = isSunday && hourInNewYork() >= 13
  const unmarkedToday = data.classes.filter((c) => c.sessionsToday.length === 0)
  // One instant for every "3h ago" on the page, so the server's render and
  // the browser's hydration cannot disagree about what "now" is.
  const now = new Date()
  // F0353 — the hero told a servant only that they were a servant. The child's
  // branch already names their class (:409 below); the prototype named the
  // servant's too. A coordinator on three classes gets the count and a stage
  // overseer gets their stage, so the tag says something true in all three
  // shapes rather than naming one class and hiding the rest.
  const classTag =
    user.role !== 'SERVANT'
      ? null
      : data.classes.length === 1
        ? data.classes[0]!.name
        : data.classes.length > 1
          ? `${data.classes.length} classes`
          : user.stageOversight
            ? STAGE_LABEL[user.stageOversight]
            : null
  const roleTag =
    (user.role === 'ADMIN' ? 'Administrator' : user.role === 'PASTOR' ? 'Pastor' : 'Servant') +
    (classTag ? ` · ${classTag}` : '')
  const churchWide = user.role === 'ADMIN' || user.role === 'PASTOR'

  // A servant with a class they may write to can author exams; one who only
  // oversees a stage cannot, and /portal/exams/new turns them away.
  const canAuthorExam = data.classes.some((c) => can(user, 'points.write', { classId: c.id, classStage: c.stage }))
  const quickActions: Array<{ href: string; title: string; description: string; icon: React.ReactNode; accent: string }> =
    user.role === 'ADMIN'
      ? [
          { href: '/portal/admin/classes', title: 'Manage classes', description: 'Add or remove classes', icon: <GraduationCap className="h-6 w-6" />, accent: '#4F46E5' },
          { href: '/portal/admin/servants/new', title: 'Add a servant', description: 'Register a new servant account', icon: <UserPlus className="h-6 w-6" />, accent: '#16A34A' },
          { href: '/portal/qr', title: 'Open a QR code', description: 'Check a class in by scanning', icon: <QrCode className="h-6 w-6" />, accent: '#2563EB' },
          { href: '/portal/reports', title: 'Student reports', description: 'View reports and analytics', icon: <BarChart3 className="h-6 w-6" />, accent: '#4F46E5' },
        ]
      : user.role === 'SERVANT'
        ? [
            { href: '/portal/attendance', title: 'Take attendance', description: 'Mark today’s register', icon: <CalendarCheck className="h-6 w-6" />, accent: '#16A34A' },
            { href: '/portal/points', title: 'Give points', description: 'Reward your class', icon: <Sparkles className="h-6 w-6" />, accent: '#C89B3C' },
            { href: '/portal/qr', title: 'Open a QR code', description: 'Check your class in by scanning', icon: <QrCode className="h-6 w-6" />, accent: '#2563EB' },
            ...(canAuthorExam
              ? [{ href: '/portal/exams/new', title: 'Create a quiz', description: 'Write one, or import a sheet', icon: <ClipboardList className="h-6 w-6" />, accent: '#7C3AED' }]
              : []),
            { href: '/portal/lessons', title: 'Lesson archive', description: 'What every class has taught', icon: <BookOpen className="h-6 w-6" />, accent: '#0E7490' },
            // The prototype's fifth tile (OG L4570-4573). Reports were in the
            // sidebar here but nowhere on the dashboard, which is the page a
            // servant actually starts from.
            { href: '/portal/reports', title: 'Student reports', description: 'View reports and analytics', icon: <BarChart3 className="h-6 w-6" />, accent: '#4F46E5' },
          ]
        : user.role === 'PASTOR'
          ? [
              // F0140 — the servant and the admin both got a Reports tile; the
              // pastor's quick-actions were an empty array, so the one page he
              // opens the portal for was reachable only from the sidebar. Goes
              // straight to the church-wide grid (?tab=church), not the
              // per-class register a bare /portal/reports resolves to.
              { href: '/portal/reports?tab=church', title: 'Church reports', description: 'Attendance, scores and points by class', icon: <BarChart3 className="h-6 w-6" />, accent: '#4F46E5' },
            ]
          : []

  return (
    <>
      <HeroBanner
        tag={`Sunday School · ${roleTag}`}
        title={`Welcome back, ${user.displayName.split(' ')[0]}!`}
        verse="&ldquo;Let the little children come to me&hellip;&rdquo;"
        reference="Mark 10:14"
      />

      {/* Two different rows. A servant was shown the admin's church totals —
          Classes / Servants / Students — which are not their job. The
          prototype's servant row was about their own teaching: how the class is
          scoring, how many children are new, who needs a check-in. */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {churchWide ? (
          <>
            <StatCard label="Classes" value={data.classes.length} icon={<GraduationCap className="h-6 w-6" />} accent="#4F46E5" />
            <StatCard label="Servants" value={data.totals.servants} icon={<UserCog className="h-6 w-6" />} accent="#DC2626" />
            <StatCard label="Students" value={data.totals.students} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
          </>
        ) : (
          <>
            <StatCard
              label="My students"
              value={data.totals.students}
              hint={
                // The prototype carried the month's new arrivals as this
                // tile's sub-label rather than spending a whole tile on it
                // (OG L4529), which is what freed the slots for Attendance
                // and Exams below.
                data.totals.newStudentsThisMonth > 0
                  ? `+${data.totals.newStudentsThisMonth} this month`
                  : data.classes.length === 1
                    ? data.classes[0]!.name
                    : `across ${data.classes.length} classes`
              }
              icon={<Users className="h-6 w-6" />}
              accent="#16A34A"
            />
            <StatCard
              label="Quiz average"
              value={data.totals.quizAverage === null ? '—' : `${data.totals.quizAverage}%`}
              hint={data.totals.quizzesSat > 0 ? `${data.totals.quizzesSat} sat · best ${data.totals.quizBest}%` : 'none sat yet'}
              tone={data.totals.quizAverage === null ? 'default' : data.totals.quizAverage >= 70 ? 'good' : 'warn'}
              icon={<ClipboardList className="h-6 w-6" />}
              accent={data.totals.quizAverage === null ? '#7C7A7A' : data.totals.quizAverage >= 70 ? '#16A34A' : '#D97706'}
            />
            {/* Attendance, with the prototype's "vs last session" arrow
                (F0357). The per-class rate is on each card below, but a
                servant on three classes had no single number for all of
                them and no sense of which way it was moving. */}
            <StatCard
              label="Attendance"
              value={data.attendanceOverall.rate === null ? '—' : `${data.attendanceOverall.rate}%`}
              tone={
                data.attendanceOverall.rate === null ? 'default' : data.attendanceOverall.rate >= 70 ? 'good' : 'warn'
              }
              hint={
                data.attendanceOverall.delta === null ? (
                  'Last four weeks'
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {data.attendanceOverall.delta >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-[#16A34A]" aria-hidden />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-[#DC2626]" aria-hidden />
                    )}
                    {Math.abs(data.attendanceOverall.delta)}% vs last session
                  </span>
                )
              }
              icon={<CalendarCheck className="h-6 w-6" />}
              accent={data.attendanceOverall.rate === null ? '#7C7A7A' : data.attendanceOverall.rate >= 70 ? '#16A34A' : '#D97706'}
            />
            {/* F0358 — the prototype's fourth tile. */}
            <StatCard
              label="Exams"
              value={data.exams.total}
              hint={data.exams.active > 0 ? `${data.exams.active} active` : 'No active exams'}
              icon={<ClipboardList className="h-6 w-6" />}
              accent="#7C3AED"
            />
          </>
        )}
        {/* The prototype's fourth overview tile. It exists on Church Reports,
            but that tab is not the default and was not linked from here, so the
            one academic number the pastor watches was invisible at a glance. */}
        {churchWide && (
          <StatCard
            label="Quiz average"
            value={data.totals.quizAverage === null ? '—' : `${data.totals.quizAverage}%`}
            tone={data.totals.quizAverage === null ? 'default' : data.totals.quizAverage >= 70 ? 'good' : 'warn'}
            icon={<ClipboardList className="h-6 w-6" />}
            accent={data.totals.quizAverage === null ? '#7C7A7A' : data.totals.quizAverage >= 70 ? '#16A34A' : '#D97706'}
            hint="Across every quiz submitted"
          />
        )}
        <StatCard
          label="Open follow-ups"
          value={data.totals.openCases}
          tone={data.totals.openCases > 0 ? 'warn' : 'good'}
          icon={<HeartHandshake className="h-6 w-6" />}
          accent={data.totals.openCases > 0 ? '#D97706' : '#16A34A'}
          hint={data.totals.openCases > 0 ? 'Students who need a check-in' : 'Everyone is accounted for'}
        />
      </div>

      {/* Quick actions. The prototype's grid lived in svLoad — it was the
          SERVANT's block (OG L4548); the port had one ADMIN-only pair and gave
          servants nothing. Each tile is gated on the destination actually being
          reachable for this user: /portal/exams/new 404s for a servant with no
          assignable class, which would make the tile a dead link. */}
      {quickActions.length > 0 && (
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((a) => (
            <ActionCard
              key={a.href}
              href={a.href}
              title={a.title}
              description={a.description}
              icon={a.icon}
              accent={a.accent}
            />
          ))}
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
                    photo={c.photo}
                    /* F0535 — the class's notes line, under its name. */
                    note={c.description}
                    rows={[
                      { key: 'Stage', value: STAGE_LABEL[c.stage] },
                      // The prototype named the servant rather than counting
                      // them — a pastor reads a class by who serves it.
                      ...(churchWide && c.servantNames.length > 0
                        ? [{
                            key: c.servantNames.length === 1 ? 'Servant' : 'Servants',
                            value: c.servantNames.length <= 2
                              ? c.servantNames.join(', ')
                              : `${c.servantNames[0]} +${c.servantNames.length - 1}`,
                          }]
                        : [{ key: 'Servants', value: c.servantCount }]),
                      { key: 'Students', value: c.studentCount },
                      ...(c.sundayRate4w !== null
                        ? [{ key: 'Attendance (4 wks)', value: `${c.sundayRate4w}%` }]
                        : []),
                      ...(churchWide && c.quizAverage !== null
                        ? [{ key: 'Quiz avg', value: `${c.quizAverage}%` }]
                        : []),
                      ...(churchWide && c.topStudent
                        ? [{ key: 'Top student', value: `${c.topStudent.name} (${c.topStudent.points})` }]
                        : []),
                    ]}
                    actions={
                      user.role === 'PASTOR' ? (
                        // The pastor had no action at all on a class card. The
                        // prototype's was Print — read-only and still is.
                        <LinkButton href={`/portal/reports/class/${c.id}`} variant="secondary" size="sm">
                          <Printer className="h-4 w-4" aria-hidden /> Print
                        </LinkButton>
                      ) : (
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
            {/* F0354 — from early Sunday afternoon the same fact is a banner
                rather than a badge: classes have met, so this is no longer a
                nag, and it is the one thing on the page that still needs doing. */}
            {afterClasses && unmarkedToday.length > 0 && (
              <div className="mt-3 rounded-[14px] border-[1.5px] border-[#F59E0B] bg-[#FFFBEB] px-4 py-3.5">
                <p className="font-serif text-[14px] font-bold text-[#92400E]">
                  {unmarkedToday.length === 1
                    ? `Today’s register has not been taken for ${unmarkedToday[0]!.name}.`
                    : `Today’s register has not been taken for ${unmarkedToday.length} of your classes.`}
                </p>
                <p className="mt-0.5 text-[12.5px] text-[#B45309]">
                  Marks taken today still count for this week. Attendance is what opens follow-ups for
                  the children who stopped coming.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {unmarkedToday.map((c) => (
                    <LinkButton key={`banner-${c.id}`} href={`/portal/classes/${c.id}/attendance`} variant="secondary" size="sm">
                      Take {c.name}
                    </LinkButton>
                  ))}
                </div>
              </div>
            )}
            {data.classes.some((c) => c.openCases > 0 || (isSunday && !afterClasses && c.sessionsToday.length === 0)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.classes.map((c) =>
                  c.openCases > 0 ? (
                    <Link key={`case-${c.id}`} href="/portal/follow-ups">
                      <Badge tone="bad">
                        {c.name}: {c.openCases} open follow-up{c.openCases > 1 ? 's' : ''}
                      </Badge>
                    </Link>
                  ) : isSunday && !afterClasses && c.sessionsToday.length === 0 ? (
                    <Link key={`att-${c.id}`} href={`/portal/classes/${c.id}/attendance`}>
                      <Badge tone="warn">{c.name}: no attendance yet today</Badge>
                    </Link>
                  ) : null,
                )}
              </div>
            )}
          </div>

          {/* Attendance Overview — the prototype's own section on the pastor and
              admin overview (OG L15394-15409): every class on one bar chart, so
              the class that is slipping is visible without opening any of them.
              The per-class rate is on each card above, but one card at a time is
              not a comparison. */}
          {churchWide && data.classes.length > 0 && (
            <div>
              <SectionTitle hint="Sundays over the last four weeks">Attendance overview</SectionTitle>
              <Card bodyClassName="p-0">
                <ul className="divide-y divide-[#F5F2ED]">
                  {data.classes.map((c) => {
                    const rate = c.sundayRate4w
                    const tone = rate === null ? 'brand' : rate >= 70 ? 'good' : rate >= 50 ? 'warn' : 'bad'
                    const badge =
                      rate === null ? 'No data' : rate >= 80 ? 'Excellent' : rate >= 60 ? 'Good' : 'Needs attention'
                    return (
                      <li key={`ao-${c.id}`} className="flex items-center gap-3.5 px-[18px] py-3">
                        <Link
                          href={`/portal/classes/${c.id}`}
                          className="min-w-[96px] shrink-0 truncate text-[12px] font-semibold text-parch-900 hover:underline"
                        >
                          {c.name}
                        </Link>
                        <span className="min-w-0 flex-1">
                          <ProgressBar value={rate ?? 0} tone={tone} label={`${c.name} Sunday attendance`} />
                        </span>
                        <span
                          className="w-10 shrink-0 text-right text-[12px] font-bold tabular-nums"
                          style={{
                            color: rate === null ? '#7C7A7A' : rate >= 70 ? '#16A34A' : rate >= 50 ? '#D97706' : '#DC2626',
                          }}
                        >
                          {rate === null ? '—' : `${rate}%`}
                        </span>
                        <span className="shrink-0">
                          <Badge tone={rate === null ? 'neutral' : rate >= 80 ? 'good' : rate >= 60 ? 'warn' : 'bad'}>
                            {badge}
                          </Badge>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </div>
          )}

          {/* F0529 / F0756 — the prototype drew this on the overview itself,
              not only on a reports tab that is not the default. Restored here
              for the roles that had it, with the reports copy left in place. */}
          {churchWide && data.classes.filter((c) => c.quizAverage !== null).length >= 2 && (
            <div>
              <SectionTitle hint="Every quiz submitted, averaged per class">Average scores by class</SectionTitle>
              <Card>
                <PortalChart
                  kind="bar"
                  points={data.classes
                    .filter((c) => c.quizAverage !== null)
                    .map((c) => ({ label: c.name, value: c.quizAverage! }))}
                  label="Average score"
                  caption="The mean of every quiz a class has submitted. Classes that have not sat one yet are left out rather than drawn as zero."
                  colour="#C89B3C"
                  suffix="%"
                  maxY={100}
                />
              </Card>
            </div>
          )}

          {/* Servants only. StaffHome serves SERVANT, ADMIN and PASTOR, and a
              class-scoped trend means nothing to an admin with no class of
              their own — they have the Attendance overview above instead. */}
          {!churchWide && (
            <div>
              <SectionTitle hint="Your classes, last four weeks">Attendance trend</SectionTitle>
              {/* F0448 — with fewer than two weeks on record the whole section
                  used to disappear, and a card that is simply not there reads
                  the same as one that broke. A servant in their first weeks is
                  told the line needs a second register rather than left to
                  wonder what happened to it. */}
              {data.attendanceTrend.length < 2 ? (
                <EmptyState
                  title="Not enough attendance history yet"
                  hint="A trend line needs two weeks of register. Take attendance for your classes and it draws itself here."
                />
              ) : (
                <Card>
                  <PortalChart
                    kind="line"
                    points={data.attendanceTrend.map((d) => ({ label: formatShortDate(d.date), value: d.rate }))}
                    label="Attendance"
                    caption="Scored the same way as the cards above: an excused absence is left out rather than counted against the class."
                    suffix="%"
                    maxY={100}
                  />
                </Card>
              )}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <LessonsWidget user={user} />
            <ExamsWidget user={user} />
          </div>
        </div>

        <div className="space-y-5">
          <NotificationsWidget user={user} />
          {/* The prototype put this first in the widget column and showed it
              only once somebody had checked in today (OG L4394-4425): before
              the first check-in, "nobody is here" is noise, not news. */}
          <NotCheckedInWidget students={data.notCheckedInToday} />
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
          <TopPerformersWidget students={data.topStudents} />
          <RecentActivityWidget entries={data.recentActivity} now={now} churchWide={churchWide} />
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

      {/* The prototype's student stat row was Quiz Avg · Points · Rank ·
          Pending (OG L11755-11778); the port had swapped Quiz Avg and Pending
          out for a bare birthday count, pushing the two numbers a student
          actually asks about onto other pages. Sunday attendance is kept as a
          fifth tile — it was a bar in the OG's My Progress card, which is
          restored below, but it is worth a glance too. */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Quiz average"
          value={data.quizAverage === null ? '—' : `${data.quizAverage}%`}
          tone={data.quizAverage === null ? 'default' : data.quizAverage >= 70 ? 'good' : 'warn'}
          hint={
            data.quizTrend === null || data.quizTrend === 0 ? (
              data.quizAverage === null ? 'No quizzes yet' : 'Across every quiz'
            ) : (
              <span className="inline-flex items-center gap-1">
                {data.quizTrend > 0 ? (
                  <TrendingUp className="h-3 w-3 text-[#16A34A]" aria-hidden />
                ) : (
                  <TrendingDown className="h-3 w-3 text-[#DC2626]" aria-hidden />
                )}
                {Math.abs(data.quizTrend)}% on your last quiz
              </span>
            )
          }
          icon={<ClipboardList className="h-6 w-6" />}
          accent={data.quizAverage === null ? '#7C7A7A' : data.quizAverage >= 70 ? '#16A34A' : '#D97706'}
        />
        <StatCard
          label="My points"
          value={data.total}
          hint={data.pointsThisMonth > 0 ? `+${data.pointsThisMonth} this month` : undefined}
          icon={<Sparkles className="h-6 w-6" />}
          accent="#CA8A04"
        />
        <StatCard
          label="My rank"
          value={data.rank ? `#${data.rank}` : '—'}
          hint={data.rank === 1 ? 'Top of the class' : `of ${data.classSize} in class`}
          tone={data.rank === 1 ? 'good' : 'default'}
          icon={<Trophy className="h-6 w-6" />}
          accent="#7C3AED"
        />
        <StatCard
          label="Pending"
          value={data.pending.count}
          hint={
            data.pending.count === 0
              ? 'No pending tasks'
              : data.pending.nextDue
                ? `Next due ${formatMonthDay(data.pending.nextDue)}`
                : 'No deadline set'
          }
          tone={data.pending.count === 0 ? 'good' : 'default'}
          icon={<Clock className="h-6 w-6" />}
          accent={data.pending.count === 0 ? '#16A34A' : '#2563EB'}
        />
        <StatCard
          label="Sunday attendance"
          value={data.rate.rate === null ? '—' : `${data.rate.rate}%`}
          hint={`${data.rate.attended} of ${data.rate.held} Sundays`}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent="#16A34A"
        />
      </div>

      {/* "NEW QUIZ AVAILABLE" (F0083 / F0677) — the prototype's banner for a
          quiz written in the last 48 hours that this student has not sat. */}
      {data.newExams.length > 0 && (
        <Link
          href={data.newExams.length === 1 ? `/portal/quizzes/${data.newExams[0]!.id}` : '/portal/quizzes'}
          className="mb-5 flex items-center gap-3.5 rounded-[12px] bg-gradient-to-br from-brand-900 to-brand-800 px-4 py-3.5 text-parch-50 transition hover:brightness-110"
        >
          <Sparkles className="h-6 w-6 shrink-0 text-brand-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold uppercase tracking-[0.6px] text-parch-50/60">
              New quiz available
            </span>
            <span className="block truncate text-[13px] font-semibold">
              {data.newExams[0]!.title}
              {data.newExams.length > 1 ? ` + ${data.newExams.length - 1} more` : ''}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-parch-50/70">Start &rarr;</span>
        </Link>
      )}

      {/* The prototype's two mini widgets (OG L11876-11882). "Last Quiz" now
          lives in the Quizzes card's footer, so only the streak needs a home;
          birthdays keep their place but name the people instead of counting
          them, which is what a child would do with the number anyway. */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <IconTile accent="#E8873C">
              <Flame className="h-5 w-5" aria-hidden />
            </IconTile>
            <div className="min-w-0">
              <p className="text-[11px] text-parch-500">Current streak</p>
              <p className="text-[14px] font-bold text-parch-900">
                {data.streak} {data.streak === 1 ? 'Sunday' : 'Sundays'}
              </p>
              <p className={`text-[11px] ${data.streak > 0 ? 'text-[#16A34A]' : 'text-parch-500'}`}>
                {data.streak > 0 ? 'Keep it up!' : 'Start this week!'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <IconTile accent="#DB2777">
              <Cake className="h-5 w-5" aria-hidden />
            </IconTile>
            <div className="min-w-0">
              <p className="text-[11px] text-parch-500">Birthdays soon</p>
              {data.birthdays.length === 0 ? (
                <p className="text-[14px] font-bold text-parch-900">None coming up</p>
              ) : (
                <>
                  <p className="truncate text-[14px] font-bold text-parch-900">
                    {data.birthdays[0]!.name}
                    {data.birthdays.length > 1 ? ` + ${data.birthdays.length - 1} more` : ''}
                  </p>
                  <p className="text-[11px] text-parch-500">
                    {data.birthdays[0]!.daysUntil === 0
                      ? 'Today'
                      : data.birthdays[0]!.daysUntil === 1
                        ? 'Tomorrow'
                        : formatMonthDay(data.birthdays[0]!.on)}
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <NotificationsWidget user={user} />
        <ExamsWidget user={user} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* F0710 — nothing on a student's home page reached Grades & Points,
            the one page that answers "where did my points actually come from?".
            This card shows the last few entries and then stops, so it is the
            card the question is asked from. The prototype hung that link off
            the leaderboard card's "View all" (OG :11798); here "View all" on a
            leaderboard already means /portal/leaderboard, which is what "all"
            means on a leaderboard — so the route is restored where it reads
            true rather than where the prototype happened to put it. */}
        <Card
          title="Recent points"
          icon={<Sparkles className="h-4 w-4" />}
          action={
            <Link href="/portal/grades" className="text-[11px] font-bold text-brand-800 hover:underline">
              View all
            </Link>
          }
        >
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
          <Card
            title="Class leaderboard"
            icon={<Trophy className="h-4 w-4" />}
            /* F0679 — the prototype's header button. */
            action={
              <Link href="/portal/leaderboard" className="text-[11px] font-bold text-brand-800 hover:underline">
                View all
              </Link>
            }
          >
            {/* F0080 — medals, avatar and a bar against the leader, as the
                standalone leaderboard page already does. A bare ranked list
                gave no sense of the gap between first and third. */}
            <ol className="space-y-1.5 text-[12.5px]">
              {data.top3.map((r, i) => (
                <li
                  key={r.studentId}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${r.studentId === data.me.id ? 'bg-brand-wash font-semibold' : ''}`}
                >
                  <span aria-hidden className="w-5 shrink-0 text-center text-[15px]">
                    {['🥇', '🥈', '🥉'][i]}
                  </span>
                  <Avatar name={r.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {r.name}
                      {r.studentId === data.me.id ? ' (you)' : ''}
                    </span>
                    <ProgressBar
                      value={data.leaderPoints > 0 ? Math.round((r.total / data.leaderPoints) * 100) : 0}
                      tone={r.studentId === data.me.id ? 'brand' : 'good'}
                      label={`${r.name}'s points against the leader`}
                    />
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{r.total}</span>
                </li>
              ))}
            </ol>
            {/* F0681 — a student outside the podium saw three names and no
                sign of where they stood. The prototype appended their own row
                below a divider. */}
            {data.rank !== null && data.rank > 3 && (
              <div className="mt-2 border-t border-parch-200 pt-2">
                <div className="flex justify-between gap-2 rounded-lg bg-brand-wash px-2 py-1.5 text-[12.5px] font-semibold">
                  <span className="truncate">
                    #{data.rank} {data.me.firstName} (you)
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{data.total}</span>
                </div>
              </div>
            )}
          </Card>

          {/* F0084 / F0682 — "My Progress". The three numbers a student is
              measured by were scattered across three pages; the prototype
              showed them together, each against what it is measured out of. */}
          <Card title="My progress" icon={<BarChart2 className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-parch-800">Points vs leader</span>
                  <span className="font-semibold text-brand-gold-dark tabular-nums">
                    {data.total} / {data.leaderPoints}
                  </span>
                </div>
                <ProgressBar
                  value={data.leaderPoints > 0 ? Math.min(100, Math.round((data.total / data.leaderPoints) * 100)) : 0}
                  tone="brand"
                  label="Points against the class leader"
                />
                <p className="mt-1 text-[11px] text-parch-500">
                  {data.rank ? `Rank #${data.rank} of ${data.classSize}` : 'Not ranked yet'}
                </p>
              </div>
              {data.quizAverage !== null && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-parch-800">Quiz average</span>
                    <span
                      className={`font-semibold tabular-nums ${data.quizAverage >= 70 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}
                    >
                      {data.quizAverage}%
                    </span>
                  </div>
                  <ProgressBar
                    value={data.quizAverage}
                    tone={data.quizAverage >= 70 ? 'good' : 'warn'}
                    label="Quiz average"
                  />
                </div>
              )}
              {data.rate.rate !== null && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-parch-800">Attendance</span>
                    <span className="font-semibold text-brand-800 tabular-nums">
                      {data.rate.rate}% · {data.rate.attended}/{data.rate.held} Sundays
                    </span>
                  </div>
                  <ProgressBar value={data.rate.rate} tone="brand" label="Sunday attendance" />
                </div>
              )}
            </div>
          </Card>

          {/* F0683 — the prototype's score-trend line, last eight quizzes. */}
          {data.scoreTrend.length >= 2 && (
            <Card title="My score trend" icon={<TrendingUp className="h-4 w-4" />}>
              <PortalChart
                kind="line"
                points={data.scoreTrend.map((q) => ({
                  label: q.title.length > 14 ? `${q.title.slice(0, 13)}…` : q.title,
                  value: q.percentage,
                }))}
                label="Score"
                caption="Your last eight quizzes, oldest first."
                colour="#C89B3C"
                suffix="%"
                maxY={100}
              />
            </Card>
          )}

          {/* F0686 / F0090 — a quiz-only recent list with the prototype's
              three-band score rings, kept beside the general points ledger
              rather than replacing it. */}
          {data.recentQuizzes.length > 0 && (
            <Card title="Recent quizzes" icon={<ClipboardList className="h-4 w-4" />} bodyClassName="p-0">
              <ul>
                {data.recentQuizzes.map((q) => {
                  const band = SCORE_BAND_TONE[scoreBand(q.percentage)]
                  const ring =
                    band === 'good'
                      ? 'bg-[#F0FDF4] text-[#166534] border-[#86EFAC]'
                      : band === 'warn'
                        ? 'bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]'
                        : 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]'
                  return (
                    <li
                      key={q.id}
                      className="flex items-center gap-3 border-b-[0.5px] border-[#F0EEE8] px-[18px] py-2.5 last:border-b-0"
                    >
                      <span
                        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold tabular-nums ${ring}`}
                      >
                        {q.percentage}%
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/portal/quizzes/${q.examId}`}
                          className="block truncate text-[12px] font-semibold text-parch-800 hover:text-brand-800"
                        >
                          {q.title}
                        </Link>
                        <p className="text-[12px] text-parch-500">
                          {q.correctCount} / {q.questionCount} correct · {q.score} pts
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
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
