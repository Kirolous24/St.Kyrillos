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
const save = async (label) => {
  await page.locator('button[type="submit"]', { hasText: label }).click()
  await page.waitForTimeout(2500)
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

async function cleanup() {
  const accounts = await prisma.account.findMany({ where: { displayName: { startsWith: TAG } }, select: { id: true } })
  for (const a of accounts) await prisma.account.delete({ where: { id: a.id } }).catch(() => {})
  const students = await prisma.student.findMany({ where: { firstName: { startsWith: TAG } }, select: { accountId: true } })
  for (const s of students) await prisma.account.delete({ where: { id: s.accountId } }).catch(() => {})
  return accounts.length + students.length
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
  await save('Create account')
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
    await page.locator('button', { hasText: 'Reset PIN' }).first().click()
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

  check('no 5xx responses during writes', serverErrors.length === 0, serverErrors.join(', '))
} finally {
  const swept = await cleanup()
  if (swept) console.log(`\ncleanup: removed ${swept} leftover ${TAG} record(s)`)
  await browser.close()
  await prisma.$disconnect()
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1) }
console.log('all write checks passed')
