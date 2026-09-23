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
import { BULK_FIELD_KEYS, type BulkField } from '../student-fields'
import { audit } from '../audit'
import { freeLoginId, randomPin } from '../credentials'
import { clearRateLimit } from '@/lib/rate-limit'

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional()

// Not exported: Next.js requires every export of a "use server" module to be an
// async function, and a Zod object throws at action-invocation time. The
// inferred type below is erased at compile time, so exporting it is fine.
const StudentFormSchema = z.object({
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
  // The student's own contact details live on their Account. The port dropped
  // them from every form and from the profile, so a servant could record both
  // parents but not the child's own phone or email.
  email: optionalText(200),
  phone: optionalText(30),
  notes: optionalText(1000),
})

export type StudentFormInput = z.infer<typeof StudentFormSchema>

/** Account-side contact details, validated the same way for create and update. */
function toAccountData(input: StudentFormInput) {
  const email = input.email ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new PortalError('That email address does not look right.')
  }
  return { email, phone: normalizePhone(input.phone) }
}

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
          create: { loginId, pinHash, role: PortalRole.STUDENT, displayName: studentName(data), ...toAccountData(input) },
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
      data: { ...data, account: { update: { displayName: studentName(data), ...toAccountData(input) } } },
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
    // Clearing the DB lockout is not enough. lib/auth.ts consults the in-process
    // limiter BEFORE the PIN is ever checked, so a child who had just spent
    // their five tries could not sign in with the PIN their servant had only
    // now handed them — for up to fifteen more minutes, and reading as "that ID
    // and PIN do not match", which looks like the servant misread it.
    // resetServantPin has always done this; this path had not.
    clearRateLimit(`portal:${account.loginId}`)
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

/**
 * F0850 — a senior who grew up in Sunday School and is now serving.
 *
 * Until this existed, the only way to give her a servant's login was to delete
 * the child account and make a new one, which cascaded away every register
 * mark, point, quiz result, badge and follow-up since kindergarten. Worse, it
 * had a deadline: leave her as a student and the end-of-year reset deletes her
 * along with the children.
 *
 * No migration is needed. One Account may carry both a Student row and a
 * Servant row, so the conversion moves the role, adds the Servant side, and
 * takes her off the class roster — while the Student row and everything hanging
 * off it stays exactly where it is. Her years as a child remain readable on her
 * own profile; she simply stops being a child on it.
 *
 * `endOfYearReset` is deliberately narrowed to match: it now skips any account
 * that has a Servant row, or this conversion would only postpone the loss until
 * September.
 */
export async function convertStudentToServant(studentId: string): Promise<ActionResult<{ accountId: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role !== 'ADMIN') throw new PortalError('Only the admin can make a student a servant.')

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        accountId: true,
        firstName: true,
        lastName: true,
        classId: true,
        dob: true,
        address: true,
        account: { select: { role: true, servant: { select: { id: true } } } },
      },
    })
    if (!student) throw new PortalError('Student not found.')
    if (student.account.servant) throw new PortalError('That person is already a servant.')
    if (student.account.role !== PortalRole.STUDENT) {
      throw new PortalError('That account is not a student account.')
    }

    const previousClassId = student.classId

    await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: student.accountId },
        data: {
          role: PortalRole.SERVANT,
          servant: {
            // Their date of birth and address carry over; the servant record
            // keeps its own copies, and the child's row is left untouched.
            create: { birthday: student.dob, address: student.address },
          },
        },
      })
      // Off the children's roster, but still on their own history.
      await tx.student.update({ where: { id: student.id }, data: { class: { disconnect: true } } })
    })

    await audit(
      user,
      'student.convertToServant',
      'student',
      studentId,
      `${studentName(student)} is now a servant; their Sunday School history was kept`,
    )
    revalidatePath('/portal/admin/students')
    revalidatePath('/portal/admin/servants')
    revalidatePath(`/portal/students/${studentId}`)
    if (previousClassId) revalidatePath(`/portal/classes/${previousClassId}`)
    return { accountId: student.accountId }
  })
}

/**
 * F0052 — switch a child's login off without deleting the child.
 *
 * A family moves away mid-year, or a PIN has been passed round the class. Until
 * this existed the only lever an admin had was Delete Student, which takes the
 * register, the points and the quiz history with it — so the mild problem was
 * answered with the one irreversible button on the page.
 *
 * Nothing new is stored: `Account.isActive` already exists, is already refused
 * at sign-in, and is already re-checked on every page load, which is exactly
 * how servant accounts have always been handled. Their records stay; only the
 * login stops.
 */
export async function setStudentLoginEnabled(studentId: string, enabled: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role !== 'ADMIN') throw new PortalError('Only the admin can switch a login off.')
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { accountId: true, firstName: true, lastName: true, classId: true },
    })
    if (!student) throw new PortalError('Student not found.')

    await prisma.account.update({ where: { id: student.accountId }, data: { isActive: enabled } })
    await audit(
      user,
      enabled ? 'student.enableLogin' : 'student.disableLogin',
      'student',
      studentId,
      `${enabled ? 'Switched on' : 'Switched off'} the login for ${studentName(student)}; their records were kept`,
    )
    revalidatePath(`/portal/students/${studentId}`)
    revalidatePath('/portal/admin/students')
    if (student.classId) revalidatePath(`/portal/classes/${student.classId}`)
    return undefined
  })
}

export async function convertStudentToServantAndRedirect(studentId: string) {
  const result = await convertStudentToServant(studentId)
  if (result.ok && result.data) redirect(`/portal/admin/servants/${result.data.accountId}`)
  return result
}

/* ── Bulk edit ────────────────────────────────────────────────────────────── */

/** The value as it goes into Prisma, and back out again for an undo. */
function toBulkValue(field: BulkField, raw: string): string | string[] | null {
  const value = raw.trim()
  if (field === 'parentEmails') {
    return Array.from(
      new Set(
        value
          .split(/[;,\s]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)),
      ),
    )
  }
  if (field === 'fatherPhone' || field === 'motherPhone') return normalizePhone(value)
  if (field === 'gender') {
    const g = value.toLowerCase()
    if (g && g !== 'male' && g !== 'female') throw new PortalError('Gender must be "male" or "female", or blank.')
    return g || null
  }
  return value || null
}

/** How a stored value is rendered back into the text box on an undo. */
function fromBulkValue(field: BulkField, stored: unknown): string {
  if (field === 'parentEmails') return Array.isArray(stored) ? stored.join(', ') : ''
  return typeof stored === 'string' ? stored : ''
}

export interface BulkEditUndo {
  field: BulkField
  previous: Array<{ id: string; value: string }>
}

/**
 * Set one field across many students at once — promoting a class to the next
 * grade, correcting a shared address, filling in a parent's new number. The
 * prototype had this with an Undo; the port had neither, so the same edit meant
 * opening thirty profiles one at a time.
 *
 * Every student is permission-checked individually, so a servant can only touch
 * their own class even if ids from elsewhere are posted.
 */
export async function bulkEditStudents(input: {
  studentIds: string[]
  field: string
  value: string
}): Promise<ActionResult<{ updated: number; undo: BulkEditUndo }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!BULK_FIELD_KEYS.has(input.field)) throw new PortalError('That is not a field you can bulk edit.')
    const field = input.field as BulkField
    const ids = Array.from(new Set(input.studentIds ?? [])).filter(Boolean)
    if (ids.length === 0) throw new PortalError('Select at least one student.')
    if (ids.length > 200) throw new PortalError('Bulk edit at most 200 students at a time.')

    const next = toBulkValue(field, input.value ?? '')
    const previous: Array<{ id: string; value: string }> = []

    for (const id of ids) {
      await assertStudentWrite(user, id)
      const before = await prisma.student.findUnique({ where: { id }, select: { [field]: true } as never })
      previous.push({ id, value: fromBulkValue(field, (before as Record<string, unknown> | null)?.[field]) })
      await prisma.student.update({ where: { id }, data: { [field]: next } as never })
    }

    await audit(user, 'student.bulkEdit', 'portal', null, `Set ${field} on ${ids.length} student${ids.length === 1 ? '' : 's'}`)
    revalidatePath('/portal/admin/students')
    revalidatePath('/portal/classes')
    return { updated: ids.length, undo: { field, previous } }
  })
}

/** Put back exactly what `bulkEditStudents` reported, student by student. */
export async function undoBulkEditStudents(undo: BulkEditUndo): Promise<ActionResult<{ restored: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!BULK_FIELD_KEYS.has(undo?.field)) throw new PortalError('Nothing to undo.')
    const field = undo.field
    const rows = (undo.previous ?? []).slice(0, 200)
    if (rows.length === 0) throw new PortalError('Nothing to undo.')

    for (const row of rows) {
      await assertStudentWrite(user, row.id)
      await prisma.student.update({ where: { id: row.id }, data: { [field]: toBulkValue(field, row.value) } as never })
    }
    await audit(user, 'student.bulkEditUndo', 'portal', null, `Undid ${field} on ${rows.length} student${rows.length === 1 ? '' : 's'}`)
    revalidatePath('/portal/admin/students')
    revalidatePath('/portal/classes')
    return { restored: rows.length }
  })
}

/** Move a whole selection into one class (or out of every class). Admin only. */
export async function bulkMoveStudents(input: { studentIds: string[]; classId: string | null }): Promise<ActionResult<{ moved: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role !== 'ADMIN') throw new PortalError('Only the admin can move students between classes.')
    const ids = Array.from(new Set(input.studentIds ?? [])).filter(Boolean)
    if (ids.length === 0) throw new PortalError('Select at least one student.')
    if (input.classId) {
      const cls = await prisma.schoolClass.findUnique({ where: { id: input.classId }, select: { id: true } })
      if (!cls) throw new PortalError('Class not found.')
    }
    const before = await prisma.student.findMany({ where: { id: { in: ids } }, select: { classId: true } })
    await prisma.student.updateMany({ where: { id: { in: ids } }, data: { classId: input.classId } })
    await audit(user, 'student.bulkMove', 'portal', input.classId, `Moved ${ids.length} student${ids.length === 1 ? '' : 's'} to ${input.classId ?? 'no class'}`)
    revalidatePath('/portal/admin/students')
    for (const c of Array.from(new Set(before.map((b) => b.classId).filter(Boolean)))) revalidatePath(`/portal/classes/${c}`)
    if (input.classId) revalidatePath(`/portal/classes/${input.classId}`)
    return { moved: ids.length }
  })
}

/**
 * Delete a whole selection. Admin only, and there is no undo — the caller must
 * confirm first. Deleting the account cascades to the student and every record
 * attached to them, exactly as the single-student delete does.
 */
export async function bulkDeleteStudents(input: { studentIds: string[] }): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (user.role !== 'ADMIN') throw new PortalError('Only the admin can delete students.')
    const ids = Array.from(new Set(input.studentIds ?? [])).filter(Boolean)
    if (ids.length === 0) throw new PortalError('Select at least one student.')
    if (ids.length > 100) throw new PortalError('Delete at most 100 students at a time.')
    const rows = await prisma.student.findMany({
      where: { id: { in: ids } },
      // F0571 — names, so the log says who was deleted. This is also the
      // per-card delete now, and "Deleted 1 student" is no use at all when
      // somebody asks a fortnight later which child went.
      select: { accountId: true, classId: true, firstName: true, lastName: true },
    })
    await prisma.account.deleteMany({ where: { id: { in: rows.map((r) => r.accountId) } } })
    const named = rows.slice(0, 20).map((r) => studentName(r)).join(', ')
    await audit(
      user,
      'student.bulkDelete',
      'portal',
      null,
      `Deleted ${rows.length} student${rows.length === 1 ? '' : 's'}: ${named}${rows.length > 20 ? `, and ${rows.length - 20} more` : ''}`,
    )
    revalidatePath('/portal/admin/students')
    for (const c of Array.from(new Set(rows.map((r) => r.classId).filter(Boolean)))) revalidatePath(`/portal/classes/${c}`)
    return { deleted: rows.length }
  })
}
