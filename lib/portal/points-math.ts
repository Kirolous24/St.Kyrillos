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
