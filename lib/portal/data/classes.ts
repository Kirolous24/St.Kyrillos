import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { can, visibleClassIds, type Action, type PortalUser, type StageKey } from '../permissions'
import { PortalError } from '../action-result'
import { isFellowship } from '../fellowship'

export interface ClassSummary {
  id: string
  name: string
  stage: StageKey
  sortOrder: number
  visitationThreshold: number
  studentCount: number
  /** People who joined it from elsewhere (ClassMember): Pre-Servants, a second Fellowship meeting. */
  memberCount: number
  servantCount: number
  /**
   * F0153 — the class's own photo. `setClassPhoto` and `SchoolClass.photo` had
   * both existed since the photo feature was built and nothing selected the
   * column, so wiring the upload control (F0839) on its own would have saved an
   * image that appears nowhere but its own preview: a feature that looks built
   * and does nothing. It is carried here so the class cards can draw it.
   */
  photo: string | null
  /**
   * F0535 / F0538 — the class's own notes line, shown under its name on the
   * cards a servant opens. The church wanted "Ages 9 to 11" under each class;
   * this field already holds exactly that, so no column was added for it.
   */
  description: string | null
}

/**
 * Whether a list includes the Fellowship meetings (2026-10-24). Every list in
 * the portal was built for the children, so the default leaves the adults'
 * meetings out; the pages that are about meetings too ask for them by name
 * (tests/portal/fellowship-scope.test.ts holds the list).
 */
export interface ClassListOptions {
  fellowship?: 'exclude' | 'include' | 'only'
  /**
   * Also the classes whose register this servant may take and nothing else
   * (2026-10-25, PortalUser.attendanceOnly). Only the register's own pick
   * lists ask for them.
   */
  attendancePartners?: boolean
}

export async function listVisibleClasses(user: PortalUser, opts: ClassListOptions = {}): Promise<ClassSummary[]> {
  const mode = opts.fellowship ?? 'exclude'
  const all = await prisma.schoolClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      stage: true,
      sortOrder: true,
      visitationThreshold: true,
      photo: true,
      // F0535 — the caption under a class name ("Ages 9 to 11"). An admin can
      // already write it here; until now only the admin screen showed it, so the
      // church held the information and the servants opening these cards never
      // saw it.
      description: true,
      _count: { select: { students: true, servants: true, members: true } },
    },
  })
  const visible = new Set(visibleClassIds(user, all))
  if (opts.attendancePartners) for (const id of user.attendanceOnly ?? []) visible.add(id)
  return all
    .filter((c) => visible.has(c.id))
    .filter((c) => mode === 'include' || (mode === 'only') === isFellowship(c.stage))
    .map((c) => ({
      id: c.id,
      name: c.name,
      stage: c.stage,
      sortOrder: c.sortOrder,
      visitationThreshold: c.visitationThreshold,
      studentCount: c._count.students,
      memberCount: c._count.members ?? 0,
      servantCount: c._count.servants,
      photo: c.photo,
      description: c.description,
    }))
}

/** Load a class and verify the user may perform `action` on it. 404s when hidden. */
export async function requireClassAccess(user: PortalUser, classId: string, action: Action) {
  const cls = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { id: true, name: true, stage: true, visitationThreshold: true, isActive: true, photo: true, takesOtherClasses: true },
  })
  if (!cls) notFound()
  // A paired class's register is open to the other class's servants, who may
  // not read the class itself (2026-10-25): taking it is all they may do.
  if (action !== 'attendance.take' && !can(user, 'class.read', { classId: cls.id, classStage: cls.stage })) notFound()
  // A page the user may read but not act on (e.g. pastor opening the
  // attendance taker) is simply not there for them.
  if (!can(user, action, { classId: cls.id, classStage: cls.stage })) notFound()
  return cls
}

/** Like requireClassAccess but for server actions: throws PortalError instead of 404. */
export async function assertClassAction(user: PortalUser, classId: string, action: Action) {
  const cls = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { id: true, name: true, stage: true, visitationThreshold: true, takesOtherClasses: true },
  })
  if (!cls || !can(user, action, { classId: cls.id, classStage: cls.stage })) {
    throw new PortalError('You do not have permission to do that in this class.')
  }
  return cls
}
