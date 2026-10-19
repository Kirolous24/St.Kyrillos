'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { studentClassIds } from '../class-members'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { studentName } from '../data/students'
import { formatDateOnly, parseDateOnly, toUTCDate } from '../dates'
import { EXCUSE_REASON_MAX, excuseDatesProblem } from '../excuses'
import type { PortalUser } from '../permissions'

/**
 * Follow-up excuses (2026-10-19): a child away for a while, with the dates and
 * the reason in the servant's own words (lib/portal/excuses.ts).
 *
 * Any servant who follows the child up in one of their classes may set, change
 * or remove one — whose group the child is in does not matter, the class does.
 * The excuse says who set it and who last changed it, and every change is in
 * the activity log with what it said before.
 */

const Reason = z
  .string()
  .trim()
  .min(1, 'Say why they are excused.')
  .max(EXCUSE_REASON_MAX, `Keep the reason under ${EXCUSE_REASON_MAX} characters.`)
const Day = z.string().trim().max(20)

const AddSchema = z.object({ studentId: z.string().min(1), startsOn: Day, endsOn: Day, reason: Reason })
const EditSchema = z.object({ excuseId: z.string().min(1), startsOn: Day, endsOn: Day, reason: Reason })

/** Validation messages are the servant's to read, not "Something went wrong". */
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw)
  if (!r.success) throw new PortalError(r.error.issues[0]?.message ?? 'Check the form and try again.')
  return r.data
}

function checkedDates(startsOn: string, endsOn: string): { start: string; end: string } {
  const problem = excuseDatesProblem(startsOn, endsOn)
  if (problem) throw new PortalError(problem)
  return { start: parseDateOnly(startsOn)!, end: parseDateOnly(endsOn)! }
}

/** The child, when this person follows them up in their own class or one they also belong to. */
async function childToExcuse(user: PortalUser, studentId: string) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, firstName: true, lastName: true, classId: true, memberships: { select: { classId: true } } },
  })
  if (!s) throw new PortalError('Child not found.')
  const classIds = studentClassIds(s)
  if (classIds.length === 0) throw new PortalError('This child has no class, so nobody follows them up yet.')
  for (const classId of classIds) {
    if (await assertClassAction(user, classId, 'followup.write').then(() => true, () => false)) return { ...s, classIds }
  }
  throw new PortalError('Only the servants of this child’s class can excuse them.')
}

async function excuseToChange(user: PortalUser, excuseId: string) {
  const e = await prisma.followUpExcuse.findUnique({
    where: { id: excuseId },
    select: { id: true, studentId: true, startsOn: true, endsOn: true, reason: true },
  })
  if (!e) throw new PortalError('That excuse no longer exists.')
  const child = await childToExcuse(user, e.studentId)
  const was = `${formatDateOnly(e.startsOn)} to ${formatDateOnly(e.endsOn)} — ${e.reason}`
  return { e, child, was }
}

function revalidateExcuse(studentId: string, classIds: readonly string[]): void {
  revalidatePath(`/portal/students/${studentId}`)
  revalidatePath('/portal/follow-ups', 'layout')
  revalidatePath('/portal/my-group')
  revalidatePath('/portal')
  for (const id of classIds) revalidatePath(`/portal/classes/${id}`)
}

export async function addExcuse(raw: z.input<typeof AddSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = parse(AddSchema, raw)
    const { start, end } = checkedDates(input.startsOn, input.endsOn)
    const child = await childToExcuse(user, input.studentId)
    const row = await prisma.followUpExcuse.create({
      data: {
        studentId: child.id,
        startsOn: toUTCDate(start),
        endsOn: toUTCDate(end),
        reason: input.reason,
        createdById: user.accountId,
      },
      select: { id: true },
    })
    await audit(user, 'followup.excuse.add', 'student', child.id, `${studentName(child)}: excused ${start} to ${end} — ${input.reason}`)
    revalidateExcuse(child.id, child.classIds)
    return { id: row.id }
  })
}

export async function updateExcuse(raw: z.input<typeof EditSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = parse(EditSchema, raw)
    const { start, end } = checkedDates(input.startsOn, input.endsOn)
    const { e, child, was } = await excuseToChange(user, input.excuseId)
    await prisma.followUpExcuse.update({
      where: { id: e.id },
      data: { startsOn: toUTCDate(start), endsOn: toUTCDate(end), reason: input.reason, updatedById: user.accountId },
    })
    await audit(
      user,
      'followup.excuse.edit',
      'student',
      child.id,
      `${studentName(child)}: was ${was}; now ${start} to ${end} — ${input.reason}`,
    )
    revalidateExcuse(child.id, child.classIds)
    return undefined
  })
}

export async function removeExcuse(excuseId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const id = parse(z.string().min(1), excuseId)
    const { e, child, was } = await excuseToChange(user, id)
    await prisma.followUpExcuse.delete({ where: { id: e.id } })
    await audit(user, 'followup.excuse.remove', 'student', child.id, `${studentName(child)}: removed the excuse ${was}`)
    revalidateExcuse(child.id, child.classIds)
    return undefined
  })
}
