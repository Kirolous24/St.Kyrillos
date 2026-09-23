'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isUniqueViolationOn } from '@/lib/prisma-errors'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { studentName } from '../data/students'
import { awardAttendancePoints, type AttendanceAwardRecord } from '../attendance-award'
import { undoPoints } from './points'
import { formatDateOnly, mondayOf, parseDateOnly, todayInNewYork, toUTCDate } from '../dates'
import { formatLongDate } from '../format'
import {
  buildTokenPayload,
  canRedeem,
  expiryFrom,
  generateToken,
  parseStudentPayload,
  parseTokenPayload,
  shortCode,
  GROUP_CODE_TTL_MS,
  MEETING_CODE_TTL_MS,
  type QrKind,
} from '../qr'
import { qrSvgDataUrl } from '@/components/portal/QrImage'
import { syncAutoFollowUps } from '../followup-sync'

/**
 * QR check-in. Every code is a 128-bit CSPRNG token row in QrToken with a real
 * expiry; every redemption requires a signed-in portal user who passes
 * canRedeem() and is made exactly once through @@unique([tokenId, accountId]).
 * Holding the URL is never sufficient — the prototype's flaw (ANALYSIS §2).
 */

export interface GroupCode {
  token: string
  shortCode: string
  url: string
  qr: string
  expiresAt: string
  kind: QrKind
  title: string
  subtitle: string
}

export interface RedeemOutcome {
  title: string
  detail: string
  points: number | null
  already: boolean
}

export interface ScanOutcome {
  studentId: string
  name: string
  message: string
  already: boolean
  undo: { kind: 'ATTENDANCE' | 'POINTS'; id: string } | null
}

/**
 * True only when the clash was the one redemption row per (code, person) —
 * i.e. a genuine second scan. Anything else that races inside the same
 * transaction (the attendance row, its point entry) has to surface as an
 * error, not as a cheerful "you already checked in" over a write that never
 * happened.
 */
function isAlreadyRedeemed(err: unknown): boolean {
  return isUniqueViolationOn(err, 'QrRedemption', 'tokenId')
}

/**
 * Read the award that goes with an attendance row.
 *
 * Kept separate from the upsert on purpose: Prisma only compiles an upsert to a
 * single INSERT ... ON CONFLICT DO UPDATE when nothing nested is selected, and
 * the degraded SELECT-then-INSERT form loses the race between two people
 * checking the same student in at once.
 */
async function withAward(tx: Prisma.TransactionClient, id: string): Promise<AttendanceAwardRecord> {
  return {
    id,
    pointEntry: await tx.pointEntry.findUnique({
      where: { attendanceRecordId: id },
      select: { id: true, points: true, undone: true },
    }),
  }
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

async function toGroupCode(row: {
  token: string
  kind: QrKind
  expiresAt: Date
  title: string | null
  activityLabel: string | null
}, subtitle: string): Promise<GroupCode> {
  const url = buildTokenPayload(row.token, requestOrigin())
  return {
    token: row.token,
    shortCode: shortCode(row.token),
    url,
    qr: await qrSvgDataUrl(url, 1),
    expiresAt: row.expiresAt.toISOString(),
    kind: row.kind,
    title: row.title ?? row.activityLabel ?? 'Check-in code',
    subtitle,
  }
}

/* ── Group codes: students scan, the code marks them present or awards points ─ */

const GroupSchema = z.object({
  mode: z.enum(['ATTENDANCE', 'POINTS']),
  classIds: z.array(z.string().min(1).max(64)).min(1).max(30),
  sessionKey: z.string().min(1).max(64).optional(),
  activityId: z.string().min(1).max(64).optional(),
  date: z.string().max(10).optional(),
})

export type CreateGroupCodeInput = z.infer<typeof GroupSchema>

export async function createGroupCode(raw: CreateGroupCodeInput): Promise<ActionResult<GroupCode>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = GroupSchema.parse(raw)
    const classIds = Array.from(new Set(input.classIds))
    const action = input.mode === 'ATTENDANCE' ? ('attendance.write' as const) : ('points.write' as const)

    const names: string[] = []
    for (const id of classIds) {
      const cls = await assertClassAction(user, id, action)
      names.push(cls.name)
    }

    const date = parseDateOnly(input.date) ?? todayInNewYork()
    const expiresAt = expiryFrom(new Date(), GROUP_CODE_TTL_MS)
    const token = generateToken()

    let data: Prisma.QrTokenUncheckedCreateInput
    let subtitle: string

    if (input.mode === 'ATTENDANCE') {
      if (!input.sessionKey) throw new PortalError('Pick a session first.')
      const session = await prisma.attendanceSession.findUnique({ where: { key: input.sessionKey } })
      if (!session || !session.isActive) throw new PortalError('That session is no longer available.')
      data = {
        token,
        kind: 'STUDENT_ATTENDANCE',
        classIds,
        sessionKey: session.key,
        activityLabel: session.label,
        points: session.points,
        date: toUTCDate(date),
        title: session.label,
        expiresAt,
        createdById: user.accountId,
      }
      subtitle = `${names.join(', ')} · ${formatLongDate(date)} · +${session.points} pts`
    } else {
      if (!input.activityId) throw new PortalError('Pick an activity first.')
      const activity = await prisma.pointActivity.findUnique({ where: { id: input.activityId } })
      if (!activity || !activity.isActive) throw new PortalError('That activity is no longer available.')
      if (activity.classId && !classIds.includes(activity.classId)) {
        throw new PortalError('That activity belongs to another class.')
      }
      if (activity.points <= 0) throw new PortalError('A scan code can only award positive points.')
      data = {
        token,
        kind: 'STUDENT_POINTS',
        classIds,
        activityKey: activity.key,
        activityLabel: activity.label,
        points: activity.points,
        date: toUTCDate(date),
        title: activity.label,
        expiresAt,
        createdById: user.accountId,
      }
      subtitle = `${names.join(', ')} · +${activity.points} pts`
    }

    const row = await prisma.qrToken.create({ data })
    await audit(user, 'qr.code.create', 'qrToken', row.token, `${row.title ?? row.kind} code for ${names.join(', ')} (5 min)`)
    return toGroupCode(
      { token: row.token, kind: row.kind, expiresAt: row.expiresAt, title: row.title, activityLabel: row.activityLabel },
      subtitle,
    )
  })
}

const MeetingSchema = z.object({
  activityKey: z.string().min(1).max(64),
  weekStart: z.string().max(10).optional(),
})

export async function createMeetingCode(raw: z.infer<typeof MeetingSchema>): Promise<ActionResult<GroupCode>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = MeetingSchema.parse(raw)
    if (user.role !== 'ADMIN' && user.role !== 'SERVANT') {
      throw new PortalError('Only servants and admins can open a servants-meeting code.')
    }
    const activity = await prisma.servantActivity.findUnique({ where: { key: input.activityKey } })
    if (!activity || !activity.isActive) throw new PortalError('That servant activity no longer exists.')

    const weekStart = mondayOf(parseDateOnly(input.weekStart) ?? todayInNewYork())
    const row = await prisma.qrToken.create({
      data: {
        token: generateToken(),
        kind: 'SERVANT_MEETING',
        classIds: [],
        activityKey: activity.key,
        activityLabel: activity.label,
        weekStart: toUTCDate(weekStart),
        title: activity.label,
        expiresAt: expiryFrom(new Date(), MEETING_CODE_TTL_MS),
        createdById: user.accountId,
      },
    })
    await audit(user, 'qr.meeting.create', 'qrToken', row.token, `${activity.label} check-in code for week of ${weekStart} (10 min)`)
    return toGroupCode(
      { token: row.token, kind: row.kind, expiresAt: row.expiresAt, title: row.title, activityLabel: row.activityLabel },
      `Servants only · week of ${formatLongDate(weekStart)}`,
    )
  })
}

export interface CodeStatus {
  expiresAt: string
  expired: boolean
  redemptions: Array<{ name: string; at: string }>
}

/** Polled by the group-code panel so the servant sees who has scanned. */
export async function codeStatus(tokenRaw: string): Promise<ActionResult<CodeStatus>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const code = parseTokenPayload(tokenRaw)
    if (!code) throw new PortalError('That code is not valid.')
    const token = await prisma.qrToken.findUnique({
      where: { token: code },
      select: { token: true, expiresAt: true, createdById: true },
    })
    if (!token) throw new PortalError('That code is not valid.')
    if (token.createdById !== user.accountId && user.role !== 'ADMIN') {
      throw new PortalError('That code was opened by someone else.')
    }
    const redemptions = await prisma.qrRedemption.findMany({
      where: { tokenId: token.token },
      orderBy: { at: 'desc' },
      take: 200,
      select: { name: true, at: true },
    })
    return {
      expiresAt: token.expiresAt.toISOString(),
      expired: token.expiresAt.getTime() <= Date.now(),
      redemptions: redemptions.map((r) => ({ name: r.name, at: r.at.toISOString() })),
    }
  })
}

/** Close a code early. */
export async function endCode(tokenRaw: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const code = parseTokenPayload(tokenRaw)
    if (!code) throw new PortalError('That code is not valid.')
    const token = await prisma.qrToken.findUnique({ where: { token: code }, select: { token: true, createdById: true, title: true } })
    if (!token) throw new PortalError('That code is not valid.')
    if (token.createdById !== user.accountId && user.role !== 'ADMIN') {
      throw new PortalError('That code was opened by someone else.')
    }
    await prisma.qrToken.update({ where: { token: token.token }, data: { expiresAt: new Date() } })
    await audit(user, 'qr.code.end', 'qrToken', token.token, `Closed the "${token.title ?? 'check-in'}" code`)
    return undefined
  })
}

/* ── Redemption ───────────────────────────────────────────────────────────── */

type TokenRow = {
  token: string
  kind: QrKind
  classIds: string[]
  sessionKey: string | null
  activityKey: string | null
  activityLabel: string | null
  points: number | null
  date: Date | null
  weekStart: Date | null
  title: string | null
  expiresAt: Date
  createdById: string | null
}

const tokenSelect = {
  token: true,
  kind: true,
  classIds: true,
  sessionKey: true,
  activityKey: true,
  activityLabel: true,
  points: true,
  date: true,
  weekStart: true,
  title: true,
  expiresAt: true,
  createdById: true,
} as const

/**
 * Resolve a full token, or the 8-character short code while it is still live.
 * Not exported: a 'use server' export is a public RPC endpoint, and nothing
 * outside this module needs to look a token up by code.
 */
async function findToken(raw: string): Promise<TokenRow | null> {
  const code = parseTokenPayload(raw)
  if (!code) return null
  if (code.length >= 32) {
    return prisma.qrToken.findUnique({ where: { token: code }, select: tokenSelect })
  }
  return prisma.qrToken.findFirst({
    where: { token: { startsWith: code }, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: tokenSelect,
  })
}

export async function redeemCode(tokenRaw: string): Promise<ActionResult<RedeemOutcome>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const token = await findToken(tokenRaw)
    if (!token) throw new PortalError('That code is not valid.')

    const reason = canRedeem(user, token, new Date())
    if (reason) throw new PortalError(reason)

    const outcome =
      token.kind === 'SERVANT_MEETING'
        ? await redeemMeeting(user.accountId, user.servantId!, user.displayName, token)
        : await redeemStudent(user.accountId, user.studentId!, user.displayName, token)

    await audit(user, 'qr.redeem', 'qrToken', token.token, `${outcome.already ? 'Already redeemed' : 'Redeemed'} "${outcome.title}"`)

    revalidatePath('/portal')
    revalidatePath('/portal/my-attendance')
    revalidatePath('/portal/leaderboard')
    revalidatePath('/portal/servant-attendance')
    return outcome
  })
}

async function redeemStudent(accountId: string, studentId: string, name: string, token: TokenRow): Promise<RedeemOutcome> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, firstName: true, lastName: true, classId: true },
  })
  if (!student?.classId) throw new PortalError('You are not in a class yet, so this code cannot check you in.')
  if (token.classIds.length > 0 && !token.classIds.includes(student.classId)) {
    throw new PortalError('This code is for a different class.')
  }
  const classId = student.classId

  if (token.kind === 'STUDENT_ATTENDANCE') {
    const session = await prisma.attendanceSession.findUnique({ where: { key: token.sessionKey ?? '' } })
    if (!session || !session.isActive) throw new PortalError('That session is no longer available.')
    const date = token.date ? formatDateOnly(token.date) : todayInNewYork()
    const day = toUTCDate(date)

    const outcome: RedeemOutcome = {
      title: session.label,
      detail: `You are marked present for ${session.label} on ${formatLongDate(date)}.`,
      points: session.points > 0 ? session.points : null,
      already: false,
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.qrRedemption.create({ data: { tokenId: token.token, accountId, name } })
        const record = await tx.attendanceRecord.upsert({
          where: { studentId_date_sessionKey: { studentId: student.id, date: day, sessionKey: session.key } },
          create: {
            studentId: student.id,
            classId,
            date: day,
            sessionKey: session.key,
            status: 'PRESENT',
            note: 'QR check-in',
            markedById: accountId,
          },
          update: { classId, status: 'PRESENT', reason: null, note: 'QR check-in', markedById: accountId },
          select: { id: true },
        })
        await awardAttendancePoints(tx, await withAward(tx, record.id), {
          studentId: student.id,
          classId,
          sessionKey: session.key,
          sessionLabel: session.label,
          sessionPoints: session.points,
          accountId,
        })
      })
    } catch (err) {
      if (!isAlreadyRedeemed(err)) throw err
      outcome.already = true
      outcome.detail = `You already checked in for ${session.label} on ${formatLongDate(date)}.`
    }

    // A student who scans in is attending again, so an open case should close.
    // The port synced cases only from the manual Save-attendance button, so a
    // class checking in by group QR never had its follow-ups updated at all.
    if (session.key === 'sunday' && !outcome.already) {
      const cls = await prisma.schoolClass.findUnique({
        where: { id: classId },
        select: { visitationThreshold: true },
      })
      await syncAutoFollowUps({
        classId,
        studentIds: [student.id],
        threshold: cls?.visitationThreshold ?? 2,
        asOf: date,
      })
      revalidatePath('/portal/follow-ups')
    }

    revalidatePath(`/portal/classes/${classId}/attendance`)
    return outcome
  }

  // STUDENT_POINTS
  const points = token.points ?? 0
  if (points <= 0) throw new PortalError('This code does not award any points.')
  const label = token.activityLabel ?? token.title ?? 'QR points'
  const outcome: RedeemOutcome = {
    title: label,
    detail: `You earned ${points} point${points === 1 ? '' : 's'} for ${label}.`,
    points,
    already: false,
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.qrRedemption.create({ data: { tokenId: token.token, accountId, name } })
      await tx.pointEntry.create({
        data: {
          studentId: student.id,
          classId,
          points,
          source: 'QR',
          activityKey: token.activityKey,
          activityLabel: label,
          reason: 'Scanned a check-in code',
          createdById: token.createdById ?? accountId,
        },
      })
    })
  } catch (err) {
    if (!isAlreadyRedeemed(err)) throw err
    outcome.already = true
    outcome.detail = `You have already scanned this ${label} code.`
  }

  revalidatePath(`/portal/classes/${classId}/points`)
  return outcome
}

async function redeemMeeting(accountId: string, servantId: string, name: string, token: TokenRow): Promise<RedeemOutcome> {
  const activityKey = token.activityKey
  if (!activityKey) throw new PortalError('This code is not tied to a servant activity.')
  const activity = await prisma.servantActivity.findUnique({ where: { key: activityKey } })
  if (!activity || !activity.isActive) throw new PortalError('That servant activity no longer exists.')
  const weekStart = token.weekStart ? formatDateOnly(token.weekStart) : mondayOf(todayInNewYork())

  const outcome: RedeemOutcome = {
    title: activity.label,
    detail: `You are marked attended for ${activity.label}, week of ${formatLongDate(weekStart)}.`,
    points: null,
    already: false,
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.qrRedemption.create({ data: { tokenId: token.token, accountId, name } })
      await tx.servantAttendance.upsert({
        where: { servantId_activityKey_weekStart: { servantId, activityKey, weekStart: toUTCDate(weekStart) } },
        create: {
          servantId,
          activityKey,
          weekStart: toUTCDate(weekStart),
          status: 'PRESENT',
          reason: null,
          markedById: accountId,
        },
        update: { status: 'PRESENT', reason: null, markedById: accountId },
      })
    })
  } catch (err) {
    if (!isAlreadyRedeemed(err)) throw err
    outcome.already = true
    outcome.detail = `You already checked in for ${activity.label} this week.`
  }
  return outcome
}

/* ── Scanning a student's card ────────────────────────────────────────────── */

const ScanSchema = z.object({
  classId: z.string().min(1).max(64),
  code: z.string().min(1).max(500),
  mode: z.enum(['ATTENDANCE', 'POINTS']),
  sessionKey: z.string().min(1).max(64).optional(),
  activityId: z.string().min(1).max(64).optional(),
  date: z.string().max(10).optional(),
})

export type ScanStudentInput = z.infer<typeof ScanSchema>

export interface ResolvedScan {
  studentId: string
  name: string
  /** Already marked present / already has this activity today. */
  already: boolean
}

/**
 * Identify who a scanned card belongs to, and write nothing.
 *
 * The prototype queued scans and let the servant look over the list before
 * committing; the port wrote on every scan with only an after-the-fact Undo, so
 * a mis-scan at the door was already a row in the register. This is the
 * resolution half on its own.
 *
 * It keeps `scanStudent`'s permission check exactly: without it, anyone could
 * turn this into a way to test which IDs exist in a class.
 */
export async function resolveScan(raw: ScanStudentInput): Promise<ActionResult<ResolvedScan>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ScanSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, input.mode === 'ATTENDANCE' ? 'attendance.write' : 'points.write')

    const loginId = parseStudentPayload(input.code)
    if (!loginId) throw new PortalError('That is not a student card. Scan a portal QR card or type a 4-digit ID.')

    const student = await prisma.student.findFirst({
      where: { classId: cls.id, account: { loginId, isActive: true } },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!student) throw new PortalError(`No student with ID ${loginId} in ${cls.name}.`)

    const date = parseDateOnly(input.date) ?? todayInNewYork()
    let already = false
    if (input.mode === 'ATTENDANCE' && input.sessionKey) {
      const existing = await prisma.attendanceRecord.findUnique({
        where: {
          studentId_date_sessionKey: { studentId: student.id, date: toUTCDate(date), sessionKey: input.sessionKey },
        },
        select: { status: true },
      })
      already = existing?.status === 'PRESENT'
    }

    return { studentId: student.id, name: studentName(student), already }
  })
}

export async function scanStudent(raw: ScanStudentInput): Promise<ActionResult<ScanOutcome>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ScanSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, input.mode === 'ATTENDANCE' ? 'attendance.write' : 'points.write')

    const loginId = parseStudentPayload(input.code)
    if (!loginId) throw new PortalError('That is not a student card. Scan a portal QR card or type a 4-digit ID.')

    const student = await prisma.student.findFirst({
      where: { classId: cls.id, account: { loginId, isActive: true } },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!student) throw new PortalError(`No student with ID ${loginId} in ${cls.name}.`)
    const name = studentName(student)
    const date = parseDateOnly(input.date) ?? todayInNewYork()

    if (input.mode === 'ATTENDANCE') {
      if (!input.sessionKey) throw new PortalError('Pick a session first.')
      const session = await prisma.attendanceSession.findUnique({ where: { key: input.sessionKey } })
      if (!session || !session.isActive) throw new PortalError('That session is no longer available.')
      const day = toUTCDate(date)

      const existing = await prisma.attendanceRecord.findUnique({
        where: { studentId_date_sessionKey: { studentId: student.id, date: day, sessionKey: session.key } },
        select: { id: true, status: true },
      })
      if (existing?.status === 'PRESENT') {
        return { studentId: student.id, name, message: `${name} was already present.`, already: true, undo: null }
      }

      const recordId = await prisma.$transaction(async (tx) => {
        const record = await tx.attendanceRecord.upsert({
          where: { studentId_date_sessionKey: { studentId: student.id, date: day, sessionKey: session.key } },
          create: {
            studentId: student.id,
            classId: cls.id,
            date: day,
            sessionKey: session.key,
            status: 'PRESENT',
            note: 'Scanned in',
            markedById: user.accountId,
          },
          update: { classId: cls.id, status: 'PRESENT', reason: null, note: 'Scanned in', markedById: user.accountId },
          select: { id: true },
        })
        await awardAttendancePoints(tx, await withAward(tx, record.id), {
          studentId: student.id,
          classId: cls.id,
          sessionKey: session.key,
          sessionLabel: session.label,
          sessionPoints: session.points,
          accountId: user.accountId,
        })
        return record.id
      })

      await audit(user, 'qr.scan.attendance', 'student', student.id, `${cls.name}: scanned ${name} present for ${session.label} on ${date}`)
      revalidatePath(`/portal/classes/${cls.id}/attendance`)
      revalidatePath('/portal')
      return {
        studentId: student.id,
        name,
        message: `${name} marked present${session.points > 0 ? ` · +${session.points}` : ''}`,
        already: false,
        undo: { kind: 'ATTENDANCE' as const, id: recordId },
      }
    }

    if (!input.activityId) throw new PortalError('Pick an activity first.')
    const activity = await prisma.pointActivity.findUnique({ where: { id: input.activityId } })
    if (!activity || !activity.isActive) throw new PortalError('That activity is no longer available.')
    if (activity.classId && activity.classId !== cls.id) throw new PortalError('That activity belongs to another class.')

    const entry = await prisma.pointEntry.create({
      data: {
        studentId: student.id,
        classId: cls.id,
        points: activity.points,
        source: 'QR',
        activityKey: activity.key,
        activityLabel: activity.label,
        reason: 'Scanned card',
        createdById: user.accountId,
      },
      select: { id: true },
    })
    await audit(user, 'qr.scan.points', 'student', student.id, `${cls.name}: scanned ${name} for "${activity.label}" (${activity.points})`)
    revalidatePath(`/portal/classes/${cls.id}/points`)
    revalidatePath('/portal/leaderboard')
    return {
      studentId: student.id,
      name,
      message: `${name} · ${activity.points > 0 ? '+' : ''}${activity.points} ${activity.label}`,
      already: false,
      undo: { kind: 'POINTS' as const, id: entry.id },
    }
  })
}

const UndoSchema = z.object({
  kind: z.enum(['ATTENDANCE', 'POINTS']),
  id: z.string().min(1).max(64),
})

export async function undoScan(raw: z.infer<typeof UndoSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = UndoSchema.parse(raw)

    if (input.kind === 'POINTS') {
      const result = await undoPoints(input.id)
      if (!result.ok) throw new PortalError(result.error)
      return undefined
    }

    const record = await prisma.attendanceRecord.findUnique({
      where: { id: input.id },
      select: { id: true, classId: true, sessionKey: true, date: true, student: { select: { firstName: true, lastName: true } } },
    })
    if (!record) throw new PortalError('That check-in is already gone.')
    const cls = await assertClassAction(user, record.classId, 'attendance.write')
    // The linked PointEntry is removed by the cascade on attendanceRecordId.
    await prisma.attendanceRecord.delete({ where: { id: record.id } })
    await audit(
      user,
      'qr.scan.undo',
      'student',
      record.id,
      `${cls.name}: undid ${record.sessionKey} check-in for ${studentName(record.student)} on ${formatDateOnly(record.date)}`,
    )
    revalidatePath(`/portal/classes/${cls.id}/attendance`)
    revalidatePath('/portal/leaderboard')
    return undefined
  })
}

/**
 * Form wrapper for /portal/scan/[token]. The page re-renders afterwards and
 * derives what to show from the QrRedemption row, so a double submit is safe.
 *
 * A failed redemption must never be swallowed: redeemCode() resolves to
 * { ok: false, error } rather than throwing, so the reason is carried back to
 * the page in ?error= and rendered there. Without this the button would simply
 * re-appear with no feedback.
 */
export async function redeemCodeForm(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '')
  const result = await redeemCode(token)
  const path = `/portal/scan/${encodeURIComponent(token)}`
  revalidatePath(path)
  redirect(result.ok ? path : `${path}?error=${encodeURIComponent(result.error)}`)
}
