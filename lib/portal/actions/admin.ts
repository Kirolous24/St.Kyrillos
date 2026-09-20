'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate } from '../dates'
import { normalizePhone } from '../phones'
import { audit } from '../audit'
import { freeLoginId, randomPin } from '../credentials'
import type { PortalUser } from '../permissions'

async function requireAdmin(): Promise<PortalUser> {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') throw new PortalError('Only the Sunday School admin can do that.')
  return user
}

// ── Servants / staff ──────────────────────────────────────────────────────

// Not exported: Next.js requires every export of a "use server" module to be an
// async function, and a Zod object throws at action-invocation time. The
// inferred type below is erased at compile time, so exporting it is fine.
const ServantFormSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(80),
  role: z.enum(['SERVANT', 'ADMIN', 'PASTOR']),
  email: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  birthday: z.string().trim().optional(),
  address: z.string().trim().max(200).optional(),
  stageOversight: z.enum(['', 'ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).optional(),
  classes: z.array(z.object({ classId: z.string().min(1), title: z.enum(['', 'COORDINATOR', 'ASSISTANT_COORDINATOR']) })).max(20),
  isActive: z.boolean().optional(),
})

export type ServantFormInput = z.infer<typeof ServantFormSchema>

function servantData(input: ServantFormInput) {
  const birthday = input.birthday ? parseDateOnly(input.birthday) : null
  if (input.birthday && !birthday) throw new PortalError('Birthday is not a valid date.')
  const email = input.email?.toLowerCase() || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new PortalError('Email address is not valid.')
  return {
    account: { displayName: input.displayName, email, phone: normalizePhone(input.phone), isActive: input.isActive ?? true },
    servant: { birthday: birthday ? toUTCDate(birthday) : null, address: input.address || null, stageOversight: input.stageOversight || null },
  }
}

export async function createServant(raw: ServantFormInput): Promise<ActionResult<{ accountId: string; loginId: string; pin: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ServantFormSchema.parse(raw)
    const data = servantData(input)
    const loginId = await freeLoginId()
    const pin = randomPin()
    const account = await prisma.account.create({
      data: {
        loginId,
        pinHash: await bcrypt.hash(pin, 10),
        role: input.role,
        ...data.account,
        servant: input.role === 'SERVANT' || input.role === 'PASTOR' || input.role === 'ADMIN'
          ? { create: { ...data.servant, classes: { create: input.classes.map((c, i) => ({ classId: c.classId, title: c.title || null, sortOrder: i })) } } }
          : undefined,
      },
      select: { id: true },
    })
    await audit(user, 'servant.create', 'account', account.id, `Added ${input.role.toLowerCase()} ${input.displayName} (ID ${loginId})`)
    revalidatePath('/portal/admin/servants')
    revalidatePath('/portal/classes')
    return { accountId: account.id, loginId, pin }
  })
}

export async function updateServant(accountId: string, raw: ServantFormInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ServantFormSchema.parse(raw)
    const data = servantData(input)
    const existing = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, role: true, servant: { select: { id: true } } } })
    if (!existing || existing.role === 'STUDENT') throw new PortalError('Account not found.')
    if (existing.id === user.accountId && (input.role !== 'ADMIN' || input.isActive === false)) {
      throw new PortalError('You cannot remove your own admin access.')
    }
    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: accountId }, data: { role: input.role, ...data.account } })
      const servant = existing.servant
        ? await tx.servant.update({ where: { id: existing.servant.id }, data: data.servant, select: { id: true } })
        : await tx.servant.create({ data: { accountId, ...data.servant }, select: { id: true } })
      await tx.classServant.deleteMany({ where: { servantId: servant.id } })
      if (input.classes.length) {
        await tx.classServant.createMany({ data: input.classes.map((c, i) => ({ servantId: servant.id, classId: c.classId, title: c.title || null, sortOrder: i })) })
      }
    })
    await audit(user, 'servant.update', 'account', accountId, `Updated ${input.displayName}`)
    revalidatePath('/portal/admin/servants')
    revalidatePath(`/portal/admin/servants/${accountId}`)
    revalidatePath('/portal/classes')
    return undefined
  })
}

export async function resetServantPin(accountId: string): Promise<ActionResult<{ loginId: string; pin: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { role: true, displayName: true } })
    if (!acc || acc.role === 'STUDENT') throw new PortalError('Account not found.')
    const pin = randomPin()
    const updated = await prisma.account.update({ where: { id: accountId }, data: { pinHash: await bcrypt.hash(pin, 10), failedAttempts: 0, lockedUntil: null }, select: { loginId: true } })
    await audit(user, 'servant.resetPin', 'account', accountId, `Reset PIN for ${acc.displayName}`)
    return { loginId: updated.loginId, pin }
  })
}

export async function deleteServant(accountId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    if (accountId === user.accountId) throw new PortalError('You cannot delete your own account.')
    const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { role: true, displayName: true } })
    if (!acc || acc.role === 'STUDENT') throw new PortalError('Account not found.')
    await prisma.account.delete({ where: { id: accountId } })
    await audit(user, 'servant.delete', 'account', accountId, `Deleted ${acc.displayName}`)
    revalidatePath('/portal/admin/servants')
    revalidatePath('/portal/classes')
    return undefined
  })
}

// ── Classes ───────────────────────────────────────────────────────────────

const ClassSchema = z.object({
  name: z.string().trim().min(1).max(60),
  stage: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']),
  visitationThreshold: z.number().int().min(1).max(10),
  description: z.string().trim().max(300).optional(),
})

export type ClassInput = z.infer<typeof ClassSchema>

export async function createClass(raw: ClassInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ClassSchema.parse(raw)
    const base = input.name.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'class'
    let id = base
    for (let i = 2; await prisma.schoolClass.findUnique({ where: { id }, select: { id: true } }); i++) id = `${base}-${i}`
    const max = await prisma.schoolClass.aggregate({ _max: { sortOrder: true } })
    await prisma.schoolClass.create({ data: { id, name: input.name, stage: input.stage, visitationThreshold: input.visitationThreshold, description: input.description || null, sortOrder: (max._max.sortOrder ?? 0) + 1 } })
    await audit(user, 'class.create', 'class', id, input.name)
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/classes')
    return { id }
  })
}

export async function updateClass(id: string, raw: ClassInput & { isActive?: boolean; sortOrder?: number }): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = ClassSchema.parse(raw)
    await prisma.schoolClass.update({
      where: { id },
      data: {
        name: input.name, stage: input.stage, visitationThreshold: input.visitationThreshold, description: input.description || null,
        ...(typeof raw.isActive === 'boolean' ? { isActive: raw.isActive } : {}),
        ...(typeof raw.sortOrder === 'number' ? { sortOrder: raw.sortOrder } : {}),
      },
    })
    await audit(user, 'class.update', 'class', id, input.name)
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/classes')
    revalidatePath(`/portal/classes/${id}`)
    return undefined
  })
}

export async function deleteClass(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const cls = await prisma.schoolClass.findUnique({
      where: { id },
      select: { name: true, _count: { select: { students: true, attendance: true, exams: true, points: true, followUps: true } } },
    })
    if (!cls) throw new PortalError('Class not found.')
    if (cls._count.students > 0) throw new PortalError('Move the students out of this class before deleting it.')
    // Emptying the roster does not empty the history: attendance, exams and
    // their quiz results cascade away with the class, and the points that
    // describe them are left pointing at nothing. Hide the class instead.
    const history = [
      cls._count.attendance > 0 ? `${cls._count.attendance} attendance records` : null,
      cls._count.exams > 0 ? `${cls._count.exams} exams` : null,
      cls._count.points > 0 ? `${cls._count.points} point entries` : null,
      cls._count.followUps > 0 ? `${cls._count.followUps} follow-up cases` : null,
    ].filter(Boolean)
    if (history.length > 0) {
      throw new PortalError(
        `This class still holds ${history.join(', ')} from students who have moved on. Hide it instead of deleting it so their history survives.`,
      )
    }
    await prisma.schoolClass.delete({ where: { id } })
    await audit(user, 'class.delete', 'class', id, cls.name)
    revalidatePath('/portal/admin/classes')
    revalidatePath('/portal/classes')
    return undefined
  })
}

// ── Attendance sessions ───────────────────────────────────────────────────

const SessionSchema = z.object({
  key: z.string().trim().min(1).max(30).regex(/^[a-z0-9-]+$/, 'Key must be lowercase letters, digits or dashes'),
  label: z.string().trim().min(1).max(40),
  points: z.number().int().min(0).max(100),
  isActive: z.boolean(),
})

export async function saveSession(raw: z.infer<typeof SessionSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = SessionSchema.parse(raw)
    const count = await prisma.attendanceSession.count()
    await prisma.attendanceSession.upsert({
      where: { key: input.key },
      create: { key: input.key, label: input.label, points: input.points, isActive: input.isActive, sortOrder: count },
      update: { label: input.label, points: input.points, isActive: input.isActive },
    })
    await audit(user, 'session.save', 'session', input.key, `${input.label} = ${input.points} pts${input.isActive ? '' : ' (off)'}`)
    revalidatePath('/portal/admin/sessions')
    return undefined
  })
}
