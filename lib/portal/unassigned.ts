import { can, type PortalUser, type StageKey } from './permissions'

/**
 * UNASSIGNED (2026-09-26): instead of asking the office to delete a child, any
 * servant of the class takes them off it with a reason. The child waits on the
 * UNASSIGNED list until a class Coordinator, the stage overseer or the admin
 * puts them back, moves them or deletes them for good.
 *
 * Pure rules, testable without a database.
 */

export const UNASSIGN_REASON_MIN = 3
export const UNASSIGN_REASON_MAX = 500

/** A reason is required: whoever decides next needs to know why. */
export function cleanUnassignReason(raw: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof raw === 'string' ? raw.trim() : ''
  if (reason.length < UNASSIGN_REASON_MIN) return { ok: false, error: 'Write the reason this child is leaving the class.' }
  if (reason.length > UNASSIGN_REASON_MAX) return { ok: false, error: `Keep the reason under ${UNASSIGN_REASON_MAX} characters.` }
  return { ok: true, reason }
}

/** The classes whose unassigned children this user handles. */
export function manageableFromClassIds(user: PortalUser, classes: readonly { id: string; stage: StageKey }[]): string[] {
  return classes.filter((c) => can(user, 'unassigned.manage', { classId: c.id, classStage: c.stage })).map((c) => c.id)
}

/** Cheap first check, before any query: can this user ever handle the list? */
export function mayHandleUnassigned(user: PortalUser): boolean {
  if (user.role === 'ADMIN') return true
  return user.role === 'SERVANT' && (!!user.stageOversight || user.coordinatorOf.length > 0)
}

/** Written whenever a child is placed in a class, by any path. */
export const CLEAR_UNASSIGNED = {
  unassignedAt: null,
  unassignedById: null,
  unassignedReason: null,
  unassignedFromClassId: null,
} as const
