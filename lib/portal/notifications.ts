// Notifications are computed per request from live data — nothing is stored but
// the dismissals (NotificationRead, unique per account + key). This module is
// the whole rule set from ANALYSIS §5, kept pure so it can be unit-tested:
//
//   student  — pending exams, announcements newer than 5 days, own birthday today
//   servant  — birthdays this week, open follow-up cases, absence streaks ≥ 3
//   admin    — classes without servants, open cases
//   pastor   — open cases
//
// Every notification carries a stable `key`. Keys that describe a *count*
// embed that count ("cases:open:3") so dismissing three open cases does not
// silence the fourth.

import type { Role } from './permissions'
import { daysBetween, daysUntilBirthday, mondayOf, addDays } from './dates'

export type NotificationTone = 'info' | 'good' | 'warn' | 'bad'

export interface PortalNotification {
  key: string
  title: string
  detail?: string
  href: string
  tone: NotificationTone
  /**
   * How many *things* this one notification stands for — 12 open cases, 3
   * birthdays. The sidebar badges count these rather than counting
   * notifications, so "Follow-ups 12" means twelve children, not one alert.
   * Absent means one.
   */
  count?: number
}

export interface NotificationFacts {
  /** "Today" in America/New_York, from todayInNewYork(). */
  today: string
  /** Published exams this student has not submitted yet. */
  pendingExams?: readonly { id: string; title: string; dueDate: string | null }[]
  /** Active announcements visible to this person, with their posting date. */
  announcements?: readonly { id: string; title: string; date: string }[]
  /** The signed-in student's own date of birth. */
  ownBirthday?: string | null
  /** Students in the servant's classes who have a birthday, with their dob. */
  birthdays?: readonly { id: string; name: string; dob: string }[]
  /** Count of OPEN follow-up cases in scope. */
  openCases?: number
  /** Open automatic cases and how many Sundays in a row the student has missed. */
  absenceStreaks?: readonly { studentId: string; name: string; streak: number }[]
  /** Active classes with nobody serving them. */
  classesWithoutServants?: readonly { id: string; name: string }[]
}

export const ANNOUNCEMENT_FRESH_DAYS = 5
export const STREAK_ALERT = 3
export const BIRTHDAY_WINDOW_DAYS = 7
export const EXAM_DUE_SOON_DAYS = 3

const TONE_RANK: Record<NotificationTone, number> = { bad: 0, warn: 1, info: 2, good: 3 }

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

/** Notifications for this person right now, most urgent first. */
export function buildNotifications(role: Role, facts: NotificationFacts): PortalNotification[] {
  const items: PortalNotification[] = []
  const today = facts.today

  if (role === 'STUDENT') {
    for (const exam of facts.pendingExams ?? []) {
      const due = exam.dueDate
      const daysLeft = due ? daysBetween(today, due) : null
      // A quiz whose due date has already passed is no longer actionable here.
      if (daysLeft !== null && daysLeft < 0) continue
      items.push({
        key: `exam:${exam.id}`,
        title: `Quiz to take: ${exam.title}`,
        detail:
          daysLeft === null
            ? 'No due date'
            : daysLeft === 0
              ? 'Due today'
              : `Due in ${daysLeft} ${plural(daysLeft, 'day')}`,
        href: '/portal/quizzes',
        tone: daysLeft !== null && daysLeft <= EXAM_DUE_SOON_DAYS ? 'warn' : 'info',
      })
    }

    for (const a of facts.announcements ?? []) {
      const age = daysBetween(a.date, today)
      if (age < 0 || age > ANNOUNCEMENT_FRESH_DAYS) continue
      items.push({
        key: `announcement:${a.id}`,
        title: a.title,
        detail: age === 0 ? 'Posted today' : `Posted ${age} ${plural(age, 'day')} ago`,
        // F0281 — this pointed at '/portal', the page the student is already
        // standing on when they open the bell: tapping the notification about a
        // new announcement did nothing visible at all.
        href: '/portal/announcements',
        tone: 'info',
      })
    }

    // F0785 — the greeting fired on the exact day only, so a child whose
    // birthday fell on a Wednesday got it on a Wednesday, when nobody from
    // church sees them, and it was gone by the Sunday they came in. The
    // prototype covered the whole Mon-Sun week the birthday falls in, which is
    // the week the class actually celebrates it. Keyed to the Monday, like the
    // servant birthdays item, so dismissing it silences it for the week rather
    // than only until tomorrow.
    if (facts.ownBirthday) {
      const dob = facts.ownBirthday
      const week = mondayOf(today)
      const inWeek = Array.from({ length: 7 }, (_, i) => addDays(week, i)).some((d) => d.slice(5) === dob.slice(5))
      if (inWeek) {
        items.push({
          key: `birthday:self:${week}`,
          title: daysUntilBirthday(dob, today) === 0 ? 'Happy birthday!' : 'Happy birthday this week!',
          detail: 'May the Lord bless your year.',
          href: '/portal',
          tone: 'good',
        })
      }
    }
  }

  if (role === 'SERVANT') {
    // F0786 — "this week" was seven days rolling from today, so on a Thursday a
    // servant was shown next Tuesday's child and not Monday's, whose party had
    // already happened. The window is now the church's own Mon–Sun week, which
    // is the week the birthdays page and the weekly cards already show, so the
    // bell and the page can no longer name different children.
    const weekStart = mondayOf(today)
    const soon = (facts.birthdays ?? []).filter(
      (b) => daysUntilBirthday(b.dob, weekStart) < BIRTHDAY_WINDOW_DAYS,
    )
    if (soon.length > 0) {
      items.push({
        key: `birthdays:${mondayOf(today)}`,
        count: soon.length,
        title: `${soon.length} ${plural(soon.length, 'birthday')} this week`,
        detail: soon
          .slice(0, 4)
          .map((b) => b.name)
          .join(', ') + (soon.length > 4 ? `, +${soon.length - 4} more` : ''),
        href: '/portal/birthdays',
        tone: 'good',
      })
    }

    for (const s of facts.absenceStreaks ?? []) {
      if (s.streak < STREAK_ALERT) continue
      items.push({
        key: `streak:${s.studentId}:${s.streak}`,
        title: `${s.name} has missed ${s.streak} Sundays in a row`,
        detail: 'Worth a phone call this week.',
        href: `/portal/students/${s.studentId}`,
        tone: 'bad',
      })
    }
  }

  if (role === 'ADMIN') {
    const orphans = facts.classesWithoutServants ?? []
    if (orphans.length > 0) {
      items.push({
        key: `classes-without-servants:${orphans.length}`,
        count: orphans.length,
        title: `${orphans.length} ${plural(orphans.length, 'class', 'classes')} without a servant`,
        detail: orphans
          .slice(0, 4)
          .map((c) => c.name)
          .join(', ') + (orphans.length > 4 ? `, +${orphans.length - 4} more` : ''),
        href: '/portal/admin/classes',
        tone: 'warn',
      })
    }
  }

  if (role === 'SERVANT' || role === 'ADMIN' || role === 'PASTOR') {
    const open = facts.openCases ?? 0
    if (open > 0) {
      items.push({
        key: `cases:open:${open}`,
        count: open,
        title: `${open} open follow-up ${plural(open, 'case')}`,
        detail: 'Students waiting to be visited or called.',
        href: '/portal/follow-ups',
        tone: 'warn',
      })
    }
  }

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => TONE_RANK[a.item.tone] - TONE_RANK[b.item.tone] || a.index - b.index)
    .map(({ item }) => item)
}

/** Drop the ones this person has already dismissed. */
export function unreadNotifications(
  items: readonly PortalNotification[],
  readKeys: Iterable<string>,
): PortalNotification[] {
  const read = new Set(readKeys)
  return items.filter((n) => !read.has(n.key))
}

export const TONE_BADGE: Record<NotificationTone, 'info' | 'good' | 'warn' | 'bad'> = {
  info: 'info',
  good: 'good',
  warn: 'warn',
  bad: 'bad',
}
