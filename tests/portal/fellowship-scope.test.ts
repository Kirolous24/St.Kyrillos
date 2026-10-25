import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// 2026-10-24 — Fellowship meetings are classes, but no screen built for the
// children may show them. Every class list stays kid-only unless the page
// asks for meetings by name.

const world = vi.hoisted(() => ({
  classes: [] as unknown[],
  upserts: [] as Array<{ where: unknown; create: Record<string, unknown>; update: Record<string, unknown> }>,
  created: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
  existing: null as null | { stage: string; name: string; _count: { students: number; members: number } },
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({ audit: async () => {} }))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-admin', role: 'ADMIN', displayName: 'Admin', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/prisma', () => {
  const attendanceSession = {
    upsert: async (args: { where: unknown; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      world.upserts.push(args)
      return {}
    },
  }
  const schoolClass = {
    findMany: async () => world.classes,
    findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'taken' ? { id: 'taken' } : world.existing ? { id: where.id, ...world.existing } : null),
    aggregate: async () => ({ _max: { sortOrder: 4 } }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      world.created.push(data)
      return data
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      world.updated.push(data)
      return data
    },
  }
  const classMember = { count: async () => 0 }
  const prisma = { schoolClass, attendanceSession, classMember, $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma) }
  return { prisma }
})

import { listVisibleClasses } from '@/lib/portal/data/classes'
import { createClass, updateClass } from '@/lib/portal/actions/admin'
import type { PortalUser } from '@/lib/portal/permissions'

const admin: PortalUser = {
  accountId: 'acc-admin', role: 'ADMIN', displayName: 'Admin', classIds: [], coordinatorOf: [], assistantOf: [], stageOversight: null,
}
const row = (id: string, stage: string) => ({
  id, name: id, stage, sortOrder: 0, visitationThreshold: 1, photo: null, description: null, _count: { students: 0, servants: 0 },
})

beforeEach(() => {
  world.classes = [row('kg', 'ELEMENTARY'), row('mens-meeting', 'FELLOWSHIP')]
  world.upserts = []
  world.created = []
  world.updated = []
  world.existing = null
})

describe('class lists are kid-only unless a page asks for meetings', () => {
  it('leaves meetings out by default', async () => {
    expect((await listVisibleClasses(admin)).map((c) => c.id)).toEqual(['kg'])
  })
  it('includes them when asked', async () => {
    expect((await listVisibleClasses(admin, { fellowship: 'include' })).map((c) => c.id)).toEqual(['kg', 'mens-meeting'])
  })
  it('gives only meetings when asked for only those', async () => {
    expect((await listVisibleClasses(admin, { fellowship: 'only' })).map((c) => c.id)).toEqual(['mens-meeting'])
  })
})

describe('Manage Classes and a Fellowship meeting', () => {
  it('a new meeting gets its own register, worth no points, and takes members from anywhere', async () => {
    const r = await createClass({ name: "Men's Meeting", stage: 'FELLOWSHIP', visitationThreshold: 2 })
    expect(r.ok).toBe(true)
    expect(world.created[0]).toMatchObject({ id: 'men-s-meeting', stage: 'FELLOWSHIP', takesOtherClasses: true, visitationThreshold: 2 })
    expect(world.upserts).toHaveLength(1)
    expect(world.upserts[0]!.where).toEqual({ key: 'fellowship-men-s-meeting' })
    expect(world.upserts[0]!.create).toMatchObject({ key: 'fellowship-men-s-meeting', label: "Men's Meeting", points: 0, classId: 'men-s-meeting', isActive: true })
  })

  it('a new kid class gets no register of its own', async () => {
    await createClass({ name: 'KG', stage: 'ELEMENTARY', visitationThreshold: 1 })
    expect(world.upserts).toHaveLength(0)
  })

  it('renaming a meeting renames its register', async () => {
    world.existing = { stage: 'FELLOWSHIP', name: "Men's Meeting", _count: { students: 3, members: 0 } }
    const r = await updateClass('mens-meeting', { name: "Men's Fellowship", stage: 'FELLOWSHIP', visitationThreshold: 2 })
    expect(r.ok).toBe(true)
    expect(world.upserts[0]!.update).toEqual({ label: "Men's Fellowship" })
    expect(world.updated[0]).toMatchObject({ takesOtherClasses: true })
  })

  it('will not turn a class with children into a meeting, or a meeting with members into a class', async () => {
    world.existing = { stage: 'ELEMENTARY', name: 'KG', _count: { students: 12, members: 0 } }
    const toMeeting = await updateClass('kg', { name: 'KG', stage: 'FELLOWSHIP', visitationThreshold: 2 })
    expect(toMeeting.ok).toBe(false)
    world.existing = { stage: 'FELLOWSHIP', name: 'Youth', _count: { students: 0, members: 2 } }
    const toClass = await updateClass('youth', { name: 'Youth', stage: 'HIGH_SCHOOL', visitationThreshold: 1 })
    expect(toClass.ok).toBe(false)
    expect(world.updated).toHaveLength(0)
  })

  it('an empty class may become a meeting, and gets its register then', async () => {
    world.existing = { stage: 'HIGH_SCHOOL', name: 'Youth', _count: { students: 0, members: 0 } }
    const r = await updateClass('youth', { name: 'Youth Meeting', stage: 'FELLOWSHIP', visitationThreshold: 2 })
    expect(r.ok).toBe(true)
    expect(world.upserts[0]!.create).toMatchObject({ key: 'fellowship-youth', classId: 'youth', points: 0 })
  })
})

// Which pages may show meetings is decided here, once. Any other call to
// listVisibleClasses must take the default, so a children's page can never
// start listing adults because someone copied a call.
const OPT_IN = new Map<string, 'include' | 'only'>([
  ['app/portal/(app)/classes/page.tsx', 'include'],
  ['app/portal/(app)/my-group/page.tsx', 'include'],
  ['app/portal/(app)/follow-ups/page.tsx', 'include'],
  ['app/portal/(app)/birthdays/page.tsx', 'include'],
  ['lib/portal/data/birthday-calendar.ts', 'include'],
  ['lib/portal/data/reports.ts', 'include'],
  ['app/portal/(app)/qr/page.tsx', 'only'],
  ['lib/portal/data/dashboard.ts', 'include'],
])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe('where meetings may appear', () => {
  const files = [...sourceFiles('app/portal'), ...sourceFiles('lib/portal'), ...sourceFiles('components/portal')]

  it('every page that lists meetings says so by name', () => {
    for (const [file, mode] of Array.from(OPT_IN)) {
      expect(readFileSync(file, 'utf8'), file).toContain(`fellowship: '${mode}'`)
    }
  })

  it('every other class list is kid-only', () => {
    for (const file of files) {
      if (OPT_IN.has(file) || file === 'lib/portal/data/classes.ts' || file === 'lib/portal/data/fellowship.ts') continue
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toMatch(/listVisibleClasses\([^)]*fellowship/)
    }
  })
})
