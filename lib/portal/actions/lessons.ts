'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { assertClassAction } from '../data/classes'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { parseDateOnly, toUTCDate, formatDateOnly } from '../dates'
import { safeUrl, TEACHING_WRITE } from '../agenda'
import { loadLessonForAction } from '../data/lessons'
import { audit } from '../audit'

const LinkSchema = z.object({
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().max(2000),
})

const LessonSchema = z.object({
  id: z.string().min(1).optional(),
  classId: z.string().min(1),
  title: z.string().trim().min(1, 'Give the lesson a title.').max(140),
  date: z.string().trim().optional(),
  topics: z.array(z.string().trim().max(120)).max(20).optional(),
  notes: z.string().trim().max(5000).optional(),
  links: z.array(LinkSchema).max(12).optional(),
  status: z.enum(['PLANNED', 'TAUGHT']).optional(),
  assignedToId: z.string().trim().optional(),
})

export type SaveLessonInput = z.infer<typeof LessonSchema>

/** A servant may only be assigned a lesson in a class they actually serve. */
async function resolveAssignee(classId: string, servantId: string | undefined): Promise<string | null> {
  if (!servantId) return null
  const link = await prisma.classServant.findUnique({
    where: { classId_servantId: { classId, servantId } },
    select: { servantId: true },
  })
  if (!link) throw new PortalError('That servant does not serve this class.')
  return link.servantId
}

function cleanLinks(links: SaveLessonInput['links']): { label: string; url: string }[] {
  if (!links) return []
  const out: { label: string; url: string }[] = []
  for (const link of links) {
    const url = safeUrl(link.url)
    if (!url) continue
    out.push({ label: (link.label ?? '').trim() || url, url })
  }
  return out
}

export async function saveLesson(raw: SaveLessonInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = LessonSchema.parse(raw)
    const cls = await assertClassAction(user, input.classId, TEACHING_WRITE)

    if (input.date && !parseDateOnly(input.date)) throw new PortalError('Pick a valid date.')
    const date = input.date ? parseDateOnly(input.date) : null
    const assignedToId = await resolveAssignee(cls.id, input.assignedToId || undefined)
    const topics = (input.topics ?? []).map((t) => t.trim()).filter(Boolean)
    const links = cleanLinks(input.links)

    const data = {
      title: input.title,
      date: date ? toUTCDate(date) : null,
      topics,
      notes: input.notes || null,
      links,
      status: input.status ?? 'PLANNED',
      assignedToId,
    }

    let id: string
    if (input.id) {
      const existing = await loadLessonForAction(input.id)
      if (!existing) throw new PortalError('Lesson not found.')
      // Moving a lesson between classes is not an edit; block it outright.
      if (existing.classId !== cls.id) throw new PortalError('That lesson belongs to another class.')
      const updated = await prisma.lesson.update({ where: { id: existing.id }, data, select: { id: true } })
      id = updated.id
      await audit(user, 'lesson.update', 'lesson', id, `${cls.name}: "${input.title}"`)
    } else {
      const created = await prisma.lesson.create({
        data: { ...data, classId: cls.id, createdById: user.accountId },
        select: { id: true },
      })
      id = created.id
      await audit(user, 'lesson.create', 'lesson', id, `${cls.name}: "${input.title}"${date ? ` on ${date}` : ''}`)
    }

    revalidatePath('/portal/lessons')
    revalidatePath('/portal/assignments')
    revalidatePath('/portal')
    return { id }
  })
}

const StatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PLANNED', 'TAUGHT']),
})

export async function setLessonStatus(raw: z.infer<typeof StatusSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = StatusSchema.parse(raw)
    const lesson = await loadLessonForAction(input.id)
    if (!lesson) throw new PortalError('Lesson not found.')
    const cls = await assertClassAction(user, lesson.classId, TEACHING_WRITE)

    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: input.status } })
    await audit(
      user,
      'lesson.status',
      'lesson',
      lesson.id,
      `${cls.name}: "${lesson.title}" marked ${input.status === 'TAUGHT' ? 'taught' : 'planned'}`,
    )
    revalidatePath('/portal/lessons')
    revalidatePath('/portal/assignments')
    return undefined
  })
}

export async function deleteLesson(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const lessonId = z.string().min(1).parse(id)
    const lesson = await loadLessonForAction(lessonId)
    if (!lesson) throw new PortalError('Lesson not found.')
    const cls = await assertClassAction(user, lesson.classId, TEACHING_WRITE)

    await prisma.lesson.delete({ where: { id: lesson.id } })
    await audit(user, 'lesson.delete', 'lesson', lesson.id, `${cls.name}: deleted "${lesson.title}"`)
    revalidatePath('/portal/lessons')
    revalidatePath('/portal/assignments')
    return undefined
  })
}

const CopySchema = z.object({
  fromClassId: z.string().min(1),
  toClassId: z.string().min(1),
  onlyPlanned: z.boolean().optional(),
  /** Specific lessons to copy. Empty or absent means all of them. */
  lessonIds: z.array(z.string().min(1)).max(300).optional(),
})

/** One candidate lesson, for the picker. */
export interface CopyCandidate {
  id: string
  title: string
  date: string | null
  status: 'PLANNED' | 'TAUGHT'
  topics: string[]
  /** Already present in the target class, so copying it would be a duplicate. */
  alreadyThere: boolean
}

/**
 * The lessons another class could give this one, and which of them this class
 * already has.
 *
 * Read access on the SOURCE is deliberately not required: the archive is open
 * to every servant (lessons are teaching material, not student data), and it is
 * write access on the *target* that decides whether anything may be copied.
 */
export async function listCopyCandidates(
  fromClassId: string,
  toClassId: string,
): Promise<ActionResult<{ sourceName: string; lessons: CopyCandidate[] }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    if (fromClassId === toClassId) throw new PortalError('Pick a different class to copy from.')
    const target = await assertClassAction(user, toClassId, TEACHING_WRITE)
    const source = await prisma.schoolClass.findUnique({ where: { id: fromClassId }, select: { id: true, name: true } })
    if (!source) throw new PortalError('That class does not exist.')

    const [lessons, existing] = await Promise.all([
      prisma.lesson.findMany({
        where: { classId: source.id },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        take: 300,
        select: { id: true, title: true, date: true, status: true, topics: true },
      }),
      prisma.lesson.findMany({ where: { classId: target.id }, select: { title: true, date: true } }),
    ])
    const seen = new Set(existing.map((l) => `${l.title}|${l.date?.toISOString() ?? ''}`))

    return {
      sourceName: source.name,
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        date: l.date ? formatDateOnly(l.date) : null,
        status: l.status as 'PLANNED' | 'TAUGHT',
        topics: l.topics,
        alreadyThere: seen.has(`${l.title}|${l.date?.toISOString() ?? ''}`),
      })),
    }
  })
}

/**
 * Copy — never move. The prototype reassigned the source rows, which emptied
 * the class being copied from (ANALYSIS §6); here the source is only read, and
 * the new rows start life as PLANNED and unassigned in the target class.
 */
export async function copyLessonsFromClass(
  raw: z.infer<typeof CopySchema>,
): Promise<ActionResult<{ copied: number }>> {
  return runAction(async () => {
    const user = await requirePortalUser()
    const input = CopySchema.parse(raw)
    if (input.fromClassId === input.toClassId) throw new PortalError('Pick a different class to copy from.')

    // Write access on the TARGET is the check that matters — that is what
    // decides whether anything may be created. The source only has to exist:
    // the lesson archive is open to every servant, so demanding class.read on
    // it would refuse exactly the servant this feature is for.
    const target = await assertClassAction(user, input.toClassId, TEACHING_WRITE)
    const source = await prisma.schoolClass.findUnique({
      where: { id: input.fromClassId },
      select: { id: true, name: true },
    })
    if (!source) throw new PortalError('That class does not exist.')

    const picked = input.lessonIds ?? []
    const lessons = await prisma.lesson.findMany({
      where: {
        classId: source.id,
        ...(picked.length > 0 ? { id: { in: picked } } : {}),
        ...(input.onlyPlanned ? { status: 'PLANNED' as const } : {}),
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: 300,
      select: { title: true, date: true, topics: true, notes: true, links: true },
    })
    if (lessons.length === 0) throw new PortalError(`${source.name} has no lessons to copy.`)

    const existing = await prisma.lesson.findMany({
      where: { classId: target.id },
      select: { title: true, date: true },
    })
    const seen = new Set(existing.map((l) => `${l.title}|${l.date?.toISOString() ?? ''}`))
    const fresh = lessons.filter((l) => !seen.has(`${l.title}|${l.date?.toISOString() ?? ''}`))
    if (fresh.length === 0) throw new PortalError(`${target.name} already has every lesson from ${source.name}.`)

    await prisma.lesson.createMany({
      data: fresh.map((l) => ({
        classId: target.id,
        title: l.title,
        date: l.date,
        topics: l.topics,
        notes: l.notes,
        links: l.links ?? undefined,
        status: 'PLANNED' as const,
        assignedToId: null,
        createdById: user.accountId,
      })),
    })

    await audit(
      user,
      'lesson.copy',
      'class',
      target.id,
      `Copied ${fresh.length} lesson${fresh.length === 1 ? '' : 's'} from ${source.name} into ${target.name}`,
    )
    revalidatePath('/portal/lessons')
    return { copied: fresh.length }
  })
}
