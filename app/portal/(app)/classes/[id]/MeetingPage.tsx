import Link from '@/components/portal/Link'
import { Users, UserCog, CalendarCheck, QrCode, HeartHandshake, UserPlus, Upload, Send, Camera, History, UserMinus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { can, type PortalUser } from '@/lib/portal/permissions'
import { rosterWhere } from '@/lib/portal/class-members'
import { meetingSessionKey, memberTags } from '@/lib/portal/fellowship'
import { attendanceRate, heldOccasions, sessionTrend, type AttendanceRow } from '@/lib/portal/reports'
import { presentStreak } from '@/lib/portal/achievements'
import { formatDateOnly, churchToday, toUTCDate } from '@/lib/portal/dates'
import { formatShortDate, STAGE_LABEL, TITLE_LABEL } from '@/lib/portal/format'
import { studentName } from '@/lib/portal/data/students'
import { excusesByStudent } from '@/lib/portal/data/excuses'
import { currentExcuse, excuseState, excuseSummary } from '@/lib/portal/excuses'
import { ensureInitialSplits, loadClassGroups } from '@/lib/portal/data/groups'
import { effectiveServant, groupHealth } from '@/lib/portal/groups'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, Card, StatCard, Avatar, Badge, EmptyState, LinkButton, SectionTitle, Callout } from '@/components/portal/ui'
import { MemberPhone } from '@/components/portal/MemberPhone'
import { PhotoUpload } from '@/components/portal/PhotoUpload'
import { setClassPhoto, removeClassPhoto } from '@/lib/portal/actions/photos'
import { GroupsPanel } from './GroupsPanel'
import { RosterFilter } from './RosterFilter'
import { MemberExportButton } from './MemberExportButton'
import { formerMembers } from '@/lib/portal/data/fellowship'
import { AddBackButton } from '@/components/portal/AddBackButton'

/** How many of a meeting's latest meetings the page scores. */
const RECENT = 8

/**
 * A Fellowship meeting's page (2026-10-24): its members, how the last few
 * meetings went, who follows up whom, and its servants. Points, quizzes and the
 * children's printouts are not here; a meeting has none of them.
 */
export async function MeetingPage({
  user,
  cls,
  q,
}: {
  user: PortalUser
  cls: { id: string; name: string; stage: 'FELLOWSHIP'; visitationThreshold: number; photo: string | null }
  q: string
}) {
  const ctx = { classId: cls.id, classStage: cls.stage }
  const canWrite = can(user, 'attendance.write', ctx)
  const canEdit = can(user, 'student.write', ctx)
  const canFollowUp = can(user, 'followup.write', ctx)
  const canManageGroups = can(user, 'group.manage', ctx)
  const sessionKey = meetingSessionKey(cls.id)
  await ensureInitialSplits().catch((err) => console.error('Initial group split failed:', err))

  const [members, servants, openCases, recentDates, [groups]] = await Promise.all([
    prisma.student.findMany({
      where: rosterWhere(cls.id),
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classId: true,
        class: { select: { name: true } },
        memberships: { select: { classId: true, class: { select: { name: true, stage: true } } } },
        account: {
          select: {
            photo: true,
            phone: true,
            role: true,
            servant: { select: { classes: { select: { class: { select: { name: true, sortOrder: true } } } } } },
          },
        },
      },
    }),
    prisma.classServant.findMany({
      where: { classId: cls.id },
      orderBy: [{ title: 'asc' }, { sortOrder: 'asc' }],
      select: { title: true, servant: { select: { id: true, account: { select: { displayName: true, photo: true, phone: true } } } } },
    }),
    prisma.followUpCase.findMany({ where: { classId: cls.id, status: 'OPEN' }, select: { studentId: true } }),
    // DISTINCT + LIMIT in Postgres, as the register does: Prisma's distinct
    // would download every row the meeting ever had.
    prisma.$queryRaw<{ date: Date }[]>`
      SELECT DISTINCT "date" FROM "AttendanceRecord"
      WHERE "classId" = ${cls.id} AND "sessionKey" = ${sessionKey}
      ORDER BY "date" DESC
      LIMIT ${RECENT}
    `,
    loadClassGroups([cls.id]),
  ])

  const dates = recentDates.map((r) => formatDateOnly(r.date))
  const rows = dates.length
    ? await prisma.attendanceRecord.findMany({
        where: { classId: cls.id, sessionKey, date: { in: dates.map((d) => toUTCDate(d)) } },
        select: { studentId: true, date: true, status: true },
      })
    : []
  const marks: AttendanceRow[] = rows.map((r) => ({ studentId: r.studentId, date: formatDateOnly(r.date), sessionKey, status: r.status }))
  const occasions = heldOccasions(marks)
  const roster = members.map((m) => m.id)
  const overall = attendanceRate(marks, { occasions, studentIds: roster })
  const rateOf = new Map(roster.map((id) => [id, attendanceRate(marks.filter((m) => m.studentId === id), { occasions, studentIds: [id] }).rate]))
  const streakOf = new Map(roster.map((id) => [id, presentStreak(marks.filter((m) => m.studentId === id).map((m) => ({ date: m.date, status: m.status })))]))
  const trend = sessionTrend(dates.slice(0, 6), marks, members.map((m) => ({ id: m.id, name: studentName(m) })))
  const today = churchToday()
  const openSet = new Set(openCases.map((c) => c.studentId))
  const [excuses, left] = await Promise.all([excusesByStudent(roster, { endingFrom: today }), formerMembers(cls.id, roster)])
  const excusedNow = new Map(
    roster
      .map((id) => [id, currentExcuse(excuses.get(id) ?? [], today)] as const)
      .filter((e): e is readonly [string, NonNullable<(typeof e)[1]>] => !!e[1] && excuseState(e[1], today) === 'active'),
  )
  // A meeting held today whose check-in nobody closed: who missed it is not
  // worked out until a servant presses Done or saves the register.
  const heldToday = dates[0] === today

  return (
    <>
      <PageHeader
        eyebrow={STAGE_LABEL.FELLOWSHIP}
        title={cls.name}
        subtitle={`${members.length} member${members.length === 1 ? '' : 's'} · ${servants.length} servant${servants.length === 1 ? '' : 's'}`}
        back={{ href: '/portal/classes', label: 'Classes' }}
        icon={
          cls.photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={cls.photo} alt="" className="h-8 w-8 rounded-[9px] border border-brand-gold/60 object-cover" />
          ) : (
            <HeartHandshake className="h-5 w-5" aria-hidden />
          )
        }
        actions={
          <>
            {canWrite && (
              <>
                <LinkButton href={`/portal/classes/${cls.id}/attendance`}>
                  <CalendarCheck className="h-4 w-4" aria-hidden /> Take attendance
                </LinkButton>
                <LinkButton href={`/portal/classes/${cls.id}/checkin`} variant="secondary">
                  <QrCode className="h-4 w-4" aria-hidden /> QR check-in
                </LinkButton>
              </>
            )}
            {canEdit && (
              <>
                <LinkButton href={`/portal/classes/${cls.id}/members/new`} variant="secondary">
                  <UserPlus className="h-4 w-4" aria-hidden /> Add member
                </LinkButton>
                <LinkButton href={`/portal/classes/${cls.id}/import`} variant="secondary">
                  <Upload className="h-4 w-4" aria-hidden /> Import members
                </LinkButton>
              </>
            )}
            <MemberExportButton classId={cls.id} />
            {canFollowUp && (
              <LinkButton href={`/portal/classes/${cls.id}/message`} variant="secondary">
                <Send className="h-4 w-4" aria-hidden /> Message members
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Members" value={members.length} icon={<Users className="h-6 w-6" />} accent="#16A34A" />
        <StatCard label="Servants" value={servants.length} icon={<UserCog className="h-6 w-6" />} accent="#DC2626" />
        <StatCard
          label="Attendance"
          value={overall.rate === null ? '—' : `${overall.rate}%`}
          hint={dates.length ? `last ${dates.length} meeting${dates.length === 1 ? '' : 's'}` : 'No meetings yet'}
          tone={overall.rate === null ? 'default' : overall.rate >= 85 ? 'good' : overall.rate >= 60 ? 'warn' : 'bad'}
          icon={<CalendarCheck className="h-6 w-6" />}
          accent={overall.rate === null ? '#7C7A7A' : overall.rate >= 85 ? '#16A34A' : overall.rate >= 60 ? '#D97706' : '#DC2626'}
        />
        <StatCard
          label="Open follow-ups"
          value={openCases.length}
          hint={`after ${cls.visitationThreshold} missed in a row`}
          tone={openCases.length === 0 ? 'good' : 'warn'}
          icon={<HeartHandshake className="h-6 w-6" />}
          accent={openCases.length === 0 ? '#16A34A' : '#D97706'}
        />
      </div>

      {heldToday && canWrite && (
        <div className="mb-5 print:hidden">
          <Callout tone="info" title="After today’s meeting">
            When everyone is in, press <b>Done</b> on the QR check-in, or save the attendance list, so the portal knows who
            missed today and can open their follow-ups.
          </Callout>
        </div>
      )}

      {trend.length > 0 && (
        <Card className="mb-5" title="Recent meetings" icon={<History className="h-4 w-4" aria-hidden />}>
          <ul className="flex flex-wrap gap-2.5" data-testid="meeting-trend">
            {trend.map((d) => {
              const tone = d.rate === null ? '#7C7A7A' : d.rate >= 80 ? '#16A34A' : d.rate >= 50 ? '#D97706' : '#DC2626'
              return (
                <li key={d.date} className="min-w-[8rem] flex-1">
                  <Link
                    href={`/portal/classes/${cls.id}/attendance?session=${sessionKey}&date=${d.date}`}
                    className="block rounded-[12px] border border-[#EFE9DC] bg-parch-100 px-3 py-2 hover:border-brand-gold"
                  >
                    <span className="block text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">{formatShortDate(d.date)}</span>
                    <span className="mt-0.5 block text-[19px] font-bold leading-none tabular-nums" style={{ color: tone }}>
                      {d.rate === null ? '—' : `${d.rate}%`}
                    </span>
                    <span className="mt-1 block text-[11px] text-parch-500">
                      {d.present} of {members.length} here
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {groups && (() => {
        const active = new Set(groups.servants.map((sv) => sv.id))
        const byServant = new Map(groups.servants.map((sv) => [sv.id, [] as Array<{ id: string; name: string }>]))
        const unassigned: Array<{ id: string; name: string }> = []
        for (const k of groups.kids) {
          const owner = effectiveServant(k.groupServantId, active)
          if (owner) byServant.get(owner)!.push({ id: k.id, name: k.name })
          else unassigned.push({ id: k.id, name: k.name })
        }
        return (
          <div className="mb-5">
            <GroupsPanel
              members
              classId={cls.id}
              canManage={canManageGroups}
              servants={groups.servants.map((sv) => ({ id: sv.id, name: sv.name, kids: byServant.get(sv.id)! }))}
              unassigned={unassigned}
              health={groupHealth(groups.kids, groups.servants)}
            />
          </div>
        )
      })()}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle>Members</SectionTitle>
          {members.length === 0 ? (
            <EmptyState
              title="No members yet"
              hint="Add the people who come — servants from any class, and people who don’t serve. A spreadsheet works too."
              action={
                canEdit ? (
                  <span className="flex flex-wrap justify-center gap-2">
                    <LinkButton href={`/portal/classes/${cls.id}/members/new`}>Add member</LinkButton>
                    <LinkButton href={`/portal/classes/${cls.id}/import`} variant="secondary">Import a list</LinkButton>
                  </span>
                ) : undefined
              }
            />
          ) : (
            <RosterFilter
              initial={q}
              total={members.length}
              items={members.map((m) => {
                const name = studentName(m)
                const pct = rateOf.get(m.id) ?? null
                const streak = streakOf.get(m.id) ?? 0
                const tags = memberTags(
                  {
                    classId: m.classId,
                    className: m.class?.name ?? null,
                    memberships: m.memberships.map((x) => ({ classId: x.classId, name: x.class.name, stage: x.class.stage })),
                    serves: (m.account.servant?.classes ?? [])
                      .slice()
                      .sort((a, b) => a.class.sortOrder - b.class.sortOrder)
                      .map((c) => c.class.name),
                  },
                  cls.id,
                )
                const servantRole = m.account.role === 'SERVANT'
                return {
                  id: m.id,
                  text: [name, ...tags.serves, ...tags.alsoIn].join(' ').toLowerCase(),
                  node: (
                    <div
                      key={m.id}
                      className="rounded-[14px] border border-parch-200 bg-parch-50 px-3.5 pb-3.5 pt-[18px] text-center shadow-card transition-shadow hover:shadow-panel"
                      style={{ borderTop: `3px solid ${accentFor(m.id)}` }}
                      data-testid="member-card"
                    >
                      <Link href={`/portal/members/${m.id}`} className="block">
                        <span className="mx-auto mb-2.5 block w-fit">
                          <Avatar name={name} photo={m.account.photo} size="lg" />
                        </span>
                        <span className="block truncate text-[13px] font-bold text-parch-900">{name}</span>
                        <span className="mb-3 block truncate text-[11px] text-parch-500">
                          {servantRole ? (tags.serves.length ? `Servant · ${tags.serves.join(', ')}` : 'Servant') : 'Member'}
                          {tags.alsoIn.length > 0 && ` · also ${tags.alsoIn.join(', ')}`}
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
                              title={`Attendance, last ${dates.length} meetings`}
                            >
                              {pct}%
                            </span>
                          )}
                          {streak >= 2 && (
                            <span
                              className="rounded-[20px] px-2 py-[3px] text-[10.5px] font-bold tabular-nums"
                              style={{ background: '#F0FDF4', color: '#166534' }}
                              title="Meetings attended in a row"
                            >
                              {streak} in a row
                            </span>
                          )}
                          {excusedNow.has(m.id) ? (
                            <span title={excusedNow.get(m.id)!.reason}>
                              <Badge tone="info">{excuseSummary(excusedNow.get(m.id)!, today)}</Badge>
                            </span>
                          ) : (
                            openSet.has(m.id) && <Badge tone="bad">Follow-up</Badge>
                          )}
                        </span>
                      </Link>
                      <MemberPhone name={name} phone={m.account.phone} center className="mt-3 border-t border-[#F5F2ED] pt-2.5" />
                    </div>
                  ),
                }
              })}
            />
          )}
        </div>

        <div className="space-y-5">
          <Card title="Servants" icon={<UserCog className="h-[15px] w-[15px]" />}>
            {servants.length === 0 ? (
              <p className="text-[12.5px] text-parch-500">No servants assigned. The admin adds them on each servant&rsquo;s page.</p>
            ) : (
              <ul className="space-y-2.5">
                {servants.map((s) => (
                  <li key={s.servant.id} className="flex items-center gap-2.5">
                    <Avatar name={s.servant.account.displayName} photo={s.servant.account.photo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-parch-900">{s.servant.account.displayName}</p>
                      <p className="text-[11px] text-parch-500">{s.title ? TITLE_LABEL[s.title] : 'Servant'}</p>
                    </div>
                    {s.title && <Badge tone="gold">{TITLE_LABEL[s.title]}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {/* The user's word (2026-10-24): keep the record of people who left. */}
          {left.length > 0 && (
            <Card title={`People who left (${left.length})`} icon={<UserMinus className="h-[15px] w-[15px]" />}>
              <details data-testid="people-who-left">
                <summary className="cursor-pointer text-[12px] font-semibold text-brand-800">Show them</summary>
                <ul className="mt-2 divide-y divide-[#F5F2ED]">
                  {left.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <Link href={`/portal/members/${p.id}`} className="block truncate text-[12.5px] font-semibold text-parch-900 hover:text-brand-800">
                          {p.name}
                        </Link>
                        <span className="block text-[11px] text-parch-500">
                          {p.lastMarked ? `Last on the list ${formatShortDate(p.lastMarked)}` : ''}
                          {p.servant ? ' · a servant' : ''}
                          {p.now ? ` · now in ${p.now}` : ''}
                        </span>
                      </span>
                      {canEdit && <AddBackButton classId={cls.id} studentId={p.id} name={p.name} />}
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          )}
          {canEdit && (
            <Card title="Meeting photo" icon={<Camera className="h-[15px] w-[15px]" />}>
              <PhotoUpload
                current={cls.photo}
                name={cls.name}
                action={setClassPhoto.bind(null, cls.id)}
                removeAction={removeClassPhoto.bind(null, cls.id)}
                saveLabel="Save meeting photo"
              />
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
