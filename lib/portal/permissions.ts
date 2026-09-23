// Every screen and every server action asks this module. Nothing else decides
// who may do what. Keep it pure: no DB, no session — callers pass a PortalUser
// built once per request (see lib/portal/session.ts).

export type Role = 'STUDENT' | 'SERVANT' | 'ADMIN' | 'PASTOR'
export type StageKey = 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'

export interface PortalUser {
  accountId: string
  role: Role
  displayName: string
  /** Their uploaded photo, when there is one — the chrome shows it as an avatar. */
  photo?: string | null
  servantId?: string
  studentId?: string
  /** Classes the user belongs to (servant assignments, or the student's class). */
  classIds: string[]
  /** Classes where the servant holds the Coordinator title. */
  coordinatorOf: string[]
  stageOversight: StageKey | null
}

export interface ClassScope {
  id: string
  stage: StageKey
}

export type Action =
  | 'class.read'
  | 'student.read'
  | 'student.write'
  | 'attendance.write'
  | 'points.write'
  | 'followup.write'
  | 'servant.read'
  | 'admin.manage'

export interface ActionContext {
  classId?: string
  classStage?: StageKey
  studentId?: string
}

const ALL_CLASS_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'class.read',
  'student.read',
  'student.write',
  'attendance.write',
  'points.write',
  'followup.write',
  'servant.read',
  'admin.manage',
])

export function isAssigned(user: PortalUser, classId: string | undefined): boolean {
  return !!classId && user.classIds.includes(classId)
}

export function overseesStage(user: PortalUser, stage: StageKey | undefined): boolean {
  return !!stage && user.stageOversight === stage
}

/** Class ids the user may see, in the order given. */
export function visibleClassIds(user: PortalUser, classes: ClassScope[]): string[] {
  if (user.role === 'ADMIN' || user.role === 'PASTOR') return classes.map((c) => c.id)
  return classes
    .filter((c) => isAssigned(user, c.id) || (user.role === 'SERVANT' && overseesStage(user, c.stage)))
    .map((c) => c.id)
}

export function can(user: PortalUser, action: Action, ctx: ActionContext = {}): boolean {
  if (!ALL_CLASS_ACTIONS.has(action)) return false

  switch (user.role) {
    case 'ADMIN':
      return true

    case 'PASTOR':
      switch (action) {
        case 'class.read':
        case 'student.read':
        case 'servant.read':
        case 'followup.write':
          return true
        default:
          return false
      }

    case 'SERVANT': {
      const assigned = isAssigned(user, ctx.classId)
      const stageRead = overseesStage(user, ctx.classStage)
      switch (action) {
        case 'class.read':
        case 'student.read':
        case 'servant.read':
          return assigned || stageRead
        case 'student.write':
        case 'attendance.write':
        case 'points.write':
        case 'followup.write':
          return assigned
        default:
          return false
      }
    }

    case 'STUDENT':
      switch (action) {
        case 'class.read':
          return isAssigned(user, ctx.classId)
        case 'student.read':
          return !!ctx.studentId && ctx.studentId === user.studentId
        default:
          return false
      }
  }
  return false
}

/**
 * Who may edit or delete an existing event.
 *
 * Class scope alone is not enough: every servant of a targeted class shares
 * that scope, so the port let any co-servant rewrite or delete a colleague's
 * event. The prototype kept servants to their own events and let admins and
 * the pastor manage anything.
 */
export function mayModifyEvent(
  user: Pick<PortalUser, 'role' | 'accountId'>,
  event: { createdById: string | null },
): boolean {
  if (user.role === 'ADMIN' || user.role === 'PASTOR') return true
  return !!event.createdById && event.createdById === user.accountId
}

