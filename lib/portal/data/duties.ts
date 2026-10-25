import { prisma } from '@/lib/prisma'
import { agendaActivityLabel, sundayOfWeek } from '../agenda'
import { dutyHref, type Duty } from '../assignment-notices'
import { addDays, dayOfWeek, formatDateOnly, toUTCDate } from '../dates'

/**
 * Who holds which part of a Sunday (2026-10-19), as Duty snapshots for
 * lib/portal/assignment-notices.ts. Read before and after every save that can
 * change an assignment, and for the evening-before reminder.
 */

const WEEK_SELECT = {
  weekStart: true,
  classId: true,
  leadServantId: true,
  backupServantId: true,
  class: { select: { name: true } },
  items: { orderBy: { sortOrder: 'asc' as const }, select: { activityKey: true, topic: true, servantId: true, doneAt: true } },
}

const LESSON_SELECT = { id: true, title: true, date: true, assignedToId: true, classId: true, class: { select: { name: true } } }

function weekToDuties(w: {
  weekStart: Date
  classId: string
  leadServantId: string | null
  backupServantId: string | null
  class: { name: string }
  items: Array<{ activityKey: string; topic: string | null; servantId: string | null; doneAt: Date | null }>
}): Duty[] {
  const monday = formatDateOnly(w.weekStart)
  const due = sundayOfWeek(monday)
  const base = { className: w.class.name, classId: w.classId, due, href: dutyHref(due) }
  const out: Duty[] = []
  for (const i of w.items) {
    if (!i.servantId) continue
    out.push({ ...base, slot: `item:${w.classId}:${monday}:${i.activityKey}`, kind: 'activity', servantId: i.servantId, label: agendaActivityLabel(i.activityKey), topic: i.topic, done: !!i.doneAt })
  }
  if (w.leadServantId) out.push({ ...base, slot: `lead:${w.classId}:${monday}`, kind: 'lead', servantId: w.leadServantId, label: 'Lead', topic: null, done: false })
  if (w.backupServantId) out.push({ ...base, slot: `backup:${w.classId}:${monday}`, kind: 'backup', servantId: w.backupServantId, label: 'Backup', topic: null, done: false })
  return out
}

function lessonToDuties(l: { id: string; title: string; date: Date | null; assignedToId: string | null; classId: string; class: { name: string } }): Duty[] {
  if (!l.assignedToId) return []
  const due = l.date ? formatDateOnly(l.date) : null
  return [{ slot: `lesson:${l.id}`, kind: 'lesson', servantId: l.assignedToId, label: `Lesson “${l.title}”`, topic: null, className: l.class.name, classId: l.classId, due, href: dutyHref(due), done: false }]
}

/** The held parts of these weeks of one class (Monday keys). */
export async function weekDuties(classId: string, mondays: readonly string[]): Promise<Duty[]> {
  if (mondays.length === 0) return []
  const weeks = await prisma.agendaWeek.findMany({
    where: { classId, weekStart: { in: mondays.map((m) => toUTCDate(m)) } },
    select: WEEK_SELECT,
  })
  return weeks.flatMap(weekToDuties)
}

/** These lessons, for whoever is teaching them. */
export async function lessonDuties(lessonIds: readonly string[]): Promise<Duty[]> {
  if (lessonIds.length === 0) return []
  const lessons = await prisma.lesson.findMany({ where: { id: { in: [...lessonIds] } }, select: LESSON_SELECT })
  return lessons.flatMap(lessonToDuties)
}

/**
 * Everything due on one day, in every active class: on a Sunday, that week's
 * Schedule; on any day, the lessons dated then.
 */
export async function dutiesDueOn(date: string): Promise<Duty[]> {
  const [weeks, lessons] = await Promise.all([
    dayOfWeek(date) === 0
      ? prisma.agendaWeek.findMany({ where: { weekStart: toUTCDate(addDays(date, -6)), class: { isActive: true } }, select: WEEK_SELECT })
      : Promise.resolve([]),
    prisma.lesson.findMany({
      where: { date: toUTCDate(date), assignedToId: { not: null }, class: { isActive: true } },
      select: LESSON_SELECT,
    }),
  ])
  return [...weeks.flatMap(weekToDuties), ...lessons.flatMap(lessonToDuties)]
}
