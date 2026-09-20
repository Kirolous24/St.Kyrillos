// "Schedule of the Year" — the pure rules behind the weekly agenda, lesson
// preparation and the assignment digest. No DB, no React: everything here is
// unit-tested in tests/portal/agenda.test.ts.

import type { Action } from './permissions'
import { addDays, mondayOf, parseDateOnly } from './dates'
import { formatLongDate, formatMonthDay } from './format'

/**
 * Teaching plans (lessons, agenda weeks) are written by the servants assigned
 * to the class and by admins — exactly the rule attendance already uses.
 * Pastors read the archive but never write it, which is why this is not
 * 'followup.write' (pastors hold that one).
 */
export const TEACHING_WRITE: Action = 'attendance.write'

/* ── The ten fixed activities ─────────────────────────────────────────────── */

export type AgendaActivityKey =
  | 'agpeya'
  | 'song'
  | 'seasons'
  | 'lesson'
  | 'bibleStudy'
  | 'coptic'
  | 'ritual'
  | 'verse'
  | 'memorization'
  | 'saint'

export interface AgendaActivity {
  key: AgendaActivityKey
  label: string
  order: number
}

/** Order is the running order of a Sunday School hour; it drives every view. */
export const AGENDA_ACTIVITIES: readonly AgendaActivity[] = [
  { key: 'agpeya', label: 'Agpeya', order: 0 },
  { key: 'song', label: 'Song', order: 1 },
  { key: 'seasons', label: 'Seasons', order: 2 },
  { key: 'lesson', label: 'Lesson', order: 3 },
  { key: 'bibleStudy', label: 'Bible Study', order: 4 },
  { key: 'coptic', label: 'Coptic', order: 5 },
  { key: 'ritual', label: 'Ritual', order: 6 },
  { key: 'verse', label: 'Verse', order: 7 },
  { key: 'memorization', label: 'Memorization', order: 8 },
  { key: 'saint', label: 'Saint of the Week', order: 9 },
]

const BY_KEY = new Map<string, AgendaActivity>(AGENDA_ACTIVITIES.map((a) => [a.key, a]))
const BY_LABEL = new Map<string, AgendaActivity>(
  AGENDA_ACTIVITIES.map((a) => [a.label.toLowerCase(), a]),
)

export function isAgendaActivityKey(key: string): key is AgendaActivityKey {
  return BY_KEY.has(key)
}

export function agendaActivityLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key
}

export function agendaActivityOrder(key: string): number {
  return BY_KEY.get(key)?.order ?? AGENDA_ACTIVITIES.length
}

/** Accepts a key ("bibleStudy") or a display label ("Bible Study"); null otherwise. */
export function resolveActivityKey(raw: string | null | undefined): AgendaActivityKey | null {
  if (!raw) return null
  const value = raw.trim()
  if (isAgendaActivityKey(value)) return value
  return BY_LABEL.get(value.toLowerCase())?.key ?? null
}

/* ── Week keys and labels ─────────────────────────────────────────────────── */

/** Any date string → the Monday of its week, or null when unparseable. */
export function normaliseWeekStart(raw: string | null | undefined): string | null {
  const day = parseDateOnly(raw)
  return day ? mondayOf(day) : null
}

/** "Sep 14 – Sep 20, 2026" for the week starting on the given Monday. */
export function weekLabel(mondayKey: string): string {
  const monday = normaliseWeekStart(mondayKey)
  if (!monday) return 'Unknown week'
  return `${formatMonthDay(monday)} – ${formatLongDate(addDays(monday, 6))}`
}

/** "This week" / "Next week" / "2 weeks ago" relative to today's Monday. */
export function weekDistanceLabel(mondayKey: string, todayKey: string): string {
  const monday = normaliseWeekStart(mondayKey)
  const thisMonday = normaliseWeekStart(todayKey)
  if (!monday || !thisMonday) return ''
  const weeks = Math.round(
    (Date.parse(`${monday}T00:00:00.000Z`) - Date.parse(`${thisMonday}T00:00:00.000Z`)) /
      (7 * 86_400_000),
  )
  if (weeks === 0) return 'This week'
  if (weeks === 1) return 'Next week'
  if (weeks === -1) return 'Last week'
  return weeks > 0 ? `In ${weeks} weeks` : `${Math.abs(weeks)} weeks ago`
}

/* ── The week grid ────────────────────────────────────────────────────────── */

export interface AgendaItemInput {
  activityKey: string
  topic?: string | null
  servantId?: string | null
  servantName?: string | null
}

export interface AgendaGridRow extends AgendaActivity {
  topic: string | null
  servantId: string | null
  servantName: string | null
}

export interface AgendaGrid {
  weekStart: string
  label: string
  rows: AgendaGridRow[]
}

function blank(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Always ten rows in running order. Stored rows fill in; anything missing (a
 * week saved before an activity existed, or a partially filled week) comes back
 * blank rather than absent, so the editor and the print-out never shift.
 * Unknown keys are ignored; the first row for a key wins.
 */
export function buildWeekGrid(weekStart: string, items: readonly AgendaItemInput[]): AgendaGrid {
  const monday = normaliseWeekStart(weekStart) ?? weekStart
  const seen = new Map<string, AgendaItemInput>()
  for (const item of items) {
    const key = resolveActivityKey(item.activityKey)
    if (key && !seen.has(key)) seen.set(key, item)
  }
  return {
    weekStart: monday,
    label: weekLabel(monday),
    rows: AGENDA_ACTIVITIES.map((activity) => {
      const found = seen.get(activity.key)
      return {
        ...activity,
        topic: blank(found?.topic),
        servantId: blank(found?.servantId),
        servantName: blank(found?.servantName),
      }
    }),
  }
}

/** True when nothing at all has been filled in for the week. */
export function isWeekEmpty(week: {
  slideLink?: string | null
  notes?: string | null
  leadServantName?: string | null
  backupServantName?: string | null
  items: readonly { topic?: string | null; servantName?: string | null }[]
}): boolean {
  if (blank(week.slideLink) || blank(week.notes)) return false
  if (blank(week.leadServantName) || blank(week.backupServantName)) return false
  return !week.items.some((i) => blank(i.topic) || blank(i.servantName))
}

/* ── CSV round-trip ───────────────────────────────────────────────────────── */

export interface AgendaWeekDraft {
  weekStart: string
  slideLink: string | null
  notes: string | null
  leadServantName: string | null
  backupServantName: string | null
  items: Array<{ activityKey: AgendaActivityKey; topic: string | null; servantName: string | null }>
}

export const AGENDA_CSV_HEADERS = [
  'Week Start',
  'Slide Link',
  'Lead Servant',
  'Backup Servant',
  'Notes',
  'Activity Key',
  'Activity',
  'Topic',
  'Servant',
] as const

/** All ten activities, in order, with blanks normalised — the CSV's shape. */
export function normaliseWeekDraft(draft: AgendaWeekDraft): AgendaWeekDraft {
  const grid = buildWeekGrid(draft.weekStart, draft.items)
  return {
    weekStart: grid.weekStart,
    slideLink: blank(draft.slideLink),
    notes: blank(draft.notes),
    leadServantName: blank(draft.leadServantName),
    backupServantName: blank(draft.backupServantName),
    items: grid.rows.map((r) => ({ activityKey: r.key, topic: r.topic, servantName: r.servantName })),
  }
}

/**
 * One row per (week, activity) so a servant can edit the file in a spreadsheet.
 * The week-level columns repeat on each of its ten rows.
 */
export function agendaToCsvRows(weeks: readonly AgendaWeekDraft[]): string[][] {
  const rows: string[][] = [[...AGENDA_CSV_HEADERS]]
  for (const raw of [...weeks].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))) {
    const week = normaliseWeekDraft(raw)
    for (const item of week.items) {
      rows.push([
        week.weekStart,
        week.slideLink ?? '',
        week.leadServantName ?? '',
        week.backupServantName ?? '',
        week.notes ?? '',
        item.activityKey,
        agendaActivityLabel(item.activityKey),
        item.topic ?? '',
        item.servantName ?? '',
      ])
    }
  }
  return rows
}

/**
 * escapeCsvField (lib/portal/csv.ts) prefixes a value starting with =, +, -, @,
 * tab or CR with an apostrophe so a spreadsheet cannot read the cell as a
 * formula. Take that one apostrophe back off on the way in, or notes written as
 * a dashed list come back as "'- bring the projector" and the export stops
 * round-tripping. Only an apostrophe immediately followed by a guarded
 * character is stripped, so a genuine "'tis" or "'96" survives untouched.
 */
function unguardCsvValue(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value
}

function unguardCsvRecord(rec: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(rec)) out[key] = unguardCsvValue(value)
  return out
}

/**
 * Rebuild weeks from parsed CSV records (see parseCsvRecords, which lowercases
 * and collapses header names). Rows with an unusable week or activity are
 * counted in `skipped` rather than throwing, so one bad line cannot lose a file.
 */
export function csvRowsToAgenda(records: readonly Record<string, string>[]): {
  weeks: AgendaWeekDraft[]
  skipped: number
} {
  const byWeek = new Map<string, AgendaWeekDraft>()
  let skipped = 0

  for (const raw of records) {
    const rec = unguardCsvRecord(raw)
    const weekStart = normaliseWeekStart(rec['week start'] ?? rec['week'] ?? rec['week start monday'])
    const activityKey = resolveActivityKey(rec['activity key'] ?? rec['activity'])
    if (!weekStart || !activityKey) {
      skipped++
      continue
    }
    let week = byWeek.get(weekStart)
    if (!week) {
      week = {
        weekStart,
        slideLink: blank(rec['slide link']),
        notes: blank(rec['notes']),
        leadServantName: blank(rec['lead servant']),
        backupServantName: blank(rec['backup servant']),
        items: [],
      }
      byWeek.set(weekStart, week)
    } else {
      // Later rows may carry the week-level columns when earlier ones were blank.
      week.slideLink ??= blank(rec['slide link'])
      week.notes ??= blank(rec['notes'])
      week.leadServantName ??= blank(rec['lead servant'])
      week.backupServantName ??= blank(rec['backup servant'])
    }
    if (week.items.some((i) => i.activityKey === activityKey)) {
      skipped++
      continue
    }
    week.items.push({
      activityKey,
      topic: blank(rec['topic']),
      servantName: blank(rec['servant']),
    })
  }

  return {
    weeks: Array.from(byWeek.values())
      .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
      .map(normaliseWeekDraft),
    skipped,
  }
}

/* ── Links stored as JSON ─────────────────────────────────────────────────── */

export interface LessonLink {
  label: string
  url: string
}

/** http/https only: a stored "javascript:" URL must never become a live link. */
export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (value === '' || value.length > 2000) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Lesson.links is untyped Json; read it defensively and drop unusable entries. */
export function parseLessonLinks(value: unknown): LessonLink[] {
  if (!Array.isArray(value)) return []
  const links: LessonLink[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const url = safeUrl((entry as { url?: unknown }).url)
    if (!url) continue
    const rawLabel = (entry as { label?: unknown }).label
    const label = typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel.trim().slice(0, 80) : url
    links.push({ label, url })
    if (links.length >= 12) break
  }
  return links
}

/* ── My Assignments ───────────────────────────────────────────────────────── */

export type AssignmentKind = 'lead' | 'backup' | 'lesson' | 'agenda'

export interface Assignment {
  id: string
  kind: AssignmentKind
  /** Monday of the week it belongs to; null for a lesson with no date yet. */
  weekStart: string | null
  classId: string
  className: string
  title: string
  detail: string | null
  /** Calendar day, for lessons. */
  date: string | null
  href: string
  sortHint?: number
}

export interface AssignmentWeek {
  weekStart: string
  label: string
  items: Assignment[]
}

const KIND_RANK: Record<AssignmentKind, number> = { lead: 0, backup: 1, lesson: 2, agenda: 3 }

function sortWithinWeek(a: Assignment, b: Assignment): number {
  if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind]
  const ah = a.sortHint ?? 0
  const bh = b.sortHint ?? 0
  if (ah !== bh) return ah - bh
  return a.title.localeCompare(b.title)
}

/**
 * Soonest first for the current and future weeks; past weeks most-recent first
 * so the collapsed archive reads backwards from now. Undated lessons sit apart.
 */
export function groupAssignmentsByWeek(
  assignments: readonly Assignment[],
  todayKey: string,
): { upcoming: AssignmentWeek[]; past: AssignmentWeek[]; undated: Assignment[] } {
  const thisMonday = normaliseWeekStart(todayKey)
  const byWeek = new Map<string, Assignment[]>()
  const undated: Assignment[] = []

  for (const a of assignments) {
    const monday = a.weekStart ? normaliseWeekStart(a.weekStart) : null
    if (!monday) {
      undated.push(a)
      continue
    }
    const list = byWeek.get(monday)
    if (list) list.push(a)
    else byWeek.set(monday, [a])
  }

  const weeks: AssignmentWeek[] = Array.from(byWeek.entries()).map(([weekStart, items]) => ({
    weekStart,
    label: weekLabel(weekStart),
    items: [...items].sort(sortWithinWeek),
  }))

  const isPast = (w: AssignmentWeek) => !!thisMonday && w.weekStart < thisMonday

  return {
    upcoming: weeks.filter((w) => !isPast(w)).sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)),
    past: weeks.filter(isPast).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)),
    undated: [...undated].sort(sortWithinWeek),
  }
}
