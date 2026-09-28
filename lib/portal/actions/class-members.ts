'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { PortalRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { studentName } from '../data/students'

/**
 * Children joining a class that takes children from other classes, and
 * leaving it (2026-09-28). They stay in their own class throughout; only the
 * membership changes, so taking one out needs no reason and puts nobody on the
 * UNASSIGNED list.
 */

async function openClass(classId: string) {
  const user = await requirePortalUser()
  const cls = await assertClassAction(user, classId, 'student.write')
  if (!cls.takesOtherClasses) {
    throw new PortalError(`${cls.name} only has its own children. The admin can let it take children from other classes in Manage Classes.`)
  }
  return { user, cls }
}

function revalidateClass(classId: string, studentId: string): void {
  revalidatePath(`/portal/classes/${classId}`)
  revalidatePath(`/portal/students/${studentId}`)
}

const MemberSchema = z.object({ classId: z.string().min(1), studentId: z.string().min(1) })

export async function addClassMember(raw: z.infer<typeof MemberSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const input = MemberSchema.parse(raw)
    const { user, cls } = await openClass(input.classId)
    const s = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, firstName: true, lastName: true, classId: true, account: { select: { role: true } } },
    })
    if (!s || s.account.role !== PortalRole.STUDENT) throw new PortalError('Child not found.')
    if (s.classId === cls.id) throw new PortalError(`${studentName(s)} is already in ${cls.name}.`)
    await prisma.classMember.upsert({
      where: { classId_studentId: { classId: cls.id, studentId: s.id } },
      create: { classId: cls.id, studentId: s.id, addedById: user.accountId },
      update: {},
    })
    await audit(user, 'class.member.add', 'class', cls.id, `${cls.name}: added ${studentName(s)}, who stays in their own class`)
    revalidateClass(cls.id, s.id)
    return undefined
  })
}

export async function removeClassMember(raw: z.infer<typeof MemberSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const input = MemberSchema.parse(raw)
    const { user, cls } = await openClass(input.classId)
    const m = await prisma.classMember.findUnique({
      where: { classId_studentId: { classId: cls.id, studentId: input.studentId } },
      select: { student: { select: { firstName: true, lastName: true } } },
    })
    if (!m) throw new PortalError('That child is not a member of this class.')
    await prisma.classMember.delete({ where: { classId_studentId: { classId: cls.id, studentId: input.studentId } } })
    await audit(user, 'class.member.remove', 'class', cls.id, `${cls.name}: took out ${studentName(m.student)}, who stays in their own class`)
    revalidateClass(cls.id, input.studentId)
    return undefined
  })
}

/**
 * Children anywhere in the church a class that takes other classes could add:
 * by name or 4-digit ID, leaving out its own children and its members.
 */
export async function findChildrenToAdd(raw: { classId: string; query: string }): Promise<
  ActionResult<Array<{ id: string; name: string; loginId: string; className: string | null }>>
> {
  return runAction(async () => {
    const input = z.object({ classId: z.string().min(1), query: z.string().trim().max(60) }).parse(raw)
    const { cls } = await openClass(input.classId)
    const words = input.query.split(/\s+/).filter(Boolean)
    if (words.length === 0 || input.query.length < 2) return []
    const rows = await prisma.student.findMany({
      where: {
        account: { role: PortalRole.STUDENT, isActive: true },
        NOT: [{ classId: cls.id }, { memberships: { some: { classId: cls.id } } }],
        AND: words.map((w) =>
          /^\d{4}$/.test(w)
            ? { account: { loginId: w } }
            : { OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }] },
        ),
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 20,
      select: { id: true, firstName: true, lastName: true, class: { select: { name: true } }, account: { select: { loginId: true } } },
    })
    return rows.map((r) => ({ id: r.id, name: studentName(r), loginId: r.account.loginId, className: r.class?.name ?? null }))
  })
}
