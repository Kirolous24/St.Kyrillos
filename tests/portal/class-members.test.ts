import { describe, it, expect } from 'vitest'
import {
  importJoinDecision,
  missedTitle,
  registerWhere,
  rosterWhere,
  sessionsForClass,
  sessionTakesMembers,
  studentClassIds,
} from '@/lib/portal/class-members'

// 2026-09-28 — a Pre-Servants class holds teens who stay in their own class.
const sunday = { key: 'sunday', classId: null }
const meeting = { key: 'pre-servants-meeting', classId: 'pre-servants' }
const choir = { key: 'choir-practice', classId: 'choir' }

describe('who is on a class roster', () => {
  it("is the class's own children and its members", () => {
    expect(rosterWhere('pre-servants')).toEqual({ OR: [{ classId: 'pre-servants' }, { memberships: { some: { classId: 'pre-servants' } } }] })
  })
  it('a child is in their home class first, then the classes they joined', () => {
    expect(studentClassIds({ classId: 'high-school-girls', memberships: [{ classId: 'pre-servants' }] })).toEqual(['high-school-girls', 'pre-servants'])
    expect(studentClassIds({ classId: null, memberships: [] })).toEqual([])
  })
})

describe('sessions', () => {
  const all = [sunday, meeting, choir]
  it("a class sees every class's sessions and its own, never another class's", () => {
    expect(sessionsForClass(all, 'pre-servants').map((s) => s.key)).toEqual(['sunday', 'pre-servants-meeting'])
    expect(sessionsForClass(all, 'high-school-girls').map((s) => s.key)).toEqual(['sunday'])
  })
  it("only the class's own meeting lists its members; Sunday School stays with their own class", () => {
    expect(sessionTakesMembers(meeting, 'pre-servants')).toBe(true)
    expect(sessionTakesMembers(sunday, 'pre-servants')).toBe(false)
    expect(registerWhere(sunday, 'pre-servants')).toEqual({ classId: 'pre-servants' })
    expect(registerWhere(meeting, 'pre-servants')).toEqual(rosterWhere('pre-servants'))
  })
})

describe('importing a child who is already in the portal', () => {
  const inHsGirls = { classId: 'high-school-girls', memberClassIds: [] as string[] }
  it('joins a class that takes children from other classes', () => {
    expect(importJoinDecision({ targetClassId: 'pre-servants', takesOtherClasses: true, child: inHsGirls })).toBe('join')
  })
  it('is left alone when already there, as their own or as a member', () => {
    expect(importJoinDecision({ targetClassId: 'high-school-girls', takesOtherClasses: false, child: inHsGirls })).toBe('home')
    expect(importJoinDecision({ targetClassId: 'pre-servants', takesOtherClasses: true, child: { ...inHsGirls, memberClassIds: ['pre-servants'] } })).toBe('member')
  })
  it('a grade class keeps the old rule: skipped, and the admin moves them', () => {
    expect(importJoinDecision({ targetClassId: '7th-8th-girls', takesOtherClasses: false, child: inHsGirls })).toBe('elsewhere')
  })
})

describe('follow-up titles', () => {
  it('keep the Sunday wording, and name a class meeting', () => {
    expect(missedTitle({ key: 'sunday', label: 'Sunday School' }, 1)).toBe('Missed last Sunday')
    expect(missedTitle({ key: 'sunday', label: 'Sunday School' }, 3)).toBe('Missed 3 Sundays in a row')
    expect(missedTitle({ key: 'pre-servants-meeting', label: 'Pre-Servants meeting' }, 1)).toBe('Missed the last Pre-Servants meeting')
    expect(missedTitle({ key: 'pre-servants-meeting', label: 'Pre-Servants meeting' }, 2)).toBe('Missed Pre-Servants meeting 2 times in a row')
  })
})

describe('QR scans', () => {
  const teen = ['high-school-girls', 'pre-servants']
  it('a servant scans members for points, and for the class meeting only', async () => {
    const { scanWhere } = await import('@/lib/portal/class-members')
    expect(scanWhere('pre-servants', 'POINTS', null)).toEqual(rosterWhere('pre-servants'))
    expect(scanWhere('pre-servants', 'ATTENDANCE', meeting)).toEqual(rosterWhere('pre-servants'))
    expect(scanWhere('pre-servants', 'ATTENDANCE', sunday)).toEqual({ classId: 'pre-servants' })
  })
  it("a teen's own scan lands in the right class", async () => {
    const { redeemClassFor } = await import('@/lib/portal/class-members')
    // The Pre-Servants meeting code: recorded in Pre-Servants.
    expect(redeemClassFor({ childClassIds: teen, codeClassIds: ['pre-servants'], kind: 'STUDENT_ATTENDANCE', session: meeting })).toBe('pre-servants')
    // Sunday School is theirs in their own class, never through Pre-Servants.
    expect(redeemClassFor({ childClassIds: teen, codeClassIds: ['pre-servants'], kind: 'STUDENT_ATTENDANCE', session: sunday })).toBeNull()
    expect(redeemClassFor({ childClassIds: teen, codeClassIds: ['high-school-girls'], kind: 'STUDENT_ATTENDANCE', session: sunday })).toBe('high-school-girls')
    // A meeting code for a class they are not in.
    expect(redeemClassFor({ childClassIds: ['kg'], codeClassIds: ['pre-servants'], kind: 'STUDENT_ATTENDANCE', session: meeting })).toBeNull()
    // Points go to a class the code covers, their own first.
    expect(redeemClassFor({ childClassIds: teen, codeClassIds: ['pre-servants'], kind: 'STUDENT_POINTS', session: null })).toBe('pre-servants')
    expect(redeemClassFor({ childClassIds: teen, codeClassIds: [], kind: 'STUDENT_POINTS', session: null })).toBe('high-school-girls')
  })
})
