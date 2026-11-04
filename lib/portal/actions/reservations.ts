'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { deliverNotices } from '../notice-delivery'
import { churchClock } from '../dates'
import { andList } from '../format'
import type { PortalUser } from '../permissions'
import {
  MAX_RESERVATION_SERVANTS,
  RESERVATION_NOTE_MAX,
  SERVICE_OTHER,
  canReserve,
  formatReservationTime,
  isReservationColor,
  mayCancelReservation,
  mayEditReservation,
  readReservationTimes,
  reservationNotices,
  reservationPurpose,
  type ReservationSnapshot,
} from '../reservations'
import { reservationServiceOptions } from '../data/reservations'

// Van reservations (2026-11-02). Anyone serving may reserve; two reservations
// of one van never overlap; whoever made one, the servants on it and the admin
// may change or cancel it until it is over. The admin keeps the list of vans.

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.output<T> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new PortalError(parsed.error.issues[0]?.message ?? 'Something in the form could not be read.')
  return parsed.data
}

const ReservationSchema = z.object({
  id: z.string().min(1).optional(),
  itemId: z.string().min(1, 'Pick a van.'),
  date: z.string().max(20),
  from: z.string().max(10),
  until: z.string().max(10),
  untilDate: z.string().max(20).optional(),
  servantIds: z.array(z.string().min(1)).max(MAX_RESERVATION_SERVANTS, `Pick at most ${MAX_RESERVATION_SERVANTS} servants.`),
  service: z.string().trim().max(80),
  note: z.string().trim().max(RESERVATION_NOTE_MAX, `Keep the note under ${RESERVATION_NOTE_MAX} characters.`).optional(),
})

export type ReservationInput = z.input<typeof ReservationSchema>

const RES_SELECT = {
  id: true,
  itemId: true,
  startsAt: true,
  endsAt: true,
  service: true,
  note: true,
  createdById: true,
  item: { select: { name: true } },
  servants: { select: { servantId: true } },
} as const

interface Loaded {
  id: string
  itemId: string
  startsAt: Date
  endsAt: Date
  service: string
  note: string | null
  createdById: string | null
  item: { name: string }
  servants: Array<{ servantId: string }>
}

function snapshot(r: Loaded): ReservationSnapshot {
  return { id: r.id, itemName: r.item.name, startsAt: r.startsAt, endsAt: r.endsAt, service: r.service, note: r.note, servantIds: r.servants.map((s) => s.servantId) }
}

function owned(r: Loaded) {
  return { createdById: r.createdById, servantIds: r.servants.map((s) => s.servantId), endsAt: r.endsAt }
}

function monthOf(at: Date): string {
  return churchClock(at).date.slice(0, 7)
}

function revalidateReservations(id?: string) {
  revalidatePath('/portal/reservations')
  if (id) revalidatePath(`/portal/reservations/${id}`)
}

/** Tell the servants on it what someone else did. Never fails the save. */
async function tellServants(before: ReservationSnapshot | null, after: ReservationSnapshot | null, user: PortalUser, now: Date) {
  try {
    const notices = reservationNotices(before, after, { servantId: user.servantId ?? null, name: user.displayName }, now)
    if (notices.length === 0) return
    await deliverNotices(notices.map((n) => ({ ...n, kind: 'reservation' as const, dedupeKey: `reservation:${n.servantId}:${randomUUID()}` })))
  } catch (err) {
    console.error('Reservation notices failed:', err)
  }
}

export async function saveReservation(raw: ReservationInput): Promise<ActionResult<{ id: string; month: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!canReserve(user.role)) throw new PortalError('Only servants can reserve a van.')
    const input = parse(ReservationSchema, raw)
    const now = new Date()

    const before = input.id ? ((await prisma.reservation.findUnique({ where: { id: input.id }, select: RES_SELECT })) as Loaded | null) : null
    if (input.id && !before) throw new PortalError('That reservation is no longer there.')
    if (before) {
      if (before.endsAt <= now) throw new PortalError('This reservation is over, so it can no longer be changed.')
      if (!mayEditReservation(user, owned(before), now)) {
        throw new PortalError('Only the one who made this reservation, the servants on it, or the admin can change it.')
      }
    }

    const times = readReservationTimes(input, now)
    if (!times.ok) throw new PortalError(times.error)

    // A reservation keeps what it was made for, though that meeting has been renamed since.
    const kept = before?.service === input.service
    if (!kept && !(await reservationServiceOptions()).includes(input.service)) throw new PortalError('Pick what the van is for.')
    const note = input.note?.trim() || null
    if (input.service === SERVICE_OTHER && !note) throw new PortalError('Say in the note what the van is for.')

    const servantIds = Array.from(new Set(input.servantIds))
    if (servantIds.length === 0) throw new PortalError('Pick the servants taking the van.')
    const here = await prisma.servant.count({ where: { id: { in: servantIds }, account: { isActive: true } } })
    if (here !== servantIds.length) throw new PortalError('One of those servants is no longer here. Pick them again.')

    const item = await prisma.reservationItem.findUnique({ where: { id: input.itemId }, select: { id: true, name: true, isActive: true } })
    // A van retired since this reservation was made still keeps it; nobody new gets it.
    if (!item || (!item.isActive && item.id !== before?.itemId)) throw new PortalError('That van can no longer be reserved. Pick another.')

    const saved = (await prisma.$transaction(
      async (tx) => {
        // One booking of a van at a time: two people pressing Reserve together
        // cannot both get it, since the second waits here for the first.
        await tx.$queryRaw`SELECT "id" FROM "ReservationItem" WHERE "id" = ${item.id} FOR UPDATE`
        const clash = await tx.reservation.findFirst({
          where: { itemId: item.id, startsAt: { lt: times.endsAt }, endsAt: { gt: times.startsAt }, ...(before ? { id: { not: before.id } } : {}) },
          orderBy: { startsAt: 'asc' },
          select: {
            startsAt: true,
            endsAt: true,
            service: true,
            note: true,
            createdBy: { select: { displayName: true } },
            servants: { select: { servant: { select: { account: { select: { displayName: true } } } } } },
          },
        })
        if (clash) {
          const names = clash.servants.map((s) => s.servant.account.displayName)
          const who = names.length > 0 ? andList(names) : (clash.createdBy?.displayName ?? 'someone')
          throw new PortalError(`The ${item.name} is already reserved then: ${formatReservationTime(clash)}, ${reservationPurpose(clash)} (${who}).`)
        }
        const data = {
          itemId: item.id,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          service: input.service,
          note,
          servants: { create: servantIds.map((servantId) => ({ servantId })) },
        }
        if (before) {
          await tx.reservationServant.deleteMany({ where: { reservationId: before.id } })
          return tx.reservation.update({ where: { id: before.id }, data, select: RES_SELECT })
        }
        return tx.reservation.create({ data: { ...data, createdById: user.accountId }, select: RES_SELECT })
      },
      { timeout: 15_000 },
    )) as Loaded

    const after = snapshot(saved)
    await audit(user, before ? 'reservation.update' : 'reservation.create', 'reservation', saved.id, `${after.itemName} for ${reservationPurpose(after)}: ${formatReservationTime(after)}`)
    await tellServants(before ? snapshot(before) : null, after, user, now)
    revalidateReservations(saved.id)
    return { id: saved.id, month: monthOf(after.startsAt) }
  })
}

export async function cancelReservation(id: string): Promise<ActionResult<{ month: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!canReserve(user.role)) throw new PortalError('Only servants can reserve a van.')
    const before = (await prisma.reservation.findUnique({ where: { id: parse(z.string().min(1), id) }, select: RES_SELECT })) as Loaded | null
    if (!before) throw new PortalError('That reservation is no longer there.')
    const now = new Date()
    if (!mayCancelReservation(user, owned(before), now)) {
      throw new PortalError(
        before.endsAt <= now
          ? 'This reservation is over. Only the admin can take it off.'
          : 'Only the one who made this reservation, the servants on it, or the admin can cancel it.',
      )
    }
    const gone = await prisma.reservation.deleteMany({ where: { id: before.id } })
    if (gone.count === 0) throw new PortalError('That reservation is no longer there.')

    const snap = snapshot(before)
    await audit(user, 'reservation.cancel', 'reservation', before.id, `cancelled the ${snap.itemName} for ${reservationPurpose(snap)}: ${formatReservationTime(snap)}`)
    await tellServants(snap, null, user, now)
    revalidateReservations(before.id)
    return { month: monthOf(before.startsAt) }
  })
}

// ── The admin's list of vans ────────────────────────────────────────────────

const ItemSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, 'Give the van a name.').max(60, 'Keep the name under 60 characters.'),
  details: z.string().trim().max(200, 'Keep the details under 200 characters.').optional(),
  color: z.string(),
})

export type ReservationItemInput = z.input<typeof ItemSchema>

async function requireAdmin(): Promise<PortalUser> {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') throw new PortalError('Only the Sunday School admin can change the vans.')
  return user
}

async function loadItem(id: string) {
  const item = await prisma.reservationItem.findUnique({ where: { id: parse(z.string().min(1), id) }, select: { id: true, name: true, isActive: true } })
  if (!item) throw new PortalError('That van is no longer there.')
  return item
}

function revalidateItems() {
  revalidatePath('/portal/reservations')
  revalidatePath('/portal/reservations/manage')
}

export async function saveReservationItem(raw: ReservationItemInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const input = parse(ItemSchema, raw)
    if (!isReservationColor(input.color)) throw new PortalError('Pick one of the colors.')
    const taken = await prisma.reservationItem.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' }, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { name: true },
    })
    if (taken) throw new PortalError(`There is already a van called “${taken.name}”.`)
    const data = { name: input.name, details: input.details || null, color: input.color }

    if (input.id) {
      const item = await loadItem(input.id)
      await prisma.reservationItem.update({ where: { id: item.id }, data })
      await audit(user, 'reservation.item.update', 'reservationItem', item.id, item.name === input.name ? `updated the ${input.name}` : `renamed the ${item.name} to ${input.name}`)
      revalidateItems()
      return { id: item.id }
    }
    const last = await prisma.reservationItem.aggregate({ _max: { sortOrder: true } })
    const created = await prisma.reservationItem.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 }, select: { id: true } })
    await audit(user, 'reservation.item.create', 'reservationItem', created.id, `added the ${input.name}`)
    revalidateItems()
    return { id: created.id }
  })
}

/** Retire a van (no new reservations; the old ones stay), or bring it back. */
export async function setReservationItemActive(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const item = await loadItem(id)
    await prisma.reservationItem.update({ where: { id: item.id }, data: { isActive: active === true } })
    await audit(user, active ? 'reservation.item.restore' : 'reservation.item.retire', 'reservationItem', item.id, active ? `can reserve the ${item.name} again` : `retired the ${item.name}`)
    revalidateItems()
    return undefined
  })
}

/** Delete a van nobody has reserved; one with reservations can only be retired. */
export async function deleteReservationItem(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const item = await loadItem(id)
    if ((await prisma.reservation.count({ where: { itemId: item.id } })) > 0) {
      throw new PortalError(`The ${item.name} has reservations, so it can only be retired.`)
    }
    await prisma.reservationItem.delete({ where: { id: item.id } })
    await audit(user, 'reservation.item.delete', 'reservationItem', item.id, `deleted the ${item.name}`)
    revalidateItems()
    return undefined
  })
}
