import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

// 2026-10-24 — children and Fellowship members never cross over by accident:
// no child is moved into a meeting, no member is moved into a class, a meeting
// carries no points, and nothing that deletes children touches a member.

const world = vi.hoisted(() => ({
  user: { accountId: 'acc-admin', role: 'ADMIN', displayName: 'Admin', classIds: [] as string[], coordinatorOf: [] as string[], assistantOf: [] as string[], stageOversight: null as string | null },
  classes: new Map<string, { id: string; name: string; stage: string; isActive: boolean; takesOtherClasses: boolean }>(),
  students: new Map<string, { id: string; firstName: string; lastName: string; classId: string | null; class?: { stage: string } | null; [k: string]: unknown }>(),
  sessions: new Map<string, { key: string; label: string; classId: string | null; class?: { stage: string } | null }>(),
  writes: [] as string[],
  sessionWhere: null as unknown,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({ requirePortalUser: async () => world.user }))
vi.mock('@/lib/portal/data/groups', () => ({ placeNewKids: async () => 0 }))
vi.mock('@/lib/portal/data/class-members', () => ({ keepMembershipsOnMove: async () => {} }))
vi.mock('@/lib/prisma', () => {
  const prisma = {
    schoolClass: {
      findUnique: async ({ where }: { where: { id: string } }) => world.classes.get(where.id) ?? null,
      findMany: async ({ where }: { where?: { stage?: unknown } } = {}) => {
        const all = Array.from(world.classes.values())
        const stage = where?.stage as string | { not?: string } | undefined
        if (typeof stage === 'string') return all.filter((c) => c.stage === stage)
        if (stage && typeof stage === 'object' && 'not' in stage) return all.filter((c) => c.stage !== stage.not)
        return all
      },
    },
    student: {
      findUnique: async ({ where }: { where: { id: string } }) => world.students.get(where.id) ?? null,
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => world.students.get(id)).filter(Boolean),
      update: async () => {
        world.writes.push('student.update')
        return {}
      },
      updateMany: async () => {
        world.writes.push('student.updateMany')
        return { count: 1 }
      },
    },
    attendanceSession: {
      findMany: async ({ where }: { where: unknown }) => {
        world.sessionWhere = where
        return []
      },
      count: async () => world.sessions.size,
      findUnique: async ({ where }: { where: { key: string } }) => world.sessions.get(where.key) ?? null,
      upsert: async () => {
        world.writes.push('session.upsert')
        return {}
      },
      delete: async () => {
        world.writes.push('session.delete')
        return {}
      },
    },
    attendanceRecord: { count: async () => 0 },
  }
  return { prisma }
})

import { moveStudent, bulkMoveStudents } from '@/lib/portal/actions/students'
import { moveUnassigned } from '@/lib/portal/actions/unassigned'
import { saveSession, deleteSession } from '@/lib/portal/actions/admin'
import { churchReportScope } from '@/lib/portal/data/reports'
import type { PortalUser } from '@/lib/portal/permissions'

beforeEach(() => {
  world.writes = []
  world.user = { accountId: 'acc-admin', role: 'ADMIN', displayName: 'Admin', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null }
  world.classes = new Map([
    ['kg', { id: 'kg', name: 'KG', stage: 'ELEMENTARY', isActive: true, takesOtherClasses: false }],
    ['mens-meeting', { id: 'mens-meeting', name: "Men's Meeting", stage: 'FELLOWSHIP', isActive: true, takesOtherClasses: true }],
  ])
  world.students = new Map([
    ['kid', { id: 'kid', firstName: 'Kiro', lastName: 'Kid', classId: 'kg', class: { stage: 'ELEMENTARY' } }],
    ['member', { id: 'member', firstName: 'Mina', lastName: 'Testwell', classId: 'mens-meeting', class: { stage: 'FELLOWSHIP' } }],
  ])
  world.sessions = new Map([
    ['fellowship-mens-meeting', { key: 'fellowship-mens-meeting', label: "Men's Meeting", classId: 'mens-meeting', class: { stage: 'FELLOWSHIP' } }],
  ])
})

describe('moving children and members', () => {
  it('will not move a child into a Fellowship meeting', async () => {
    const r = await moveStudent('kid', 'mens-meeting')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Fellowship/)
    const bulk = await bulkMoveStudents({ studentIds: ['kid'], classId: 'mens-meeting' })
    expect(bulk.ok).toBe(false)
    expect(world.writes).toEqual([])
  })

  it('will not move a member out of their meeting from the children’s screens', async () => {
    const r = await moveStudent('member', 'kg')
    expect(r.ok).toBe(false)
    const bulk = await bulkMoveStudents({ studentIds: ['member', 'kid'], classId: null })
    expect(bulk.ok).toBe(false)
    expect(world.writes).toEqual([])
  })

  it('will not place a child from the UNASSIGNED list into a meeting', async () => {
    world.students.set('waiting', {
      id: 'waiting', firstName: 'Wait', lastName: 'Ing', classId: null, class: null, accountId: 'acc-w',
      unassignedAt: new Date(), unassignedReason: 'moved', unassignedFromClassId: 'kg', unassignedBy: null, account: { role: 'STUDENT' },
    })
    const r = await moveUnassigned('waiting', 'mens-meeting')
    expect(r.ok).toBe(false)
    expect(world.writes).toEqual([])
  })

  it('still moves a child between classes', async () => {
    world.classes.set('1st', { id: '1st', name: '1st', stage: 'ELEMENTARY', isActive: true, takesOtherClasses: false })
    expect((await moveStudent('kid', '1st')).ok).toBe(true)
  })
})

describe("a meeting's register in Sessions & Points", () => {
  it('can never be worth points', async () => {
    const r = await saveSession({ key: 'fellowship-mens-meeting', label: "Men's Meeting", points: 2, isActive: true, icon: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/no points/i)
    expect(world.writes).toEqual([])
  })

  it('may still be renamed or switched off at zero', async () => {
    const r = await saveSession({ key: 'fellowship-mens-meeting', label: "Men's Meeting", points: 0, isActive: false, icon: '' })
    expect(r.ok).toBe(true)
  })

  it("a new session for a meeting carries no points either", async () => {
    const r = await saveSession({ key: 'mens-retreat', label: "Men's Retreat", points: 3, isActive: true, icon: '', classId: 'mens-meeting' })
    expect(r.ok).toBe(false)
  })

  it("is not deleted, since the meeting's attendance hangs off it", async () => {
    const r = await deleteSession('fellowship-mens-meeting')
    expect(r.ok).toBe(false)
    expect(world.writes).toEqual([])
  })
})

describe('the church report', () => {
  it('is about the children: the admin sees every class but no meeting', async () => {
    const scope = await churchReportScope(world.user as PortalUser)
    expect(scope?.map((c) => c.id)).toEqual(['kg'])
  })

  it('is not offered to a Fellowship overseer', async () => {
    const overseer = { ...world.user, role: 'SERVANT', servantId: 'sv', stageOversight: 'FELLOWSHIP' } as PortalUser
    expect(await churchReportScope(overseer)).toBeNull()
  })
})

describe('deleting children never deletes a member', () => {
  const src = readFileSync('lib/portal/actions/data-tools.ts', 'utf8')
  const reset = src.slice(src.indexOf('export async function endOfYearReset'), src.indexOf('export async function', src.indexOf('export async function endOfYearReset') + 10))
  const classDelete = src.slice(src.indexOf('export async function deleteClassStudents'), src.indexOf('export async function', src.indexOf('export async function deleteClassStudents') + 10))

  it('the September reset spares Fellowship members as it spares servants', () => {
    expect(reset).toMatch(/role:\s*\{\s*not:\s*PortalRole\.MEMBER\s*\}/)
    expect(reset).toMatch(/servant:\s*\{\s*is:\s*null\s*\}/)
  })

  it("deleting a class's students never deletes a servant's account", () => {
    expect(classDelete).toMatch(/servant:\s*\{\s*is:\s*null\s*\}/)
  })
})

describe('lists of every child leave the members out', () => {
  it('a member is told apart from a child by their meeting or their account', async () => {
    const { NOT_FELLOWSHIP_MEMBER, withoutMembers } = await import('@/lib/portal/fellowship')
    expect(NOT_FELLOWSHIP_MEMBER).toEqual({
      account: { role: { not: 'MEMBER' } },
      OR: [{ classId: null }, { class: { stage: { not: 'FELLOWSHIP' } } }],
    })
    // Composed, never spread: the caller's own OR (a name search) survives.
    expect(withoutMembers({ OR: [{ firstName: 'x' }] })).toEqual({ AND: [{ OR: [{ firstName: 'x' }] }, NOT_FELLOWSHIP_MEMBER] })
  })

  for (const [file, what] of [
    ['app/portal/(app)/admin/students/page.tsx', 'All Students'],
    ['app/portal/(app)/admin/data/page.tsx', 'the Data page count'],
  ] as const) {
    it(`${what} uses it`, () => {
      expect(readFileSync(file, 'utf8')).toMatch(/withoutMembers\(/)
    })
  }

  it('the students export uses it', () => {
    const src = readFileSync('lib/portal/actions/data-tools.ts', 'utf8')
    const fn = src.slice(src.indexOf('export async function exportStudentsCsv'), src.indexOf('export async function', src.indexOf('export async function exportStudentsCsv') + 10))
    expect(fn).toMatch(/withoutMembers\(/)
  })
})

describe('teaching is for the classes', () => {
  it('a new quiz cannot be pointed at a Fellowship meeting', async () => {
    const { assignableClasses } = await import('@/lib/portal/data/exams')
    expect((await assignableClasses(world.user as PortalUser)).map((c) => c.id)).toEqual(['kg'])
  })
})

describe("the children's spreadsheet import", () => {
  it('will not import a sheet of children into a Fellowship meeting', async () => {
    const { importStudentsCsv } = await import('@/lib/portal/actions/data-tools')
    const r = await importStudentsCsv('First Name,Last Name\nMina,Testwell\n', 'mens-meeting', { classImport: true, preview: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Fellowship/)
    const admin = await importStudentsCsv('First Name,Last Name\nMina,Testwell\n', 'mens-meeting', { preview: true })
    expect(admin.ok).toBe(false)
  })
})

describe("the children's edit form", () => {
  it('will not edit a Fellowship member as a child', async () => {
    const { updateStudent } = await import('@/lib/portal/actions/students')
    const r = await updateStudent('member', { firstName: 'Mina', lastName: 'Testwell' } as never)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/member page/)
    expect(world.writes).toEqual([])
  })
})

describe("the children's logins export", () => {
  it('lists children only, never a servant’s or a member’s login', () => {
    const src = readFileSync('lib/portal/actions/logins.ts', 'utf8')
    const branch = src.slice(src.indexOf("} else {\n      const students = await prisma.student.findMany({"), src.indexOf('const missing = rows.filter'))
    expect(branch).toMatch(/where:\s*\{\s*account:\s*\{\s*role:\s*'STUDENT'\s*\}\s*\}/)
  })
})

describe("the children's reports", () => {
  it("offer no Fellowship meeting's register among their sessions", async () => {
    const { listSessions } = await import('@/lib/portal/data/reports')
    await listSessions()
    expect(world.sessionWhere).toEqual({ isActive: true, OR: [{ classId: null }, { class: { stage: { not: 'FELLOWSHIP' } } }] })
  })
})

describe("the children's actions, called straight", () => {
  it("will not reset a servant's PIN through their member side", async () => {
    const { resetStudentPin } = await import('@/lib/portal/actions/students')
    const r = await resetStudentPin('member')
    expect(r.ok).toBe(false)
    expect(world.writes).toEqual([])
  })

  it('will not make a child inside a Fellowship meeting', async () => {
    const { createStudent } = await import('@/lib/portal/actions/students')
    const r = await createStudent('mens-meeting', { firstName: 'Kiro', lastName: 'Kid' } as never)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Fellowship/)
  })

  it('will not add a child to a Fellowship meeting as if it were Pre-Servants', async () => {
    const { addClassMember } = await import('@/lib/portal/actions/class-members')
    const r = await addClassMember({ classId: 'mens-meeting', studentId: 'kid' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Fellowship/)
  })
})
