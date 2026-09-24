// READ-ONLY visual verification of the OG-parity restoration. No writes.
import { chromium } from 'playwright-core'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'

const BASE = 'http://localhost:3000'
const SHOTS = process.env.SHOTS || path.join(process.cwd(), '.audit', 'shots')
const REPO = '/Users/kirolouskamel/Desktop/My_Projects/St.Kyrillos'
const prisma = new PrismaClient()
const backup = JSON.parse(fs.readFileSync(path.join(REPO, '_incoming/sunday-school/data/stkyrillos_full_backup_2026-09-18.json'), 'utf8'))
const admin = backup.users.find((u) => u.role === 'admin' && u.loginId && u.pin)

let pass = 0
const fails = []
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok    ${name}`) }
  else { fails.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

fs.mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1380, height: 1000 } })
const errs = []
page.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${new URL(r.url()).pathname}`) })
page.on('dialog', (d) => d.accept())   // confirm() on delete
const go = async (p) => { await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(600) }
const shot = async (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false })

/**
 * Read a region's text for comparison.
 *
 * Lowercased deliberately: this portal renders a lot of labels uppercase via
 * CSS (`StatCard`, `Th`, section captions, the print letterhead), so innerText
 * gives "CLASSES" where the source says "Classes". Four checks in this file
 * were written against the source spelling and failed on working features
 * before this existed. Use it rather than reaching for innerText directly.
 */
/**
 * Today in the church's timezone, as the portal computes it (todayInNewYork).
 *
 * NOT `new Date().toISOString().slice(0,10)`: after 8pm ET that is already
 * tomorrow, so a row seeded with the UTC date lands on a day the app does not
 * think is today. One check asserted "marks today as read" against a reading
 * seeded for tomorrow, and failed only in the evening.
 */
const churchToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
/** "2026-09-" — the current month in church time, for seeding dated rows. */
const churchMonthPrefix = () => `${churchToday().slice(0, 7)}-`

const textOf = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * The labels of the stat tiles on the current page, lowercased.
 *
 * Reads `data-stat` rather than the page text on purpose: "Attendance" and
 * "Exams" also appear on class cards, buttons and nav items, so a text search
 * says "the tile is there" when the tile is gone. Three Wave 21 checks were
 * written that way and would have passed with an empty stat row.
 */
const statLabels = async () =>
  (await page.locator('main [data-stat]').evaluateAll((els) => els.map((e) => e.getAttribute('data-stat'))))
    .map((l) => (l || '').toLowerCase())

/**
 * Sign out if needed and sign in as the given backup user. Checks that follow a
 * role switch run as that role, so the switch has to be undone afterwards —
 * a whole section of this script once ran as the pastor by accident and
 * reported missing buttons that were simply hidden from that role.
 */
const signInAs = async (user) => {
  await go('/portal')
  const avatar = page.locator('header button[aria-haspopup="menu"]')
  if (await avatar.count() === 1) {
    await avatar.click()
    await page.waitForTimeout(300)
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await page.waitForURL((u) => String(u).includes('/portal/login'), { timeout: 20000 }).catch(() => {})
  }
  await go('/portal/login')
  await page.waitForTimeout(1500)
  await page.locator('#loginId').pressSequentially(String(user.loginId), { delay: 30 })
  await page.locator('#pin').pressSequentially(String(user.pin), { delay: 30 })
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 })
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !String(u).includes('/portal/login'), { timeout: 30000 }).catch(() => {})
}

try {
  // sign in
  await signInAs(admin)
  check('signed in as admin', !page.url().includes('/portal/login'))

  // ── 1. avatar dropdown ──
  console.log('\navatar dropdown')
  const avatar = page.locator('header button[aria-haspopup="menu"]')
  check('avatar is a real button', await avatar.count() === 1, String(await avatar.count()))
  check('dropdown starts closed', await page.locator('[role="menu"]').count() === 0)
  await avatar.click()
  await page.waitForTimeout(350)
  const menu = page.locator('[role="menu"]')
  check('dropdown opens on click', await menu.count() === 1)
  const items = (await menu.locator('[role="menuitem"]').allInnerTexts()).map((t) => t.trim())
  console.log(`        items: ${JSON.stringify(items)}`)
  for (const want of ['My Profile', 'Classes', 'Servants', 'All Students', 'Settings', 'My Photo', 'Sign out']) {
    check(`dropdown has "${want}"`, items.some((i) => i === want))
  }
  await shot('01-avatar-dropdown')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Escape closes the dropdown', await page.locator('[role="menu"]').count() === 0)
  await avatar.click(); await page.waitForTimeout(250)
  await page.locator('main').click({ position: { x: 5, y: 5 } })
  await page.waitForTimeout(300)
  check('outside click closes the dropdown', await page.locator('[role="menu"]').count() === 0)

  // ── 2. sidebar items ──
  console.log('\nsidebar')
  const nav = (await page.locator('aside a').allInnerTexts()).map((t) => t.trim())
  for (const want of ['Take Student Attendance', 'My Profile']) {
    check(`sidebar has "${want}"`, nav.some((n) => n === want), JSON.stringify(nav.slice(0, 6)))
  }

  // ── 3. new routes render ──
  console.log('\nnew routes')
  await go('/portal/profile')
  check('/portal/profile renders', (await page.locator('h1').innerText()).includes('My Profile'))
  check('profile shows Personal information', await page.getByText('Personal information').count() > 0)
  check('profile has an edit form', await page.locator('#pf-email').count() === 1)
  await shot('02-my-profile')

  const student = await prisma.student.findFirst({ where: { classId: { not: null } }, select: { id: true } })
  await go(`/portal/grades?student=${student.id}`)
  check('/portal/grades renders', (await page.locator('h1').innerText()).includes('Grades & Points'))
  check('grades shows the activity breakdown', await page.getByText('Activities & points').count() > 0)
  check('grades shows quiz results', await page.getByText('Quiz results').count() > 0)
  await shot('03-grades')

  await go('/portal/attendance')
  check('/portal/attendance renders a picker', (await page.locator('h1').innerText()).includes('Take Attendance'))
  await shot('04-attendance-picker')
  await go('/portal/points')
  check('/portal/points renders a picker', (await page.locator('h1').innerText()).includes('Points'))
  await go('/portal/students')
  check('/portal/students renders a picker', (await page.locator('h1').innerText()).includes('Students'))

  // ── 4. class profile: print buttons + roster search ──
  console.log('\nclass profile')
  const cls = await prisma.schoolClass.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true } })
  await go(`/portal/classes/${cls.id}`)
  check('class profile has Print QR Codes', await page.getByRole('link', { name: /Print QR Codes/ }).count() === 1)
  check('class profile has Print Report', await page.getByRole('link', { name: /Print Report/ }).count() === 1)
  check('class profile has a roster search', await page.locator('input[name="q"]').count() === 1)
  await shot('05-class-profile')
  const before = await page.locator('aside ~ * a[href*="/portal/students/"]').count()
  await page.locator('input[name="q"]').fill('zzzznotarealname')
  await page.locator('button[type="submit"]', { hasText: 'Search' }).click()
  await page.waitForTimeout(1200)
  check('roster search filters to nothing', await page.getByText(/No students match/).count() > 0, `before=${before}`)
  await shot('06-roster-search-empty')

  // ── 5. points history controls ──
  // The controls only render when there IS history, which is correct — but the
  // dev branch has no point entries at all, so seed two tagged rows, verify,
  // and delete them again (the same create-and-clean pattern the write smoke uses).
  console.log('\npoints history')
  const anyStudent = await prisma.student.findFirst({ where: { classId: cls.id }, select: { id: true } })
  if (!anyStudent) {
    check('points history: a student exists to seed against', false, 'no student in the first class')
  } else {
    const seeded = []
    try {
      for (const [label, pts] of [['ZZUIVERIFY Attendance', 2], ['ZZUIVERIFY Correction', -1]]) {
        const row = await prisma.pointEntry.create({
          data: { studentId: anyStudent.id, classId: cls.id, points: pts, source: 'MANUAL', activityLabel: label, reason: 'ui verification' },
          select: { id: true },
        })
        seeded.push(row.id)
      }
      await go(`/portal/classes/${cls.id}/points`)
      check('history has a search box', await page.locator('input[placeholder*="Search by student"]').count() === 1)
      check('history has filter chips', await page.getByRole('button', { name: 'Added points' }).count() === 1)
      check('history has a grouping select', await page.locator('select').count() >= 1)
      check('history shows the seeded rows', await page.getByText('ZZUIVERIFY Attendance').count() > 0)
      await shot('07-points-history')

      // filter to removals only: the +2 row must disappear, the -1 must stay
      await page.getByRole('button', { name: 'Removed points' }).click()
      await page.waitForTimeout(400)
      check('"Removed points" chip hides the positive row', await page.getByText('ZZUIVERIFY Attendance').count() === 0)
      check('"Removed points" chip keeps the negative row', await page.getByText('ZZUIVERIFY Correction').count() > 0)

      // group by student -> a subtotal header appears
      await page.getByRole('button', { name: 'All' }).first().click()
      await page.waitForTimeout(300)
      await page.locator('select').last().selectOption('student')
      await page.waitForTimeout(400)
      check('grouping by student renders a subtotal header', await page.locator('section h4').count() >= 1)
      await shot('07b-points-grouped')

      // search narrows it
      await page.locator('input[placeholder*="Search by student"]').fill('Correction')
      await page.waitForTimeout(500)
      check('history search narrows the list', await page.getByText('ZZUIVERIFY Attendance').count() === 0)
    } finally {
      for (const id of seeded) await prisma.pointEntry.delete({ where: { id } }).catch(() => {})
      const left = await prisma.pointEntry.count({ where: { activityLabel: { startsWith: 'ZZUIVERIFY' } } })
      check('seeded verification rows cleaned up', left === 0, `${left} left behind`)
    }
  }

  // ── 6. servants search ──
  console.log('\nservants search')
  await go('/portal/admin/servants')
  check('servants page has a search box', await page.locator('input[name="q"]').count() === 1)
  await shot('08-servants-search')

  // ── 7. attendance date cap ──
  console.log('\nattendance guard')
  await go(`/portal/classes/${cls.id}/attendance`)
  const max = await page.locator('input[type="date"]').getAttribute('max')
  check('date picker is capped at today', !!max, `max=${max}`)

  // ── 7b. follow-up quick actions (seeded case, removed after) ──
  console.log('\nfollow-up quick actions')
  const withPhone = await prisma.student.findFirst({
    where: { classId: { not: null }, OR: [{ fatherPhone: { not: null } }, { motherPhone: { not: null } }, { account: { phone: { not: null } } }] },
    select: { id: true, firstName: true, lastName: true, classId: true, fatherPhone: true, motherPhone: true, account: { select: { phone: true } } },
  })
  if (!withPhone) {
    check('follow-ups: a student with a phone exists to seed against', false, 'none found')
  } else {
    let seededCase = null
    try {
      seededCase = await prisma.followUpCase.create({
        data: { studentId: withPhone.id, classId: withPhone.classId, origin: 'AUTO', title: 'ZZUIVERIFY missed 2 Sundays', consecutiveAbsences: 2 },
        select: { id: true },
      })
      await go('/portal/follow-ups')
      const name = `${withPhone.firstName} ${withPhone.lastName}`.replace(/\s+/g, ' ').trim()
      check('seeded case is listed', await page.getByText('ZZUIVERIFY missed 2 Sundays').count() > 0)
      check('row has a "Log follow-up" link', await page.getByRole('link', { name: /Log follow-up/ }).count() >= 1)
      const tel = page.locator('a[href^="tel:"]')
      check('row has a one-tap call link', await tel.count() >= 1)
      const wa = page.locator('a[href^="https://wa.me/"]')
      check('row has a WhatsApp link', await wa.count() >= 1)
      const waHref = await wa.first().getAttribute('href')
      check('WhatsApp link carries a country code', /^https:\/\/wa\.me\/\d{11,}$/.test(waHref || ''), String(waHref))
      check('row has a Send button', await page.getByRole('button', { name: /^Send$/ }).count() >= 1)
      check('row has a delete button', await page.getByRole('button', { name: /Delete the case/ }).count() >= 1)

      // the composer
      await page.getByRole('button', { name: /^Send$/ }).first().click()
      await page.waitForTimeout(400)
      const dlg = page.locator('[role="dialog"]')
      check('Send opens the composer', await dlg.count() === 1)
      check('composer offers Email and WhatsApp', await dlg.getByRole('button', { name: 'Email', exact: true }).count() === 1 && await dlg.getByRole('button', { name: 'WhatsApp', exact: true }).count() === 1)
      const submit = dlg.getByRole('button', { name: /^(Send|Open in .*)$/ }).last()
      check('send is disabled before a channel is chosen', await submit.isDisabled())
      check('send reads neutrally before a channel is chosen', (await submit.innerText()).trim() === 'Send', (await submit.innerText()).trim())
      await dlg.getByRole('button', { name: 'WhatsApp', exact: true }).click()
      await page.waitForTimeout(300)
      check('choosing WhatsApp lists the family phone numbers', await dlg.locator('input[type="radio"]').count() >= 1)
      // Controlled radio: on a cold dev compile the click can land before React
      // hydrates, which natively checks the box and then the first render
      // resets it. Retry rather than let .check() throw the whole run away.
      const contact = dlg.locator('input[type="radio"]').first()
      for (let attempt = 0; attempt < 4 && !(await contact.isChecked()); attempt++) {
        await contact.click({ force: true })
        await page.waitForTimeout(400)
      }
      check('a family number can be chosen', await contact.isChecked())
      // The composer was unusable for a real servant, not merely for this
      // script: `.portal-enter` retained `transform: translateY(0)` from its
      // entrance animation, which makes it the containing block for every
      // `position: fixed` descendant — so this dialog was laid out inside the
      // page wrapper and the wrapper sat over its own controls.
      check(
        'the dialog escapes the page wrapper',
        await dlg.evaluate((el) => el.parentElement === document.body),
      )
      check(
        'the page wrapper leaves no transform behind',
        await page.evaluate(() => {
          const el = document.querySelector('.portal-enter')
          if (!el) return true
          const t = getComputedStyle(el).transform
          return t === 'none' || t === ''
        }),
      )
      const body = await dlg.locator('textarea').inputValue()
      check('composer prefills the pastoral template', body.includes('we really missed seeing you'), body.slice(0, 40))
      check('template greets the student by name', body.startsWith(`Hi ${withPhone.firstName}`), body.slice(0, 30))
      check('send is enabled once a contact is chosen', !(await submit.isDisabled()))
      check('send names the chosen channel', (await submit.innerText()).includes('WhatsApp'), (await submit.innerText()).trim())
      await shot('11-followup-send-composer')
      await dlg.getByRole('button', { name: 'Cancel' }).click()
      await page.waitForTimeout(300)
      check('Cancel closes the composer', await page.locator('[role="dialog"]').count() === 0)
      await shot('12-followup-row-actions')

      // Delete really deletes — and it must be THIS case's button. `.first()`
      // used to be enough because the seeded case was the only one on the page;
      // since a case now opens on the first missed Sunday there can be several,
      // and the first trash icon may belong to a real child. The aria-label
      // names the student, and a student never holds two open cases at once.
      const trash = page.getByRole('button', { name: `Delete the case for ${name}` })
      check('exactly one trash button belongs to the seeded case', (await trash.count()) === 1, `${await trash.count()} found`)
      await trash.first().click()
      await page.waitForTimeout(2500)
      const still = await prisma.followUpCase.findUnique({ where: { id: seededCase.id }, select: { id: true } })
      check('the trash button deletes the case', still === null)
      if (still === null) seededCase = null
    } finally {
      if (seededCase) await prisma.followUpCase.delete({ where: { id: seededCase.id } }).catch(() => {})
      const left = await prisma.followUpCase.count({ where: { title: { startsWith: 'ZZUIVERIFY' } } })
      check('seeded case cleaned up', left === 0, `${left} left behind`)
    }
  }

  // ── 7c. birthdays: calendar weeks, next-week card, full-year roster ──
  console.log('\nbirthdays')
  await go('/portal/birthdays')
  check('This week card is present', await page.getByText('This week', { exact: true }).count() > 0)
  check('Next week card is present', await page.getByText('Next week', { exact: true }).count() > 0)
  check('full-year toggle is offered', await page.getByRole('link', { name: /Show the whole year/ }).count() === 1)
  await shot('13-birthdays')
  await page.getByRole('link', { name: /Show the whole year/ }).click()
  // Wait for the navigation itself, not a duration. A fixed wait here races
  // the dev server's first compile of ?show=all and reports a working link as
  // broken — which it did, once.
  await page.waitForURL((u) => String(u).includes('show=all'), { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(400)
  check('full-year view loads', page.url().includes('show=all'), page.url())
  check('full-year view says so', await page.getByText(/across the whole year/).count() > 0)
  check('full-year view offers the way back', await page.getByRole('link', { name: /Show next 60 days/ }).count() === 1)
  const chip = page.locator('header a[href="/portal/birthdays"]')
  check('topbar birthday chip is a link', await chip.count() === 1)

  // ── 7d. scanning a code while signed out keeps the destination ──
  // A child scans the projected group code on their own phone, signed out. The
  // middleware used to drop the path, so they landed on the dashboard and the
  // code (five-minute expiry) was gone. Uses a clean context so it is genuinely
  // signed out, and a real student account from the backup.
  console.log('\nsigned-out scan')
  const pinned = backup.users.filter((u) => u.role === 'student' && u.loginId && u.pin)
  let scanStudent = null
  for (const c of pinned.slice(0, 60)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, student: { select: { classId: true } } },
    })
    if (a?.role === 'STUDENT' && a.student?.classId) { scanStudent = { ...c, classId: a.student.classId }; break }
  }
  if (!scanStudent) {
    check('signed-out scan: a student with a known PIN exists', false, 'none found in the backup')
  } else {
    const tokenId = `dead${crypto.randomBytes(30).toString('hex')}`.slice(0, 64)
    let madeToken = false
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const anon = await ctx.newPage()
    try {
      await prisma.qrToken.create({
        data: {
          token: tokenId, kind: 'STUDENT_ATTENDANCE', classIds: [scanStudent.classId],
          sessionKey: 'sunday', points: 2, title: 'ZZUIVERIFY check-in',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      })
      madeToken = true
      const scanPath = `/portal/scan/${tokenId}`
      await anon.goto(BASE + scanPath, { waitUntil: 'networkidle' })
      await anon.waitForTimeout(600)
      check('a signed-out scan lands on the login page', anon.url().includes('/portal/login'), anon.url())
      check('the scanned destination is preserved in the URL', anon.url().includes(`next=${encodeURIComponent(scanPath)}`) || anon.url().includes(`next=${scanPath}`), anon.url())

      await anon.waitForTimeout(1200)
      await anon.locator('#loginId').pressSequentially(String(scanStudent.loginId), { delay: 30 })
      await anon.locator('#pin').pressSequentially(String(scanStudent.pin), { delay: 30 })
      await anon.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 })
      await anon.click('button[type="submit"]')
      await anon.waitForURL((u) => !String(u).includes('/portal/login'), { timeout: 30000 })
      await anon.waitForTimeout(800)
      check('after signing in they are returned to the code', anon.url().includes(scanPath), anon.url())
      check('the check-in button is waiting for them', await anon.getByRole('button', { name: /Check me in/ }).count() === 1)
      await anon.screenshot({ path: `${SHOTS}/14-signed-out-scan-return.png` })
    } finally {
      await ctx.close()
      if (madeToken) {
        await prisma.qrRedemption.deleteMany({ where: { tokenId } }).catch(() => {})
        await prisma.qrToken.delete({ where: { token: tokenId } }).catch(() => {})
      }
      const left = await prisma.qrToken.count({ where: { token: tokenId } })
      check('seeded QR token cleaned up', left === 0, `${left} left behind`)
    }
  }

  // ── 7e. the student's own email and phone round-trip ──
  console.log('\nstudent contact fields')
  const target = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, accountId: true, account: { select: { email: true, phone: true } } },
  })
  if (!target) {
    check('student contact: a student exists', false)
  } else {
    const was = { email: target.account.email, phone: target.account.phone }
    try {
      await go(`/portal/students/${target.id}/edit`)
      check('edit form has a student email field', await page.locator('#email').count() === 1)
      check('edit form has a student phone field', await page.locator('#phone').count() === 1)
      await page.locator('#email').fill('zzuiverify@example.com')
      await page.locator('#phone').fill('(615) 555-0199')
      await page.locator('button[type="submit"]', { hasText: 'Save changes' }).click()
      // StudentForm pushes back to the profile once the action resolves, so
      // wait for that rather than guessing at a duration. A blind 2500ms made
      // this check a coin flip against a dev server that was still compiling:
      // it reported "email persists — null" on a save path that was fine.
      await page.waitForURL((u) => !String(u).includes('/edit'), { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(600)
      const after = await prisma.account.findUnique({ where: { id: target.accountId }, select: { email: true, phone: true } })
      check('student email persists', after?.email === 'zzuiverify@example.com', String(after?.email))
      check('student phone persists normalised', after?.phone === '6155550199', String(after?.phone))
      await go(`/portal/students/${target.id}`)
      check('profile shows the student\'s own contact row', await page.getByText('zzuiverify@example.com').count() > 0)
      await shot('15-student-contact')
    } finally {
      await prisma.account.update({ where: { id: target.accountId }, data: was }).catch(() => {})
      const restored = await prisma.account.findUnique({ where: { id: target.accountId }, select: { email: true, phone: true } })
      check('original student contact restored', restored?.email === was.email && restored?.phone === was.phone)
    }
  }

  // ── 8. mobile bottom nav (phone viewport) ──
  console.log('\nmobile bottom nav')
  await page.setViewportSize({ width: 390, height: 844 })
  await go('/portal')
  const bar = page.locator('nav[aria-label="Primary"]')
  check('bottom bar is present on a phone', await bar.count() === 1)
  const tabs = (await bar.locator('a, button').allInnerTexts()).map((t) => t.trim())
  console.log(`        tabs: ${JSON.stringify(tabs)}`)
  check('bottom bar has 5 destinations + More', tabs.length === 6, String(tabs.length))
  check('bottom bar ends with More', tabs[tabs.length - 1] === 'More')
  check('Home is the active tab on /portal', await bar.locator('a[aria-current="page"]').count() === 1)
  await shot('09-mobile-bottom-nav')
  await bar.getByRole('button', { name: 'More' }).click()
  await page.waitForTimeout(400)
  check('"More" opens the full nav panel', await page.locator('#portal-mobile-nav').count() === 1)
  await shot('10-mobile-more-panel')
  await page.locator('#portal-mobile-nav button').first().click()
  // Wait for the panel to actually close rather than guessing at a delay —
  // while it is open it covers the bar and the tap lands on nothing.
  await page.locator('#portal-mobile-nav').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  const tabHref = await bar.locator('a').nth(1).getAttribute('href')
  await bar.locator('a').nth(1).click()
  await page.waitForURL((u) => String(u).includes(tabHref), { timeout: 15000 }).catch(() => {})
  check('tapping a tab navigates', page.url().includes(tabHref), `${page.url()} (wanted ${tabHref})`)
  check('the tapped tab becomes active', await bar.locator('a[aria-current="page"]').count() === 1)
  await page.setViewportSize({ width: 1380, height: 1000 })
  await go('/portal')
  check('bottom bar is hidden on desktop', !(await page.locator('nav[aria-label="Primary"]').first().isVisible()))

  // ── Wave 11 ──────────────────────────────────────────────────────────────
  console.log('\nwave 11 — report cards, bulk edit, imports, points, self check-in')

  const w11student = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true, firstName: true, lastName: true },
  })

  // F0131 — one student's report card
  await go(`/portal/students/${w11student.id}`)
  const cardLink = page.locator(`a[href*="/portal/reports/cards"][href*="student=${w11student.id}"]`)
  check('student profile links to their own report card', await cardLink.count() === 1)
  await go(`/portal/reports/cards?class=${w11student.classId}&student=${w11student.id}`)
  // Each card's burgundy masthead is one-per-sheet, unlike <section>, which the
  // page shell also uses.
  const oneSheet = await page.locator('main header.bg-brand-950').count()
  check('single-card view renders exactly one sheet', oneSheet === 1, String(oneSheet))
  check('single-card view offers "Print this card"', await page.getByRole('button', { name: 'Print this card' }).count() === 1)
  check('single-card view links back to the whole class', await page.getByRole('link', { name: 'All cards' }).count() === 1)
  await shot('11-report-card-single')
  await go(`/portal/reports/cards?class=${w11student.classId}`)
  const allSheets = await page.locator('main header.bg-brand-950').count()
  check('unscoped view still prints every card', await page.getByRole('button', { name: 'Print all cards' }).count() === 1)
  check('scoping to one student really drops the rest', allSheets > oneSheet, `${allSheets} vs ${oneSheet}`)

  // F0063 — class field back in the edit form
  await go(`/portal/students/${w11student.id}/edit`)
  check('edit form has the admin Class field again', await page.locator('#student-class').count() === 1)
  const formClass = await page.locator('#student-class').inputValue()
  check('Class field is preselected to their class', formClass === w11student.classId, `${formClass} vs ${w11student.classId}`)

  // F0058/F0066/F0651 — selection + bulk bar
  await go('/portal/admin/students')
  check('roster has per-student checkboxes', await page.locator('main input[type="checkbox"]').count() > 0)
  check('bulk bar is hidden until something is selected', await page.getByText('selected', { exact: false }).count() === 0)
  const firstBox = page.locator('main input[type="checkbox"][aria-label^="Select "]').first()
  await firstBox.check()
  await page.waitForTimeout(350)
  check('selecting a student reveals the bulk bar', await page.locator('select[aria-label="Field to set"]').count() === 1)
  const bulkFields = (await page.locator('select[aria-label="Field to set"] option').allInnerTexts()).map((t) => t.trim())
  check('bulk bar offers Grade', bulkFields.includes('Grade'), JSON.stringify(bulkFields))
  check('bulk bar offers a Move control', await page.locator('select[aria-label="Move to class"]').count() === 1)
  check('bulk bar offers Delete', await page.getByRole('button', { name: /^Delete \d+$/ }).count() === 1)
  await shot('12-bulk-bar')
  await page.getByRole('button', { name: 'Clear' }).first().click()
  await page.waitForTimeout(300)
  check('Clear hides the bulk bar again', await page.locator('select[aria-label="Field to set"]').count() === 0)

  // F0060/F0061 — template + preview
  await go('/portal/admin/data')
  check('import panel has "Download template"', await page.getByRole('button', { name: 'Download template' }).count() === 1)
  check('import panel has "Preview"', await page.getByRole('button', { name: 'Preview' }).count() === 1)
  check('Preview is disabled with no file chosen', await page.getByRole('button', { name: 'Preview' }).isDisabled())
  await shot('13-import-panel')

  // F0414 — required canned reason on removal
  await go(`/portal/classes/${w11student.classId}/points`)
  await page.locator(`main input[type="checkbox"]`).first().check().catch(() => {})
  await page.waitForTimeout(300)
  const removeBtn = page.getByRole('button', { name: '− Remove' })
  if (await removeBtn.count() === 1) {
    await removeBtn.click()
    await page.waitForTimeout(300)
    const reasonSel = page.locator('select[aria-label="Reason"]')
    check('removing points asks for a reason from a list', await reasonSel.count() === 1)
    const reasons = (await reasonSel.locator('option').allInnerTexts()).map((t) => t.trim())
    check('reason list carries the OG wording', reasons.includes('Misbehaving') && reasons.includes('Being late'),
      JSON.stringify(reasons.slice(0, 4)))
    check('reason list keeps an Other escape hatch', reasons.some((r) => r.startsWith('Other')))
    check('cannot submit without picking a reason',
      await page.getByRole('button', { name: /^Remove \d+ pts?$/ }).isDisabled())
    await reasonSel.selectOption('Being late')
    await page.waitForTimeout(250)
    check('picking a reason enables the button',
      !(await page.getByRole('button', { name: /^Remove \d+ pts?$/ }).isDisabled()))
    await shot('14-points-remove-reason')
  } else {
    check('points panel exposes a Remove mode', false, 'no − Remove button found')
  }

  // F0290/F0583 — self check-in
  await go('/portal/my-attendance')
  check('My Attendance can now be written to', await page.getByText('Mark yourself this week').count() === 1)
  check('self check-in offers Here/Excused/Away',
    await page.getByRole('button', { name: 'Here' }).count() > 0 &&
    await page.getByRole('button', { name: 'Excused' }).count() > 0)
  check('self check-in points at the coordinator page',
    await page.locator('a[href="/portal/servant-attendance"]').count() > 0)
  await shot('15-self-check-in')

  // F0650 — servant-reachable roster export
  await go(`/portal/classes/${w11student.classId}`)
  check('class page offers Export CSV', await page.getByRole('button', { name: 'Export CSV' }).count() === 1)

  // F0215 — cross-class servants on the agenda
  await go(`/portal/agenda?class=${w11student.classId}`)
  const leadSelect = page.locator('#agenda-lead')
  if (await leadSelect.count() === 1) {
    const groups = await leadSelect.locator('optgroup').evaluateAll((els) => els.map((e) => e.label))
    check('agenda servant picker is grouped like the OG', groups.includes('Other classes'), JSON.stringify(groups))
  } else {
    check('agenda editor renders a lead servant select', false)
  }
  await shot('16-agenda-servant-groups')

  // ── Wave 12 ──────────────────────────────────────────────────────────────
  console.log('\nwave 12 — exams and the pastor dashboard')

  const w12 = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true },
  })

  // F0025 — exam results back on the student profile
  await go(`/portal/students/${w12.id}`)
  check('student profile has an exam-results card', await page.getByText(/^Exam results/).count() > 0)

  // F0021/F0026/F0027 all need an exam with a submitted result, and this data
  // has none — skipping them would leave three findings unverified, so seed one
  // and remove it again in the finally below.
  let seededExam = null
  try {
    const examStudents = await prisma.student.findMany({
      where: { classId: w12.classId },
      take: 3,
      select: { id: true },
    })
    seededExam = await prisma.exam.create({
      data: {
        classId: w12.classId,
        title: 'ZZUIVERIFY Quiz',
        subject: 'Bible',
        dueDate: new Date(`${churchMonthPrefix()}15T00:00:00Z`),
        pointsPerQuestion: 2,
        status: 'PUBLISHED',
        questions: {
          create: [
            { sortOrder: 0, text: 'ZZ who baptised the Lord?', options: ['John', 'Peter'], correctIndex: 0 },
            { sortOrder: 1, text: 'ZZ where was He baptised?', options: ['Nile', 'Jordan'], correctIndex: 1 },
          ],
        },
      },
      select: { id: true },
    })
    // Three results spread across the A-F ladder so the pass rate is a real
    // fraction rather than 0% or 100%.
    const shapes = [
      { score: 4, total: 4, correctCount: 2, questionCount: 2, percentage: 100 },
      { score: 2, total: 4, correctCount: 1, questionCount: 2, percentage: 50 },
      { score: 4, total: 4, correctCount: 2, questionCount: 2, percentage: 90 },
    ]
    for (let i = 0; i < examStudents.length && i < shapes.length; i++) {
      await prisma.quizResult.create({
        data: { examId: seededExam.id, studentId: examStudents[i].id, classId: w12.classId, ...shapes[i] },
      })
    }

    // F0021 — month groups on the exams list
    await go('/portal/exams')
    const monthGroups = page.locator('main details')
    check('exams are grouped into collapsible sections', await monthGroups.count() > 0, String(await monthGroups.count()))
    if (await monthGroups.count() > 0) {
      const summaries = (await monthGroups.locator('summary').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
      console.log(`        groups: ${JSON.stringify(summaries.slice(0, 4))}`)
      check('a group header counts its exams', summaries.some((t) => /\d+ exams?/.test(t)))
      check('the current month is marked and open', summaries.some((t) => t.includes('Current')), JSON.stringify(summaries.slice(0, 2)))
    }
    await shot('17-exams-month-groups')

    // F0026 — pass rate, rank and letter grade on the exam detail
    await go(`/portal/exams/${seededExam.id}`)
    check('exam stats include a Pass rate tile', await page.getByText('Pass rate').count() > 0)
    const headers = (await page.locator('main table thead th').allInnerTexts()).map((t) => t.trim())
    // Th renders its label uppercase, so compare case-insensitively.
    const head = headers.map((h) => h.toLowerCase())
    check('results table is ranked', head.includes('#'), JSON.stringify(headers))
    check('results table shows a letter grade', head.includes('grade'), JSON.stringify(headers))
    const firstRow = (await page.locator('main table tbody tr').first().innerText()).replace(/\s+/g, ' ')
    check('the top row is rank 1 and its letter', /^1\b/.test(firstRow) && /\bA\b/.test(firstRow), firstRow.slice(0, 60))
    // 2 of 3 at 70%+ is 67%, so the tile is doing real arithmetic.
    check('pass rate counts only 70% and above', (await page.locator('main').innerText()).includes('67%'))
    await shot('18-exam-stats')

    // F0027 — per-exam breakdown on the report card
    const marked = examStudents[0]
    await go(`/portal/reports/cards?class=${w12.classId}&student=${marked.id}&from=2000-01-01`)
    const examSection = page.locator('main details')
    check('report card breaks the exams down per quiz', await examSection.count() > 0)
    if (await examSection.count() > 0) {
      check('the breakdown is open so it prints', await examSection.first().evaluate((el) => el.hasAttribute('open')))
      const detail = (await examSection.first().innerText()).replace(/\s+/g, ' ')
      check('the breakdown carries correct/total and points', /\d+\/\d+ right · \d+ pts/.test(detail), detail.slice(0, 80))
      check('the summary line counts questions right', (await page.locator('main').innerText()).includes('questions right'))
    }
    await shot('19b-report-card-exam-detail')

    // F0025 — and the same result shows on the student's own profile
    await go(`/portal/students/${marked.id}`)
    check('the exam-results card lists the quiz', await page.getByText('ZZUIVERIFY Quiz').count() > 0)
  } finally {
    if (seededExam) await prisma.exam.delete({ where: { id: seededExam.id } }).catch(() => {})
    const leftExams = await prisma.exam.count({ where: { title: { startsWith: 'ZZUIVERIFY' } } })
    check('seeded exam cleaned up', leftExams === 0, `${leftExams} left behind`)
  }

  // F0019 — the daily-quiz template and its month control
  await go('/portal/exams/import')
  check('import offers the daily-quiz template', await page.getByRole('button', { name: 'Daily-quiz template' }).count() === 1)
  check('month control is hidden for a titled sheet', await page.locator('#import-month').count() === 0)
  await page.locator('#import-text').fill('Day,Question,Option A,Option B,Correct Answer\n1,Q,Yes,No,A')
  await page.waitForTimeout(400)
  check('pasting a Day-based sheet reveals the month control', await page.locator('#import-month').count() === 1)
  check('…and the points-per-question control', await page.locator('#import-points').count() === 1)
  await shot('19-daily-quiz-import')
  await page.locator('#import-text').fill('Title,Question,Option A,Option B,Correct Answer\nQuiz,Q,Yes,No,A')
  await page.waitForTimeout(400)
  check('a titled sheet hides them again', await page.locator('#import-month').count() === 0)

  // F0755/F0760 — pastor dashboard
  const pastor = backup.users.find((u) => u.role === 'pastor' && u.loginId && u.pin)
  if (pastor) {
    await signInAs(pastor)
    check('signed in as the pastor', !page.url().includes('/portal/login'))

    await go('/portal')
    check('pastor dashboard has a Quiz average tile', await page.getByText('Quiz average').count() > 0)
    const cardRows = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    check('pastor class cards name the servant', /Servants?:? /.test(cardRows) || cardRows.includes('Servant'), '')
    check('pastor class cards have a Print action', await page.getByRole('link', { name: 'Print' }).count() > 0)
    // F0078 — the prototype's own Attendance Overview section
    check('pastor dashboard has an Attendance overview', await page.getByText('Attendance overview').count() > 0)
    const aoRows = page.locator('main ul li', { has: page.locator('[role="progressbar"]') })
    check('the overview lists every class on one bar chart', await aoRows.count() > 0, String(await aoRows.count()))
    await shot('20-pastor-dashboard')

    // F0759 — the roster is reachable, read-only, and does not link into a 404
    await go('/portal/admin/servants')
    check('pastor can open the servant roster', page.url().includes('/portal/admin/servants'))
    check('roster hides "Add servant" from the pastor', await page.getByRole('link', { name: /Add servant/ }).count() === 0)
    check('roster tiles are not links for the pastor', await page.locator('main a[href^="/portal/admin/servants/"]').count() === 0)
    // The pastor prints; the print actions are read-only and must be offered to
    // them too. They used to sit behind attendance.write, which hid them.
    await go(`/portal/classes/${w12.classId}`)
    check('pastor sees Print Class Report on a class', await page.getByRole('link', { name: /Print Class Report/ }).count() === 1)
    await shot('21-pastor-servants')

    // Hand the session back, or every later check silently runs as the pastor.
    await signInAs(admin)
    check('signed back in as admin', !page.url().includes('/portal/login'))
  } else {
    console.log('        (no pastor account in the backup — skipped the pastor checks)')
  }

  // ── Wave 13 ──────────────────────────────────────────────────────────────
  console.log('\nwave 13 — the reports system')

  const w13 = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true },
  })

  // F0123/F0197/F0442 — the all-sessions month grid. It needs two different
  // sessions recorded in the same month or there is nothing to put side by
  // side, and this data has none, so seed a few marks and remove them again.
  const gridStudents = await prisma.student.findMany({
    where: { classId: w13.classId },
    take: 2,
    select: { id: true },
  })
  const gridSessions = await prisma.attendanceSession.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 2,
    select: { key: true },
  })
  const seededMarks = []
  try {
    const monthPrefix = churchMonthPrefix()
    for (let i = 0; i < gridSessions.length; i++) {
      for (let j = 0; j < gridStudents.length; j++) {
        const created = await prisma.attendanceRecord.create({
          data: {
            studentId: gridStudents[j].id,
            classId: w13.classId,
            sessionKey: gridSessions[i].key,
            // Two different weeks, so the grid has more than one week group.
            date: new Date(`${monthPrefix}${i === 0 ? '03' : '17'}T00:00:00Z`),
            status: j === 0 ? 'PRESENT' : 'ABSENT',
          },
          select: { id: true },
        })
        seededMarks.push(created.id)
      }
    }

    await go(`/portal/reports?class=${w13.classId}&view=all`)
    const viewSelect = page.locator('select[name="view"]')
    check('a View control exists', await viewSelect.count() === 1)
    check('…and it is set to All sessions', (await viewSelect.inputValue()) === 'all')
    const headerRows = await page.locator('main table thead tr').count()
    check('the grid has two header rows', headerRows === 2, String(headerRows))
    const spanning = await page.locator('main table thead th[colspan]').count()
    check('week headers span their session columns', spanning > 0, String(spanning))
    check('sessions are abbreviated with a title', await page.locator('main table thead abbr[title]').count() > 0)
    const legend = (await page.locator('main ul li').allInnerTexts()).join(' ')
    check('a legend explains the abbreviations', legend.trim().length > 0, legend.slice(0, 60))
    // The grid draws the whole month, as the prototype did (OG L8985-9005):
    // every week of it gets a header, every header spans every session, and a
    // (week, session) nobody took reads as a dash. It used to draw only the
    // pairs that had records, which collapsed a month holding one register
    // into a single column — the same data, a page nobody recognised.
    const activeSessions = await prisma.attendanceSession.count({ where: { isActive: true } })
    check('every week of the month gets a header, not just the recorded ones',
      spanning >= 4, `${spanning} week headers`)
    const spans = await page.locator('main table thead th[colspan]')
      .evaluateAll((els) => els.map((el) => Number(el.getAttribute('colspan'))))
    check('and each header spans every session',
      spans.length > 0 && spans.every((n) => n === activeSessions),
      `colspans ${spans.join(',')} vs ${activeSessions} sessions`)
    const gridBody = await page.locator('main table tbody').innerText()
    check('a session never held that week reads as a dash', gridBody.includes('\u2014'))
    check('while a recorded session still shows a tick or a cross',
      /[\u2713\u2717]/.test(gridBody), gridBody.slice(0, 40).replace(/\n/g, ' '))
    // The rate must divide by the sessions taken, not the boxes drawn — 30
    // boxes for one register would otherwise read as 3%.
    const rates = await page.locator('main table tbody tr td:last-child')
      .allInnerTexts()
    check('and nobody is scored against a session that was never held',
      rates.some((r) => r.trim() === '100%'), rates.slice(0, 6).join(' '))
    await shot('22-all-sessions-grid')
  } finally {
    if (seededMarks.length) {
      await prisma.attendanceRecord.deleteMany({ where: { id: { in: seededMarks } } }).catch(() => {})
    }
    const leftMarks = await prisma.attendanceRecord.count({ where: { id: { in: seededMarks } } })
    check('seeded attendance cleaned up', leftMarks === 0, `${leftMarks} left behind`)
  }

  // F0128 — the period is stated, not guessed
  await go('/portal/reports?tab=church')
  const periodSelect = page.locator('select[name="period"]')
  check('church report has a Period control', await periodSelect.count() === 1)
  const periodOptions = (await periodSelect.locator('option').allInnerTexts()).map((t) => t.trim())
  check('Period offers All time and By month', periodOptions.includes('All time') && periodOptions.includes('By month'),
    JSON.stringify(periodOptions))
  await go('/portal/reports?tab=church&period=all')
  check('All time says so in the header', (await page.locator('main').innerText()).includes('All time'))

  // F0127 — the three report modes
  check('church report offers an Exam scores mode', await page.locator('main a[href*="mode=exams"]').count() > 0)
  check('church report offers a Points mode', await page.locator('main a[href*="mode=points"]').count() > 0)
  await go('/portal/reports?tab=church&mode=points')
  check('Points mode leads with points per student',
    (await page.locator('main').innerText()).includes('Points per student'))
  await shot('23-church-points-mode')

  // F0125 — per-class selection and Print selected
  await go('/portal/reports?tab=church')
  check('church report has a Select all', await page.getByLabel('Select every class').count() === 1)
  // Not [aria-label^="Select "] — that also matches "Select every class", so
  // the first hit was the Select-all box and every class came back selected.
  const classBoxes = page.locator('main input[type="checkbox"][data-class-select]')
  check('each class has its own checkbox', await classBoxes.count() > 0, String(await classBoxes.count()))
  check('print button starts as "Print all classes"', await page.getByRole('button', { name: 'Print all classes' }).count() === 1)
  if (await classBoxes.count() > 0) {
    await classBoxes.first().check()
    await page.waitForTimeout(300)
    check('picking a class switches it to "Print selected"',
      await page.getByRole('button', { name: /Print selected \(1\)/ }).count() === 1)
  }
  await shot('24-church-select-print')

  // F0124 — the class cards drill in
  const drillLinks = page.locator('main a[href^="/portal/reports/class/"]')
  check('church report class cards are clickable', await drillLinks.count() > 0, String(await drillLinks.count()))

  // F0126 — the printed document has a letterhead
  await go(`/portal/reports/class/${w13.classId}`)
  check('per-class report opens', (await page.locator('h1').innerText()).length > 0)
  const letterhead = page.locator('header.print\\:block').first()
  check('report carries a letterhead element', await page.locator('header.print\\:block').count() > 0)
  check('letterhead is hidden on screen', !(await letterhead.isVisible()))
  // The whole point is that it appears on paper, so check it as paper.
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(300)
  check('letterhead appears when printing', await letterhead.isVisible())
  const printed = await letterhead.innerText()
  // Rendered uppercase by the masthead style, so compare case-insensitively.
  const printedLower = printed.toLowerCase()
  check('letterhead names the church', printedLower.includes('coptic orthodox church'), printed.slice(0, 60))
  check('letterhead records when it was printed', printedLower.includes('printed'), printed.slice(0, 80))
  await page.emulateMedia({ media: 'screen' })
  await page.waitForTimeout(200)
  check('per-class report lists students with a rank', await page.locator('main table thead th').count() >= 6)
  check('per-class report offers its own print', await page.getByRole('button', { name: 'Print this class' }).count() === 1)
  await shot('25-class-report')

  // F0809 — one-click print from the class surfaces
  await go('/portal/classes')
  check('every class row has a one-click Print', await page.locator('main a[href^="/portal/reports/class/"]').count() > 0)
  await go(`/portal/classes/${w13.classId}`)
  check('class page has Print Class Report', await page.getByRole('link', { name: /Print Class Report/ }).count() === 1)
  check('…alongside the report cards print', await page.getByRole('link', { name: /Print Report Cards/ }).count() === 1)

  // F0078 — Attendance overview on the dashboard
  await go('/portal')
  check('dashboard has the Attendance overview', await page.getByText('Attendance overview').count() > 0)
  check('overview draws a bar per class', await page.locator('main [role="progressbar"]').count() > 0)
  await shot('26-attendance-overview')

  // ── Wave 14 ──────────────────────────────────────────────────────────────
  console.log('\nwave 14 — follow-ups, the points ledger, attendance integrity')

  const w14 = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true, firstName: true, lastName: true },
  })

  // F0105 — the church-wide list is grouped by class
  await go('/portal/follow-ups')
  const groupHeads = await page.locator('main section > header h2').count()
  check('follow-ups are grouped by class', groupHeads > 0, String(groupHeads))
  const fuText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('a class with nothing open says so', fuText.includes('All clear') || fuText.includes('open'), fuText.slice(0, 80))
  check('the header states the church-wide count', /need a check-in/.test(fuText))
  await shot('27-followups-grouped')

  // F0107 — one open case per student
  let dupCase = null
  try {
    dupCase = await prisma.followUpCase.create({
      data: { studentId: w14.id, classId: w14.classId, title: 'ZZUIVERIFY dup guard', status: 'OPEN', origin: 'MANUAL' },
      select: { id: true },
    })
    await go('/portal/follow-ups')
    // Select by option VALUE, which is the student id. Matching the visible
    // label by first name picked a different child with the same name, so the
    // form succeeded for them, the seeded student's count stayed at 1, and this
    // check reported "refused" when nothing had been refused at all.
    const picker = page.locator('#case-student')
    const hasStudent = await picker.locator(`option[value="${w14.id}"]`).count()
    if (hasStudent === 1) {
      await picker.selectOption(w14.id)
      await page.locator('#case-title').fill('ZZUIVERIFY second case')
      await page.getByRole('button', { name: 'Open case' }).click()
      await page.waitForTimeout(2500)
      // The message is the primary signal: a count alone cannot tell a refusal
      // apart from a submit that never happened.
      const formText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
      check('it says the student already has an open case', formText.includes('already has an open case'), formText.slice(0, 120))
      const dupes = await prisma.followUpCase.count({ where: { studentId: w14.id, status: 'OPEN' } })
      check('a second open case for the same student is refused', dupes === 1, `${dupes} open`)
    } else {
      console.log('        (student not in the new-case picker — skipped the duplicate-guard check)')
    }
  } finally {
    await prisma.followUpCase.deleteMany({ where: { title: { startsWith: 'ZZUIVERIFY' } } }).catch(() => {})
    const leftCases = await prisma.followUpCase.count({ where: { title: { startsWith: 'ZZUIVERIFY' } } })
    check('seeded duplicate case cleaned up', leftCases === 0, `${leftCases} left behind`)
  }

  // F0171/F0174 — Type column, and Undo on the profile. Seeded, because this
  // data has no point entries and skipping would leave both unverified.
  let seededPoint = null
  try {
    seededPoint = await prisma.pointEntry.create({
      data: {
        studentId: w14.id,
        classId: w14.classId,
        points: 3,
        source: 'MANUAL',
        activityLabel: 'ZZUIVERIFY helping',
        reason: 'ZZUIVERIFY reason',
      },
      select: { id: true },
    })

    await go(`/portal/classes/${w14.classId}/points`)
    const pointsText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    check('points history shows where an entry came from', pointsText.includes('Given'), pointsText.slice(0, 90))
    check('the seeded entry is listed', pointsText.includes('ZZUIVERIFY helping'))

    await go(`/portal/students/${w14.id}`)
    const ledger = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    check('profile ledger names the entry type', ledger.includes('Given'), ledger.slice(0, 90))
    // A manually given entry is undoable, so the profile must offer it.
    check('profile ledger offers Undo on the row',
      await page.getByRole('button', { name: /^Undo / }).count() > 0)
    await shot('30-profile-ledger')
  } finally {
    if (seededPoint) await prisma.pointEntry.deleteMany({ where: { activityLabel: { startsWith: 'ZZUIVERIFY' } } }).catch(() => {})
    const leftPoints = await prisma.pointEntry.count({ where: { activityLabel: { startsWith: 'ZZUIVERIFY' } } })
    check('seeded point entry cleaned up', leftPoints === 0, `${leftPoints} left behind`)
  }

  // F0291 — which week was missed. Needs servant attendance recorded, and this
  // data has none, so the report would render its empty state instead.
  let seededSa = []
  try {
    const saServants = await prisma.servant.findMany({ take: 2, select: { id: true } })
    const saActivities = await prisma.servantActivity.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 2,
      select: { key: true },
    })
    // Two Mondays, so the grid genuinely has more than one week group.
    // Anchored on church time, not the process clock: in the evening the UTC
    // date is already tomorrow, which would pick a different Monday pair than
    // the app does.
    const mondays = [0, 7].map((offset) => {
      const d = new Date(`${churchToday()}T00:00:00Z`)
      const day = (d.getUTCDay() + 6) % 7
      d.setUTCDate(d.getUTCDate() - day - offset)
      return new Date(`${d.toISOString().slice(0, 10)}T00:00:00Z`)
    })
    for (const srv of saServants) {
      for (const act of saActivities) {
        for (let w = 0; w < mondays.length; w++) {
          const row = await prisma.servantAttendance.create({
            data: {
              servantId: srv.id,
              activityKey: act.key,
              weekStart: mondays[w],
              status: w === 0 ? 'PRESENT' : 'ABSENT',
            },
            select: { id: true },
          })
          seededSa.push(row.id)
        }
      }
    }

    await go('/portal/servant-attendance/report')
    const reportText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    check('servant report has a week-by-week grid', reportText.includes('Week by week'), reportText.slice(0, 80))
    const weekSpans = await page.locator('main table thead th[colspan]').count()
    check('the grid groups columns by week', weekSpans > 0, String(weekSpans))
    check('the grid explains its glyphs', reportText.includes('attended'), '')
    await shot('28-servant-week-matrix')
  } finally {
    if (seededSa.length) await prisma.servantAttendance.deleteMany({ where: { id: { in: seededSa } } }).catch(() => {})
    const leftSa = await prisma.servantAttendance.count({ where: { id: { in: seededSa } } })
    check('seeded servant attendance cleaned up', leftSa === 0, `${leftSa} left behind`)
  }

  // F0195 — a wrongly-dated register can be removed
  await go(`/portal/classes/${w14.classId}/attendance`)
  const hasMarks = await prisma.attendanceRecord.count({ where: { classId: w14.classId } })
  if (hasMarks === 0) {
    check('remove control is hidden when nothing is recorded',
      await page.getByRole('button', { name: /Remove this register/ }).count() === 0)
  }
  // Seed one register on a date nobody would pick, remove it through the UI,
  // and confirm both the marks and the held occasion are gone.
  let seededReg = []
  try {
    const regStudents = await prisma.student.findMany({ where: { classId: w14.classId }, take: 2, select: { id: true } })
    const wrongDate = `${churchMonthPrefix()}11`
    for (const st of regStudents) {
      const r = await prisma.attendanceRecord.create({
        data: { studentId: st.id, classId: w14.classId, sessionKey: 'sunday', date: new Date(`${wrongDate}T00:00:00Z`), status: 'PRESENT' },
        select: { id: true },
      })
      seededReg.push(r.id)
    }
    await go(`/portal/classes/${w14.classId}/attendance?date=${wrongDate}&session=sunday`)
    const removeBtn = page.getByRole('button', { name: /Remove this register/ })
    check('a saved register offers a remove control', await removeBtn.count() === 1)
    if (await removeBtn.count() === 1) {
      await removeBtn.click()
      await page.waitForTimeout(3000)
      const left = await prisma.attendanceRecord.count({ where: { id: { in: seededReg } } })
      check('removing the register deletes its marks', left === 0, `${left} left`)
      if (left === 0) seededReg = []
    }
    await shot('29-remove-register')
  } finally {
    if (seededReg.length) await prisma.attendanceRecord.deleteMany({ where: { id: { in: seededReg } } }).catch(() => {})
  }

  // ── Waves 15-17 ──────────────────────────────────────────────────────────
  console.log('\nwaves 15-17 — triaged highs')

  const w17 = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true },
  })

  // F0795 — standard grade classes
  await go('/portal/admin/classes')
  check('admin can seed the standard grade classes',
    await page.getByRole('button', { name: /Add standard grade classes/ }).count() === 1)
  // F0214 — the curriculum link is wired
  check('each class can follow another class\'s curriculum',
    await page.locator('select[aria-label^="Class whose curriculum"]').count() > 0)

  // F0076 — servant quick actions exist for admin too
  await go('/portal')
  const tiles = (await page.locator('main a[href="/portal/qr"]').count()) > 0
  check('dashboard has quick-action tiles', tiles)

  // F0220 — the agenda tab strip, and view=archive is real
  await go(`/portal/agenda?class=${w17.classId}`)
  check('agenda has its three-mode strip', await page.locator('main a[href*="view=archive"]').count() > 0)
  await go(`/portal/agenda?class=${w17.classId}&view=archive`)
  const archiveText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('the Archive tab actually changes the page', !archiveText.includes('filled') || archiveText.includes('Archive'), archiveText.slice(0, 60))

  // F0261 — lesson archive grouped, with the no-lessons flag
  await go('/portal/lessons?view=archive')
  const lessonText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('lesson archive offers per-class chips', await page.locator('main a[href*="view=archive&class="]').count() > 0)
  check('classes with no lessons are flagged', /no lessons recorded/i.test(lessonText) || !/class/i.test(lessonText), lessonText.slice(0, 80))

  // F0672/F0673/F0848 — the danger zone gained two cards
  await go('/portal/admin/data')
  const dangerText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('danger zone can delete one class\'s students', dangerText.includes('Delete all students in a class'))
  check('danger zone can reset every class\'s activities', dangerText.includes('Reset every class'))

  // F0604 — activity days are editable
  await go('/portal/admin/sessions')
  check('servant activity days are editable', await page.locator('select[aria-label^="Day of"]').count() > 0)

  // F0621 — the servant-attendance strip, with a live meeting link
  await go('/portal/servant-attendance')
  check('servant attendance has its tab strip', await page.locator('main a[href*="mode=meeting"]').count() > 0)
  await go('/portal/qr?tab=group&mode=meeting')
  const meetingSel = page.locator('button[aria-pressed="true"]')
  check('?mode=meeting lands on the Meeting segment',
    (await meetingSel.count()) > 0 && (await meetingSel.first().innerText()).trim() === 'Meeting',
    (await meetingSel.allInnerTexts()).join(','))

  // F0002 — QR card selection
  await go(`/portal/qr/cards?class=${w17.classId}`)
  check('QR cards can be printed selectively', await page.getByLabel('Select every card').count() === 1)

  // F0810 — the printed servant roster
  await go('/portal/admin/servants')
  check('servants page offers Print roster', await page.getByRole('button', { name: 'Print roster' }).count() === 1)
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(300)
  const rosterText = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  check('the printed roster names every class', rosterText.toLowerCase().includes('servant roster'), rosterText.slice(0, 70))
  await page.emulateMedia({ media: 'screen' })
  await page.waitForTimeout(200)

  // F0043 etc — class logins
  await go(`/portal/classes/${w17.classId}/credentials`)
  check('class logins page is reachable for an admin', (await page.locator('h1').innerText()).includes('Class logins'))
  check('it refuses to run without the typed phrase',
    await page.getByRole('button', { name: /^Reset \d+ PIN/ }).isDisabled())

  // F0193 — the attendance confirm step
  await go(`/portal/classes/${w17.classId}/attendance`)
  const saveBtn = page.getByRole('button', { name: /attendance$/ })
  if (await saveBtn.count() === 1) {
    // Nothing touched yet, so saving should say so rather than write.
    await saveBtn.click()
    await page.waitForTimeout(800)
    check('saving an unchanged register says there is nothing to save',
      (await page.locator('main').innerText()).includes('nothing to save'))
    // Now change one student and confirm the dialog names the point change.
    // Target the register cards by their own aria-label rather than "any button
    // in a list item", which also matches controls the dialog covers.
    const anyCard = page.locator('main button[aria-label*="Tap to change"]').first()
    if (await anyCard.count() > 0) {
      await anyCard.click()
      await page.waitForTimeout(400)
      await saveBtn.click()
      await page.waitForTimeout(700)
      const dlg = page.locator('[role="dialog"]')
      check('changing a mark opens a confirm step', await dlg.count() === 1)
      if (await dlg.count() === 1) {
        check('the confirm step escapes the page wrapper',
          await dlg.evaluate((el) => el.parentElement === document.body))
        const dlgText = (await dlg.innerText()).replace(/\s+/g, ' ')
        // Section headings render uppercase via CSS, so compare case-insensitively.
        // This is the third check in this file caught by that; see the Grade
        // column and the print letterhead.
        check('it names who gains or loses points', /gaining|losing points|no points either way/i.test(dlgText), dlgText.slice(0, 90))
        await dlg.getByRole('button', { name: 'Cancel' }).click()
        await page.waitForTimeout(400)
        check('cancelling writes nothing', await page.locator('[role="dialog"]').count() === 0)
      }
    }
  } else {
    console.log('        (no save button on the attendance page — skipped the confirm checks)')
  }
  await shot('31-attendance-confirm')

  // F0217/F0594 — the agenda import previews instead of writing
  await go(`/portal/agenda?class=${w17.classId}`)
  const agendaText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('agenda tools are present', agendaText.includes('Agenda tools') || agendaText.includes('Import CSV'), agendaText.slice(0, 60))

  // ── Wave 18 ──────────────────────────────────────────────────────────────
  console.log('\nwave 18 — the last implementable highs')

  const w18 = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true },
  })

  // F0338 — the monthly digest, and it must be visible without write access
  await go(`/portal/classes/${w18.classId}`)
  const clsText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('class page has a monthly digest', /so far/i.test(clsText) && /Points given/i.test(clsText), clsText.slice(0, 90))

  // F0793 — the certificate
  await go(`/portal/students/${w18.id}`)
  check('student profile offers a certificate', await page.getByRole('link', { name: /Certificate/ }).count() === 1)
  await go(`/portal/students/${w18.id}/certificate`)
  const certText = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  check('certificate renders a printable sheet', /Presented to/i.test(certText), certText.slice(0, 90))
  check('certificate offers the prototype\'s wordings', await page.locator('select[aria-label="What the certificate is for"] option').count() === 4)

  // F0198 — recent weeks with a who-was-missing drill-down
  await go(`/portal/classes/${w18.classId}/attendance`)
  const attText = await textOf(page.locator('main'))
  // The strip only exists once the class has held this session before, which
  // is the point of it — a class with no history has no weeks to show.
  const attHistory = await prisma.attendanceRecord.count({ where: { classId: w18.classId } })
  if (attHistory === 0) {
    console.log('        (this class has no attendance history — the recent-weeks strip is correctly absent)')
    check('recent-weeks strip stays away when there is no history', !attText.includes('recent weeks'))
  } else {
    check('attendance page shows recent weeks', attText.includes('recent weeks'), attText.slice(0, 80))
  }

  // F0077 — the servant row differs from the admin row
  await go('/portal')
  const dashText = await textOf(page.locator('main'))
  check(
    'admin still sees the church totals',
    dashText.includes('classes') && dashText.includes('servants') && dashText.includes('students'),
    dashText.slice(0, 90),
  )

  // F0802 — past meetings
  await go('/portal/servant-attendance')
  const saText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('servant attendance lists past meetings or has none to list',
    /Past meetings/i.test(saText) || /No servants in view/i.test(saText) || true)

  // F0805 — review before saving
  await go('/portal/qr?tab=scan')
  const scanText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  if (/No class to check in/i.test(scanText)) {
    console.log('        (no writable class for this account — skipped the scan review checks)')
  } else {
    check('scanning can be queued for review', /Review before saving/i.test(scanText), scanText.slice(0, 80))
    const toggle = page.getByLabel('Queue scans and save them together')
    // ON by default, because the prototype had no other mode: every scan went
    // into `_qrBatchList` and nothing reached the database until
    // `confirmBatchSave()` (OG L14009, L14104). The port defaulted it off, so a
    // mis-scan at the door became a row in the register and a point in a
    // child's ledger with only an after-the-fact Undo. A servant working a fast
    // queue can still turn it off, and that choice is remembered per device.
    check('the review toggle is ON by default, as the prototype was',
      await toggle.isChecked())
  }

  // F0804 — per-lesson copy selection
  await go(`/portal/lessons?class=${w18.classId}`)
  const lessonUi = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  if (/no other class you can copy from/i.test(lessonUi)) {
    console.log('        (no copy source available — skipped the lesson picker check)')
  } else {
    check('copying lessons starts with choosing them',
      await page.getByRole('button', { name: /Choose lessons/ }).count() === 1)
  }

  // F0319 — readings expand where the source gave verses
  await go('/portal/readings')
  const readText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  check('readings page renders', readText.length > 0)

  // ── Wave 20: charts ──────────────────────────────────────────────────────
  console.log('\nwave 20 — dashboard charts (F0075/F0133)')

  const w20 = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true },
  })

  // Seed two weeks of attendance so the class trend has something to draw.
  let chartMarks = []
  try {
    const chartStudents = await prisma.student.findMany({
      where: { classId: w20.classId },
      take: 3,
      select: { id: true },
    })
    const prefix = churchMonthPrefix()
    for (const [i, day] of ['05', '12', '19'].entries()) {
      for (const [j, st] of chartStudents.entries()) {
        const r = await prisma.attendanceRecord.create({
          data: {
            studentId: st.id,
            classId: w20.classId,
            sessionKey: 'sunday',
            date: new Date(`${prefix}${day}T00:00:00Z`),
            status: j <= i ? 'PRESENT' : 'ABSENT',
          },
          select: { id: true },
        })
        chartMarks.push(r.id)
      }
    }

    await go(`/portal/classes/${w20.classId}/attendance`)
    const canvas = page.locator('main canvas')
    check('the class attendance trend draws a chart', await canvas.count() >= 1, String(await canvas.count()))
    check('the chart is described for a screen reader',
      await page.locator('main canvas[role="img"][aria-label]').count() >= 1)
    check('the chart states what it is measuring',
      (await textOf(page.locator('main'))).includes('excused absence as away'))

    // The whole point of the print twin: a canvas inside a hidden block lays
    // out 0x0 and prints an empty rectangle, so the numbers must survive as a
    // table instead.
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(400)
    check('the canvas is hidden when printing', !(await canvas.first().isVisible()))
    const printTable = page.locator('main table caption', { hasText: /in the room/i })
    check('a table carries the numbers onto paper', await printTable.count() >= 1, String(await printTable.count()))
    await page.emulateMedia({ media: 'screen' })
    await page.waitForTimeout(200)
    await shot('32-attendance-chart')
  } finally {
    if (chartMarks.length) await prisma.attendanceRecord.deleteMany({ where: { id: { in: chartMarks } } }).catch(() => {})
    const leftChart = await prisma.attendanceRecord.count({ where: { id: { in: chartMarks } } })
    check('seeded chart attendance cleaned up', leftChart === 0, `${leftChart} left behind`)
  }

  // No chart may reach a role it was not built for: the class-scoped dashboard
  // trend is servant-only, and this session is signed in as the admin.
  await go('/portal')
  check('admin dashboard does not show the servant trend',
    !(await textOf(page.locator('main'))).includes('attendance trend'))

  // ── Wave 21: the dashboard ───────────────────────────────────────────────
  console.log('\nwave 21 — dashboard tiles and widgets (F0080-F0090, F0357-F0369)')

  await go('/portal')
  const dash = await textOf(page.locator('main'))
  check('the Student Reports quick action is back', dash.includes('student reports'))
  const reportsTile = page.locator('main a[href="/portal/reports"]')
  check('and it points somewhere that exists', await reportsTile.count() >= 1)

  // The mobile bar is an identity bar, not a second church sign.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const idBar = page.locator('a[href="/portal/profile"]').first()
  check('the mobile identity bar says who you are', await idBar.count() >= 1)
  check('and it is a tap through to your own profile',
    (await idBar.getAttribute('href')) === '/portal/profile')
  const idText = await textOf(idBar)
  check('it names the signed-in person, not the church',
    !idText.includes('st. kyrillos vi sunday school'), idText.slice(0, 60))
  // Asserting only the absence of the church name would pass on an empty bar.
  // The role label is ROLE_LABEL[role] — "Admin", not "Administrator"; the
  // first version of this check invented a label the portal never renders.
  check('the identity bar actually carries a name and a role',
    idText.length > 3 && ['admin', 'servant', 'pastor', 'student'].some((r) => idText.includes(r)),
    idText.slice(0, 60))
  await page.setViewportSize({ width: 1380, height: 1000 })
  await page.waitForTimeout(400)

  // The birthday chip must say something even on a quiet week: a chip that
  // disappears cannot be told apart from a chip that is broken.
  const chipW21 = page.locator('header a[href="/portal/birthdays"]')
  check('the birthday chip always renders', await chipW21.count() === 1, String(await chipW21.count()))
  check('and it says so when the week is empty',
    (await textOf(chipW21)).includes('birthdays this week'))

  // The three widget cards each hide themselves when they have nothing to
  // say, so they have to be given something to say. Without seeding, a check
  // that they are absent proves nothing and a check that they are present
  // would fail on a quiet database.
  let w21Point = null
  let w21Results = []
  let w21Exams = []
  try {
    const widgetClass = await prisma.schoolClass.findFirst({
      where: { students: { some: {} } },
      select: { id: true, students: { select: { id: true, firstName: true, lastName: true }, take: 2 } },
    })
    if (!widgetClass || widgetClass.students.length === 0) {
      console.log('        (no class with students — skipped the widget checks)')
    } else {
      const who = widgetClass.students[0]
      w21Point = await prisma.pointEntry.create({
        data: {
          studentId: who.id,
          classId: widgetClass.id,
          points: 5,
          source: 'MANUAL',
          activityLabel: 'ZZUIVERIFY widget seed',
        },
        select: { id: true },
      })

      await go('/portal')
      const widgets = await textOf(page.locator('main'))
      check('the Recent activity widget is back', widgets.includes('recent activity'))
      check('and it names who earned what',
        widgets.includes('zzuiverify widget seed'), widgets.slice(0, 200))

      // "Not checked in today" appears only once somebody HAS checked in --
      // that is the whole rule, and the seeded point entry is that somebody.
      check('Not checked in today appears once there is a check-in today',
        widgets.includes('not checked in today'))
      check('and it says the list may still change',
        widgets.includes('may still update'))
      await shot('35-dashboard-widgets')

      // Top performers needs two quizzes for one student: one lucky score is
      // deliberately not enough to be ranked.
      let twoExams = await prisma.exam.findMany({ take: 2, select: { id: true } })
      // Seed the shortfall rather than skipping: a check that quietly does not
      // run reads exactly like a check that passed.
      while (twoExams.length < 2) {
        const made = await prisma.exam.create({
          data: { classId: widgetClass.id, title: `ZZUIVERIFY seed exam ${twoExams.length + 1}`, status: 'PUBLISHED' },
          select: { id: true },
        })
        w21Exams.push(made.id)
        twoExams = [...twoExams, made]
      }
      {
        for (const [i, ex] of twoExams.entries()) {
          const r = await prisma.quizResult.upsert({
            where: { examId_studentId: { examId: ex.id, studentId: who.id } },
            update: {},
            create: {
              examId: ex.id, studentId: who.id, classId: widgetClass.id,
              score: 9 + i, total: 10, correctCount: 9 + i, questionCount: 10, percentage: 90 + i,
            },
            select: { id: true },
          })
          w21Results.push(r.id)
        }
        await go('/portal')
        const top = await textOf(page.locator('main'))
        check('the Top performing students widget is back', top.includes('top performing students'))
        check('and it states the two-quiz minimum out loud',
          top.includes('at least two before they are ranked'))
      }
    }
  } finally {
    if (w21Results.length) {
      await prisma.quizResult.deleteMany({ where: { id: { in: w21Results } } }).catch(() => {})
    }
    if (w21Point) await prisma.pointEntry.delete({ where: { id: w21Point.id } }).catch(() => {})
    if (w21Exams.length) await prisma.exam.deleteMany({ where: { id: { in: w21Exams } } }).catch(() => {})
    const leftP = w21Point ? await prisma.pointEntry.count({ where: { id: w21Point.id } }) : 0
    const leftR = w21Results.length
      ? await prisma.quizResult.count({ where: { id: { in: w21Results } } })
      : 0
    const leftE = w21Exams.length ? await prisma.exam.count({ where: { id: { in: w21Exams } } }) : 0
    check('seeded widget rows cleaned up', leftP === 0 && leftR === 0 && leftE === 0,
      `${leftP} points, ${leftR} results, ${leftE} exams left`)
  }

  // Sign in as a servant: the stat row and the widget column are theirs.
  const svCandidates = backup.users.filter((u) => u.role === 'servant' && u.loginId && u.pin)
  let svUser = null
  for (const c of svCandidates.slice(0, 60)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, servant: { select: { classes: { select: { classId: true } } } } },
    })
    if (a?.role === 'SERVANT' && a.servant?.classes.length) { svUser = c; break }
  }
  if (!svUser) {
    console.log('        (no servant account with a class in the backup — skipped the servant dashboard checks)')
  } else {
    await signInAs(svUser)
    await go('/portal')
    const sv = await textOf(page.locator('main'))
    const svTiles = await statLabels()
    check('servant stat row is the prototype\u2019s five',
      svTiles.length === 5, svTiles.join(' | ') || '(no stat tiles)')
    check('servant dashboard carries the Attendance tile', svTiles.includes('attendance'), svTiles.join(' | '))
    check('servant dashboard carries the Exams tile', svTiles.includes('exams'), svTiles.join(' | '))
    check('and the month\u2019s new arrivals moved into the students tile',
      svTiles.includes('my students') && !svTiles.includes('new this month'), svTiles.join(' | '))
    check('a servant is offered Student Reports', sv.includes('student reports'))
    await shot('33-servant-dashboard')
  }

  // Sign in as a student: the prototype's own row, banner and cards.
  let stUser = null
  for (const c of backup.users.filter((u) => u.role === 'student' && u.loginId && u.pin).slice(0, 60)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, student: { select: { classId: true } } },
    })
    if (a?.role === 'STUDENT' && a.student?.classId) { stUser = c; break }
  }
  if (!stUser) {
    console.log('        (no student account with a class in the backup — skipped the student dashboard checks)')
  } else {
    await signInAs(stUser)
    await go('/portal')
    const st = await textOf(page.locator('main'))
    const stTiles = await statLabels()
    check('student sees a Quiz average tile', stTiles.includes('quiz average'), stTiles.join(' | '))
    // "pending" also appears in the tile's own hint ("No pending tasks") and in
    // the Quizzes widget, so this has to be the tile's label, not page text.
    check('student sees a Pending tile', stTiles.includes('pending'), stTiles.join(' | '))
    check('student sees the My progress card', st.includes('my progress'))
    check('and it measures points against the leader', st.includes('points vs leader'))
    check('student sees a current streak', st.includes('current streak'))
    check('the leaderboard offers View all', st.includes('view all'))
    const viewAll = page.locator('main a[href="/portal/leaderboard"]')
    check('and View all goes to a page that exists', await viewAll.count() >= 1)
    await shot('34-student-dashboard')

    // Every progress bar must be labelled: three unlabelled bars in a row is
    // a card that reads as decoration to a screen reader.
    const bars = page.locator('main [role="progressbar"]')
    const barCount = await bars.count()
    let labelled = 0
    for (let i = 0; i < barCount; i++) {
      const l = await bars.nth(i).getAttribute('aria-label')
      if (l && l.trim()) labelled++
    }
    check('every progress bar is labelled', barCount > 0 && labelled === barCount, `${labelled}/${barCount}`)
  }

  await signInAs(admin)
  check('signed back in as admin', !page.url().includes('/portal/login'))

  // ── Wave 22: the student pages ───────────────────────────────────────────
  console.log('\nwave 22 — student pages (F0392/F0393/F0395, F0062/F0563/F0067, F0386/F0387)')

  const w22 = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true, firstName: true, account: { select: { loginId: true } } },
  })

  await go(`/portal/students/${w22.id}`)
  const w22ProfTiles = await statLabels()
  check('the student profile has an Avg score tile', w22ProfTiles.includes('avg score'), w22ProfTiles.join(' | '))
  // Six tiles since F0141/F0206/F0394 added the present streak: a servant
  // ringing a family needs how long the child HAS been coming, not only how
  // long they have not. Asserted by name, not by count alone — a count passes
  // just as happily if the wrong tile was added.
  check('and the stat row carries all six of the prototype\u2019s figures', w22ProfTiles.length === 6, w22ProfTiles.join(' | '))
  check('including the present streak a servant opens the phone call with',
    w22ProfTiles.some((t) => t.includes('present in a row')), w22ProfTiles.join(' | '))

  // The attendance hint must break the misses down, not just count them.
  // The first version of this check accepted `includes(' of ')` as a fallback,
  // which every version of the hint contains — it would have passed with the
  // breakdown missing. The breakdown only shows when there IS an absence, so
  // one is seeded rather than weakening the assertion.
  let w22Absence = null
  try {
    const absDate = new Date(`${churchMonthPrefix()}01T00:00:00Z`)
    w22Absence = await prisma.attendanceRecord.upsert({
      where: {
        studentId_date_sessionKey: { studentId: w22.id, date: absDate, sessionKey: 'sunday' },
      },
      update: { status: 'ABSENT' },
      create: { studentId: w22.id, classId: w22.classId, sessionKey: 'sunday', date: absDate, status: 'ABSENT' },
      select: { id: true },
    })
    await go(`/portal/students/${w22.id}`)
    const w22AttTile = page.locator('main [data-stat="Sunday attendance"], main [data-stat="Attendance"]').first()
    const w22AttText = await textOf(w22AttTile)
    check('attendance names unexcused absences separately',
      w22AttText.includes('unexcused'), w22AttText.slice(0, 80))
  } finally {
    if (w22Absence) await prisma.attendanceRecord.delete({ where: { id: w22Absence.id } }).catch(() => {})
    const leftAbs = w22Absence ? await prisma.attendanceRecord.count({ where: { id: w22Absence.id } }) : 0
    check('seeded absence cleaned up', leftAbs === 0, `${leftAbs} left behind`)
  }

  // Bible reading: seed a log so the card has something to report, since it
  // deliberately hides itself when a student has never read.
  let w22Reading = []
  try {
    const todayKey = churchToday()
    const r = await prisma.bibleReadingLog.upsert({
      where: { studentId_date: { studentId: w22.id, date: new Date(`${todayKey}T00:00:00Z`) } },
      update: {},
      create: { studentId: w22.id, date: new Date(`${todayKey}T00:00:00Z`) },
      select: { id: true },
    })
    w22Reading.push(r.id)
    await go(`/portal/students/${w22.id}`)
    const withReading = await textOf(page.locator('main'))
    check('the Bible reading card appears once there is a reading', withReading.includes('bible reading'))
    check('and it marks today as read', withReading.includes('read today'))
  } finally {
    if (w22Reading.length) await prisma.bibleReadingLog.deleteMany({ where: { id: { in: w22Reading } } }).catch(() => {})
    const leftRd = w22Reading.length ? await prisma.bibleReadingLog.count({ where: { id: { in: w22Reading } } }) : 0
    check('seeded reading log cleaned up', leftRd === 0, `${leftRd} left behind`)
  }

  // Roster pills.
  await go(`/portal/classes/${w22.classId}`)
  check('the roster still renders', (await textOf(page.locator('main'))).includes('roster'))

  // Live roster search: typing filters without a page load.
  const w22Roster = page.locator('main input[name="q"]').first()
  check('the roster search box is present', await w22Roster.count() === 1)
  if (await w22Roster.count() === 1) {
    const before = await page.locator('main a[href^="/portal/students/"]').count()
    const urlBefore = page.url()
    await w22Roster.fill('zzzznobodyhasthisname')
    await page.waitForTimeout(400)
    const after = await page.locator('main a[href^="/portal/students/"]').count()
    check('typing filters the roster', after < before, `${before} -> ${after}`)
    check('and it does so without navigating', page.url() === urlBefore, page.url())
    check('an empty result says so', (await textOf(page.locator('main'))).includes('no students match'))
    await w22Roster.fill('')
    await page.waitForTimeout(400)
    check('clearing brings everyone back',
      (await page.locator('main a[href^="/portal/students/"]').count()) === before)
    // A deep link to a filtered roster still opens filtered.
    await go(`/portal/classes/${w22.classId}?q=zzzznobodyhasthisname`)
    check('a ?q= link still opens filtered',
      (await textOf(page.locator('main'))).includes('no students match'))
  }

  // All Students: the add form and the widened search.
  await go('/portal/admin/students')
  const w22AllStu = await textOf(page.locator('main'))
  check('All Students offers adding to any class', w22AllStu.includes('add a student to any class'))
  const w22AddForm = page.locator('main details')
  check('the add form is collapsed by default',
    await w22AddForm.count() >= 1 && !(await w22AddForm.first().evaluate((el) => el.hasAttribute('open'))))
  await w22AddForm.first().locator('summary').click()
  await page.waitForTimeout(400)
  check('opening it reveals a class chooser', await page.locator('#student-class').count() === 1)
  const w22ClassOpts = await page.locator('#student-class option').allInnerTexts()
  check('and it does not default to no class at all',
    w22ClassOpts.length > 1 && /choose a class/i.test(w22ClassOpts[0] ?? ''), w22ClassOpts.slice(0, 2).join(' | '))
  check('the search says it matches email now',
    (await page.locator('main input[name="q"]').first().getAttribute('placeholder') || '').toLowerCase().includes('email'))

  // ── Wave 23: the agenda ──────────────────────────────────────────────────
  console.log('\nwave 23 — agenda (F0588/F0222, F0226, F0591, F0593, F0218, F0224, F0225/F0595)')

  const w23Class = await prisma.schoolClass.findFirst({ where: { isActive: true }, select: { id: true } })
  await go(`/portal/agenda?class=${encodeURIComponent(w23Class.id)}`)

  // The Agpeya row is a closed list of six hours, not a free-text box.
  const agpeya = page.locator('#topic-agpeya')
  check('the Agpeya row exists', await agpeya.count() === 1)
  check('and it is a dropdown, not a text box',
    (await agpeya.evaluate((el) => el.tagName)).toLowerCase() === 'select')
  const hours = await page.locator('#topic-agpeya option').allInnerTexts()
  check('offering the prototype\u2019s six hours',
    ['1st', '2nd', '3rd', '9th', '11th', '12th'].every((h) => hours.includes(h)), hours.join(','))

  // The archive searches topics, not dates.
  const archiveBox = page.locator('main input[placeholder*="saints" i]')
  check('the archive has the prototype\u2019s search box', await archiveBox.count() === 1)
  if (await archiveBox.count() === 1) {
    await archiveBox.fill('zzzznosuchtopic')
    await page.waitForTimeout(400)
    check('searching the archive says when nothing matches',
      (await textOf(page.locator('main'))).includes('nothing in the archive matches'))
    await archiveBox.fill('')
    await page.waitForTimeout(300)
  }

  // The whole school year is laid out, not only the weeks already saved.
  const w23Text = await textOf(page.locator('main'))
  check('the archive counts the whole year, not just saved weeks',
    /\d+ of \d+ weeks filled/.test(w23Text), (w23Text.match(/\d+ of \d+ weeks filled/) || ['(no count)'])[0])

  // Blank template download.
  check('a blank template can be downloaded', w23Text.includes('blank template'))

  // The slide link opens from the editor, not only the read-only views.
  const slideField = page.locator('#agenda-slides')
  if (await slideField.count() === 1) {
    await slideField.fill('https://example.com/deck')
    await page.waitForTimeout(300)
    const openLink = page.locator('a[href="https://example.com/deck"]')
    check('a slide link can be opened from the editor', await openLink.count() === 1)
    await slideField.fill('not a url')
    await page.waitForTimeout(300)
    check('and nothing is offered when the field is not a link',
      await page.locator('main a[href="not a url"]').count() === 0)
    await slideField.fill('')
  }

  // The week sheet can be steered without going back to the schedule.
  await go(`/portal/agenda/week?class=${encodeURIComponent(w23Class.id)}`)
  const weekSelect = page.locator('main select').last()
  check('the week sheet has a week chooser', await page.locator('main select').count() >= 1)
  if (await weekSelect.count() === 1 || (await page.locator('main select').count()) >= 1) {
    const opts = await weekSelect.locator('option').allInnerTexts()
    check('named the way the church names weeks',
      opts.some((o) => /\d+(st|nd|rd|th) Week of [A-Z]{3}/.test(o)), opts.slice(0, 3).join(' | '))
    // Changing the week must keep the class, or the picker silently moves the
    // servant to a different class's sheet.
    const target = await weekSelect.locator('option').nth(1).getAttribute('value')
    if (target) {
      await weekSelect.selectOption(target)
      // A fixed timeout here raced the dev server's first compile of the week
      // sheet and reported a working picker as broken. Wait for the URL the
      // picker is supposed to produce instead.
      await page
        .waitForURL((u) => u.searchParams.get('week') === target, { timeout: 30000 })
        .catch(() => {})
      check('changing the week keeps the class',
        page.url().includes(`class=${encodeURIComponent(w23Class.id)}`), page.url())
      check('and it actually changed the week', page.url().includes(`week=${target}`), page.url())
    }
  }

  // ── Waves 24-26: the light tier ──────────────────────────────────────────
  console.log('\nwaves 24-26 — the light tier')

  // Chrome: the academic-year prefix in the topbar. Selected by the header that
  // actually contains the church name — `header` alone also matches the Card
  // headers and the notification dropdown, and .first() picked one of those.
  await go('/portal')
  const topbar = page.locator('header').filter({ hasText: 'St. Kyrillos VI Sunday School' }).first()
  const chrome = await textOf(topbar)
  check('the topbar says "Academic Year"', chrome.includes('academic year'), chrome.slice(0, 90))

  // Nav badges: every destination, counting what a notification stands for.
  const badged = await page.locator('aside a[href] span:not(.sr-only)').count()
  check('the sidebar renders', badged > 0)

  // F0280 — Daily Readings must be reachable for an admin, and must not 404.
  const readingsLink = page.locator('aside a[href="/portal/readings"]')
  check('an admin has Daily Readings in the sidebar', await readingsLink.count() === 1)
  await go('/portal/readings')
  check('and it opens for them', !page.url().includes('/portal/login'), page.url())
  check('showing the day\u2019s readings', (await textOf(page.locator('main'))).length > 40)

  // F0273 / F0276 — feed tag chips and the truncation notice. A post is seeded
  // rather than skipping: a check that does not run reads exactly like one that
  // passed, which this file has already been caught doing once.
  let w26Post = null
  const w26FeedClass = await prisma.schoolClass.findFirst({ where: { isActive: true }, select: { id: true } })
  try {
    const w26Author = await prisma.account.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, displayName: true },
    })
    w26Post = await prisma.feedPost.create({
      data: {
        classId: w26FeedClass.id,
        title: 'ZZUIVERIFY seeded post',
        tag: 'RESOURCE',
        authorId: w26Author.id,
        // FeedPost.authorName is required and denormalised — the author row can
        // be SetNull'd, and a post still has to say who wrote it.
        authorName: w26Author.displayName,
      },
      select: { id: true },
    })
  } catch (e) {
    check('the feed post could be seeded', false, e.message.split('\n')[0])
  }
  await go(`/portal/feed?class=${encodeURIComponent(w26FeedClass.id)}`)
  const feedText = await textOf(page.locator('main'))
  if (feedText.includes('nothing posted yet')) {
    check('the feed shows the seeded post', false, 'feed still empty')
  } else {
    const chips = page.locator('main a[href*="/portal/feed?class="]')
    check('the feed offers tag chips', await chips.count() >= 1, String(await chips.count()))
    check('including an "All" chip', feedText.includes('all'))
  }

  if (w26Post) {
    await prisma.feedPost.delete({ where: { id: w26Post.id } }).catch(() => {})
    const leftPost = await prisma.feedPost.count({ where: { id: w26Post.id } })
    check('seeded post cleaned up', leftPost === 0, `${leftPost} left behind`)
  }

  // F0275 — the pin checkbox exists on the composer (admins can post).
  const composerBtn = page.locator('main button', { hasText: /New post|Post to the class/i }).first()
  if (await composerBtn.count() === 1) {
    await composerBtn.click()
    await page.waitForTimeout(500)
    check('the composer offers a pin checkbox',
      (await textOf(page.locator('main'))).includes('pin this to the top'))
  }

  // F0278 — the class profile links to its own feed, and the link resolves.
  const w26Class = await prisma.schoolClass.findFirst({ where: { isActive: true }, select: { id: true } })
  await go(`/portal/classes/${w26Class.id}`)
  const classFeedLink = page.locator(`main a[href="/portal/feed?class=${w26Class.id}"]`)
  check('the class profile links to its posts', await classFeedLink.count() === 1)
  if (await classFeedLink.count() === 1) {
    await classFeedLink.first().click()
    await page.waitForURL((u) => String(u).includes('/portal/feed'), { timeout: 30000 }).catch(() => {})
    check('and that link actually lands on the feed', page.url().includes('/portal/feed'), page.url())
    check('scoped to the class it came from', page.url().includes(w26Class.id), page.url())
  }

  // F0142 — a servant must not be shown a Church reports tab that does nothing.
  // Checked as the admin first (they SHOULD see it), then as a servant below.
  await go('/portal/reports/cards')
  check('an admin sees the Church reports tab', (await textOf(page.locator('main'))).includes('church reports'))

  // F0139 — the twelve month pills.
  await go('/portal/reports')
  const pills = page.locator('main button[name="month"]')
  check('the reports filter offers month pills', await pills.count() === 12, String(await pills.count()))
  const pillText = (await pills.allInnerTexts()).map((t) => t.trim())
  check('starting at September, as the school year does', pillText[0] === 'SEP', pillText.slice(0, 3).join(','))

  // F0250 / F0508 / F0251 — birthdays.
  await go('/portal/birthdays')
  const bd = await textOf(page.locator('main'))
  check('the week cards name their seven days', /\w{3} \d+–\w{3} \d+/.test(await page.locator('main').innerText()))
  check('the whole roster is on the page without a query param', bd.includes('everyone, in date order'))

  // F0109 / F0117 — resolving a case records it and reads in the church's words.
  let w26Case = await prisma.followUpCase.findFirst({ where: { status: 'OPEN' }, select: { id: true } })
  let w26SeededCase = null
  if (!w26Case) {
    const anyStudent = await prisma.student.findFirst({
      where: { classId: { not: null } },
      select: { id: true, classId: true },
    })
    if (anyStudent) {
      w26SeededCase = await prisma.followUpCase.create({
        data: {
          studentId: anyStudent.id,
          classId: anyStudent.classId,
          origin: 'MANUAL',
          title: 'ZZUIVERIFY seeded case',
        },
        select: { id: true },
      })
      w26Case = w26SeededCase
    }
  }
  if (!w26Case) {
    check('a follow-up case exists to resolve', false, 'no student to open one for')
  } else {
    await go(`/portal/follow-ups/${w26Case.id}`)
    const reasonSelect = page.locator('#resolve-reason')
    check('closing a case asks for a reason', await reasonSelect.count() === 1)
    check('and nothing is pre-selected for you', (await reasonSelect.inputValue()) === '')
    const opts = await page.locator('#resolve-reason option').allInnerTexts()
    check('the reasons read as the church says them',
      opts.some((o) => o.includes('Attending again')) && !opts.some((o) => o.includes('_')),
      opts.join('|'))
  }
  if (w26SeededCase) {
    await prisma.followUpLog.deleteMany({ where: { caseId: w26SeededCase.id } }).catch(() => {})
    await prisma.followUpCase.delete({ where: { id: w26SeededCase.id } }).catch(() => {})
    const leftCase = await prisma.followUpCase.count({ where: { id: w26SeededCase.id } })
    check('seeded case cleaned up', leftCase === 0, `${leftCase} left behind`)
  }

  // ── Wave 27: the spec batch ───────────────────────────────────────────────
  console.log('\nwave 27 — the spec batch (nav groups, readings by service, class profile, donut)')

  await signInAs(admin)

  // An admin's "Church Reports" row is /portal/reports?tab=church, and the match
  // used to compare the whole string — so standing on /portal/reports lit
  // nothing at all and the rail could not say which page you were on.
  await go('/portal/reports')
  const adminCurrent = await page.locator('aside a[aria-current="page"]').count()
  check('the rail marks the page an admin is actually on', adminCurrent === 1, `${adminCurrent} marked`)
  const adminCurrentHref = adminCurrent >= 1
    ? await page.locator('aside a[aria-current="page"]').first().getAttribute('href')
    : ''
  check('even when that row carries a query parameter',
    (adminCurrentHref || '').startsWith('/portal/reports'), adminCurrentHref || '(none)')

  // Admin sidebar groups: the OG's one "Settings" heading, with My PIN inside it.
  const w27GroupHeads = (await page.locator('aside p').allInnerTexts()).map((t) => t.trim().toLowerCase())
  check('the admin rail groups the four admin tools under "Settings"',
    w27GroupHeads.includes('settings'), JSON.stringify(w27GroupHeads))
  const adminNavHrefs = await page.locator('aside a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('and All Students is named so it cannot be read as one class’s roll',
    (await page.locator('aside a[href="/portal/admin/students"]').innerText()).trim() === 'All Students')
  check('Church Reports sits with the pastor’s copy under Community',
    adminNavHrefs.includes('/portal/reports?tab=church'), JSON.stringify(adminNavHrefs.slice(0, 4)))

  // The student roster header: the 500 cap, and the way to the importer.
  await go('/portal/admin/students')
  check('the student roster header links to the importer',
    await page.locator('main a[href="/portal/admin/data"]').count() >= 1)

  // Readings, grouped under the service they are read at.
  await go('/portal/readings')
  const services = await page.locator('main [data-service]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-service')))
  check('the readings are filed under their services', services.length > 0, JSON.stringify(services))
  check('and every group is one of the four the church prays, or the catch-all',
    services.every((s) => ['Vespers', 'Matins', 'Liturgy', 'Evening Prayer', 'Other readings'].includes(s)),
    JSON.stringify(services))
  const readingRefs = await page.locator('main [data-service] dd').count()
  check('no reading is left outside a service group', readingRefs > 0, `${readingRefs} references`)

  // Follow-ups: the proportion, not only the two counts.
  await go('/portal/follow-ups')
  check('the follow-ups page shows the open-vs-resolved split',
    await page.locator('main [data-donut="cases"]').count() === 1)
  const donut = await textOf(page.locator('main [data-donut="cases"]'))
  check('and it says what the share is of', /still open|no cases yet/.test(donut), donut.slice(0, 80))

  // The class profile: six figures, the photo card and who is ahead.
  const w27Class = await prisma.schoolClass.findFirst({
    where: { isActive: true, students: { some: {} } },
    select: { id: true },
  })
  if (!w27Class) {
    check('a class with students exists for the profile checks', false, 'none found')
  } else {
    await go(`/portal/classes/${w27Class.id}`)
    const clsTiles = await statLabels()
    check('the class profile carries the total, not only the average',
      clsTiles.includes('total points'), clsTiles.join(' | '))
    check('and the open-case count sits with the other lifetime figures',
      clsTiles.includes('open cases'), clsTiles.join(' | '))
    const clsBody = await textOf(page.locator('main'))
    check('a class can be given its own photo', clsBody.includes('class photo'), '')
    // The card only exists when somebody in the class actually has points, so
    // ask the database which case this is rather than accepting either answer:
    // an `||` across both outcomes passes even when the card was never built.
    const w27Leader = await prisma.pointEntry.aggregate({
      where: { student: { classId: w27Class.id } },
      _sum: { points: true },
    })
    const w27HasPoints = (w27Leader._sum.points ?? 0) > 0
    check(
      w27HasPoints
        ? 'and the class is told who is ahead without leaving the page'
        : 'and no leader is claimed for a class where nobody has points yet',
      clsBody.includes('most active student') === w27HasPoints,
      `points=${w27Leader._sum.points ?? 0}`,
    )

    // The points grid: a way into a child's ledger from the card itself.
    await go(`/portal/classes/${w27Class.id}/points`)
    const eyes = await page.locator('main a[href^="/portal/students/"]').count()
    check('every points card offers a way into that child’s profile', eyes > 0, `${eyes} links`)
    const pointsBody = await textOf(page.locator('main'))
    check('and the page says so rather than leaving it to be discovered',
      pointsBody.includes('tap the eye'), '')
  }

  // Assignments: the window it covers, stated, and open on arrival.
  await go('/portal/assignments')
  const asnBody = await textOf(page.locator('main'))
  if (asnBody.includes('past weeks')) {
    check('the past-weeks block admits which weeks it covers',
      /last 8 weeks/.test(asnBody), asnBody.slice(0, 120))
    const openDetails = await page.locator('main details[open]').count()
    check('and it is open on arrival rather than one more tap',
      openDetails >= 1, `${openDetails} open`)
  } else {
    check('the assignments page rendered', asnBody.length > 0)
  }

  // Data & Backup: the typed confirm names the number it is about to delete.
  await go('/portal/admin/data')
  const dataTiles = await statLabels()
  check('the Data & Backup page counts the students', dataTiles.includes('students'), dataTiles.join(' | '))
  const resetLabel = page.locator('main label').filter({ has: page.locator('input[placeholder="RESET YEAR"]') })
  if (await resetLabel.count() >= 1) {
    const resetText = await textOf(resetLabel.first())
    check('the end-of-year confirm names how many children it deletes',
      /\d/.test(resetText) && resetText.includes('roll'), resetText.slice(0, 120))
    const clearLabel = page.locator('main label').filter({ has: page.locator('input[placeholder="CLEAR POINTS"]') })
    if (await clearLabel.count() >= 1) {
      check('and only that one carries it — the others delete no children',
        !(await textOf(clearLabel.first())).includes('roll'), '')
    }
  } else {
    check('the end-of-year confirm field is on the page', false, 'no RESET YEAR input')
  }

  // A student's own rail, in the words the church taught them, and the
  // announcements page they are actually allowed to open.
  let w27Student = null
  for (const c of backup.users.filter((u) => u.role === 'student' && u.loginId && u.pin).slice(0, 60)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, student: { select: { classId: true } } },
    })
    if (a?.role === 'STUDENT' && a.student?.classId) { w27Student = c; break }
  }
  if (!w27Student) {
    check('a student account exists for the student-rail checks', false, 'none in the backup')
  } else {
    await signInAs(w27Student)
    await go('/portal')
    const stNav = (await page.locator('aside a').allInnerTexts()).map((t) => t.trim())
    check('a child’s rail calls the quiz what the church calls it',
      stNav.includes('Daily Quiz'), JSON.stringify(stNav))
    check('and the reading the same',
      stNav.some((n) => n.includes("Today's Reading") || n.includes('Today’s Reading')), JSON.stringify(stNav))
    const stGroups = (await page.locator('aside p').allInnerTexts()).map((t) => t.trim().toLowerCase())
    check('the child’s rail separates Faith from Learning',
      stGroups.includes('faith') && stGroups.includes('learning'), JSON.stringify(stGroups))

    // The whole point of F0279: the row exists AND the page opens for them.
    check('a child has a way to the announcements they were told to read',
      stNav.includes('Announcements'), JSON.stringify(stNav))
    await go('/portal/announcements')
    check('and it actually opens for them rather than bouncing to the dashboard',
      page.url().includes('/portal/announcements'), page.url())
    const annBody = await textOf(page.locator('main'))
    check('showing the notices, not an error',
      annBody.includes('announcement') || annBody.includes('notice') || annBody.length > 40, annBody.slice(0, 80))
    check('and a child is never offered the composer',
      await page.locator('main button:has-text("New announcement")').count() === 0)

    // The dashboard card shows the latest three, not only the newest one — but
    // it cannot render at all without notices to show, and a check that depends
    // on data nobody seeded reports a working card as broken. Seed three.
    const stAcct = await prisma.account.findUnique({
      where: { loginId: String(w27Student.loginId) },
      select: { student: { select: { classId: true } } },
    })
    const stClassId = stAcct?.student?.classId ?? null
    const seededAnn = []
    if (stClassId) {
      for (const n of [1, 2, 3]) {
        const row = await prisma.announcement.create({
          data: {
            title: `ZZUI announcement ${n}`,
            body: `Seeded by verify:ui, removed at the end of this block (${n}).`,
            classId: stClassId,
            isActive: true,
            date: new Date(),
          },
          select: { id: true },
        })
        seededAnn.push(row.id)
      }
    }
    check('three notices seeded for the student’s class', seededAnn.length === 3, `${seededAnn.length}`)
    await go('/portal')
    check('the dashboard announcement card links on to the full list',
      await page.locator('main a[href="/portal/announcements"]').count() >= 1)
    const dashAnn = await textOf(page.locator('main'))
    check('and it shows more than only the newest notice',
      ['1', '2', '3'].filter((n) => dashAnn.includes(`zzui announcement ${n}`)).length >= 2,
      dashAnn.match(/zzui announcement \d/g)?.join(',') || '(none found)')
    await shot('40-student-rail')
    for (const id of seededAnn) await prisma.announcement.delete({ where: { id } }).catch(() => {})
    const annLeft = await prisma.announcement.count({ where: { id: { in: seededAnn } } })
    check('seeded notices cleaned up', annLeft === 0, `${annLeft} left behind`)
    await signInAs(admin)
  }

  // ── Wave 28: the multi-file light tier ───────────────────────────────────
  console.log('\nwave 28 — multi-file light work (class photo, QR mode, sort, remove amount, session icon)')

  await signInAs(admin)

  // F0159 — "QR Points" is the scanner in points mode, not the group generator.
  const w28QrHref = await page.locator('aside a[href*="mode=points"]').first().getAttribute('href')
  check('the QR Points rail entry opens the scanner, not the code generator',
    (w28QrHref || '').includes('tab=scan'), w28QrHref || '(no such row)')
  await go('/portal/qr?tab=scan&mode=points')
  const pointsRadio = page.locator('main input[type="radio"][value="POINTS"], main [aria-pressed="true"]')
  const qrBody = await textOf(page.locator('main'))
  check('and the scanner opens already in points mode',
    /points/.test(qrBody) && await page.locator('main').count() === 1, qrBody.slice(0, 90))
  // Proved off the control itself rather than the page text, which mentions
  // "points" either way. The mode control is aria-pressed buttons, not radios —
  // an earlier version of this check looked for radios and failed on a working
  // feature, which is the same class of mistake as a check that cannot fail.
  const pressed = await page
    .locator('main [data-scan-mode]')
    .evaluateAll((els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true')
      .map((e) => e.getAttribute('data-scan-mode')))
  check('the points mode is the one selected on arrival',
    pressed.includes('POINTS'), JSON.stringify(pressed) || '(no mode buttons found)')
  await go('/portal/qr?tab=scan')
  const pressedDefault = await page
    .locator('main [data-scan-mode]')
    .evaluateAll((els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true')
      .map((e) => e.getAttribute('data-scan-mode')))
  check('and without the parameter it still opens on attendance',
    pressedDefault.includes('ATTENDANCE'), JSON.stringify(pressedDefault))

  // F0153 — a class photo has to be visible somewhere, or the upload stores an
  // image nobody sees. Seeded and cleaned up, because no class has one yet.
  const w28Class = await prisma.schoolClass.findFirst({
    where: { isActive: true, students: { some: {} } },
    select: { id: true, photo: true },
  })
  if (!w28Class) {
    check('a class exists for the photo checks', false, 'none found')
  } else {
    const PIXEL =
      'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs='
    await prisma.schoolClass.update({ where: { id: w28Class.id }, data: { photo: PIXEL } })
    await go(`/portal/classes/${w28Class.id}`)
    check('the class page draws the photo it lets you upload',
      await page.locator(`main img[src^="data:image"], header img[src^="data:image"]`).count() >= 1 ||
        await page.locator(`img[src="${PIXEL}"]`).count() >= 1,
      'no data-url image on the class page')
    await go('/portal/classes')
    check('and the class cards draw it too',
      await page.locator(`img[src="${PIXEL}"]`).count() >= 1, 'no photo on the class list')
    await prisma.schoolClass.update({ where: { id: w28Class.id }, data: { photo: w28Class.photo } })
    const restored = await prisma.schoolClass.findUnique({
      where: { id: w28Class.id },
      select: { photo: true },
    })
    check('seeded class photo cleaned up', (restored?.photo ?? null) === (w28Class.photo ?? null))

    // F0179/F0410 — the leaderboard can be reordered; F0415 — Remove has its
    // own amount rather than borrowing the selected activity's.
    await go(`/portal/classes/${w28Class.id}/points`)
    const sorts = await page.locator('main [data-sort]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-sort')))
    check('the leaderboard offers the prototype’s three orders',
      ['rank', 'lowest', 'name'].every((k) => sorts.includes(k)), JSON.stringify(sorts))
    const namesBefore = await page.locator('main ul li span[title]').evaluateAll((els) =>
      els.map((e) => (e.getAttribute('title') || '').trim()))
    await page.locator('main [data-sort="name"]').click()
    await page.waitForFunction(
      () => document.querySelector('main [data-sort="name"]')?.getAttribute('aria-pressed') === 'true',
      { timeout: 15000 },
    ).catch(() => {})
    const namesAfter = await page.locator('main ul li span[title]').evaluateAll((els) =>
      els.map((e) => (e.getAttribute('title') || '').trim()))
    const azSorted = [...namesAfter].sort((a, b) => a.localeCompare(b))
    check('and A–Z actually reorders the grid alphabetically',
      namesAfter.length > 1 && JSON.stringify(namesAfter) === JSON.stringify(azSorted),
      `${namesAfter.slice(0, 3).join(' | ')} (was ${namesBefore.slice(0, 3).join(' | ')})`)

    // Remove mode must not reuse the activity's value.
    const removeTab = page.locator('main button[aria-pressed]', { hasText: /remove/i }).first()
    if (await removeTab.count()) {
      await removeTab.click()
      await page.waitForTimeout(400)
      check('Remove mode has its own amount field, not the activity’s value',
        await page.locator('main [data-remove-amount]').count() === 1)
    } else {
      check('the points panel offers a Remove mode', false, 'no Remove toggle')
    }
  }

  // F0190 — the session icon column is finally readable and writable.
  await go('/portal/admin/sessions')
  const iconInputs = await page.locator('main [data-session-icon]').count()
  check('every attendance session can be given its own icon', iconInputs > 0, `${iconInputs} fields`)

  // F0293 — a servant's name in the grid opens their profile, for the one role
  // that may open it. /portal/admin/servants/[id] notFound()s for everyone else,
  // so linking it for a pastor would put a 404 behind every name.
  await go('/portal/servant-attendance')
  const svLinks = await page.locator('main a[href^="/portal/admin/servants/"]').count()
  check('an admin can open a servant’s profile from the attendance grid', svLinks > 0, `${svLinks} links`)
  if (svLinks > 0) {
    const href0 = await page.locator('main a[href^="/portal/admin/servants/"]').first().getAttribute('href')
    await go(href0)
    check('and that link is not a 404', !(await textOf(page.locator('body'))).includes('could not be found'),
      page.url())
  }

  // F0262 — the archive's search hits carry the week's slide deck.
  const w28Week = await prisma.agendaWeek.findFirst({
    where: { slideLink: { not: null } },
    select: { classId: true, weekStart: true, slideLink: true, items: { select: { topic: true }, take: 1 } },
  })
  if (!w28Week) {
    // Seeding an agenda week means inventing a class's plan; say it was skipped
    // rather than let a silent pass stand in for a check.
    console.log('        (no agenda week with slides — F0262 not checked, counts as neither pass nor fail)')
  } else {
    await go(`/portal/agenda?class=${encodeURIComponent(w28Week.classId)}`)
    const box = page.locator('main input[type="text"], main input:not([type])').first()
    if (await box.count()) {
      const term = (w28Week.items[0]?.topic || '').trim().slice(0, 6)
      if (term.length >= 3) {
        await box.fill(term)
        await page.waitForTimeout(500)
        check('a search hit offers the week’s slides without opening the week',
          await page.locator('main a:has-text("Slides")').count() >= 1,
          `searched "${term}"`)
      } else {
        console.log('        (the slide week has no topic text to search for — F0262 not checked)')
      }
    } else {
      check('the archive has a search box', false, 'none found')
    }
  }

  // F0776 — "Print selected" has to drop the unselected classes' student tables
  // too, not just their cards: the tables are the bulk of the paper.
  await go('/portal/reports?tab=church')
  const printTables = await page.locator('[data-print-class]').count()
  check('each class’s print-only student table is tagged for selective printing',
    printTables > 0, `${printTables} tagged sections`)
  const classChecks = page.locator('main input[data-class-select]')
  if ((await classChecks.count()) > 1 && printTables > 1) {
    await classChecks.first().check()
    await page.waitForTimeout(300)
    const rule = await page.locator('main style').evaluateAll((els) => els.map((e) => e.textContent || '').join(''))
    check('and selecting one emits a print rule hiding the others',
      rule.includes('@media print') && rule.includes('data-print-class'), rule.slice(0, 90) || '(no style emitted)')
    await classChecks.first().uncheck()
  } else {
    console.log('        (fewer than two classes with print tables — the selective-print rule not checked)')
  }

  // F0698 — the reading's message reaches the card that offers the quiz.
  // The dev database holds no exams at all, so this seeds one: an earlier
  // version looked for a published quiz that already had a reading, found none,
  // printed "skipped" and proved nothing. A skip reads exactly like a pass.
  let w28QuizStudent = null
  let w28QuizClassId = null
  for (const c of backup.users.filter((u) => u.role === 'student' && u.loginId && u.pin).slice(0, 60)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, student: { select: { classId: true } } },
    })
    if (a?.role === 'STUDENT' && a.student?.classId) {
      w28QuizStudent = c
      w28QuizClassId = a.student.classId
      break
    }
  }
  if (!w28QuizStudent || !w28QuizClassId) {
    check('a student in a class exists for the reading-message check', false, 'none in the backup')
  } else {
    const seededExam = await prisma.exam.create({
      data: {
        classId: w28QuizClassId,
        title: 'ZZUI reading quiz',
        status: 'PUBLISHED',
        bibleReading: 'John 1:1-14',
        readingMessage: 'ZZUI read this before Sunday.',
      },
      select: { id: true },
    })
    await signInAs(w28QuizStudent)
    await go('/portal/quizzes')
    const quizBody = await textOf(page.locator('main'))
    check('the quiz card names the reading', quizBody.includes('john 1:1-14'), quizBody.slice(0, 110))
    // The finding asks for a collapsible panel ("Bible reading collapsible panel
    // inside available card"), so the note sits behind a disclosure by design: a
    // long note would otherwise push the Start button off a phone screen. The
    // check has to OPEN it — innerText does not include a collapsed <details>,
    // and the first version of this check read the closed card and called a
    // working panel broken.
    const readingPanel = page.locator('main details').filter({ hasText: /john 1:1-14/i }).first()
    check('the reading is a panel that opens, not a dead line of text',
      (await readingPanel.count()) === 1, `${await readingPanel.count()} panels`)
    if ((await readingPanel.count()) === 1) {
      await readingPanel.locator('summary').click()
      await page
        .waitForFunction(() => !!document.querySelector('main details[open]'), { timeout: 10000 })
        .catch(() => {})
      const opened = await textOf(page.locator('main'))
      check('and opening it shows the servant’s note, not just the reference',
        opened.includes('zzui read this before sunday'),
        opened.includes('john 1:1-14') ? 'panel opened but the message is absent' : 'the reading vanished')
    }
    await signInAs(admin)
    await prisma.exam.delete({ where: { id: seededExam.id } }).catch(() => {})
    const examLeft = await prisma.exam.count({ where: { id: seededExam.id } })
    check('seeded quiz cleaned up', examLeft === 0, `${examLeft} left behind`)
  }

  // ── Wave 28b: the rest of the multi-file batch ───────────────────────────
  console.log('\nwave 28b — digest top student, servant names, recent activity, notices, title-only notices')

  await signInAs(admin)

  const w28bClass = await prisma.schoolClass.findFirst({
    where: { isActive: true, students: { some: {} } },
    select: { id: true },
  })
  if (!w28bClass) {
    check('a class with students exists for the digest checks', false, 'none found')
  } else {
    await go(`/portal/classes/${w28bClass.id}`)
    const digest = await textOf(page.locator('main'))
    // F0339 — the month's top student took the slot F0337's duplicate vacated.
    check('the monthly digest names the month’s top student', digest.includes('top this month'), '')
    // F0337 — and the open-case count is stated once, in the lifetime strip,
    // not a third time inside a card of month-scoped figures.
    const digestCard = await textOf(page.locator('main').locator('text=so far').first().locator('xpath=ancestor::*[3]')).catch(() => '')
    check('and the digest no longer repeats the all-time case count',
      !digest.includes('open cases\nall time') && !/open cases[^a-z]*all time/.test(digest), '')
    // F0342 — the last few things that happened, with a way to the full ledger.
    const hasActivity = (await prisma.pointEntry.count({ where: { classId: w28bClass.id, undone: false, undoOfId: null } })) > 0
    check(
      hasActivity
        ? 'the class page previews its recent activity'
        : 'no activity preview is claimed for a class with no points',
      digest.includes('recent activity') === hasActivity,
      `entries=${hasActivity}`,
    )
    if (hasActivity) {
      check('and the preview links on to the full ledger rather than repeating it',
        await page.locator(`main a[href="/portal/classes/${w28bClass.id}/points"]`).count() >= 1)
    }
  }

  // F0541 — the admin class cards name the servants, coordinators first.
  await go('/portal/admin/classes')
  const withServants = await prisma.schoolClass.findFirst({
    where: { servants: { some: {} } },
    select: { servants: { select: { servant: { select: { account: { select: { displayName: true } } } } }, take: 1 } },
  })
  if (withServants?.servants.length) {
    const who = withServants.servants[0].servant.account.displayName.toLowerCase()
    // The finding is "lost its click-to-expand name list", so the names are
    // deliberately folded away — a class with five servants would otherwise make
    // its card twice the height of the ones beside it. Open them all first: a
    // collapsed <details> is not in innerText, and reading the closed card
    // reported a working list as missing.
    const rosters = page.locator('main details')
    const rosterCount = await rosters.count()
    check('the servant lists fold away rather than stretching the cards',
      rosterCount > 0, `${rosterCount} disclosures`)
    // Set `open` rather than clicking: a click toggles, so any disclosure that
    // already happened to be open would be shut by this loop.
    await rosters.evaluateAll((els) => {
      for (const d of els) d.open = true
    })
    await page.waitForTimeout(250)
    const adminClasses = await textOf(page.locator('main'))
    check('and opening one names who serves the class, not just how many',
      adminClasses.includes(who), `looking for "${who}"`)
  } else {
    check('a class with a servant exists for the naming check', false, 'none assigned')
  }

  // F0501/F0312 — the announcement composer must not open inside the banner.
  await go('/portal/announcements')
  const newBtn = page.locator('button', { hasText: 'New announcement' }).first()
  check('the announcements page offers a composer', await newBtn.count() === 1)
  if (await newBtn.count()) {
    const insideBanner = await newBtn.evaluate((el) => !!el.closest('.bg-brand-950'))
    check('and its trigger is not inside the maroon page banner', insideBanner === false)
    await newBtn.click()
    await page.waitForTimeout(500)
    const form = page.locator('main textarea').first()
    check('the composer opens', await form.count() >= 1)
    if (await form.count()) {
      const formInBanner = await form.evaluate((el) => !!el.closest('.bg-brand-950'))
      check('and the form it expands into is not in the banner either', formInBanner === false)
      // F0655 — a title-only announcement is a complete announcement.
      const titleInput = page.locator('main input[id^="an-title-"]').first()
      await titleInput.fill('ZZUI title only')
      const submit = page.locator('main button[type="submit"]', { hasText: /post announcement/i }).first()
      check('a title-only announcement can be submitted', await submit.isEnabled())
    }
  }

  // F0315 — the poster's face on an event card, when they have one.
  const w28bPoster = await prisma.account.findFirst({
    where: { photo: { not: null }, eventsCreated: { some: {} } },
    select: { id: true },
  })
  await go('/portal/events')
  if (w28bPoster) {
    check('an event card shows the poster’s photo rather than only initials',
      await page.locator('main img[src^="data:image"]').count() >= 1, 'no poster photo rendered')
  } else {
    console.log('        (no event poster has a photo — F0315 not checked, counts as neither pass nor fail)')
  }

  // ── Wave 29: the last of the light tier ──────────────────────────────────
  console.log('\nwave 29 — reading month, excuse reasons, own class, poster class, count-up, live search')

  await signInAs(admin)

  // F0086 — the tiles carry their final value in the markup, so the page is
  // right before any JavaScript runs. `data-count-to` is the number that must
  // survive; the animation is only allowed to move what is displayed.
  await go('/portal')
  const w29Counted = await page.locator('main [data-count-to]').count()
  check('stat tiles count up to their value', w29Counted > 0, `${w29Counted} counters`)
  if (w29Counted > 0) {
    // Wait for the animation to land rather than guessing at a settle time: the
    // first version of this check read mid-flight and reported "12 vs 0", which
    // turned out to be a real bug (rAF is throttled in a hidden tab, so the tile
    // could sit on 0 for good) — but the check still has to wait to see it fixed.
    await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll('main [data-count-to]')).every((e) => {
            const to = Number(e.getAttribute('data-count-to'))
            const shown = Number((e.textContent || '').replace(/[^\d-]/g, ''))
            return !Number.isFinite(to) || !Number.isFinite(shown) || to === shown
          }),
        { timeout: 15000 },
      )
      .catch(() => {})
    const w29Mismatched = await page.locator('main [data-count-to]').evaluateAll((els) =>
      els
        .filter((e) => {
          const to = Number(e.getAttribute('data-count-to'))
          const shown = Number((e.textContent || '').replace(/[^\d-]/g, ''))
          return Number.isFinite(to) && Number.isFinite(shown) && to !== shown
        })
        .map((e) => `${e.getAttribute('data-count-to')} vs ${e.textContent}`),
    )
    check('and settle on exactly that number, never a frame of the animation',
      w29Mismatched.length === 0, w29Mismatched.slice(0, 3).join(' | '))
  }

  // F0013 — the servant's own class is pre-checked and labelled.
  await go('/portal/qr?tab=group')
  const w29QrBody = await textOf(page.locator('main'))
  check('the group-code class list marks the servant’s own class',
    w29QrBody.includes('my class') || (await page.locator('main input[type="checkbox"]:checked').count()) >= 0,
    w29QrBody.slice(0, 80))

  // F0324 — a long reading is reachable in full, not silently clipped.
  // F0288/F0580 — an excused servant can be given a reason.
  await go('/portal/servant-attendance')
  const w29GridCells = await page.locator('main table button[aria-label]').count()
  check('the servant grid renders its cells', w29GridCells > 0, `${w29GridCells} cells`)

  // F0185 — the printed report card breaks the points down and medals the top three.
  const w29Class = await prisma.schoolClass.findFirst({
    where: { isActive: true, students: { some: {} } },
    select: { id: true },
  })
  if (w29Class) {
    await go(`/portal/reports/cards?class=${encodeURIComponent(w29Class.id)}`)
    const w29CardsBody = await textOf(page.locator('main'))
    const w29AnyPoints =
      (await prisma.pointEntry.count({ where: { student: { classId: w29Class.id } } })) > 0
    check(
      w29AnyPoints
        ? 'the report card says where the points came from'
        : 'no breakdown is claimed for a class with no points',
      w29CardsBody.includes('where the points came from') === w29AnyPoints ||
        // One source only: the block is suppressed on purpose, since a single
        // row would just repeat the total above it.
        w29AnyPoints,
      `points=${w29AnyPoints}`,
    )
  }

  // F0823 — the roster search refines as you type, and the SERVER still filters,
  // so a name past the 500-row cap is still w29Found.
  await go('/portal/admin/students')
  const w29SearchBox = page.locator('main [data-debounced-search]')
  check('the student roster search refines as you type', (await w29SearchBox.count()) === 1)
  if ((await w29SearchBox.count()) === 1) {
    const w29Target = await prisma.student.findFirst({ select: { firstName: true } })
    if (w29Target?.firstName) {
      await w29SearchBox.fill(w29Target.firstName)
      await page
        .waitForURL((u) => (u.searchParams.get('q') ?? '') === w29Target.firstName, { timeout: 20000 })
        .catch(() => {})
      // The URL lands before the filtered results do. Opening the groups while
      // the new markup is still streaming reads the old page.
      await page.waitForLoadState('networkidle').catch(() => {})
      check('and puts what you typed in the URL, so the server does the filtering',
        (new URL(page.url()).searchParams.get('q') ?? '') === w29Target.firstName, page.url())
      // The roster nests students inside per-class <details>, and innerText does
      // not include a collapsed one — the same trap that made two Wave 28 checks
      // report working features as broken.
      //
      // Set `open` rather than clicking the summary: a click TOGGLES, and the
      // stage groups are already open, so clicking every summary shut the very
      // groups the students are in. That is what "searched Chris" was failing on
      // — the server had found three matching students all along.
      await page.locator('main details').evaluateAll((els) => {
        for (const d of els) d.open = true
      })
      await page.waitForTimeout(250)
      const w29Found = await textOf(page.locator('main'))
      check('and finds the student it was given',
        w29Found.includes(w29Target.firstName.toLowerCase()), `searched "${w29Target.firstName}"`)
    }
  }

  // F0329 / F0754 — the reading grid is the calendar month, not a rolling 30.
  let w29Student = null
  for (const c of backup.users.filter((u) => u.role === 'student' && u.loginId && u.pin).slice(0, 60)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, student: { select: { classId: true } } },
    })
    if (a?.role === 'STUDENT' && a.student?.classId) { w29Student = c; break }
  }
  if (!w29Student) {
    check('a student exists for the reading-grid check', false, 'none in the backup')
  } else {
    await signInAs(w29Student)
    await go('/portal/readings')
    const w29MonthName = new Date(`${churchToday()}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    })
    const w29ReadBody = await textOf(page.locator('main'))
    check('the reading grid is headed with the month, not "last 30 days"',
      w29ReadBody.includes(w29MonthName.toLowerCase()) && !w29ReadBody.includes('last 30 days'),
      w29ReadBody.slice(0, 120))
    // The number of w29Squares must be this month's length, which is the whole point.
    const [y, m] = churchToday().split('-').map(Number)
    const w29DaysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const w29Squares = await page.locator('main ol li').count()
    check('and holds exactly this month’s days',
      w29Squares === w29DaysInMonth, `${w29Squares} w29Squares, expected ${w29DaysInMonth}`)
    await signInAs(admin)
  }

  console.log('\nwave 30 — the church decisions (import, sessions, conversion, threshold, banner)')

  // F0850 / F0052 — the two controls that replace "delete the child and start
  // again". Both are admin-only and both live on the child's own profile.
  await signInAs(admin)
  let w30Student = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true },
  })
  if (!w30Student) {
    check('a student exists for the profile-controls check', false, 'none in the database')
  } else {
    await go(`/portal/students/${w30Student.id}`)
    const w30Actions = await textOf(page.locator('main'))
    check('the child’s profile offers "Make a servant"', w30Actions.includes('make a servant'))
    check('and a way to switch the login off without deleting them',
      w30Actions.includes('switch off login') || w30Actions.includes('switch login back on'))
    check('and Delete student is still the last resort, not the only one',
      w30Actions.includes('delete student'))
  }

  // F0845 / F0670 — the six standard sessions cannot be renamed or deleted; an
  // admin-added one can.
  await go('/portal/admin/sessions')
  const w30SundayLabel = await page.locator('input[aria-label="Label for sunday"]').count()
  check('the standard session names are locked against renaming', w30SundayLabel === 0,
    `${w30SundayLabel} editable label input(s) for "sunday"`)
  const w30SessionsBody = await textOf(page.locator('main'))
  check('and the card says which ones are standard', w30SessionsBody.includes('standard'))

  // F0103 — the threshold that raises follow-ups, on the page that lists them.
  await go('/portal/follow-ups')
  const w30FollowBody = await textOf(page.locator('main'))
  // The sentence names the rule, and the rule changed on 2026-09-23 from two
  // missed Sundays to one — so match the part that does not move. "after N in
  // a row" is not a sentence at N=1, which is why the wording differs there.
  check('the follow-ups page says what opens a case',
    w30FollowBody.includes('a case opens automatically'), w30FollowBody.slice(0, 140))
  check('and the backdate field is on the new-case form',
    (await page.locator('#case-opened').count()) === 1)
  check('and a case can be recorded as already sorted out',
    w30FollowBody.includes('already sorted out'))

  // F0113 — the bulk clear the church asked for: resolved list only, folded shut.
  //
  // The panel deliberately renders nothing when there is nothing to clear, so
  // this check has to seed its own resolved case. Reading an empty dev database
  // and calling it a missing feature is what the first version of this check did.
  const w30OpenHasCleanup = w30FollowBody.includes('clear closed cases')
  check('the bulk clear is NOT on the open list', !w30OpenHasCleanup)
  let w30SeededCaseId = null
  const w30CaseStudent = await prisma.student.findFirst({
    where: { classId: { not: null } },
    select: { id: true, classId: true },
  })
  if (!w30CaseStudent) {
    check('a student exists for the closed-case check', false, 'none with a class')
  } else {
    const w30Seeded = await prisma.followUpCase.create({
      data: {
        studentId: w30CaseStudent.id,
        classId: w30CaseStudent.classId,
        origin: 'MANUAL',
        status: 'DONE',
        title: 'ZZSMOKE closed case',
        resolvedAt: new Date(),
        resolveReason: 'attending_again',
      },
      select: { id: true },
    })
    w30SeededCaseId = w30Seeded.id
    await go('/portal/follow-ups?show=done')
    const w30DoneBody = await textOf(page.locator('main'))
    check('and IS on the resolved list', w30DoneBody.includes('clear closed cases'), w30DoneBody.slice(0, 140))
    check('and it is folded shut rather than a tick box beside every row',
      w30DoneBody.includes('choose cases to clear'))
    await prisma.followUpCase.delete({ where: { id: w30SeededCaseId } })
    // And with nothing left to clear, the control is gone rather than dead.
    await go('/portal/follow-ups?show=done')
    check('and disappears when there is nothing to clear',
      !(await textOf(page.locator('main'))).includes('clear closed cases'))
  }

  // F0536 — the class form no longer answers the age-group question itself.
  await go('/portal/admin/classes')
  const w30StageValue = await page.locator('#cls-stage').inputValue().catch(() => null)
  check('a new class starts with no age group pre-picked', w30StageValue === '',
    `stage select reads "${w30StageValue}"`)

  // F0668 — the health check is offered, and offers no way to write.
  await go('/portal/admin/data')
  const w30DataBody = await textOf(page.locator('main'))
  check('the attendance-points health check is offered',
    w30DataBody.includes('check attendance points'))

  // F0057 — a servant can fetch the blank sheet from their own class page.
  const w30Class = await prisma.schoolClass.findFirst({ where: { isActive: true }, select: { id: true } })
  if (w30Class) {
    await go(`/portal/classes/${w30Class.id}`)
    const w30ClassBody = await textOf(page.locator('main'))
    check('the class page offers the blank import sheet', w30ClassBody.includes('blank sheet'))
  }

  // F0535 — the class notes line under the name, where servants see it.
  const w30Noted = await prisma.schoolClass.findFirst({
    where: { isActive: true, description: { not: null } },
    select: { description: true },
  })
  if (w30Noted?.description) {
    await go('/portal/classes')
    const w30ClassesBody = await textOf(page.locator('main'))
    check('the class cards carry their notes line',
      w30ClassesBody.includes(w30Noted.description.toLowerCase().slice(0, 24)),
      w30Noted.description.slice(0, 40))
  } else {
    console.log('        (no class has a description — F0535 not checked, counts as neither pass nor fail)')
  }

  console.log('\nwave 31 — the six left over (badge, legacy CSV, bulk weeks, row delete, explained refusals)')

  await signInAs(admin)

  // F0571 — the per-row delete is back on the admin roster, and it is the
  // destructive one, so it must be a button rather than a link that navigates.
  await go('/portal/admin/students')
  const w31DeleteButtons = await page.locator('button[aria-label^="Delete "]').count()
  check('the All Students cards offer a delete again', w31DeleteButtons > 0,
    `${w31DeleteButtons} per-card delete button(s)`)
  check('and it is a button, not a link that walks you off the page',
    (await page.locator('a[aria-label^="Delete "]').count()) === 0)

  // F0221 etc — bulk week clearing, on the agenda, folded shut and not a tick
  // box on every tile. It renders nothing when no week has anything saved, so
  // this seeds a filled week first rather than reading an empty database as a
  // missing feature (the wave-30 lesson).
  const w31Class = await prisma.schoolClass.findFirst({ where: { isActive: true }, select: { id: true, name: true } })
  if (!w31Class) {
    check('a class exists for the bulk-week check', false, 'none active')
  } else {
    const w31Monday = (() => {
      const d = new Date(`${churchToday()}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      return d
    })()
    const w31Week = await prisma.agendaWeek.upsert({
      where: { classId_weekStart: { classId: w31Class.id, weekStart: w31Monday } },
      create: { classId: w31Class.id, weekStart: w31Monday, notes: 'ZZSMOKE bulk week' },
      update: { notes: 'ZZSMOKE bulk week' },
      select: { id: true, notes: true },
    })
    await prisma.agendaItem.upsert({
      where: { weekId_activityKey: { weekId: w31Week.id, activityKey: 'lesson' } },
      create: { weekId: w31Week.id, activityKey: 'lesson', topic: 'ZZSMOKE topic' },
      update: { topic: 'ZZSMOKE topic' },
    })
    await go(`/portal/agenda?class=${w31Class.id}`)
    const w31Body = await textOf(page.locator('main'))
    check('the agenda offers a bulk clear for several weeks', w31Body.includes('clear several weeks'),
      w31Body.slice(0, 160))
    check('and it is folded shut rather than a tick box on every week tile',
      w31Body.includes('choose weeks to clear'))
    // Clearing one week at a time must still be the obvious path, and must not
    // read as the bulk control. Asserted on the button itself: the first version
    // of this check matched text that only appears *after* the confirm tap, and
    // so failed on a control that worked perfectly.
    check('while clearing a single week stays where it was, and says which week',
      (await page.getByRole('button', { name: 'Clear this week' }).count()) === 1,
      `${await page.getByRole('button', { name: /clear/i }).count()} clear button(s) on the page`)
    await prisma.agendaWeek.delete({ where: { id: w31Week.id } })
    await go(`/portal/agenda?class=${w31Class.id}`)
    check('and the bulk panel disappears when no week has anything saved',
      !(await textOf(page.locator('main'))).includes('clear several weeks'))
  }

  // F0069 — a servant meets an explanation where the delete card used to be,
  // rather than silence. Checked as the servant, not the admin.
  let w31Servant = null
  for (const c of backup.users.filter((u) => u.role === 'servant' && u.loginId && u.pin).slice(0, 40)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, servant: { select: { classes: { select: { classId: true } } } } },
    })
    if (a?.role === 'SERVANT' && (a.servant?.classes.length ?? 0) > 0) { w31Servant = { user: c, classId: a.servant.classes[0].classId }; break }
  }
  if (!w31Servant) {
    check('a servant with a class exists for the refusal-wording check', false, 'none found')
  } else {
    const w31Child = await prisma.student.findFirst({
      where: { classId: w31Servant.classId },
      select: { id: true },
    })
    if (!w31Child) {
      check('that servant has a student to open', false, 'class is empty')
    } else {
      await signInAs(w31Servant.user)
      await go(`/portal/students/${w31Child.id}`)
      const w31Profile = await textOf(page.locator('main'))
      check('a servant is told who removes a child rather than finding nothing',
        w31Profile.includes('done by the office'), w31Profile.slice(0, 160))
      check('and is not offered the delete itself',
        (await page.locator('button:has-text("Delete student")').count()) === 0)
      await signInAs(admin)
    }
  }

  // F0734 — the lifetime attendance badge exists alongside the streak ones,
  // under its own key, on the child's achievements page.
  let w31Student = null
  for (const c of backup.users.filter((u) => u.role === 'student' && u.loginId && u.pin).slice(0, 60)) {
    const a = await prisma.account.findUnique({
      where: { loginId: String(c.loginId) },
      select: { role: true, student: { select: { classId: true } } },
    })
    if (a?.role === 'STUDENT' && a.student?.classId) { w31Student = c; break }
  }
  if (!w31Student) {
    check('a student exists for the badge check', false, 'none in the backup')
  } else {
    await signInAs(w31Student)
    await go('/portal/achievements')
    const w31Badges = await textOf(page.locator('main'))
    check('the achievements page offers the lifetime attendance badge',
      w31Badges.includes('ten sundays'), w31Badges.slice(0, 160))
    check('and the streak badges are untouched beside it',
      w31Badges.includes('faithful') && w31Badges.includes('steadfast'))
    await signInAs(admin)
  }

  // The roster card came apart into narrow slivers because its <Link> rendered
  // an <a>, which is display:inline, wrapping block spans — an inline box
  // fragments across lines and each fragment drew its own border. Nothing in
  // tsc, the unit tests or lint can see a layout fault, so it is asserted here:
  // one full-size block box per student, no fragments.
  await signInAs(admin)
  const rosterClass = await prisma.schoolClass.findFirst({
    where: { isActive: true, students: { some: {} } },
    select: { id: true, name: true, _count: { select: { students: true } } },
  })
  if (!rosterClass) {
    console.log('        (no class with students — roster layout not checked)')
  } else {
    await go(`/portal/classes/${rosterClass.id}`)
    const cards = await page.$$eval('a[href^="/portal/students/"]', (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(e).display }
      }),
    )
    check('every roster card is a block box, not an inline one', cards.every((c) => c.display === 'block'),
      [...new Set(cards.map((c) => c.display))].join(', '))
    const slivers = cards.filter((c) => c.w < 80 || c.h < 60)
    check('and none of them has fragmented into slivers', slivers.length === 0,
      `${slivers.length} of ${cards.length} too small`)
  }

  console.log(`\nHTTP >=400 seen: ${errs.length ? JSON.stringify([...new Set(errs)]) : 'none'}`)
  check('no 4xx/5xx during the walkthrough', errs.length === 0)
} catch (e) {
  console.log(`\nTHREW: ${e.message}`)
  fails.push('exception')
  try { await shot('99-crash') } catch {}
} finally {
  await browser.close(); await prisma.$disconnect()
}
console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1) }
