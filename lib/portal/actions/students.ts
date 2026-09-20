'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { PortalRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { assertStudentWrite, studentName } from '../data/students'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate } from '../dates'
import { normalizePhone } from '../phones'
import { audit } from '../audit'
import { freeLoginId, randomPin } from '../credentials'

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional()

export const StudentFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().max(60).default(''),
  gender: z.enum(['male', 'female', '']).optional(),
  dob: z.string().trim().optional(),
  grade: optionalText(20),
  address: optionalText(200),
  fatherName: optionalText(80),
  fatherPhone: optionalText(30),
  motherName: optionalText(80),
  motherPhone: optionalText(30),
  parentEmails: z.string().trim().max(300).optional(),
  notes: optionalText(1000),
})

export type StudentFormInput = z.infer<typeof StudentFormSchema>

function toData(input: StudentFormInput) {
  const dob = input.dob ? parseDateOnly(input.dob) : null
  if (input.dob && !dob) throw new PortalError('Birthday is not a valid date.')
  const emails = (input.parentEmails ?? '')
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    gender: input.gender || null,
    dob: dob ? toUTCDate(dob) : null,
    grade: input.grade ?? null,
    address: input.address ?? null,
    fatherName: input.fatherName ?? null,
    fatherPhone: normalizePhone(input.fatherPhone),
    motherName: input.motherName ?? null,
    motherPhone: normalizePhone(input.motherPhone),
    parentEmails: Array.from(new Set(emails)),
    notes: input.notes ?? null,
  }
}

export async function createStudent(classId: string, raw: StudentFormInput): Promise<ActionResult<{ studentId: string; loginId: string; pin: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const cls = await assertClassAction(user, classId, 'student.write')
    const input = StudentFormSchema.parse(raw)
    const data = toData(input)
    const loginId = await freeLoginId()
    const pin = randomPin()
    const pinHash = await bcrypt.hash(pin, 10)

    const student = await prisma.student.create({
      data: {
        class: { connect: { id: cls.id } },
        ...data,
        account: {
          create: { loginId, pinHash, role: PortalRole.STUDENT, displayName: studentName(data) },
        },
      },
      select: { id: true },
    })
    await audit(user, 'student.create', 'student', student.id, `${cls.name}: added ${studentName(data)} (ID ${loginId})`)
    revalidatePath(`/portal/classes/${cls.id}`)
    revalidatePath('/portal/admin/students')
    return { studentId: student.id, loginId, pin }
  })
}

export async function updateStudent(studentId: string, raw: StudentFormInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const existing = await assertStudentWrite(user, studentId)
    const input = StudentFormSchema.parse(raw)
    const data = toData(input)
    await prisma.student.update({
      where: { id: studentId },
      data: { ...data, account: { update: { displayName: studentName(data) } } },
    })
    await audit(user, 'student.update', 'student', studentId, `Updated ${studentName(existing)}`)
    revalidatePath(`/portal/students/${studentId}`)
    if (existing.classId) revalidatePath(`/portal/classes/${existing.classId}`)
    return undefined
  })
}

export async function resetStudentPin(studentId: string): Promise<ActionResult<{ loginId: string; pin: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const existing = await assertStudentWrite(user, studentId)
    const pin = randomPin()
    const pinHash = await bcrypt.hash(pin, 10)
    const target = await prisma.student.findUnique({ where: { id: studentId }, select: { accountId: true } })
    if (!target) throw new PortalError('Student not found.')
    const account = await prisma.account.update({
      where: { id: target.accountId },
      data: { pinHash, failedAttempts: 0, lockedUntil: null },
      select: { loginId: true },
    })
    await audit(user, 'student.resetPin', 'student', studentId, `Reset PIN for ${studentName(existing)}`)
    return { loginId: account.loginId, pin }
  })
}

export async function clearImportNotes(studentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    await assertStudentWrite(user, studentId)
    await prisma.student.update({ where: { id: studentId }, data: { importNotes: null } })
    revalidatePath(`/portal/students/${studentId}`)
    return undefined
  })
}

export async function moveStudent(studentId: string, classId: string | null): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role !== 'ADMIN') throw new PortalError('Only the admin can move students between classes.')
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true, classId: true } })
    if (!s) throw new PortalError('Student not found.')
    if (classId) {
      const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true } })
      if (!cls) throw new PortalError('Class not found.')
    }
    await prisma.student.update({ where: { id: studentId }, data: { classId } })
    await audit(user, 'student.move', 'student', studentId, `Moved ${studentName(s)} from ${s.classId ?? 'no class'} to ${classId ?? 'no class'}`)
    revalidatePath('/portal/admin/students')
    revalidatePath(`/portal/students/${studentId}`)
    if (s.classId) revalidatePath(`/portal/classes/${s.classId}`)
    if (classId) revalidatePath(`/portal/classes/${classId}`)
    return undefined
  })
}

export async function deleteStudent(studentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role !== 'ADMIN') throw new PortalError('Only the admin can delete students.')
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { accountId: true, firstName: true, lastName: true, classId: true } })
    if (!s) throw new PortalError('Student not found.')
    // Deleting the account cascades to the student and all their records.
    await prisma.account.delete({ where: { id: s.accountId } })
    await audit(user, 'student.delete', 'student', studentId, `Deleted ${studentName(s)}`)
    revalidatePath('/portal/admin/students')
    if (s.classId) revalidatePath(`/portal/classes/${s.classId}`)
    return undefined
  })
}

export async function deleteStudentAndRedirect(studentId: string) {
  const result = await deleteStudent(studentId)
  if (result.ok) redirect('/portal/admin/students')
  return result
}
