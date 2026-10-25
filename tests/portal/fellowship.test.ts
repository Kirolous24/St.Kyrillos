import { describe, it, expect } from 'vitest'
import {
  FELLOWSHIP_THRESHOLD,
  KID_STAGES,
  checkInLabels,
  isFellowship,
  isMemberLoginId,
  meetingSessionKey,
  memberLoginId,
  selfCheckInDecision,
} from '@/lib/portal/fellowship'
import { LOGIN_ID_RE } from '@/lib/portal/login'
import { can, type PortalUser } from '@/lib/portal/permissions'
import { STAGE_LABEL } from '@/lib/portal/format'

// 2026-10-24 — Fellowship meetings (Women's, Men's, Youth): members instead of
// students, attendance and follow-ups, no points.

describe('the Fellowship bracket', () => {
  it('is its own stage, beside the three age groups', () => {
    expect(isFellowship('FELLOWSHIP')).toBe(true)
    for (const stage of KID_STAGES) expect(isFellowship(stage)).toBe(false)
    expect(isFellowship(null)).toBe(false)
    expect(STAGE_LABEL.FELLOWSHIP).toBe('Fellowship')
  })

  it('follows up after two missed meetings unless the admin changes it', () => {
    expect(FELLOWSHIP_THRESHOLD).toBe(2)
  })

  it("names each meeting's own register after the meeting", () => {
    expect(meetingSessionKey('mens-meeting')).toBe('fellowship-mens-meeting')
  })
})

describe('a member who does not serve has no way to sign in', () => {
  it('gets an ID that the sign-in form can never accept', () => {
    for (let i = 0; i < 50; i++) {
      const id = memberLoginId()
      expect(id).toMatch(/^member-[0-9a-f]{20}$/)
      expect(LOGIN_ID_RE.test(id)).toBe(false)
      expect(isMemberLoginId(id)).toBe(true)
    }
    expect(isMemberLoginId('1234')).toBe(false)
  })

  it('never gets the same ID twice', () => {
    const ids = new Set(Array.from({ length: 200 }, () => memberLoginId()))
    expect(ids.size).toBe(200)
  })
})

describe('the names a phone sees on the check-in page', () => {
  it('is first name and last initial', () => {
    const labels = checkInLabels([
      { id: 'a', firstName: 'Mina', lastName: 'Testwell' },
      { id: 'b', firstName: 'Mary', lastName: 'Sampleton' },
    ])
    expect(labels.get('a')).toBe('Mina T.')
    expect(labels.get('b')).toBe('Mary S.')
  })

  it('spells out the last name when two people would look the same', () => {
    const labels = checkInLabels([
      { id: 'a', firstName: 'Mina', lastName: 'Testwell' },
      { id: 'b', firstName: 'Mina', lastName: 'Testwood' },
      { id: 'c', firstName: 'Mark', lastName: 'Tolbert' },
    ])
    expect(labels.get('a')).toBe('Mina Testwell')
    expect(labels.get('b')).toBe('Mina Testwood')
    expect(labels.get('c')).toBe('Mark T.')
  })

  it('keeps two people with one full name apart', () => {
    const labels = checkInLabels([
      { id: 'a', firstName: 'Mina', lastName: 'Testwell' },
      { id: 'b', firstName: 'Mina', lastName: 'Testwell' },
    ])
    expect(new Set(labels.values()).size).toBe(2)
  })

  it('shows a first name alone when there is no last name', () => {
    expect(checkInLabels([{ id: 'a', firstName: 'Abanoub', lastName: '' }]).get('a')).toBe('Abanoub')
  })
})

describe('one phone checks in one person per code', () => {
  const mina = 'acc-mina'
  const mary = 'acc-mary'

  it('checks in the first name a phone taps', () => {
    expect(selfCheckInDecision({ accountId: mina, device: 'd1', redemptions: [], present: false })).toBe('ok')
  })

  it('says "already" when the same phone taps the same name again', () => {
    expect(
      selfCheckInDecision({ accountId: mina, device: 'd1', redemptions: [{ accountId: mina, device: 'd1' }], present: true }),
    ).toBe('already')
  })

  it('refuses a second name from a phone that already checked someone in', () => {
    expect(
      selfCheckInDecision({ accountId: mary, device: 'd1', redemptions: [{ accountId: mina, device: 'd1' }], present: false }),
    ).toBe('phone-used')
  })

  it('says "already" when a servant or another phone already marked them present', () => {
    expect(selfCheckInDecision({ accountId: mary, device: 'd2', redemptions: [], present: true })).toBe('already')
    expect(
      selfCheckInDecision({ accountId: mary, device: 'd2', redemptions: [{ accountId: mary, device: 'd3' }], present: true }),
    ).toBe('already')
  })
})

describe('no points in a meeting', () => {
  const servant: PortalUser = {
    accountId: 'acc-sv', role: 'SERVANT', displayName: 'Servant', servantId: 'sv',
    classIds: ['mens-meeting'], coordinatorOf: ['mens-meeting'], assistantOf: [], stageOversight: null,
    fellowshipClassIds: ['mens-meeting'],
  }
  const admin: PortalUser = { ...servant, accountId: 'acc-ad', role: 'ADMIN', servantId: undefined, classIds: [], coordinatorOf: [], fellowshipClassIds: [] }
  const ctx = { classId: 'mens-meeting', classStage: 'FELLOWSHIP' as const }

  it('refuses points to everyone, the admin included', () => {
    expect(can(servant, 'points.write', ctx)).toBe(false)
    expect(can(admin, 'points.write', ctx)).toBe(false)
  })

  it("leaves the meeting's servants their attendance and follow-ups", () => {
    expect(can(servant, 'attendance.write', ctx)).toBe(true)
    expect(can(servant, 'followup.write', ctx)).toBe(true)
    expect(can(servant, 'student.write', ctx)).toBe(true)
  })

  it('lets a Fellowship overseer act on every meeting', () => {
    const overseer: PortalUser = { ...servant, classIds: [], coordinatorOf: [], fellowshipClassIds: [], stageOversight: 'FELLOWSHIP' }
    expect(can(overseer, 'attendance.write', { classId: 'youth-meeting', classStage: 'FELLOWSHIP' })).toBe(true)
    expect(can(overseer, 'attendance.write', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
  })
})

describe("a meeting's check-in code on the signed-in scan page", () => {
  it('is turned away, since it is opened from the camera without signing in', async () => {
    const { canRedeem } = await import('@/lib/portal/qr')
    const token = { kind: 'MEMBER_CHECKIN' as const, classIds: ['mens-meeting'], expiresAt: new Date(Date.now() + 60_000) }
    const kid = { role: 'STUDENT' as const, studentId: 'st-1', classIds: ['mens-meeting'] }
    const servant = { role: 'SERVANT' as const, servantId: 'sv-1', classIds: ['mens-meeting'] }
    expect(canRedeem(kid, token)).toMatch(/Fellowship/)
    expect(canRedeem(servant, token)).toMatch(/Fellowship/)
  })
})

describe('the meeting a class is followed up on', () => {
  it('is Sunday School for a class, and its own register for a Fellowship meeting', async () => {
    const { watchedSessionKey } = await import('@/lib/portal/fellowship')
    expect(watchedSessionKey({ id: 'kg', stage: 'ELEMENTARY' })).toBe('sunday')
    expect(watchedSessionKey({ id: 'mens-meeting', stage: 'FELLOWSHIP' })).toBe('fellowship-mens-meeting')
  })
})
