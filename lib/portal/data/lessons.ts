import { prisma } from '@/lib/prisma'
import { formatDateOnly, todayInNewYork, toUTCDate } from '../dates'
import { parseLessonLinks, type LessonLink } from '../agenda'

export interface LessonView {
  id: string
  classId: string
  className: string
  title: string
  date: string | null
  topics: string[]
  notes: string | null
  links: LessonLink[]
  status: 'PLANNED' | 'TAUGHT'
  assignedToId: string | null
  assignedToName: string | null
  createdByName: string | null
}

const lessonSelect = {
  id: true,
  classId: true,
  title: true,
  date: true,
  topics: true,
  notes: true,
  links: true,
  status: true,
  assignedToId: true,
  class: { select: { name: true } },
  assignedTo: { select: { account: { select: { displayName: true } } } },
  createdBy: { select: { displayName: true } },
} as const

type LessonRow = {
  id: string
  classId: string
  title: string
  date: Date | null
  topics: string[]
  notes: string | null
  links: unknown
  status: 'PLANNED' | 'TAUGHT'
  assignedToId: string | null
  class: { name: string }
  assignedTo: { account: { displayName: string } } | null
  createdBy: { displayName: string } | null
}

function toView(l: LessonRow): LessonView {
  return {
    id: l.id,
    classId: l.classId,
    className: l.class.name,
    title: l.title,
    date: l.date ? formatDateOnly(l.date) : null,
    topics: l.topics,
    notes: l.notes,
    links: parseLessonLinks(l.links),
    status: l.status,
    assignedToId: l.assignedToId,
    assignedToName: l.assignedTo?.account.displayName ?? null,
    createdByName: l.createdBy?.displayName ?? null,
  }
}

/**
 * One class's lessons split the way servants think about them: what is still
 * to come, and what has already been taught. Undated lessons lead the planned
 * list so they are not forgotten.
 */
export async function listClassLessons(classId: string): Promise<{
  planned: LessonView[]
  taught: LessonView[]
}> {
  const lessons = await prisma.lesson.findMany({
    where: { classId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    take: 500,
    select: lessonSelect,
  })
  const views = lessons.map(toView)
  return {
    planned: views.filter((l) => l.status === 'PLANNED'),
    taught: views.filter((l) => l.status === 'TAUGHT').reverse(),
  }
}

/** Read-only archive across several classes (pastor and admin). */
export async function listLessonArchive(classIds: string[], take = 200): Promise<LessonView[]> {
  if (classIds.length === 0) return []
  const lessons = await prisma.lesson.findMany({
    where: { classId: { in: classIds } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take,
    select: lessonSelect,
  })
  return lessons.map(toView)
}

/** A single lesson with its class, for permission checks in server actions. */
export async function loadLessonForAction(id: string) {
  return prisma.lesson.findUnique({
    where: { id },
    select: { id: true, classId: true, title: true, status: true },
  })
}

/**
 * The next lesson still to be taught — the servant's own where they have one,
 * otherwise the class's. Undated lessons never win over a dated one.
 */
export async function nextPlannedLesson(
  classIds: string[],
  servantId?: string,
  todayKey = todayInNewYork(),
): Promise<LessonView | null> {
  if (classIds.length === 0) return null
  const common = {
    status: 'PLANNED' as const,
    classId: { in: classIds },
    date: { gte: toUTCDate(todayKey) },
  }
  if (servantId) {
    const mine = await prisma.lesson.findFirst({
      where: { ...common, assignedToId: servantId },
      orderBy: { date: 'asc' },
      select: lessonSelect,
    })
    if (mine) return toView(mine)
  }
  const next = await prisma.lesson.findFirst({
    where: common,
    orderBy: { date: 'asc' },
    select: lessonSelect,
  })
  return next ? toView(next) : null
}

/** Counts for the lessons page header. */
export async function lessonCounts(classId: string): Promise<{ planned: number; taught: number }> {
  const [planned, taught] = await Promise.all([
    prisma.lesson.count({ where: { classId, status: 'PLANNED' } }),
    prisma.lesson.count({ where: { classId, status: 'TAUGHT' } }),
  ])
  return { planned, taught }
}
