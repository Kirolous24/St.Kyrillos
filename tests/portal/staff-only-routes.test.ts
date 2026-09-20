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
