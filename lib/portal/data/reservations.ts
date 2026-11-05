import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PortalUser } from '../permissions'
import { HOLDING_STATUSES, defaultService, serviceGroups, serviceOptions, type ReservationStatus, type ServiceGroup } from '../reservations'

// What the van reservation pages read (2026-11-02). Every reservation is open
// to every servant: the point is to see who has which van when.

const ROW_SELECT = {
  id: true,
  itemId: true,
  startsAt: true,
  endsAt: true,
  service: true,
  reason: true,
  status: true,
  decidedAt: true,
  decisionNote: true,
  createdById: true,
  createdAt: true,
  item: { select: { name: true, color: true } },
  createdBy: { select: { displayName: true } },
  decidedBy: { select: { displayName: true } },
  servants: { select: { servant: { select: { id: true, account: { select: { displayName: true } } } } } },
} satisfies Prisma.ReservationSelect

export interface ReservationRow {
  id: string
  itemId: string
  itemName: string
  itemColor: string
  startsAt: Date
  endsAt: Date
  service: string
  /** Where it is going and what for; none on a reservation made before 2026-11-04. */
  reason: string | null
  status: ReservationStatus
  /** Who approved or rejected it, and when; none while it waits, or when it was made before approvals. */
  decidedByName: string | null
  decidedAt: Date | null
  decisionNote: string | null
  createdById: string | null
  createdByName: string | null
  createdAt: Date
  servants: Array<{ id: string; name: string }>
}

function toRow(r: Prisma.ReservationGetPayload<{ select: typeof ROW_SELECT }>): ReservationRow {
  return {
    id: r.id,
    itemId: r.itemId,
    itemName: r.item.name,
    itemColor: r.item.color,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    service: r.service,
    reason: r.reason,
    status: r.status,
    decidedByName: r.decidedBy?.displayName ?? null,
    decidedAt: r.decidedAt,
    decisionNote: r.decisionNote,
    createdById: r.createdById,
    createdByName: r.createdBy?.displayName ?? null,
    createdAt: r.createdAt,
    servants: r.servants
      .map((s) => ({ id: s.servant.id, name: s.servant.account.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * Every reservation out at any moment from `from` to `to`, earliest first:
 * the approved ones and the requests waiting for an answer, unless asked for
 * others. One not approved holds nothing, so it is left out.
 */
export async function reservationsBetween(from: Date, to: Date, statuses: readonly ReservationStatus[] = HOLDING_STATUSES): Promise<ReservationRow[]> {
  const rows = await prisma.reservation.findMany({
    where: { startsAt: { lt: to }, endsAt: { gt: from }, status: { in: [...statuses] } },
    orderBy: { startsAt: 'asc' },
    select: ROW_SELECT,
  })
  return rows.map(toRow)
}

/** The reservations someone made or is on that are not over yet, soonest first, whatever their answer. */
export async function upcomingReservationsOf(user: Pick<PortalUser, 'accountId' | 'servantId'>, now: Date): Promise<ReservationRow[]> {
  const rows = await prisma.reservation.findMany({
    where: {
      endsAt: { gt: now },
      OR: [{ createdById: user.accountId }, ...(user.servantId ? [{ servants: { some: { servantId: user.servantId } } }] : [])],
    },
    orderBy: { startsAt: 'asc' },
    take: 20,
    select: ROW_SELECT,
  })
  return rows.map(toRow)
}

export async function reservationById(id: string): Promise<ReservationRow | null> {
  const row = await prisma.reservation.findUnique({ where: { id }, select: ROW_SELECT })
  return row ? toRow(row) : null
}

export interface ReservationItemRow {
  id: string
  name: string
  details: string | null
  color: string
  photo: string | null
  isActive: boolean
  reservations: number
}

/** The vans, in the admin's order; retired ones only when asked for. */
export async function reservationItems(includeRetired = false): Promise<ReservationItemRow[]> {
  const items = await prisma.reservationItem.findMany({
    where: includeRetired ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, details: true, color: true, photo: true, isActive: true, _count: { select: { reservations: true } } },
  })
  return items.map(({ _count, ...item }) => ({ ...item, reservations: _count.reservations }))
}

/** Everyone who can be put on a reservation: the servants still here, by name. */
export async function reservationServantChoices(): Promise<Array<{ id: string; name: string }>> {
  const servants = await prisma.servant.findMany({
    where: { account: { isActive: true, role: { in: ['SERVANT', 'ADMIN', 'PASTOR'] } } },
    select: { id: true, account: { select: { displayName: true } } },
  })
  return servants.map((s) => ({ id: s.id, name: s.account.displayName })).sort((a, b) => a.name.localeCompare(b.name))
}

/** This church's classes and meetings, in the classes list's order, for what a van goes out for. */
async function serviceClasses() {
  return prisma.schoolClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { stage: true, name: true },
  })
}

/** What a van goes out for, grouped for the form: each stage, its classes, the meetings (2026-11-04). */
export async function reservationServiceGroups(): Promise<ServiceGroup[]> {
  return serviceGroups(await serviceClasses())
}

/** Every service a reservation may be for, Other included. */
export async function reservationServiceOptions(): Promise<string[]> {
  return serviceOptions(await serviceClasses())
}

/** The service this person most likely reserves for. */
export async function defaultServiceFor(user: Pick<PortalUser, 'classIds' | 'stageOversight'>): Promise<string> {
  const classes = user.classIds.length > 0 ? await prisma.schoolClass.findMany({ where: { id: { in: user.classIds } }, select: { stage: true, name: true } }) : []
  return defaultService(classes, user.stageOversight)
}

/** The requests waiting for an answer that are not over yet, soonest first (2026-11-04). */
export async function waitingReservations(now: Date): Promise<ReservationRow[]> {
  const rows = await prisma.reservation.findMany({
    where: { status: 'PENDING', endsAt: { gt: now } },
    orderBy: { startsAt: 'asc' },
    take: 50,
    select: ROW_SELECT,
  })
  return rows.map(toRow)
}

/** The servants who approve van requests, by name (2026-11-04). Those who left no longer count. */
export async function reservationApprovers(): Promise<Array<{ servantId: string; name: string }>> {
  const rows = await prisma.reservationApprover.findMany({
    where: { servant: { account: { isActive: true } } },
    select: { servantId: true, servant: { select: { account: { select: { displayName: true } } } } },
  })
  return rows.map((r) => ({ servantId: r.servantId, name: r.servant.account.displayName })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function reservationApproverIds(): Promise<string[]> {
  return (await reservationApprovers()).map((a) => a.servantId)
}
