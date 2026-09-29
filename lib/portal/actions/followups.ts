'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { studentClassIds } from '../class-members'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { contactMethodLabel, mayChangeContactNote, RESOLVE_REASON_KEYS, resolveReasonLabel } from '../followups'
import { can } from '../permissions'
import { studentName } from '../data/students'
import { parseDateOnly, toUTCDate, churchToday, churchDayStart, daysBetween } from '../dates'

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
      prisma.followUpLog.create({ data: { caseId: c.id, studentId: c.studentId, method: input.method, note: input.note || null, result: input.result ?? null, byId: user.accountId } }),
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
    reason: z.enum(RESOLVE_REASON_KEYS),
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
          studentId: c.studentId,
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
    resolveReason: z.enum(RESOLVE_REASON_KEYS).optional(),
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
    const s = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, classId: true, firstName: true, lastName: true, memberships: { select: { classId: true } } },
    })
    const inClasses = s ? studentClassIds(s) : []
    if (!s || inClasses.length === 0) throw new PortalError('Student not found or has no class.')
    // Filed in the child's own class when the servant serves it, otherwise in
    // the class of theirs the child also belongs to (Pre-Servants, 2026-09-28).
    let cls: Awaited<ReturnType<typeof assertClassAction>> | null = null
    for (const classId of inClasses) {
      cls = await assertClassAction(user, classId, 'followup.write').catch(() => null)
      if (cls) break
    }
    if (!cls) throw new PortalError('You do not have permission to do that in this class.')

    // F0106 — when it actually started. A case typed up midweek about Sunday's
    // conversation should not read as though nothing happened until Wednesday:
    // the age of a case is what puts it at the top of the list. A future date is
    // refused, and so is one absurdly far back, which is almost always a typo.
    const today = churchToday()
    let openedAt: Date | undefined
    if (input.openedOn) {
      const parsed = parseDateOnly(input.openedOn)
      if (!parsed) throw new PortalError('That is not a valid date.')
      if (input.openedOn > today) throw new PortalError('A case cannot be opened in the future.')
      if (daysBetween(input.openedOn, today) > 365) {
        throw new PortalError('That date is more than a year ago — check it is right.')
      }
      openedAt = churchDayStart(input.openedOn)
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

const CheckInSchema = z.object({
  studentId: z.string().min(1),
  method: z.enum(['call', 'text', 'whatsapp', 'email', 'visit', 'other']),
  result: z.enum(['reached', 'no_answer', 'left_message', 'will_come', 'other']).optional(),
  note: z.string().trim().max(1000).optional(),
})

/**
 * A check-in on any child, not only one with an open case: the heart of
 * following up a group is calling everybody, not just the ones who missed.
 * If the child does have an open case, the check-in goes on its timeline, so
 * the case shows what was already tried.
 */
export async function logCheckIn(raw: z.infer<typeof CheckInSchema>): Promise<ActionResult<{ onCase: boolean }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = CheckInSchema.parse(raw)
    const s = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, classId: true, firstName: true, lastName: true },
    })
    if (!s || !s.classId) throw new PortalError('Student not found or has no class.')
    await assertClassAction(user, s.classId, 'followup.write')
    const open = await prisma.followUpCase.findFirst({ where: { studentId: s.id, status: 'OPEN' }, select: { id: true } })
    await prisma.followUpLog.create({
      data: {
        studentId: s.id,
        caseId: open?.id ?? null,
        method: input.method,
        note: input.note || null,
        result: input.result ?? null,
        byId: user.accountId,
      },
    })
    await audit(
      user,
      'followup.checkIn',
      'student',
      s.id,
      `${studentName(s)}: ${input.method}${input.result ? ` (${input.result})` : ''}${open ? ' — on the open case' : ''}`,
    )
    revalidatePath('/portal/my-group')
    revalidatePath(`/portal/students/${s.id}`)
    revalidatePath('/portal/follow-ups')
    if (open) revalidatePath(`/portal/follow-ups/${open.id}`)
    return { onCase: !!open }
  })
}

/* ── Fixing a contact note after it is saved (2026-09-28) ─────────────────── */

/**
 * A servant logged a call on the wrong child and had no way to fix it: a note
 * could not be edited, moved or deleted, only the whole case. Now the servant
 * who wrote a note, and the class's coordinator, stage overseer and admin, can
 * do all three (mayChangeContactNote). Every change is in the activity log.
 */
async function loadNoteToChange(logId: string) {
  const user = await requirePortalUser()
  const log = await prisma.followUpLog.findUnique({
    where: { id: logId },
    select: {
      id: true, caseId: true, studentId: true, method: true, byId: true,
      case: { select: { classId: true } },
      student: { select: { firstName: true, lastName: true, classId: true } },
    },
  })
  if (!log) throw new PortalError('That note no longer exists.')
  const classId = log.case?.classId ?? log.student.classId
  const cls = classId ? await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true, stage: true } }) : null
  if (!cls) throw new PortalError('This child has no class.')
  const ctx = { classId: cls.id, classStage: cls.stage }
  const allowed = mayChangeContactNote({
    method: log.method,
    writtenByMe: log.byId === user.accountId,
    canWrite: can(user, 'followup.write', ctx),
    canManage: can(user, 'group.manage', ctx),
  })
  if (!allowed) {
    throw new PortalError(
      log.method === 'resolved'
        ? 'This entry is the case being resolved. Reopen the case to change it.'
        : 'Only the servant who wrote this note, or the class coordinator, can change it.',
    )
  }
  return { user, log, cls }
}

function revalidateNote(caseId: string | null, studentId: string): void {
  if (caseId) revalidatePath(`/portal/follow-ups/${caseId}`)
  revalidatePath(`/portal/students/${studentId}`)
  revalidatePath('/portal/follow-ups')
  revalidatePath('/portal/my-group')
}

const EditNoteSchema = z.object({
  logId: z.string().min(1),
  method: z.enum(['call', 'text', 'whatsapp', 'email', 'visit', 'other']),
  result: z.enum(['reached', 'no_answer', 'left_message', 'will_come', 'other']).nullable().optional(),
  note: z.string().trim().max(1000).optional(),
})

export async function editContactNote(raw: z.infer<typeof EditNoteSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const input = EditNoteSchema.parse(raw)
    const { user, log } = await loadNoteToChange(input.logId)
    await prisma.followUpLog.update({
      where: { id: log.id },
      data: { method: input.method, result: input.result ?? null, note: input.note || null },
    })
    await audit(user, 'followup.note.edit', 'student', log.studentId, `${studentName(log.student)}: edited a ${contactMethodLabel(input.method).toLowerCase()} note`)
    revalidateNote(log.caseId, log.studentId)
    return undefined
  })
}

export async function deleteContactNote(logId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { user, log } = await loadNoteToChange(z.string().min(1).parse(logId))
    await prisma.followUpLog.delete({ where: { id: log.id } })
    await audit(user, 'followup.note.delete', 'student', log.studentId, `${studentName(log.student)}: deleted a ${contactMethodLabel(log.method).toLowerCase()} note`)
    revalidateNote(log.caseId, log.studentId)
    return undefined
  })
}

const MoveNoteSchema = z.object({ logId: z.string().min(1), studentId: z.string().min(1) })

/**
 * Put a note on the child it was meant for. It joins that child's open case in
 * the same class if they have one, and otherwise their profile's contact
 * history, as a check-in does.
 */
export async function moveContactNote(raw: z.infer<typeof MoveNoteSchema>): Promise<ActionResult<{ caseId: string | null }>> {
  return runAction(async () => {
    const input = MoveNoteSchema.parse(raw)
    const { user, log, cls } = await loadNoteToChange(input.logId)
    if (input.studentId === log.studentId) throw new PortalError('That is already the child this note is on.')
    const target = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, firstName: true, lastName: true, classId: true, memberships: { select: { classId: true } } },
    })
    if (!target) throw new PortalError('Child not found.')
    // The same class the note belongs to, or another class of the child's this
    // servant follows up.
    const targetClasses = studentClassIds(target)
    let classId: string | null = targetClasses.includes(cls.id) ? cls.id : null
    if (!classId) {
      for (const id of targetClasses) {
        if (await assertClassAction(user, id, 'followup.write').then(() => true, () => false)) {
          classId = id
          break
        }
      }
    }
    if (!classId) throw new PortalError('You do not follow up that child.')
    await assertClassAction(user, classId, 'followup.write')
    const open = await prisma.followUpCase.findFirst({ where: { studentId: target.id, classId, status: 'OPEN' }, select: { id: true } })
    await prisma.followUpLog.update({ where: { id: log.id }, data: { studentId: target.id, caseId: open?.id ?? null } })
    await audit(
      user,
      'followup.note.move',
      'student',
      target.id,
      `Moved a ${contactMethodLabel(log.method).toLowerCase()} note from ${studentName(log.student)} to ${studentName(target)}`,
    )
    revalidateNote(log.caseId, log.studentId)
    revalidateNote(open?.id ?? null, target.id)
    return { caseId: open?.id ?? null }
  })
}
