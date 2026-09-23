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

// F0228 — the prototype's own names for four of these (OG L8146-8155). A
// schedule exported from it says "SAINT", "Agpeya Prayer" and "The Seasons of
// the Coptic Church"; without these aliases resolveActivityKey returns null and
// the importer drops those columns silently, so an admin retypes a year the
// church already typed once. Only "LESSON" happens to survive today, and only
// because the lookup lower-cases. Aliases, not renames: the labels the portal
// prints stay as they are.
for (const [alias, key] of [
  ['agpeya prayer', 'agpeya'],
  ['the seasons of the coptic church', 'seasons'],
  ['saint', 'saint'],
] as const) {
  const activity = BY_KEY.get(key)
  if (activity) BY_LABEL.set(alias, activity)
}

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
/**
 * F0797 — which rows were skipped and why. It used to return a bare count, so
 * "12 rows skipped" told a servant nothing they could act on: not which lines, and
 * not whether the problem was the date column or the activity name. Both are
 * fixable in the spreadsheet in seconds once you know which one it is.
 *
 * Row numbers are 1-based over the data rows, matching what a spreadsheet shows
 * once the header is accounted for, and the message names the offending value.
 */
export interface SkippedAgendaRow {
  row: number
  reason: string
}

/**
 * F0216 — read a schedule exported from the old Firebase app.
 *
 * The two shapes are genuinely different files. The old app wrote **one row per
 * week**, 26 columns wide: `Week, Date`, then a `<Activity> - Topic` and
 * `<Activity> - Servant` pair for each of the ten activities, then `Slide Link,
 * Lead Servant, Back-Up, Notes`. This portal writes **one row per week and
 * activity**, nine columns, about ten rows per week.
 *
 * So an old file did not import badly — it imported as nothing at all. Its
 * `Week` column holds "1st Week of SEP", which is not a date, so every row was
 * skipped and the church would have retyped a year of planning by hand.
 *
 * This pivots the wide shape into the tall one and hands it to the ordinary
 * importer, so there is exactly one set of rules about what a valid week is. The
 * week comes from the `Date` column (`M/D/YYYY`), which `parseDateOnly` already
 * reads, and both apps run their weeks Monday to Sunday, so no date arithmetic is
 * needed beyond the snapping `normaliseWeekStart` already does. Activity names
 * come through `resolveActivityKey`, which already knows the old app's own
 * wordings ("SAINT", "Agpeya Prayer", "The Seasons of the Coptic Church").
 */
export function isLegacyAgendaCsv(records: readonly Record<string, string>[]): boolean {
  return legacyActivityColumns(records[0]).length > 0
}

/**
 * The `<activity> topic` / `<activity> servant` column pairs in a wide file.
 *
 * `normaliseHeader` lowercases and turns every run of punctuation into a single
 * space, so the old app's "LESSON - Topic" arrives as `lesson topic` and
 * "The Seasons of the Coptic Church - Topic" as
 * `the seasons of the coptic church topic`. The label is what is left once the
 * suffix comes off, and it has to resolve to one of this portal's activities —
 * which is also what keeps the portal's own export out of this reader, since its
 * columns are a bare `topic` and `servant` with no activity prefix. (Its
 * `lead servant` column ends in ` servant`, so a looser test would match it.)
 */
function legacyActivityColumns(
  first: Record<string, string> | undefined,
): Array<{ key: AgendaActivityKey; topicCol: string; servantCol: string }> {
  if (!first) return []
  const found: Array<{ key: AgendaActivityKey; topicCol: string; servantCol: string }> = []
  for (const col of Object.keys(first)) {
    if (!col.endsWith(' topic')) continue
    const label = col.slice(0, -' topic'.length)
    const key = resolveActivityKey(label)
    if (!key) continue
    found.push({ key, topicCol: col, servantCol: `${label} servant` })
  }
  return found
}

/**
 * Wide (one row per week) → tall (one row per week and activity). Unknown
 * activity columns are left out rather than guessed at; a row whose Date cell is
 * unusable is passed through as a single unusable row so the ordinary importer
 * reports it with its line number rather than dropping it silently.
 */
export function legacyAgendaCsvToRecords(
  records: readonly Record<string, string>[],
): Record<string, string>[] {
  const out: Record<string, string>[] = []
  // Resolved once from the header, not per row.
  const pairs = legacyActivityColumns(records[0])
  if (pairs.length === 0) return out

  for (const rec of records) {
    // The old app's "Week" column is "1st Week of SEP"; the date is its own column.
    const date = rec['date'] ?? rec['week start'] ?? ''
    const weekLevel = {
      'slide link': rec['slide link'] ?? '',
      // The old app headed this column "Back-Up".
      'lead servant': rec['lead servant'] ?? '',
      'backup servant': rec['backup servant'] ?? rec['back-up'] ?? rec['back up'] ?? '',
      notes: rec['notes'] ?? '',
    }

    if (!normaliseWeekStart(date)) {
      // Kept, not dropped: the importer names the line and quotes the value, and
      // a blank filler row in a spreadsheet is exactly what this looks like.
      out.push({ 'week start': date, 'activity key': '', topic: '', servant: '', ...weekLevel })
      continue
    }

    let emitted = 0
    for (const pair of pairs) {
      const topic = (rec[pair.topicCol] ?? '').trim()
      const servant = (rec[pair.servantCol] ?? '').trim()
      // An activity nobody filled in carries nothing; emitting it would turn a
      // half-planned year into ten blank rows a week.
      if (!topic && !servant) continue
      out.push({
        'week start': date,
        'activity key': pair.key,
        topic,
        servant,
        ...weekLevel,
      })
      emitted++
    }

    // A week can carry a slide link, notes or a lead servant and no topics at
    // all — a servant who booked the room before planning the lesson. Skipping
    // it because no activity was filled in would throw that away, so one row
    // carries the week-level columns through. The importer fills the ten
    // activity rows out blank, which is what the week actually is.
    if (emitted === 0 && Object.values(weekLevel).some((v) => v.trim())) {
      out.push({
        'week start': date,
        'activity key': AGENDA_ACTIVITIES[0]!.key,
        topic: '',
        servant: '',
        ...weekLevel,
      })
    }
  }
  return out
}

export function csvRowsToAgenda(records: readonly Record<string, string>[]): {
  weeks: AgendaWeekDraft[]
  skipped: number
  skippedRowDetail: SkippedAgendaRow[]
} {
  const byWeek = new Map<string, AgendaWeekDraft>()
  let skipped = 0
  const skippedRowDetail: SkippedAgendaRow[] = []

  for (let index = 0; index < records.length; index++) {
    const raw = records[index]!
    const rec = unguardCsvRecord(raw)
    const rawWeek = rec['week start'] ?? rec['week'] ?? rec['week start monday'] ?? ''
    const rawActivity = rec['activity key'] ?? rec['activity'] ?? ''
    const weekStart = normaliseWeekStart(rawWeek)
    const activityKey = resolveActivityKey(rawActivity)
    if (!weekStart || !activityKey) {
      skipped++
      // Says which column, and quotes the value, so it can be found in the file.
      const problems: string[] = []
      if (!weekStart) {
        problems.push(rawWeek.trim() ? `week start "${rawWeek.trim()}" is not a date` : 'no week start')
      }
      if (!activityKey) {
        problems.push(rawActivity.trim() ? `activity "${rawActivity.trim()}" is not one we know` : 'no activity')
      }
      skippedRowDetail.push({ row: index + 1, reason: problems.join(' and ') })
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
      // The third reason a row is dropped, and the one nobody guesses: the same
      // activity twice in one week, where only the first is kept.
      skippedRowDetail.push({
        row: index + 1,
        reason: `"${rawActivity.trim() || activityKey}" is already set for the week of ${weekStart}`,
      })
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
    skippedRowDetail,
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

/* ── The church's own week names ──────────────────────────────────────────── */

/**
 * The prototype's Agpeya hours (OG L8157). It is a closed list of six — the
 * portal had turned it into a free-text box, so "3rd" and "Third" and "3rd
 * hour" all became different answers to the same question.
 */
export const AGPEYA_HOURS = ['1st', '2nd', '3rd', '9th', '11th', '12th'] as const

/** "1st", "2nd", "3rd", "11th" — OG ordinalLabel, L8159-8162. */
export function ordinalLabel(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/**
 * Every week that touches a month, as Monday keys.
 *
 * Weeks run Monday–Sunday, and the first one starts on the Monday **on or
 * before** the 1st — so a month beginning mid-week still has a first week, and
 * one beginning on a Monday does not gain a phantom week before it (OG
 * getWeeksInMonth, L8125-8142).
 */
export function weeksInMonth(month: string): string[] {
  const first = `${month}-01`
  const firstDate = parseDateOnly(first)
  if (!firstDate) return []
  const [y, m] = month.split('-').map(Number)
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  const last = `${month}-${String(lastDay).padStart(2, '0')}`

  const weeks: string[] = []
  let cursor = mondayOf(first)
  while (cursor <= last) {
    weeks.push(cursor)
    cursor = addDays(cursor, 7)
  }
  return weeks
}

export interface SchoolYearWeek {
  /** Monday, "2026-09-07". */
  key: string
  /** "2nd Week of SEP" — how the church names it. */
  label: string
}

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/**
 * Every week of the school year September→August, named as the church names
 * them (OG getSchoolYearWeeksList, L8224-8243).
 *
 * The ordinal counts **within its month**, not within the year: the church says
 * "3rd Week of October", never "week 31".
 *
 * A week that straddles two months belongs to the month containing its
 * **Thursday** — the ISO rule, and the one that matches how a week "feels":
 * Mon 31 Aug–Sun 6 Sep is the first week of September, not the fifth of
 * August. The prototype instead listed such a week under **both** months, which
 * is fine for prose and wrong for a dropdown keyed by Monday: two options would
 * carry the same value. Simply dropping the duplicate is worse still — it
 * leaves a month whose weeks begin at "2nd", with no first week anywhere.
 */
export function schoolYearWeeks(todayKey: string): SchoolYearWeek[] {
  const year = Number(todayKey.slice(0, 4))
  const month = Number(todayKey.slice(5, 7))
  const startYear = month >= 9 ? year : year - 1

  const weeks: SchoolYearWeek[] = []
  for (let i = 0; i < 12; i++) {
    const mIdx = (8 + i) % 12
    const mYear = startYear + (mIdx < 8 ? 1 : 0)
    const monthKey = `${mYear}-${String(mIdx + 1).padStart(2, '0')}`
    // Thursday is day 3 of a Monday-based week.
    const mine = weeksInMonth(monthKey).filter((key) => addDays(key, 3).slice(0, 7) === monthKey)
    mine.forEach((key, wi) => {
      weeks.push({ key, label: `${ordinalLabel(wi + 1)} Week of ${MONTH_ABBR[mIdx]}` })
    })
  }
  return weeks
}

/**
 * The church's name for one week, or null when it falls outside the school
 * year this date sits in. Null rather than a guess: a made-up ordinal on a
 * week nobody is looking at is worse than no ordinal.
 */
export function agendaWeekName(mondayKey: string, todayKey: string): string | null {
  const monday = normaliseWeekStart(mondayKey)
  if (!monday) return null
  return schoolYearWeeks(todayKey).find((w) => w.key === monday)?.label ?? null
}

/**
 * A blank year to fill in offline (OG downloadAgendaBlankTemplate, L8735-8739).
 *
 * Every week of the school year, in the **same shape the importer reads**, with
 * the topic and servant columns empty. That matters more than it sounds: a
 * template whose columns differ from the importer's is a file that cannot come
 * back, which is exactly the trap the old wide-format export fell into.
 */
export function agendaBlankTemplateRows(todayKey: string): string[][] {
  return agendaToCsvRows(
    schoolYearWeeks(todayKey).map((w) => ({
      weekStart: w.key,
      slideLink: null,
      notes: null,
      leadServantName: null,
      backupServantName: null,
      items: AGENDA_ACTIVITIES.map((a) => ({
        activityKey: a.key,
        topic: null,
        servantId: null,
        servantName: null,
      })),
    })),
  )
}
