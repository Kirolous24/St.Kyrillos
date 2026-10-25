import Link from '@/components/portal/Link'
import { CalendarCheck, HeartHandshake, User, CalendarOff, Pencil } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireMemberRead } from '@/lib/portal/data/fellowship'
import { studentName } from '@/lib/portal/data/students'
import { can } from '@/lib/portal/permissions'
import { meetingSessionKey } from '@/lib/portal/fellowship'
import { attendanceRate, heldOccasions } from '@/lib/portal/reports'
import { presentStreak } from '@/lib/portal/achievements'
import { formatDateOnly, churchToday, ageOn, toUTCDate } from '@/lib/portal/dates'
import { formatMonthDay, formatShortDate, STAGE_LABEL } from '@/lib/portal/format'
import { PageHeader, Card, Badge, Avatar, LinkButton } from '@/components/portal/ui'
import { MemberPhone } from '@/components/portal/MemberPhone'
import { loadClassGroups } from '@/lib/portal/data/groups'
import { effectiveServant } from '@/lib/portal/groups'
import { contactMethodLabel, contactResultLabel, mayChangeContactNote, writtenForGroupOf } from '@/lib/portal/followups'
import { rosterWhere } from '@/lib/portal/class-members'
import { ContactNoteActions } from '@/components/portal/ContactNoteActions'
import { CheckInButton } from '@/components/portal/CheckInButton'
import { ExcuseNote } from '@/components/portal/ExcuseNote'
import { ExcuseControl } from '@/components/portal/ExcuseControl'
import { excusesByStudent } from '@/lib/portal/data/excuses'
import { excuseState } from '@/lib/portal/excuses'
import { GroupPicker } from '../../students/[id]/GroupPicker'
import { RemoveFromMeeting } from './RemoveFromMeeting'
import { AddBackButton } from '@/components/portal/AddBackButton'

export const metadata = { title: 'Member' }

/** Meetings shown per meeting on the page. */
const SHOWN = 12

const MARK: Record<'PRESENT' | 'EXCUSED' | 'ABSENT' | 'NONE', { label: string; bg: string; fg: string }> = {
  PRESENT: { label: 'Here', bg: '#DCFCE7', fg: '#166534' },
  EXCUSED: { label: 'Excused', bg: '#DBEAFE', fg: '#1E40AF' },
  ABSENT: { label: 'Missed', bg: '#FEE2E2', fg: '#991B1B' },
  NONE: { label: 'Missed', bg: '#FEE2E2', fg: '#991B1B' },
}

/**
 * A Fellowship member (2026-10-24): how to reach them, how often they come to
 * each meeting the viewer can see, their follow-ups and who follows them up.
 */
export default async function MemberPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const { student: base, meetings, past, readable } = await requireMemberRead(user, params.id)
  const today = churchToday()
  const s = (await prisma.student.findUnique({
    where: { id: base.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      notes: true,
      classId: true,
      createdAt: true,
      memberships: { select: { classId: true, addedAt: true } },
      account: {
        select: {
          id: true,
          role: true,
          phone: true,
          email: true,
          photo: true,
          servant: { select: { classes: { select: { class: { select: { name: true, sortOrder: true } } } } } },
        },
      },
    },
  }))!
  const name = studentName(s)
  const isServant = s.account.role === 'SERVANT'
  const fellowship = (id: string) => ({ classId: id, classStage: 'FELLOWSHIP' as const })
  const writable = readable.filter((m) => can(user, 'student.write', fellowship(m.id)))
  const canEdit = !isServant && writable.length > 0
  // Someone who left a meeting can be added back to it (2026-10-24).
  const current = new Set(meetings.map((m) => m.id))
  const removable = writable.filter((m) => current.has(m.id))
  const addBack = writable.filter((m) => !current.has(m.id))
  const followable = readable.filter((m) => can(user, 'followup.write', fellowship(m.id)))
  const home = s.classId ? meetings.find((m) => m.id === s.classId) ?? null : null
  const canCheckIn = !!home && can(user, 'followup.write', fellowship(home.id))
  const serves = (s.account.servant?.classes ?? []).slice().sort((a, b) => a.class.sortOrder - b.class.sortOrder).map((c) => c.class.name)

  // Each meeting the viewer can see: its latest meetings and this member's marks.
  const perMeeting = await Promise.all(
    readable.map(async (m) => {
      const key = meetingSessionKey(m.id)
      // Only meetings held since they joined this one: an earlier one was not
      // theirs to miss.
      const joined = s.classId === m.id ? s.createdAt : (s.memberships.find((x) => x.classId === m.id)?.addedAt ?? s.createdAt)
      const since = toUTCDate(churchToday(joined))
      const recent = await prisma.$queryRaw<{ date: Date }[]>`
        SELECT DISTINCT "date" FROM "AttendanceRecord"
        WHERE "classId" = ${m.id} AND "sessionKey" = ${key} AND "date" >= ${since}
        ORDER BY "date" DESC
        LIMIT ${SHOWN}
      `
      const dates = recent.map((r) => formatDateOnly(r.date))
      const rows = dates.length
        ? await prisma.attendanceRecord.findMany({
            where: { studentId: s.id, classId: m.id, sessionKey: key, date: { in: dates.map((d) => toUTCDate(d)) } },
            select: { date: true, status: true },
          })
        : []
      const marks = rows.map((r) => ({ studentId: s.id, date: formatDateOnly(r.date), sessionKey: key, status: r.status }))
      const occasions = heldOccasions(dates.map((date) => ({ date, sessionKey: key })))
      const byDate = new Map(marks.map((r) => [r.date, r.status]))
      return {
        meeting: m,
        key,
        dates,
        byDate,
        rate: attendanceRate(marks, { occasions, studentIds: [s.id] }).rate,
        streak: presentStreak(marks.map((r) => ({ date: r.date, status: r.status }))),
      }
    }),
  )

  const readableIds = readable.map((m) => m.id)
  const [cases, contactLog, excusesMap, groups] = await Promise.all([
    prisma.followUpCase.findMany({
      where: { studentId: s.id, classId: { in: readableIds } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 10,
      select: { id: true, title: true, status: true, classId: true },
    }),
    prisma.followUpLog.findMany({
      where: { studentId: s.id, OR: [{ caseId: null }, { case: { classId: { in: readableIds } } }] },
      orderBy: { at: 'desc' },
      take: 10,
      select: {
        id: true, method: true, result: true, note: true, at: true, caseId: true, byId: true,
        case: { select: { classId: true } }, by: { select: { displayName: true, servant: { select: { id: true } } } },
        groupServantId: true, groupServant: { select: { account: { select: { displayName: true } } } },
      },
    }),
    excusesByStudent([s.id]),
    home && readableIds.includes(home.id) ? loadClassGroups([home.id]) : Promise.resolve([]),
  ])
  const excuses = excusesMap.get(s.id) ?? []
  const excusesToShow = excuses.filter((e) => excuseState(e, today) !== 'past')
  const pastExcuses = excuses.filter((e) => excuseState(e, today) === 'past')
  const canExcuse = followable.length > 0

  const myGroup = groups[0] ?? null
  const active = new Set(myGroup?.servants.map((sv) => sv.id) ?? [])
  const groupOwner = myGroup ? effectiveServant(myGroup.kids.find((k) => k.id === s.id)?.groupServantId ?? null, active) : null
  const groupOwnerName = groupOwner ? myGroup!.servants.find((sv) => sv.id === groupOwner)?.name ?? null : null
  const canManageGroups = !!home && can(user, 'group.manage', fellowship(home.id))

  // Notes this viewer may still fix, as on a child's page.
  const changeable = new Map<string, string>()
  for (const l of contactLog) {
    const classId = l.case?.classId ?? s.classId
    if (!classId) continue
    const ok = mayChangeContactNote({
      method: l.method,
      writtenByMe: l.byId === user.accountId,
      canWrite: can(user, 'followup.write', fellowship(classId)),
      canManage: can(user, 'group.manage', fellowship(classId)),
    })
    if (ok) changeable.set(l.id, classId)
  }
  const moveTargets = new Map<string, Array<{ id: string; name: string }>>()
  for (const classId of Array.from(new Set(changeable.values()))) {
    const others = await prisma.student.findMany({
      where: { AND: [rosterWhere(classId), { id: { not: s.id } }] },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    })
    moveTargets.set(classId, others.map((o) => ({ id: o.id, name: studentName(o) })))
  }

  const back = readable[0]!

  return (
    <>
      <PageHeader
        eyebrow={`${STAGE_LABEL.FELLOWSHIP} member`}
        title={name}
        subtitle={[
          ...meetings.map((m) => m.name),
          ...past.filter((m) => readable.some((r) => r.id === m.id)).map((m) => `left ${m.name}`),
        ].join(' · ')}
        back={{ href: `/portal/classes/${back.id}`, label: back.name }}
        icon={<Avatar name={name} photo={s.account.photo} size="sm" />}
        actions={
          <>
            {canEdit && (
              <LinkButton href={`/portal/members/${s.id}/edit`} variant="secondary">
                <Pencil className="h-4 w-4" aria-hidden /> Edit details
              </LinkButton>
            )}
            {removable.map((m) => (
              <RemoveFromMeeting key={m.id} classId={m.id} meetingName={m.name} studentId={s.id} name={s.firstName} />
            ))}
            {addBack.map((m) => (
              <AddBackButton key={m.id} classId={m.id} studentId={s.id} name={name} label={`Add back to ${m.name}`} />
            ))}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {perMeeting.map((pm) => (
            <Card
              key={pm.meeting.id}
              title={`${pm.meeting.name} attendance`}
              icon={<CalendarCheck className="h-[15px] w-[15px]" />}
              action={
                pm.rate === null ? <Badge tone="neutral">No meetings yet</Badge> : <Badge tone={pm.rate >= 85 ? 'good' : pm.rate >= 60 ? 'warn' : 'bad'}>{pm.rate}%</Badge>
              }
            >
              {pm.dates.length === 0 ? (
                <p className="text-[12.5px] text-parch-500">{pm.meeting.name} hasn&rsquo;t taken attendance yet.</p>
              ) : (
                <>
                  <p className="mb-2.5 text-[12px] text-parch-600">
                    The last {pm.dates.length} meeting{pm.dates.length === 1 ? '' : 's'}
                    {pm.streak >= 2 ? ` · ${pm.streak} in a row` : ''}
                  </p>
                  <ul className="flex flex-wrap gap-1.5" data-testid="member-marks">
                    {pm.dates.map((d) => {
                      const mark = MARK[pm.byDate.get(d) ?? 'NONE']
                      return (
                        <li key={d}>
                          <Link
                            href={`/portal/classes/${pm.meeting.id}/attendance?session=${pm.key}&date=${d}`}
                            className="inline-flex flex-col items-center rounded-[10px] px-2.5 py-1.5 text-center"
                            style={{ background: mark.bg, color: mark.fg }}
                          >
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.6px]">{formatShortDate(d)}</span>
                            <span className="text-[11.5px] font-semibold">{mark.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </Card>
          ))}

          {cases.length > 0 && (
            <Card title="Follow-up cases" icon={<HeartHandshake className="h-[15px] w-[15px]" />}>
              <ul className="space-y-2 text-[12.5px]">
                {cases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/portal/follow-ups/${c.id}`} className="truncate text-parch-800 underline-offset-2 hover:text-brand-800 hover:underline">
                      {c.title}
                      {meetings.length > 1 && <span className="text-parch-500"> · {meetings.find((m) => m.id === c.classId)?.name}</span>}
                    </Link>
                    <Badge tone={c.status === 'OPEN' ? 'bad' : 'neutral'}>{c.status === 'OPEN' ? 'Open' : 'Done'}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Contact" icon={<User className="h-[15px] w-[15px]" />}>
            <dl className="space-y-2.5 text-[12.5px]">
              {isServant && (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Serves</dt>
                  <dd className="text-parch-800">{serves.length ? serves.join(', ') : 'A servant'}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Phone</dt>
                <dd>
                  <MemberPhone name={name} phone={s.account.phone} full />
                </dd>
              </div>
              {s.account.email && (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Email</dt>
                  <dd>
                    <a href={`mailto:${s.account.email}`} className="font-semibold text-brand-800 underline decoration-brand-gold underline-offset-2">
                      {s.account.email}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Birthday</dt>
                <dd className="text-parch-800">
                  {s.dob ? `${formatMonthDay(formatDateOnly(s.dob))} (age ${ageOn(formatDateOnly(s.dob), today)})` : 'Not on file'}
                </dd>
              </div>
              {s.notes && (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Note</dt>
                  <dd className="whitespace-pre-wrap text-parch-800">{s.notes}</dd>
                </div>
              )}
            </dl>
            {isServant && (
              <p className="mt-3 border-t border-[#F5F2ED] pt-2.5 text-[11.5px] text-parch-500">
                A servant&rsquo;s name, phone and birthday come from their servant profile, which the admin keeps.
              </p>
            )}
          </Card>

          {(canExcuse || excuses.length > 0) && (
            <Card title="Excused from follow-up" icon={<CalendarOff className="h-[15px] w-[15px]" />}>
              <div className="space-y-2.5" data-testid="excuse-card">
                {excusesToShow.length === 0 && (
                  <p className="text-[12px] text-parch-500">
                    Not excused. If they are away for a while — travelling, ill, a family matter — excuse them and nobody
                    has to follow them up until they are back.
                  </p>
                )}
                {excusesToShow.map((e) => (
                  <div key={e.id} className="space-y-1.5">
                    <ExcuseNote excuse={e} today={today} />
                    {canExcuse && <ExcuseControl studentId={s.id} studentName={name} today={today} excuse={e} />}
                  </div>
                ))}
                {canExcuse && (
                  <div className={excusesToShow.length > 0 ? 'border-t border-[#F5F2ED] pt-2.5' : undefined}>
                    <ExcuseControl studentId={s.id} studentName={name} today={today} />
                  </div>
                )}
                {pastExcuses.length > 0 && (
                  <details className="group border-t border-[#F5F2ED] pt-2">
                    <summary className="cursor-pointer list-none text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500 [&::-webkit-details-marker]:hidden">
                      Past excuses ({pastExcuses.length})
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {pastExcuses.map((e) => (
                        <ExcuseNote key={e.id} excuse={e} today={today} />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </Card>
          )}

          <Card title="Group & contacts" icon={<HeartHandshake className="h-[15px] w-[15px]" />}>
            {home && readableIds.includes(home.id) && (
              <p className="text-[12.5px] text-parch-800" data-testid="member-group">
                {groupOwnerName ? (
                  <>
                    Followed up by <strong>{groupOwnerName}</strong> in {home.name}
                  </>
                ) : (
                  <Badge tone="warn">No servant yet</Badge>
                )}
              </p>
            )}
            {canManageGroups && myGroup && myGroup.servants.length > 0 && <GroupPicker studentId={s.id} current={groupOwner} servants={myGroup.servants} />}
            {canCheckIn && (
              <div className="mt-3">
                <CheckInButton studentId={s.id} studentName={name} />
              </div>
            )}
            <div className="mt-3 border-t border-[#F5F2ED] pt-2.5">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-parch-500">Contact history</p>
              {contactLog.length === 0 ? (
                <p className="text-[12px] text-parch-500">Nobody has logged a call, text or visit yet.</p>
              ) : (
                <ul className="space-y-2" data-testid="contact-history">
                  {contactLog.map((l) => (
                    <li key={l.id} className="text-[12px] text-parch-800">
                      <span className="font-semibold">{contactMethodLabel(l.method)}</span>
                      {contactResultLabel(l.result) ? ` · ${contactResultLabel(l.result)}` : ''}
                      <span className="text-parch-500">
                        {' '}
                        · {formatMonthDay(churchToday(l.at))}
                        {l.by ? ` · ${l.by.displayName}` : ''}
                        {(() => {
                          const forGroup = writtenForGroupOf({
                            groupServantId: l.groupServantId,
                            groupServantName: l.groupServant?.account.displayName ?? null,
                            byServantId: l.by?.servant?.id ?? null,
                          })
                          return forGroup ? ` · for ${forGroup}’s group` : ''
                        })()}
                      </span>
                      {l.caseId && (
                        <Link href={`/portal/follow-ups/${l.caseId}`} className="ml-1 text-[11px] font-bold text-brand-800 underline decoration-brand-gold underline-offset-2">
                          case
                        </Link>
                      )}
                      {l.note && <p className="text-[11.5px] text-parch-600">{l.note}</p>}
                      {changeable.has(l.id) && (
                        <ContactNoteActions
                          note={{ id: l.id, method: l.method, result: l.result, note: l.note }}
                          childName={name}
                          moveTo={moveTargets.get(changeable.get(l.id)!) ?? []}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {meetings.length > readable.length && (
            <p className="text-[11.5px] text-parch-500">
              Also in {meetings.filter((m) => !readableIds.includes(m.id)).map((m) => m.name).join(', ')}, which you don&rsquo;t serve.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
