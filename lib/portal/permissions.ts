// Every screen and every server action asks this module. Nothing else decides
// who may do what. Keep it pure: no DB, no session — callers pass a PortalUser
// built once per request (see lib/portal/session.ts).

export type Role = 'STUDENT' | 'SERVANT' | 'ADMIN' | 'PASTOR'
// FELLOWSHIP is the adults' meetings (2026-10-24): members, not students.
export type StageKey = 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'FELLOWSHIP'

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
  /** Classes where the servant holds the Assistant Coordinator title. */
  assistantOf: string[]
  stageOversight: StageKey | null
  /**
   * The Fellowship meetings among `classIds` (2026-10-24): the ones this
   * servant serves, not the ones they are a member of. Absent means none.
   */
  fellowshipClassIds?: string[]
  /**
   * Classes whose register this servant may take and nothing else of them
   * (2026-10-25): the other half of a boys'/girls' pair of one of their own
   * classes (SchoolClass.attendancePartnerId). Absent means none.
   */
  attendanceOnly?: string[]
  /**
   * Classes this servant may post an exam to and nothing else (2026-10-26):
   * the other half of a pair of a class they are Coordinator or Assistant
   * Coordinator of. Absent means none.
   */
  examPostOnly?: string[]
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
  // Taking a register (2026-10-25): attendance.write's people, and the
  // servants of the class's partner, who may do this and nothing else.
  | 'attendance.take'
  | 'points.write'
  // Posting a new exam (2026-10-26): points.write's people, and a pair's
  // Coordinator and Assistant Coordinator, who may post to the other half.
  | 'exam.post'
  | 'followup.write'
  | 'servant.read'
  | 'admin.manage'
  | 'group.manage'
  | 'unassigned.manage'

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
  'attendance.take',
  'points.write',
  'exam.post',
  'followup.write',
  'servant.read',
  'admin.manage',
  'group.manage',
  'unassigned.manage',
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
  // A Fellowship meeting has no points (2026-10-24), for anyone, the admin
  // included: its members are adults, and points belong to the children. Nor
  // quizzes, which award points.
  if ((action === 'points.write' || action === 'exam.post') && ctx.classStage === 'FELLOWSHIP') return false

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
          /**
           * A stage coordinator acts on their stage exactly as a servant acts
           * on their own class. It used to be read-only here, which matched the
           * prototype — its coordinator scope fed the stage Reports view and
           * nothing else (OG getMyScopedClassIds, L2390, called once at L7346).
           *
           * The church widened it on 2026-09-24: when a class's servant does
           * not turn up, the coordinator is the person standing there, and
           * "only an admin may take that register" meant the coordinators
           * sharing the admin login to do their own job. Every mark still
           * records who made it, and the reach is one stage, not the church.
           */
          return assigned || stageRead
        case 'attendance.take':
          // The 5th & 6th and 7th & 8th boys' and girls' classes take each
          // other's registers (2026-10-25: "only for attendance, nothing
          // else"). No other action looks at attendanceOnly.
          return assigned || stageRead || (!!ctx.classId && (user.attendanceOnly ?? []).includes(ctx.classId))
        case 'exam.post':
          // "If I'm in the fifth and sixth or seventh and eighth and I'm a
          // coordinator, I can also post it to the other version of the class"
          // (2026-10-26). Posting is all: the copy it makes there, its results
          // and its children stay with that class's own servants.
          return assigned || stageRead || (!!ctx.classId && (user.examPostOnly ?? []).includes(ctx.classId))
        case 'group.manage':
          // Arranging who follows whom is the coordinator's job: the stage
          // overseer for their stage, the class Coordinator and Assistant
          // Coordinator for their class. Plain servants do not rearrange
          // everyone else's (follow-up groups, 2026-09-26). Assistants saw
          // every group from 2026-10-04 and arrange them from 2026-10-19, at
          // the user's word: "the same functionality within those groups".
          return (
            stageRead ||
            (!!ctx.classId && (user.coordinatorOf.includes(ctx.classId) || user.assistantOf.includes(ctx.classId)))
          )
        case 'unassigned.manage':
          // UNASSIGNED (2026-09-26): any servant of the class may take a child
          // off it with a reason (student.write). What happens next is put
          // back, move or delete, and that is the same people's call as
          // arranging groups.
          return stageRead || (!!ctx.classId && user.coordinatorOf.includes(ctx.classId))
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
 * Kids see their own points and scores and nothing that ranks them against
 * other children (2026-10-19): no leaderboard, no class rank, no "points vs the
 * leader". Everybody who looks after them still does.
 */
export function seesClassmatesPoints(user: Pick<PortalUser, 'role'>): boolean {
  return user.role !== 'STUDENT'
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

