// The six attendance sessions the church actually runs, and what may be changed
// about them.
//
// F0845 — these names are the church's fixed vocabulary, and one of them is
// wired in by name rather than by label: `sessionKey: 'sunday'` decides which
// absences open a follow-up (lib/portal/followup-sync.ts), which figure the
// class stat cards show, and how the QR check-in awards Sunday points. Renaming
// "Sunday School" to anything else would leave every one of those reading a
// label that no longer matches the thing it measures, while nobody has a reason
// to rename it. So the label is locked; the points, the icon and whether the
// session still runs stay editable, because those are the things that do change
// from year to year.

export const STANDARD_SESSIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'sunday', label: 'Sunday School' },
  { key: 'liturgy', label: 'Liturgy' },
  { key: 'vespers', label: 'Vespers' },
  { key: 'tasbeha', label: 'Tasbeha' },
  { key: 'bible', label: 'Bible Study' },
  { key: 'hymns', label: 'Hymns' },
]

const STANDARD_BY_KEY = new Map(STANDARD_SESSIONS.map((s) => [s.key, s.label]))

/** True for one of the six the church always runs. */
export function isStandardSession(key: string): boolean {
  return STANDARD_BY_KEY.has(key)
}

/** The locked name for a standard session, or null for an admin-added one. */
export function standardSessionLabel(key: string): string | null {
  return STANDARD_BY_KEY.get(key) ?? null
}
