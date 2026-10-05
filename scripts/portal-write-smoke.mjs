/**
 * Write-path smoke test for the Sunday School portal.
 *
 * portal-smoke.mjs only issues GETs, so it cannot see a broken Server Action —
 * that is how `export const ServantFormSchema` (illegal in a "use server" file)
 * shipped with all 15 admin write actions dead behind a 500. This drives the
 * real forms in a real browser and asserts the database actually changed.
 *
 *   node --env-file=.env scripts/portal-write-smoke.mjs [baseUrl]
 *
 * REFUSES TO RUN against the production endpoint. Everything it creates is
 * prefixed ZZSMOKE and removed in cleanup, even when an assertion fails.
 */
import { chromium } from 'playwright-core'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:3000'
const PROD_ENDPOINT = 'ep-dark-term-ai3c2hag'
const TAG = 'ZZSMOKE'

/* ── refuse production ──────────────────────────────────────────────────── */
const url = process.env.DATABASE_URL || ''
const endpoint = (url.match(/@([^/?]+)/) || [])[1] || '(none)'
if (!url) { console.error('DATABASE_URL is not set. Run with: node --env-file=.env …'); process.exit(1) }
if (endpoint.includes(PROD_ENDPOINT)) {
  console.error(`\n  REFUSING TO RUN — ${endpoint} is the PRODUCTION database.`)
  console.error('  This suite creates and deletes records. Point DATABASE_URL at the dev branch.\n')
  process.exit(1)
}
console.log(`database : ${endpoint}`)
console.log(`base url : ${BASE}\n`)

const prisma = new PrismaClient()
const REPO = path.resolve(new URL('..', import.meta.url).pathname)
const backup = JSON.parse(fs.readFileSync(path.join(REPO, '_incoming/sunday-school/data/stkyrillos_full_backup_2026-09-18.json'), 'utf8'))
const admin = backup.users.find((u) => u.role === 'admin' && u.loginId && u.pin)
if (!admin) { console.error('no admin account with loginId+pin in the backup'); process.exit(1) }

let passed = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok    ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

/* ── browser helpers ────────────────────────────────────────────────────── */
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
page.on('dialog', (d) => d.accept())           // confirm() on delete / reset PIN
const serverErrors = []
page.on('response', (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`) })

const go = async (p) => { await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(400) }
/**
 * Submit a form and wait for the write to have actually happened.
 *
 * A fixed 2.5s was not enough on a cold `next dev`: the server action's route
 * compiles on first use, so the check read the database before the write landed
 * and reported a failure that a warm re-run did not reproduce. Waiting for the
 * button to stop being busy, and for the page to settle, makes the timing the
 * app's rather than a guess. `verify` is an optional predicate polled until it
 * is true, for the writes whose effect is only visible in the database.
 */
const save = async (label, verify) => {
  const button = page.locator('button[type="submit"]', { hasText: label })
  await button.click()
  // The action is in flight while the button is disabled; give the transition a
  // moment to start before waiting for it to finish.
  await page.waitForTimeout(250)
  await button.evaluate((el) => el).catch(() => {})
  await page
    .waitForFunction(
      (text) => {
        const btns = Array.from(document.querySelectorAll('button[type="submit"]'))
        const b = btns.find((x) => (x.textContent || '').includes(text))
        return !b || !b.disabled
      },
      label,
      { timeout: 30000 },
    )
    .catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
  if (verify) {
    const deadline = Date.now() + 30000
    // eslint-disable-next-line no-await-in-loop
    while (Date.now() < deadline && !(await verify())) await page.waitForTimeout(500)
  } else {
    // No predicate to wait on, so keep the original settle. Trusting the
    // button-enabled heuristic alone here shortened this from 2.5s to 0.5s and
    // broke three checks that had nothing wrong with them.
    await page.waitForTimeout(2500)
  }
}
const toggleClass = async (name) => {
  await page.locator('label:has(input[type="checkbox"])', { hasText: name }).first().locator('input[type="checkbox"]').click()
}

async function signIn() {
  await go('/portal/login')
  await page.waitForTimeout(1500)                                  // hydration
  await page.locator('#loginId').pressSequentially(String(admin.loginId), { delay: 30 })
  await page.locator('#pin').pressSequentially(String(admin.pin), { delay: 30 })
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 })
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !String(u).includes('/portal/login'), { timeout: 30000 })
}

/**
 * The two-people register check writes on a date before the portal existed,
 * so nothing real is ever there; its rows, points and audit lines go on cleanup.
 */
const REGISTER_DATE = '2025-06-01'
const runStarted = new Date()
let register = null                                                  // { classId, sessionKey }

async function cleanupRegister() {
  if (!register) return 0
  const where = { classId: register.classId, date: new Date(`${REGISTER_DATE}T00:00:00Z`), sessionKey: register.sessionKey }
  const rows = await prisma.attendanceRecord.deleteMany({ where })   // linked awards cascade
  // Compensating rows are not linked to a record; only this run's are removed.
  await prisma.pointEntry.deleteMany({
    where: { classId: register.classId, activityKey: register.sessionKey, attendanceRecordId: null, createdAt: { gte: runStarted } },
  })
  await prisma.portalAuditLog.deleteMany({
    where: { entityId: register.classId, action: 'attendance.save', createdAt: { gte: runStarted } },
  })
  return rows.count
}

async function cleanup() {
  const accounts = await prisma.account.findMany({ where: { displayName: { startsWith: TAG } }, select: { id: true } })
  for (const a of accounts) await prisma.account.delete({ where: { id: a.id } }).catch(() => {})
  const students = await prisma.student.findMany({ where: { firstName: { startsWith: TAG } }, select: { accountId: true } })
  for (const s of students) await prisma.account.delete({ where: { id: s.accountId } }).catch(() => {})
  // The composer check below publishes a real post; it is swept by title.
  const posts = await prisma.feedPost.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } })
  for (const p of posts) {
    await prisma.feedReaction.deleteMany({ where: { postId: p.id } }).catch(() => {})
    await prisma.feedPost.delete({ where: { id: p.id } }).catch(() => {})
  }
  return accounts.length + students.length + posts.length
}

/* ── scenarios ──────────────────────────────────────────────────────────── */
try {
  await cleanup()                                                   // leftovers from a crashed run
  await signIn()
  check('sign in as admin', !page.url().includes('/portal/login'), page.url())

  const classes = await prisma.schoolClass.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  const [c1, c2] = [classes[1], classes[2]]                         // two ordinary classes

  /* ---- servants (lib/portal/actions/admin.ts) ---- */
  console.log('\nservants')
  await go('/portal/admin/servants/new')
  await page.locator('#displayName').fill(`${TAG} Servant`)
  await toggleClass(c1.name)
  await save('Create account', async () =>
    (await prisma.account.count({ where: { displayName: `${TAG} Servant` } })) > 0,
  )
  const servantAcct = await prisma.account.findFirst({
    where: { displayName: `${TAG} Servant` },
    select: { id: true, pinHash: true, servant: { select: { id: true, classes: { select: { classId: true } } } } },
  })
  check('createServant writes the account', !!servantAcct)
  check('createServant assigns the class', servantAcct?.servant?.classes?.[0]?.classId === c1.id,
    JSON.stringify(servantAcct?.servant?.classes))

  if (servantAcct) {
    await go(`/portal/admin/servants/${servantAcct.id}`)
    await toggleClass(c1.name)                                      // off
    await toggleClass(c2.name)                                      // on
    await save('Save changes')
    const after = await prisma.classServant.findMany({ where: { servantId: servantAcct.servant.id }, select: { classId: true } })
    check('updateServant moves the class', after.length === 1 && after[0].classId === c2.id, JSON.stringify(after))

    await go(`/portal/admin/servants/${servantAcct.id}`)
    // The reset moved into the Sign-in card above the form (option B).
    await page.locator('button', { hasText: 'Reissue PIN' }).first().click()
    await page.waitForTimeout(2500)
    const reset = await prisma.account.findUnique({ where: { id: servantAcct.id }, select: { pinHash: true } })
    check('resetServantPin changes the hash', !!reset && reset.pinHash !== servantAcct.pinHash)
  }

  /* ---- students (lib/portal/actions/students.ts) ---- */
  console.log('\nstudents')
  await go(`/portal/classes/${c1.id}/students/new`)
  await page.locator('#firstName').fill(`${TAG}`)
  await page.locator('#lastName').fill('Student')
  await save('Add student')
  let student = await prisma.student.findFirst({
    where: { firstName: TAG }, select: { id: true, accountId: true, classId: true, grade: true },
  })
  check('createStudent writes the row', !!student)
  check('createStudent lands in the class', student?.classId === c1.id, String(student?.classId))

  if (student) {
    await go(`/portal/students/${student.id}/edit`)
    await page.locator('#grade').fill('7th')
    await save('Save changes')
    const edited = await prisma.student.findUnique({ where: { id: student.id }, select: { grade: true } })
    check('updateStudent persists a field', edited?.grade === '7th', String(edited?.grade))

    await go('/portal/admin/students')
    // The roster is a card grid inside collapsed <details> accordions; open them
    // all, then anchor on the card's Edit link, whose aria-label is unique.
    await page.$$eval('details', (els) => els.forEach((d) => { d.open = true }))
    await page.waitForTimeout(300)
    const card = page.locator(`a[aria-label="Edit ${TAG} Student"]`).locator('xpath=ancestor::div[1]')
    const select = card.locator('select').first()
    if (await select.count()) {
      await select.selectOption(c2.id)
      await page.waitForTimeout(2500)
      const moved = await prisma.student.findUnique({ where: { id: student.id }, select: { classId: true } })
      check('moveStudent changes the class', moved?.classId === c2.id, String(moved?.classId))
    } else check('moveStudent changes the class', false, 'no class <select> found on the admin students row')

    await go(`/portal/students/${student.id}`)
    const del = page.locator('button', { hasText: /delete/i }).first()
    if (await del.count()) {
      await del.click(); await page.waitForTimeout(3000)
      const gone = await prisma.student.findUnique({ where: { id: student.id }, select: { id: true } })
      check('deleteStudent removes the row', gone === null)
    } else check('deleteStudent removes the row', false, 'no delete button on the student profile')
  }

  if (servantAcct) {
    await go(`/portal/admin/servants/${servantAcct.id}`)
    const del = page.locator('button', { hasText: /delete/i }).first()
    if (await del.count()) {
      await del.click(); await page.waitForTimeout(3000)
      const gone = await prisma.account.findUnique({ where: { id: servantAcct.id }, select: { id: true } })
      check('deleteServant removes the account', gone === null)
    } else check('deleteServant removes the account', false, 'no delete button on the servant form')
  }

  /* ---- the class feed composer (F0505) ---- */
  // Publishing used to resolve in silence: the form shut and the page refreshed,
  // which looks exactly like a form that threw away what you typed, so a servant
  // posting "no class this Sunday" posts it twice to be sure. Asserted on
  // role="status" — there is no element with that role anywhere on this page in
  // the unfixed build, so this cannot pass by accident.
  if (c1) {
    console.log('\nclass feed')
    await go(`/portal/feed?class=${encodeURIComponent(c1.id)}`)
    const openComposer = page.locator('button', { hasText: 'Write a post' }).first()
    if (await openComposer.count()) {
      await openComposer.click()
      await page.waitForTimeout(400)
      const title = `${TAG} composer confirmation`
      await page.locator('#post-title').fill(title)
      await page.locator('#post-body').fill('Written by the write-smoke run; removed on cleanup.')
      await save('Post to the class', async () =>
        (await prisma.feedPost.count({ where: { title } })) === 1)
      check('createPost writes the post', (await prisma.feedPost.count({ where: { title } })) === 1)
      const status = page.locator('[role="status"]')
      check('and says so instead of resolving in silence', await status.count() >= 1,
        `${await status.count()} status elements`)
      if (await status.count()) {
        const said = (await status.first().innerText()).toLowerCase()
        check('naming what happened, not just flashing', said.includes('posted'), said.slice(0, 60))
      }
      // Reopening the composer must clear the notice, or it reads as a second post.
      await page.locator('button', { hasText: 'Write a post' }).first().click()
      await page.waitForTimeout(400)
      check('reopening the composer clears the last confirmation',
        await page.locator('[role="status"]').count() === 0)
    } else {
      check('the class feed offers a composer to an admin', false, 'no "Write a post" button')
    }
  }

  /* ---- two people on one register (KG, 2026-10-04) ---- */
  // Two servants took KG's register at once and the second save erased the
  // first: each save wrote every child as that screen showed them, so a screen
  // opened before the other servant saved put their "present" children back to
  // absent and took their points. A save now writes only its own changes, and
  // an open register takes in the others' within seconds.
  console.log('\nregister: two people at once')
  {
    const pinByLogin = new Map(backup.users.filter((u) => u.loginId && u.pin).map((u) => [String(u.loginId), String(u.pin)]))
    const session = await prisma.attendanceSession.findFirst({
      where: { isActive: true, classId: null, key: { not: 'sunday' } },  // no follow-up rule on these
      orderBy: { sortOrder: 'asc' },
      select: { key: true },
    })
    const candidates = await prisma.schoolClass.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        _count: { select: { students: true } },
        servants: { where: { servant: { account: { isActive: true, role: 'SERVANT' } } }, select: { servant: { select: { account: { select: { loginId: true } } } } } },
      },
    })
    const cls = candidates.find((c) => c._count.students >= 5 && c.servants.some((s) => pinByLogin.has(String(s.servant.account.loginId))))
    const servantLogin = cls && String(cls.servants.find((s) => pinByLogin.has(String(s.servant.account.loginId))).servant.account.loginId)
    if (!session || !cls) {
      check('a class and a session to take a register in', false, `session ${session?.key}, class ${cls?.id}`)
    } else {
      register = { classId: cls.id, sessionKey: session.key }
      await cleanupRegister()                                          // leftovers from a crashed run
      const url = `/portal/classes/${cls.id}/attendance?date=${REGISTER_DATE}&session=${session.key}`
      const servantPage = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()
      servantPage.on('response', (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`) })
      await servantPage.goto(BASE + '/portal/login', { waitUntil: 'networkidle' })
      await servantPage.waitForTimeout(1500)                           // hydration
      await servantPage.locator('#loginId').pressSequentially(servantLogin, { delay: 30 })
      await servantPage.locator('#pin').pressSequentially(pinByLogin.get(servantLogin), { delay: 30 })
      await servantPage.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 })
      await servantPage.click('button[type="submit"]')
      await servantPage.waitForURL((u) => !String(u).includes('/portal/login'), { timeout: 30000 })

      // Both screens open before anybody saves.
      const cardSel = 'button[aria-label$="Tap to change."]'
      for (const p of [page, servantPage]) {
        await p.goto(BASE + url, { waitUntil: 'networkidle' })
        await p.waitForSelector(cardSel, { timeout: 20000 })
        await p.waitForTimeout(800)
      }
      const names = await page.locator(cardSel).evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label').replace(/: (absent|present|excused)\. Tap to change\.$/, '')))
      const first = names.slice(0, 3)
      const second = names.slice(3, 5)
      const card = (p, n) => p.locator(`button[aria-label^="${n.replace(/"/g, '\\"')}: "][aria-label$="Tap to change."]`)
      const shown = async (p, list) => Promise.all(list.map(async (n) => (await card(p, n).getAttribute('aria-pressed')) === 'true'))
      const markAndSave = async (p, list) => {
        for (const n of list) await card(p, n).click()
        await p.locator('div.sticky button', { hasText: /Save attendance|Update attendance/ }).click()
        const dialog = p.locator('[role="dialog"][aria-label="Confirm attendance"]')
        await dialog.waitFor({ timeout: 10000 })
        await dialog.locator('button', { hasText: /^\s*Save\s*$/ }).click()
        await p.locator('[role="status"]', { hasText: /^Saved/ }).waitFor({ timeout: 30000 })
        await p.waitForLoadState('networkidle').catch(() => {})
        await p.waitForTimeout(1500)
      }
      await markAndSave(page, first)                                   // the admin, first
      await markAndSave(servantPage, second)                           // the servant, on a screen opened before that save

      const kids = await prisma.student.findMany({ where: { classId: cls.id }, select: { id: true, firstName: true, lastName: true } })
      const idOf = (n) => kids.find((k) => [k.firstName, k.lastName].filter(Boolean).join(' ') === n)?.id
      const rows = await prisma.attendanceRecord.findMany({
        where: { classId: cls.id, date: new Date(`${REGISTER_DATE}T00:00:00Z`), sessionKey: session.key },
        select: { studentId: true, status: true, pointEntry: { select: { undone: true } } },
      })
      const row = (n) => rows.find((r) => r.studentId === idOf(n))
      check("a second servant's save keeps the first one's marks", first.every((n) => row(n)?.status === 'PRESENT'),
        first.map((n) => row(n)?.status ?? 'no row').join(','))
      check('and their points', first.every((n) => row(n)?.pointEntry?.undone === false))
      check("the second servant's own marks are saved", second.every((n) => row(n)?.status === 'PRESENT'),
        second.map((n) => row(n)?.status ?? 'no row').join(','))
      check('every other child is recorded, as before', rows.length === names.length, `${rows.length}/${names.length}`)
      const secondSees = await shown(servantPage, first)
      check("the second screen shows the first servant's marks after saving", secondSees.every(Boolean), secondSees.join(','))
      let firstSees = []
      const deadline = Date.now() + 25000
      do {
        firstSees = await shown(page, second)
        if (firstSees.every(Boolean)) break
        await page.waitForTimeout(1000)
      } while (Date.now() < deadline)
      check("the first screen takes in the second servant's marks, no reload", firstSees.every(Boolean), firstSees.join(','))
      await servantPage.context().close()
    }
  }

  check('no 5xx responses during writes', serverErrors.length === 0, serverErrors.join(', '))
} finally {
  const swept = await cleanup()
  if (swept) console.log(`\ncleanup: removed ${swept} leftover ${TAG} record(s)`)
  const marks = await cleanupRegister().catch(() => 0)
  if (marks) console.log(`cleanup: removed the ${marks}-mark test register`)
  await browser.close()
  await prisma.$disconnect()
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1) }
console.log('all write checks passed')
