import { describe, it, expect } from 'vitest'
import {
  generateToken,
  buildTokenPayload,
  parseTokenPayload,
  shortCode,
  normaliseShortCode,
  buildStudentPayload,
  parseStudentPayload,
  isTokenValid,
  secondsLeft,
  expiryFrom,
  canRedeem,
  canMarkServant,
  weekKeyFor,
  attendanceRate,
  rateBand,
  presentStreak,
  GROUP_CODE_TTL_MS,
  MEETING_CODE_TTL_MS,
  type RedeemToken,
  type RedeemUser,
  type SessionWeekRow,
} from '@/lib/portal/qr'

const NOW = new Date('2026-09-20T15:00:00.000Z')
const later = (ms: number) => new Date(NOW.getTime() + ms)

describe('generateToken', () => {
  it('is 32 lower-case hex characters', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{32}$/)
  })
  it('does not repeat', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(generateToken())
    expect(seen.size).toBe(200)
  })
})

describe('buildTokenPayload / parseTokenPayload', () => {
  const token = 'a3f92c1b4d5e6f708192a3b4c5d6e7f8'

  it('builds a root-relative path with no origin', () => {
    expect(buildTokenPayload(token)).toBe(`/portal/scan/${token}`)
  })
  it('builds an absolute URL and trims a trailing slash', () => {
    expect(buildTokenPayload(token, 'https://stkyrillostn.org/')).toBe(`https://stkyrillostn.org/portal/scan/${token}`)
  })
  it('round-trips', () => {
    expect(parseTokenPayload(buildTokenPayload(token, 'https://stkyrillostn.org'))).toBe(token)
  })
  it('reads a bare token, a path, and mixed case', () => {
    expect(parseTokenPayload(token)).toBe(token)
    expect(parseTokenPayload(`/portal/scan/${token}`)).toBe(token)
    expect(parseTokenPayload(token.toUpperCase())).toBe(token)
  })
  it('reads a typed short code with the display dash', () => {
    expect(parseTokenPayload('A3F9-2C1B')).toBe('a3f92c1b')
  })
  it('rejects junk, empty input and non-hex text', () => {
    expect(parseTokenPayload('')).toBeNull()
    expect(parseTokenPayload(null)).toBeNull()
    expect(parseTokenPayload('https://evil.example/portal/scan/../../etc')).toBeNull()
    expect(parseTokenPayload('hello there')).toBeNull()
    expect(parseTokenPayload('abc')).toBeNull()
  })
})

describe('shortCode / normaliseShortCode', () => {
  it('shows the first eight characters, dashed and upper-case', () => {
    expect(shortCode('a3f92c1b4d5e6f708192a3b4c5d6e7f8')).toBe('A3F9-2C1B')
  })
  it('accepts what shortCode printed', () => {
    expect(normaliseShortCode('A3F9-2C1B')).toBe('a3f92c1b')
    expect(normaliseShortCode(' a3f9 2c1b ')).toBe('a3f92c1b')
  })
  it('rejects the wrong length or non-hex', () => {
    expect(normaliseShortCode('A3F9-2C1')).toBeNull()
    expect(normaliseShortCode('ZZZZ-ZZZZ')).toBeNull()
    expect(normaliseShortCode(undefined)).toBeNull()
  })
})

describe('student card payload', () => {
  it('round-trips a 4-digit login id', () => {
    expect(parseStudentPayload(buildStudentPayload('0421'))).toBe('0421')
  })
  it('accepts a bare id typed into the manual fallback', () => {
    expect(parseStudentPayload('0421')).toBe('0421')
  })
  it('rejects anything that is not a 4-digit id', () => {
    expect(parseStudentPayload('SKSS-STU:42')).toBeNull()
    expect(parseStudentPayload('SKSS-STU:abcd')).toBeNull()
    expect(parseStudentPayload('')).toBeNull()
  })
})

describe('isTokenValid / secondsLeft / expiryFrom', () => {
  it('is valid strictly before the expiry', () => {
    expect(isTokenValid({ expiresAt: later(1000) }, NOW)).toBe(true)
    expect(isTokenValid({ expiresAt: NOW }, NOW)).toBe(false)
    expect(isTokenValid({ expiresAt: later(-1) }, NOW)).toBe(false)
  })
  it('counts down and floors at zero', () => {
    expect(secondsLeft(later(90_000), NOW)).toBe(90)
    expect(secondsLeft(later(-90_000), NOW)).toBe(0)
  })
  it('uses the documented time to live', () => {
    expect(expiryFrom(NOW, GROUP_CODE_TTL_MS).getTime() - NOW.getTime()).toBe(300_000)
    expect(expiryFrom(NOW, MEETING_CODE_TTL_MS).getTime() - NOW.getTime()).toBe(600_000)
  })
})

describe('canRedeem', () => {
  const student: RedeemUser = { role: 'STUDENT', studentId: 'stu1', classIds: ['5th-6th-boys'] }
  const servant: RedeemUser = { role: 'SERVANT', servantId: 'svc1', classIds: ['5th-6th-boys'] }
  const groupToken: RedeemToken = {
    kind: 'STUDENT_ATTENDANCE',
    classIds: ['5th-6th-boys'],
    expiresAt: later(GROUP_CODE_TTL_MS),
  }
  const meetingToken: RedeemToken = { kind: 'SERVANT_MEETING', classIds: [], expiresAt: later(MEETING_CODE_TTL_MS) }

  it('lets a student of a listed class redeem a group code', () => {
    expect(canRedeem(student, groupToken, NOW)).toBeNull()
  })
  it('refuses an expired code before anything else', () => {
    expect(canRedeem(student, { ...groupToken, expiresAt: later(-1) }, NOW)).toMatch(/expired/i)
  })
  it('refuses a student from another class', () => {
    expect(canRedeem({ ...student, classIds: ['pre-k'] }, groupToken, NOW)).toMatch(/different class/i)
  })
  it('refuses a servant holding a student code', () => {
    expect(canRedeem(servant, groupToken, NOW)).toMatch(/scan your card/i)
  })
  it('allows any class when the code lists none', () => {
    expect(canRedeem({ ...student, classIds: ['pre-k'] }, { ...groupToken, classIds: [] }, NOW)).toBeNull()
  })
  it('gates the servants-meeting code on role, not on holding the URL', () => {
    expect(canRedeem(servant, meetingToken, NOW)).toBeNull()
    expect(canRedeem(student, meetingToken, NOW)).toMatch(/servants only/i)
  })
  it('refuses a servants-meeting code to an account with no servant profile', () => {
    expect(canRedeem({ role: 'ADMIN', classIds: [] }, meetingToken, NOW)).toMatch(/servant profile/i)
  })
  it('treats point codes exactly like attendance codes', () => {
    expect(canRedeem(student, { ...groupToken, kind: 'STUDENT_POINTS' }, NOW)).toBeNull()
    expect(canRedeem({ ...student, classIds: ['pre-k'] }, { ...groupToken, kind: 'STUDENT_POINTS' }, NOW)).toMatch(/different class/i)
  })
})

describe('weekKeyFor', () => {
  it('returns the Monday of the week', () => {
    expect(weekKeyFor('2026-09-20')).toBe('2026-09-14') // a Sunday
    expect(weekKeyFor('2026-09-14')).toBe('2026-09-14')
    expect(weekKeyFor('2026-09-18')).toBe('2026-09-14')
  })
})

describe('attendanceRate', () => {
  const rows = (list: Array<[string, string, SessionWeekRow['status']]>): SessionWeekRow[] =>
    list.map(([sessionKey, week, status]) => ({ sessionKey, week, status }))

  it('is null when nothing was held', () => {
    expect(attendanceRate([])).toEqual({ attended: 0, held: 0, rate: null })
  })
  it('counts a session held once per week', () => {
    const r = attendanceRate(rows([
      ['sunday', '2026-09-07', 'PRESENT'],
      ['sunday', '2026-09-14', 'ABSENT'],
      ['sunday', '2026-09-21', 'PRESENT'],
    ]))
    expect(r).toEqual({ attended: 2, held: 3, rate: 67 })
  })
  it('does not double-count two rows for the same session and week', () => {
    const r = attendanceRate(rows([
      ['sunday', '2026-09-07', 'ABSENT'],
      ['sunday', '2026-09-07', 'PRESENT'],
    ]))
    expect(r).toEqual({ attended: 1, held: 1, rate: 100 })
  })
  it('an excused absence breaks nothing — it leaves the rate untouched', () => {
    const r = attendanceRate(rows([
      ['sunday', '2026-09-07', 'PRESENT'],
      ['sunday', '2026-09-14', 'EXCUSED'],
    ]))
    expect(r).toEqual({ attended: 1, held: 1, rate: 100 })
  })
  it('counts a week held for the class with no row of mine as an absence', () => {
    const r = attendanceRate(rows([
      ['sunday', '2026-09-07', 'PRESENT'],
      ['sunday', '2026-09-14', null],
    ]))
    expect(r).toEqual({ attended: 1, held: 2, rate: 50 })
  })
  it('keeps sessions apart', () => {
    const r = attendanceRate(rows([
      ['sunday', '2026-09-07', 'PRESENT'],
      ['vespers', '2026-09-07', 'ABSENT'],
    ]))
    expect(r).toEqual({ attended: 1, held: 2, rate: 50 })
  })
})

describe('rateBand', () => {
  it('uses the prototype bands', () => {
    expect(rateBand(100)).toBe('excellent')
    expect(rateBand(80)).toBe('excellent')
    expect(rateBand(79)).toBe('can-do-better')
    expect(rateBand(50)).toBe('can-do-better')
    expect(rateBand(49)).toBe('needs-attention')
    expect(rateBand(null)).toBe('none')
  })
})

describe('presentStreak', () => {
  it('counts back from the most recent week', () => {
    expect(presentStreak([
      { week: '2026-09-07', attended: false },
      { week: '2026-09-14', attended: true },
      { week: '2026-09-21', attended: true },
    ])).toBe(2)
  })
  it('is zero when the latest week was missed, whatever the order of input', () => {
    expect(presentStreak([
      { week: '2026-09-21', attended: false },
      { week: '2026-09-14', attended: true },
    ])).toBe(0)
  })
  it('is zero with no weeks', () => {
    expect(presentStreak([])).toBe(0)
  })
})

describe('canMarkServant', () => {
  const base = { targetServantId: 'svc2', scopeServantIds: ['svc2', 'svc3'] }

  it('lets an admin mark anyone', () => {
    expect(canMarkServant({ ...base, role: 'ADMIN', isCoordinator: false, hasStageOversight: false })).toBeNull()
  })
  it('lets a servant mark themselves even outside any scope', () => {
    expect(canMarkServant({
      ...base,
      role: 'SERVANT',
      servantId: 'svc9',
      targetServantId: 'svc9',
      scopeServantIds: [],
      isCoordinator: false,
      hasStageOversight: false,
    })).toBeNull()
  })
  it('lets a coordinator mark a servant in scope', () => {
    expect(canMarkServant({ ...base, role: 'SERVANT', servantId: 'svc1', isCoordinator: true, hasStageOversight: false })).toBeNull()
  })
  it('lets a stage overseer mark a servant in scope', () => {
    expect(canMarkServant({ ...base, role: 'SERVANT', servantId: 'svc1', isCoordinator: false, hasStageOversight: true })).toBeNull()
  })
  // The prototype had no gate at all: whoever ran the meeting marked the room.
  // The church asked for that back, so a plain servant may mark a colleague —
  // the only limit is that the colleague is on their own grid.
  it('lets a plain servant mark a colleague in scope', () => {
    expect(canMarkServant({ ...base, role: 'SERVANT', servantId: 'svc1', isCoordinator: false, hasStageOversight: false }))
      .toBeNull()
  })
  it('still refuses any servant reaching outside their own scope', () => {
    expect(canMarkServant({
      ...base,
      role: 'SERVANT',
      servantId: 'svc1',
      targetServantId: 'svc99',
      isCoordinator: false,
      hasStageOversight: false,
    })).toMatch(/outside the classes/i)
    expect(canMarkServant({
      ...base,
      role: 'SERVANT',
      servantId: 'svc1',
      targetServantId: 'svc99',
      isCoordinator: true,
      hasStageOversight: false,
    })).toMatch(/outside the classes/i)
  })
  it('refuses a pastor and a student', () => {
    expect(canMarkServant({ ...base, role: 'PASTOR', isCoordinator: false, hasStageOversight: false })).toMatch(/servants and admins/i)
    expect(canMarkServant({ ...base, role: 'STUDENT', isCoordinator: false, hasStageOversight: false })).toMatch(/servants and admins/i)
  })
})
