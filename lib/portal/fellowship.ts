/**
 * Fellowship meetings (2026-10-24).
 *
 * The Women's, Men's and Youth meetings are classes in a fourth bracket,
 * Fellowship. The people in them are members rather than students: many of
 * them serve in Sunday School, many never serve and have never signed in.
 * Servants wanted two things from the portal: who came, and following up with
 * whoever stops coming. So a meeting has attendance (by hand and by a QR code
 * members check in on without signing in), follow-ups and messages, and none
 * of the children's points, quizzes or reports.
 *
 * - A meeting is a SchoolClass with stage FELLOWSHIP and its own 0-point
 *   session (`meetingSessionKey`).
 * - A member is a Student row: on a MEMBER account that can never sign in, or
 *   on the servant's own account, so a servant keeps one login.
 *
 * Pure; tested in tests/portal/fellowship*.test.ts.
 */

import type { Prisma } from '@prisma/client'
import { studentNameKey } from './student-dupes'
import { normalizePhone } from './phones'
import { churchToday, parseBirthDate } from './dates'
import { formatPhone } from './phones'
import { normaliseHeader, parseCsvTable, toCsv } from './csv'
import { splitName } from './names'

export const KID_STAGES = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL'] as const

export function isFellowship(stage: string | null | undefined): boolean {
  return stage === 'FELLOWSHIP'
}

/**
 * Every Student row that is not a Fellowship member: not on a member's account,
 * and not in a meeting. A servant whose member side is in a meeting is a
 * member there; with no meeting left (`classId` null) they are what they were
 * before, a servant who grew up here (F0850), so the lists that showed those
 * still do.
 */
export const NOT_FELLOWSHIP_MEMBER: Prisma.StudentWhereInput = {
  account: { role: { not: 'MEMBER' } },
  OR: [{ classId: null }, { class: { stage: { not: 'FELLOWSHIP' } } }],
}

/**
 * A children's list without the members. Composed rather than spread, so the
 * caller's own OR (a name search) is kept.
 */
export function withoutMembers(where: Prisma.StudentWhereInput): Prisma.StudentWhereInput {
  return { AND: [where, NOT_FELLOWSHIP_MEMBER] }
}

/** Missed meetings in a row before a follow-up opens, unless the admin changes it. */
export const FELLOWSHIP_THRESHOLD = 2

/** The key of a meeting's own register session. */
export function meetingSessionKey(classId: string): string {
  return `fellowship-${classId}`
}

/**
 * The meeting a class's cards and follow-ups are read against: Sunday School
 * for a children's class, its own register for a Fellowship meeting.
 */
export function watchedSessionKey(cls: { id: string; stage: string }): string {
  return isFellowship(cls.stage) ? meetingSessionKey(cls.id) : 'sunday'
}

const HEX = '0123456789abcdef'

/**
 * The login ID of a member who does not serve. It has to be unique like any
 * other, and it must never be something the sign-in form accepts (four
 * digits), so the account cannot be signed into whatever PIN is typed, and the
 * four-digit space the children and servants use is left alone.
 */
export function memberLoginId(): string {
  const bytes = new Uint8Array(10)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  for (const b of Array.from(bytes)) out += HEX[(b >> 4) & 0xf]! + HEX[b & 0xf]!
  return `member-${out}`
}

export function isMemberLoginId(id: string): boolean {
  return /^member-[0-9a-f]{20}$/.test(id)
}

/**
 * A member account's PIN hash: not a bcrypt hash at all, so bcrypt matches no
 * PIN against it. The third lock, behind the ID that is not four digits and the
 * MEMBER role that sign-in refuses; and no hashing work per member imported.
 */
export const MEMBER_NO_LOGIN_HASH = 'member-cannot-sign-in'

/**
 * The names a phone sees on the check-in page: first name and last initial.
 * Anyone holding the code for its five minutes sees them, so no more than that,
 * unless two people would look the same; then they get their last names.
 */
export function checkInLabels(
  people: ReadonlyArray<{ id: string; firstName: string; lastName: string }>,
): Map<string, string> {
  const short = (p: { firstName: string; lastName: string }) => {
    const first = p.firstName.trim()
    const initial = p.lastName.trim().charAt(0).toUpperCase()
    return initial ? `${first} ${initial}.` : first
  }
  const full = (p: { firstName: string; lastName: string }) => [p.firstName.trim(), p.lastName.trim()].filter(Boolean).join(' ')
  const shortCount = new Map<string, number>()
  for (const p of people) {
    const key = short(p).toLowerCase()
    shortCount.set(key, (shortCount.get(key) ?? 0) + 1)
  }
  const out = new Map<string, string>()
  const used = new Map<string, number>()
  for (const p of people) {
    let label = (shortCount.get(short(p).toLowerCase()) ?? 0) > 1 ? full(p) : short(p)
    const seen = used.get(label.toLowerCase()) ?? 0
    used.set(label.toLowerCase(), seen + 1)
    if (seen > 0) label = `${label} (${seen + 1})`
    out.set(p.id, label)
  }
  return out
}

/**
 * Whether a phone may check this person in with this code.
 * - `phone-used`: this phone already checked someone else in. One phone, one
 *   person: the catch the church accepted with checking in without signing in
 *   is someone tapping a friend who is not there, and this is the brake on it.
 * - `already`: they are marked present already, by this phone, another one or
 *   a servant. Nothing is written again.
 */
export function selfCheckInDecision(args: {
  accountId: string
  device: string
  /** Every self check-in made with this code so far. */
  redemptions: ReadonlyArray<{ accountId: string; device: string | null }>
  /** Whether the register already says they are here. */
  present: boolean
}): 'ok' | 'already' | 'phone-used' {
  if (args.redemptions.some((r) => r.device === args.device && r.accountId !== args.accountId)) return 'phone-used'
  if (args.present || args.redemptions.some((r) => r.accountId === args.accountId)) return 'already'
  return 'ok'
}

/** A member's own check-in, as the register shows it until a servant changes it. */
export const SELF_CHECKIN_NOTE = 'Self check-in'

/**
 * Where a meeting's message starts until its servants save their own, turned
 * to the member rather than to a parent.
 */
export const MEMBER_MESSAGE =
  'Hello {name}, this is {servant}! We really missed you at {meeting} on {day}. We hope everything is well. ' +
  'You are always in our prayers, and it would be so good to see you again soon. God bless you!'

/* ── Joining and leaving a meeting ──────────────────────────────────────── */

/**
 * The person as joining and leaving need them: their account's role, their
 * Student row if they have one (`memberOf` is the other Fellowship meetings
 * they joined, ClassMember rows), and the classes they serve.
 */
export interface PersonState {
  role: 'MEMBER' | 'SERVANT' | 'STUDENT' | 'ADMIN' | 'PASTOR'
  student: { id: string; classId: string | null; memberOf: string[] } | null
  serves: string[]
}

export type JoinPlan =
  | { kind: 'refuse'; reason: string }
  | { kind: 'already' }
  /** A Student row on their account, in this meeting: a servant's member side. */
  | { kind: 'create-home' }
  /** Their Student row, with no meeting, comes to this one. */
  | { kind: 'set-home' }
  /** A second meeting: a ClassMember row. */
  | { kind: 'add-member' }

/**
 * How someone joins a meeting. The first meeting is their home, since follow-up
 * groups live there; another meeting is a membership, as Pre-Servants' are.
 */
export function joinPlan(person: PersonState, meeting: { id: string; name: string }): JoinPlan {
  if (person.role === 'STUDENT') return { kind: 'refuse', reason: 'Children are not members of a Fellowship meeting.' }
  if (person.role === 'ADMIN' || person.role === 'PASTOR') {
    return { kind: 'refuse', reason: 'That is an admin or pastor login, not a person who can be a member.' }
  }
  // The user's word (2026-10-24): a meeting's servant is not also its member.
  if (person.serves.includes(meeting.id)) {
    return { kind: 'refuse', reason: `This person serves ${meeting.name}, so they can't also be one of its members.` }
  }
  const s = person.student
  if (!s) return { kind: 'create-home' }
  if (s.classId === meeting.id || s.memberOf.includes(meeting.id)) return { kind: 'already' }
  if (s.classId === null) return { kind: 'set-home' }
  return { kind: 'add-member' }
}

export type LeavePlan =
  | { kind: 'not-member' }
  | { kind: 'drop-membership' }
  /** Their home meeting goes; the next one they are in becomes home. */
  | { kind: 'promote'; newHome: string }
  /**
   * Their last meeting: their record and its history stay, with no meeting
   * (the user, 2026-10-24: keep the record of people who left). A servant
   * keeps their login; anyone can be added back, history and all.
   */
  | { kind: 'clear-home' }

/** What leaving a meeting does. `student.memberOf` must hold only Fellowship meetings. */
export function leavePlan(person: PersonState, meetingId: string): LeavePlan {
  const s = person.student
  if (!s) return { kind: 'not-member' }
  if (s.classId !== meetingId) return s.memberOf.includes(meetingId) ? { kind: 'drop-membership' } : { kind: 'not-member' }
  const next = s.memberOf.find((id) => id !== meetingId)
  if (next) return { kind: 'promote', newHome: next }
  return { kind: 'clear-home' }
}

/* ── The same person, typed again ───────────────────────────────────────── */

/** Someone already in the portal who could be added to a meeting. */
export interface KnownPerson {
  kind: 'servant' | 'member'
  /** Servant.id for a servant, Student.id for a member. */
  id: string
  firstName: string
  lastName: string
  /** YYYY-MM-DD */
  dob: string | null
  /** "Servant · 5th & 6th Boys", "Member · Youth Meeting". */
  where: string
}

/**
 * Who in the portal this could be: the same name in any order, case or usual
 * spelling (the children's import rule, `studentNameKey`), unless both sides
 * have a birthday and they differ. A phone number never decides it: a servant
 * changes numbers, and a meeting's sheet may carry a spouse's.
 */
export function samePersonMatches<T extends KnownPerson>(
  candidate: { firstName: string; lastName: string; dob?: string | null },
  people: readonly T[],
): T[] {
  const key = studentNameKey(candidate.firstName, candidate.lastName)
  if (!key) return []
  return people.filter(
    (p) => studentNameKey(p.firstName, p.lastName) === key && !(candidate.dob && p.dob && candidate.dob !== p.dob),
  )
}

/** Someone a meeting's Add member page offers. */
export interface Addable extends KnownPerson {
  /** As the portal shows it. */
  name: string
  /** Last four digits of their phone, so two people of one name can be told apart. */
  phoneEnd: string | null
  /** Why they cannot be added here (`ALREADY_MEMBER`, or that they serve it); null if they can. */
  blocked: string | null
}

/** `Addable.blocked` for someone already in this meeting. */
export const ALREADY_MEMBER = 'Already a member'

/** The Add member search: every word typed must start one of their names. Twenty at most. */
export function searchPeople<T extends Pick<Addable, 'firstName' | 'lastName'>>(people: readonly T[], q: string, limit = 20): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return people
    .filter((p) => {
      const names = `${p.firstName} ${p.lastName}`.toLowerCase().split(/\s+/)
      return words.every((w) => names.some((n) => n.startsWith(w)))
    })
    .slice(0, limit)
}

/* ── The add-member form ────────────────────────────────────────────────── */

export interface MemberValue {
  firstName: string
  lastName: string
  /** Digits only. */
  phone: string | null
  email: string | null
  /** YYYY-MM-DD */
  dob: string | null
  note: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * A member who does not serve, as typed on the form or read off a sheet. Only
 * a first name is needed; everything else is optional and checked if given.
 */
export function parseMemberInput(
  raw: { firstName?: unknown; lastName?: unknown; phone?: unknown; email?: unknown; birthday?: unknown; note?: unknown },
  today: string = churchToday(),
): { ok: true; value: MemberValue } | { ok: false; error: string } {
  const firstName = text(raw.firstName).replace(/\s+/g, ' ')
  const lastName = text(raw.lastName).replace(/\s+/g, ' ')
  if (!firstName) return { ok: false, error: 'Write their first name.' }
  if (firstName.length > 60 || lastName.length > 60) return { ok: false, error: 'Keep each name under 60 characters.' }

  const phoneText = text(raw.phone)
  const phone = phoneText ? normalizePhone(phoneText) : null
  if (phoneText && (!phone || phone.length < 7)) return { ok: false, error: 'That phone number is too short.' }
  if (phone && phone.length > 15) return { ok: false, error: 'That phone number is too long.' }

  const email = text(raw.email).toLowerCase() || null
  if (email && (email.length > 120 || !EMAIL_RE.test(email))) return { ok: false, error: 'That email address does not look right.' }

  const birthdayText = text(raw.birthday)
  const dob = birthdayText ? parseBirthDate(birthdayText, today) : null
  if (birthdayText && (!dob || dob > today)) return { ok: false, error: 'Write the birthday as month/day/year.' }

  const note = text(raw.note) || null
  if (note && note.length > 500) return { ok: false, error: 'Keep the note under 500 characters.' }

  return { ok: true, value: { firstName, lastName, phone, email, dob, note } }
}

/**
 * What a member's card says about them beyond this meeting: the classes they
 * serve, and their other Fellowship meetings (home included, when this is not it).
 */
export function memberTags(
  m: {
    classId: string | null
    className: string | null
    memberships: ReadonlyArray<{ classId: string; name: string; stage: string }>
    serves: readonly string[]
  },
  meetingId: string,
): { serves: string[]; alsoIn: string[] } {
  const alsoIn: string[] = []
  if (m.classId && m.classId !== meetingId && m.className) alsoIn.push(m.className)
  for (const x of m.memberships) if (x.classId !== meetingId && isFellowship(x.stage)) alsoIn.push(x.name)
  return { serves: [...m.serves], alsoIn }
}

/* ── Spreadsheets ────────────────────────────────────────────────────────── */

/** 2026-03-04 as 3/4/2026: how the church writes dates, and what the import reads back. */
function usDate(dateOnly: string | null): string {
  if (!dateOnly) return ''
  const [y, m, d] = dateOnly.split('-')
  return `${Number(m)}/${Number(d)}/${y}`
}

export interface MemberExportRow {
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  /** YYYY-MM-DD */
  dob: string | null
  note: string | null
  /** The classes they serve, when they are a servant. */
  serves: string[]
  otherMeetings: string[]
  /** YYYY-MM-DD */
  memberSince: string
  /** Of the meeting's latest `held` meetings, how many they came to. */
  attended: number
  held: number
}

/**
 * A meeting's members as a spreadsheet. Its first six columns are the
 * template's, so a list exported, corrected and imported back adds nobody twice.
 */
export function membersCsv(rows: readonly MemberExportRow[]): string {
  return toCsv([
    ['First Name', 'Last Name', 'Phone', 'Email', 'Birthday', 'Note', 'Serves', 'Other Meetings', 'Member Since', 'Attended'],
    ...rows.map((r) => [
      r.firstName,
      r.lastName,
      formatPhone(r.phone),
      r.email ?? '',
      usDate(r.dob),
      r.note ?? '',
      r.serves.join(', '),
      r.otherMeetings.join(', '),
      usDate(r.memberSince),
      r.held > 0 ? `${r.attended} of ${r.held}` : '',
    ]),
  ])
}

/**
 * The blank sheet the Import members page hands out. No example row: the
 * children's template had one, and servants copied it in (2026-09-28).
 */
export const MEMBER_TEMPLATE_CSV = toCsv([['First Name', 'Last Name', 'Phone', 'Email', 'Birthday', 'Note']])

/* ── Import members ─────────────────────────────────────────────────────── */

/**
 * The words a servant's own sheet uses for each column, normalised the way
 * `normaliseHeader` reads a heading ("E-mail" is "e mail").
 */
const MEMBER_COLUMNS = {
  name: ['name', 'names', 'full name', 'member', 'member name', 'member s name'],
  firstName: ['first name', 'first', 'firstname', 'given name'],
  lastName: ['last name', 'last', 'lastname', 'surname', 'family name'],
  phone: [
    'phone', 'phone number', 'phone no', 'cell', 'cell phone', 'cell number', 'mobile', 'mobile number', 'mobile phone',
    'telephone', 'tel', 'number', 'contact number', 'whatsapp', 'whatsapp number',
  ],
  email: ['email', 'e mail', 'email address', 'e mail address'],
  birthday: ['birthday', 'birth day', 'birth date', 'birthdate', 'date of birth', 'dob', 'bday'],
  note: ['note', 'notes', 'comment', 'comments'],
} as const satisfies Record<string, readonly string[]>

type MemberColumn = keyof typeof MEMBER_COLUMNS

function columnOf(header: string): MemberColumn | null {
  for (const [col, words] of Object.entries(MEMBER_COLUMNS) as Array<[MemberColumn, readonly string[]]>) {
    if (words.includes(header)) return col
  }
  return null
}

/**
 * Cells copied out of Google Sheets or Excel and pasted arrive with tabs
 * between them; turn them into CSV the reader takes. Only quoting, so nothing
 * typed is changed.
 */
function tabsToCsv(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
    .join('\n')
}

export interface MemberSheetRow {
  /** Its row number in the servant's sheet. */
  row: number
  value?: MemberValue
  problem?: string
}

/**
 * A sheet of members, as the servants keep them: a Name column (or First and
 * Last), and any of phone, email, birthday and note under their usual names.
 * Empty rows and a title above the headings are skipped (the children's
 * import's 2026-09-28 lessons); rows keep the numbers the sheet shows.
 */
export function parseMemberSheet(
  text: string,
  today: string = churchToday(),
): { rows: MemberSheetRow[]; unread: string[]; error?: string } {
  const csv = text.includes('\t') ? tabsToCsv(text) : text
  const { headerRow, headers, records } = parseCsvTable(csv, {
    isHeader: (hs) => hs.some((h) => { const c = columnOf(h); return c === 'name' || c === 'firstName' }),
  })
  const columns = headers.map((h) => columnOf(normaliseHeader(h)))
  const unread = headers.filter((h, i) => h.trim() && !columns[i])
  if (!columns.includes('name') && !columns.includes('firstName')) {
    return { rows: [], unread, error: 'The sheet needs a Name column, or First Name and Last Name.' }
  }
  const cell = (rec: Record<string, string>, col: MemberColumn) => {
    const i = columns.indexOf(col)
    return i < 0 ? '' : (rec[normaliseHeader(headers[i]!)] ?? '').trim()
  }

  const rows: MemberSheetRow[] = []
  const seen = new Map<string, number>()
  records.forEach((rec, i) => {
    const row = headerRow + 1 + i
    if (Object.values(rec).every((v) => !v.trim())) return
    let firstName = cell(rec, 'firstName')
    let lastName = cell(rec, 'lastName')
    if (!firstName && cell(rec, 'name')) ({ firstName, lastName } = splitName(cell(rec, 'name')))
    if (!firstName) return void rows.push({ row, problem: 'No name' })
    const parsed = parseMemberInput(
      { firstName, lastName, phone: cell(rec, 'phone'), email: cell(rec, 'email'), birthday: cell(rec, 'birthday'), note: cell(rec, 'note') },
      today,
    )
    if (!parsed.ok) return void rows.push({ row, problem: parsed.error })
    const key = studentNameKey(parsed.value.firstName, parsed.value.lastName)
    const earlier = seen.get(key)
    if (earlier) return void rows.push({ row, problem: `Listed twice in this sheet (row ${earlier})` })
    seen.set(key, row)
    rows.push({ row, value: parsed.value })
  })
  return { rows, unread }
}

export type MemberRowPlan<T extends Addable = Addable> =
  | { kind: 'new' }
  /** A servant: their login gains a member side. */
  | { kind: 'servant'; person: T }
  /** A member of another meeting joins this one too. */
  | { kind: 'joins'; person: T }
  | { kind: 'already'; person: T }
  | { kind: 'problem'; message: string }

/** What importing one row does, against everyone already in the portal (`knownPeople`). */
export function classifyMemberRow<T extends Addable>(value: MemberValue, people: readonly T[]): MemberRowPlan<T> {
  const matches = samePersonMatches(value, people)
  if (matches.length === 0) return { kind: 'new' }
  if (matches.length > 1) {
    const name = [value.firstName, value.lastName].filter(Boolean).join(' ')
    return { kind: 'problem', message: `${matches.length} people in the portal are called ${name}. Add the right one on Add member.` }
  }
  const person = matches[0]!
  if (person.blocked === ALREADY_MEMBER) return { kind: 'already', person }
  if (person.blocked) return { kind: 'problem', message: `${person.blocked}, so not a member of it` }
  return person.kind === 'servant' ? { kind: 'servant', person } : { kind: 'joins', person }
}
