import { prisma } from '@/lib/prisma'
import { addDays, formatDateOnly, mondayOf, todayInNewYork, toUTCDate } from '../dates'
import {
  AGENDA_ACTIVITIES,
  agendaActivityLabel,
  agendaActivityOrder,
  agendaToCsvRows,
  buildWeekGrid,
  normaliseWeekStart,
  weekLabel,
  agendaWeekName,
  type AgendaGrid,
  type Assignment,
  type AgendaWeekDraft,
} from '../agenda'
import { toCsv } from '../csv'

/* ── Servants available for assignment ────────────────────────────────────── */

export interface ServantOption {
  id: string
  name: string
}

/** The servants on one class, for the assignment dropdowns. */
export async function classServants(classId: string): Promise<ServantOption[]> {
  const rows = await prisma.classServant.findMany({
    where: { classId },
    orderBy: [{ sortOrder: 'asc' }],
    select: { servant: { select: { id: true, account: { select: { displayName: true, isActive: true } } } } },
  })
  return rows
    .filter((r) => r.servant.account.isActive)
    .map((r) => ({ id: r.servant.id, name: r.servant.account.displayName }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Servants offered in the agenda's assignment dropdowns, split the way the
 * prototype's optgroups were: this class's own team first, then everyone else.
 * Borrowing a servant from another class is ordinary on a Sunday, and the port
 * offered no way to record it — the option simply never appeared.
 */
export interface AgendaServantOptions {
  onClass: ServantOption[]
  others: ServantOption[]
}

export async function agendaServantOptions(classId: string): Promise<AgendaServantOptions> {
  const [assigned, all] = await Promise.all([
    prisma.classServant.findMany({ where: { classId }, select: { servantId: true } }),
    prisma.servant.findMany({ select: { id: true, account: { select: { displayName: true, isActive: true } } } }),
  ])
  const onClassIds = new Set(assigned.map((r) => r.servantId))
  const active = all
    .filter((s) => s.account.isActive)
    .map((s) => ({ id: s.id, name: s.account.displayName }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    onClass: active.filter((s) => onClassIds.has(s.id)),
    others: active.filter((s) => !onClassIds.has(s.id)),
  }
}

/* ── One week ─────────────────────────────────────────────────────────────── */

export interface AgendaWeekView {
  id: string | null
  classId: string
  weekStart: string
  label: string
  slideLink: string | null
  notes: string | null
  leadServantId: string | null
  leadServantName: string | null
  backupServantId: string | null
  backupServantName: string | null
  grid: AgendaGrid
  updatedAt: string | null
}

const weekSelect = {
  id: true,
  classId: true,
  weekStart: true,
  slideLink: true,
  notes: true,
  updatedAt: true,
  leadServantId: true,
  leadServant: { select: { account: { select: { displayName: true } } } },
  backupServantId: true,
  backupServant: { select: { account: { select: { displayName: true } } } },
  items: {
    select: {
      activityKey: true,
      topic: true,
      servantId: true,
      servant: { select: { account: { select: { displayName: true } } } },
    },
  },
} as const

/** The stored week, or an empty one ready to be filled in. Never null. */
export async function loadAgendaWeek(classId: string, weekStart: string): Promise<AgendaWeekView> {
  const monday = normaliseWeekStart(weekStart) ?? mondayOf(todayInNewYork())
  const week = await prisma.agendaWeek.findUnique({
    where: { classId_weekStart: { classId, weekStart: toUTCDate(monday) } },
    select: weekSelect,
  })

  if (!week) {
    return {
      id: null,
      classId,
      weekStart: monday,
      label: weekLabel(monday),
      slideLink: null,
      notes: null,
      leadServantId: null,
      leadServantName: null,
      backupServantId: null,
      backupServantName: null,
      grid: buildWeekGrid(monday, []),
      updatedAt: null,
    }
  }

  return {
    id: week.id,
    classId: week.classId,
    weekStart: monday,
    label: weekLabel(monday),
    slideLink: week.slideLink,
    notes: week.notes,
    leadServantId: week.leadServantId,
    leadServantName: week.leadServant?.account.displayName ?? null,
    backupServantId: week.backupServantId,
    backupServantName: week.backupServant?.account.displayName ?? null,
    grid: buildWeekGrid(
      monday,
      week.items.map((i) => ({
        activityKey: i.activityKey,
        topic: i.topic,
        servantId: i.servantId,
        servantName: i.servant?.account.displayName ?? null,
      })),
    ),
    updatedAt: week.updatedAt.toISOString(),
  }
}

/* ── Archive timeline ─────────────────────────────────────────────────────── */

export interface AgendaWeekSummary {
  weekStart: string
  label: string
  /** "2nd Week of SEP" — how the church names it — or null outside this year. */
  ordinal: string | null
  filledCount: number
  leadServantName: string | null
  backupServantName: string | null
  hasSlides: boolean
  /**
   * F0262 — the URL itself, not just `hasSlides`. The archive knew a week had
   * slides and threw the link away, so reaching them meant opening the week: the
   * prototype put "Open Slides" straight on the archive row, which is where a
   * servant looking for last month's deck actually is.
   */
  slideLink: string | null
  /**
   * F0256 — the topics themselves, not only inside the search blob. A hit used
   * to say "2nd Week of SEP · 6 filled" and nothing about what was in it, so a
   * servant searching "St. Moses" was told a week matched and had to open it to
   * find out where. Capped at three: the strip is one line on a phone.
   */
  topics: string[]
  /**
   * Everything this week can be searched by, lowercased: the prototype's
   * "Search lessons, saints, verses…" ran over the saved topics, not the
   * dates (OG L8614).
   */
  searchText: string
}

/** Past and future weeks the class has saved, newest first. */
export async function listAgendaWeeks(classId: string, take = 60): Promise<AgendaWeekSummary[]> {
  const weeks = await prisma.agendaWeek.findMany({
    where: { classId },
    orderBy: { weekStart: 'desc' },
    take,
    select: {
      weekStart: true,
      slideLink: true,
      leadServant: { select: { account: { select: { displayName: true } } } },
      backupServant: { select: { account: { select: { displayName: true } } } },
      items: { select: { topic: true, servantId: true } },
    },
  })
  const today = todayInNewYork()
  return weeks.map((w) => {
    const weekStart = formatDateOnly(w.weekStart)
    const ordinal = agendaWeekName(weekStart, today)
    const topics = w.items.map((i) => (i.topic ?? '').trim()).filter(Boolean)
    return {
      weekStart,
      label: weekLabel(weekStart),
      ordinal,
      filledCount: w.items.filter((i) => (i.topic ?? '').trim() !== '' || i.servantId).length,
      leadServantName: w.leadServant?.account.displayName ?? null,
      backupServantName: w.backupServant?.account.displayName ?? null,
      hasSlides: !!w.slideLink,
      slideLink: w.slideLink,
      topics,
      searchText: [
        ...topics,
        ordinal ?? '',
        weekLabel(weekStart),
        w.leadServant?.account.displayName ?? '',
        w.backupServant?.account.displayName ?? '',
      ]
        .join(' ')
        .toLowerCase(),
    }
  })
}

/* ── CSV export ───────────────────────────────────────────────────────────── */

/** Every saved week of a class as the CSV the importer round-trips. */
export async function agendaCsvForClass(classId: string): Promise<string> {
  const weeks = await prisma.agendaWeek.findMany({
    where: { classId },
    orderBy: { weekStart: 'asc' },
    select: weekSelect,
  })
  const drafts: AgendaWeekDraft[] = weeks.map((w) => {
    const monday = formatDateOnly(w.weekStart)
    return {
      weekStart: monday,
      slideLink: w.slideLink,
      notes: w.notes,
      leadServantName: w.leadServant?.account.displayName ?? null,
      backupServantName: w.backupServant?.account.displayName ?? null,
      items: buildWeekGrid(
        monday,
        w.items.map((i) => ({
          activityKey: i.activityKey,
          topic: i.topic,
          servantName: i.servant?.account.displayName ?? null,
        })),
      ).rows.map((r) => ({ activityKey: r.key, topic: r.topic, servantName: r.servantName })),
    }
  })
  return toCsv(agendaToCsvRows(drafts))
}

/* ── My Assignments ───────────────────────────────────────────────────────── */

/**
 * Everything one servant is down for: agenda activities, lead/backup duty and
 * lessons. Bounded to a window around today so the page cannot grow unbounded.
 */
export async function assignmentsForServant(
  servantId: string,
  todayKey = todayInNewYork(),
  weeksBack = 8,
): Promise<Assignment[]> {
  const from = toUTCDate(addDays(mondayOf(todayKey), -7 * weeksBack))
  const fromLessonDate = toUTCDate(addDays(todayKey, -7 * weeksBack))

  const [items, ledWeeks, lessons] = await Promise.all([
    prisma.agendaItem.findMany({
      where: { servantId, week: { weekStart: { gte: from } } },
      select: {
        id: true,
        activityKey: true,
        topic: true,
        week: { select: { weekStart: true, classId: true, class: { select: { name: true } } } },
      },
    }),
    prisma.agendaWeek.findMany({
      where: {
        weekStart: { gte: from },
        OR: [{ leadServantId: servantId }, { backupServantId: servantId }],
      },
      select: {
        id: true,
        weekStart: true,
        classId: true,
        leadServantId: true,
        backupServantId: true,
        notes: true,
        class: { select: { name: true } },
      },
    }),
    prisma.lesson.findMany({
      where: { assignedToId: servantId, OR: [{ date: null }, { date: { gte: fromLessonDate } }] },
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        classId: true,
        class: { select: { name: true } },
      },
    }),
  ])

  const out: Assignment[] = []

  for (const i of items) {
    const monday = formatDateOnly(i.week.weekStart)
    out.push({
      id: `item-${i.id}`,
      kind: 'agenda',
      weekStart: monday,
      classId: i.week.classId,
      className: i.week.class.name,
      title: agendaActivityLabel(i.activityKey),
      detail: i.topic,
      date: null,
      href: `/portal/agenda?class=${encodeURIComponent(i.week.classId)}&week=${monday}`,
      sortHint: agendaActivityOrder(i.activityKey),
    })
  }

  for (const w of ledWeeks) {
    const monday = formatDateOnly(w.weekStart)
    const href = `/portal/agenda?class=${encodeURIComponent(w.classId)}&week=${monday}`
    if (w.leadServantId === servantId) {
      out.push({
        id: `lead-${w.id}`,
        kind: 'lead',
        weekStart: monday,
        classId: w.classId,
        className: w.class.name,
        title: 'Lead servant',
        detail: w.notes,
        date: null,
        href,
      })
    }
    if (w.backupServantId === servantId) {
      out.push({
        id: `backup-${w.id}`,
        kind: 'backup',
        weekStart: monday,
        classId: w.classId,
        className: w.class.name,
        title: 'Backup servant',
        detail: null,
        date: null,
        href,
      })
    }
  }

  for (const l of lessons) {
    const day = l.date ? formatDateOnly(l.date) : null
    out.push({
      id: `lesson-${l.id}`,
      kind: 'lesson',
      weekStart: day ? mondayOf(day) : null,
      classId: l.classId,
      className: l.class.name,
      title: l.title,
      detail: l.status === 'TAUGHT' ? 'Taught' : 'Lesson to prepare',
      date: day,
      href: `/portal/lessons?class=${encodeURIComponent(l.classId)}`,
    })
  }

  return out
}

/** The servant's own agenda rows for one week — used by the dashboard widget. */
export async function weekAssignmentsForServant(
  servantId: string,
  weekStart: string,
): Promise<Assignment[]> {
  const all = await assignmentsForServant(servantId, weekStart, 0)
  const monday = normaliseWeekStart(weekStart)
  return all.filter((a) => a.weekStart === monday)
}

export const AGENDA_ACTIVITY_COUNT = AGENDA_ACTIVITIES.length
