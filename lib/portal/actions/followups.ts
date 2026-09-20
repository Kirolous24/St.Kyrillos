'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { studentName } from '../data/students'
import { parseDateOnly, toUTCDate } from '../dates'

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
      prisma.followUpCase.update({ where: { id: c.id }, data: { nextFollowUp: next ? toUTCDate(next) : undefined } }),
    ])
    await audit(user, 'followup.log', 'case', c.id, `${studentName(c.student)}: ${input.method}${input.result ? ` (${input.result})` : ''}`)
    revalidatePath(`/portal/follow-ups/${c.id}`)
    revalidatePath('/portal/follow-ups')
    return undefined
  })
}

const ResolveSchema = z.object({
  caseId: z.string().min(1),
  reason: z.enum(['attending_again', 'moved', 'sick', 'family', 'lost_interest', 'other']),
  note: z.string().trim().max(1000).optional(),
})

export async function resolveCase(raw: z.infer<typeof ResolveSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = ResolveSchema.parse(raw)
    const c = await loadCase(input.caseId)
    await assertClassAction(user, c.classId, 'followup.write')
    if (c.status === 'DONE') throw new PortalError('This case is already resolved.')
    await prisma.followUpCase.update({
      where: { id: c.id },
      data: { status: 'DONE', resolvedAt: new Date(), resolvedById: user.accountId, resolveReason: input.reason, resolveNote: input.note || null },
    })
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

const CreateSchema = z.object({
  studentId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  details: z.string().trim().max(1000).optional(),
})

export async function createManualCase(raw: z.infer<typeof CreateSchema>): Promise<ActionResult<{ caseId: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = CreateSchema.parse(raw)
    const s = await prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true, classId: true, firstName: true, lastName: true } })
    if (!s || !s.classId) throw new PortalError('Student not found or has no class.')
    const cls = await assertClassAction(user, s.classId, 'followup.write')
    const c = await prisma.followUpCase.create({
      data: { studentId: s.id, classId: cls.id, origin: 'MANUAL', title: input.title, details: input.details || null, createdById: user.accountId },
      select: { id: true },
    })
    await audit(user, 'followup.create', 'case', c.id, `${studentName(s)}: ${input.title}`)
    revalidatePath('/portal/follow-ups')
    revalidatePath(`/portal/students/${s.id}`)
    return { caseId: c.id }
  })
}
