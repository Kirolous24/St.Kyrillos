import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { can, visibleClassIds, type Action, type PortalUser } from '../permissions'
import { PortalError } from '../action-result'

export interface ClassSummary {
  id: string
  name: string
  stage: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'
  sortOrder: number
  visitationThreshold: number
  studentCount: number
  servantCount: number
}

export async function listVisibleClasses(user: PortalUser): Promise<ClassSummary[]> {
  const all = await prisma.schoolClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      stage: true,
      sortOrder: true,
      visitationThreshold: true,
      _count: { select: { students: true, servants: true } },
    },
  })
  const visible = new Set(visibleClassIds(user, all))
  return all
    .filter((c) => visible.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      stage: c.stage,
      sortOrder: c.sortOrder,
      visitationThreshold: c.visitationThreshold,
      studentCount: c._count.students,
      servantCount: c._count.servants,
    }))
}

/** Load a class and verify the user may perform `action` on it. 404s when hidden. */
export async function requireClassAccess(user: PortalUser, classId: string, action: Action) {
  const cls = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { id: true, name: true, stage: true, visitationThreshold: true, isActive: true },
  })
  if (!cls) notFound()
  if (!can(user, 'class.read', { classId: cls.id, classStage: cls.stage })) notFound()
  // A page the user may read but not act on (e.g. pastor opening the
  // attendance taker) is simply not there for them.
  if (!can(user, action, { classId: cls.id, classStage: cls.stage })) notFound()
  return cls
}

/** Like requireClassAccess but for server actions: throws PortalError instead of 404. */
export async function assertClassAction(user: PortalUser, classId: string, action: Action) {
  const cls = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { id: true, name: true, stage: true, visitationThreshold: true },
  })
  if (!cls || !can(user, action, { classId: cls.id, classStage: cls.stage })) {
    throw new PortalError('You do not have permission to do that in this class.')
  }
  return cls
}
