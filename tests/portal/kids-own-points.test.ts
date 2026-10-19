import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { authConfig } from '@/lib/auth.config'
import { navForUser, mobileNavForUser, userMenuForUser } from '@/lib/portal/nav'
import { seesClassmatesPoints, type PortalUser } from '@/lib/portal/permissions'

/**
 * Kids see their own points and scores, and nothing that ranks them against
 * other children (2026-10-19): no leaderboard, no class rank, no "points vs the
 * leader". Servants, the admin and the pastor still see all of it.
 */

const ROOT = path.resolve(__dirname, '../..')
const APP = path.join(ROOT, 'app')

function bounced(pathname: string, role: PortalUser['role']): boolean {
  const authorized = authConfig.callbacks!.authorized!
  const result = authorized({
    auth: { user: { kind: 'portal', role } },
    request: { nextUrl: new URL(`https://stkyrillostn.org${pathname}`) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  return result !== true
}

const kid: PortalUser = { accountId: 'k', role: 'STUDENT', displayName: 'K', studentId: 'stu1', classIds: ['kg'], coordinatorOf: [], assistantOf: [], stageOversight: null }

describe('the leaderboard is for staff', () => {
  it('turns a child away at the door', () => {
    expect(bounced('/portal/leaderboard', 'STUDENT')).toBe(true)
    expect(bounced('/portal/leaderboard?class=kg', 'STUDENT')).toBe(true)
  })

  it('still opens for servants, the admin and the pastor', () => {
    for (const role of ['SERVANT', 'ADMIN', 'PASTOR'] as const) expect(bounced('/portal/leaderboard', role)).toBe(false)
  })

  it('is on none of a child’s menus', () => {
    const hrefs = [...navForUser(kid), ...mobileNavForUser(kid), ...userMenuForUser(kid)].map((n) => n.href.split('?')[0])
    expect(hrefs).not.toContain('/portal/leaderboard')
  })

  it('refuses a child on the page itself too', () => {
    const page = readFileSync(path.join(APP, 'portal/(app)/leaderboard/page.tsx'), 'utf8')
    expect(page).toMatch(/seesClassmatesPoints\(user\)/)
  })
})

describe('seesClassmatesPoints', () => {
  it('is false for a child and true for everyone who looks after them', () => {
    expect(seesClassmatesPoints({ role: 'STUDENT' })).toBe(false)
    for (const role of ['SERVANT', 'ADMIN', 'PASTOR'] as const) expect(seesClassmatesPoints({ role })).toBe(true)
  })
})

/** Every page.tsx under app/portal, with the URL it serves. */
function portalPages(dir = path.join(APP, 'portal'), url = '/portal'): Array<{ file: string; url: string }> {
  const out: Array<{ file: string; url: string }> = []
  for (const entry of readdirSync(dir)) {
    // iCloud's "page 2.tsx" / "(app) 2" copies are not routes.
    if (/ \d+(\.|$)/.test(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(entry) ? '' : entry.startsWith('[') ? '/x' : `/${entry}`
      out.push(...portalPages(full, `${url}${segment}`))
    } else if (entry === 'page.tsx') {
      out.push({ file: full, url })
    }
  }
  return out
}

describe('no page a child can open ranks them against other children', () => {
  const ranking = portalPages().filter(({ file }) => /rankStudents\(|classTotals\(/.test(readFileSync(file, 'utf8')))

  it('finds the pages that rank children', () => {
    // A guard that matches nothing guards nothing.
    expect(ranking.length).toBeGreaterThan(3)
  })

  for (const { file, url } of ranking) {
    const rel = path.relative(ROOT, file)
    it(`${rel} is staff-only or asks seesClassmatesPoints first`, () => {
      if (bounced(url, 'STUDENT')) return
      expect(readFileSync(file, 'utf8')).toMatch(/seesClassmatesPoints\(/)
    })
  }
})

describe('a child’s dashboard', () => {
  const home = readFileSync(path.join(APP, 'portal/(app)/(home)/page.tsx'), 'utf8')
  const kidHome = home.slice(home.indexOf('async function StudentHome('))
  const data = readFileSync(path.join(ROOT, 'lib/portal/data/dashboard.ts'), 'utf8')
  const overview = data.slice(data.indexOf('export async function studentOverview('), data.indexOf('\n}\n', data.indexOf('export async function studentOverview(')))

  it('shows no leaderboard, no rank and no comparison with the leader', () => {
    expect(kidHome.length).toBeGreaterThan(100)
    expect(kidHome).not.toMatch(/Class leaderboard|My rank|Points vs leader|\/portal\/leaderboard|leaderPoints|top3|data\.rank/)
  })

  it('is built without anybody else’s points', () => {
    expect(overview.length).toBeGreaterThan(100)
    expect(overview).not.toMatch(/classTotals\(|rankStudents\(|leaderPoints|top3/)
  })
})
