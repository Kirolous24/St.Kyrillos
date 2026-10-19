# Servant Assignment Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (This project: the user asked for no subagents. Execute natively.)

**Goal:** Tell a servant the moment they are given, or taken off, a part of a Sunday class, and remind them the evening before. The notice goes to the bell, to their phone, and by email when no phone has notifications on. Tapping it opens My Assignments at that Sunday.

**Architecture:**
- **Pure rules** (`lib/portal/assignment-notices.ts`): who gained or lost which *duty* between two snapshots, and the notice text.
- **One delivery service** (`lib/portal/notice-delivery.ts`): stores each notice, pushes it with `web-push`, or emails it with Resend.
- **Assignment writers** (agenda and lesson actions) snapshot duties before and after each write and hand the difference to the delivery service.
- **A daily cron route** sends tomorrow's reminders.
- **The phone side:** a service worker and manifest at the site root, scoped to `/portal`, plus a Settings card.

**Tech Stack:** Next 14 App Router (server actions, route handler), Prisma 5 + Neon (dev branch only), `web-push` (new dependency), Resend (existing), vitest, Playwright (scratchpad E2E).

**Spec:** `docs/superpowers/specs/2026-10-19-servant-assignment-notifications-design.md`

## Global Constraints

- **Sunday only.** Duties are: agenda activities (due the week's Sunday), Lead and Backup (due the week's Sunday), and lessons (due their own date). Undated lessons: an assigned notice, no reminder.
- **One notice per servant per save.** No notice to the servant who made the change; nothing for duties due before today; nothing when only a topic changes.
- **Reminders:** daily cron `0 23 * * *` (UTC), which is 6 PM CDT and 5 PM CST. Hobby runs within the hour. At most one reminder per servant per day (`dedupeKey` `reminder:{servantId}:{date}`).
- **Email** goes only when a servant has an email, `Account.noticeEmails` is true, and **zero** of their phones has notifications on. It always routes through `emailRouting()` (lib/portal/login-email.ts): live only on production; elsewhere `PORTAL_EMAIL_REDIRECT` or nothing.
- **Push** goes only to subscriptions saved by the same kind of site. `PushSubscription.live` must equal `isLiveSite(env)`. A dev copy of production never buzzes a real phone.
- **Delivery never throws into a save.** The assignment is saved even if every push and email fails.
- **Secrets:** `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY` live in `.env.local` and on Vercel only. The repo is public. Without them the phone toggle is hidden; bell and email still work.
- **Untouched:** the public website. The manifest is `/portal.webmanifest` and the worker is `/portal-sw.js`, with scope `/portal`. Both sit outside the middleware matcher (`/portal/:path*`).
- **Church time** from `CHURCH_TIMEZONE` (`churchToday`, `addDays`, `mondayOf`, `sundayOfWeek`); never a hard-coded zone.
- **Server action files** (`'use server'`) export only async functions (`tests/portal/use-server-exports.test.ts`).
- **Database:** never point a script at `ep-dark-term-ai3c2hag`. The migration is applied to the dev branch only; production gets it from `vercel-build`.
- **Copy:**
  - Assigned, one Sunday: `You're on Coptic and Memorization for Sunday, Oct 26 · 5th & 6th Boys`.
  - Assigned, several Sundays: `You have 5 new assignments, Oct 26 – Nov 23 · 5th & 6th Boys`.
  - Taken off: `You're no longer on Coptic for Sunday, Oct 26 · 5th & 6th Boys` (one Sunday), or `3 of your assignments were taken off, Oct 26 – Nov 9 · …`.
  - Reminder: title `Reminder for tomorrow`; body `Coptic (Lesson 4 letters) and Memorization · 5th & 6th Boys`.
  - Lead reads `Lead`, Backup reads `Backup`, and a lesson reads `Lesson “Title”`.

## Review Focus

1. **A whole term imported at once** (`importAgendaCsv`, many weeks and servants) must send one notice per servant, not one per week. Task 3 test: `import of 4 weeks for 3 servants sends 3 notices`.
2. **Running locally or on a preview against the dev copy** must never email or buzz a real servant. Task 2 tests: `outside production, no email to real addresses` and `a production subscription is not pushed from dev`.
3. **Re-saving a week unchanged, or editing only topics,** must send nothing. Task 1 test: `same servant on the same slot is no change`.
4. **The cron firing twice in one evening** (Vercel retries, or a manual call) must not remind twice. Task 2 test: `a duplicate dedupeKey is not stored or sent again`. Task 6 test: `the dedupe key is per servant per day`.
5. **A push service timing out or throwing** must not fail the coordinator's save. Task 2 test: `a push that throws never rejects`. Task 3 test: `saveAgendaWeek succeeds when delivery fails`.

---

### Task 1: Duty rules and notice wording (pure)

**Files:**
- Create: `lib/portal/assignment-notices.ts`
- Test: `tests/portal/assignment-notices.test.ts`

**Interfaces:**
- Produces:
  - `type DutyKind = 'activity' | 'lead' | 'backup' | 'lesson'`
  - `interface Duty { slot: string; kind: DutyKind; servantId: string; label: string; topic: string | null; className: string; due: string | null; href: string }`. The slot is stable across saves: `item:{classId}:{monday}:{activityKey}` | `lead:{classId}:{monday}` | `backup:{classId}:{monday}` | `lesson:{lessonId}`.
  - `interface DutyChange { servantId: string; added: Duty[]; removed: Duty[] }`
  - `function dutyChanges(before: readonly Duty[], after: readonly Duty[], opts: { today: string; actorServantId: string | null }): DutyChange[]`, sorted by servantId.
  - `interface NoticeText { title: string; body: string; href: string }`
  - `function assignedNotice(added: readonly Duty[]): NoticeText`
  - `function removedNotice(removed: readonly Duty[]): NoticeText`
  - `function reminderNotice(due: readonly Duty[]): NoticeText`
  - `function dutyHref(due: string | null): string`. Returns `/portal/assignments#week-{mondayOf(due)}`, or `/portal/assignments` when undated.
  - `function shouldEmail(p: { email: string | null; noticeEmails: boolean; pushDevices: number }): boolean`

- [ ] **Step 1: Write the failing tests** (`tests/portal/assignment-notices.test.ts`), with a `duty(over)` factory. Today is `2026-10-19`.
  - `a servant put on a slot gains it, and whoever held it loses it`: before Coptic=A, after Coptic=B → `[{servantId:'A', added:[], removed:[coptic]}, {servantId:'B', added:[coptic], removed:[]}]`.
  - `same servant on the same slot is no change`: the topic differs before and after → `[]`.
  - `nothing for the servant who made the change`: actor B → only A's entry.
  - `nothing for a duty due before today`: due `2026-10-18` → `[]`. Due today `2026-10-19` → included.
  - `an undated lesson is still a change`.
  - `assignedNotice for one Sunday lists every part`: Coptic + Memorization due `2026-10-25` → title `New assignments`, body `You're on Coptic and Memorization for Sunday, Oct 25 · 5th & 6th Boys`, href `/portal/assignments#week-2026-10-19`.
  - `assignedNotice for one part`: title `New assignment`, body `You're on Lead for Sunday, Oct 25 · 5th & 6th Boys`.
  - `assignedNotice across Sundays counts them`: 5 duties due Oct 25 … Nov 22 → body `You have 5 new assignments, Oct 25 – Nov 22 · 5th & 6th Boys`.
  - `three parts read as a list`: `Coptic, Memorization and Lead`.
  - `two classes are both named`: `· 5th & 6th Boys, 7th & 8th Boys`.
  - `removedNotice`:
    - one Sunday: title `Assignment changed`, body `You're no longer on Coptic for Sunday, Oct 25 · 5th & 6th Boys`;
    - several Sundays: `3 of your assignments were taken off, Oct 25 – Nov 8 · 5th & 6th Boys`.
  - `reminderNotice names topics`: title `Reminder for tomorrow`, body `Coptic (Lesson 4 letters) and Memorization · 5th & 6th Boys`.
  - `an undated lesson`: body `You're on Lesson “The Good Shepherd” · 5th & 6th Boys`, href `/portal/assignments`.
  - `shouldEmail`: true for `{email:'a@b.c', noticeEmails:true, pushDevices:0}`. False when pushDevices is 1, when email is null, or when noticeEmails is false.
- [ ] **Step 2:** Run `npx vitest run tests/portal/assignment-notices.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `lib/portal/assignment-notices.ts` with the signatures above.
  - The day label is `DAY_NAMES[weekday], formatMonthDay(date)`.
  - Lists join as `a`, `a and b`, `a, b and c`.
  - Classes are unique, in first-seen order, joined with `, `.
  - Sort duties by due (null last), then kind order activity < lead < backup < lesson.
- [ ] **Step 4:** Run the test. Expected: PASS.

### Task 2: Storage and delivery (bell rows, Web Push, email)

**Files:**
- Modify: `prisma/schema.prisma`.
  - New models `PushSubscription`, `Notice`.
  - New field `Account.noticeEmails Boolean @default(true)`.
  - Back-relations `Account.pushSubscriptions`, `Account.notices`.
- Create: `prisma/migrations/20261019200000_servant_notices/migration.sql`, generated with `migrate diff --from-url $DATABASE_URL_UNPOOLED` against the dev branch, then `migrate deploy`.
- Modify: `lib/portal/login-email.ts`. Add `export function isLiveSite(env)`; `emailRouting` uses it.
- Create: `lib/portal/web-push.ts`, `lib/portal/notice-delivery.ts`.
- Modify: `package.json`. Add `web-push` and `@types/web-push`.
- Test: `tests/portal/notice-delivery.test.ts`

**Schema:**
- `PushSubscription`:
  - `{ id cuid, accountId → Account cascade, endpoint String @unique, p256dh String, auth String, live Boolean, userAgent String?, createdAt now, lastSentAt DateTime? }`
  - `@@index([accountId])`
- `Notice`:
  - `{ id cuid, accountId → Account cascade, kind String, title String, body String, href String, dedupeKey String @unique, createdAt now }`
  - `@@index([accountId, createdAt(sort: Desc)])`
  - `kind` is `assigned | unassigned | reminder | test`.
- Read state reuses `NotificationRead` with key `notice:{id}`. That is the bell's existing mechanism, so `Notice` has no `readAt`. A builder's call, as the spec leaves the bell to us.

**Interfaces:**
- Consumes: `NoticeText`, `shouldEmail` (Task 1).
- Produces:
  - `type NoticeKind = 'assigned' | 'unassigned' | 'reminder' | 'test'`
  - `interface OutgoingNotice extends NoticeText { servantId: string; kind: NoticeKind; dedupeKey: string }`
  - `async function deliverNotices(notices: readonly OutgoingNotice[], env?: NodeJS.ProcessEnv): Promise<{ stored: number; pushed: number; emailed: number; skipped: number }>`. Never rejects.
  - `function isLiveSite(env): boolean`, in login-email.ts.
  - `function webPushPublicKey(env?): string | null` and `async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: NoticeText & { tag: string }): Promise<'sent' | 'gone' | 'failed' | 'off'>`, both in web-push.ts.
    - Uses `setVapidDetails('mailto:noreply@stkyrillostn.org', …)`.
    - Options `{ TTL: 86400, timeout: 10000 }`.
    - A 404 or 410 status → `'gone'`.

- [ ] **Step 1: Write the failing tests** (`tests/portal/notice-delivery.test.ts`). Mock `@/lib/prisma`, `@/lib/portal/web-push` (`sendPush`) and `resend`:
  - `stores the notice and pushes it to every live phone`: 2 subscriptions with `live: true`, env `VERCEL_ENV=production` → `sendPush` called twice, `stored:1, pushed:1`, no email.
  - `forgets a phone the push service says is gone`: `sendPush` → `'gone'` → `pushSubscription.delete` for it. With no other device and an email on file → emailed.
  - `emails when no phone has notifications on`: production env → Resend `emails.send` with `to` = the servant's email, subject = title, text containing body and `https://stkyrillostn.org/portal/assignments#week-…` and `/portal/settings`.
  - `outside production, no email to real addresses`: env without VERCEL_ENV and with the dev `DATABASE_URL` → no send. With `PORTAL_EMAIL_REDIRECT=x@y.z` → sent to `x@y.z`, subject prefixed `[TEST for …]`.
  - `a production subscription is not pushed from dev`: subscription `live:true`, env dev → `sendPush` not called, and it does not count as a phone (email rule applies).
  - `a duplicate dedupeKey is not stored or sent again`: `notice.create` rejects with Prisma `P2002` → no push, no email, `skipped:1`.
  - `inactive or missing accounts get nothing`.
  - `a push that throws never rejects`: `sendPush` rejects → the promise resolves with `pushed:0`. The device still counts as on (only `'gone'` removes it), so no email is sent.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Run `npm install web-push@^3.6.7` and `npm install -D @types/web-push`. Edit the schema, generate the migration SQL from the dev branch (refuse prod), `prisma migrate deploy`, `prisma generate`.
- [ ] **Step 4: Implement** `isLiveSite`, `web-push.ts` and `deliverNotices`.
  - Resolve servantId → account `{ id, isActive, email, noticeEmails, pushSubscriptions where live = isLiveSite(env) }` in one query.
  - Create each Notice. P2002 → skip.
  - `Promise.allSettled` the pushes. `'sent'` → update `lastSentAt`; `'gone'` → delete.
  - Email with `new Resend(resendApiKey(env)).emails.send` when `shouldEmail` and routing ≠ off.
  - Wrap each notice in try/catch → `console.error`.
- [ ] **Step 5:** Run it, plus `tests/portal/login-email*.test.ts`. Expected: PASS.

### Task 3: Snapshots around every assignment write

**Files:**
- Create: `lib/portal/data/duties.ts`. Interfaces:
  - `weekDuties(classId: string, mondays: readonly string[]): Promise<Duty[]>`
  - `lessonDuties(lessonIds: readonly string[]): Promise<Duty[]>`
  - `dutiesDueOn(date: string): Promise<Duty[]>`
  - `notifyDutyChanges(before: Duty[], after: Duty[], actorServantId: string | null): Promise<void>`. It uses `dutyChanges`, `assignedNotice`, `removedNotice`, `deliverNotices`. Each `dedupeKey` is `{kind}:{servantId}:{randomUUID()}`. It never rejects.
- Modify: `lib/portal/actions/agenda.ts`:
  - `saveAgendaWeek`;
  - `shareAgendaWeek` (target class);
  - `importAgendaCsv`: not in preview; one before and one after snapshot for all weeks;
  - `clearAgendaWeek`, `clearAgendaWeeks`: after = `[]`.
- Modify: `lib/portal/actions/lessons.ts`: `saveLesson` (before only when `input.id`) and `deleteLesson`.
- Test: `tests/portal/assignment-hooks.test.ts`

**Notes:**
- An agenda duty is due `sundayOfWeek(monday)`.
- Its href is `dutyHref(due)`, and its label `agendaActivityLabel(key)`, `Lead` or `Backup`.
- `dutiesDueOn(date)`:
  - agenda weeks with `weekStart = addDays(date, -6)`, only when `date` is a Sunday;
  - lessons with `date = date` and an assignee;
  - inactive accounts are filtered out later by delivery.

- [ ] **Step 1: Write the failing tests.** Mock `../data/duties` snapshot functions, `notifyDutyChanges`, prisma, session, classes, `agendaServantOptions`, audit.
  - `saveAgendaWeek snapshots the week before and after writing, and notifies the difference`: `weekDuties` is called twice with `('5th-6th-boys', ['2026-10-19'])`, once before `$transaction` and once after. `notifyDutyChanges` gets (before, after, the actor's servantId).
  - `saveAgendaWeek succeeds when delivery fails`: `notifyDutyChanges` rejects → result `ok:true`.
  - `import of 4 weeks for 3 servants sends 3 notices`: real `notifyDutyChanges` with mocked `deliverNotices`. `weekDuties` before `[]`, after 4 weeks × 3 servants → `deliverNotices` gets 3 notices.
  - `clearAgendaWeeks tells the servants of the cleared weeks`: after = `[]`.
  - `saveLesson notifies a new assignee`, `deleteLesson tells the assignee`.
  - `preview import notifies nobody`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement** `duties.ts` and the hooks: snapshot → write → snapshot → `await notifyDutyChanges(...)`, inside a try/catch that only logs.
- [ ] **Step 4:** Run it plus the full `npx vitest run`. Expected: PASS.

### Task 4: The bell, the badge and My Assignments

**Files:**
- Modify:
  - `lib/portal/notifications.ts`: `noticeNotifications(rows: Array<{ id; kind; title; body; href }>): PortalNotification[]`. Key `notice:{id}`, `detail` = body, tone `warn` for `unassigned`, else `info`.
  - `lib/portal/data/reports.ts` (`loadNotifications`): prepend notices from the last 60 days, newest first, at most 20, for non-students.
  - `lib/portal/nav.ts` (`withNavBadges`): match on the href without its `#…`.
  - `app/portal/(app)/assignments/page.tsx`:
    - wrap each upcoming and past week in `<div id={`week-${weekStart}`} className="scroll-mt-24">`;
    - if the servant has no live push subscription and no email, show a one-line note linking `/portal/settings`.
- Test: `tests/portal/notifications.test.ts` (append) and `tests/portal/nav-badges.test.ts` (append, or create if absent).

- [ ] **Step 1: Write the failing tests:**
  - `notice rows become bell items keyed notice:{id}`;
  - `a taken-off notice is a warning`;
  - `withNavBadges counts /portal/assignments#week-2026-10-19 on My Assignments`.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. PASS.

### Task 5: Phone notifications: manifest, worker, Settings

**Files:**
- Create:
  - `public/portal.webmanifest`:
    - name `St. Kyrillos Sunday School`, short_name `Sunday School`;
    - start_url `/portal`, scope `/portal`, display `standalone`;
    - theme_color `#6F1D1B`, background_color `#F7F3EC`;
    - icons 192 and 512.
  - Icons: `public/portal-icon-192.png`, `public/portal-icon-512.png`, `public/portal-apple-touch-icon.png` (180). Made from `public/images/Logo.png` with `sips`, flattened onto `#F7F3EC` if it has alpha.
  - `public/portal-sw.js`:
    - `push` → `showNotification(title, { body, icon: '/portal-icon-192.png', tag, data: { href } })`;
    - `notificationclick` → focus an open portal window and navigate it, else `clients.openWindow(href)`.
  - `lib/portal/push-client.ts` (pure, browser-safe). Exports:
    - `isIosDevice(ua: string, maxTouchPoints: number): boolean`. True for an iPadOS desktop UA with touch points > 1.
    - `phoneSupport(p: { hasServiceWorker: boolean; hasPushManager: boolean; hasNotification: boolean; ios: boolean; standalone: boolean }): 'ok' | 'ios-install' | 'unsupported'`
    - `urlBase64ToUint8Array(s: string): Uint8Array`
  - `components/portal/PhoneNotifications.tsx` (client):
    - shows a status line;
    - offers Turn on / Turn off / Send me a test;
    - on an iPhone not running from the Home Screen, shows the steps instead (Share → Add to Home Screen → open St. Kyrillos from the Home Screen → Settings → Turn on).
  - `lib/portal/actions/notices.ts` (`'use server'`):
    - `savePushSubscription({ endpoint, keys: { p256dh, auth }, userAgent? })`:
      - staff only;
      - endpoint must be `https:` and ≤ 1000 chars; keys ≤ 200;
      - upsert by endpoint (a browser that signs in as someone else moves to them);
      - `live = isLiveSite(process.env)`.
    - `removePushSubscription(endpoint)`: own subscriptions only.
    - `setNoticeEmails(on: boolean)`.
    - `sendTestNotice()`: `deliverNotices` of one `test` notice, title `Test notification`, body `Notifications are working.`, href `/portal/settings`. Returns `{ pushed, emailed }`.
- Modify:
  - `app/portal/(app)/settings/page.tsx`: a `Notifications` card for users with `servantId`. It holds PhoneNotifications (public key from `webPushPublicKey()`; hidden when null), the email checkbox, and how many phones are on.
  - `app/portal/(app)/layout.tsx` and the login page metadata: `manifest: '/portal.webmanifest'`, `appleWebApp: { capable: true, title: 'Sunday School' }`, `icons.apple: '/portal-apple-touch-icon.png'`.
- Test: `tests/portal/push-client.test.ts`, `tests/portal/notice-actions.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `isIosDevice` for iPhone and iPad UAs, an Android UA → false;
  - `phoneSupport`: iPhone not standalone → `ios-install`, iPhone standalone with push → `ok`, no PushManager → `unsupported`;
  - `urlBase64ToUint8Array` round-trips a known VAPID key length (65 bytes);
  - `savePushSubscription refuses http:`;
  - `savePushSubscription moves an endpoint to whoever is signed in`;
  - `removePushSubscription only touches your own`;
  - `a student cannot subscribe`;
  - `setNoticeEmails stores the choice`.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement and generate the icons. Run `npx web-push generate-vapid-keys --json` and write both keys to `.env.local` only.
- [ ] **Step 4:** Run. PASS. Run `npx tsc --noEmit` and lint.

### Task 6: The evening-before reminder

**Files:**
- Create:
  - `lib/portal/data/reminders.ts`: `sendTomorrowReminders(now?: Date): Promise<{ date: string; servants: number; stored: number; pushed: number; emailed: number; pruned: number }>`.
    - tomorrow = `addDays(churchToday(now), 1)`;
    - group `dutiesDueOn(tomorrow)` by servant → `reminderNotice`;
    - `dedupeKey` `reminder:{servantId}:{tomorrow}`;
    - `deliverNotices`;
    - prune `Notice` older than 60 days, and `NotificationRead` keys starting `notice:` read more than 60 days ago.
  - `app/api/portal-reminders/cron/route.ts`: GET with `Authorization: Bearer ${CRON_SECRET}` (else 401), as `app/api/coptic/cron/route.ts`; `export const dynamic = 'force-dynamic'`; JSON report.
- Modify: `vercel.json`, adding `{ "path": "/api/portal-reminders/cron", "schedule": "0 23 * * *" }`.
- Test: `tests/portal/reminders.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `at 6 PM Saturday church time it reminds about Sunday`: `now = 2026-10-24T23:30:00Z` → `dutiesDueOn('2026-10-25')`.
  - `one reminder per servant with all of tomorrow`.
  - `the dedupe key is per servant per day`.
  - `old notices are pruned`.
  - `the route refuses a call without the cron secret` (401) and `answers the report with it`.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. PASS.

### Task 7: End-to-end on dev, and the suites

**Files:**
- Modify:
  - `scripts/portal-smoke.mjs`: the cron route without a secret → 401;
  - `scripts/og-parity-verify-ui.mjs`: Settings shows a Notifications card for a servant; My Assignments has `#week-` anchors.
- Scratchpad: `e2e-notices.mjs` (dev only, refuses prod). As Paul (5th & 6th Boys):
  - put a second servant S on Coptic + Memorization for next Sunday, topics tagged `ZZE2E`. One `Notice` row for S.
  - As S: the bell shows it; the My Assignments badge reads 1; the tap lands on `#week-…`.
  - S turns on phone notifications in a context with `notifications` permission. If headless Chrome can subscribe, a later change pushes and `registration.getNotifications()` shows it. If it cannot, say so.
  - A lesson dated tomorrow, assigned to S → calling the cron route twice stores one reminder.
  - Clean up everything tagged, every notice and subscription made, and audit lines.

- [ ] **Step 1:** `npx vitest run`, `npx tsc --noEmit`, lint. All pass.
- [ ] **Step 2:** `next dev`; `npm run smoke`, `npm run smoke:write`, `npm run verify:ui`, and the scratchpad E2E. All pass.
- [ ] **Step 3:** Stop the dev server; `npx next build` succeeds.
- [ ] **Step 4:** Update memory. **Do not commit or push** until the user says so. Tell the user the two Vercel env vars to add (names only; values are in `.env.local`).
