import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * A server action is a public endpoint whatever the page shows, so the rules
 * are held here, in the source (2026-09-28):
 * - the list every class sees is the admin's alone;
 * - a class's own activities belong to whoever gives that class points;
 * - giving points never takes an amount from the request.
 */
const source = readFileSync(path.resolve(__dirname, '../../lib/portal/actions/points.ts'), 'utf8')

function block(start: string): string {
  const at = source.indexOf(start)
  expect(at, `${start} is in the source`).toBeGreaterThan(-1)
  return source.slice(at, source.indexOf('\n}\n', at))
}
const exported = (name: string) => block(`export async function ${name}(`)

describe('who may change an activity', () => {
  it("the church-wide list is the admin's; a class's own needs points on that class", () => {
    const scope = block('async function requireActivityScope(')
    expect(scope).toMatch(/assertClassAction\(user, classId, 'points\.write'\)/)
    expect(scope).toMatch(/user\.role !== 'ADMIN'/)
  })

  it('creating checks that before touching the database', () => {
    const body = exported('createActivity')
    const guard = body.indexOf('await requireActivityScope(')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(body.search(/prisma\./))
    expect(body).toMatch(/await audit\(/)
  })

  for (const name of ['updateActivity', 'removeActivity']) {
    it(`${name} checks the activity's own class, or the admin, before writing`, () => {
      const body = exported(name)
      const guard = body.indexOf('await requireActivityScope(act.classId)')
      expect(guard).toBeGreaterThan(-1)
      expect(guard).toBeLessThan(body.indexOf('prisma.pointActivity.update'))
      expect(body).toMatch(/await audit\(/)
    })
  }

  it('an update never moves an activity between classes', () => {
    expect(exported('updateActivity')).not.toMatch(/classId:\s*null/)
  })
})

describe('giving points', () => {
  it('takes no amount from the request', () => {
    const schema = source.slice(source.indexOf('const GiveSchema'), source.indexOf('export type GivePointsInput'))
    expect(schema).not.toMatch(/\bpoints\s*:/)
    const body = exported('givePoints')
    expect(body).toMatch(/resolveManualPoints\(input\.mode, activity, input\.reason, cls\.id\)/)
    expect(body).not.toMatch(/input\.points/)
  })
})
