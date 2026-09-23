/**
 * HTTP smoke test for the Sunday School portal.
 * Signs in as one account per role through the NextAuth credentials provider,
 * then GETs every portal route and asserts status + role gating.
 *
 *   node scripts/portal-smoke.mjs [baseUrl]
 *
 * Credentials come from the gitignored Firebase backup; they are never printed.
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:3000'
const REPO = path.resolve(new URL('..', import.meta.url).pathname)
const BACKUP = path.join(REPO, '_incoming/sunday-school/data/stkyrillos_full_backup_2026-09-18.json')

const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'))
const users = backup.users

function pick(role, predicate = () => true) {
  const u = users.find((x) => x.role === role && x.loginId && x.pin && predicate(x))
  if (!u) throw new Error(`no ${role} account with a loginId+pin in the backup`)
  return { role, loginId: String(u.loginId), pin: String(u.pin), name: u.name, classId: u.classId }
}

const ACCOUNTS = [
  pick('admin'),
  pick('pastor', (u) => !!u.loginId),
  pick('servant', (u) => !!u.classId),
  pick('student', (u) => !!u.classId),
]

/* ── a tiny cookie jar ─────────────────────────────────────────────────── */
class Jar {
  constructor() { this.cookies = new Map() }
  store(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : []
    for (const line of raw) {
      const [pair] = line.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}

// Vercel preview deployments sit behind SSO. A Protection Bypass for Automation
// secret lets this harness through while humans still hit the login wall.
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const BYPASS_HEADERS = BYPASS ? { 'x-vercel-protection-bypass': BYPASS, 'x-vercel-set-bypass-cookie': 'true' } : {}

async function get(jar, url, opts = {}) {
  const res = await fetch(new URL(url, BASE), {
    redirect: 'manual',
    ...opts,
    // Must come after ...opts: opts.headers would otherwise replace the jar.
    headers: { cookie: jar.header(), ...BYPASS_HEADERS, ...(opts.headers || {}) },
  })
  jar.store(res)
  return res
}

async function signIn(account) {
  const jar = new Jar()
  const csrfRes = await get(jar, '/api/auth/csrf')
  const { csrfToken } = await csrfRes.json()
  const body = new URLSearchParams({
    loginId: account.loginId,
    pin: account.pin,
    csrfToken,
    callbackUrl: `${BASE}/portal`,
    json: 'true',
  })
  const res = await get(jar, '/api/auth/callback/portal', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  const hasSession = [...jar.cookies.keys()].some((k) => k.includes('session-token'))
  if (!hasSession) throw new Error(`sign-in failed for ${account.role} (status ${res.status}) ${text.slice(0, 200)}`)
  return jar
}

/* ── the route matrix ──────────────────────────────────────────────────── */
// ok  = expect 200
// gone = expect 404 or a redirect away (role must not reach it)
const ROUTES = {
  common: ['/portal', '/portal/settings', '/portal/leaderboard', '/portal/birthdays', '/portal/hymns', '/portal/events', '/portal/feed'],
  admin: {
    notFound: ['/portal/classes/does-not-exist', '/portal/students/nope123', '/portal/exams/nope123'],
    ok: [
      '/portal/classes', '/portal/admin/students', '/portal/admin/servants', '/portal/admin/classes',
      '/portal/admin/sessions', '/portal/admin/audit', '/portal/admin/data', '/portal/follow-ups',
      '/portal/exams', '/portal/exams/new', '/portal/exams/import', '/portal/lessons', '/portal/agenda',
      '/portal/agenda/week', '/portal/qr', '/portal/servant-attendance', '/portal/servant-attendance/report',
      '/portal/my-attendance', '/portal/announcements', '/portal/reports', '/portal/reports/cards',
      '/portal/reports?tab=church', '/portal/reports?view=all', '/portal/reports?tab=church&period=all',
      '/portal/reports?tab=church&mode=exams', '/portal/reports?tab=church&mode=points',
      '/portal/readings', '/portal/photo',
    ],
    gone: [],
  },
  pastor: {
    ok: [
      '/portal/classes', '/portal/follow-ups', '/portal/lessons', '/portal/exams', '/portal/announcements',
      '/portal/reports', '/portal/reports?tab=church', '/portal/reports?view=all', '/portal/readings',
    ],
    // /portal/admin/audit is deliberately open to the pastor as well as the admin
    // (see app/portal/(app)/admin/audit/page.tsx), so it is not listed here.
    // /portal/admin/servants joined it: the prototype's pastor overview carried
    // the church-wide servant roster and the port had no list anywhere else.
    // It is read-only, and its <id>/new edit screens stay closed — see `gone`.
    ok2: ['/portal/admin/audit', '/portal/admin/servants'],
    gone: [
      '/portal/admin/data',
      '/portal/admin/servants/new',
      '/portal/admin/students',
      '/portal/admin/sessions',
    ],
    notFound: ['/portal/classes/does-not-exist', '/portal/students/nope123'],
  },
  servant: {
    ok: [
      '/portal/classes', '/portal/follow-ups', '/portal/exams', '/portal/lessons', '/portal/agenda',
      '/portal/assignments', '/portal/qr', '/portal/servant-attendance', '/portal/my-attendance',
      '/portal/announcements', '/portal/reports', '/portal/reports?view=all', '/portal/readings', '/portal/photo',
    ],
    gone: ['/portal/admin/data', '/portal/admin/servants', '/portal/admin/students', '/portal/admin/audit', '/portal/admin/sessions'],
    notFound: [
      '/portal/classes/does-not-exist',
      '/portal/classes/high-school-girls',
      '/portal/students/nope123',
      '/portal/exams/nope123',
      '/portal/follow-ups/nope123',
    ],
  },
  student: {
    ok: ['/portal/quizzes', '/portal/achievements', '/portal/readings', '/portal/my-attendance', '/portal/my-qr'],
    gone: [
      '/portal/admin/data', '/portal/admin/students', '/portal/admin/servants', '/portal/admin/audit',
      '/portal/exams', '/portal/exams/new', '/portal/qr', '/portal/reports', '/portal/servant-attendance',
      '/portal/agenda', '/portal/lessons', '/portal/assignments',
    ],
  },
}

let pass = 0
const failures = []

function record(ok, label, detail) {
  if (ok) { pass += 1; return }
  failures.push(`${label} — ${detail}`)
}

async function checkOk(jar, role, route) {
  const res = await get(jar, route)
  const body = res.status === 200 ? await res.text() : ''
  const serverError = /Application error|Internal Server Error|digest&quot;|__next_error__/.test(body)
  record(res.status === 200 && !serverError, `${role} GET ${route}`, serverError ? 'rendered an error boundary' : `status ${res.status}${res.headers.get('location') ? ' -> ' + res.headers.get('location') : ''}`)
}

/**
 * A resource that does not exist, or that this person may not open, must come
 * back as a real 404 — not a 200 carrying the not-found UI. A Suspense
 * boundary above a page (a `loading.tsx`) makes Next flush 200 before the
 * page's guard runs, which once silently turned four permission checks into
 * 200s. These assertions are here so that cannot happen quietly again.
 */
async function checkNotFound(jar, role, route) {
  const res = await get(jar, route)
  record(res.status === 404, `${role} 404 ${route}`, `expected 404, got ${res.status}`)
}

async function checkGone(jar, role, route) {
  const res = await get(jar, route)
  const blocked = res.status === 404 || res.status === 403 || (res.status >= 300 && res.status < 400)
  record(blocked, `${role} BLOCKED ${route}`, `expected 404/redirect, got ${res.status}`)
}

async function main() {
  // Unauthenticated: the portal must bounce to the sign-in page.
  const anon = new Jar()
  for (const route of ['/portal', '/portal/admin/data', '/portal/exams', '/portal/reports']) {
    const res = await get(anon, route)
    const bounced = res.status >= 300 && res.status < 400 && (res.headers.get('location') || '').includes('login')
    record(bounced, `anon BLOCKED ${route}`, `expected redirect to login, got ${res.status} -> ${res.headers.get('location')}`)
  }
  const loginRes = await get(anon, '/portal/login')
  record(loginRes.status === 200, 'anon GET /portal/login', `status ${loginRes.status}`)

  for (const account of ACCOUNTS) {
    let jar
    try {
      jar = await signIn(account)
      pass += 1
    } catch (err) {
      failures.push(`sign-in ${account.role} — ${err.message}`)
      continue
    }
    const plan = ROUTES[account.role]
    for (const route of [...ROUTES.common, ...plan.ok, ...(plan.ok2 || [])]) await checkOk(jar, account.role, route)
    for (const route of plan.gone) await checkGone(jar, account.role, route)
    for (const route of plan.notFound ?? []) await checkNotFound(jar, account.role, route)
  }

  console.log(`\n${pass} passed, ${failures.length} failed`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log('  ✗ ' + f)
    process.exitCode = 1
  } else {
    console.log('all smoke checks passed')
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
