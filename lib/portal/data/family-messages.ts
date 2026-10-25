import { prisma } from '@/lib/prisma'
import { registerWhere, type SessionScope } from '../class-members'
import { churchToday, formatDateOnly, sundayOnOrBefore, toUTCDate } from '../dates'
import { STANDARD_MESSAGE, excuseForMeeting, messagingOrder, missedRegister, sentTo } from '../family-messages'
import { MEMBER_MESSAGE, isFellowship } from '../fellowship'
import { formatDateTime } from '../format'
import { kidPhoneList, type KidPhone } from '../phones'
import { excusesByStudent, type ExcuseView } from './excuses'
import { studentName } from './students'

/**
 * Reads behind Message families (2026-10-19, lib/portal/family-messages.ts):
 * a class's message for a meeting, who missed a register, and which of their
 * families have already been sent theirs.
 */

export interface SavedMessage {
  body: string
  /** True while the class has not written its own. */
  isStandard: boolean
  by: string | null
  /** The church day it was last changed, YYYY-MM-DD. */
  day: string | null
}

/**
 * The class's message for a meeting, or the standard one: to the family for a
 * class, to the member for a Fellowship meeting (2026-10-24).
 */
export async function meetingMessage(classId: string, sessionKey: string, standard: string = STANDARD_MESSAGE): Promise<SavedMessage> {
  const saved = await prisma.meetingMessage.findUnique({
    where: { classId_sessionKey: { classId, sessionKey } },
    select: { body: true, updatedAt: true, updatedBy: { select: { displayName: true } } },
  })
  return saved
    ? { body: saved.body, isStandard: false, by: saved.updatedBy?.displayName ?? null, day: churchToday(saved.updatedAt) }
    : { body: standard, isStandard: true, by: null, day: null }
}

export interface CaseMessage {
  body: string
  meeting: string
  /** The day it is about: the last Sunday, or the class's last own meeting. */
  date: string
}

/**
 * What a follow-up case's composer starts from, per class: the class's message
 * for the meeting its cases are about. That is Sunday School, or the class's own
 * meeting for a class like Pre-Servants, whose cases are about that.
 */
export async function caseMessages(classIds: readonly string[], today: string): Promise<Map<string, CaseMessage>> {
  const out = new Map<string, CaseMessage>()
  if (classIds.length === 0) return out
  const ids = [...classIds]
  const [own, sunday, stages] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { classId: { in: ids }, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: { key: true, label: true, classId: true },
    }),
    prisma.attendanceSession.findUnique({ where: { key: 'sunday' }, select: { label: true } }),
    // A Fellowship meeting's standard message is to the member (2026-10-24).
    prisma.schoolClass.findMany({ where: { id: { in: ids } }, select: { id: true, stage: true } }),
  ])
  const meetingIds = new Set(stages.filter((c) => isFellowship(c.stage)).map((c) => c.id))
  const meetingOf = new Map<string, { key: string; label: string }>()
  for (const id of ids) {
    const mine = own.find((s) => s.classId === id)
    meetingOf.set(id, mine ? { key: mine.key, label: mine.label } : { key: 'sunday', label: sunday?.label ?? 'Sunday School' })
  }
  const [saved, lastOwn] = await Promise.all([
    prisma.meetingMessage.findMany({
      where: { OR: ids.map((id) => ({ classId: id, sessionKey: meetingOf.get(id)!.key })) },
      select: { classId: true, body: true },
    }),
    Promise.all(
      own.length
        ? ids
            .filter((id) => meetingOf.get(id)!.key !== 'sunday')
            .map(async (id) => [id, await latestRegister(id, [meetingOf.get(id)!.key], today)] as const)
        : [],
    ),
  ])
  const bodyOf = new Map(saved.map((s) => [s.classId, s.body]))
  const lastOf = new Map(lastOwn.map(([id, reg]) => [id, reg?.date ?? null]))
  for (const id of ids) {
    const meeting = meetingOf.get(id)!
    out.set(id, {
      body: bodyOf.get(id) ?? (meetingIds.has(id) ? MEMBER_MESSAGE : STANDARD_MESSAGE),
      meeting: meeting.label,
      date: meeting.key === 'sunday' ? sundayOnOrBefore(today) : (lastOf.get(id) ?? today),
    })
  }
  return out
}

/** The class's most recent register on or before a day, among these meetings. */
export async function latestRegister(
  classId: string,
  sessionKeys: readonly string[],
  onOrBefore: string,
): Promise<{ sessionKey: string; date: string } | null> {
  if (sessionKeys.length === 0) return null
  const row = await prisma.attendanceRecord.findFirst({
    where: { classId, sessionKey: { in: [...sessionKeys] }, date: { lte: toUTCDate(onOrBefore) } },
    orderBy: { date: 'desc' },
    select: { sessionKey: true, date: true },
  })
  return row ? { sessionKey: row.sessionKey, date: formatDateOnly(row.date) } : null
}

/** The days a class took a meeting's register, newest first. */
export async function registerDates(classId: string, sessionKey: string, limit = 8): Promise<string[]> {
  // DISTINCT + LIMIT in Postgres, as the register page does: Prisma's own
  // `distinct` would download every row first.
  const rows = await prisma.$queryRaw<{ date: Date }[]>`
    SELECT DISTINCT "date" FROM "AttendanceRecord"
    WHERE "classId" = ${classId} AND "sessionKey" = ${sessionKey}
    ORDER BY "date" DESC
    LIMIT ${limit}
  `
  return rows.map((r) => formatDateOnly(r.date))
}

export interface MissedKid {
  id: string
  name: string
  firstName: string
  /** False when the register never marked them at all. */
  marked: boolean
  /** The family's numbers, the mother's first. */
  phones: KidPhone[]
  /** The follow-up excuse that covered that day, or the one on now or next. */
  excuse: ExcuseView | null
  /** Excused that day or now: nobody owes the family a message. */
  excused: boolean
  /**
   * Messages already sent about this meeting, oldest first. The time is
   * written here, in church time, rather than in the browser, which may word
   * it differently from the server.
   */
  sent: Array<{ method: string; to: string | null; by: string | null; when: string }>
}

/**
 * Who missed one meeting of a class, with their families' numbers and what has
 * been sent so far. `held` is false when that register was never taken.
 */
export async function loadMissedMeeting(args: {
  classId: string
  session: SessionScope & { key: string }
  date: string
  today: string
}): Promise<{ held: boolean; kids: MissedKid[] }> {
  const { classId, session, date, today } = args
  const roster = await prisma.student.findMany({
    where: registerWhere(session, classId),
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: {
      id: true, firstName: true, lastName: true, createdAt: true, classId: true,
      fatherPhone: true, motherPhone: true,
      account: { select: { phone: true } },
      memberships: { where: { classId }, select: { addedAt: true } },
    },
  })
  const ids = roster.map((s) => s.id)
  const marks = await prisma.attendanceRecord.findMany({
    // The class's own register says whether it met; a child's mark that day
    // counts wherever it was taken, as one child has one mark per meeting a day.
    where: { date: toUTCDate(date), sessionKey: session.key, OR: [{ classId }, { studentId: { in: ids } }] },
    select: { studentId: true, classId: true, status: true },
  })
  if (!marks.some((m) => m.classId === classId)) return { held: false, kids: [] }

  const missed = missedRegister({
    // A member joined this class when they were added to it.
    roster: roster.map((s) => ({ id: s.id, joinedOn: churchToday(s.classId === classId ? s.createdAt : (s.memberships[0]?.addedAt ?? s.createdAt)) })),
    marks: marks.filter((m) => ids.includes(m.studentId)),
    date,
  })
  const missedIds = missed.map((m) => m.studentId)
  const [excuses, sent] = await Promise.all([
    excusesByStudent(missedIds, { endingFrom: date }),
    prisma.followUpLog.findMany({
      where: { studentId: { in: missedIds }, missedSessionKey: session.key, missedOn: toUTCDate(date) },
      orderBy: { at: 'asc' },
      select: { studentId: true, method: true, note: true, at: true, by: { select: { displayName: true } } },
    }),
  ])
  const byId = new Map(roster.map((s) => [s.id, s]))
  const kids = missed.map(({ studentId, marked }) => {
    const s = byId.get(studentId)!
    const { excuse, excused } = excuseForMeeting(excuses.get(studentId) ?? [], date, today)
    return {
      id: s.id,
      name: studentName(s),
      firstName: s.firstName.trim() || studentName(s),
      marked,
      phones: messagingOrder(kidPhoneList({ fatherPhone: s.fatherPhone, motherPhone: s.motherPhone, ownPhone: s.account.phone })),
      excuse,
      excused,
      sent: sent
        .filter((l) => l.studentId === studentId)
        .map((l) => ({ method: l.method, to: sentTo(l.note), by: l.by?.displayName ?? null, when: formatDateTime(l.at) })),
    }
  })
  // The excused last: nobody owes them a message, though one may still go.
  kids.sort((a, b) => Number(a.excused) - Number(b.excused))
  return { held: true, kids }
}
