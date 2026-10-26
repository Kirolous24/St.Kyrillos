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

export const MESSAGE_MAX = 1000

/** What a servant may write in braces; each family gets its own child's copy. */
export const MESSAGE_PLACEHOLDERS = [
  // The sender's own name (2026-10-25), from whoever is signed in.
  { token: '{servant}', label: 'Your name' },
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
  'Hello, this is {servant}! We really missed {name} at {meeting} on {day}. We hope everything is well. ' +
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
  /** Who is sending it (greetingName of the signed-in servant), 2026-10-25. */
  servant?: string
}

/** Who a message is from when nobody is named. */
const SENDER_FALLBACK = 'a servant at St. Kyrillos'

/** Titles kept with the name after them: "Fr. Pachom", "Tasoni Marcelle". */
const TITLES = new Set(['fr', 'fr.', 'father', 'abouna', 'abuna', 'tasoni', 't.', 'dr', 'dr.', 'deacon', 'dn', 'dn.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'uncle', 'aunt', 'brother', 'sister'])

/**
 * How the sender is named in "Hello, this is Kirolous!" (2026-10-25): their
 * first name, with a title kept ("Fr. Pachom").
 */
export function greetingName(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return SENDER_FALLBACK
  return TITLES.has(words[0]!.toLowerCase()) && words[1] ? `${words[0]} ${words[1]}` : words[0]!
}

/** A message's own hello at its start: "Hi!", "Hi Mina!", "Hello everyone," … */
const OWN_HELLO = /^(\s*(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\b[^!,.?\n]{0,40}?)\s*([!,.])/i

/**
 * One family's copy: the placeholders filled, anything else in braces left alone.
 *
 * With a sender (2026-10-25) it starts "Hello, this is Kirolous!". A class's
 * own message that does not place {servant} itself gets the name after its own
 * hello ("Hi, this is Kirolous! …"), or the greeting in front when it has none,
 * so no family gets a message from a number they cannot place.
 */
export function fillMessage(body: string, fill: MessageFill): string {
  const d = toUTCDate(fill.date)
  const sender = fill.servant?.trim() ?? ''
  const values: Record<string, string> = {
    name: fill.name,
    meeting: fill.meeting,
    day: DAY_NAMES[d.getUTCDay()] ?? '',
    date: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`,
    servant: sender || SENDER_FALLBACK,
  }
  const placesSender = /\{\s*servant\s*\}/i.test(body)
  const text = body.replace(/\{\s*(name|meeting|day|date|servant)\s*\}/gi, (_, key: string) => values[key.toLowerCase()] ?? '')
  if (!sender || placesSender) return text
  if (OWN_HELLO.test(text)) return text.replace(OWN_HELLO, (_, hello: string, mark: string) => `${hello}, this is ${sender}${mark}`)
  return `Hello, this is ${sender}! ${text.trimStart()}`
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


/**
 * Who a message is noted as going to, from the composer's label for the number
 * used: "Father's phone" → "Father", "Parents’ phone" → "Parents".
 */
export function noteRecipient(label: string): string {
  return label.replace(/['’]s? phone$/, '')
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
