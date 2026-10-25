// Servant assignment notices (2026-10-19): a servant is told the moment they
// are given, or taken off, a part of a Sunday class, and reminded the evening
// before. A part is a *duty*: one of the Schedule's activities, Lead or Backup
// for a week, or a lesson. This module decides who gained or lost which duty
// between two snapshots, and words the notices. No DB access; tested in
// tests/portal/assignment-notices.test.ts.

import { DAY_NAMES, mondayOf, toUTCDate } from './dates'
import { formatMonthDay } from './format'

/** How long a servant's notices stay in the bell, and in the database. */
export const NOTICE_DAYS = 60

export type DutyKind = 'activity' | 'lead' | 'backup' | 'lesson'

export interface Duty {
  /**
   * The part itself, whoever holds it, stable across saves:
   * item:{classId}:{monday}:{activityKey}, lead:{classId}:{monday},
   * backup:{classId}:{monday} or lesson:{lessonId}.
   */
  slot: string
  kind: DutyKind
  servantId: string
  /** "Coptic", "Lead", "Backup", or Lesson “Title”. */
  label: string
  topic: string | null
  className: string
  classId?: string
  /** The day it is due, YYYY-MM-DD, or null for an undated lesson. */
  due: string | null
  /** Where a tap goes. */
  href: string
  /** A Schedule part its servant has marked ready (2026-10-19). */
  done?: boolean
}

export interface DutyChange {
  servantId: string
  added: Duty[]
  removed: Duty[]
}

export interface NoticeText {
  title: string
  body: string
  href: string
}

/** My Assignments, opened at the week of the day. */
export function dutyHref(due: string | null): string {
  return due ? `/portal/assignments#week-${mondayOf(due)}` : '/portal/assignments'
}

/**
 * Who gained and who lost which duty between two snapshots of the same parts.
 * The same servant on the same part is no change, whatever happened to its
 * topic. The servant who made the change is not told about it, and a duty
 * already in the past is nobody's news.
 */
export function dutyChanges(
  before: readonly Duty[],
  after: readonly Duty[],
  opts: { today: string; actorServantId: string | null },
): DutyChange[] {
  const was = new Map(before.map((d) => [d.slot, d]))
  const now = new Map(after.map((d) => [d.slot, d]))
  const byServant = new Map<string, DutyChange>()
  const entry = (servantId: string) => {
    let e = byServant.get(servantId)
    if (!e) byServant.set(servantId, (e = { servantId, added: [], removed: [] }))
    return e
  }
  const news = (d: Duty) => d.servantId !== opts.actorServantId && (d.due === null || d.due >= opts.today)
  for (const slot of Array.from(new Set([...Array.from(was.keys()), ...Array.from(now.keys())]))) {
    const b = was.get(slot)
    const a = now.get(slot)
    if (b && a && b.servantId === a.servantId) continue
    if (b && news(b)) entry(b.servantId).removed.push(b)
    if (a && news(a)) entry(a.servantId).added.push(a)
  }
  return Array.from(byServant.values()).sort((x, y) => (x.servantId < y.servantId ? -1 : x.servantId > y.servantId ? 1 : 0))
}

const KIND_ORDER: Record<DutyKind, number> = { activity: 0, lead: 1, backup: 2, lesson: 3 }

/** Soonest first, undated last; the class's parts before Lead, Backup and lessons. */
function ordered(duties: readonly Duty[]): Duty[] {
  return duties
    .map((d, i) => ({ d, i }))
    .sort((x, y) => {
      if (x.d.due !== y.d.due) {
        if (x.d.due === null) return 1
        if (y.d.due === null) return -1
        return x.d.due < y.d.due ? -1 : 1
      }
      return KIND_ORDER[x.d.kind] - KIND_ORDER[y.d.kind] || x.i - y.i
    })
    .map((x) => x.d)
}

/** "a", "a and b", "a, b and c". */
function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "Sunday, Oct 25". */
function dayLabel(date: string): string {
  return `${DAY_NAMES[toUTCDate(date).getUTCDay()]}, ${formatMonthDay(date)}`
}

function classes(duties: readonly Duty[]): string {
  return Array.from(new Set(duties.map((d) => d.className).filter(Boolean))).join(', ')
}

function dates(duties: readonly Duty[]): string[] {
  return Array.from(new Set(duties.map((d) => d.due).filter((d): d is string => d !== null))).sort()
}

/** What a servant is told when a save gives them one or more parts. */
export function assignedNotice(added: readonly Duty[]): NoticeText {
  const duties = ordered(added)
  const days = dates(duties)
  const title = duties.length === 1 ? 'New assignment' : 'New assignments'
  const where = classes(duties)
  const href = dutyHref(days[0] ?? null)
  if (days.length > 1) {
    return { title, body: `You have ${duties.length} new assignments, ${formatMonthDay(days[0]!)} – ${formatMonthDay(days[days.length - 1]!)} · ${where}`, href }
  }
  const when = days[0] ? ` for ${dayLabel(days[0])}` : ''
  return { title, body: `You’re on ${list(duties.map((d) => d.label))}${when} · ${where}`, href }
}

/** What a servant is told when a save takes one or more parts off them. */
export function removedNotice(removed: readonly Duty[]): NoticeText {
  const duties = ordered(removed)
  const days = dates(duties)
  const where = classes(duties)
  const href = dutyHref(days[0] ?? null)
  if (days.length > 1) {
    return {
      title: 'Assignment changed',
      body: `${duties.length} of your assignments were taken off, ${formatMonthDay(days[0]!)} – ${formatMonthDay(days[days.length - 1]!)} · ${where}`,
      href,
    }
  }
  const when = days[0] ? ` for ${dayLabel(days[0])}` : ''
  return { title: 'Assignment changed', body: `You’re no longer on ${list(duties.map((d) => d.label))}${when} · ${where}`, href }
}

/** One save that both gave a servant parts and took others off them: one notice, both sentences. */
export function changedNotice(added: readonly Duty[], removed: readonly Duty[]): NoticeText {
  const gained = assignedNotice(added)
  return { title: 'Assignments changed', body: `${gained.body}. ${removedNotice(removed).body}`, href: gained.href }
}

/** The evening-before reminder: everything due tomorrow, with its topic. */
export function reminderNotice(due: readonly Duty[]): NoticeText {
  const duties = ordered(due)
  return {
    title: 'Reminder for tomorrow',
    body: `${list(duties.map((d) => (d.topic ? `${d.label} (${d.topic})` : d.label)))} · ${classes(duties)}`,
    href: dutyHref(duties[0]?.due ?? null),
  }
}

/**
 * The coordinators' evening list (2026-10-19): tomorrow's parts nobody has
 * marked done yet, and who is on each.
 */
export function notDoneNotice(rows: ReadonlyArray<{ label: string; servantName: string; className: string }>, href: string): NoticeText {
  const classNames = Array.from(new Set(rows.map((r) => r.className).filter(Boolean))).join(', ')
  return {
    title: 'Not marked done yet',
    body: `For tomorrow: ${list(rows.map((r) => `${r.label} (${r.servantName})`))} · ${classNames}`,
    href,
  }
}

/**
 * Email only reaches a servant who has an address, has not turned these
 * emails off, and has no phone with notifications on, so nobody gets both.
 */
export function shouldEmail(p: { email: string | null; noticeEmails: boolean; pushDevices: number }): boolean {
  return !!p.email?.trim() && p.noticeEmails && p.pushDevices === 0
}
