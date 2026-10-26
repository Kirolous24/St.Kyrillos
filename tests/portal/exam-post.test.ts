import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { PortalUser } from '@/lib/portal/permissions'

/**
 * One exam posted to several classes at once (2026-10-26): "if I'm the admin,
 * I can post in any classes. If I'm the coordinator, I can post the classes I'm
 * coordinating. Same thing with the assistant. And if I'm in the fifth and
 * sixth or seventh and eighth and I'm a coordinator, I can also post it to the
 * other version of the class." Each class gets its own copy, with its own
 * results. The other half of a pair is posted to and nothing else: its copy,
 * its results and its children stay with its own servants.
 *
 * Stand-ins: the signed-in user, the class check (with the real permission
 * rules) and the database.
 */
const root = path.resolve(__dirname, '../..')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sources(full))
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}
const files = ['app', 'components', 'lib'].flatMap((d) => sources(path.join(root, d)))
const using = (needle: RegExp) =>
  files.filter((f) => needle.test(readFileSync(f, 'utf8'))).map((f) => path.relative(root, f)).sort()

describe('posting to the other half of a pair reaches nothing else', () => {
  it('is asked for only where an exam is posted', () => {
    expect(using(/'exam\.post'/)).toEqual(['lib/portal/actions/exams.ts', 'lib/portal/data/exams.ts', 'lib/portal/permissions.ts'])
  })

  it('the classes it adds are read only by the permission rules', () => {
    expect(using(/examPostOnly/)).toEqual(['lib/portal/permissions.ts', 'lib/portal/portal-user.ts'])
  })

  it("the Exams list's students come from the classes a servant looks after, never from the ones they may only post to", () => {
    const list = readFileSync(path.join(root, 'app/portal/(app)/exams/page.tsx'), 'utf8')
    expect(list).toMatch(/assignableClasses\(user\)/)
    expect(list).not.toMatch(/postableClasses/)
  })
})

type Cls = { id: string; name: string; stage: string; isActive: boolean; sortOrder: number }

const world = vi.hoisted(() => ({
  user: null as unknown,
  classes: {} as Record<string, Cls>,
  created: [] as Array<Record<string, unknown>>,
  audits: [] as Array<{ action: string; entityId: string | null; detail: string }>,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({
  audit: async (_u: unknown, action: string, _e: string, entityId: string | null, detail: string) => {
    world.audits.push({ action, entityId, detail })
  },
}))
vi.mock('@/lib/portal/session', () => ({ requirePortalUser: async () => world.user }))
vi.mock('@/lib/portal/data/classes', async () => {
  const { PortalError } = await import('@/lib/portal/action-result')
  const { can } = await import('@/lib/portal/permissions')
  return {
    assertClassAction: async (user: PortalUser, classId: string, action: Parameters<typeof can>[1]) => {
      const cls = world.classes[classId]
      if (!cls || !can(user, action, { classId: cls.id, classStage: cls.stage as never })) {
        throw new PortalError('You do not have permission to do that in this class.')
      }
      return cls
    },
  }
})
vi.mock('@/lib/prisma', () => {
  const db = {
    schoolClass: {
      findMany: async ({ where }: { where: { isActive?: boolean; stage?: { not?: string } } }) =>
        Object.values(world.classes)
          .filter((c) => (where.isActive === undefined || c.isActive === where.isActive) && c.stage !== where.stage?.not)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => ({ id: c.id, name: c.name, stage: c.stage })),
    },
    exam: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        world.created.push(data)
        return { id: `exam-${world.created.length}` }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { prisma: db }
})

import { createExam, importExamsCsv } from '@/lib/portal/actions/exams'
import { assignableClasses, postableClasses } from '@/lib/portal/data/exams'

const base = { accountId: 'acc', role: 'SERVANT' as const, displayName: 'S', servantId: 'sv', coordinatorOf: [] as string[], assistantOf: [] as string[], stageOversight: null }
const boysCoordinator: PortalUser = {
  ...base, classIds: ['5th-6th-boys'], coordinatorOf: ['5th-6th-boys'],
  attendanceOnly: ['5th-6th-girls'], examPostOnly: ['5th-6th-girls'],
}
const boysServant: PortalUser = { ...base, classIds: ['5th-6th-boys'], attendanceOnly: ['5th-6th-girls'] }
const stageCoordinator: PortalUser = { ...base, classIds: [], stageOversight: 'ELEMENTARY' }
const admin: PortalUser = { ...base, role: 'ADMIN', servantId: undefined, classIds: [] }

const exam = {
  classId: '5th-6th-boys',
  title: 'Mark 1',
  pointsPerQuestion: 2,
  status: 'PUBLISHED' as const,
  questions: [{ text: 'Who baptised Jesus?', options: ['John', 'Peter'], correctIndex: 0 }],
}

beforeEach(() => {
  const cls = (id: string, name: string, stage: string, sortOrder: number): Cls => ({ id, name, stage, isActive: true, sortOrder })
  world.classes = Object.fromEntries(
    [
      cls('kg', 'KG', 'ELEMENTARY', 1),
      cls('1st', '1st Grade', 'ELEMENTARY', 2),
      cls('5th-6th-boys', '5th & 6th Boys', 'MIDDLE_SCHOOL', 3),
      cls('5th-6th-girls', '5th & 6th Girls', 'MIDDLE_SCHOOL', 4),
      cls('7th-8th-girls', '7th & 8th Girls', 'MIDDLE_SCHOOL', 5),
      cls('mens-meeting', "Men's Meeting", 'FELLOWSHIP', 6),
    ].map((c) => [c.id, c]),
  )
  world.user = boysCoordinator
  world.created = []
  world.audits = []
})

describe('the classes a new exam is offered to', () => {
  it('a pair’s Coordinator: their own class, and the other half to post to only', async () => {
    expect((await postableClasses(boysCoordinator)).map((c) => [c.id, c.postOnly])).toEqual([
      ['5th-6th-boys', false],
      ['5th-6th-girls', true],
    ])
    // The classes they look after: the Exams list's students and the class an
    // exam is written in come from these.
    expect((await assignableClasses(boysCoordinator)).map((c) => c.id)).toEqual(['5th-6th-boys'])
  })

  it('a servant of the pair without the title: their own class only', async () => {
    expect((await postableClasses(boysServant)).map((c) => c.id)).toEqual(['5th-6th-boys'])
  })

  it('a Stage coordinator: every class of their stage', async () => {
    expect((await postableClasses(stageCoordinator)).map((c) => [c.id, c.postOnly])).toEqual([
      ['kg', false],
      ['1st', false],
    ])
    expect((await assignableClasses(stageCoordinator)).map((c) => c.id)).toEqual(['kg', '1st'])
  })

  it('the admin: every class, and no Fellowship meeting', async () => {
    expect((await postableClasses(admin)).map((c) => c.id)).toEqual(['kg', '1st', '5th-6th-boys', '5th-6th-girls', '7th-8th-girls'])
    expect((await postableClasses(admin)).every((c) => !c.postOnly)).toBe(true)
  })
})

describe('createExam to several classes', () => {
  it('posts a copy to each class, with the same questions', async () => {
    const r = await createExam({ ...exam, alsoClassIds: ['5th-6th-girls'] })
    expect(r).toEqual({ ok: true, data: { id: 'exam-1', also: ['5th-6th-girls'] } })
    expect(world.created.map((e) => [e.classId, e.stage, e.title, e.createdById])).toEqual([
      ['5th-6th-boys', 'MIDDLE_SCHOOL', 'Mark 1', 'acc'],
      ['5th-6th-girls', 'MIDDLE_SCHOOL', 'Mark 1', 'acc'],
    ])
    expect(world.created[1]!.questions).toEqual(world.created[0]!.questions)
    expect(world.audits.map((a) => [a.action, a.entityId])).toEqual([
      ['exam.create', 'exam-1'],
      ['exam.create', 'exam-2'],
    ])
  })

  it('checks every class before anything is written', async () => {
    const r = await createExam({ ...exam, alsoClassIds: ['5th-6th-girls', '7th-8th-girls'] })
    expect(r).toEqual({ ok: false, error: 'You do not have permission to do that in this class.' })
    expect(world.created).toEqual([])
  })

  it('the class it is written in is one the poster looks after, so they can open it afterwards', async () => {
    const r = await createExam({ ...exam, classId: '5th-6th-girls', alsoClassIds: ['5th-6th-boys'] })
    expect(r.ok).toBe(false)
    expect(world.created).toEqual([])
  })

  it('a class named twice, or named again, gets one copy', async () => {
    const r = await createExam({ ...exam, alsoClassIds: ['5th-6th-girls', '5th-6th-girls', '5th-6th-boys'] })
    expect(r).toEqual({ ok: true, data: { id: 'exam-1', also: ['5th-6th-girls'] } })
    expect(world.created.map((e) => e.classId)).toEqual(['5th-6th-boys', '5th-6th-girls'])
  })

  it('with no other class it is one exam, as before', async () => {
    const r = await createExam(exam)
    expect(r).toEqual({ ok: true, data: { id: 'exam-1', also: [] } })
    expect(world.created).toHaveLength(1)
  })

  it('a servant of the pair without the title cannot post to the other half', async () => {
    world.user = boysServant
    expect((await createExam({ ...exam, alsoClassIds: ['5th-6th-girls'] })).ok).toBe(false)
    expect(world.created).toEqual([])
  })

  it('the admin posts to any classes, but never to a Fellowship meeting', async () => {
    world.user = admin
    expect((await createExam({ ...exam, classId: 'kg', alsoClassIds: ['1st', '7th-8th-girls'] })).ok).toBe(true)
    expect(world.created.map((e) => e.classId)).toEqual(['kg', '1st', '7th-8th-girls'])
    world.created = []
    expect((await createExam({ ...exam, classId: 'kg', alsoClassIds: ['mens-meeting'] })).ok).toBe(false)
    expect(world.created).toEqual([])
  })
})

describe('importExamsCsv to several classes', () => {
  const csv = 'Title,Question,Option A,Option B,Correct\nWeek 1,Who baptised Jesus?,John,Peter,John\nWeek 2,Who denied Him?,Peter,John,Peter\n'

  it('imports every quiz into every class', async () => {
    const r = await importExamsCsv({ classId: '5th-6th-boys', alsoClassIds: ['5th-6th-girls'], csv, status: 'PUBLISHED' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data!.created.map((c) => c.title)).toEqual(['Week 1', 'Week 2'])
    expect(r.data!.classes).toEqual(['5th & 6th Boys', '5th & 6th Girls'])
    expect(world.created.map((e) => [e.classId, e.title])).toEqual([
      ['5th-6th-boys', 'Week 1'],
      ['5th-6th-boys', 'Week 2'],
      ['5th-6th-girls', 'Week 1'],
      ['5th-6th-girls', 'Week 2'],
    ])
  })

  it('checks every class before anything is written', async () => {
    const r = await importExamsCsv({ classId: '5th-6th-boys', alsoClassIds: ['7th-8th-girls'], csv, status: 'PUBLISHED' })
    expect(r.ok).toBe(false)
    expect(world.created).toEqual([])
  })

  it('refuses more than one import can hold, before anything is written', async () => {
    world.user = admin
    const rows = Array.from({ length: 41 }, (_, i) => `Quiz ${i + 1},Q${i + 1}?,Yes,No,Yes`).join('\n')
    const r = await importExamsCsv({
      classId: 'kg',
      alsoClassIds: ['1st', '5th-6th-boys', '5th-6th-girls', '7th-8th-girls'],
      csv: `Title,Question,Option A,Option B,Correct\n${rows}\n`,
      status: 'DRAFT',
    })
    expect(r).toEqual({
      ok: false,
      error: 'That would add 205 quizzes: 41 in each of 5 classes. One import adds at most 200, so split the sheet or pick fewer classes.',
    })
    expect(world.created).toEqual([])
  })
})
