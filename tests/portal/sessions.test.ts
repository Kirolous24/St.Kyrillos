import { describe, it, expect } from 'vitest'
import { STANDARD_SESSIONS, isStandardSession, standardSessionLabel } from '@/lib/portal/sessions'

/**
 * F0845 / F0670 — the six the church always runs are named and undeletable;
 * anything an admin adds can be renamed, and deleted while it is still unused.
 */
describe('standard sessions', () => {
  it('covers the six the church runs', () => {
    expect(STANDARD_SESSIONS.map((s) => s.label)).toEqual([
      'Sunday School', 'Liturgy', 'Vespers', 'Tasbeha', 'Bible Study', 'Hymns',
    ])
  })

  it('locks every standard key', () => {
    for (const s of STANDARD_SESSIONS) {
      expect(isStandardSession(s.key)).toBe(true)
      expect(standardSessionLabel(s.key)).toBe(s.label)
    }
  })

  it('leaves an admin-added session free', () => {
    expect(isStandardSession('youth-meeting')).toBe(false)
    expect(standardSessionLabel('youth-meeting')).toBeNull()
  })

  it("includes the one key the portal reads by name", () => {
    // followup-sync, the class stat cards and the QR check-in all hardcode
    // 'sunday'; renaming it would leave all three mislabelled.
    expect(isStandardSession('sunday')).toBe(true)
    expect(standardSessionLabel('sunday')).toBe('Sunday School')
  })
})
