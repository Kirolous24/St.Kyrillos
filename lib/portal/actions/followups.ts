'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { resolveReasonLabel } from '../followups'
import { studentName } from '../data/students'
import { parseDateOnly, toUTCDate, todayInNewYork, newYorkDayStart, daysBetween } from '../dates'

async function loadCase(id: string) {
  const c = await prisma.followUpCase.findUnique({
    where: { id },
    select: { id: true, classId: true, status: true, studentId: true, student: { select: { firstName: true, lastName: true } } },
  })
  if (!c) throw new PortalError('Case not found.')
  return c
}

const LogSchema = z.object({
  caseId: z.string().min(1),
  method: z.enum(['call', 'text', 'whatsapp', 'email', 'visit', 'other']),
  note: z.string().trim().max(1000).optional(),
  result: z.enum(['reached', 'no_answer', 'left_message', 'will_come', 'other']).optional(),
  nextFollowUp: z.string().trim().optional(),
})

export async function logContact(raw: z.infer<typeof LogSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = LogSchema.parse(raw)
    const c = await loadCase(input.caseId)
    await assertClassAction(user, c.classId, 'followup.write')
    const next = input.nextFollowUp ? parseDateOnly(input.nextFollowUp) : null
    await prisma.$transaction([
      prisma.followUpLog.create({ data: { caseId: c.id, method: input.method, note: input.note || null, result: input.result ?? null, byId: user.accountId } }),
      // `undefined` means "don't touch" to Prisma, so clearing the date was a no-op.
      prisma.followUpCase.update({ where: { id: c.id }, data: { nextFollowUp: next ? toUTCDate(next) : null } }),
    ])
    await audit(user, 'followup.log', 'case', c.id, `${studentName(c.student)}: ${input.method}${input.result ? ` (${input.result})` : ''}`)
    revalidatePath(`/portal/follow-ups/${c.id}`)
    revalidatePath('/portal/follow-ups')
    return undefined
  })
}

const ResolveSchema = z
  .object({
    caseId: z.string().min(1),
    reason: z.enum(['attending_again', 'moved', 'sick', 'family', 'lost_interest', 'other']),
    note: z.string().trim().max(1000).optional(),
  })
  // F0110 — "Other" with no note closes a case saying nothing at all, which is
  // indistinguishable from never recording a reason. Every other reason speaks
  // for itself.
  .refine((v) => v.reason !== 'other' || (v.note ?? '').length > 0, {
    message: 'Say what happened when the reason is "Other".',
    path: ['note'],
  })

export async function resolveCase(raw: z.infer<typeof ResolveSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ResolveSchema.parse(raw)
    const c = await loadCase(input.caseId)
    await assertClassAction(user, c.classId, 'followup.write')
    if (c.status === 'DONE') throw new PortalError('This case is already resolved.')
    // F0109 — resolving wrote the reason onto the case but left no entry on the
    // timeline, so the conversation that actually closed the case was missing
    // from the case's own history. Written together with the status change:
    // a resolved case with no record of why is the one thing this page exists
    // to prevent.
    await prisma.$transaction([
      prisma.followUpCase.update({
        where: { id: c.id },
        data: { status: 'DONE', resolvedAt: new Date(), resolvedById: user.accountId, resolveReason: input.reason, resolveNote: input.note || null },
      }),
      prisma.followUpLog.create({
        data: {
          caseId: c.id,
          method: 'resolved',
          note: input.note || null,
          result: resolveReasonLabel(input.reason),
          byId: user.accountId,
        },
      }),
    ])
    await audit(user, 'followup.resolve', 'case', c.id, `${studentName(c.student)}: ${input.reason}`)
    revalidatePath(`/portal/follow-ups/${c.id}`)
    revalidatePath('/portal/follow-ups')
    revalidatePath('/portal')
    return undefined
  })
}

export async function reopenCase(caseId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const c = await loadCase(caseId)
    await assertClassAction(user, c.classId, 'followup.write')
    await prisma.followUpCase.update({ where: { id: c.id }, data: { status: 'OPEN', resolvedAt: null, resolvedById: null, resolveReason: null, resolveNote: null } })
    await audit(user, 'followup.reopen', 'case', c.id, studentName(c.student))
    revalidatePath(`/portal/follow-ups/${c.id}`)
    revalidatePath('/portal/follow-ups')
    return undefined
  })
}

/**
 * Delete a case outright. The prototype offered this from four places (the row
 * trash icon, the case detail header, the pastor's list and the swipe action);
 * the port offered it from none, so a case opened by mistake — a wrong date, a
 * duplicate, a child who had actually moved away — could only ever be resolved,
 * never removed, and cluttered the list forever.
 *
 * Deleting the case cascades its contact log, which is the point: this is for
 * cases that should not exist, not for closing one out. Use resolveCase to
 * record a real outcome.
 */
export async function deleteCase(caseId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const c = await loadCase(caseId)
    await assertClassAction(user, c.classId, 'followup.write')
    await prisma.followUpCase.delete({ where: { id: c.id } })
    await audit(user, 'followup.delete', 'case', c.id, studentName(c.student))
    revalidatePath('/portal/follow-ups')
    revalidatePath('/portal')
    return undefined
  })
}

/**
 * F0113 — delete several closed cases in one go.
 *
 * The portal's own advice is that a resolved case is worth keeping: it is the
 * written record that somebody actually phoned a family about a child who had
 * stopped coming. The church asked for the bulk delete anyway, on the condition
 * that it asks first — so the control is deliberately kept away from the
 * ordinary reading view, offered only on the resolved list, and the caller
 * confirms with the count in front of them.
 *
 * Only closed cases: an open case is a child nobody has reached yet, and
 * sweeping one of those away is a different act entirely. Permission is checked
 * per case rather than once for the batch, so a servant can only clear cases in
 * classes they already work with.
 */
export async function bulkDeleteCases(caseIds: string[]): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const ids = Array.from(new Set(caseIds.filter((id) => typeof id === 'string' && id)))
    if (ids.length === 0) throw new PortalError('Nothing was selected.')
    if (ids.length > 200) throw new PortalError('Clear at most 200 cases at a time.')

    const cases = await prisma.followUpCase.findMany({
      where: { id: { in: ids } },
      select: { id: true, classId: true, status: true, student: { select: { firstName: true, lastName: true } } },
    })
    if (cases.length === 0) throw new PortalError('Those cases no longer exist.')

    const open = cases.filter((c) => c.status !== 'DONE')
    if (open.length > 0) {
      throw new PortalError(
        `${open.length} of those ${open.length === 1 ? 'is' : 'are'} still open. Only closed cases can be cleared.`,
      )
    }

    // One check per class rather than per case, but every class represented has
    // to pass before anything is deleted.
    for (const classId of Array.from(new Set(cases.map((c) => c.classId)))) {
      await assertClassAction(user, classId, 'followup.write')
    }

    await prisma.followUpCase.deleteMany({ where: { id: { in: cases.map((c) => c.id) } } })
    await audit(
      user,
      'followup.bulkDelete',
      'case',
      null,
      `Cleared ${cases.length} closed case${cases.length === 1 ? '' : 's'}: ${cases.map((c) => studentName(c.student)).join(', ')}`,
    )
    revalidatePath('/portal/follow-ups')
    revalidatePath('/portal')
    return { deleted: cases.length }
  })
}

const RESOLVE_REASONS = ['attending_again', 'moved', 'sick', 'family', 'lost_interest', 'other'] as const

/**
 * F0106 — the two things a servant opening a case on a Sunday actually needed.
 *
 * The finding asked for a fixed list of reasons to pick from when a case opens.
 * That list is largely redundant: the portal already forces a reason when a case
 * is *closed*, which is where the countable answer lives, and a label pinned on
 * a child at the moment of opening is much harder to take back than a sentence
 * in their own words. What was genuinely missing was smaller and needs no change
 * to the database against live children's records:
 *
 *   `openedOn`      — the conversation happened on Sunday; this is being typed up
 *                     on Wednesday, and the case should be dated when it started.
 *   `alreadyHandled` — somebody phoned the family before anyone opened a case, so
 *                     it goes straight into the record as closed rather than
 *                     sitting on the open list asking to be chased again.
 */
const CreateSchema = z
  .object({
    studentId: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    details: z.string().trim().max(1000).optional(),
    /** Date-only, church time. Defaults to today. */
    openedOn: z.string().trim().max(20).optional(),
    alreadyHandled: z.boolean().optional(),
    resolveReason: z.enum(RESOLVE_REASONS).optional(),
    resolveNote: z.string().trim().max(1000).optional(),
  })
  // Same rule the close form already follows: "Other" saying nothing is
  // indistinguishable from no reason at all.
  .refine((v) => !v.alreadyHandled || !!v.resolveReason, {
    message: 'Say how it was sorted out.',
    path: ['resolveReason'],
  })
  .refine((v) => !v.alreadyHandled || v.resolveReason !== 'other' || (v.resolveNote ?? '').length > 0, {
    message: 'Say what happened when the reason is "Other".',
    path: ['resolveNote'],
  })

export async function createManualCase(raw: z.infer<typeof CreateSchema>): Promise<ActionResult<{ caseId: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = CreateSchema.parse(raw)
    const s = await prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true, classId: true, firstName: true, lastName: true } })
    if (!s || !s.classId) throw new PortalError('Student not found or has no class.')
    const cls = await assertClassAction(user, s.classId, 'followup.write')

    // F0106 — when it actually started. A case typed up midweek about Sunday's
    // conversation should not read as though nothing happened until Wednesday:
    // the age of a case is what puts it at the top of the list. A future date is
    // refused, and so is one absurdly far back, which is almost always a typo.
    const today = todayInNewYork()
    let openedAt: Date | undefined
    if (input.openedOn) {
      const parsed = parseDateOnly(input.openedOn)
      if (!parsed) throw new PortalError('That is not a valid date.')
      if (input.openedOn > today) throw new PortalError('A case cannot be opened in the future.')
      if (daysBetween(input.openedOn, today) > 365) {
        throw new PortalError('That date is more than a year ago — check it is right.')
      }
      openedAt = newYorkDayStart(input.openedOn)
    }

    const handled = input.alreadyHandled === true

    // One open case per student, as the prototype enforced (OG L17440-17451).
    // Without it a child could carry two at once — a manual one a servant
    // opened and an automatic one the absence rule raised — so the list showed
    // the same child twice and resolving one left the other sitting there.
    // A case recorded as already sorted is not open, so it does not collide:
    // writing up last month's phone call must not be blocked by this week's.
    if (!handled) {
      const existing = await prisma.followUpCase.findFirst({
        where: { studentId: s.id, status: 'OPEN' },
        select: { id: true, origin: true, title: true },
      })
      if (existing) {
        throw new PortalError(
          `${studentName(s)} already has an open case (“${existing.title}”)${
            existing.origin === 'AUTO' ? ', opened automatically' : ''
          }. Resolve or delete that one first.`,
        )
      }
    }

    const c = await prisma.followUpCase.create({
      data: {
        studentId: s.id,
        classId: cls.id,
        origin: 'MANUAL',
        title: input.title,
        details: input.details || null,
        createdById: user.accountId,
        ...(openedAt ? { createdAt: openedAt } : {}),
        ...(handled
          ? {
              status: 'DONE' as const,
              resolvedAt: openedAt ?? new Date(),
              resolvedById: user.accountId,
              resolveReason: input.resolveReason ?? null,
              resolveNote: input.resolveNote || null,
            }
          : {}),
      },
      select: { id: true },
    })
    await audit(
      user,
      'followup.create',
      'case',
      c.id,
      `${studentName(s)}: ${input.title}${input.openedOn ? ` (dated ${input.openedOn})` : ''}${handled ? ' — recorded as already sorted out' : ''}`,
    )
    revalidatePath('/portal/follow-ups')
    revalidatePath(`/portal/students/${s.id}`)
    return { caseId: c.id }
  })
}
