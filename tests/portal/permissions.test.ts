import { describe, it, expect } from 'vitest'
import { can, visibleClassIds, type PortalUser, type ClassScope, mayModifyEvent } from '@/lib/portal/permissions'

const classes: ClassScope[] = [
  { id: 'kg', stage: 'ELEMENTARY' },
  { id: '1st', stage: 'ELEMENTARY' },
  { id: '5th-6th-boys', stage: 'MIDDLE_SCHOOL' },
  { id: 'hs-girls', stage: 'HIGH_SCHOOL' },
]

const admin: PortalUser = { accountId: 'a', role: 'ADMIN', displayName: 'Admin', classIds: [], coordinatorOf: [], stageOversight: null }
const pastor: PortalUser = { accountId: 'p', role: 'PASTOR', displayName: 'Fr.', classIds: [], coordinatorOf: [], stageOversight: null }
const servant: PortalUser = { accountId: 's', role: 'SERVANT', displayName: 'S', servantId: 'sv1', classIds: ['kg'], coordinatorOf: [], stageOversight: null }
const coordinator: PortalUser = { ...servant, accountId: 'c', coordinatorOf: ['kg'] }
const stageLead: PortalUser = { ...servant, accountId: 'st', stageOversight: 'ELEMENTARY' }
const student: PortalUser = { accountId: 'k', role: 'STUDENT', displayName: 'K', studentId: 'stu1', classIds: ['kg'], coordinatorOf: [], stageOversight: null }

describe('visibleClassIds', () => {
  it('admin and pastor see every class', () => {
    expect(visibleClassIds(admin, classes)).toEqual(['kg', '1st', '5th-6th-boys', 'hs-girls'])
    expect(visibleClassIds(pastor, classes)).toEqual(['kg', '1st', '5th-6th-boys', 'hs-girls'])
  })
  it('a servant sees only assigned classes', () => {
    expect(visibleClassIds(servant, classes)).toEqual(['kg'])
  })
  it('stage oversight adds every class in that stage', () => {
    expect(visibleClassIds(stageLead, classes)).toEqual(['kg', '1st'])
  })
  it('a student sees only their own class', () => {
    expect(visibleClassIds(student, classes)).toEqual(['kg'])
  })
})

describe('can', () => {
  it('servants can take attendance and give points in their class only', () => {
    expect(can(servant, 'attendance.write', { classId: 'kg' })).toBe(true)
    expect(can(servant, 'attendance.write', { classId: '1st' })).toBe(false)
    expect(can(servant, 'points.write', { classId: 'kg' })).toBe(true)
    expect(can(servant, 'points.write', { classId: '1st' })).toBe(false)
  })
  it('stage oversight grants read but not write across the stage', () => {
    expect(can(stageLead, 'class.read', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(stageLead, 'attendance.write', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(stageLead, 'class.read', { classId: 'hs-girls', classStage: 'HIGH_SCHOOL' })).toBe(false)
  })
  it('students can read their own class and profile but never write', () => {
    expect(can(student, 'class.read', { classId: 'kg' })).toBe(true)
    expect(can(student, 'student.read', { classId: 'kg', studentId: 'stu1' })).toBe(true)
    expect(can(student, 'student.read', { classId: 'kg', studentId: 'stu2' })).toBe(false)
    expect(can(student, 'attendance.write', { classId: 'kg' })).toBe(false)
    expect(can(student, 'points.write', { classId: 'kg' })).toBe(false)
  })
  it('only admin manages classes, servants and settings', () => {
    expect(can(admin, 'admin.manage')).toBe(true)
    expect(can(pastor, 'admin.manage')).toBe(false)
    expect(can(coordinator, 'admin.manage')).toBe(false)
  })
  it('pastor reads everything and can work follow-ups anywhere, but does not take attendance', () => {
    expect(can(pastor, 'class.read', { classId: 'hs-girls' })).toBe(true)
    expect(can(pastor, 'followup.write', { classId: 'hs-girls' })).toBe(true)
    expect(can(pastor, 'attendance.write', { classId: 'hs-girls' })).toBe(false)
  })
  it('admin can do everything in every class', () => {
    expect(can(admin, 'attendance.write', { classId: 'hs-girls' })).toBe(true)
    expect(can(admin, 'student.write', { classId: 'hs-girls' })).toBe(true)
  })
  it('servants and coordinators manage students in their class', () => {
    expect(can(servant, 'student.write', { classId: 'kg' })).toBe(true)
    expect(can(coordinator, 'student.write', { classId: 'kg' })).toBe(true)
    expect(can(servant, 'student.write', { classId: '1st' })).toBe(false)
  })
  it('inactive-role fallthrough: unknown action is denied', () => {
    // @ts-expect-error unknown action
    expect(can(admin, 'nope')).toBe(false)
  })
})

// Class scope alone is not enough for events: every servant of a targeted class
// shares it, so the port let any co-servant rewrite or delete a colleague's
// event. The prototype kept servants to their own.
describe('mayModifyEvent', () => {
  const ev = { createdById: 'acct-owner' }

  it('lets the servant who created it modify it', () => {
    expect(mayModifyEvent({ role: 'SERVANT', accountId: 'acct-owner' }, ev)).toBe(true)
  })

  it('stops a different servant, even one who serves a targeted class', () => {
    expect(mayModifyEvent({ role: 'SERVANT', accountId: 'acct-other' }, ev)).toBe(false)
  })

  it('lets an admin or the pastor manage anything', () => {
    expect(mayModifyEvent({ role: 'ADMIN', accountId: 'acct-other' }, ev)).toBe(true)
    expect(mayModifyEvent({ role: 'PASTOR', accountId: 'acct-other' }, ev)).toBe(true)
  })

  it('refuses a servant when the creator is unknown, rather than opening it up', () => {
    expect(mayModifyEvent({ role: 'SERVANT', accountId: 'acct-owner' }, { createdById: null })).toBe(false)
    expect(mayModifyEvent({ role: 'ADMIN', accountId: 'a' }, { createdById: null })).toBe(true)
  })
})

