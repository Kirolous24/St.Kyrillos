import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PortalUser } from '../permissions'
import { formatDateOnly } from '../dates'
import { manageableFromClassIds, mayHandleUnassigned } from '../unassigned'
import { studentName } from './students'

/**
 * The children a user sees on the UNASSIGNED list, as a query, or null when
 * they see none.
 *
 * - **Class Coordinators and stage overseers** see the children unassigned from
 *   the classes they handle.
 * - **The admin** also sees children with no class on record at all (legacy,
 *   or moved to "No class"), who have no reason recorded.
 * - **Only STUDENT accounts are listed.** A child who was made a servant keeps a
 *   Student row with no class, and is not waiting for anything.
 */
export async function unassignedWhere(user: PortalUser): Promise<Prisma.StudentWhereInput | null> {
  if (!mayHandleUnassigned(user)) return null
  if (user.role === 'ADMIN') return { classId: null, account: { role: 'STUDENT' } }
  const classes = await prisma.schoolClass.findMany({ select: { id: true, stage: true } })
  const ids = manageableFromClassIds(user, classes)
  if (ids.length === 0) return null
  return {
    classId: null,
    unassignedAt: { not: null },
    unassignedFromClassId: { in: ids },
    account: { role: 'STUDENT' },
  }
}

/** The sidebar's count. Zero for anyone who never handles the list, with no query. */
export async function countUnassigned(user: PortalUser): Promise<number> {
  const where = await unassignedWhere(user)
  return where ? prisma.student.count({ where }) : 0
}

export interface UnassignedChild {
  id: string
  name: string
  loginId: string
  grade: string | null
  gender: string | null
  /** YYYY-MM-DD */
  dob: string | null
  fatherName: string | null
  fatherPhone: string | null
  motherName: string | null
  motherPhone: string | null
  fromClassId: string | null
  fromClassName: string | null
  /** False when the class they came from was deleted or switched off. */
  fromClassActive: boolean
  byName: string | null
  reason: string | null
  /** ISO timestamp; null for a child with no class on record. */
  at: string | null
}

/** Newest first; children with no reason recorded come last. */
export async function listUnassigned(user: PortalUser): Promise<UnassignedChild[]> {
  const where = await unassignedWhere(user)
  if (!where) return []
  const rows = await prisma.student.findMany({
    where,
    orderBy: [{ unassignedAt: { sort: 'desc', nulls: 'last' } }, { firstName: 'asc' }, { lastName: 'asc' }],
    take: 500,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      gender: true,
      dob: true,
      fatherName: true,
      fatherPhone: true,
      motherName: true,
      motherPhone: true,
      unassignedAt: true,
      unassignedReason: true,
      unassignedFromClassId: true,
      unassignedBy: { select: { displayName: true } },
      account: { select: { loginId: true } },
    },
  })
  const fromIds = Array.from(new Set(rows.map((r) => r.unassignedFromClassId).filter((id): id is string => !!id)))
  const classes = fromIds.length
    ? await prisma.schoolClass.findMany({ where: { id: { in: fromIds } }, select: { id: true, name: true, isActive: true } })
    : []
  const classOf = new Map(classes.map((c) => [c.id, c]))
  return rows.map((r) => {
    const from = r.unassignedFromClassId ? classOf.get(r.unassignedFromClassId) : undefined
    return {
      id: r.id,
      name: studentName(r),
      loginId: r.account.loginId,
      grade: r.grade,
      gender: r.gender,
      dob: r.dob ? formatDateOnly(r.dob) : null,
      fatherName: r.fatherName,
      fatherPhone: r.fatherPhone,
      motherName: r.motherName,
      motherPhone: r.motherPhone,
      fromClassId: r.unassignedFromClassId,
      fromClassName: from?.name ?? null,
      fromClassActive: !!from?.isActive,
      byName: r.unassignedBy?.displayName ?? null,
      reason: r.unassignedReason,
      at: r.unassignedAt ? r.unassignedAt.toISOString() : null,
    }
  })
}
