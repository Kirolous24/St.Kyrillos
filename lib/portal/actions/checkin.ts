'use server'

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isUniqueViolationOn } from '@/lib/prisma-errors'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { rosterWhere } from '../class-members'
import { SELF_CHECKIN_NOTE as SELF_NOTE, checkInLabels, selfCheckInDecision } from '../fellowship'
import { normaliseShortCode, parseTokenPayload } from '../qr'
import { churchToday, formatDateOnly, toUTCDate } from '../dates'
import { syncAutoFollowUps } from '../followup-sync'

/**
 * A Fellowship member checking themselves in (2026-10-24), with no sign-in:
 * they scan the meeting's code with the phone camera and tap their name. The
 * user chose this knowing someone could tap a friend who is not there, so the
 * brakes are here: only a live MEMBER_CHECKIN code (five minutes), only that
 * meeting's people, one name per phone per code, and every self check-in shown
 * to the meeting's servants, who can undo it.
 *
 * Every export of a 'use server' module is a public endpoint, and these are
 * meant to be: the code itself is the key. Nothing here reads or trusts a
 * session.
 */

/** The phone's check-in cookie; only its sha256 is stored. */
const DEVICE_COOKIE = 'sk_ci'

/** This phone, as the hash of its check-in cookie. Made on first use when `create`. */
function deviceOf(create: boolean): string | null {
  const jar = cookies()
  let value = jar.get(DEVICE_COOKIE)?.value
  if (!value || !/^[0-9a-f]{32}$/.test(value)) {
    if (!create) return null
    value = randomBytes(16).toString('hex')
    jar.set(DEVICE_COOKIE, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/portal/checkin',
      maxAge: 60 * 60 * 24,
    })
  }
  return createHash('sha256').update(value).digest('hex')
}

/** A live check-in code, or a plain reason it is not one. */
async function liveCode(raw: string) {
  const token = parseTokenPayload(raw)
  if (!token || token.length < 32) throw new PortalError('That check-in code is not valid.')
  const row = await prisma.qrToken.findUnique({
    where: { token },
    select: { token: true, kind: true, classIds: true, sessionKey: true, activityLabel: true, date: true, expiresAt: true },
  })
  if (!row || row.kind !== 'MEMBER_CHECKIN' || row.classIds.length !== 1 || !row.sessionKey) {
    throw new PortalError('That check-in code is not valid.')
  }
  if (row.expiresAt.getTime() <= Date.now()) throw new PortalError('This code has expired. Ask a servant to show a new one.')
  return {
    token: row.token,
    classId: row.classIds[0]!,
    sessionKey: row.sessionKey,
    meeting: row.activityLabel ?? 'the meeting',
    date: row.date ? formatDateOnly(row.date) : churchToday(),
  }
}

/** Re-score one member's follow-ups for the meeting, as the register does on save. */
async function rescore(code: { classId: string; sessionKey: string; meeting: string; date: string }, studentId: string) {
  const cls = await prisma.schoolClass.findUnique({ where: { id: code.classId }, select: { visitationThreshold: true } })
  await syncAutoFollowUps({
    classId: code.classId,
    studentIds: [studentId],
    threshold: cls?.visitationThreshold ?? 2,
    asOf: code.date,
    session: { key: code.sessionKey, label: code.meeting },
  })
}

async function note(entityId: string, detail: string) {
  await prisma.portalAuditLog
    .create({ data: { actorId: null, actorName: 'Self check-in (QR)', action: 'fellowship.checkin', entity: 'student', entityId, detail } })
    .catch(() => {})
}

/** Check one member in from their own phone. */
export async function selfCheckIn(
  tokenRaw: string,
  studentId: string,
): Promise<ActionResult<{ name: string; meeting: string; already: boolean }>> {
  return runAction(async () => {
    const code = await liveCode(String(tokenRaw ?? ''))
    const person = await prisma.student.findFirst({
      where: { AND: [rosterWhere(code.classId), { id: String(studentId ?? '') }] },
      select: { id: true, accountId: true, firstName: true, lastName: true },
    })
    if (!person) throw new PortalError('That name is not on this meeting’s list. Ask a servant to add you.')
    const roster = await prisma.student.findMany({ where: rosterWhere(code.classId), select: { id: true, firstName: true, lastName: true } })
    const label = checkInLabels(roster).get(person.id) ?? person.firstName
    const device = deviceOf(true)!
    const day = toUTCDate(code.date)
    const [redemptions, record] = await Promise.all([
      prisma.qrRedemption.findMany({ where: { tokenId: code.token }, select: { accountId: true, device: true, name: true } }),
      prisma.attendanceRecord.findUnique({
        where: { studentId_date_sessionKey: { studentId: person.id, date: day, sessionKey: code.sessionKey } },
        select: { status: true },
      }),
    ])
    const decision = selfCheckInDecision({ accountId: person.accountId, device, redemptions, present: record?.status === 'PRESENT' })
    if (decision === 'phone-used') {
      const who = redemptions.find((r) => r.device === device)?.name ?? 'someone'
      throw new PortalError(`This phone already checked in ${who}. Ask a servant to mark anyone else.`)
    }
    if (decision === 'already') {
      // Already here (a servant marked them, or another phone did). This phone
      // is still tied to them, so it cannot go on to check in a friend.
      const bound = redemptions.some((r) => r.accountId === person.accountId || r.device === device)
      if (!bound) {
        await prisma.qrRedemption
          .create({ data: { tokenId: code.token, accountId: person.accountId, name: label, device } })
          .catch((err) => {
            if (!isUniqueViolationOn(err, 'QrRedemption', 'tokenId')) throw err
          })
      }
      return { name: label, meeting: code.meeting, already: true }
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.qrRedemption.create({ data: { tokenId: code.token, accountId: person.accountId, name: label, device } })
        await tx.attendanceRecord.upsert({
          where: { studentId_date_sessionKey: { studentId: person.id, date: day, sessionKey: code.sessionKey } },
          create: { studentId: person.id, classId: code.classId, date: day, sessionKey: code.sessionKey, status: 'PRESENT', note: SELF_NOTE, markedById: null },
          update: { classId: code.classId, status: 'PRESENT', reason: null, note: SELF_NOTE, markedById: null },
          select: { id: true },
        })
      })
    } catch (err) {
      // Two taps at once: the first one counted.
      if (isUniqueViolationOn(err, 'QrRedemption', 'tokenId')) return { name: label, meeting: code.meeting, already: true }
      throw err
    }
    // Back at the meeting: an open follow-up closes.
    await rescore(code, person.id)
    await note(person.id, `${code.meeting}: ${label} checked in on ${code.date}`)
    revalidatePath(`/portal/classes/${code.classId}`)
    revalidatePath(`/portal/classes/${code.classId}/attendance`)
    return { name: label, meeting: code.meeting, already: false }
  })
}

/** "Not you?": take back this phone's own check-in, while the code is live. */
export async function undoSelfCheckIn(tokenRaw: string): Promise<ActionResult> {
  return runAction(async () => {
    const code = await liveCode(String(tokenRaw ?? ''))
    const device = deviceOf(false)
    const mine = device
      ? await prisma.qrRedemption.findFirst({ where: { tokenId: code.token, device }, select: { id: true, accountId: true, name: true } })
      : null
    if (!mine) throw new PortalError('This phone has not checked anyone in with this code.')
    const person = await prisma.student.findUnique({ where: { accountId: mine.accountId }, select: { id: true } })
    const record = person
      ? await prisma.attendanceRecord.findUnique({
          where: { studentId_date_sessionKey: { studentId: person.id, date: toUTCDate(code.date), sessionKey: code.sessionKey } },
          select: { id: true, note: true, markedById: true },
        })
      : null
    await prisma.$transaction(async (tx) => {
      await tx.qrRedemption.delete({ where: { id: mine.id } })
      // Only the self check-in itself: a mark a servant has made since stays.
      if (record && record.note === SELF_NOTE && record.markedById === null) await tx.attendanceRecord.delete({ where: { id: record.id } })
    })
    if (person) {
      await rescore(code, person.id)
      await note(person.id, `${code.meeting}: ${mine.name}'s check-in on ${code.date} was taken back from their phone`)
    }
    revalidatePath(`/portal/classes/${code.classId}`)
    revalidatePath(`/portal/classes/${code.classId}/attendance`)
    return undefined
  })
}

/** The typed short code under the QR, for a camera that will not focus. */
export async function findCheckInCode(raw: string): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const prefix = normaliseShortCode(String(raw ?? ''))
    if (!prefix) throw new PortalError('Type the eight letters and numbers under the code, like A3F9-2C1B.')
    const row = await prisma.qrToken.findFirst({
      where: { token: { startsWith: prefix }, kind: 'MEMBER_CHECKIN', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { token: true },
    })
    if (!row) throw new PortalError('No live check-in code starts with that. Ask a servant to show the code again.')
    return { token: row.token }
  })
}
