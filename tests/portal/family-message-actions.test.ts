import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Family messages (2026-10-19): a class's own message for each meeting, and a
 * record of every message a servant sends a family from the portal. Any
 * servant who follows the class up may do both. Stand-ins: the signed-in
 * servant, the class check (the servant serves "boys" only), the child's group
 * servant, and a database that records the writes.
 */
const world = vi.hoisted(() => ({
  child: { id: 'mina', firstName: 'Mina', lastName: 'Saad', classId: 'boys' as string | null, memberships: [] as Array<{ classId: string }> },
  sessions: {
    sunday: { key: 'sunday', label: 'Sunday School', isActive: true, classId: null as string | null },
    bible: { key: 'bible', label: 'Bible Study', isActive: true, classId: null as string | null },
    'pre-meeting': { key: 'pre-meeting', label: 'Pre-Servants Meeting', isActive: true, classId: 'pre' as string | null },
  } as Record<string, { key: string; label: string; isActive: boolean; classId: string | null }>,
  saved: null as null | { body: string },
  openCase: null as null | { id: string },
  upserts: [] as Array<Record<string, unknown>>,
  deletes: [] as Array<Record<string, unknown>>,
  logs: [] as Array<Record<string, unknown>>,
  caseQueries: [] as Array<Record<string, unknown>>,
  audits: [] as Array<{ action: string; detail: string }>,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/portal/audit', () => ({
  audit: async (_u: unknown, action: string, _e: string, _id: string | null, detail: string) => {
    world.audits.push({ action, detail })
  },
}))
vi.mock('@/lib/portal/session', () => ({
  requirePortalUser: async () => ({
    accountId: 'acc-paul', role: 'SERVANT', displayName: 'Paul', servantId: 'sv-paul',
    classIds: ['boys'], coordinatorOf: ['boys'], assistantOf: [], stageOversight: null,
  }),
}))
vi.mock('@/lib/portal/data/classes', async () => {
  const { PortalError } = await import('@/lib/portal/action-result')
  return {
    assertClassAction: async (_u: unknown, classId: string) => {
      if (classId !== 'boys') throw new PortalError('You do not have permission to do that in this class.')
      return { id: 'boys', name: '5th & 6th Boys', stage: 'MIDDLE_SCHOOL', visitationThreshold: 1, takesOtherClasses: false }
    },
  }
})
vi.mock('@/lib/portal/data/groups', () => ({ groupServantOf: async () => 'sv-mariam' }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    attendanceSession: { findUnique: async (args: { where: { key: string } }) => world.sessions[args.where.key] ?? null },
    meetingMessage: {
      findUnique: async () => world.saved,
      upsert: async (args: Record<string, unknown>) => {
        world.upserts.push(args)
        return {}
      },
      deleteMany: async (args: Record<string, unknown>) => {
        world.deletes.push(args)
        return { count: world.saved ? 1 : 0 }
      },
    },
    student: { findUnique: async () => world.child },
    followUpCase: {
      findFirst: async (args: Record<string, unknown>) => {
        world.caseQueries.push(args)
        return world.openCase
      },
    },
    followUpLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        world.logs.push(args.data)
        return { id: 'log1' }
      },
    },
  },
}))

import { recordFamilyMessage, resetMeetingMessage, saveMeetingMessage } from '@/lib/portal/actions/family-messages'

beforeEach(() => {
  world.child = { id: 'mina', firstName: 'Mina', lastName: 'Saad', classId: 'boys', memberships: [] }
  world.saved = null
  world.openCase = null
  world.upserts = []
  world.deletes = []
  world.logs = []
  world.caseQueries = []
  world.audits = []
})

describe('saveMeetingMessage', () => {
  const friday = 'We missed {name} at Bible Study tonight. We read John 3 — ask {name} about Nicodemus!'

  it('keeps the class’s own message for that meeting, and who wrote it', async () => {
    const r = await saveMeetingMessage({ classId: 'boys', sessionKey: 'bible', body: `  ${friday}\n` })
    expect(r).toEqual({ ok: true, data: undefined })
    expect(world.upserts).toEqual([
      {
        where: { classId_sessionKey: { classId: 'boys', sessionKey: 'bible' } },
        create: { classId: 'boys', sessionKey: 'bible', body: friday, updatedById: 'acc-paul' },
        update: { body: friday, updatedById: 'acc-paul' },
      },
    ])
    expect(world.audits[0]!.action).toBe('message.save')
    expect(world.audits[0]!.detail).toContain('Bible Study')
  })

  it('logs what the message said before it was changed', async () => {
    world.saved = { body: 'The old words' }
    await saveMeetingMessage({ classId: 'boys', sessionKey: 'bible', body: friday })
    expect(world.audits[0]!.detail).toContain('was: The old words')
  })

  it('refuses a class the servant does not follow up', async () => {
    const r = await saveMeetingMessage({ classId: 'girls', sessionKey: 'bible', body: friday })
    expect(r.ok).toBe(false)
    expect(world.upserts).toEqual([])
  })

  it('refuses a meeting the class does not hold', async () => {
    expect(await saveMeetingMessage({ classId: 'boys', sessionKey: 'pre-meeting', body: friday })).toEqual({
      ok: false,
      error: 'That meeting is not one this class holds.',
    })
    expect((await saveMeetingMessage({ classId: 'boys', sessionKey: 'nope', body: friday })).ok).toBe(false)
    expect(world.upserts).toEqual([])
  })

  it('refuses an empty message, and one too long to text', async () => {
    expect(await saveMeetingMessage({ classId: 'boys', sessionKey: 'bible', body: '   ' })).toEqual({ ok: false, error: 'Write the message first.' })
    expect((await saveMeetingMessage({ classId: 'boys', sessionKey: 'bible', body: 'a'.repeat(1001) })).ok).toBe(false)
    expect(world.upserts).toEqual([])
  })
})

describe('resetMeetingMessage', () => {
  it('goes back to the standard message, and logs what it replaced', async () => {
    world.saved = { body: 'Our own words' }
    expect((await resetMeetingMessage({ classId: 'boys', sessionKey: 'bible' })).ok).toBe(true)
    expect(world.deletes).toEqual([{ where: { classId: 'boys', sessionKey: 'bible' } }])
    expect(world.audits[0]).toEqual({ action: 'message.reset', detail: expect.stringContaining('Our own words') })
  })
})

describe('recordFamilyMessage', () => {
  const sent = {
    studentId: 'mina',
    classId: 'boys',
    channel: 'whatsapp' as const,
    to: 'Mother',
    text: 'We missed Mina at Bible Study on Friday.',
    missed: { sessionKey: 'bible', date: '2026-10-16' },
  }

  it('records who messaged which family, about which meeting, for whose group, on the open case', async () => {
    world.openCase = { id: 'case1' }
    const r = await recordFamilyMessage(sent)
    expect(r).toEqual({ ok: true, data: { onCase: true } })
    expect(world.logs).toEqual([
      {
        studentId: 'mina',
        caseId: 'case1',
        method: 'whatsapp',
        note: 'To Mother: We missed Mina at Bible Study on Friday.',
        byId: 'acc-paul',
        groupServantId: 'sv-mariam',
        missedSessionKey: 'bible',
        missedOn: new Date('2026-10-16T00:00:00.000Z'),
      },
    ])
    // Only an open case in this class takes the note.
    expect(world.caseQueries[0]).toMatchObject({ where: { studentId: 'mina', classId: 'boys', status: 'OPEN' } })
    expect(world.audits[0]).toEqual({ action: 'followup.message', detail: expect.stringMatching(/Mina Saad.*whatsapp.*Mother.*Bible Study.*2026-10-16/) })
  })

  it('records it on the child alone when no case is open', async () => {
    const r = await recordFamilyMessage({ ...sent, channel: 'text' })
    expect(r).toEqual({ ok: true, data: { onCase: false } })
    expect(world.logs[0]).toMatchObject({ caseId: null, method: 'text' })
  })

  it('takes a message sent from a case’s own composer, with no meeting named', async () => {
    world.openCase = { id: 'case9' }
    const r = await recordFamilyMessage({ studentId: 'mina', classId: 'boys', channel: 'email', to: 'Parent email', text: 'Checking in', caseId: 'case9' })
    expect(r.ok).toBe(true)
    expect(world.caseQueries[0]).toMatchObject({ where: { id: 'case9', studentId: 'mina', classId: 'boys' } })
    expect(world.logs[0]).toMatchObject({ caseId: 'case9', method: 'email', missedSessionKey: null, missedOn: null })
  })

  it('refuses a case that is not this child’s in this class', async () => {
    world.openCase = null
    expect(await recordFamilyMessage({ ...sent, caseId: 'someone-else' })).toEqual({ ok: false, error: 'That case is not this child’s.' })
    expect(world.logs).toEqual([])
  })

  it('works for a child in the class only as a member', async () => {
    world.child = { ...world.child, classId: 'high-school-boys', memberships: [{ classId: 'boys' }] }
    expect((await recordFamilyMessage(sent)).ok).toBe(true)
  })

  it('refuses a child who is not in the class', async () => {
    world.child = { ...world.child, classId: 'girls' }
    expect(await recordFamilyMessage(sent)).toEqual({ ok: false, error: 'That child is not in this class.' })
    expect(world.logs).toEqual([])
  })

  it('refuses a class the servant does not follow up', async () => {
    expect((await recordFamilyMessage({ ...sent, classId: 'girls' })).ok).toBe(false)
    expect(world.logs).toEqual([])
  })

  it('still records a long message that has already gone, cut to fit', async () => {
    const long = 'We missed you. '.repeat(100)
    expect((await recordFamilyMessage({ ...sent, text: long })).ok).toBe(true)
    const note = String(world.logs[0]!.note)
    expect(note.startsWith('To Mother: We missed you.')).toBe(true)
    expect(note.endsWith('…')).toBe(true)
    expect(note.length).toBeLessThanOrEqual('To Mother: '.length + 1000)
  })

  it('refuses an empty one', async () => {
    expect(await recordFamilyMessage({ ...sent, text: '  ' })).toEqual({ ok: false, error: 'Write the message first.' })
    expect(world.logs).toEqual([])
  })

  it('refuses a date that is not one', async () => {
    expect((await recordFamilyMessage({ ...sent, missed: { sessionKey: 'bible', date: 'Friday' } })).ok).toBe(false)
    expect(world.logs).toEqual([])
  })
})
