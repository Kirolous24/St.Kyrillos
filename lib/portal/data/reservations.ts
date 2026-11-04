import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PortalUser } from '../permissions'
import { defaultService, serviceOptions } from '../reservations'

// What the van reservation pages read (2026-11-02). Every reservation is open
// to every servant: the point is to see who has which van when.

const ROW_SELECT = {
  id: true,
  itemId: true,
  startsAt: true,
  endsAt: true,
  service: true,
  note: true,
  createdById: true,
  createdAt: true,
  item: { select: { name: true, color: true } },
  createdBy: { select: { displayName: true } },
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
  note: string | null
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
    note: r.note,
    createdById: r.createdById,
    createdByName: r.createdBy?.displayName ?? null,
    createdAt: r.createdAt,
    servants: r.servants
      .map((s) => ({ id: s.servant.id, name: s.servant.account.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Every reservation out at any moment from `from` to `to`, earliest first. */
export async function reservationsBetween(from: Date, to: Date): Promise<ReservationRow[]> {
  const rows = await prisma.reservation.findMany({
    where: { startsAt: { lt: to }, endsAt: { gt: from } },
    orderBy: { startsAt: 'asc' },
    select: ROW_SELECT,
  })
  return rows.map(toRow)
}

/** The reservations someone made or is on that are not over yet, soonest first. */
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

/** The services a van goes out for, with this church's meetings by name. */
export async function reservationServiceOptions(): Promise<string[]> {
  const meetings = await prisma.schoolClass.findMany({
    where: { stage: 'FELLOWSHIP', isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { name: true },
  })
  return serviceOptions(meetings.map((m) => m.name))
}

/** The service this person most likely reserves for. */
export async function defaultServiceFor(user: Pick<PortalUser, 'classIds' | 'stageOversight'>): Promise<string> {
  const classes = user.classIds.length > 0 ? await prisma.schoolClass.findMany({ where: { id: { in: user.classIds } }, select: { stage: true, name: true } }) : []
  return defaultService(classes, user.stageOversight)
}
