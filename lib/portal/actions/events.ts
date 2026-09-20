'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate } from '../dates'
import { assertCanTarget, optionalHttpUrl } from '../data/community'
import { audit } from '../audit'

const EventSchema = z.object({
  title: z.string().trim().min(1, 'Give the event a name.').max(120),
  date: z.string().trim().min(1, 'Pick a date.'),
  time: z.string().trim().max(40).optional(),
  location: z.string().trim().max(160).optional(),
  link: optionalHttpUrl,
  notes: z.string().trim().max(2000).optional(),
  targetAll: z.boolean(),
  classIds: z.array(z.string().min(1)).max(50),
})

export type EventInput = z.input<typeof EventSchema>

/** Targeting is settled server-side: a servant may only name their own classes. */
async function resolveTargets(classIds: string[], targetAll: boolean) {
  if (targetAll) return []
  const unique = Array.from(new Set(classIds))
  if (unique.length === 0) throw new PortalError('Choose at least one class, or target the whole Sunday School.')
  const found = await prisma.schoolClass.findMany({ where: { id: { in: unique } }, select: { id: true } })
  if (found.length !== unique.length) throw new PortalError('One of those classes no longer exists.')
  return found.map((c) => c.id)
}

export async function createEvent(raw: EventInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = EventSchema.parse(raw)
    assertCanTarget(user, input.classIds, input.targetAll)

    const date = parseDateOnly(input.date)
    if (!date) throw new PortalError('Pick a valid date.')
    const targets = await resolveTargets(input.classIds, input.targetAll)

    const event = await prisma.portalEvent.create({
      data: {
        title: input.title,
        date: toUTCDate(date),
        time: input.time || null,
        location: input.location || null,
        link: input.link,
        notes: input.notes || null,
        targetAll: input.targetAll,
        createdById: user.accountId,
        classes: { create: targets.map((classId) => ({ classId })) },
      },
      select: { id: true },
    })

    await audit(user, 'event.create', 'event', event.id, `${input.title} on ${date}${input.targetAll ? ' (whole Sunday School)' : ` (${targets.length} class${targets.length === 1 ? '' : 'es'})`}`)
    revalidatePath('/portal/events')
    revalidatePath('/portal')
    return { id: event.id }
  })
}

const UpdateSchema = EventSchema.extend({ eventId: z.string().min(1) })

export type UpdateEventInput = z.input<typeof UpdateSchema>

async function loadEvent(eventId: string) {
  const event = await prisma.portalEvent.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, targetAll: true, classes: { select: { classId: true } } },
  })
  if (!event) throw new PortalError('That event is no longer there.')
  return event
}

export async function updateEvent(raw: UpdateEventInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = UpdateSchema.parse(raw)
    const event = await loadEvent(input.eventId)

    // Both the event as it stands and the event as it would become must be
    // within reach, so nobody can grab an event by retargeting it.
    assertCanTarget(user, event.classes.map((c) => c.classId), event.targetAll)
    assertCanTarget(user, input.classIds, input.targetAll)

    const date = parseDateOnly(input.date)
    if (!date) throw new PortalError('Pick a valid date.')
    const targets = await resolveTargets(input.classIds, input.targetAll)

    await prisma.$transaction([
      prisma.portalEventClass.deleteMany({ where: { eventId: event.id } }),
      prisma.portalEvent.update({
        where: { id: event.id },
        data: {
          title: input.title,
          date: toUTCDate(date),
          time: input.time || null,
          location: input.location || null,
          link: input.link,
          notes: input.notes || null,
          targetAll: input.targetAll,
          classes: { create: targets.map((classId) => ({ classId })) },
        },
      }),
    ])

    await audit(user, 'event.update', 'event', event.id, `${input.title} on ${date}`)
    revalidatePath('/portal/events')
    revalidatePath('/portal')
    return undefined
  })
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const event = await loadEvent(z.string().min(1).parse(eventId))
    assertCanTarget(user, event.classes.map((c) => c.classId), event.targetAll)

    await prisma.portalEvent.delete({ where: { id: event.id } })

    await audit(user, 'event.delete', 'event', event.id, `deleted "${event.title}"`)
    revalidatePath('/portal/events')
    revalidatePath('/portal')
    return undefined
  })
}
