import { describe, it, expect } from 'vitest'
import { statSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { navForUser, mobileNavForUser, userMenuForUser, classWorkspaceNav } from '@/lib/portal/nav'
import { authConfig } from '@/lib/auth.config'
import type { PortalUser } from '@/lib/portal/permissions'

// Every row on a sidebar, phone bar or avatar menu must actually open for the
// role that is shown it. Two separate things can break that, and both have:
//
//   1. the route does not exist, so the row 404s;
//   2. the route exists but `lib/auth.config.ts` bounces that role before the
//      page's own check runs — which is how a student got an Announcements row
//      that threw them back to the dashboard (F0279), and how the announcement
//      *notification* had been a dead end since it was pointed there.
//
// Checking the page component's own gate is not enough; the middleware runs
// first. This test reads both.

const APP = path.resolve(__dirname, '../../app')

const user = (over: Partial<PortalUser> & Pick<PortalUser, 'role'>): PortalUser => ({
  accountId: 'acc1',
  displayName: 'Test',
  classIds: [],
  coordinatorOf: [],
  stageOversight: null,
  ...over,
})

const ROLES = ['ADMIN', 'PASTOR', 'SERVANT', 'STUDENT'] as const

/** Strips the query string: `/portal/qr?tab=group` is served by `/portal/qr`. */
const routeOf = (href: string) => href.split('?')[0]!

/**
 * Walks one URL down the app directory, accepting a literal folder or, failing
 * that, a dynamic one (`[id]`, `[...slug]`).
 *
 * The dynamic half was added for the admin class workspace, whose rows carry a
 * real class id — `/portal/classes/grade-3` is served by `classes/[id]`. Every
 * other rail is static, so the original helper compared literal paths and would
 * have reported that whole rail as broken.
 */
function resolvesFrom(base: string, segments: string[]): boolean {
  if (segments.length === 0) {
    try {
      return statSync(path.join(base, 'page.tsx')).isFile()
    } catch {
      return false
    }
  }
  const [head, ...rest] = segments
  const literal = path.join(base, head!)
  try {
    if (statSync(literal).isDirectory() && resolvesFrom(literal, rest)) return true
  } catch {
    /* fall through to a dynamic segment */
  }
  let entries: string[] = []
  try {
    entries = readdirSync(base)
  } catch {
    return false
  }
  for (const entry of entries) {
    if (!entry.startsWith('[')) continue
    const dyn = path.join(base, entry)
    try {
      if (statSync(dyn).isDirectory() && resolvesFrom(dyn, rest)) return true
    } catch {
      /* keep looking */
    }
  }
  return false
}

/** Does a `page.tsx` exist for this path, counting route groups and [id] segments? */
function routeExists(route: string): boolean {
  const segments = route.replace(/^\//, '').split('/')
  return (
    resolvesFrom(APP, segments) ||
    // The portal lives inside the (app) route group, which is not in the URL.
    resolvesFrom(path.join(APP, 'portal', '(app)'), segments.slice(1)) ||
    resolvesFrom(path.join(APP, 'portal', '(app)', '(home)'), segments.slice(1))
  )
}

function bounced(pathname: string, role: string): boolean {
  const authorized = authConfig.callbacks!.authorized!
  const result = authorized({
    auth: { user: { kind: 'portal', role } },
    request: { nextUrl: new URL(`https://stkyrillostn.org${pathname}`) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  return result !== true
}

describe('every nav row resolves for the role that sees it', () => {
  for (const role of ROLES) {
    // A servant with one class and no stage takes the F0332 "Class Profile"
    // branch, whose href is built from the class id; the many-class servant
    // takes the list. Both shapes are checked.
    const people: PortalUser[] =
      role === 'SERVANT'
        ? [user({ role, classIds: ['kg1'] }), user({ role, classIds: ['kg1', 'kg2'], stageOversight: 'ELEMENTARY' })]
        : [user({ role })]

    people.forEach((u, i) => {
      const lists = {
        sidebar: navForUser(u),
        'phone bar': mobileNavForUser(u),
        'avatar menu': userMenuForUser(u),
      }
      for (const [which, items] of Object.entries(lists)) {
        it(`${role}${people.length > 1 ? ` (#${i + 1})` : ''}: every ${which} row exists as a route`, () => {
          const missing = items
            .map((n) => routeOf(n.href))
            // A dynamic class page is served by classes/[id]/page.tsx.
            .map((r) => (/^\/portal\/classes\/[^/]+$/.test(r) ? '/portal/classes/[id]' : r))
            .filter((r) => !routeExists(r))
          expect(missing).toEqual([])
        })

        it(`${role}${people.length > 1 ? ` (#${i + 1})` : ''}: the middleware lets this role into every ${which} row`, () => {
          const blocked = items
            .map((n) => routeOf(n.href))
            .map((r) => (/^\/portal\/classes\/[^/]+$/.test(r) ? '/portal/classes/kg1' : r))
            .filter((r) => bounced(r, role))
          expect(blocked).toEqual([])
        })
      }

      it(`${role}${people.length > 1 ? ` (#${i + 1})` : ''}: no href appears twice on the sidebar`, () => {
        const hrefs = navForUser(u).map((n) => n.href)
        expect(hrefs.length).toBe(new Set(hrefs).size)
      })

      it(`${role}${people.length > 1 ? ` (#${i + 1})` : ''}: each sidebar group name appears in one contiguous run`, () => {
        // Shell builds groups from consecutive runs of `section`, so a section
        // that appears twice draws its heading twice.
        const runs: (string | undefined)[] = []
        for (const item of navForUser(u)) {
          if (runs[runs.length - 1] !== item.section) runs.push(item.section)
        }
        const named = runs.filter((r): r is string => !!r)
        expect(named.length).toBe(new Set(named).size)
      })
    })
  }

  it('sends a student to the announcements page rather than bouncing them', () => {
    expect(bounced('/portal/announcements', 'STUDENT')).toBe(false)
    // The notification points there too; it was a dead end while this bounced.
    expect(bounced('/portal/announcements', 'SERVANT')).toBe(false)
  })

  it('still keeps a student out of the staff pages', () => {
    for (const p of ['/portal/classes', '/portal/reports', '/portal/reports/cards', '/portal/exams', '/portal/follow-ups']) {
      expect(bounced(p, 'STUDENT')).toBe(true)
    }
  })
})

/**
 * The admin's class workspace (the prototype's `adOpenClassView`). Every row is
 * class-scoped, so each one has to resolve to a real page *and* survive the
 * middleware for an ADMIN — the same two checks the ordinary rails get, and the
 * pair that has produced a dead sidebar link four times in this project.
 */
describe('the admin class workspace rail', () => {
  const CLASS_ID = 'grade-3'
  const rows = classWorkspaceNav(CLASS_ID, true)

  it('offers the prototype\u2019s class workspace rows', () => {
    const labels = rows.map((r) => r.label)
    for (const expected of [
      'Students', 'Attendance', 'Points', 'QR Attendance', 'QR Points',
      'Follow-up', 'Attendance Report', 'Student Reports',
    ]) {
      expect(labels).toContain(expected)
    }
  })

  it('resolves every row to a real page', () => {
    for (const row of rows) {
      expect(routeExists(routeOf(row.href)), `${row.label} -> ${row.href}`).toBe(true)
    }
  })

  it('lets an ADMIN through the middleware on every row', () => {
    for (const row of rows) {
      expect(bounced(routeOf(row.href), 'ADMIN'), `${row.label} -> ${row.href}`).toBe(false)
    }
  })

  it('scopes every row to the class it was opened from', () => {
    // A row that looks scoped and quietly is not is worse than no row: it sends
    // an admin to another class's register believing it is this one.
    for (const row of rows) {
      expect(row.href.includes(CLASS_ID), `${row.label} -> ${row.href}`).toBe(true)
    }
  })

  it('keeps Logins & PINs out of a non-admin workspace', () => {
    expect(classWorkspaceNav(CLASS_ID, false).map((r) => r.label)).not.toContain('Logins & PINs')
    expect(rows.map((r) => r.label)).toContain('Logins & PINs')
  })
})
