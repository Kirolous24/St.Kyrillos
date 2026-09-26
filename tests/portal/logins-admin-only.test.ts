import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Every action in lib/portal/actions/logins.ts reads or changes somebody's
 * login: it can show a PIN, export them all, or issue new ones. A server action
 * is a public endpoint whatever the UI hides, so each one must start with
 * requireAdmin() and must write the activity log. Reading the source holds that
 * for actions added later too.
 */
const FILE = path.resolve(__dirname, '../../lib/portal/actions/logins.ts')

function exportedFunctions(source: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of source.split(/export async function /).slice(1)) {
    out.set(part.slice(0, part.indexOf('(')), part)
  }
  return out
}

describe('admin logins actions', () => {
  const actions = exportedFunctions(readFileSync(FILE, 'utf8'))

  it('exist', () => {
    expect(Array.from(actions.keys()).sort()).toEqual(
      ['emailLogins', 'exportLoginsCsv', 'recoverPinsBatch', 'reissuePins', 'revealLogins'].sort(),
    )
  })

  for (const [name, body] of Array.from(actions.entries())) {
    it(`${name} checks for the admin before it touches the database`, () => {
      const guard = body.indexOf('await requireAdmin()')
      const firstDb = body.search(/prisma\./)
      expect(guard, `${name} must call requireAdmin()`).toBeGreaterThan(-1)
      expect(firstDb === -1 || guard < firstDb, `${name} reads the database before requireAdmin()`).toBe(true)
    })

    it(`${name} writes the activity log`, () => {
      expect(body).toMatch(/await audit\(/)
    })
  }
})
