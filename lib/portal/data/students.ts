import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { can, type PortalUser } from '../permissions'
import { PortalError } from '../action-result'

const studentSelect = {
  id: true,
  firstName: true,
  lastName: true,
  gender: true,
  dob: true,
  grade: true,
  address: true,
  fatherName: true,
  fatherPhone: true,
  motherName: true,
  motherPhone: true,
  parentEmails: true,
  notes: true,
  importNotes: true,
  classId: true,
  class: { select: { id: true, name: true, stage: true, visitationThreshold: true } },
  account: { select: { id: true, loginId: true, displayName: true, email: true, phone: true, photo: true, isActive: true, lastLoginAt: true } },
} as const

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof loadStudent>>>

async function loadStudent(id: string) {
  return prisma.student.findUnique({ where: { id }, select: studentSelect })
}

/** Student profile the user may read; 404 otherwise. */
export async function requireStudentRead(user: PortalUser, studentId: string) {
  const s = await loadStudent(studentId)
  if (!s) notFound()
  const ctx = { classId: s.classId ?? undefined, classStage: s.class?.stage, studentId: s.id }
  const allowed =
    can(user, 'student.read', ctx) ||
    (user.role === 'ADMIN' || user.role === 'PASTOR')
  if (!allowed) notFound()
  return s
}

/** For server actions that modify a student. */
export async function assertStudentWrite(user: PortalUser, studentId: string) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true, firstName: true, lastName: true, class: { select: { stage: true } } },
  })
  if (!s) throw new PortalError('Student not found.')
  const ctx = { classId: s.classId ?? undefined, classStage: s.class?.stage, studentId: s.id }
  if (!can(user, 'student.write', ctx)) throw new PortalError('You do not have permission to edit this student.')
  return s
}

export function studentName(s: { firstName: string; lastName: string }): string {
  return [s.firstName, s.lastName].filter(Boolean).join(' ')
}
