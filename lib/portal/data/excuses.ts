import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatDateOnly, toUTCDate } from '../dates'
import type { ExcuseView } from '../excuses'

/**
 * Follow-up excuses as pages read them (2026-10-19). See lib/portal/excuses.ts
 * for the rules and lib/portal/actions/excuses.ts for who may write them.
 */

export type { ExcuseView }

/**
 * Each child's excuses, newest first. `endingFrom` leaves out the ones over
 * before that day, which is all a list of children needs: what is on now and
 * what is coming.
 */
export async function excusesByStudent(
  studentIds: readonly string[],
  opts: { endingFrom?: string } = {},
): Promise<Map<string, ExcuseView[]>> {
  const out = new Map<string, ExcuseView[]>()
  if (studentIds.length === 0) return out
  const rows = await prisma.followUpExcuse.findMany({
    where: {
      studentId: { in: Array.from(new Set(studentIds)) },
      ...(opts.endingFrom ? { endsOn: { gte: toUTCDate(opts.endingFrom) } } : {}),
    },
    orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      studentId: true,
      startsOn: true,
      endsOn: true,
      reason: true,
      createdAt: true,
      updatedAt: true,
      updatedById: true,
      createdBy: { select: { displayName: true } },
      updatedBy: { select: { displayName: true } },
    },
  })
  for (const r of rows) {
    const view: ExcuseView = {
      id: r.id,
      studentId: r.studentId,
      startsOn: formatDateOnly(r.startsOn),
      endsOn: formatDateOnly(r.endsOn),
      reason: r.reason,
      setBy: r.createdBy?.displayName ?? null,
      setAt: r.createdAt.toISOString(),
      changedBy: r.updatedById ? r.updatedBy?.displayName ?? null : null,
      changedAt: r.updatedById ? r.updatedAt.toISOString() : null,
    }
    out.set(r.studentId, [...(out.get(r.studentId) ?? []), view])
  }
  return out
}

/** An excuse covering this day. */
export function excusedOnWhere(day: string): Prisma.FollowUpExcuseWhereInput {
  const d = toUTCDate(day)
  return { startsOn: { lte: d }, endsOn: { gte: d } }
}

/**
 * Cases somebody still has to follow up today: the child is not excused. Every
 * count that means "waiting on a call" uses this — the sidebar badge, the bell,
 * the dashboard, the class digest, Who is following up and the Follow-ups page
 * — so an excused child is never counted as a call nobody has made.
 */
export function dueCaseWhere(today: string): Prisma.FollowUpCaseWhereInput {
  return { student: { followUpExcuses: { none: excusedOnWhere(today) } } }
}

/** The other side: cases whose child is excused today. */
export function excusedCaseWhere(today: string): Prisma.FollowUpCaseWhereInput {
  return { student: { followUpExcuses: { some: excusedOnWhere(today) } } }
}
