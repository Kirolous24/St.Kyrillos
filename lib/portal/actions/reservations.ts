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
  DECISION_NOTE_MAX,
  HOLDING_STATUSES,
  MAX_RESERVATION_SERVANTS,
  REASON_NEEDED,
  RESERVATION_REASON_MAX,
  canReserve,
  formatReservationTime,
  isReservationColor,
  mayCancelReservation,
  mayDecideReservation,
  mayEditReservation,
  needsNewApproval,
  readReservationTimes,
  reservationNotices,
  reservationPurpose,
  statusAfterSave,
  type ReservationRecipient,
  type ReservationSnapshot,
  type ReservationStatus,
} from '../reservations'
import { reservationApproverIds, reservationServiceOptions } from '../data/reservations'

// Van reservations (2026-11-02). Anyone serving may reserve; two reservations
// of one van never overlap; whoever made one, the servants on it and the admin
// may change or cancel it until it is over. The admin keeps the list of vans.
// Since 2026-11-04 each reservation is a request: "it needs to go through" an
// approver the admin names, who approves or rejects it.

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
  reason: z.string().trim().max(RESERVATION_REASON_MAX, `Keep the reason under ${RESERVATION_REASON_MAX} characters.`).optional(),
})

export type ReservationInput = z.input<typeof ReservationSchema>

const RES_SELECT = {
  id: true,
  itemId: true,
  startsAt: true,
  endsAt: true,
  service: true,
  reason: true,
  status: true,
  decidedById: true,
  decidedAt: true,
  decisionNote: true,
  createdById: true,
  updatedAt: true,
  item: { select: { name: true } },
  createdBy: { select: { displayName: true, servant: { select: { id: true } } } },
  decidedBy: { select: { displayName: true } },
  servants: { select: { servantId: true, servant: { select: { account: { select: { displayName: true } } } } } },
} as const

interface Loaded {
  id: string
  itemId: string
  startsAt: Date
  endsAt: Date
  service: string
  reason: string | null
  status: ReservationStatus
  decidedById: string | null
  decidedAt: Date | null
  decisionNote: string | null
  createdById: string | null
  updatedAt: Date
  item: { name: string }
  createdBy: { displayName: string; servant: { id: string } | null } | null
  decidedBy: { displayName: string } | null
  servants: Array<{ servantId: string; servant: { account: { displayName: string } } }>
}

async function load(id: string): Promise<Loaded | null> {
  return (await prisma.reservation.findUnique({ where: { id }, select: RES_SELECT })) as Loaded | null
}

function snapshot(r: Loaded): ReservationSnapshot {
  return {
    id: r.id,
    itemName: r.item.name,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    service: r.service,
    reason: r.reason,
    status: r.status,
    servantIds: r.servants.map((s) => s.servantId),
    servantNames: r.servants.map((s) => s.servant.account.displayName).sort((a, b) => a.localeCompare(b)),
    requester: r.createdById && r.createdBy ? { accountId: r.createdById, servantId: r.createdBy.servant?.id ?? null, name: r.createdBy.displayName } : null,
    decidedById: r.decidedById,
    decidedByName: r.decidedBy?.displayName ?? null,
    decidedAt: r.decidedAt,
    decisionNote: r.decisionNote,
  }
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

/** Who is told of a request: the approvers, or every admin while nobody is named. */
async function requestRecipients(approverIds: readonly string[]): Promise<ReservationRecipient[]> {
  if (approverIds.length > 0) return approverIds.map((servantId) => ({ servantId }))
  const admins = await prisma.account.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
  return admins.map((a) => ({ accountId: a.id }))
}

/** Tell the approvers, the one who asked and the servants on it what someone else did. Never fails the save. */
async function tellPeople(before: ReservationSnapshot | null, after: ReservationSnapshot | null, user: PortalUser, approverIds: readonly string[], now: Date) {
  try {
    const notices = reservationNotices(before, after, {
      actor: { accountId: user.accountId, servantId: user.servantId ?? null, name: user.displayName },
      approvers: await requestRecipients(approverIds),
      now,
    })
    if (notices.length === 0) return
    await deliverNotices(
      notices.map(({ to, ...n }) => ({
        ...to,
        ...n,
        kind: 'reservation' as const,
        dedupeKey: `reservation:${'servantId' in to ? to.servantId : to.accountId}:${randomUUID()}`,
      })),
    )
  } catch (err) {
    console.error('Reservation notices failed:', err)
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Hold the van, then find what already has it at that time: an approved
 * reservation or a request still waiting for its answer. Two people pressing
 * at once cannot both get it, since the second waits here for the first.
 */
async function firstClash(tx: Tx, item: { id: string; name: string }, span: { startsAt: Date; endsAt: Date }, besides?: string): Promise<PortalError | null> {
  await tx.$queryRaw`SELECT "id" FROM "ReservationItem" WHERE "id" = ${item.id} FOR UPDATE`
  const clash = await tx.reservation.findFirst({
    where: {
      itemId: item.id,
      startsAt: { lt: span.endsAt },
      endsAt: { gt: span.startsAt },
      status: { in: HOLDING_STATUSES },
      ...(besides ? { id: { not: besides } } : {}),
    },
    orderBy: { startsAt: 'asc' },
    select: {
      startsAt: true,
      endsAt: true,
      service: true,
      reason: true,
      status: true,
      createdBy: { select: { displayName: true } },
      servants: { select: { servant: { select: { account: { select: { displayName: true } } } } } },
    },
  })
  if (!clash) return null
  const names = clash.servants.map((s) => s.servant.account.displayName)
  const who = names.length > 0 ? andList(names) : (clash.createdBy?.displayName ?? 'someone')
  const what = `${formatReservationTime(clash)}, ${reservationPurpose(clash)} (${who})`
  return new PortalError(
    clash.status === 'PENDING' ? `The ${item.name} is already requested then: ${what}. It is waiting for approval.` : `The ${item.name} is already reserved then: ${what}.`,
  )
}

export async function saveReservation(raw: ReservationInput): Promise<ActionResult<{ id: string; month: string; status: ReservationStatus }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!canReserve(user.role)) throw new PortalError('Only servants can reserve a van.')
    const input = parse(ReservationSchema, raw)
    const now = new Date()

    const before = input.id ? await load(input.id) : null
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
    // Asked of a reservation made before it was needed, too, the next time it is changed.
    const reason = input.reason ?? ''
    if (!reason) throw new PortalError(REASON_NEEDED)

    const servantIds = Array.from(new Set(input.servantIds))
    if (servantIds.length === 0) throw new PortalError('Pick the servants taking the van.')
    const here = await prisma.servant.count({ where: { id: { in: servantIds }, account: { isActive: true } } })
    if (here !== servantIds.length) throw new PortalError('One of those servants is no longer here. Pick them again.')

    const item = await prisma.reservationItem.findUnique({ where: { id: input.itemId }, select: { id: true, name: true, isActive: true } })
    // A van retired since this reservation was made still keeps it; nobody new gets it.
    if (!item || (!item.isActive && item.id !== before?.itemId)) throw new PortalError('That van can no longer be reserved. Pick another.')

    const approverIds = await reservationApproverIds()
    const next = statusAfterSave(
      before,
      !before || needsNewApproval(before, { itemId: item.id, startsAt: times.startsAt, endsAt: times.endsAt, service: input.service, reason }),
      { accountId: user.accountId, decides: mayDecideReservation(user, approverIds) },
    )
    const decision =
      next.stamp === 'now'
        ? { decidedById: user.accountId, decidedAt: now, decisionNote: null }
        : next.stamp === 'clear'
          ? { decidedById: null, decidedAt: null, decisionNote: null }
          : {}

    const saved = (await prisma.$transaction(
      async (tx) => {
        // One not approved holds no time, so it cannot clash.
        if (next.status !== 'REJECTED') {
          const clash = await firstClash(tx, item, times, before?.id)
          if (clash) throw clash
        }
        const data = {
          itemId: item.id,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          service: input.service,
          reason,
          status: next.status,
          ...decision,
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
    const waiting = after.status === 'PENDING' ? ' (waiting for approval)' : ''
    await audit(user, before ? 'reservation.update' : 'reservation.create', 'reservation', saved.id, `${after.itemName} for ${reservationPurpose(after)}: ${formatReservationTime(after)}${waiting}`)
    await tellPeople(before ? snapshot(before) : null, after, user, approverIds, now)
    revalidateReservations(saved.id)
    return { id: saved.id, month: monthOf(after.startsAt), status: after.status }
  })
}

const DecisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(DECISION_NOTE_MAX, `Keep it under ${DECISION_NOTE_MAX} characters.`).optional(),
})

/**
 * Approve or reject a van request (2026-11-04): the approvers the admin named,
 * and the admin. An approved one may still be rejected (the van broke down),
 * and a rejected one approved if its time is still free.
 */
export async function decideReservation(raw: z.input<typeof DecisionSchema>): Promise<ActionResult<{ status: ReservationStatus }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = parse(DecisionSchema, raw)
    const approverIds = await reservationApproverIds()
    if (!mayDecideReservation(user, approverIds)) throw new PortalError('Only the servants who approve van requests, or the admin, can do that.')
    const before = await load(input.id)
    if (!before) throw new PortalError('That reservation is no longer there.')
    const now = new Date()
    if (before.endsAt <= now) throw new PortalError('This reservation is over.')
    if (before.status === input.decision) throw new PortalError(input.decision === 'APPROVED' ? 'It is already approved.' : 'It is already rejected.')
    const note = input.decision === 'REJECTED' ? input.note || null : null

    const saved = (await prisma.$transaction(
      async (tx) => {
        if (input.decision === 'APPROVED') {
          const clash = await firstClash(tx, { id: before.itemId, name: before.item.name }, before, before.id)
          if (clash) throw clash
        }
        // Only the request as the approver saw it: not one changed since.
        const done = await tx.reservation.updateMany({
          where: { id: before.id, status: before.status, updatedAt: before.updatedAt },
          data: { status: input.decision, decidedById: user.accountId, decidedAt: now, decisionNote: note },
        })
        if (done.count === 0) throw new PortalError('Someone changed this request just now. Look at it again.')
        return tx.reservation.findUnique({ where: { id: before.id }, select: RES_SELECT })
      },
      { timeout: 15_000 },
    )) as Loaded

    const after = snapshot(saved)
    const said = note ? ` (“${note}”)` : ''
    await audit(
      user,
      input.decision === 'APPROVED' ? 'reservation.approve' : 'reservation.reject',
      'reservation',
      saved.id,
      `${input.decision === 'APPROVED' ? 'approved' : 'rejected'} the ${after.itemName} for ${reservationPurpose(after)}: ${formatReservationTime(after)}${said}`,
    )
    await tellPeople(snapshot(before), after, user, approverIds, now)
    revalidateReservations(saved.id)
    return { status: after.status }
  })
}

export async function cancelReservation(id: string): Promise<ActionResult<{ month: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (!canReserve(user.role)) throw new PortalError('Only servants can reserve a van.')
    const before = await load(parse(z.string().min(1), id))
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
    await tellPeople(snap, null, user, await reservationApproverIds(), now)
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

// ── Who approves van requests (2026-11-04) ─────────────────────────────────

/** Name a servant who approves van requests. */
export async function addReservationApprover(servantId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const servant = await prisma.servant.findFirst({
      where: { id: parse(z.string().min(1), servantId), account: { isActive: true } },
      select: { id: true, account: { select: { displayName: true } } },
    })
    if (!servant) throw new PortalError('That servant is no longer here.')
    await prisma.reservationApprover.upsert({ where: { servantId: servant.id }, create: { servantId: servant.id }, update: {} })
    await audit(user, 'reservation.approver.add', 'reservationApprover', servant.id, `${servant.account.displayName} approves van requests`)
    revalidateItems()
    return undefined
  })
}

/** Stop a servant approving van requests. */
export async function removeReservationApprover(servantId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAdmin()
    const id = parse(z.string().min(1), servantId)
    const row = await prisma.reservationApprover.findUnique({ where: { servantId: id }, select: { servant: { select: { account: { select: { displayName: true } } } } } })
    if (!row) throw new PortalError('They no longer approve van requests.')
    await prisma.reservationApprover.delete({ where: { servantId: id } })
    await audit(user, 'reservation.approver.remove', 'reservationApprover', id, `${row.servant.account.displayName} no longer approves van requests`)
    revalidateItems()
    return undefined
  })
}
