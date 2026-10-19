'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { studentClassIds } from '../class-members'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { groupServantOf } from '../data/groups'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { studentName } from '../data/students'
import { parseDateOnly, toUTCDate } from '../dates'
import { MESSAGE_MAX, messageProblem } from '../family-messages'

/**
 * Family messages (2026-10-19, lib/portal/family-messages.ts): each class's own
 * message for each meeting, and a record of every message a servant sends a
 * family from the portal. The portal opens WhatsApp or Messages with the
 * message written in; it never sends anything itself, so what is recorded is
 * that the servant sent it, from their own phone.
 *
 * Any servant who follows the class up may do both, whoever's group the child
 * is in. Every change to a class's message is in the activity log with what it
 * said before.
 */

const Key = z.string().trim().min(1).max(60)
const SaveSchema = z.object({ classId: Key, sessionKey: Key, body: z.string().max(5000) })
const ResetSchema = z.object({ classId: Key, sessionKey: Key })
const RecordSchema = z.object({
  studentId: Key,
  classId: Key,
  channel: z.enum(['whatsapp', 'text', 'email']),
  /** Who in the family: Mother, Father, Parents, Student, Parent email… */
  to: z.string().trim().min(1).max(60),
  text: z.string().max(20000),
  /** Sent from a case's own composer. */
  caseId: Key.optional(),
  /** The meeting the child missed, when sent from Message families. */
  missed: z.object({ sessionKey: Key, date: z.string().trim().max(20) }).optional(),
})

/** Validation messages are the servant's to read, not "Something went wrong". */
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw)
  if (!r.success) throw new PortalError(r.error.issues[0]?.message ?? 'Check the message and try again.')
  return r.data
}

function checkedBody(raw: string): string {
  const body = raw.trim()
  const problem = messageProblem(body)
  if (problem) throw new PortalError(problem)
  return body
}

/** A meeting this class holds: one every class holds, or its own. */
async function meetingOf(classId: string, sessionKey: string) {
  const s = await prisma.attendanceSession.findUnique({
    where: { key: sessionKey },
    select: { key: true, label: true, isActive: true, classId: true },
  })
  if (!s || (s.classId !== null && s.classId !== classId)) throw new PortalError('That meeting is not one this class holds.')
  return s
}

export async function saveMeetingMessage(raw: z.infer<typeof SaveSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = parse(SaveSchema, raw)
    const cls = await assertClassAction(user, input.classId, 'followup.write')
    const meeting = await meetingOf(cls.id, input.sessionKey)
    const body = checkedBody(input.body)
    const key = { classId: cls.id, sessionKey: meeting.key }
    const before = await prisma.meetingMessage.findUnique({ where: { classId_sessionKey: key }, select: { body: true } })
    await prisma.meetingMessage.upsert({
      where: { classId_sessionKey: key },
      create: { ...key, body, updatedById: user.accountId },
      update: { body, updatedById: user.accountId },
    })
    await audit(user, 'message.save', 'class', cls.id, `${cls.name} · ${meeting.label}: ${body}${before ? ` (was: ${before.body})` : ''}`)
    revalidatePath(`/portal/classes/${cls.id}/message`)
    revalidatePath('/portal/follow-ups')
    return undefined
  })
}

/** Back to the church's standard message for that meeting. */
export async function resetMeetingMessage(raw: z.infer<typeof ResetSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = parse(ResetSchema, raw)
    const cls = await assertClassAction(user, input.classId, 'followup.write')
    const meeting = await meetingOf(cls.id, input.sessionKey)
    const before = await prisma.meetingMessage.findUnique({
      where: { classId_sessionKey: { classId: cls.id, sessionKey: meeting.key } },
      select: { body: true },
    })
    await prisma.meetingMessage.deleteMany({ where: { classId: cls.id, sessionKey: meeting.key } })
    await audit(user, 'message.reset', 'class', cls.id, `${cls.name} · ${meeting.label}: back to the standard message${before ? ` (was: ${before.body})` : ''}`)
    revalidatePath(`/portal/classes/${cls.id}/message`)
    revalidatePath('/portal/follow-ups')
    return undefined
  })
}

/**
 * A message a servant sent a family: a contact note like a logged call, on the
 * child's open case in this class when there is one, saying whose group the
 * child was in and, from Message families, which meeting it was about.
 */
export async function recordFamilyMessage(raw: z.infer<typeof RecordSchema>): Promise<ActionResult<{ onCase: boolean }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = parse(RecordSchema, raw)
    const cls = await assertClassAction(user, input.classId, 'followup.write')
    // It has already gone by the time this runs, so a long one is kept cut
    // short rather than refused: the record matters more than the length.
    const sentText = input.text.trim()
    if (!sentText) throw new PortalError('Write the message first.')
    const text = sentText.length > MESSAGE_MAX ? `${sentText.slice(0, MESSAGE_MAX - 1)}…` : sentText
    const s = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, firstName: true, lastName: true, classId: true, memberships: { select: { classId: true } } },
    })
    if (!s || !studentClassIds(s).includes(cls.id)) throw new PortalError('That child is not in this class.')

    let missed: { key: string; label: string; date: string } | null = null
    if (input.missed) {
      const date = parseDateOnly(input.missed.date)
      if (!date) throw new PortalError('That is not a date.')
      const meeting = await meetingOf(cls.id, input.missed.sessionKey)
      missed = { key: meeting.key, label: meeting.label, date }
    }

    const kase = await prisma.followUpCase.findFirst({
      where: input.caseId ? { id: input.caseId, studentId: s.id, classId: cls.id } : { studentId: s.id, classId: cls.id, status: 'OPEN' },
      select: { id: true },
    })
    if (input.caseId && !kase) throw new PortalError('That case is not this child’s.')

    await prisma.followUpLog.create({
      data: {
        studentId: s.id,
        caseId: kase?.id ?? null,
        method: input.channel,
        note: `To ${input.to}: ${text}`,
        byId: user.accountId,
        groupServantId: await groupServantOf(s.id),
        missedSessionKey: missed?.key ?? null,
        missedOn: missed ? toUTCDate(missed.date) : null,
      },
    })
    await audit(
      user,
      'followup.message',
      'student',
      s.id,
      `${studentName(s)}: ${input.channel} to ${input.to}${missed ? ` — missed ${missed.label} on ${missed.date}` : ''}`,
    )
    revalidatePath(`/portal/classes/${cls.id}/message`)
    revalidatePath('/portal/follow-ups', 'layout')
    revalidatePath('/portal/my-group')
    revalidatePath(`/portal/students/${s.id}`)
    return { onCase: !!kase }
  })
}
