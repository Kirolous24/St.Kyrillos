// Check-in rules: QR token payloads, token validity, redemption eligibility and
// the attendance maths behind "My Attendance" and the servants' grid.
//
// Deliberately pure — no Prisma, no React, no node built-ins — so the rules can
// be unit tested and imported from both server actions and client components.
// Token strings are minted with Web Crypto (available in Node 18+ and the
// browser); the prototype's `Math.random() + Date.now()` is NOT ported.

import { mondayOf } from './dates'

export type QrKind = 'STUDENT_ATTENDANCE' | 'STUDENT_POINTS' | 'SERVANT_MEETING'
export type CheckInStatus = 'PRESENT' | 'EXCUSED' | 'ABSENT'
export type PortalRoleName = 'STUDENT' | 'SERVANT' | 'ADMIN' | 'PASTOR'

/** Group codes live 5 minutes; servants-meeting codes 10 (ANALYSIS §4). */
export const GROUP_CODE_TTL_MS = 5 * 60 * 1000
export const MEETING_CODE_TTL_MS = 10 * 60 * 1000

const HEX = '0123456789abcdef'
const TOKEN_RE = /^[0-9a-f]{8,64}$/
const SCAN_PATH_RE = /\/portal\/scan\/([0-9a-fA-F]{8,64})/
const STUDENT_ID_RE = /^\d{4}$/

export const STUDENT_PAYLOAD_PREFIX = 'SKSS-STU:'

/** 128 bits of CSPRNG entropy, hex encoded. */
export function generateToken(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX[(b >> 4) & 0xf]! + HEX[b & 0xf]!
  }
  return out
}

/** What the QR encodes. Absolute when an origin is known, else root-relative. */
export function buildTokenPayload(token: string, origin?: string | null): string {
  const path = `/portal/scan/${token}`
  if (!origin) return path
  return `${origin.replace(/\/+$/, '')}${path}`
}

/**
 * Accepts a scanned URL, a pasted path, or a typed code (with or without the
 * display dash) and returns the canonical lower-case token, or null.
 */
export function parseTokenPayload(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  const matched = SCAN_PATH_RE.exec(value)
  const candidate = (matched ? matched[1]! : value).replace(/[\s-]/g, '').toLowerCase()
  return TOKEN_RE.test(candidate) ? candidate : null
}

/** The human-typable prefix shown under the QR: "A3F9-2C1B". */
export function shortCode(token: string): string {
  const head = token.slice(0, 8).toUpperCase()
  return head.length === 8 ? `${head.slice(0, 4)}-${head.slice(4)}` : head
}

/** Normalise a typed short code to the 8 hex chars a token starts with. */
export function normaliseShortCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.trim().replace(/[\s-]/g, '').toLowerCase()
  return /^[0-9a-f]{8}$/.test(cleaned) ? cleaned : null
}

/** A student's personal card payload — their 4-digit portal ID, namespaced. */
export function buildStudentPayload(loginId: string): string {
  return `${STUDENT_PAYLOAD_PREFIX}${loginId}`
}

/** Reads a student card, or a bare 4-digit ID typed into the manual fallback. */
export function parseStudentPayload(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  const prefixed = value.toUpperCase().startsWith(STUDENT_PAYLOAD_PREFIX)
    ? value.slice(STUDENT_PAYLOAD_PREFIX.length).trim()
    : value
  return STUDENT_ID_RE.test(prefixed) ? prefixed : null
}

export interface ExpiringToken {
  expiresAt: Date
}

export function isTokenValid(token: ExpiringToken, now: Date = new Date()): boolean {
  return token.expiresAt.getTime() > now.getTime()
}

export function secondsLeft(expiresAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000))
}

export function expiryFrom(now: Date, ttlMs: number): Date {
  return new Date(now.getTime() + ttlMs)
}

export interface RedeemUser {
  role: PortalRoleName
  studentId?: string
  servantId?: string
  classIds: string[]
}

export interface RedeemToken {
  kind: QrKind
  classIds: string[]
  expiresAt: Date
}

/**
 * Why this user may NOT redeem this token, or null when they may.
 * Holding the URL is never enough: every code is bound to a kind, a class list
 * and an expiry, and the caller must already be a signed-in portal user.
 */
export function canRedeem(user: RedeemUser, token: RedeemToken, now: Date = new Date()): string | null {
  if (!isTokenValid(token, now)) return 'This code has expired. Ask for a fresh one.'

  if (token.kind === 'SERVANT_MEETING') {
    if (user.role === 'STUDENT') return 'This code is for servants only.'
    if (!user.servantId) return 'Your account is not linked to a servant profile, so it cannot check in here.'
    return null
  }

  if (!user.studentId) return 'This code checks students in. Ask a servant to scan your card instead.'
  if (token.classIds.length > 0 && !token.classIds.some((id) => user.classIds.includes(id))) {
    return 'This code is for a different class.'
  }
  return null
}

/** Monday of the week a date-only string falls in — the ServantAttendance key. */
export function weekKeyFor(dateStr: string): string {
  return mondayOf(dateStr)
}

export interface SessionWeekRow {
  sessionKey: string
  /** Monday of the week the session was held. */
  week: string
  /** null = the session was held for the class but this person has no row. */
  status: CheckInStatus | null
}

const STATUS_RANK: Record<string, number> = { PRESENT: 3, EXCUSED: 2, ABSENT: 1 }

/**
 * ANALYSIS §5: a session counts as "held" in a week when any attendance row
 * exists for it that week; the person is present when their own row says
 * PRESENT; an excused absence breaks nothing (it leaves the rate untouched);
 * anything else is an absence. Rate = attended / held.
 */
export function attendanceRate(rows: SessionWeekRow[]): { attended: number; held: number; rate: number | null } {
  const best = new Map<string, CheckInStatus | null>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const key = `${row.sessionKey}|${row.week}`
    const current = best.get(key)
    if (current === undefined) {
      best.set(key, row.status)
      continue
    }
    const rank = row.status ? STATUS_RANK[row.status]! : 0
    const currentRank = current ? STATUS_RANK[current]! : 0
    if (rank > currentRank) best.set(key, row.status)
  }

  let attended = 0
  let held = 0
  best.forEach((status) => {
    if (status === 'EXCUSED') return
    held += 1
    if (status === 'PRESENT') attended += 1
  })
  return { attended, held, rate: held === 0 ? null : Math.round((attended / held) * 100) }
}

export type RateBand = 'excellent' | 'can-do-better' | 'needs-attention' | 'none'

/** Bands from ANALYSIS §5: ≥80 excellent, ≥50 can do better. */
export function rateBand(rate: number | null): RateBand {
  if (rate === null) return 'none'
  if (rate >= 80) return 'excellent'
  if (rate >= 50) return 'can-do-better'
  return 'needs-attention'
}

export const RATE_BAND_LABEL: Record<RateBand, string> = {
  excellent: 'Excellent',
  'can-do-better': 'Can do better',
  'needs-attention': 'Needs attention',
  none: 'Nothing held yet',
}

export const RATE_BAND_TONE: Record<RateBand, 'good' | 'warn' | 'bad' | 'neutral'> = {
  excellent: 'good',
  'can-do-better': 'warn',
  'needs-attention': 'bad',
  none: 'neutral',
}

/** Consecutive most-recent weeks attended, newest first after sorting. */
export function presentStreak(weeks: Array<{ week: string; attended: boolean }>): number {
  const sorted = [...weeks].sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0))
  let streak = 0
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i]!.attended) break
    streak += 1
  }
  return streak
}

export interface MarkServantInput {
  role: PortalRoleName
  servantId?: string
  isCoordinator: boolean
  hasStageOversight: boolean
  targetServantId: string
  /** Servants the actor may see for this week's grid. */
  scopeServantIds: string[]
}

/**
 * Who may write a ServantAttendance row: an admin, or any servant — for
 * themselves or for a colleague who is on screen.
 *
 * The prototype had no gate here at all: whoever ran the meeting marked the
 * room. The port narrowed that to coordinators and stage overseers, which read
 * as sensible least privilege but meant that if the person actually running
 * Sunday was not flagged as a coordinator, nobody could record the team. The
 * church asked for the open rule back.
 *
 * The scope check stays, and is now the only limit on a servant: they may mark
 * the people their own grid shows them (their classes, or the stage they
 * oversee), not any servant in the church. Marking yourself always works, even
 * outside every scope, so a servant with no class can still record themselves.
 */
export function canMarkServant(input: MarkServantInput): string | null {
  if (input.role === 'ADMIN') return null
  if (input.servantId && input.servantId === input.targetServantId) return null
  if (input.role !== 'SERVANT') return 'Only servants and admins can record servant attendance.'
  if (!input.scopeServantIds.includes(input.targetServantId)) {
    return 'That servant is outside the classes you serve.'
  }
  return null
}
