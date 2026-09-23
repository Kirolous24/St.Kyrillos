import { describe, it, expect } from 'vitest'
import { authConfig } from '@/lib/auth.config'

type Role = 'STUDENT' | 'SERVANT' | 'ADMIN' | 'PASTOR'

function visit(pathname: string, role: Role): 'allowed' | 'bounced' {
  const authorized = authConfig.callbacks!.authorized!
  const result = authorized({
    auth: { user: { kind: 'portal', role } },
    request: { nextUrl: new URL(`https://stkyrillostn.org${pathname}`) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  return result === true ? 'allowed' : 'bounced'
}

// The class pages render the staff roster: every classmate's attendance rate,
// follow-up badge and import-notes flag. `class.read` is still granted to a
// student for their own class (the feed needs it), so the route itself has to
// be closed rather than the permission narrowed.
describe('middleware: /portal/classes is staff-only', () => {
  for (const pathname of ['/portal/classes', '/portal/classes/abc123', '/portal/classes/abc123/attendance']) {
    it(`turns a student away from ${pathname}`, () => {
      expect(visit(pathname, 'STUDENT')).toBe('bounced')
    })

    it(`lets staff through to ${pathname}`, () => {
      expect(visit(pathname, 'SERVANT')).toBe('allowed')
      expect(visit(pathname, 'ADMIN')).toBe('allowed')
    })
  }

  it('does not block student routes that merely start with the same letters', () => {
    expect(visit('/portal/my-qr', 'STUDENT')).toBe('allowed')
    expect(visit('/portal/leaderboard', 'STUDENT')).toBe('allowed')
    expect(visit('/portal/feed', 'STUDENT')).toBe('allowed')
  })
})

// The pastor's job is oversight and the prototype's pastor overview carried the
// whole church's servant roster. The port had no servant list anywhere else and
// this middleware bounced PASTOR before the page's own check ran.
describe('middleware: the pastor may read the servant roster, not edit it', () => {
  it('lets the pastor open the roster', () => {
    expect(visit('/portal/admin/servants', 'PASTOR')).toBe('allowed')
  })

  // Exact-match, deliberately: /portal/admin/servants/<id> is an edit screen,
  // so opening the prefix would have made every roster tile a link to a 404.
  it('still turns the pastor away from the edit screens under it', () => {
    expect(visit('/portal/admin/servants/abc123', 'PASTOR')).toBe('bounced')
    expect(visit('/portal/admin/servants/new', 'PASTOR')).toBe('bounced')
  })

  it('leaves the rest of /portal/admin closed to the pastor', () => {
    expect(visit('/portal/admin/students', 'PASTOR')).toBe('bounced')
    expect(visit('/portal/admin/data', 'PASTOR')).toBe('bounced')
    expect(visit('/portal/admin/settings', 'PASTOR')).toBe('bounced')
  })

  it('keeps the activity log open to the pastor, sub-pages included', () => {
    expect(visit('/portal/admin/audit', 'PASTOR')).toBe('allowed')
    expect(visit('/portal/admin/audit/anything', 'PASTOR')).toBe('allowed')
  })

  it('does not open any of it to a servant or a student', () => {
    expect(visit('/portal/admin/servants', 'SERVANT')).toBe('bounced')
    expect(visit('/portal/admin/servants', 'STUDENT')).toBe('bounced')
  })
})
