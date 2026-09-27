import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Points are the same in every class (2026-09-27). A server action is a public
 * endpoint whatever the page shows, so the rule is held here, in the source:
 * only the admin changes the church-wide activity list, and giving points never
 * takes an amount from the request. The activity's set value, or the fixed
 * deduction, is all that can be written.
 */
const source = readFileSync(path.resolve(__dirname, '../../lib/portal/actions/points.ts'), 'utf8')

function exported(name: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  expect(start, `${name} is exported`).toBeGreaterThan(-1)
  const end = source.indexOf('\n}\n', start)
  return source.slice(start, end)
}

describe('the points actions keep points fair across classes', () => {
  for (const name of ['createActivity', 'updateActivity', 'removeActivity']) {
    it(`${name} is the admin's alone, checked before the database`, () => {
      const body = exported(name)
      const guard = body.indexOf('await requireAdmin()')
      const firstDb = body.search(/prisma\./)
      expect(guard).toBeGreaterThan(-1)
      expect(firstDb === -1 || guard < firstDb).toBe(true)
      expect(body).toMatch(/await audit\(/)
    })
  }

  it('creating an activity makes it church-wide, never a class’s own', () => {
    expect(exported('createActivity')).toMatch(/classId: null/)
    expect(exported('createActivity')).not.toMatch(/assertClassAction/)
  })

  it('giving points takes no amount from the request', () => {
    const schema = source.slice(source.indexOf('const GiveSchema'), source.indexOf('export type GivePointsInput'))
    expect(schema).not.toMatch(/\bpoints\s*:/)
    const body = exported('givePoints')
    expect(body).toMatch(/resolveManualPoints\(/)
    expect(body).not.toMatch(/input\.points/)
  })
})
