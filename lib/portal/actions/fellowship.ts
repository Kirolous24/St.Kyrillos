'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { placeNewKids } from '../data/groups'
import { studentName } from '../data/students'
import { createMember, joinMeeting, knownPeople, leaveMeeting, meetingExportRows, type PersonRef } from '../data/fellowship'
import {
  ALREADY_MEMBER,
  MEMBER_TEMPLATE_CSV,
  SELF_CHECKIN_NOTE,
  meetingSessionKey,
  classifyMemberRow,
  isFellowship,
  membersCsv,
  parseMemberInput,
  parseMemberSheet,
  samePersonMatches,
  searchPeople,
  type Addable,
} from '../fellowship'
import type { PortalUser } from '../permissions'
import { churchToday, formatDateOnly, toUTCDate } from '../dates'
import { GROUP_CODE_TTL_MS, expiryFrom, generateToken, parseTokenPayload, shortCode } from '../qr'
import { qrSvgDataUrl } from '@/components/portal/QrImage'
import { rosterWhere } from '../class-members'
import { syncAutoFollowUps } from '../followup-sync'

/**
 * Fellowship meetings (2026-10-24): what a meeting's servants do with its
 * members. "Make it easy for the servants to add a member" was the user's one
 * emphasis, so a member is added three ways — someone already in the portal,
 * someone new, or a sheet (Import members) — and the same person is never made
 * twice without the servant saying it is someone else.
 */

/** The meeting, once the user may add and edit its members. */
async function requireMeeting(user: PortalUser, classId: string) {
  const cls = await assertClassAction(user, String(classId ?? ''), 'student.write')
  if (!isFellowship(cls.stage)) throw new PortalError('That is not a Fellowship meeting.')
  return cls
}

function revalidateMeeting(classId: string) {
  revalidatePath(`/portal/classes/${classId}`)
  revalidatePath(`/portal/classes/${classId}/attendance`)
  revalidatePath('/portal/follow-ups')
  revalidatePath('/portal/birthdays')
}

/** Group placement after someone's home meeting changes; a failure leaves them unassigned and flagged, never fails the add. */
async function placeInGroups(classId: string, studentId: string) {
  await placeNewKids(classId, [studentId]).catch((err) => console.error('Group placement failed:', err))
}

export interface MemberFormInput {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  birthday?: string
  note?: string
}

/** Servants and members of other meetings whose names start with what was typed. */
export async function searchPeopleToAdd(classId: string, q: string): Promise<ActionResult<Addable[]>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await requireMeeting(user, classId)
    return searchPeople(await knownPeople(cls.id), String(q ?? '').slice(0, 80))
  })
}

/** Add a servant, or a member of another meeting, to this one. Their one login stays theirs. */
export async function addPersonToMeeting(
  classId: string,
  ref: PersonRef,
): Promise<ActionResult<{ studentId: string; name: string; already: boolean }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await requireMeeting(user, classId)
    const safe: PersonRef = { kind: ref?.kind === 'servant' ? 'servant' : 'member', id: String(ref?.id ?? '') }
    const joined = await prisma.$transaction((tx) => joinMeeting(tx, cls, safe, user.accountId))
    if (joined.plan === 'already') return { studentId: joined.studentId, name: joined.name, already: true }
    if (joined.plan === 'create-home' || joined.plan === 'set-home') await placeInGroups(cls.id, joined.studentId)
    await audit(user, 'fellowship.member.add', 'student', joined.studentId, `${cls.name}: added ${joined.name}${safe.kind === 'servant' ? ' (a servant)' : ''}`)
    revalidateMeeting(cls.id)
    return { studentId: joined.studentId, name: joined.name, already: false }
  })
}

/**
 * Add someone new. When their name is already in the portal the servant is
 * asked first (`matches`); `confirmNew` is their answer that it is someone else.
 */
export async function addNewMember(
  classId: string,
  raw: MemberFormInput,
  opts: { confirmNew?: boolean } = {},
): Promise<ActionResult<{ added: { studentId: string; name: string } } | { matches: Addable[] }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await requireMeeting(user, classId)
    const parsed = parseMemberInput(raw ?? {})
    if (!parsed.ok) throw new PortalError(parsed.error)
    const value = parsed.value
    if (!opts?.confirmNew) {
      const matches = samePersonMatches(value, await knownPeople(cls.id))
      if (matches.length > 0) return { matches }
    }
    const created = await prisma.$transaction((tx) => createMember(tx, cls, value))
    await placeInGroups(cls.id, created.studentId)
    const name = studentName(value)
    await audit(user, 'fellowship.member.create', 'student', created.studentId, `${cls.name}: added ${name} (new)`)
    revalidateMeeting(cls.id)
    return { added: { studentId: created.studentId, name } }
  })
}

/**
 * Change a member's details. Only a member who does not serve: a servant's
 * name, phone and birthday live on their servant profile, which is the admin's.
 * Only the fields the form sent are written (the 2026-09-28 lesson: a field a
 * form leaves out must never be wiped).
 */
export async function updateMember(studentId: string, raw: MemberFormInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const s = await prisma.student.findUnique({
      where: { id: String(studentId ?? '') },
      select: { id: true, firstName: true, lastName: true, classId: true, memberships: { select: { classId: true } }, account: { select: { role: true } } },
    })
    if (!s) throw new PortalError('Member not found.')
    if (s.account.role === 'SERVANT') {
      throw new PortalError('A servant’s name, phone and birthday are on their servant profile. Ask the admin to change them there.')
    }
    if (s.account.role !== 'MEMBER') throw new PortalError('Member not found.')
    const meetings = [s.classId, ...s.memberships.map((m) => m.classId)].filter((id): id is string => !!id)
    let allowed = false
    for (const id of meetings) {
      allowed = await requireMeeting(user, id).then(
        () => true,
        () => false,
      )
      if (allowed) break
    }
    if (!allowed) throw new PortalError('You do not have permission to edit this member.')

    const input = raw ?? {}
    const parsed = parseMemberInput({ firstName: s.firstName, lastName: s.lastName, ...input })
    if (!parsed.ok) throw new PortalError(parsed.error)
    const v = parsed.value
    const sent = (key: keyof MemberFormInput) => input[key] !== undefined
    await prisma.student.update({
      where: { id: s.id },
      data: {
        ...(sent('firstName') ? { firstName: v.firstName } : {}),
        ...(sent('lastName') ? { lastName: v.lastName } : {}),
        ...(sent('birthday') ? { dob: v.dob ? toUTCDate(v.dob) : null } : {}),
        ...(sent('note') ? { notes: v.note } : {}),
        account: {
          update: {
            displayName: studentName(v),
            ...(sent('phone') ? { phone: v.phone } : {}),
            ...(sent('email') ? { email: v.email } : {}),
          },
        },
      },
    })
    await audit(user, 'fellowship.member.update', 'student', s.id, `Updated ${studentName(v)}`)
    revalidatePath(`/portal/members/${s.id}`)
    for (const id of meetings) revalidateMeeting(id)
    return undefined
  })
}

/**
 * Take someone out of this meeting. Their record and attendance are kept
 * (the user, 2026-10-24), and they can be added back from People who left.
 */
export async function removeMemberFromMeeting(classId: string, studentId: string): Promise<ActionResult<{ plan: string; name: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await requireMeeting(user, classId)
    const id = String(studentId ?? '')
    const left = await prisma.$transaction((tx) => leaveMeeting(tx, cls, id, user.accountId))
    if (left.plan === 'promote' && left.newHome) await placeInGroups(left.newHome, id)
    await audit(
      user,
      'fellowship.member.remove',
      'student',
      id,
      `${cls.name}: removed ${left.name}${left.plan === 'clear-home' ? ' (in no other meeting now; their record is kept)' : ''}`,
    )
    revalidateMeeting(cls.id)
    if (left.newHome) revalidateMeeting(left.newHome)
    revalidatePath(`/portal/members/${id}`)
    return { plan: left.plan, name: left.name }
  })
}

/** The meeting's members as a spreadsheet, for anyone who may open the meeting. */
export async function exportMembersCsv(classId: string): Promise<ActionResult<{ filename: string; csv: string; rows: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await assertClassAction(user, String(classId ?? ''), 'student.read')
    if (!isFellowship(cls.stage)) throw new PortalError('That is not a Fellowship meeting.')
    const rows = await meetingExportRows(cls.id)
    await audit(user, 'fellowship.members.export', 'class', cls.id, `${cls.name}: exported ${rows.length} member${rows.length === 1 ? '' : 's'}`)
    return { filename: `${cls.id}-members-${churchToday()}.csv`, csv: membersCsv(rows), rows: rows.length }
  })
}

/** The blank sheet for Import members. */
export async function memberTemplateCsv(): Promise<ActionResult<{ filename: string; csv: string }>> {
  return runAction(async () => {
    await requirePortalUser()
    return { filename: 'fellowship-members-template.csv', csv: MEMBER_TEMPLATE_CSV }
  })
}

/** At most this many people per sheet: a meeting's whole list fits easily. */
const MAX_IMPORT_ROWS = 500

export interface ImportMemberRow {
  /** Its row number in the servant's sheet. */
  row: number
  name: string
  status: 'new' | 'servant' | 'joins' | 'already' | 'problem'
  /** Who they are in the portal, or what is wrong. */
  message?: string
}

/**
 * Import members from a sheet (2026-10-24): preview first, then the same rows
 * for real. A servant on the sheet is linked to their own login, a member of
 * another meeting joins this one, someone already here is skipped, and only
 * someone nobody knows is added new. A row the import cannot be sure about is
 * left for Add member and named.
 */
export async function importMembersCsv(
  classId: string,
  text: string,
  opts: { preview?: boolean } = {},
): Promise<
  ActionResult<{
    rows: ImportMemberRow[]
    counts: { added: number; linked: number; joined: number; already: number; problems: number }
    unread: string[]
  }>
> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await requireMeeting(user, classId)
    const source = String(text ?? '')
    if (source.length > 400_000) throw new PortalError(`That sheet is too big. Import at most ${MAX_IMPORT_ROWS} people at a time.`)
    const sheet = parseMemberSheet(source)
    if (sheet.error) throw new PortalError(sheet.error)
    if (sheet.rows.length === 0) throw new PortalError('That sheet has nobody in it.')
    if (sheet.rows.length > MAX_IMPORT_ROWS) throw new PortalError(`Import at most ${MAX_IMPORT_ROWS} people at a time.`)
    const preview = opts?.preview === true

    const people = await knownPeople(cls.id)
    const rows: ImportMemberRow[] = []
    const counts = { added: 0, linked: 0, joined: 0, already: 0, problems: 0 }
    const homed: string[] = []
    for (const r of sheet.rows) {
      if (!r.value) {
        rows.push({ row: r.row, name: '', status: 'problem', message: r.problem })
        counts.problems++
        continue
      }
      const value = r.value
      const name = studentName(value)
      const plan = classifyMemberRow(value, people)
      if (plan.kind === 'problem') {
        rows.push({ row: r.row, name, status: 'problem', message: plan.message })
        counts.problems++
        continue
      }
      if (plan.kind === 'already') {
        rows.push({ row: r.row, name, status: 'already', message: plan.person.where })
        counts.already++
        continue
      }
      if (preview) {
        rows.push({ row: r.row, name, status: plan.kind, message: plan.kind === 'new' ? undefined : plan.person.where })
        if (plan.kind === 'new') counts.added++
        else if (plan.kind === 'servant') counts.linked++
        else counts.joined++
        continue
      }
      try {
        if (plan.kind === 'new') {
          const created = await prisma.$transaction((tx) => createMember(tx, cls, value))
          homed.push(created.studentId)
          counts.added++
          rows.push({ row: r.row, name, status: 'new' })
        } else {
          const ref: PersonRef = { kind: plan.person.kind === 'servant' ? 'servant' : 'member', id: plan.person.id }
          const joined = await prisma.$transaction((tx) => joinMeeting(tx, cls, ref, user.accountId))
          if (joined.plan === 'create-home' || joined.plan === 'set-home') homed.push(joined.studentId)
          if (plan.kind === 'servant') counts.linked++
          else counts.joined++
          rows.push({ row: r.row, name, status: plan.kind, message: plan.person.where })
          // Named again further down the sheet, they are already here.
          plan.person.blocked = ALREADY_MEMBER
        }
      } catch (err) {
        if (!(err instanceof PortalError)) console.error('Member import row failed:', err)
        rows.push({ row: r.row, name, status: 'problem', message: err instanceof PortalError ? err.message : 'Could not add this row.' })
        counts.problems++
      }
    }
    if (homed.length > 0) await placeNewKids(cls.id, homed).catch((err) => console.error('Group placement failed:', err))
    if (!preview) {
      await audit(
        user,
        'fellowship.members.import',
        'class',
        cls.id,
        `${cls.name}: imported a sheet — ${counts.added} new, ${counts.linked} servants, ${counts.joined} from other meetings, ${counts.already} already here, ${counts.problems} not added`,
      )
      revalidateMeeting(cls.id)
    }
    return { rows, counts, unread: sheet.unread }
  })
}

/* ── QR check-in: the servant's side ────────────────────────────────────── */

export interface MeetingCode {
  token: string
  shortCode: string
  /** What the QR opens: the meeting's check-in page, no sign-in needed. */
  url: string
  qr: string
  expiresAt: string
  date: string
}

function requestOrigin(): string | null {
  try {
    const h = headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (!host) return null
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  } catch {
    return null
  }
}

/**
 * Open a meeting's check-in (2026-10-24): a five-minute code for today's
 * meeting. Members scan it with the phone camera and tap their name.
 */
export async function openCheckInCode(classId: string): Promise<ActionResult<MeetingCode>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await assertClassAction(user, String(classId ?? ''), 'attendance.write')
    if (!isFellowship(cls.stage)) throw new PortalError('That is not a Fellowship meeting.')
    const session = await prisma.attendanceSession.findUnique({
      where: { key: meetingSessionKey(cls.id) },
      select: { key: true, label: true, isActive: true },
    })
    if (!session || !session.isActive) {
      throw new PortalError(`${cls.name}’s register is switched off. The admin turns it on in Sessions & Points.`)
    }
    const date = churchToday()
    const row = await prisma.qrToken.create({
      data: {
        token: generateToken(),
        kind: 'MEMBER_CHECKIN',
        classIds: [cls.id],
        sessionKey: session.key,
        activityLabel: session.label,
        title: session.label,
        date: toUTCDate(date),
        expiresAt: expiryFrom(new Date(), GROUP_CODE_TTL_MS),
        createdById: user.accountId,
      },
    })
    const origin = requestOrigin()
    const url = `${origin ?? ''}/portal/checkin/${row.token}`
    await audit(user, 'fellowship.checkin.open', 'qrToken', row.token, `${cls.name}: check-in code for ${date} (5 min)`)
    return { token: row.token, shortCode: shortCode(row.token), url, qr: await qrSvgDataUrl(url, 1), expiresAt: row.expiresAt.toISOString(), date }
  })
}

/** A meeting's check-in code, for someone who may take its register. */
async function meetingCode(user: PortalUser, raw: string) {
  const token = parseTokenPayload(String(raw ?? ''))
  const row = token
    ? await prisma.qrToken.findUnique({
        where: { token },
        select: { token: true, kind: true, classIds: true, sessionKey: true, activityLabel: true, date: true, expiresAt: true },
      })
    : null
  if (!row || row.kind !== 'MEMBER_CHECKIN' || row.classIds.length !== 1 || !row.sessionKey) throw new PortalError('That check-in code is not valid.')
  const cls = await assertClassAction(user, row.classIds[0]!, 'attendance.write')
  if (!isFellowship(cls.stage)) throw new PortalError('That check-in code is not valid.')
  return {
    token: row.token,
    cls,
    sessionKey: row.sessionKey,
    label: row.activityLabel ?? cls.name,
    date: row.date ? formatDateOnly(row.date) : churchToday(),
    expiresAt: row.expiresAt,
  }
}

/** Everyone who checked themselves in to this meeting today, newest first. */
function todaysCheckIns(classId: string, date: string) {
  return { token: { kind: 'MEMBER_CHECKIN' as const, classIds: { has: classId }, date: toUTCDate(date) } }
}

/** Polled by the check-in panel: who checked in from their phone, and how many are here. */
export async function checkInList(tokenRaw: string): Promise<
  ActionResult<{
    expired: boolean
    expiresAt: string
    checkedIn: Array<{ accountId: string; name: string; at: string }>
    here: number
    members: number
  }>
> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const code = await meetingCode(user, tokenRaw)
    const [redemptions, here, members] = await Promise.all([
      prisma.qrRedemption.findMany({
        where: todaysCheckIns(code.cls.id, code.date),
        orderBy: { at: 'desc' },
        take: 300,
        select: { accountId: true, name: true, at: true },
      }),
      prisma.attendanceRecord.count({ where: { classId: code.cls.id, sessionKey: code.sessionKey, date: toUTCDate(code.date), status: 'PRESENT' } }),
      prisma.student.count({ where: rosterWhere(code.cls.id) }),
    ])
    const people = await prisma.student.findMany({
      where: { accountId: { in: redemptions.map((r) => r.accountId) } },
      select: { accountId: true, firstName: true, lastName: true },
    })
    const fullName = new Map(people.map((p) => [p.accountId, studentName(p)]))
    const seen = new Set<string>()
    return {
      expired: code.expiresAt.getTime() <= Date.now(),
      expiresAt: code.expiresAt.toISOString(),
      checkedIn: redemptions
        .filter((r) => !seen.has(r.accountId) && !!seen.add(r.accountId))
        .map((r) => ({ accountId: r.accountId, name: fullName.get(r.accountId) ?? r.name, at: r.at.toISOString() })),
      here,
      members,
    }
  })
}

/** A servant takes back someone's self check-in (tapped by mistake, or by a friend). */
export async function undoMemberCheckIn(tokenRaw: string, accountId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const code = await meetingCode(user, tokenRaw)
    const person = await prisma.student.findUnique({ where: { accountId: String(accountId ?? '') }, select: { id: true } })
    if (!person) throw new PortalError('That check-in is already gone.')
    const day = toUTCDate(code.date)
    const record = await prisma.attendanceRecord.findUnique({
      where: { studentId_date_sessionKey: { studentId: person.id, date: day, sessionKey: code.sessionKey } },
      select: { id: true, note: true, markedById: true },
    })
    await prisma.$transaction(async (tx) => {
      await tx.qrRedemption.deleteMany({ where: { accountId: String(accountId), ...todaysCheckIns(code.cls.id, code.date) } })
      // Only the self check-in: a mark a servant made since is theirs to change.
      if (record && record.note === SELF_CHECKIN_NOTE && record.markedById === null) await tx.attendanceRecord.delete({ where: { id: record.id } })
    })
    await syncAutoFollowUps({
      classId: code.cls.id,
      studentIds: [person.id],
      threshold: code.cls.visitationThreshold,
      asOf: code.date,
      session: { key: code.sessionKey, label: code.label },
    })
    await audit(user, 'fellowship.checkin.undo', 'student', person.id, `${code.cls.name}: took back a self check-in on ${code.date}`)
    revalidateMeeting(code.cls.id)
    return undefined
  })
}

/**
 * Done: close the code and work out who missed today's meeting, for everyone
 * on the list. Never on each scan: the first check-in at the door would have
 * counted everyone still walking in as missing.
 */
export async function finishCheckIn(tokenRaw: string): Promise<ActionResult<{ opened: number; closed: number; here: number; members: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const code = await meetingCode(user, tokenRaw)
    if (code.expiresAt.getTime() > Date.now()) await prisma.qrToken.update({ where: { token: code.token }, data: { expiresAt: new Date() } })
    const roster = await prisma.student.findMany({ where: rosterWhere(code.cls.id), select: { id: true } })
    const { opened, closed } = await syncAutoFollowUps({
      classId: code.cls.id,
      studentIds: roster.map((s) => s.id),
      threshold: code.cls.visitationThreshold,
      asOf: code.date,
      session: { key: code.sessionKey, label: code.label },
    })
    const here = await prisma.attendanceRecord.count({ where: { classId: code.cls.id, sessionKey: code.sessionKey, date: toUTCDate(code.date), status: 'PRESENT' } })
    await audit(user, 'fellowship.checkin.done', 'class', code.cls.id, `${code.cls.name}: check-in done for ${code.date} — ${here} here; ${opened} follow-up${opened === 1 ? '' : 's'} opened`)
    revalidateMeeting(code.cls.id)
    return { opened, closed, here, members: roster.length }
  })
}
