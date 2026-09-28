export interface RankInput {
  studentId: string
  name: string
  total: number
}

export interface RankedRow extends RankInput {
  rank: number
}

/** Competition ranking ("1, 2, 2, 4"), ties broken by name for display only. */
export function rankStudents(rows: RankInput[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const out: RankedRow[] = []
  for (let i = 0; i < sorted.length; i++) {
    const prev = out[i - 1]
    const rank = prev && prev.total === sorted[i].total ? prev.rank : i + 1
    out.push({ ...sorted[i], rank })
  }
  return out
}

export interface UndoCandidate {
  source: 'ATTENDANCE' | 'MANUAL' | 'QUIZ' | 'UNDO' | 'QR'
  undone: boolean
  undoOfId: string | null
}

/** Attendance points follow the attendance record; undo entries are final. */
export function canUndo(entry: UndoCandidate): boolean {
  if (entry.undone) return false
  if (entry.source === 'UNDO' || entry.undoOfId) return false
  if (entry.source === 'ATTENDANCE') return false
  return true
}

/**
 * §5: a single deduction is capped at what the student actually has — a servant
 * taking 50 points off a child with 6 must not push them to -44, because the
 * level thresholds read the running total over the student's whole history.
 * A bulk deduction across a class is deliberately not capped.
 *
 * Returns the number of points to write: 0 when there is nothing left to take.
 */
export function capDeduction(points: number, balance: number): number {
  if (points >= 0) return points
  const floor = Math.max(0, balance)
  return floor === 0 ? 0 : Math.max(points, -floor)
}

/**
 * Points are the same in every class (2026-09-27). Taking points away costs
 * this much for any reason, so a child's total means the same thing whichever
 * class they are in, and the church-wide leaderboard is fair.
 */
export const DEDUCTION_POINTS = 2

/** The range an admin may set a church-wide activity to. */
export const ACTIVITY_POINTS_MIN = 1
export const ACTIVITY_POINTS_MAX = 100

export interface GiveActivity {
  classId: string | null
  isActive: boolean
  points: number
  key: string
  label: string
}

export type ManualPoints =
  | { ok: true; points: number; activityKey: string; label: string; reason: string | null }
  | { ok: false; error: string }

/**
 * What a servant's Give or Remove writes to the ledger.
 *
 * - **Give:** an activity at its set value: a church-wide one, or one of the
 *   class's own (2026-09-28: the church let classes count their own way again,
 *   each class setting its own activities and values). Never another class's.
 * - **Remove:** always DEDUCTION_POINTS, and only with a reason.
 *
 * No amount typed on the page is ever used: the value is the activity's.
 */
export function resolveManualPoints(
  mode: 'add' | 'remove',
  activity: GiveActivity | null,
  reasonRaw: string | undefined,
  classId: string,
): ManualPoints {
  const reason = (reasonRaw ?? '').trim()
  if (mode === 'remove') {
    if (!reason) return { ok: false, error: 'Pick a reason before taking points away.' }
    // The reason is the row: a deduction written under an activity's name reads
    // as points given for it. The ledger label caps at 80; a longer reason
    // keeps its full text alongside.
    return {
      ok: true,
      points: -DEDUCTION_POINTS,
      activityKey: 'manual_remove',
      label: reason.slice(0, 80),
      reason: reason.length > 80 ? reason : null,
    }
  }
  const usable = activity && activity.isActive && activity.points > 0 && (activity.classId === null || activity.classId === classId)
  if (!activity || !usable) {
    return { ok: false, error: 'Pick one of the activities on the list.' }
  }
  return { ok: true, points: activity.points, activityKey: activity.key, label: activity.label, reason: reason || null }
}
