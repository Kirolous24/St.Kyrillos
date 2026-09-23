// Follow-up rule from the prototype, made explicit: count consecutive
// unexcused absences from the most recent Sunday School session backward.
// An excused absence breaks the streak; an attended session resets it.

export type Status = 'PRESENT' | 'EXCUSED' | 'ABSENT'

export interface HistoryRow {
  date: string // YYYY-MM-DD
  status: Status
}

export function absenceStreak(history: HistoryRow[]): number {
  const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  let streak = 0
  for (const row of sorted) {
    if (row.status === 'ABSENT') streak += 1
    else break
  }
  return streak
}

/**
 * The same streak, scored against the sessions the class actually held.
 *
 * A student's own rows can never prove which sessions they missed entirely:
 * the QR flows only ever write a row for the people who scanned, so a child who
 * stops coming simply stops appearing and `absenceStreak` over their own rows
 * stays at zero forever. A held date with no row for them is an unexcused
 * absence, exactly as the Reports page already scores it.
 *
 * Dates before the student's first recorded session are ignored — a child who
 * joined in March has not missed the autumn.
 */
/**
 * Every occasion that counts against this student, newest first, with a missing
 * row read as an absence.
 *
 * Shared by the streak and by `latestHeldStatus` so the two can never disagree
 * about which Sunday was the most recent one or what happened on it.
 */
function scoredOccasions(
  heldDates: readonly string[],
  history: readonly HistoryRow[],
  since?: string,
): HistoryRow[] {
  const best = new Map<string, Status>()
  let first: string | undefined
  for (const row of history) {
    if (first === undefined || row.date < first) first = row.date
    const prev = best.get(row.date)
    if (!prev || RANK[row.status] > RANK[prev]) best.set(row.date, row.status)
  }
  // Anchor on whichever came first: joining, or their earliest recorded session.
  const anchor = since !== undefined && (first === undefined || since < first) ? since : first
  if (anchor === undefined) return []
  const dates = new Set(Array.from(best.keys()))
  for (const date of heldDates) if (date >= anchor) dates.add(date)
  return Array.from(dates)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((date) => ({ date, status: best.get(date) ?? ('ABSENT' as Status) }))
}

export function absenceStreakAgainst(
  heldDates: readonly string[],
  history: readonly HistoryRow[],
  /**
   * The day the student joined (YYYY-MM-DD). Without it a student who has
   * never been marked at all scores zero forever and can never raise a case —
   * which is how the ported rule silently lost the prototype's
   * "No attendance recorded" cases. With it, every session the class held
   * since they joined counts against them, which is what the prototype did.
   */
  since?: string,
): number {
  return absenceStreak(scoredOccasions(heldDates, history, since))
}

/**
 * F0462 — the child's mark at the most recent Sunday the class actually held,
 * or null when there is nothing to score against yet.
 *
 * This exists because "the absence streak is zero" does not mean "the child came
 * back". `absenceStreak` stops at anything that is not ABSENT, and EXCUSED is not
 * ABSENT — so a child marked excused, meaning **not in the room**, scored zero and
 * had their visitation case closed with "attending_again" and a note reading
 * "Back on <date>". That is a false statement written into a child's pastoral
 * record, and it is the very defect this finding was raised about in the
 * prototype. Closing now needs positive evidence, not merely the absence of
 * evidence.
 */
export function latestHeldStatus(
  heldDates: readonly string[],
  history: readonly HistoryRow[],
  since?: string,
): Status | null {
  return scoredOccasions(heldDates, history, since)[0]?.status ?? null
}

const RANK: Record<Status, number> = { PRESENT: 3, EXCUSED: 2, ABSENT: 1 }

export type FollowUpDecision = 'open' | 'close' | 'none'

export function decideFollowUp(input: {
  streak: number
  threshold: number
  hasOpenAutoCase: boolean
  /**
   * F0462 — the child's mark at the most recent Sunday the class held. An open
   * case is only closed when this says PRESENT: the child has to have actually
   * been seen. A zero streak on its own is satisfied by an EXCUSED mark, which
   * means the opposite — they were not there, and somebody knew why.
   */
  latestHeld: Status | null
}): FollowUpDecision {
  if (input.hasOpenAutoCase) {
    return input.streak === 0 && input.latestHeld === 'PRESENT' ? 'close' : 'none'
  }
  return input.streak >= Math.max(1, input.threshold) ? 'open' : 'none'
}

// There is no attendanceRate() here. A student's own attendance rows can
// never prove which sessions were *held but missed entirely* — that only
// shows up in the class-wide record.
//
// Two implementations exist, and the difference is what they are handed rather
// than what they believe:
//   - lib/portal/reports.ts attendanceRate(rows, { occasions, studentIds }) —
//     roster-aware, used by the Reports pages and the report card.
//   - lib/portal/qr.ts attendanceRate(rows) — scores a list of (session, week)
//     cells that the caller has already built, used by the servant grid and by
//     a child's own My Attendance page.
// Both drop EXCUSED from the denominator, and My Attendance builds its cells
// from a class-wide groupBy first, so a held Sunday with no row for that child
// still counts against them. An earlier version of this comment claimed one
// function served every surface; it does not, and saying so hid the fact that a
// caller who builds its own cells carries the roster-awareness itself.

/**
 * Attendance cannot be taken for a day that has not happened yet.
 *
 * The prototype pinned `max=today` on its date input. The port dropped the
 * guard on both sides, and a future register is not merely untidy: any date
 * with a row counts as a session the class "held", so one future save
 * permanently depresses every attendance rate in the class.
 *
 * Both arguments are YYYY-MM-DD in the church's timezone, so a string
 * comparison is a calendar-day comparison.
 */
export function isFutureDate(date: string, today: string): boolean {
  return date > today
}



/* ── What a save would change ─────────────────────────────────────────────── */

export type MarkStatus = 'PRESENT' | 'EXCUSED' | 'ABSENT'

export interface MarkInput {
  studentId: string
  name: string
  status: MarkStatus
  reason?: string | null
}

export interface StoredMark {
  studentId: string
  status: MarkStatus
  reason?: string | null
  /** Points actually awarded for this record, if any are live. */
  awarded?: number | null
}

export interface MarkChange {
  studentId: string
  name: string
  from: MarkStatus | null
  to: MarkStatus
  /** Points the student gains or loses. */
  delta: number
}

export interface AttendanceChanges {
  gains: MarkChange[]
  losses: MarkChange[]
  /** Status unchanged, excuse reason edited — a real change with no point effect. */
  reasonOnly: MarkChange[]
  changed: number
  netPoints: number
  /** Nothing stored yet and every mark is ABSENT: almost always a mis-click. */
  createsEmptyRegister: boolean
}

/**
 * What pressing Save would actually do.
 *
 * The prototype confirmed first, naming who gains and who loses points, and
 * refused when nothing had changed. The port saved straight away, so a servant
 * could not tell a real save from a stray tap — and taking a student off
 * PRESENT silently reverses the points they were given, which is the part
 * nobody expects.
 *
 * A loss uses the points actually awarded where they are known, not the
 * session's current value: if an admin changed a session from 5 points to 2,
 * reversing an old award takes back the 5 that were really given.
 */
export function attendanceChanges(input: {
  marks: readonly MarkInput[]
  existing: readonly StoredMark[]
  sessionPoints: number
}): AttendanceChanges {
  const stored = new Map(input.existing.map((e) => [e.studentId, e]))
  const gains: MarkChange[] = []
  const losses: MarkChange[] = []
  const reasonOnly: MarkChange[] = []

  for (const m of input.marks) {
    const before = stored.get(m.studentId)
    const from = before?.status ?? null
    if (from === m.status) {
      const wasReason = (before?.reason ?? null) || null
      const nowReason = (m.reason ?? null) || null
      if (wasReason !== nowReason) {
        reasonOnly.push({ studentId: m.studentId, name: m.name, from, to: m.status, delta: 0 })
      }
      continue
    }
    if (m.status === 'PRESENT') {
      gains.push({ studentId: m.studentId, name: m.name, from, to: m.status, delta: input.sessionPoints })
    } else if (from === 'PRESENT') {
      const awarded = before?.awarded ?? input.sessionPoints
      losses.push({ studentId: m.studentId, name: m.name, from, to: m.status, delta: -awarded })
    } else {
      // ABSENT <-> EXCUSED: a real change to the register, no points either way.
      reasonOnly.push({ studentId: m.studentId, name: m.name, from, to: m.status, delta: 0 })
    }
  }

  const changed = gains.length + losses.length + reasonOnly.length
  return {
    gains,
    losses,
    reasonOnly,
    changed,
    netPoints: [...gains, ...losses].reduce((n, c) => n + c.delta, 0),
    createsEmptyRegister:
      input.existing.length === 0 && input.marks.length > 0 && input.marks.every((m) => m.status === 'ABSENT'),
  }
}
