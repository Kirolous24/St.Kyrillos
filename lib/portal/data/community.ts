import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { PortalUser, StageKey } from '../permissions'
import { PortalError } from '../action-result'
import { addDays, formatDateOnly, toUTCDate } from '../dates'
import {
  evaluateAchievements,
  mergePersistedBadges,
  presentStreak,
  readingStreak,
  type AchievementResult,
  type AchievementStats,
} from '../achievements'
import { readingMonthDays, readingMonthLabel } from '../readings'
import { listVisibleClasses } from './classes'
import { studentName } from './students'

/* ── Scope helpers ────────────────────────────────────────────────────────── */

export interface CommunityScope {
  /** Classes the user may read, in sidebar order. */
  classes: Array<{ id: string; name: string; stage: StageKey }>
  classIds: string[]
  stages: StageKey[]
  /** Admins and pastors see everything, targeted or not. */
  seesEverything: boolean
}

export async function communityScope(user: PortalUser): Promise<CommunityScope> {
  const classes = await listVisibleClasses(user)
  const stages = Array.from(new Set(classes.map((c) => c.stage)))
  if (user.stageOversight && !stages.includes(user.stageOversight)) stages.push(user.stageOversight)
  return {
    classes: classes.map((c) => ({ id: c.id, name: c.name, stage: c.stage })),
    classIds: classes.map((c) => c.id),
    stages,
    seesEverything: user.role === 'ADMIN' || user.role === 'PASTOR',
  }
}

/** Admins and pastors may target any class or the whole school; servants only their own. */
export function canTargetClasses(user: PortalUser, classIds: string[], targetAll: boolean): boolean {
  if (user.role === 'ADMIN' || user.role === 'PASTOR') return true
  if (user.role !== 'SERVANT') return false
  if (targetAll) return false
  return classIds.length > 0 && classIds.every((id) => user.classIds.includes(id))
}

export function assertCanTarget(user: PortalUser, classIds: string[], targetAll: boolean): void {
  if (!canTargetClasses(user, classIds, targetAll)) {
    throw new PortalError(
      user.role === 'SERVANT'
        ? 'You can only do this for your own classes.'
        : 'You do not have permission to do that.',
    )
  }
}

/**
 * F0313 — the same rule, widened by one step for a servant who oversees a stage.
 *
 * An event is already visible to everybody whichever classes it names, so the
 * class list on an event is a label rather than a gate: letting a stage
 * coordinator put her own stage's classes on it gives her the reach her role
 * implies and changes nothing about who can see what. Editing still belongs to
 * whoever created the event, and "the whole Sunday School" still speaks for the
 * church, so it stays with the admin and Fr. Pachom.
 *
 * Async because the stage a class belongs to is not on PortalUser; only the ids
 * the caller actually named are looked up.
 */
export async function assertCanTargetIncludingStage(
  user: PortalUser,
  classIds: string[],
  targetAll: boolean,
): Promise<void> {
  if (canTargetClasses(user, classIds, targetAll)) return
  if (user.role === 'SERVANT' && user.stageOversight && !targetAll && classIds.length > 0) {
    const inStage = await prisma.schoolClass.findMany({
      where: { id: { in: classIds }, stage: user.stageOversight },
      select: { id: true },
    })
    const allowed = new Set([...user.classIds, ...inStage.map((c) => c.id)])
    if (classIds.every((id) => allowed.has(id))) return
  }
  assertCanTarget(user, classIds, targetAll)
}

/* ── Shared input helpers ─────────────────────────────────────────────────── */

/**
 * Links are rendered as hrefs, so only http(s) may be stored — this is what
 * keeps a `javascript:` URL out of a post or an event.
 */
export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Links must start with http:// or https://')

/** Optional URL field: empty string means "clear it". */
export const optionalHttpUrl = z
  .union([httpUrl, z.literal('')])
  .optional()
  .transform((v) => (v ? v : null))

/* ── Events ───────────────────────────────────────────────────────────────── */

export interface EventView {
  id: string
  title: string
  date: string
  time: string | null
  location: string | null
  link: string | null
  notes: string | null
  targetAll: boolean
  classIds: string[]
  classNames: string[]
  createdByName: string
  /**
   * F0315 — the poster's photo. The card drew their initials in a grey circle
   * while the account's photo sat one join away: on a church-wide feed the
   * face is how a servant recognises who put the trip up, and initials of two
   * people who share them say nothing at all.
   */
  createdByPhoto: string | null
  /**
   * F0657 — the classes the poster serves. "Posted by Marina" says who; "Posted
   * by Marina · Grade 3" says why they are the one telling you, which on a
   * church-wide feed is most of what a parent or another servant wants to know.
   * Capped at two names so one servant on five classes cannot take the row over.
   */
  createdByClasses: string[]
  canManage: boolean
}

const EVENT_SELECT = {
  id: true,
  title: true,
  date: true,
  time: true,
  location: true,
  link: true,
  notes: true,
  targetAll: true,
  classes: { select: { classId: true, class: { select: { name: true } } } },
  createdBy: {
    select: {
      displayName: true,
      photo: true,
      servant: { select: { classes: { select: { class: { select: { name: true, sortOrder: true } } } } } },
    },
  },
} as const

type EventRow = {
  id: string
  title: string
  date: Date
  time: string | null
  location: string | null
  link: string | null
  notes: string | null
  targetAll: boolean
  classes: Array<{ classId: string; class: { name: string } }>
  createdBy: {
    displayName: string
    photo: string | null
    servant: { classes: Array<{ class: { name: string; sortOrder: number } }> } | null
  } | null
}

function toEventView(row: EventRow, user: PortalUser): EventView {
  const classIds = row.classes.map((c) => c.classId)
  return {
    id: row.id,
    title: row.title,
    date: formatDateOnly(row.date),
    time: row.time,
    location: row.location,
    link: row.link,
    notes: row.notes,
    targetAll: row.targetAll,
    classIds,
    classNames: row.classes.map((c) => c.class.name),
    createdByName: row.createdBy?.displayName ?? 'Sunday School',
    createdByPhoto: row.createdBy?.photo ?? null,
    createdByClasses: (row.createdBy?.servant?.classes ?? [])
      .slice()
      .sort((a, b) => a.class.sortOrder - b.class.sortOrder)
      .map((c) => c.class.name),
    canManage: canTargetClasses(user, classIds, row.targetAll),
  }
}

/**
 * Every event, for every role.
 *
 * The prototype showed the whole Sunday School calendar to everyone; the port
 * filtered it to the viewer's own classes, so a servant or child had no way to
 * know another class was meeting — and the church confirmed they want the open
 * calendar back. Targeting still decides who an event is *for*, and so who may
 * edit it (see mayModifyEvent and canTargetClasses); it no longer decides who
 * may see that it exists.
 */
export async function listEvents(user: PortalUser, today: string) {
  const scope = await communityScope(user)
  const targeted = {}

  const [upcoming, past] = await Promise.all([
    prisma.portalEvent.findMany({
      where: { ...targeted, date: { gte: toUTCDate(today) } },
      orderBy: [{ date: 'asc' }, { title: 'asc' }],
      take: 60,
      select: EVENT_SELECT,
    }),
    prisma.portalEvent.findMany({
      where: { ...targeted, date: { lt: toUTCDate(today) } },
      orderBy: { date: 'desc' },
      take: 25,
      select: EVENT_SELECT,
    }),
  ])

  return {
    scope,
    upcoming: upcoming.map((e) => toEventView(e as EventRow, user)),
    past: past.map((e) => toEventView(e as EventRow, user)),
  }
}

export async function nextEventFor(user: PortalUser, today: string): Promise<EventView | null> {
  // Same open calendar as listEvents: the dashboard's "next event" must not
  // disagree with the events page about what exists.
  const row = await prisma.portalEvent.findFirst({
    where: { date: { gte: toUTCDate(today) } },
    orderBy: [{ date: 'asc' }, { title: 'asc' }],
    select: EVENT_SELECT,
  })
  return row ? toEventView(row as EventRow, user) : null
}

/* ── Announcements ────────────────────────────────────────────────────────── */

export interface AnnouncementView {
  id: string
  title: string
  body: string
  emoji: string | null
  date: string | null
  sortOrder: number
  isActive: boolean
  classId: string | null
  className: string | null
  stage: StageKey | null
  createdByName: string
  canManage: boolean
}

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  body: true,
  emoji: true,
  date: true,
  sortOrder: true,
  isActive: true,
  classId: true,
  stage: true,
  class: { select: { name: true } },
  createdBy: { select: { displayName: true } },
} as const

type AnnouncementRow = {
  id: string
  title: string
  body: string
  emoji: string | null
  date: Date | null
  sortOrder: number
  isActive: boolean
  classId: string | null
  stage: StageKey | null
  class: { name: string } | null
  createdBy: { displayName: string } | null
}

/** Church-wide announcements belong to admins and pastors; class ones to that class's servants. */
export function canManageAnnouncement(user: PortalUser, classId: string | null): boolean {
  if (user.role === 'ADMIN' || user.role === 'PASTOR') return true
  if (user.role !== 'SERVANT') return false
  return !!classId && user.classIds.includes(classId)
}

/**
 * F0285 — the one stage a servant may speak to, if any.
 *
 * A servant who looks after a whole age group but teaches no single class could
 * not post a notice at all: every target on the form is a class, and she has
 * none. What she is given is exactly the reach her role's name implies — her own
 * stage, and nothing wider. Posting into each of a stage's dozen classes
 * individually was the other way to reach the same children, and it would be the
 * first crack in the rule the whole portal is built on: overseeing an age group
 * lets you see, not change.
 */
export function announceableStage(user: PortalUser): PortalUser['stageOversight'] {
  if (user.role !== 'SERVANT') return null
  return user.stageOversight ?? null
}

function toAnnouncementView(row: AnnouncementRow, user: PortalUser): AnnouncementView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    emoji: row.emoji,
    date: row.date ? formatDateOnly(row.date) : null,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    classId: row.classId,
    className: row.class?.name ?? null,
    stage: row.stage,
    createdByName: row.createdBy?.displayName ?? 'Sunday School',
    // F0285 — a stage coordinator manages her own stage's notices; they carry
    // no class, so the class rule alone would hide her own Edit button.
    canManage:
      canManageAnnouncement(user, row.classId) ||
      (!!row.stage && row.stage === announceableStage(user)),
  }
}

export async function listAnnouncements(user: PortalUser) {
  const scope = await communityScope(user)

  // What targets me: church-wide, my classes, or my stages.
  const targeted = {
    OR: [
      { classId: null, stage: null },
      { classId: { in: scope.classIds } },
      { stage: { in: scope.stages } },
    ],
  }
  // Managers also need to see the ones they have hidden.
  const where = scope.seesEverything
    ? {}
    : {
        OR: [
          { isActive: true, ...targeted },
          ...(user.role === 'SERVANT' && scope.classIds.length > 0
            ? [{ classId: { in: user.classIds } }]
            : []),
        ],
      }

  const rows = await prisma.announcement.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { date: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: ANNOUNCEMENT_SELECT,
  })
  return { scope, announcements: rows.map((r) => toAnnouncementView(r as AnnouncementRow, user)) }
}

/* ── Daily Coptic readings ────────────────────────────────────────────────── */

// CopticDayCache.readings / synaxarium / feasts are Json columns written by the
// public site's coptic.io client. Shapes drift, so nothing here trusts them:
// each entry is validated on its own and bad ones are dropped rather than
// taking the page down.

const ReadingRefSchema = z.object({
  section: z.string().trim().min(1),
  bookName: z.string().trim().optional(),
  reference: z.string().trim().min(1),
  // Optional: rows cached before the passage text was carried through have
  // none, and a reading without its text still renders as a reference.
  verses: z
    .array(z.object({ num: z.number().int().min(0), text: z.string().trim().min(1) }))
    .max(200)
    .optional(),
})
const SynaxariumSchema = z.object({
  name: z.string().trim().min(1),
  url: z.string().trim().optional(),
})
const FeastSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().optional(),
})

function parseList<T>(value: unknown, schema: z.ZodType<T>, limit = 60): T[] {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const item of value.slice(0, limit)) {
    const parsed = schema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export interface DailyReadings {
  date: string
  copticDate: string | null
  season: string | null
  seasonDay: string | null
  isFasting: boolean
  /** Grouped by section, in the order the cache returned them. */
  sections: Array<{
    section: string
    entries: Array<{ bookName?: string; reference: string; verses?: Array<{ num: number; text: string }> }>
  }>
  synaxarium: Array<{ name: string; url?: string }>
  feasts: Array<{ name: string; type?: string }>
  /** False when nothing is cached for the day — the page shows a friendly note. */
  available: boolean
}

/**
 * Today's readings, straight from the cache the public site fills. Never calls
 * coptic.io: a page render must not depend on a third-party API.
 */
export async function loadDailyReadings(date: string): Promise<DailyReadings> {
  const empty: DailyReadings = {
    date,
    copticDate: null,
    season: null,
    seasonDay: null,
    isFasting: false,
    sections: [],
    synaxarium: [],
    feasts: [],
    available: false,
  }

  const row = await prisma.copticDayCache.findUnique({
    where: { id: date },
    select: { copticDate: true, season: true, seasonDay: true, isFasting: true, readings: true, synaxarium: true, feasts: true },
  })
  if (!row) return empty

  const refs = parseList(row.readings, ReadingRefSchema, 80)
  const sections: DailyReadings['sections'] = []
  for (const ref of refs) {
    const bucket = sections.find((s) => s.section === ref.section)
    const entry = { bookName: ref.bookName, reference: ref.reference, verses: ref.verses }
    if (bucket) bucket.entries.push(entry)
    else sections.push({ section: ref.section, entries: [entry] })
  }

  const synaxarium = parseList(row.synaxarium, SynaxariumSchema, 30)
  const feasts = parseList(row.feasts, FeastSchema, 30)

  return {
    date,
    copticDate: row.copticDate,
    season: row.season,
    seasonDay: row.seasonDay,
    isFasting: row.isFasting,
    sections,
    synaxarium,
    feasts,
    available: sections.length > 0 || !!row.copticDate || feasts.length > 0,
  }
}

/* ── Bible reading check-in ───────────────────────────────────────────────── */

export interface ReadingState {
  checkedInToday: boolean
  streak: number
  totalDays: number
  /**
   * F0329 / F0754 — the days of the current calendar month, 1st to last, oldest
   * first. It was a rolling 30 days ending today, so a child on the 3rd saw 27
   * squares belonging to last month. `future` marks days that have not happened
   * yet, so a month grid does not tell a child on the 2nd that they have already
   * missed 29 days.
   */
  grid: Array<{ date: string; read: boolean; future: boolean }>
  /** "September 2026", for the heading above the grid. */
  monthLabel: string
}

export async function readingStateFor(studentId: string, today: string): Promise<ReadingState> {
  const [logs, totalDays] = await Promise.all([
    prisma.bibleReadingLog.findMany({
      where: { studentId, date: { gte: toUTCDate(addDays(today, -400)) } },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    prisma.bibleReadingLog.count({ where: { studentId } }),
  ])
  const dates = logs.map((l) => formatDateOnly(l.date))
  const seen = new Set(dates)
  const grid: ReadingState['grid'] = readingMonthDays(today).map((d) => ({
    date: d.date,
    read: seen.has(d.date),
    future: d.future,
  }))
  return {
    checkedInToday: seen.has(today),
    streak: readingStreak(dates, today),
    totalDays,
    grid,
    monthLabel: readingMonthLabel(today),
  }
}

export interface ClassCheckIns {
  classId: string
  className: string
  total: number
  readers: Array<{ studentId: string; name: string }>
}

/** Today's check-ins for the classes a servant serves, with the roster size. */
export async function classCheckInsToday(
  classes: Array<{ id: string; name: string }>,
  today: string,
): Promise<ClassCheckIns[]> {
  if (classes.length === 0) return []
  const classIds = classes.map((c) => c.id)
  const [logs, rosters] = await Promise.all([
    prisma.bibleReadingLog.findMany({
      where: { date: toUTCDate(today), student: { classId: { in: classIds } } },
      select: { studentId: true, student: { select: { firstName: true, lastName: true, classId: true } } },
    }),
    prisma.student.groupBy({ by: ['classId'], where: { classId: { in: classIds } }, _count: { _all: true } }),
  ])
  const totals = new Map(rosters.map((r) => [r.classId, r._count._all]))
  return classes.map((c) => ({
    classId: c.id,
    className: c.name,
    total: totals.get(c.id) ?? 0,
    readers: logs
      .filter((l) => l.student.classId === c.id)
      .map((l) => ({ studentId: l.studentId, name: studentName(l.student) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

/* ── Achievements ─────────────────────────────────────────────────────────── */

export interface AchievementsPayload extends AchievementResult {
  stats: AchievementStats
  /** badgeKey → the day it was first recorded, so the date never moves. */
  awardedAt: Map<string, Date>
}

/**
 * Gather every real signal a badge depends on, evaluate, then record newly
 * earned badges. Recording is idempotent (unique on studentId+badgeKey), which
 * is what keeps "earned on" stable once a streak later lapses.
 */
export async function loadAchievements(studentId: string, today: string): Promise<AchievementsPayload> {
  const [pointSum, sundays, sundaysAttended, quizzes, bestQuiz, readingLogs, readingDays, student, existing] = await Promise.all([
    prisma.pointEntry.aggregate({ where: { studentId }, _sum: { points: true } }),
    prisma.attendanceRecord.findMany({
      where: { studentId, sessionKey: 'sunday' },
      orderBy: { date: 'desc' },
      take: 60,
      select: { date: true, status: true },
    }),
    // F0734 — distinct Sundays ever attended. Counted rather than taken from the
    // 60-row slice above, which exists for the streak and would cap this.
    prisma.attendanceRecord.count({ where: { studentId, sessionKey: 'sunday', status: 'PRESENT' } }),
    prisma.quizResult.count({ where: { studentId } }),
    prisma.quizResult.aggregate({ where: { studentId }, _max: { percentage: true } }),
    prisma.bibleReadingLog.findMany({
      where: { studentId, date: { gte: toUTCDate(addDays(today, -400)) } },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    prisma.bibleReadingLog.count({ where: { studentId } }),
    prisma.student.findUnique({ where: { id: studentId }, select: { dob: true } }),
    prisma.studentAchievement.findMany({ where: { studentId }, select: { badgeKey: true, awardedAt: true } }),
  ])

  const dobMonth = student?.dob ? formatDateOnly(student.dob).slice(5, 7) : null

  const stats: AchievementStats = {
    lifetimePoints: pointSum._sum.points ?? 0,
    attendanceStreak: presentStreak(sundays.map((s) => ({ date: formatDateOnly(s.date), status: s.status }))),
    sundaysAttended,
    quizzesCompleted: quizzes,
    bestQuizPercentage: bestQuiz._max.percentage ?? 0,
    readingStreak: readingStreak(readingLogs.map((l) => formatDateOnly(l.date)), today),
    readingDays,
    isBirthdayMonth: !!dobMonth && dobMonth === today.slice(5, 7),
  }

  // What today's signals qualify for…
  const live = evaluateAchievements(stats)
  const awardedAt = new Map(existing.map((e) => [e.badgeKey, e.awardedAt]))
  const fresh = live.earned.filter((e) => !awardedAt.has(e.badge.key))
  if (fresh.length > 0) {
    await prisma.studentAchievement.createMany({
      data: fresh.map((e) => ({ studentId, badgeKey: e.badge.key })),
      skipDuplicates: true,
    })
    const now = new Date()
    for (const e of fresh) awardedAt.set(e.badge.key, now)
  }

  // …then fold the whole StudentAchievement history back in, so a badge earned
  // off a streak or a birthday month is not taken away once it lapses.
  const result = mergePersistedBadges(live, awardedAt.keys())

  return { ...result, stats, awardedAt }
}
