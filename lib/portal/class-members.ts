/**
 * Classes that take children from other classes (2026-09-28).
 *
 * The church's Pre-Servants class holds teenagers who stay in their own class
 * (High School Girls or Boys). A child keeps one home class, `Student.classId`;
 * a class marked `takesOtherClasses` may also have members (`ClassMember`).
 * Everything that belongs to the home class is unchanged: Sunday School and the
 * other church sessions, follow-up groups, UNASSIGNED, moves, reports.
 *
 * These are the rules every page and action asks, so they cannot drift apart.
 * Pure; tested in tests/portal/class-members.test.ts.
 */
import type { Prisma } from '@prisma/client'

/** A class's roster: its own children and its members. */
export function rosterWhere(classId: string): Prisma.StudentWhereInput {
  return { OR: [{ classId }, { memberships: { some: { classId } } }] }
}

/** The rosters of several classes at once. */
export function rostersWhere(classIds: readonly string[]): Prisma.StudentWhereInput {
  const ids = [...classIds]
  return { OR: [{ classId: { in: ids } }, { memberships: { some: { classId: { in: ids } } } }] }
}

export interface SessionScope {
  key: string
  /** The one class that holds this session, or null for every class. */
  classId: string | null
}

/** The sessions a class's register offers: every class's, and its own. */
export function sessionsForClass<T extends SessionScope>(sessions: readonly T[], classId: string): T[] {
  return sessions.filter((s) => s.classId === null || s.classId === classId)
}

/**
 * Whether a session's register lists the class's members too. Only its own
 * meeting does: a member is marked for Sunday School and the other church
 * sessions in their own class, and one child has one record per session a day.
 */
export function sessionTakesMembers(session: SessionScope, classId: string): boolean {
  return session.classId === classId
}

/** Who a session's register lists in a class. */
export function registerWhere(session: SessionScope, classId: string): Prisma.StudentWhereInput {
  return sessionTakesMembers(session, classId) ? rosterWhere(classId) : { classId }
}

/** Every class a child is in: the home class first, then the ones they joined. */
export function studentClassIds(student: { classId: string | null; memberships?: ReadonlyArray<{ classId: string }> }): string[] {
  const ids = student.classId ? [student.classId] : []
  for (const m of student.memberships ?? []) if (!ids.includes(m.classId)) ids.push(m.classId)
  return ids
}

export type JoinDecision =
  /** Already this class's own child. */
  | 'home'
  /** Already a member of this class. */
  | 'member'
  /** In another class, and this class takes children from other classes: they join it. */
  | 'join'
  /** In another class, and this is a grade class: skipped, the admin moves children. */
  | 'elsewhere'

/**
 * What an import into `targetClassId` does with a child who is already in the
 * portal. A grade class keeps the rule it had: a child found in another class
 * is skipped and named, because moving children is the admin's.
 */
export function importJoinDecision(args: {
  targetClassId: string
  takesOtherClasses: boolean
  child: { classId: string | null; memberClassIds: readonly string[] }
}): JoinDecision {
  if (args.child.classId === args.targetClassId) return 'home'
  if (args.child.memberClassIds.includes(args.targetClassId)) return 'member'
  return args.takesOtherClasses ? 'join' : 'elsewhere'
}

/**
 * The follow-up case title for missing a meeting. Sunday School keeps its own
 * wording; a class's own meeting is named.
 */
export function missedTitle(session: { key: string; label: string }, streak: number): string {
  if (session.key === 'sunday') return streak === 1 ? 'Missed last Sunday' : `Missed ${streak} Sundays in a row`
  return streak === 1 ? `Missed the last ${session.label}` : `Missed ${session.label} ${streak} times in a row`
}

/**
 * Who a servant may scan in a class. Points go to anyone on the roster; a
 * register takes members only for the class's own meeting.
 */
export function scanWhere(classId: string, mode: 'ATTENDANCE' | 'POINTS', session: SessionScope | null): Prisma.StudentWhereInput {
  if (mode === 'POINTS') return rosterWhere(classId)
  return session ? registerWhere(session, classId) : { classId }
}

/**
 * The class a child's own scan of a group code is recorded under, or null when
 * the code is not for them. `childClassIds` is home first (studentClassIds).
 * - A class's own meeting is recorded in that class, for anyone in it.
 * - A church session is recorded in the child's own class, the only place
 *   they are marked for it.
 * - Points go to the first of the child's classes the code covers.
 * A code naming no classes covers every class, as before.
 */
export function redeemClassFor(args: {
  childClassIds: readonly string[]
  codeClassIds: readonly string[]
  kind: 'STUDENT_ATTENDANCE' | 'STUDENT_POINTS'
  session: SessionScope | null
}): string | null {
  const { childClassIds, codeClassIds, kind, session } = args
  const covers = (id: string) => codeClassIds.length === 0 || codeClassIds.includes(id)
  if (kind === 'STUDENT_ATTENDANCE') {
    if (session?.classId) return childClassIds.includes(session.classId) && covers(session.classId) ? session.classId : null
    const home = childClassIds[0]
    return home && covers(home) ? home : null
  }
  return childClassIds.find(covers) ?? null
}
