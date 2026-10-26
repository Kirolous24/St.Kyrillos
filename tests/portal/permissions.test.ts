import { describe, it, expect } from 'vitest'
import { can, visibleClassIds, type PortalUser, type ClassScope, mayModifyEvent } from '@/lib/portal/permissions'

const classes: ClassScope[] = [
  { id: 'kg', stage: 'ELEMENTARY' },
  { id: '1st', stage: 'ELEMENTARY' },
  { id: '5th-6th-boys', stage: 'MIDDLE_SCHOOL' },
  { id: 'hs-girls', stage: 'HIGH_SCHOOL' },
]

const admin: PortalUser = { accountId: 'a', role: 'ADMIN', displayName: 'Admin', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null }
const pastor: PortalUser = { accountId: 'p', role: 'PASTOR', displayName: 'Fr.', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null }
const servant: PortalUser = { accountId: 's', role: 'SERVANT', displayName: 'S', servantId: 'sv1', classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null }
const coordinator: PortalUser = { ...servant, accountId: 'c', coordinatorOf: ['kg'] }
const assistant: PortalUser = { ...servant, accountId: 'ac', assistantOf: ['kg'] }
const stageLead: PortalUser = { ...servant, accountId: 'st', stageOversight: 'ELEMENTARY' }
const student: PortalUser = { accountId: 'k', role: 'STUDENT', displayName: 'K', studentId: 'stu1', classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null }

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
  /**
   * The church widened this on 2026-09-24. A coordinator used to be read-only
   * across their stage, which matched the prototype — but it meant that when a
   * class's servant did not turn up, only an admin could take that register,
   * and the coordinators were sharing the admin login to do their own job.
   */
  it('a coordinator acts on their stage as a servant acts on their own class', () => {
    for (const action of ['class.read', 'student.write', 'attendance.write', 'points.write', 'followup.write'] as const) {
      expect(can(stageLead, action, { classId: '1st', classStage: 'ELEMENTARY' }), action).toBe(true)
    }
  })

  it('but only their own stage, and never the admin screens', () => {
    for (const action of ['class.read', 'student.write', 'attendance.write', 'points.write', 'followup.write'] as const) {
      expect(can(stageLead, action, { classId: 'hs-girls', classStage: 'HIGH_SCHOOL' }), action).toBe(false)
    }
    expect(can(stageLead, 'admin.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
  })

  it('a stage is not inferred from the class id when no stage is given', () => {
    // `can` is told the stage by its caller. A context without one must not
    // quietly grant the coordinator anything — every call site passes it, and a
    // new one that forgets should fail closed.
    expect(can(stageLead, 'attendance.write', { classId: '1st' })).toBe(false)
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


describe('group.manage', () => {
  it('the admin, the stage overseer and the class Coordinator may arrange groups', () => {
    expect(can(admin, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(stageLead, 'group.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(coordinator, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
  })
  it('a plain servant, the pastor and a student may not', () => {
    expect(can(servant, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(pastor, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(student, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
  })
  it("a Coordinator's reach is their own class, an overseer's their own stage", () => {
    expect(can(coordinator, 'group.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(stageLead, 'group.manage', { classId: '5th-6th-boys', classStage: 'MIDDLE_SCHOOL' })).toBe(false)
  })
  // 2026-10-19, at the user's word: an Assistant Coordinator sees every group
  // in their class (since 2026-10-04) and now arranges them as the Coordinator
  // does — Split evenly, Move children, fixing anyone's contact notes.
  it('an Assistant Coordinator arranges the groups of their own class', () => {
    expect(can(assistant, 'group.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
  })
  it("and only their own class's", () => {
    expect(can(assistant, 'group.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
  })
})

// UNASSIGNED (2026-09-26): any servant of the class may take a child off it with
// a reason (student.write); deciding what happens next is the coordinator's job.
describe('unassigned.manage', () => {
  it('the admin, the stage overseer and the class Coordinator handle the UNASSIGNED list', () => {
    expect(can(admin, 'unassigned.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(stageLead, 'unassigned.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(coordinator, 'unassigned.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
  })
  it('a plain servant, the pastor and a student do not', () => {
    expect(can(servant, 'unassigned.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(pastor, 'unassigned.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(student, 'unassigned.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
  })
  it("a Coordinator's reach is their own class, an overseer's their own stage", () => {
    expect(can(coordinator, 'unassigned.manage', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(stageLead, 'unassigned.manage', { classId: '5th-6th-boys', classStage: 'MIDDLE_SCHOOL' })).toBe(false)
  })
  it('an Assistant Coordinator does not: deciding on an UNASSIGNED child is not group work', () => {
    expect(can(assistant, 'unassigned.manage', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
  })
  it('a plain servant can still unassign a child from their own class', () => {
    expect(can(servant, 'student.write', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
  })
})

// The boys' and girls' classes of 5th & 6th and of 7th & 8th take each other's
// registers (2026-10-25): "only for attendance, nothing else".
describe('attendance.take', () => {
  const boysServant: PortalUser = {
    accountId: 'b', role: 'SERVANT', displayName: 'B', servantId: 'sv-b',
    classIds: ['5th-6th-boys'], coordinatorOf: ['5th-6th-boys'], assistantOf: [], stageOversight: null,
    attendanceOnly: ['5th-6th-girls'],
  }
  const girls = { classId: '5th-6th-girls', classStage: 'MIDDLE_SCHOOL' as const }

  it('the paired class’s servants may take its register', () => {
    expect(can(boysServant, 'attendance.take', girls)).toBe(true)
  })

  it('and nothing else of it', () => {
    for (const action of ['class.read', 'student.read', 'student.write', 'attendance.write', 'points.write', 'followup.write', 'servant.read', 'group.manage', 'unassigned.manage', 'admin.manage', 'exam.post'] as const) {
      expect(can(boysServant, action, girls), action).toBe(false)
    }
  })

  it('everyone who could already take a register still can', () => {
    expect(can(servant, 'attendance.take', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(stageLead, 'attendance.take', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(admin, 'attendance.take', girls)).toBe(true)
    expect(can(boysServant, 'attendance.take', { classId: '5th-6th-boys', classStage: 'MIDDLE_SCHOOL' })).toBe(true)
  })

  it('nobody else may', () => {
    expect(can(servant, 'attendance.take', girls)).toBe(false)
    expect(can(pastor, 'attendance.take', girls)).toBe(false)
    expect(can(student, 'attendance.take', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(boysServant, 'attendance.take', { classId: '7th-8th-girls', classStage: 'MIDDLE_SCHOOL' })).toBe(false)
  })

  it('a pairing reaches no student’s account', () => {
    expect(can({ ...student, attendanceOnly: ['1st'] }, 'attendance.take', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
  })
})

// Posting one exam to several classes at once (2026-10-26): every class whose
// points you give, and for a Coordinator or Assistant Coordinator of the 5th &
// 6th or 7th & 8th boys' or girls' class, the other half of the pair, where
// they may post it and do nothing else.
describe('exam.post', () => {
  const boysCoordinator: PortalUser = {
    accountId: 'b', role: 'SERVANT', displayName: 'B', servantId: 'sv-b',
    classIds: ['5th-6th-boys'], coordinatorOf: ['5th-6th-boys'], assistantOf: [], stageOversight: null,
    attendanceOnly: ['5th-6th-girls'], examPostOnly: ['5th-6th-girls'],
  }
  const girls = { classId: '5th-6th-girls', classStage: 'MIDDLE_SCHOOL' as const }
  const meeting = { classId: 'mens-meeting', classStage: 'FELLOWSHIP' as const }

  it('whoever gives a class its points may post its exams', () => {
    expect(can(servant, 'exam.post', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(stageLead, 'exam.post', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(true)
    expect(can(admin, 'exam.post', girls)).toBe(true)
    expect(can(boysCoordinator, 'exam.post', { classId: '5th-6th-boys', classStage: 'MIDDLE_SCHOOL' })).toBe(true)
  })

  it('a pair’s Coordinator may post to the other half, and do nothing else there', () => {
    expect(can(boysCoordinator, 'exam.post', girls)).toBe(true)
    for (const action of ['class.read', 'student.read', 'student.write', 'points.write', 'followup.write', 'servant.read', 'group.manage', 'unassigned.manage'] as const) {
      expect(can(boysCoordinator, action, girls), action).toBe(false)
    }
  })

  it('a servant’s reach is their own classes and their own pair', () => {
    expect(can(servant, 'exam.post', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can(boysCoordinator, 'exam.post', { classId: '7th-8th-girls', classStage: 'MIDDLE_SCHOOL' })).toBe(false)
  })

  it('nobody posts an exam to a Fellowship meeting, the admin included', () => {
    expect(can(admin, 'exam.post', meeting)).toBe(false)
    expect(can({ ...servant, classIds: ['mens-meeting'] }, 'exam.post', meeting)).toBe(false)
  })

  it('the pastor and the children never post one', () => {
    expect(can(pastor, 'exam.post', girls)).toBe(false)
    expect(can(student, 'exam.post', { classId: 'kg', classStage: 'ELEMENTARY' })).toBe(false)
    expect(can({ ...student, examPostOnly: ['1st'] }, 'exam.post', { classId: '1st', classStage: 'ELEMENTARY' })).toBe(false)
  })
})
