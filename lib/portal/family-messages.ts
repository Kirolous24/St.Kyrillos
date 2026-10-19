// Family messages (2026-10-19): one message for the children who missed a
// meeting, written once. Each family's button opens WhatsApp or Messages with
// their own child's copy already written. A servant asked for it: Friday's
// Bible Study message should say which chapters they read, not repeat
// Sunday's, and editing it inside every child's composer meant copy-pasting it
// once per child.
//
// The portal still sends nothing itself. Each message leaves from the servant's
// own phone, one tap per family. No DB access here; the rules are tested in
// tests/portal/family-messages.test.ts.

import { DAY_NAMES, toUTCDate } from './dates'
import { currentExcuse, excuseState, isExcusedOn, type ExcuseWindow } from './excuses'
import type { KidPhone } from './phones'

export const MESSAGE_MAX = 1000

/** What a servant may write in braces; each family gets its own child's copy. */
export const MESSAGE_PLACEHOLDERS = [
  { token: '{name}', label: 'Child’s first name' },
  { token: '{meeting}', label: 'The meeting' },
  { token: '{day}', label: 'Its weekday' },
  { token: '{date}', label: 'Its date' },
] as const

/**
 * Where every class starts, until a servant saves its own. The church's words
 * from the old composer, turned to the family, since it is usually a parent's
 * phone that gets it.
 */
export const STANDARD_MESSAGE =
  'Hi! We really missed {name} at {meeting} on {day}. We hope everything is well. ' +
  '{name} is always in our prayers, and it would be so nice to see {name} again soon. God bless you always!'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export interface MessageFill {
  /** The child's first name. */
  name: string
  /** The meeting they missed, as the church names it ("Bible Study"). */
  meeting: string
  /** The day of that meeting, YYYY-MM-DD. */
  date: string
}

/** One family's copy: the placeholders filled, anything else in braces left alone. */
export function fillMessage(body: string, fill: MessageFill): string {
  const d = toUTCDate(fill.date)
  const values: Record<string, string> = {
    name: fill.name,
    meeting: fill.meeting,
    day: DAY_NAMES[d.getUTCDay()] ?? '',
    date: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`,
  }
  return body.replace(/\{\s*(name|meeting|day|date)\s*\}/gi, (_, key: string) => values[key.toLowerCase()] ?? '')
}

/** What is wrong with a message before it is saved or sent, or null. */
export function messageProblem(body: string): string | null {
  if (!body.trim()) return 'Write the message first.'
  if (body.length > MESSAGE_MAX) return `Keep the message under ${MESSAGE_MAX.toLocaleString('en-US')} characters.`
  return null
}

/** International digits: a bare 10-digit number is American, as the church enters them. */
function international(digits: string): string {
  const d = digits.replace(/\D+/g, '')
  return d.length === 10 ? `1${d}` : d
}

/** WhatsApp with the message written in. */
export function whatsAppHref(digits: string, text: string): string {
  return `https://wa.me/${international(digits)}?text=${encodeURIComponent(text)}`
}

/**
 * A text message with the body written in. `?&body=` is the one form both
 * read: Android takes the query, and iPhone takes what follows the `&`.
 */
export function smsHref(digits: string, text: string): string {
  return `sms:+${international(digits)}?&body=${encodeURIComponent(text)}`
}

const MESSAGING_RANK: Record<KidPhone['label'], number> = { Mother: 0, Parents: 1, Father: 2, Student: 3 }

/** The family's numbers in the order a message goes: the mother's first, the child's own last. */
export function messagingOrder(phones: readonly KidPhone[]): KidPhone[] {
  return [...phones].sort((a, b) => MESSAGING_RANK[a.label] - MESSAGING_RANK[b.label])
}

type Mark = 'PRESENT' | 'EXCUSED' | 'ABSENT'

/** The best mark of a day wins, as everywhere: present, then excused, then absent. */
const RANK: Record<Mark, number> = { PRESENT: 3, EXCUSED: 2, ABSENT: 1 }

/**
 * Who missed a meeting: everyone on that register's roster who was not marked
 * present or excused. A child nobody marked counts too, since a register taken
 * only by scanning has no row for a child who never came. They count only if
 * they had joined by that day, so a child added since is not "missing" from a
 * meeting held before they were here. A meeting with no marks at all was
 * never taken, so nobody missed it.
 */
export function missedRegister(args: {
  roster: ReadonlyArray<{ id: string; joinedOn: string }>
  marks: ReadonlyArray<{ studentId: string; status: Mark }>
  date: string
}): Array<{ studentId: string; marked: boolean }> {
  if (args.marks.length === 0) return []
  const byStudent = new Map<string, Mark>()
  for (const m of args.marks) {
    const prev = byStudent.get(m.studentId)
    if (!prev || RANK[m.status] > RANK[prev]) byStudent.set(m.studentId, m.status)
  }
  const out: Array<{ studentId: string; marked: boolean }> = []
  for (const kid of args.roster) {
    const mark = byStudent.get(kid.id)
    if (mark === 'PRESENT' || mark === 'EXCUSED') continue
    if (mark === 'ABSENT') out.push({ studentId: kid.id, marked: true })
    else if (kid.joinedOn <= args.date) out.push({ studentId: kid.id, marked: false })
  }
  return out
}


/** Who in the family a recorded message went to: the note reads "To Mother: …". */
export function sentTo(note: string | null | undefined): string | null {
  const m = /^To ([^:\n]{1,60}): /.exec(note ?? '')
  return m ? m[1]! : null
}

/**
 * The follow-up excuse to show beside a child who missed a meeting: the one
 * that covered that day, or else the one on now or coming next. Only the first
 * two mean nobody owes the family a message; one still to come is shown, but the
 * child is not counted as excused yet.
 */
export function excuseForMeeting<T extends ExcuseWindow>(
  list: readonly T[],
  date: string,
  today: string,
): { excuse: T | null; excused: boolean } {
  const covering = list.find((e) => isExcusedOn([e], date))
  if (covering) return { excuse: covering, excused: true }
  const current = currentExcuse(list, today)
  return { excuse: current, excused: !!current && excuseState(current, today) === 'active' }
}
