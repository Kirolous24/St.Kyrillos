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
export function absenceStreakAgainst(heldDates: readonly string[], history: readonly HistoryRow[]): number {
  if (history.length === 0) return 0
  const best = new Map<string, Status>()
  let first = history[0].date
  for (const row of history) {
    if (row.date < first) first = row.date
    const prev = best.get(row.date)
    if (!prev || RANK[row.status] > RANK[prev]) best.set(row.date, row.status)
  }
  const dates = new Set(Array.from(best.keys()))
  for (const date of heldDates) if (date >= first) dates.add(date)
  return absenceStreak(Array.from(dates).map((date) => ({ date, status: best.get(date) ?? 'ABSENT' })))
}

const RANK: Record<Status, number> = { PRESENT: 3, EXCUSED: 2, ABSENT: 1 }

export type FollowUpDecision = 'open' | 'close' | 'none'

export function decideFollowUp(input: {
  streak: number
  threshold: number
  hasOpenAutoCase: boolean
}): FollowUpDecision {
  if (input.hasOpenAutoCase) return input.streak === 0 ? 'close' : 'none'
  return input.streak >= Math.max(1, input.threshold) ? 'open' : 'none'
}

// There is no attendanceRate() here. A student's own attendance rows can
// never prove which sessions were *held but missed entirely* — that only
// shows up in the class-wide record. Use lib/portal/reports.ts's
// roster-aware attendanceRate(rows, { occasions, studentIds }) instead, the
// same one the official Reports page uses, so every surface agrees.
