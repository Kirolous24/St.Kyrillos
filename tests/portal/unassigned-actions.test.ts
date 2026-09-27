import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Every action in lib/portal/actions/unassigned.ts takes a child off a class,
 * puts them back, moves them or deletes them for good. A server action is a
 * public endpoint whatever the UI hides, so each one must find out who is
 * asking before it touches the database, check that person's reach, and write
 * the activity log. The unassign reason, and who gave it, must survive a
 * delete. Reading the source holds that for actions added later too.
 */
const FILE = path.resolve(__dirname, '../../lib/portal/actions/unassigned.ts')

function exportedFunctions(source: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of source.split(/export async function /).slice(1)) {
    out.set(part.slice(0, part.indexOf('(')), part.slice(0, part.search(/\n}\n/) + 2))
  }
  return out
}

describe('UNASSIGNED actions', () => {
  const source = readFileSync(FILE, 'utf8')
  const actions = exportedFunctions(source)

  it('exist', () => {
    expect(Array.from(actions.keys()).sort()).toEqual(
      ['deleteUnassigned', 'moveUnassigned', 'putBackUnassigned', 'unassignStudent'].sort(),
    )
  })

  for (const [name, body] of Array.from(actions.entries())) {
    it(`${name} knows who is asking before it touches the database`, () => {
      const who = body.indexOf('await requirePortalUser()')
      const firstDb = body.search(/prisma\./)
      expect(who, `${name} must call requirePortalUser()`).toBeGreaterThan(-1)
      expect(firstDb === -1 || who < firstDb, `${name} reads the database before requirePortalUser()`).toBe(true)
    })

    it(`${name} checks the user's reach`, () => {
      expect(body).toMatch(/can\(user, 'student\.write'|loadWaiting\(user,/)
    })

    it(`${name} writes the activity log`, () => {
      expect(body).toMatch(/await audit\(/)
    })
  }

  it("a deletion's log line keeps the reason and who unassigned the child", () => {
    const body = actions.get('deleteUnassigned')!
    expect(body).toMatch(/unassignedReason/)
    expect(body).toMatch(/unassignedBy/)
  })
})
