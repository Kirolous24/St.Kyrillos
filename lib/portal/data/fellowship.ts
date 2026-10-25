import type { Prisma } from '@prisma/client'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  ALREADY_MEMBER,
  isFellowship,
  joinPlan,
  leavePlan,
  meetingSessionKey,
  memberLoginId,
  type Addable,
  type JoinPlan,
  type LeavePlan,
  type MemberExportRow,
  type MemberValue,
  type PersonState,
} from '../fellowship'
import { splitName } from '../names'
import { formatDateOnly, toUTCDate } from '../dates'
import { PortalError } from '../action-result'
import { studentName } from './students'
import { noSignInPinFields } from '../pin-issue'
import { rosterWhere } from '../class-members'
import { can, type PortalUser } from '../permissions'
import { listVisibleClasses } from './classes'
import { followUpCaseWhere } from './groups'
import { dueCaseWhere } from './excuses'
import { churchToday } from '../dates'

type Db = Prisma.TransactionClient | typeof prisma

/**
 * A Fellowship meeting's own register (2026-10-24): one session that only this
 * meeting holds, named after it, worth no points. Created with the meeting and
 * renamed with it; switching it off stays the admin's, in Sessions & Points.
 */
export async function ensureMeetingSession(db: Db, cls: { id: string; name: string }): Promise<void> {
  const key = meetingSessionKey(cls.id)
  await db.attendanceSession.upsert({
    where: { key },
    create: { key, label: cls.name, points: 0, icon: null, sortOrder: 1000, isActive: true, classId: cls.id },
    update: { label: cls.name },
  })
}

/* ── Who someone is, for joining and leaving ────────────────────────────── */

const personSelect = {
  id: true,
  role: true,
  displayName: true,
  servant: { select: { id: true, birthday: true, classes: { select: { classId: true } } } },
  student: {
    select: {
      id: true,
      classId: true,
      memberships: { select: { classId: true, class: { select: { stage: true } } } },
    },
  },
} satisfies Prisma.AccountSelect

type PersonRow = Prisma.AccountGetPayload<{ select: typeof personSelect }>

function stateOf(a: PersonRow): PersonState {
  return {
    role: a.role,
    serves: a.servant?.classes.map((c) => c.classId) ?? [],
    student: a.student
      ? {
          id: a.student.id,
          classId: a.student.classId,
          // Only Fellowship meetings: a servant who grew up here may still carry
          // a Pre-Servants row from their teens.
          memberOf: a.student.memberships.filter((m) => isFellowship(m.class.stage)).map((m) => m.classId),
        }
      : null,
  }
}

export type PersonRef = { kind: 'servant'; id: string } | { kind: 'member'; id: string }

async function loadPerson(db: Db, ref: PersonRef): Promise<PersonRow> {
  const account =
    ref.kind === 'servant'
      ? (await db.servant.findUnique({ where: { id: ref.id }, select: { account: { select: personSelect } } }))?.account
      : (await db.student.findUnique({ where: { id: ref.id }, select: { account: { select: personSelect } } }))?.account
  if (!account) throw new PortalError('That person is no longer in the portal.')
  return account
}

/**
 * A servant's member side carries their name and birthday as the servant
 * profile has them, so editing the servant edits the member too. Only while it
 * is a member: a servant who grew up here keeps their childhood record as it was.
 */
export async function syncMemberFromServant(db: Db, accountId: string): Promise<void> {
  const a = await db.account.findUnique({
    where: { id: accountId },
    select: {
      displayName: true,
      servant: { select: { birthday: true } },
      student: {
        select: {
          id: true,
          class: { select: { stage: true } },
          memberships: { select: { class: { select: { stage: true } } } },
        },
      },
    },
  })
  if (!a?.servant || !a.student) return
  const inMeeting = isFellowship(a.student.class?.stage) || a.student.memberships.some((m) => isFellowship(m.class.stage))
  if (!inMeeting) return
  const { firstName, lastName } = splitName(a.displayName)
  await db.student.update({
    where: { id: a.student.id },
    data: { firstName, lastName, ...(a.servant.birthday ? { dob: a.servant.birthday } : {}) },
  })
}

/**
 * A meeting's servant is not also its member (the user, 2026-10-24): refuse to
 * make someone the servant of a meeting they are a member of.
 */
export async function assertNotMemberOf(db: Db, accountId: string, classIds: readonly string[], name: string): Promise<void> {
  if (classIds.length === 0) return
  const s = await db.account.findUnique({
    where: { id: accountId },
    select: {
      student: {
        select: {
          classId: true,
          class: { select: { name: true, stage: true } },
          memberships: { select: { classId: true, class: { select: { name: true, stage: true } } } },
        },
      },
    },
  })
  const st = s?.student
  if (!st) return
  const memberOf = [
    ...(st.classId && st.class && isFellowship(st.class.stage) ? [{ id: st.classId, name: st.class.name }] : []),
    ...st.memberships.filter((m) => isFellowship(m.class.stage)).map((m) => ({ id: m.classId, name: m.class.name })),
  ]
  const clash = memberOf.find((m) => classIds.includes(m.id))
  if (clash) throw new PortalError(`${name} is a member of ${clash.name}. Take them off its members first, or leave ${clash.name} unticked.`)
}

export interface JoinResult {
  studentId: string
  name: string
  plan: Exclude<JoinPlan['kind'], 'refuse'>
}

/**
 * Add someone already in the portal to a meeting: a servant (their one login
 * gains a member side) or a member of another meeting. Refusals are the rules
 * of `joinPlan`. Group placement is the caller's, outside any transaction.
 */
export async function joinMeeting(db: Db, meeting: { id: string; name: string }, ref: PersonRef, by: string): Promise<JoinResult> {
  const person = await loadPerson(db, ref)
  const plan = joinPlan(stateOf(person), meeting)
  if (plan.kind === 'refuse') throw new PortalError(plan.reason)
  const name = person.displayName
  if (plan.kind === 'already') return { studentId: person.student!.id, name, plan: 'already' }
  if (plan.kind === 'add-member') {
    await db.classMember.create({ data: { classId: meeting.id, studentId: person.student!.id, addedById: by } })
    return { studentId: person.student!.id, name, plan: 'add-member' }
  }
  const { firstName, lastName } = splitName(person.displayName)
  const dob = person.servant?.birthday ?? undefined
  if (plan.kind === 'create-home') {
    const created = await db.student.create({
      data: { accountId: person.id, firstName, lastName: lastName || '', dob: dob ?? null, classId: meeting.id },
      select: { id: true },
    })
    return { studentId: created.id, name, plan: 'create-home' }
  }
  // set-home: their record comes to this meeting. A servant's name and birthday
  // come along from the servant profile.
  await db.student.update({
    where: { id: person.student!.id },
    data: {
      classId: meeting.id,
      groupServantId: null,
      groupAssignedAt: null,
      ...(person.servant ? { firstName, lastName: lastName || '', ...(dob ? { dob } : {}) } : {}),
    },
  })
  return { studentId: person.student!.id, name, plan: 'set-home' }
}

/** A member who does not serve: an account that never signs in, and their record. */
export async function createMember(db: Db, meeting: { id: string }, value: MemberValue): Promise<{ studentId: string; accountId: string }> {
  const created = await db.account.create({
    data: {
      loginId: memberLoginId(),
      ...noSignInPinFields(),
      role: 'MEMBER',
      displayName: studentName(value),
      phone: value.phone,
      email: value.email,
      student: {
        create: {
          firstName: value.firstName,
          lastName: value.lastName,
          dob: value.dob ? toUTCDate(value.dob) : null,
          notes: value.note,
          classId: meeting.id,
        },
      },
    },
    select: { id: true, student: { select: { id: true } } },
  })
  return { studentId: created.student!.id, accountId: created.id }
}

export interface LeaveResult {
  plan: Exclude<LeavePlan['kind'], 'not-member'>
  name: string
  newHome?: string
}

/**
 * Take someone out of a meeting (the rules are `leavePlan`). Their open
 * follow-up cases in that meeting close, since nobody owes those calls now.
 */
export async function leaveMeeting(db: Db, meeting: { id: string; name: string }, studentId: string, by: string): Promise<LeaveResult> {
  const person = await loadPerson(db, { kind: 'member', id: studentId })
  const plan = leavePlan(stateOf(person), meeting.id)
  if (plan.kind === 'not-member') throw new PortalError(`They are not in ${meeting.name}.`)
  const name = person.displayName
  await db.followUpCase.updateMany({
    where: { studentId, classId: meeting.id, status: 'OPEN' },
    data: { status: 'DONE', resolvedAt: new Date(), resolvedById: by, resolveReason: 'other', resolveNote: `No longer in ${meeting.name}` },
  })
  if (plan.kind === 'drop-membership') {
    await db.classMember.delete({ where: { classId_studentId: { classId: meeting.id, studentId } } })
    return { plan: 'drop-membership', name }
  }
  if (plan.kind === 'promote') {
    await db.classMember.delete({ where: { classId_studentId: { classId: plan.newHome, studentId } } })
    await db.student.update({ where: { id: studentId }, data: { classId: plan.newHome, groupServantId: null, groupAssignedAt: null } })
    return { plan: 'promote', name, newHome: plan.newHome }
  }
  await db.student.update({ where: { id: studentId }, data: { classId: null, groupServantId: null, groupAssignedAt: null } })
  return { plan: 'clear-home', name }
}

/* ── Everyone who could be added ────────────────────────────────────────── */


/**
 * Every servant and every Fellowship member, as someone a meeting could add.
 * A servant who is also a member shows once, as a servant. Children never
 * appear: they are not members.
 */
export async function knownPeople(meetingId?: string): Promise<Addable[]> {
  const [servants, members, meetings] = await Promise.all([
    prisma.servant.findMany({
      // Serving now: a deactivated servant has left (2026-10-24).
      where: { account: { role: 'SERVANT', isActive: true } },
      select: {
        id: true,
        birthday: true,
        classes: { select: { classId: true, class: { select: { name: true, sortOrder: true } } } },
        account: {
          select: {
            displayName: true,
            phone: true,
            student: { select: { classId: true, memberships: { select: { classId: true } } } },
          },
        },
      },
    }),
    // Every member who does not serve, those who left included: adding one
    // back brings their history with them (2026-10-24).
    prisma.student.findMany({
      where: { account: { role: 'MEMBER' } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        classId: true,
        memberships: { select: { classId: true } },
        account: { select: { phone: true } },
      },
    }),
    prisma.schoolClass.findMany({ where: { stage: 'FELLOWSHIP' }, select: { id: true, name: true } }),
  ])
  const meetingName = new Map(meetings.map((m) => [m.id, m.name]))
  const inMeetings = (classId: string | null, memberOf: ReadonlyArray<{ classId: string }>) =>
    [classId, ...memberOf.map((m) => m.classId)].filter((id): id is string => !!id && meetingName.has(id))
  const end = (phone: string | null) => (phone && phone.length >= 4 ? phone.slice(-4) : null)

  const out: Addable[] = []
  for (const s of servants) {
    const { firstName, lastName } = splitName(s.account.displayName)
    const serves = s.classes.slice().sort((a, b) => a.class.sortOrder - b.class.sortOrder)
    const memberOf = s.account.student ? inMeetings(s.account.student.classId, s.account.student.memberships) : []
    const blocked = !meetingId
      ? null
      : serves.some((c) => c.classId === meetingId)
        ? `Serves ${meetingName.get(meetingId) ?? 'this meeting'}`
        : memberOf.includes(meetingId)
          ? ALREADY_MEMBER
          : null
    out.push({
      kind: 'servant',
      id: s.id,
      name: s.account.displayName,
      firstName,
      lastName,
      dob: s.birthday ? formatDateOnly(s.birthday) : null,
      phoneEnd: end(s.account.phone),
      where: [
        serves.length ? `Servant · ${serves.map((c) => c.class.name).join(', ')}` : 'Servant',
        ...memberOf.filter((id) => id !== meetingId).map((id) => `also in ${meetingName.get(id)}`),
      ].join(' · '),
      blocked,
    })
  }
  for (const m of members) {
    const memberOf = inMeetings(m.classId, m.memberships)
    out.push({
      kind: 'member',
      id: m.id,
      name: studentName(m),
      firstName: m.firstName,
      lastName: m.lastName,
      dob: m.dob ? formatDateOnly(m.dob) : null,
      phoneEnd: end(m.account.phone),
      where: memberOf.length ? `Member · ${memberOf.map((id) => meetingName.get(id)).join(', ')}` : 'Former member',
      blocked: meetingId && memberOf.includes(meetingId) ? ALREADY_MEMBER : null,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * A meeting's members for the export: their details, what they serve, their
 * other meetings, and how many of the meeting's latest `recent` meetings they
 * came to.
 */
export async function meetingExportRows(classId: string, recent = 8): Promise<MemberExportRow[]> {
  const sessionKey = meetingSessionKey(classId)
  const [members, recentDates] = await Promise.all([
    prisma.student.findMany({
      where: rosterWhere(classId),
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        notes: true,
        classId: true,
        createdAt: true,
        class: { select: { name: true, stage: true } },
        memberships: { select: { classId: true, addedAt: true, class: { select: { name: true, stage: true } } } },
        account: {
          select: {
            phone: true,
            email: true,
            servant: { select: { classes: { select: { class: { select: { name: true, sortOrder: true } } } } } },
          },
        },
      },
    }),
    prisma.$queryRaw<{ date: Date }[]>`
      SELECT DISTINCT "date" FROM "AttendanceRecord"
      WHERE "classId" = ${classId} AND "sessionKey" = ${sessionKey}
      ORDER BY "date" DESC
      LIMIT ${recent}
    `,
  ])
  const dates = recentDates.map((r) => r.date)
  const present = dates.length
    ? await prisma.attendanceRecord.groupBy({
        by: ['studentId'],
        where: { classId, sessionKey, status: 'PRESENT', date: { in: dates } },
        _count: { _all: true },
      })
    : []
  const presentOf = new Map(present.map((p) => [p.studentId, p._count._all]))
  return members.map((m) => {
    const joined = m.classId === classId ? m.createdAt : (m.memberships.find((x) => x.classId === classId)?.addedAt ?? m.createdAt)
    const others = [
      ...(m.classId && m.classId !== classId && isFellowship(m.class?.stage) ? [m.class!.name] : []),
      ...m.memberships.filter((x) => x.classId !== classId && isFellowship(x.class.stage)).map((x) => x.class.name),
    ]
    return {
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.account.phone,
      email: m.account.email,
      dob: m.dob ? formatDateOnly(m.dob) : null,
      note: m.notes,
      serves: (m.account.servant?.classes ?? []).slice().sort((a, b) => a.class.sortOrder - b.class.sortOrder).map((c) => c.class.name),
      otherMeetings: others,
      memberSince: formatDateOnly(joined),
      attended: presentOf.get(m.id) ?? 0,
      held: dates.length,
    }
  })
}

/**
 * A Fellowship member's page, for someone who may read one of their meetings:
 * its servants, the Fellowship overseer, the admin and the pastor (the user's
 * rule, 2026-10-24). A servant who is a member is not shown to the people they
 * serve a children's class with. Someone who left keeps their record (the
 * user, 2026-10-24), so the meetings they came to (`past`, from their
 * attendance) still open their page. 404 otherwise. `readable` is the current
 * and past meetings this viewer may see them in.
 */
export async function requireMemberRead(user: PortalUser, studentId: string) {
  if (user.role === 'STUDENT') notFound()
  const s = await prisma.student.findUnique({
    where: { id: String(studentId ?? '') },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      classId: true,
      class: { select: { id: true, name: true, stage: true } },
      memberships: { select: { classId: true, class: { select: { id: true, name: true, stage: true } } } },
      account: { select: { role: true } },
    },
  })
  if (!s || s.account.role === 'STUDENT') notFound()
  const meetings = [
    ...(s.class && isFellowship(s.class.stage) ? [{ id: s.class.id, name: s.class.name }] : []),
    ...s.memberships.filter((m) => isFellowship(m.class.stage)).map((m) => ({ id: m.class.id, name: m.class.name })),
  ]
  const attended = await prisma.attendanceRecord.findMany({
    where: { studentId: s.id, class: { stage: 'FELLOWSHIP' } },
    distinct: ['classId'],
    select: { classId: true, class: { select: { id: true, name: true, stage: true } } },
  })
  const past = attended
    .filter((a) => isFellowship(a.class.stage) && !meetings.some((m) => m.id === a.classId))
    .map((a) => ({ id: a.class.id, name: a.class.name }))
  if (meetings.length === 0 && past.length === 0) notFound()
  const everything = user.role === 'ADMIN' || user.role === 'PASTOR'
  const all = [...meetings, ...past]
  const readable = everything ? all : all.filter((m) => can(user, 'student.read', { classId: m.id, classStage: 'FELLOWSHIP' }))
  if (readable.length === 0) notFound()
  return { student: s, meetings, past, readable }
}

/** A Fellowship meeting on the dashboard (2026-10-24). */
export interface MeetingTile {
  id: string
  name: string
  photo: string | null
  sortOrder: number
  description: string | null
  members: number
  servants: number
  /** The latest meeting with a register, and how many were there. */
  last: { date: string; here: number } | null
  /** Follow-ups this viewer owes, scoped as their Follow-ups page is. */
  openCases: number
  canWrite: boolean
}

/** The Fellowship meetings this person may open, for the dashboard. */
export async function fellowshipOverview(user: PortalUser): Promise<MeetingTile[]> {
  const meetings = await listVisibleClasses(user, { fellowship: 'only' })
  if (meetings.length === 0) return []
  const ids = meetings.map((m) => m.id)
  const today = churchToday()
  const scope = await followUpCaseWhere(user, meetings)
  const [open, lastDates] = await Promise.all([
    prisma.followUpCase.groupBy({
      by: ['classId'],
      where: { AND: [scope, { status: 'OPEN', classId: { in: ids } }, dueCaseWhere(today)] },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['classId'],
      where: { classId: { in: ids }, sessionKey: { in: ids.map(meetingSessionKey) } },
      _max: { date: true },
    }),
  ])
  const openOf = new Map(open.map((o) => [o.classId, o._count._all]))
  const lastOf = new Map(lastDates.map((r) => [r.classId, r._max.date]))
  const here = new Map(
    await Promise.all(
      ids.map(async (id) => {
        const date = lastOf.get(id)
        const n = date
          ? await prisma.attendanceRecord.count({ where: { classId: id, sessionKey: meetingSessionKey(id), date, status: 'PRESENT' } })
          : 0
        return [id, n] as const
      }),
    ),
  )
  return meetings.map((m) => {
    const date = lastOf.get(m.id)
    return {
      id: m.id,
      name: m.name,
      photo: m.photo,
      sortOrder: m.sortOrder,
      description: m.description,
      members: m.studentCount + m.memberCount,
      servants: m.servantCount,
      last: date ? { date: formatDateOnly(date), here: here.get(m.id) ?? 0 } : null,
      openCases: openOf.get(m.id) ?? 0,
      canWrite: can(user, 'attendance.write', { classId: m.id, classStage: 'FELLOWSHIP' }),
    }
  })
}

/** Someone who came to this meeting and is no longer in it (2026-10-24). */
export interface FormerMember {
  id: string
  name: string
  /** The last meeting they were marked for here, YYYY-MM-DD. */
  lastMarked: string
  servant: boolean
  /** Where they are now, if anywhere. */
  now: string | null
}

/**
 * People who left a meeting: everyone with attendance in it who is not on its
 * list now. Their records stay, so this is how a meeting finds them again.
 */
export async function formerMembers(classId: string, roster: readonly string[]): Promise<FormerMember[]> {
  const gone = await prisma.attendanceRecord.groupBy({
    by: ['studentId'],
    where: { classId, studentId: { notIn: [...roster] } },
    _max: { date: true },
  })
  if (gone.length === 0) return []
  const people = await prisma.student.findMany({
    where: { id: { in: gone.map((g) => g.studentId) }, account: { role: { not: 'STUDENT' } } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      class: { select: { name: true, stage: true } },
      memberships: { select: { class: { select: { name: true, stage: true } } } },
      account: { select: { role: true } },
    },
  })
  const last = new Map(gone.map((g) => [g.studentId, g._max.date]))
  return people
    .map((p) => {
      const meetings = [
        ...(p.class && isFellowship(p.class.stage) ? [p.class.name] : []),
        ...p.memberships.filter((m) => isFellowship(m.class.stage)).map((m) => m.class.name),
      ]
      const lastDate = last.get(p.id)
      return {
        id: p.id,
        name: studentName(p),
        lastMarked: lastDate ? formatDateOnly(lastDate) : '',
        servant: p.account.role === 'SERVANT',
        now: meetings.length ? meetings.join(', ') : null,
      }
    })
    .sort((a, b) => (a.lastMarked < b.lastMarked ? 1 : a.lastMarked > b.lastMarked ? -1 : a.name.localeCompare(b.name)))
}
