'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate } from '../dates'
import { canManageAnnouncement } from '../data/community'
import { audit } from '../audit'
import type { PortalUser } from '../permissions'

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1, 'Give the announcement a title.').max(140),
  body: z.string().trim().min(1, 'Write something to announce.').max(4000),
  emoji: z.string().trim().max(8).optional(),
  date: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().min(-999).max(999).optional(),
  /** '' (or missing) means church-wide. */
  classId: z.string().trim().optional(),
  stage: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', '']).optional(),
  isActive: z.boolean().optional(),
})

export type AnnouncementInput = z.input<typeof AnnouncementSchema>

type Target = { classId: string | null; stage: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | null }

/**
 * Church-wide and stage-wide announcements belong to admins and pastors;
 * a servant may only speak to a class they actually serve.
 */
async function resolveTarget(user: PortalUser, input: z.infer<typeof AnnouncementSchema>): Promise<Target> {
  const classId = input.classId ? input.classId : null
  const stage = input.stage ? input.stage : null

  if (!canManageAnnouncement(user, classId)) {
    throw new PortalError(
      classId
        ? 'You can only post announcements for your own classes.'
        : 'Only admins and pastors can post church-wide announcements.',
    )
  }
  if (stage && user.role !== 'ADMIN' && user.role !== 'PASTOR') {
    throw new PortalError('Only admins and pastors can target a whole stage.')
  }
  if (classId) {
    const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true } })
    if (!cls) throw new PortalError('That class no longer exists.')
    // A class announcement is already narrower than its stage.
    return { classId, stage: null }
  }
  return { classId: null, stage }
}

function describe(target: Target, className: string | null): string {
  if (target.classId) return className ?? target.classId
  if (target.stage) return target.stage.replace('_', ' ').toLowerCase()
  return 'church-wide'
}

export async function createAnnouncement(raw: AnnouncementInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = AnnouncementSchema.parse(raw)
    const target = await resolveTarget(user, input)

    const date = input.date ? parseDateOnly(input.date) : null
    if (input.date && !date) throw new PortalError('Pick a valid date.')

    const created = await prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        emoji: input.emoji || null,
        date: date ? toUTCDate(date) : null,
        sortOrder: input.sortOrder ?? 0,
        classId: target.classId,
        stage: target.stage,
        isActive: input.isActive ?? true,
        createdById: user.accountId,
      },
      select: { id: true, class: { select: { name: true } } },
    })

    await audit(user, 'announcement.create', 'announcement', created.id, `${describe(target, created.class?.name ?? null)}: "${input.title}"`)
    revalidatePath('/portal/announcements')
    revalidatePath('/portal')
    return { id: created.id }
  })
}

const UpdateSchema = AnnouncementSchema.extend({ announcementId: z.string().min(1) })

export type UpdateAnnouncementInput = z.input<typeof UpdateSchema>

async function loadAnnouncement(id: string) {
  const row = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, title: true, classId: true, isActive: true, class: { select: { name: true } } },
  })
  if (!row) throw new PortalError('That announcement is no longer there.')
  return row
}

export async function updateAnnouncement(raw: UpdateAnnouncementInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = UpdateSchema.parse(raw)
    const existing = await loadAnnouncement(input.announcementId)
    // Must be allowed to touch it where it is, and where it is going.
    if (!canManageAnnouncement(user, existing.classId)) {
      throw new PortalError('You do not have permission to edit this announcement.')
    }
    const target = await resolveTarget(user, input)

    const date = input.date ? parseDateOnly(input.date) : null
    if (input.date && !date) throw new PortalError('Pick a valid date.')

    await prisma.announcement.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        body: input.body,
        emoji: input.emoji || null,
        date: date ? toUTCDate(date) : null,
        sortOrder: input.sortOrder ?? 0,
        classId: target.classId,
        stage: target.stage,
        isActive: input.isActive ?? true,
      },
    })

    await audit(user, 'announcement.update', 'announcement', existing.id, `edited "${input.title}"`)
    revalidatePath('/portal/announcements')
    revalidatePath('/portal')
    return undefined
  })
}

const VisibilitySchema = z.object({ announcementId: z.string().min(1), isActive: z.boolean() })

export async function setAnnouncementActive(raw: z.infer<typeof VisibilitySchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = VisibilitySchema.parse(raw)
    const existing = await loadAnnouncement(input.announcementId)
    if (!canManageAnnouncement(user, existing.classId)) {
      throw new PortalError('You do not have permission to change this announcement.')
    }

    await prisma.announcement.update({ where: { id: existing.id }, data: { isActive: input.isActive } })

    await audit(user, 'announcement.visibility', 'announcement', existing.id, `${input.isActive ? 'showed' : 'hid'} "${existing.title}"`)
    revalidatePath('/portal/announcements')
    revalidatePath('/portal')
    return undefined
  })
}

export async function deleteAnnouncement(announcementId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const existing = await loadAnnouncement(z.string().min(1).parse(announcementId))
    if (!canManageAnnouncement(user, existing.classId)) {
      throw new PortalError('You do not have permission to delete this announcement.')
    }

    await prisma.announcement.delete({ where: { id: existing.id } })

    await audit(user, 'announcement.delete', 'announcement', existing.id, `deleted "${existing.title}"`)
    revalidatePath('/portal/announcements')
    revalidatePath('/portal')
    return undefined
  })
}
