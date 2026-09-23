# OG Parity — Restoration Log

Tracks what has actually been restored, against the IDs in `OG-PARITY-AUDIT.md`.
Nothing here is committed or deployed yet.

Verification for every entry: `npx tsc --noEmit` clean, `npm test` green, `npx next lint` clean.

## Wave 1 — dangerous bugs + the "can't find it" complaints

| ID(s) | What | Where |
|---|---|---|
| — | **Attendance could save a register onto the wrong day.** `marks` was seeded via `useState` and ignored later prop changes, so switching date/session kept the previous sheet loaded. Now keyed to remount per sheet, as the OG's `attInitCardStates()` did. | `app/portal/(app)/classes/[id]/attendance/page.tsx` |
| F0041 (part) | **Sign-in refused a correct PIN.** The in-memory limiter counted every attempt, including successes, and survived an admin PIN reset. Split into `isRateLimited` / `recordFailedAttempt` / `clearRateLimit`; only failures spend budget, success releases, and `resetServantPin` clears it. +4 tests. | `lib/rate-limit.ts`, `lib/auth.ts`, `lib/portal/actions/admin.ts` |
| F0148 (part), nav-ia | **Topbar avatar dropdown restored** (OG `.atb-user-dd`, L1555-1662) with per-role contents. Admin: Classes / Servants / All Students / Settings. Servant: My Profile / My Attendance / My Assignments. Student: My Profile / My Attendance / My QR Code. Pastor: Classes / Church Reports. Sign out for every role. Closes on outside-click and Escape, which the OG did not. | `components/portal/Shell.tsx`, `lib/portal/nav.ts`, `app/portal/(app)/layout.tsx` |
| F0000, F0064, F0135 | **Class profile print buttons restored** — `Print QR Codes` and `Print Report` back in the header (OG L4830-4831), pre-scoped via `?class=<id>`. | `app/portal/(app)/classes/[id]/page.tsx` |
| F0444, F0146, F0192, F0200 | **Lost sidebar destinations restored** — servants get Students / Attendance / Points again; admins get Take Student Attendance (OG L2713). Three resolver routes jump straight through for a single-class servant and show a picker otherwise. | `lib/portal/nav.ts`, `app/portal/(app)/{students,attendance,points}/page.tsx`, `components/portal/ClassChoice.tsx`, `lib/portal/data/class-entry.ts` |
| — | **Deploys were broken.** Four empty iCloud duplicate dirs in `prisma/migrations/` made `prisma migrate deploy` abort with P3015, so the build failed. Removed. | `prisma/migrations/` |

## Wave 2 — orphaned pages, My Profile, follow-up sync

| ID(s) | What | Where |
|---|---|---|
| F0152, F0045, F0643, F0837, F0838, F0400, F0054 | **`/portal/photo` was a fully working orphan** — uploader and both server actions existed, nothing linked to them, so no one could set a photo. Added "My Photo" to all four role dropdowns and a "Photo" button on the student profile. Seven findings, one root cause. | `lib/portal/nav.ts`, `components/portal/Shell.tsx`, `app/portal/(app)/students/[id]/page.tsx` |
| F0044, F0148, F0723, F0724 | **"My Profile" page built** (OG `svLoad('myprofile')` / `stLoad('profile')`) — hero with avatar, student stat strip (points / quizzes / present / class rank), Personal Information card with the OG's em-dash fallbacks, and self-edit of email / phone / birthday / address for staff. Students stay read-only, as in the OG. Added to all four sidebars and dropdowns. | `app/portal/(app)/profile/{page,ProfileForm}.tsx`, `lib/portal/actions/account.ts`, `lib/portal/nav.ts` |
| — | **Root cause of "follow-ups weren't created".** `absenceStreakAgainst` returned 0 whenever a student had no rows at all, so a child who never appears could never raise a case — while the OG had a dedicated label for exactly those children ("No attendance recorded", L17245). Added an enrolment anchor. +5 tests. | `lib/portal/attendance-rules.ts`, `lib/portal/actions/attendance.ts` |
| F0097 | **QR check-ins never touched follow-up cases.** Extracted the sync into one shared module and called it from both the manual save and the QR redemption path. | `lib/portal/followup-sync.ts`, `lib/portal/actions/{attendance,qr}.ts` |
| F0116 | **Clearing a case's "next follow-up" date silently did nothing** — Prisma reads `undefined` as "leave alone"; only `null` clears a column. | `lib/portal/actions/followups.ts` |

## Known partials

- **F0721 / F0722** — My Profile exists and is linked, but the OG's persistent mobile bottom nav (5 one-tap tabs) is still missing; mobile is a hamburger overlay.
- **F0334** — `Print Report` is back on the class profile, but it prints the report-cards page; the OG's letterhead class summary document is not rebuilt.
- **F0004** — QR Points is reachable but still lacks its own one-tap sidebar entry.
- **F0041** — the lockout countdown and an admin-visible "Locked until…" badge are still not surfaced; only the limiter behaviour is fixed.

## Wave 3 — the child's second missing page, and the search cluster

| ID(s) | What | Where |
|---|---|---|
| F0707, F0690 | **"My Grades & Points" page built** (OG `stLoad('grades')`) — the second whole page the child view lost. Stat strip (total points / quizzes taken / average score / class rank), the OG's "Activities & points" breakdown grouped by activity with per-activity counts and bars, and a quiz-results table with banded scores. `?student=` lets a servant open a child's ledger, mirroring the Achievements page. Added to the student sidebar. | `app/portal/(app)/grades/page.tsx`, `lib/portal/nav.ts` |
| F0552, F0821 | **Search on Admin → Servants** — matches name, login ID or email, with a Clear button. Students have had a search box since the port; servants never did, so finding one of 82 accounts meant scrolling every class group. | `app/portal/(app)/admin/servants/page.tsx` |
| F0385 | **Class roster search** — matches name or ID. Only the displayed list filters; rank and the class stats above stay class-wide, which is the correct behaviour. | `app/portal/(app)/classes/[id]/page.tsx` |
| F0824, F0825, F0826 | **Points history controls restored** — search across student / activity / reason / servant, All / Added / Removed filter chips, and four grouping modes (flat, by student, by date, by servant) each with a net-points subtotal. All client-side; the data was already in props. | `app/portal/(app)/classes/[id]/points/PointsPanel.tsx` |
| — | **`prisma migrate deploy` removed from `npm run build`.** A build could mutate a database, so every local build and CI run was a live migration. `build` is now plain `next build`; Vercel keeps migrating via `vercel-build`, which it prefers over `build`. Added `npm run db:deploy` for explicit manual migrations. | `package.json` |

Wave 3 verification: `tsc --noEmit` clean · `npm test` 404 passing · `next lint` clean · `npm run build` compiles, and all five new routes appear in the build manifest.

## Wave 4 — logic fixes (fully verifiable without a browser)

| ID(s) | What | Where |
|---|---|---|
| F0196 | **Future-dated attendance is now refused.** The OG pinned `max=today` on its date input; the port dropped the guard on both sides. This was not cosmetic: any date with a row counts as a session the class "held", so a single future save permanently depressed every attendance rate in that class. Added a pure `isFutureDate` predicate (+3 tests), enforced in `saveAttendance`, and capped the date picker at today in the church's timezone. | `lib/portal/attendance-rules.ts`, `lib/portal/actions/attendance.ts`, `app/portal/(app)/classes/[id]/attendance/{page,AttendanceTaker}.tsx` |

Wave 4 verification: `tsc --noEmit` clean · `npm test` 407 passing · `next lint` clean.

## Wave 5 — verified in a real browser, and polish it exposed

The dev branch was fine all along. My earlier "this is production" warning was wrong: I had
inferred it from a build log that only showed which database local config pointed at. The
authoritative answer was already in the repo — `scripts/portal-write-smoke.mjs` hardcodes
`PROD_ENDPOINT = 'ep-dark-term-ai3c2hag'`, and local is `ep-jolly-bread-aiuykcub`. Use that
constant to settle the question in future, not a build log.

Verified against the dev branch:

- `npx prisma migrate status` — schema up to date, no migration needed.
- `npm run smoke` — **117/117** GET checks.
- `npm run smoke:write` — **12/12** browser-driven write checks, including the `resetServantPin`
  path that Wave 1 modified.
- `npm run verify:ui` (new, `scripts/og-parity-verify-ui.mjs`) — **40/40** checks driving the
  restored UI in Chrome and saving screenshots to `.audit/shots/`. It asserts the dropdown opens,
  lists all seven items and closes on both Escape and outside-click; that every new route renders;
  that the class profile has both print buttons and a working roster search; and that the points
  history chips really filter, grouping really renders subtotals and search really narrows. Where
  the dev branch has no data to show (it has zero point entries), it seeds two tagged rows and
  deletes them again, asserting the cleanup.

One caution learned here: a cold `next dev` compile makes `smoke:write`'s fixed
`waitForTimeout(2500)` too short, so the first run after starting the server can report spurious
`createServant` failures. Run it twice, or raise that timeout. I briefly mis-attributed this to my
own changes because my stash comparison ran second, with a warm cache — a confounded experiment.

Polish the screenshots exposed (invisible to tests, found by looking):

| What | Why it mattered |
|---|---|
| Grades showed **"Class rank #1"** to a student with zero points. With every total at zero `rankStudents` ties the whole class at first place, so it congratulated a child who had earned nothing. Rank is now shown only once they have points. | `app/portal/(app)/grades/page.tsx` |
| Grades said **"Where *your* points came from"** while a servant viewed someone else's ledger. Subtitle and empty-state hint now match the audience. | same |
| My Profile listed **Birthday and Address rows for a pure ADMIN**, which has no Servant row to store either — the edit form already hid both, so it advertised fields that could never be filled. Rows are now conditional. | `app/portal/(app)/profile/page.tsx` |

Wave 5 verification: `tsc --noEmit` clean · `npm test` 407 passing · `next lint` clean ·
`smoke` 117/117 · `smoke:write` 12/12 · `verify:ui` 40/40.

## Wave 6 — the mobile bottom nav

| ID(s) | What | Where |
|---|---|---|
| F0722, nav-ia mobile | **Persistent mobile bottom bar restored** (OG `.mob-bottom-nav`, L19936-19963). Five one-tap destinations per role plus More, with the prototype's own labels and styling — 64px, `#4A1212`, gold top-edge marker on the active tab. Admin: Home/Classes/Servants/Students/News · Servant: Home/Students/Attend/Points/Exams · Student: Home/Exams/Grades/Reading/Profile · Pastor: Home/Classes/Rank/Events/Visits. "More" opens the existing full nav panel. The port had replaced the whole pattern with a hamburger, so every destination was two taps behind a menu — on the devices servants and children actually use on a Sunday. | `lib/portal/nav.ts`, `components/portal/Shell.tsx`, `app/portal/(app)/layout.tsx` |
| — | **Mobile nav overlay z-index bug (pre-existing).** The sticky identity bar is `z-[100]` but the full-screen nav panel was `z-[90]`, so the bar floated over the open menu and swallowed taps in that strip, including the panel's own close button. Raised the panel to `z-[400]`, above both the identity bar and the new bottom bar. Found by the browser check, not by reading. | `components/portal/Shell.tsx` |

Wave 6 verification: `tsc` clean · `npm test` 407 · `lint` clean · `verify:ui` **48/48** (now covers the phone viewport: bar present, 5+More, active-tab marking, More opens the panel, tapping navigates, and the bar is hidden on desktop).

## Wave 7 — follow-up quick actions (the row from the user's screenshot)

| ID(s) | What | Where |
|---|---|---|
| F0467 | **WhatsApp quick-link restored** — `waLink`, ported from OG L16751. Numbers are stored without a country code but wa.me needs the international form, so a bare 10-digit US number gets a 1 prepended; longer numbers pass through. Pure function, **+4 tests**. | `lib/portal/phones.ts` |
| F0468 | **"Send" composer restored** (OG `openSendMessageModal`, L17340) — channel picker (Email / WhatsApp), then the family's contacts (student's email + each parent email; or student's / father's / mother's phone), then the prototype's pastoral template, editable, opening the user's own mail client or WhatsApp. The portal still sends nothing itself, exactly as before. | `app/portal/(app)/follow-ups/CaseQuickActions.tsx` |
| — | **One-tap call and WhatsApp on the row** — `tel:` and `wa.me` for the first number on file, so chasing an absent child no longer means hunting for the number. | same |
| — | **Cases can be deleted again.** The prototype offered delete from four places; the port from none, so a case opened by mistake (wrong date, duplicate, a child who had moved away) could only be resolved, never removed. The contact log cascades with it by design — `resolveCase` remains the way to record a real outcome. | `lib/portal/actions/followups.ts` (`deleteCase`) |
| — | **Composer wording bug, found by the browser check:** the submit button read "Open in WhatsApp" before any channel was chosen, because the ternary fell through on `null`. It now reads "Send" until a channel is picked. | `CaseQuickActions.tsx` |

Wave 7 verification: `tsc` clean · `npm test` **411** · `lint` clean · `build` compiles · `verify:ui` covers the whole flow against a seeded case — call/WhatsApp links present and country-code-correct, composer opens, channels offered, send disabled until a channel *and* contact are chosen, template prefilled and personalised, Cancel closes, and **the trash button really deletes the row from the database**. The seeded case is removed afterwards and the cleanup asserted.

Note: running `npm run build` while `next dev` is live clobbers the dev server's `.next` and it starts failing sign-in. Restart it (`rm -rf .next` then `npm run dev`) if that happens.

## Wave 8 — the birthdays cluster

| ID(s) | What | Where |
|---|---|---|
| F0240 | **"This week" is the calendar week again, Monday–Sunday in ET.** The port used a rolling seven days from today, so by Sunday every birthday from Monday to Saturday had silently dropped off the board — precisely when a servant looks for who to greet. This needed a new function, not a tweak: a calendar week has to look *backwards* inside the week, which the forward-only `upcomingBirthdays` structurally cannot. `birthdaysInWeek` walks the week's seven dates, which also makes the new-year boundary correct for free. **+6 tests.** | `lib/portal/birthdays.ts`, `app/portal/(app)/birthdays/page.tsx` |
| F0248 | **Dedicated "Next week" card restored** — it had been buried in a generic month bucket. | `app/portal/(app)/birthdays/page.tsx` |
| F0246 | **"No birthday on file" list restored** — students with no DOB never appear on the board at all, so there was no way to see whose record still needed filling in. Now listed as chips linking to each profile. | same |
| F0245 | **Full-year roster restored** — the board showed 60 days, so anyone further out appeared nowhere in the portal. A "Show the whole year" toggle widens the window to 366 days. | same |
| F0244 | **Topbar birthday chip is clickable and count-aware** — it was an inert `<span>` naming only one child even when several shared the week, so a servant had no idea there were others. Now a link to the Birthdays page with a "+N more" count, and it uses the same calendar week as the page instead of sliding forward a day at a time. | `components/portal/BirthdayChip.tsx`, `lib/portal/data/dashboard.ts`, `app/portal/(app)/layout.tsx` |

Wave 8 verification: `tsc` clean · `npm test` **417** · `lint` clean · `build` compiles · `verify:ui` **74/74**.

Note on the build: `⚠ Compiled with warnings` is pre-existing and comes from `next-auth`/`jose`
using `CompressionStream` in the Edge Runtime. Not related to any of this work.

## Wave 9 — Sunday-critical QR flow, exam ordering, student contact details

| ID(s) | What | Where |
|---|---|---|
| F0001 | **A child scanning the projected code while signed out no longer loses it.** The middleware redirected to `/portal/login` and threw the requested path away, so after signing in they landed on the dashboard — and a group code expires in five minutes, so the code was simply gone. The destination now travels through sign-in as `?next=`, validated by a new `safeNextPath`: relative paths inside `/portal` only, rejecting absolute URLs, protocol-relative `//host`, backslash tricks and the login page itself. Carrying a destination in the URL makes it attacker-controlled, so this is deliberately strict. **+6 tests.** | `lib/portal/login.ts`, `lib/auth.config.ts`, `app/portal/login/PortalLoginForm.tsx` |
| F0023 | **Undated exams no longer sort above every dated one.** `ORDER BY dueDate DESC` puts NULLs *first* in Postgres, so every exam without a due date jumped to the top of the list. Both query sites now use `nulls: 'last'`. Proven empirically against the dev branch: the old ordering reproduced the bug, the new one does not. | `lib/portal/data/exams.ts` |
| F0059 | **The student's own email and phone exist again.** They live on `Account` and the port captured neither, so a servant could record both parents but not the child's own number. Added to the create and edit forms, written through create and update (with email validation and phone normalisation), and shown on the profile as a "Student" row. The parents' emails were also labelled just "Email", which read as the child's — now "Parent email". | `lib/portal/actions/students.ts`, `components/portal/StudentForm.tsx`, `app/portal/(app)/students/[id]/{page,edit/page}.tsx` |

Wave 9 verification: `tsc` clean · `npm test` **423** · `lint` clean · `build` compiles ·
`smoke` 117/117 · `smoke:write` 12/12 · `verify:ui` **85/85**. The signed-out scan is checked
end-to-end in a clean browser context with a real student account and a seeded hex token
(tokens must match `/^[0-9a-f]{8,64}$/` or the page rejects them before touching the database);
the student contact fields are driven through the real edit form and the original values restored.

### Deliberately NOT changed — needs the user's decision

**F0018 — when a future-dated quiz unlocks.** The audit called this an integrity bug: a published
exam with a future due date is immediately available, so children can take next week's quiz today.
The OG disagreed with the port on what `dueDate` *means*:

- **OG** (L11950/11960): `dueDate` is the exam's date. A future date renders locked, "Opens <date>".
- **Port**: `dueDate` is a deadline. Available until then, missed after.

The port's reading is deliberate, not an oversight — `tests/portal/exams.test.ts:75` explicitly
asserts "is available before the due date", and `examStatusFor`'s doc comment describes it. Flipping
it would change when children can take quizzes for a class mid-pilot, so it is a decision about how
the church's servants use the tool rather than a defect to patch. Ask before changing.

## Wave 10 — batch pass (10 findings)

Approach changed here: batch many contained fixes, verify once with the full battery, and target
files where findings cluster, rather than a browser check per fix.

| ID(s) | What | Where |
|---|---|---|
| F0309, F0499 | **Servants can no longer edit or delete a colleague's event.** Class scope alone is not enough — every servant of a targeted class shares it, so any co-servant could rewrite or delete someone else's event. New `mayModifyEvent`: servants are held to their own events, admins and the pastor manage anything, and an event with an unknown creator is refused for servants rather than opened up. **+4 tests.** | `lib/portal/permissions.ts`, `lib/portal/actions/events.ts` |
| F0104 | **The pastor can open a manual follow-up case again.** They hold `followup.write` and the prototype let them open cases church-wide; only the page's own `canCreate` flag was stopping them. | `app/portal/(app)/follow-ups/page.tsx` |
| F0775 | **"Church Reports" lands on the church report.** The admin and pastor nav pointed at `/portal/reports`, whose default tab is the per-class attendance matrix — so the link with that label opened the wrong page. Now `?tab=church`. | `lib/portal/nav.ts` |
| F0004 | **"QR Points" has its own one-tap sidebar entry again**, and `?mode=points` is now a real parameter that preselects the points mode — adding the nav item without wiring it would have been another dead link. | `lib/portal/nav.ts`, `app/portal/(app)/qr/{page,GroupCodePanel}.tsx` |
| F0230 | **"Add hymn" back in the page header.** The only add control sat below the entire hymn list, so on a phone adding one meant scrolling past every hymn already there. | `app/portal/(app)/hymns/{page,HymnManager}.tsx` |
| F0258, F0260 | **Servants can browse and copy other classes' lessons again.** Two symptoms, one cause: the archive was gated to ADMIN/PASTOR, and "Copy from another class" drew its sources from the user's *own* visible classes — so the typical servant, who serves exactly one class, got an empty list and a dead feature. Lessons are teaching material, not student data, and the route is already staff-only at the edge. | `app/portal/(app)/lessons/page.tsx` |
| F0257 | **Lesson search restored** — "Search lessons, saints, verses…" across title, notes, topics and link labels. With a year of lessons across twelve classes, scrolling is not a search. | same |
| F0173 | **Activities can be edited.** The port could create and delete them but never edit, so fixing a typo or adjusting a value meant delete-and-recreate — which orphans the label already written onto every past point entry. New `updateActivity` deliberately leaves the stable `key` alone, since that is what past entries were recorded against. Pencil button with a compact inline editor. | `lib/portal/actions/points.ts`, `app/portal/(app)/classes/[id]/points/PointsPanel.tsx` |

Wave 10 verification: `tsc` clean · `npm test` **427** · `lint` clean · `build` compiles ·
`smoke` 117/117 · `smoke:write` 12/12 · `verify:ui` **85/85, run twice**.

Also hardened a flaky check in `verify:ui`: the mobile-nav tap waited a fixed 1200ms after closing
the More panel, and while that panel is open it covers the bar so the tap lands on nothing. It now
waits for the panel to detach and for the URL to change.

## Wave 11 — the last blocker, plus bulk tooling (14 findings)

| ID(s) | What | Where |
|---|---|---|
| **F0215** (blocker) | **A servant from another class can be put on the agenda again.** `classServants()` queried only the class's own team, so the prototype's grouped "This Class / Other Classes" dropdown had no data to draw on — the option never appeared — and `requireServant()` rejected a cross-class id even if one arrived. Borrowing a servant when a class is short is ordinary on a Sunday and there was no path for it at all. New `agendaServantOptions()` returns both groups, the selects render them as `<optgroup>`s, and the server allow-list is any active servant. | `lib/portal/data/agenda.ts`, `lib/portal/actions/agenda.ts`, `app/portal/(app)/agenda/{page,AgendaEditor}.tsx` |
| F0136 | **The blank paper attendance form prints the right dates.** It derived its columns from a hardcoded Sunday filter regardless of session, so a Wednesday Bible-study sheet came back with every mark under the wrong day — and the marks are transcribed from that paper. **The audit's stated fix was wrong**: it claimed `AttendanceSession.dayOfWeek` already exists, but that column is on `ServantActivity`; `AttendanceSession` has no day at all. Instead the weekday is learned from the dates the class has actually recorded for that session (`dominantWeekday`), falling back to Sunday when there is no history — no schema change, no guess about the church's timetable. **+2 tests.** | `lib/portal/reports.ts`, `lib/portal/data/reports.ts` |
| F0131 | **One student's report card can be viewed and printed on its own.** The page always rendered every card in the class, so handing a family their child's report meant handing them everyone else's marks. `?student=` scopes it to one sheet, linked from the student profile header, with a way back to the full set. | `app/portal/(app)/reports/cards/page.tsx`, `app/portal/(app)/students/[id]/page.tsx` |
| F0063 | **Class reassignment is back inside the Edit Student form**, admin-only, as the prototype had it (`es-class-fld`, hidden for servants) — an admin fixing a child's details and their class does it in one save. The roster's quick-change dropdown stays, but it fired on change with no confirm and no undo, so a misclick silently moved a child; it now confirms by name and reverts the select if you say no. | `components/portal/StudentForm.tsx`, `app/portal/(app)/students/[id]/edit/page.tsx`, `app/portal/(app)/admin/students/MoveStudentSelect.tsx` |
| F0055 | **Student CSV import stops corrupting `parentEmails`.** `normaliseHeader` turns the prototype's `ParentEmails` into `parentemails`, which matched nothing in the pick list, so it fell through to `email` — the student's own address — and wrote that into the parents' field. `Phone` was dropped entirely. Both now have their own columns on the student's Account, and export carries them for a lossless round trip. | `lib/portal/actions/data-tools.ts` |
| F0060 | **"Download template" exists.** The Help page has always told admins to download the template first so the columns line up; there was no template, so the instruction sent them looking for a control that did not exist. Headers are `STUDENT_COLUMNS` verbatim plus one worked example row. | same |
| F0061 | **Import previews before it writes.** The Help page promised a preview "before anything is saved" and the port committed on the spot, so a mis-mapped column was only discovered after it had overwritten real records. `preview: true` runs every check and reports what each row *would* do — and deliberately skips the audit log and cache invalidation, which would otherwise claim rows were created. | `lib/portal/actions/data-tools.ts`, `app/portal/(app)/admin/data/ImportPanel.tsx` |
| F0058, F0066, F0651 | **Bulk student editing rebuilt**, which never existed anywhere in the port for any role. Checkboxes per student, a per-class "All", a sticky bar that appears only once something is selected, one-field-across-many with a real **Undo** (the action returns each student's prior value and hands it back), plus bulk Move and bulk Delete for admins. Every student is permission-checked individually, so posted ids from another class are refused. | `lib/portal/student-fields.ts`, `lib/portal/actions/students.ts`, `app/portal/(app)/admin/students/{BulkTools,page}.tsx` |
| F0650 | **Servants can export their own class roster again.** The prototype put Export CSV straight on the servant's Students page — self-service; the port moved it behind the admin-only Data & Backup route. `exportStudentsCsv` now accepts a servant for a class they can read, with a button on the class page. Import stays admin-only: it creates and moves accounts church-wide. | `lib/portal/actions/data-tools.ts`, `app/portal/(app)/classes/[id]/RosterExportButton.tsx` |
| F0650, F0651 | **Help stops linking servants into 404s.** Three topics pointed straight at `/portal/admin/*`, which `notFound()`s for a servant — the guide sent them to a wall. Each now resolves to the surface their own role has, and the prose says plainly what is admin-only rather than describing a screen they cannot open. | `app/portal/(app)/help/page.tsx` |
| F0414 | **Taking points away requires a reason again**, from the prototype's ten canned options verbatim plus its "Other (specify)" fallback. The port shipped a single optional free-text box labelled "Reason (optional)", so the ledger filled with blank and inconsistent entries — on records documenting a child's behaviour. The submit button is disabled until a reason is chosen. | `app/portal/(app)/classes/[id]/points/PointsPanel.tsx` |
| F0298 | **Servant attendance rates stop being corrupted.** `heldPairs` was computed church-wide with no servant scoping, so any servant anywhere recording an activity made it "held" for everyone in scope — a group that never attends, say, the Friday meeting was scored 0/N on it, and the "Standing" badge was computed from a denominator they were never part of. Now scoped to the servants on screen. | `lib/portal/data/servant-attendance.ts` |
| F0290 | **"My Attendance" is writable.** `markMyServantAttendance` existed and worked but had zero callers; the only way to self-mark was the team-wide grid on Servants Attendance, a page that reads as a coordinator tool. A self check-in card now offers every active activity for the current week and cross-links to the coordinator page. | `app/portal/(app)/my-attendance/{page,SelfCheckIn}.tsx` |
| F0583 | **A staff account with no Servant row can self-track.** Every servant-attendance surface queried the `Servant` table, so a pure ADMIN who also serves on a Sunday never appeared as a row and the action refused outright. The prototype keyed self check-in on the plain account id, so anyone signed in worked. The profile is created on first save, and the page resolves the row by `accountId` rather than trusting a possibly stale token. | `lib/portal/actions/servant-attendance.ts`, `app/portal/(app)/my-attendance/page.tsx` |
| F0292 | **Partial, deliberately.** The prototype let *any* servant mark the whole team; this port limits that to coordinators, stage overseers and admins. That tightening looks right, but it happened silently — everyone else's row was simply dead to the touch. The page now says so. **Whether to restore the OG's open rule is a church policy call, not mine.** | `app/portal/(app)/servant-attendance/page.tsx` |

Wave 11 verification: `tsc` clean · `npm test` **429** · `lint` clean · `build` compiles ·
`smoke` 117/117 · `smoke:write` 12/12 · `verify:ui` **113/113** (28 new checks added for this wave).

## Wave 12 — exams and the pastor's dashboard (10 findings)

| ID(s) | What | Where |
|---|---|---|
| F0019 | **The church's own quiz sheet imports again.** Their established format carries no Title column at all — `Day, Question, Option A–D, Correct Answer`, with month, year and points chosen in the form (OG L16311-16379). The port required a Title on *every row*, so an entire term's sheet failed line by line with "Missing exam title." The parser now detects the shape from the header (a sheet that *has* a Title column and leaves it blank is still an error, as it should be), reads an optional Day, buckets three questions to a day when there is no Day column, and auto-titles each day "Daily Quiz — July 1, 2026". Month and points controls appear in the form only for that shape, and there is a template to download. **+6 tests.** | `lib/portal/exams.ts`, `lib/portal/actions/exams.ts`, `app/portal/(app)/exams/import/ExamImport.tsx` |
| F0020 | **Reopening many overdue quizzes at once is back.** The single-exam path had merely moved to the detail page, but the prototype's cross-exam version did a set-union **merge** into each exam's list, and nothing in the port merged or accepted more than one exam id. The merge is the whole point: a student granted one overdue quiz individually must not lose it because a later bulk action named a different set. New `bulkReopenExams` checks each exam separately and filters students to that exam's own roster, so one selection spanning two classes grants each child only their own class's quizzes. | `lib/portal/actions/exams.ts`, `app/portal/(app)/exams/{page,ExamsFilter}.tsx` |
| F0021 | **Exams are grouped into collapsible months again** — month label, a CURRENT pill, "n exams · m past", current month open and the rest folded, undated last (OG L5202-5254). A year of quizzes across twelve classes in one flat grid is not a list anyone can read. | `app/portal/(app)/exams/ExamsFilter.tsx` |
| F0025 | **The student profile has its exam-results card back.** The file contained no reference to quiz data at all, so a servant asked "how is she doing in the quizzes?" had nowhere to look. Ten most recent, newest first, green from 70%, each row opening that exam. | `app/portal/(app)/students/[id]/page.tsx` |
| F0026 | **Exam statistics regained the Pass rate tile and the ranked list.** Pass rate is A/B/C — 70% and above (OG L15119-15131) — and it is the one number an average hides: a class can average 68% with everyone failing or with half the room at 90%. The results table is now ranked with the A–F letter beside each score, which is how a servant reads it out. | `app/portal/(app)/exams/[id]/page.tsx` |
| F0027 | **The report card's exam section shows each quiz.** The data layer selected only `{ studentId, percentage }`, so the card could say "82% average" and nothing else — a parent could not see which quiz went badly. Now correct/total, points earned and submission date per exam, with the summary line the prototype printed. **One deliberate divergence:** the prototype hid this behind a "Show Details" toggle; here it starts expanded, because a collapsed `<details>` prints collapsed and there is no reliable CSS to force one open for print. It still folds away on screen. | `lib/portal/reports.ts`, `lib/portal/data/reports.ts`, `app/portal/(app)/reports/cards/page.tsx` |
| F0755 | **Quiz average is back on the dashboard** for admin and pastor — the prototype's fourth overview tile. The number existed on Church Reports, but that tab was neither the default nor linked from the dashboard, so the one academic figure the pastor's role exists to watch was invisible at a glance. | `lib/portal/data/dashboard.ts`, `app/portal/(app)/page.tsx` |
| F0760 | **Pastor class cards carry their detail again** — the servant's *name* rather than a count (a pastor reads a class by who serves it), the class quiz average, and its top student. The pastor also had **zero** actions on a class card, not merely no print button; they now get the prototype's read-only Print. | same |
| F0759 | **The church-wide servant roster is reachable for the pastor.** No servant list existed anywhere else in the portal for that role, and the middleware bounced PASTOR before the page's own check ever ran, so it was unreachable for the one role whose job is oversight. Opened **exact-path only**: `/portal/admin/servants/<id>` is an edit screen and stays closed, and the roster's tiles render as plain tiles rather than links for a pastor — opening the prefix would have turned every tile into a link to a 404, which is the exact failure this restoration exists to undo. "Add servant" is hidden. **+5 tests**, and the write-path smoke expectations were updated to the new rule. | `lib/auth.config.ts`, `app/portal/(app)/admin/servants/page.tsx`, `tests/portal/staff-only-routes.test.ts`, `scripts/portal-smoke.mjs` |
| F0078 | **Largely closed by the four above** (church-wide Quiz Avg tile, per-class metrics, the servants roster). Still outstanding from this finding: the prototype's separate **Attendance Overview** list on the pastor dashboard. The per-class Sunday rate is on each class card, so the figure is present; the dedicated list is not. Logged rather than claimed. | — |

Wave 12 verification: `tsc` clean · `npm test` **440** · `lint` clean · `build` compiles ·
`smoke` 118/118 · `smoke:write` 12/12 · `verify:ui` with 23 new checks for this wave.

Two harness fixes this wave, both caught by the browser pass rather than by the compiler:

- The follow-up composer's contact radio is a **controlled** input. On a cold dev compile the click
  can land before React hydrates: the browser checks the box natively, then the first render resets
  it, and Playwright's `.check()` threw the whole run away. It now retries and asserts the outcome.
- My own new report-card check was wrong: `/quizzes taken/` also matches "**No** quizzes taken in
  this period", so it asserted a breakdown for a student who had no quizzes to break down. It now
  picks a student who actually has a submitted result.

## Wave 13 — the reports system (11 findings)

The densest cluster in the audit, and the one a pastor or coordinator actually lives in.

| ID(s) | What | Where |
|---|---|---|
| F0123, F0197, F0442 | **The all-sessions month grid is back** — one view per month with a header row spanning each week and a column per session inside it, the prototype's abbreviations (BS/V/T/SL/SS/H) and a legend under the table (OG `renderAttendanceMonthTable`, L8938-9017). The port could only show one session at a time, so reading a month properly meant running *and printing* the same report six times. Three findings, one shape, one implementation. The blank paper form uses it too, so a single sheet covers the month instead of six. **+8 tests** on the pure builder, covering the excused-drops-out rule, students with no row at all, two rows for one session in a week, and week boundaries that start in the previous month. | `lib/portal/reports.ts`, `lib/portal/data/reports.ts`, `app/portal/(app)/reports/AllSessionsMatrix.tsx` |
| F0128 | **Period is stated, not guessed.** The church report silently defaulted to the last 90 days with nothing on screen saying so — a pastor reading "62% attendance" could not tell what it covered. Now **All time**, **By month** and **Date range**, with the active period spelled out in the header. | `app/portal/(app)/reports/{page,ReportFilters}.tsx` |
| F0127 | **Attendance / Exam scores / Points modes restored.** The port was one fixed view, and its Points figure was a raw class total — which makes a class of thirty look better than a class of ten by construction. Points mode leads with **points per student**, which is the comparison the number is for. The chosen mode also orders the per-student drill-in. | same, `app/portal/(app)/reports/ChurchClassGrid.tsx` |
| F0125 | **Per-class checkboxes, Select all, and Print selected.** Selection filters the *printout*, not the screen — hiding cards on screen would mean re-picking them every time you wanted to look at another class. This is what lets a coordinator be handed a sheet for their own classes instead of the whole church. | `app/portal/(app)/reports/ChurchClassGrid.tsx` |
| F0124 | **Class cards are clickable again**, opening the students behind the number for the exact period and session the report was showing — ranked by whichever metric you came in on. Nothing else in the portal answers that query: the class page only carries an all-time Sunday rate. | `app/portal/(app)/reports/class/[id]/page.tsx`, `lib/portal/data/reports.ts` |
| F0126 | **The printed report is a document again** — letterhead, the period it covers, the date it was run, and a per-class student table (OG L7648-7692). `PrintButton` was `window.print()` and nothing else, so a sheet filed for the year carried no indication of what it was. The letterhead is print-only and shared by the church report, the class report and both attendance views. | `app/portal/(app)/reports/ReportLetterhead.tsx` + the report pages |
| F0132 | **My Stage embeds its reports again.** The prototype put the whole reports system at the bottom of this page, stage-scoped, with the print button relabelled **Print Stage Report**. The scoping survived in `churchReportScope()`, but a coordinator landing here had nothing telling them their reports were behind a generic "Reports" sidebar item. The label is back, with one-tap entries for each mode. | `app/portal/(app)/my-stage/page.tsx` |
| F0809 | **One-click "Print Class Report"** on the class page, on every row of the Classes list, and on the pastor's dashboard cards — no navigating, no filters to set first, as the prototype had it (L4831, L15383, L15478). | `app/portal/(app)/classes/page.tsx`, `classes/[id]/page.tsx`, `app/portal/(app)/page.tsx` |
| F0078 (remainder) | **Attendance Overview** added to the admin and pastor dashboard: every class on one bar chart with its rate and band (OG L15394-15409). The per-class rate was already on each card, but one card at a time is not a comparison — the point of this section is seeing which class is slipping without opening any of them. This closes the part of F0078 that Wave 12 left open. | `app/portal/(app)/page.tsx` |

**A dead link I nearly shipped.** The per-class report first gated on `churchReportScope()`, which returns `null` for a plain servant — so the new "Print Class Report" button on a servant's own class page would have 404'd for exactly the people it was for. It now goes through ordinary `requireClassAccess`, and its back link points at the class rather than a church report they cannot open. That is the failure mode this whole restoration exists to undo, and I came within one commit of adding another instance of it.

Wave 13 verification: `tsc` clean · `npm test` **449** · `lint` clean · `build` compiles ·
`smoke` 126/126 (new report routes added for all four roles) · `smoke:write` 12/12.

Also fixed the recurring `smoke:write` false alarm: `save()` waited a fixed 2.5s after submitting,
which is not enough on a cold `next dev` — the server action's route compiles on first use, so the
check read the database before the write landed and reported a failure a warm re-run never
reproduced. It now waits for the submit button to come out of its pending state and, where the
effect is only visible in the database, polls for it.

### A real bug found while verifying Wave 13 — the follow-up composer could not be used at all

The browser pass kept failing on the "Send a message" dialog, and I twice wrote it off as a
hydration race. It was not. Playwright's own log named the culprit:

```
<div class="portal-enter mx-auto w-full max-w-[1320px]">…</div> intercepts pointer events
```

`.portal-enter` — the wrapper around every portal page — carried
`animation: portalFadeSlideIn .3s ease both`. The `both` fill mode **retains the final keyframe
forever**, so the element permanently computes `transform: translateY(0)`. A computed transform of
anything other than `none` makes an element the containing block for every `position: fixed`
descendant. The composer is `fixed inset-0`, so it was being laid out against that wrapper instead
of the viewport — and the wrapper sat on top of the dialog's own controls. **The contact radios and
the Cancel button were unclickable for a real servant**, not just for the test.

This matters more than its size suggests: follow-ups are the feature the church reported as broken
in the first place, and "Send a message" is the one action a servant takes from that screen.

Two fixes, deliberately belt-and-braces:

- `.portal-enter` now uses `backwards` instead of `both`. It still hides the pre-start state, so
  there is no flash, but it leaves no transform behind once the animation ends.
- The dialog renders through `createPortal` into `document.body`, so it can never again depend on
  what an ancestor's CSS happens to do.

`verify:ui` now asserts both directly: that the dialog's parent is `<body>`, and that `.portal-enter`
computes no transform. Confirmed by isolating it in a standalone script before and after — the radio
goes from never checking to checking, and the Cancel button from permanently "not stable" to stable.

**Correction to my own earlier note:** the Wave 12 log records this as a hydration race and says the
check was hardened to retry. The retry was treating a symptom. The cause was the CSS above.

## Wave 14 — follow-ups, the points ledger and two data-integrity gaps (7 findings)

| ID(s) | What | Where |
|---|---|---|
| F0107 | **One open case per student, and the auto rule sees manual cases.** Two halves of the same defect: `createManualCase` had no duplicate check, and the absence rule filtered to `origin: 'AUTO'` when deciding whether to open — so a child could carry two open cases at once, appear twice in the list, and resolving one left the other sitting there. Now any open case blocks a new one, with a message naming the existing case; and only an *automatic* case may be closed or updated by the rule, because a manual case is someone's own record and not the rule's to resolve. | `lib/portal/actions/followups.ts`, `lib/portal/followup-sync.ts` |
| F0105 | **The pastor's church-wide view is grouped by class again**, with an open-count chip per class and an **All clear** chip for classes with nothing open — so "all clear" is visible rather than inferred from an absence. The header now states the church-wide count instead of a hardcoded line. A flat list of up to 200 cases is not an overview for the one role whose job is the cross-class view. | `app/portal/(app)/follow-ups/page.tsx` |
| F0171 | **The points history gained its Type column** (`PointEntry.source`, rendered as a pill and searchable), and the 60-row cap became 500. At 60 rows anything older than a fortnight in an active class was unreachable through the UI — present in the database, invisible to the user, and not findable by the History tab's own search. Search, the filter chips and the four grouping modes were already restored in an earlier wave. | `app/portal/(app)/classes/[id]/points/{page,PointsPanel}.tsx` |
| F0174 | **The student profile's ledger gained Type and a per-row Undo.** `undoPoints` already existed and worked, but only from the class-wide Points page — a servant who spotted a wrong entry on the child's own profile had to go and find it again among every student's entries. Undo is offered only where `canUndo` allows it (attendance points follow the register; undo entries are final). | `app/portal/(app)/students/[id]/{page,PointsLedgerRow}.tsx` |
| F0291 | **The servant weekly report shows which week was missed.** The per-week cells were computed and then discarded — collapsed into one aggregate per activity before the function returned — so the page could say "3 of 5" but never which two. Now a servants × (week × activity) grid with the prototype's ✓/E/✗/— glyphs, beside the existing summary table. | `lib/portal/data/servant-attendance.ts`, `app/portal/(app)/servant-attendance/report/WeekMatrix.tsx` |
| F0195 | **A register saved on the wrong date can be removed.** `saveAttendance` only ever upserted, and a session counts as *held* the moment any row exists — so one mis-dated save permanently added an occasion every student in the class was then measured against, and there was no recourse anywhere in the portal. Marking everyone absent does not help: those rows are exactly what make the date count. `removeAttendanceSession` deletes that class+date+session, the attendance points cascade away with it, and follow-up cases are recomputed because removing a held Sunday changes every streak scored against it. | `lib/portal/actions/attendance.ts`, `app/portal/(app)/classes/[id]/attendance/RemoveRegister.tsx` |
| F0199 | **Headline attendance stops lying to classes that do not meet on Sunday.** Fourteen sites hardcoded `sessionKey: 'sunday'`, so a class whose register is Bible Study or Liturgy read "No sessions yet" on the class card, the student profile and the dashboard — while its attendance sat in the reports the whole time. **Deliberately a fallback, not a redefinition:** a class that records Sunday School is still scored on Sunday School, so no existing number moves; only a class with no Sunday rows at all falls back to everything it does record. The cards are relabelled to name what they count. **+3 tests.** | `lib/portal/reports.ts`, `classes/[id]/page.tsx`, `students/[id]/page.tsx`, `lib/portal/data/dashboard.ts` |

**One thing I deliberately did not widen.** The absence streak that raises a follow-up case stays
Sunday-only. The church's rule is about missed Sundays, and quietly scoring it across every session
would change which children get a case — a pastoral decision, not a display fix. The profile now
computes the two separately and says so in the code.

Wave 14 verification: `tsc` clean · `npm test` **452** · `lint` clean · `build` compiles ·
`smoke` 126/126 · `smoke:write` 12/12 · `verify:ui` **197/197**.

### A test that passed for the wrong reason

The duplicate-case check reported "a second open case for the same student is refused" while
refusing nothing. It picked the student out of the dropdown by matching the visible label against
their first name, and this roster has more than one Adam — so it selected a different child, the
form succeeded for *them*, the seeded student's open-case count stayed at 1, and the count assertion
passed.

It only surfaced because a companion check ("and it says why") looked for the error message and
found none. Had the count been the only assertion, a green check would have been sitting over an
unverified guard.

Both halves are corrected: the option is selected by **value** (the student id), and **the error
message is now the primary assertion** with the count secondary — a count alone cannot tell a
refusal apart from a submit that never happened.

Two other harness fixes this wave, both mine:

- `save()` in `smoke:write`: last wave's rewrite replaced a fixed 2.5s settle with a button-enabled
  heuristic plus a 500ms fallback. For the one check given a database predicate that is an
  improvement; for every other save it cut the wait to a fifth and broke three checks that had
  nothing wrong with them. The fallback is back to 2.5s.
- The new-case title input carries no explicit `type` attribute, so `input[type="text"]` never
  matched it and the check hung for its full 30s timeout. Selected by id now.

Three checks were also silently skipping for want of data (point entries, servant attendance), which
would have left F0171, F0174 and F0291 asserted but unverified. They now seed a manual point entry
and two weeks x two activities of servant attendance, verify, and clean up — the same pattern the
exam checks use. That also buys assertions a bare render cannot make: that the profile ledger offers
Undo on an undoable row, and that the servant grid really groups columns by week (`th[colspan] > 0`)
rather than merely printing the heading.

## Wave 15 — triaged by a fan-out, then implemented (13 findings)

Before touching anything, 34 remaining HIGH findings went through a read-only agent fan-out: one
investigator per cluster re-checked each claim against the code as it stands after waves 11-14, then
an adversarial challenger per finding tried to refute the verdict and attack the plan. 43 agents.

**The challengers paid for themselves.** Four plans would have shipped defects:

- **F0005** — the audit's own suggested fix (`if (left <= 0) regenerate`) is an **infinite loop**:
  `left` is `useState(0)` and the countdown only fills it after mount, so every freshly minted code
  reads as expired for one render. It also would have re-minted a code a servant had just
  deliberately ended, and each mint writes a token row *and* an audit row.
- **F0795** — the plan's unit test asserted a deliberately non-exported const (untestable), and its
  name-only dedupe would violate the slug primary key for any class renamed since import, rolling
  back all fourteen behind a generic error. The challenger also spotted that F0795 **duplicates
  F0537**, so one fix closes two ids.
- **F0810** — the plan would not compile (`ReportLetterhead`'s `period` is required), and the roster
  it printed was built from servant memberships, so a class with **no servants never appeared** —
  exactly the coverage gap an admin prints a roster to find.
- **F0076** — `/portal/exams/new` 404s for a servant with no assignable class, so that tile needed
  its own condition or it was a dead link.

### Implemented

| ID(s) | What | Where |
|---|---|---|
| F0795, F0537 | **"Add standard grade classes"** — Pre-K to 12th in one press, skipping any that exist. Deduped on name **or** slug, because ids are bare slug primary keys and names are editable: a class renamed since the Firebase import still holds its old slug, and matching on name alone would pass the check then violate the key. The list and the pure "which are missing" function live in their own module so they can be unit-tested — a `use server` file may only export async functions. `type="button"`, since it sits inside the create/edit form and would otherwise submit it too. **+8 tests.** | `lib/portal/standard-grades.ts`, `lib/portal/actions/admin.ts`, `admin/classes/ClassManager.tsx` |
| F0005 | **QR codes regenerate.** "New code" threw away the classes and session already chosen; now **Regenerate** keeps them, and an expired code re-mints itself so a class still arriving is not staring at a dead square. Guarded three ways against the loop above: the condition is the stored `expiresAt`, not the countdown; a code ended on purpose stays ended; and it stops after three unattended cycles or while the tab is hidden, because every mint writes a token and an audit row. | `app/portal/(app)/qr/GroupCodePanel.tsx` |
| F0261 | **Lesson archive grouped by class, with the red "no lessons" flag** — the prototype's oversight signal. Counts come from a `groupBy`, not from the archive's own 200-row page: deriving "no lessons" from a capped list would paint the flag on a class whose lessons merely fell off the end. The class chips are plain links that rebuild the whole query, because `ClassPicker` pushes only its own param and would silently drop `view=archive`. | `lib/portal/data/lessons.ts`, `app/portal/(app)/lessons/page.tsx` |
| F0076 | **Quick actions for servants.** The prototype's tile grid lived in `svLoad` — it was the *servant's* block; the port had one admin-only pair and gave servants nothing. Each tile is gated on its destination being reachable for that user, so "Create a quiz" only appears for a servant who can actually author one. | `app/portal/(app)/page.tsx` |
| F0220 | **The agenda's three-mode strip is back** (This week / Weekly assignments / Archive), every tab carrying class and week so none is a dead link, and `view=archive` is a real parameter that renders the archive full-width rather than a no-op. | `app/portal/(app)/agenda/page.tsx` |
| F0673, F0848 | **"Delete all students in a class"** — the Danger Zone's missing fourth card. The port had only the church-wide end-of-year reset, so an admin retiring one class had nothing between one student at a time and wiping the lot. Same typed-confirmation pattern as its neighbours. | `lib/portal/actions/data-tools.ts`, `admin/data/DangerZone.tsx` |
| F0308 | **The whole church calendar is visible to everyone again** — the church's decision. Targeting still decides who an event is *for*, and therefore who may edit it; it no longer decides who may see that it exists. Both the events page and the dashboard's "next event" were opened, so they cannot disagree about what exists. | `lib/portal/data/community.ts` |
| F0043, F0548, F0554, F0558 | **Class logins & PINs — reset and print.** All four findings are the same thing: the prototype exported a plaintext PIN column, which is one of the four OG defects this restoration deliberately does not copy. PINs are bcrypt hashes, so no export can read them back. The church chose the substitute: mint a fresh PIN for every student in a class, show the sheet **once**, print it, store nothing readable. Typed confirmation, admin-only (one careless press locks a class out until the sheet is handed round), and every PIN hashed in parallel because bcrypt is CPU-bound. The sheet carries a "Given to" column, because it gets ticked off on paper as families collect. | `lib/portal/actions/admin.ts`, `app/portal/(app)/classes/[id]/credentials/` |
| F0214 | **Cross-class curriculum link, wired at last.** `curriculumLinkedToId` has ridden along in the schema since the import with nothing reading or writing it. Admin-only by the church's decision. A direct cycle is refused, since the agenda follows the link one hop and a pair pointing at each other has no source of truth. Deliberately **visible and manual** rather than silently swapping what a servant sees: the agenda shows whose plan it follows, links to it, and pulls that week across on request. No migration — the column is a bare id with no relation. | `lib/portal/actions/admin.ts`, `admin/classes/ClassManager.tsx`, `agenda/CurriculumLink.tsx` |

### Decisions the church made, recorded

- **PIN handout:** reset-and-print per class (above), not a plaintext export. F0043/F0548/F0554/F0558
  are closed by substitution, not by copying the OG.
- **Events:** everyone sees the whole calendar (F0308, implemented).
- **Announcements (F0271):** portal only — **deliberately not restored**. Announcements routinely name
  individual children, and the alternative needed a migration plus a world-readable flag. The audit's
  own verdict on this one was `refuted` in any case.
- **Curriculum link (F0214):** admin only (implemented).

Wave 15 verification: `tsc` clean · `npm test` **461** · `lint` clean · `build` compiles ·
`smoke` 126/126.

## Wave 16 — the rest of the triaged batch (6 findings)

| ID(s) | What | Where |
|---|---|---|
| F0810 | **Print Roster on Admin → Servants.** Built from **every active class**, not from servant memberships — a class with nobody assigned never enters the membership map, and a class with no servants is exactly the gap an admin prints a roster to find; it prints "No servants assigned" in red instead of vanishing. Unfiltered by the search box for the same reason: a filtered sheet looks complete. The sheet is its own plain markup because the on-screen groups are `<details>`, which print collapsed. Offered to the pastor too — printing is read-only. | `app/portal/(app)/admin/servants/page.tsx` |
| F0621 | **The Take / Weekly report / QR strip is back** across the three servant-attendance surfaces, which had zero links between them. `?mode=meeting` is now **parsed** — adding the link without wiring the parameter would have landed on Attendance and made the servant re-pick by hand, the same dead-parameter miss the QR Points entry had to go back and fix. A meeting code needs no class (it marks servants, not students), so the "no class to check in" wall no longer blocks a servant with no class from reaching it. | `app/portal/(app)/qr/page.tsx`, `servant-attendance/Tabs.tsx` + both pages |
| F0604 | **"Edit activity days".** `ServantActivity.dayOfWeek` has been in the schema and read by the reports since the port, but nothing could change it — if the servants' meeting moved from Friday to Saturday there was no screen for it. Name, day and whether it still runs, all editable. `update`, not `upsert`, so a typo in the key fails loudly instead of minting a phantom activity into everyone's grid. The link to it is **ADMIN-gated**, because the servant-attendance page it sits on is open to the pastor and every servant, and the target turns all of them away. | `lib/portal/actions/admin.ts`, `admin/sessions/ServantActivityEditor.tsx` |
| F0672 | **"Reset every class's point activities"**, church-wide. This is the prototype's "Reset Activities to Standard 6" **with an honest label**: the challenger established that the button's name did not describe what it did — the six "standard activities" are the attendance *sessions*, separate rows edited under Sessions & Points, and the button only ever deleted the custom point activities each class had defined. Shared church-wide activities are kept, and points already awarded are untouched (a PointEntry carries its own `activityLabel`). | `lib/portal/actions/data-tools.ts`, `admin/data/DangerZone.tsx` |
| F0002 | **Pick which QR cards to print.** It always printed every card in the class, so reprinting one lost card meant a sheet of thirty. Selection filters the printout while unselected cards stay on screen. The page had to be split: `qrcode` is server-only, so the QR data URLs are rendered on the server and handed to a client sheet. | `app/portal/(app)/qr/cards/{page,CardSheet}.tsx` |
| F0079 | **"Not checked in today", per student.** The dashboard tracked only whole classes with no register taken, so a class that was half-marked showed nothing at all — and the list a servant actually works down on a Sunday morning is of children, not classes. Any session counts as checked in (a child marked for Liturgy is plainly here), and the list is capped at twelve with a count, because an unmarked class would otherwise render its whole roster. | `components/portal/widgets/CheckInWidget.tsx` |

Wave 16 verification: `tsc` clean · `npm test` **461** · `lint` clean · `build` compiles ·
`smoke` 126/126.

## Wave 17 — the agenda import and the attendance confirm (3 findings)

| ID(s) | What | Where |
|---|---|---|
| F0217, F0594 | **The agenda CSV previews instead of writing on file-select, and names what it would destroy.** Two ids, one implementation, and the destructive half is the important one: `writeWeek` writes *every* activity — that is what makes clearing a field work — so an activity the file leaves empty is **cleared**, not left alone. A partial spreadsheet could silently blank a term of planning and nobody was told. The preview separates "replaced" from "emptied", lists the weeks affected, and says plainly why a gap in the sheet is destructive. The audit log now records how many filled activities an import replaced. | `lib/portal/actions/agenda.ts`, `app/portal/(app)/agenda/AgendaTools.tsx` |
| F0193 | **Attendance confirms before saving**, naming who gains points and **who loses them** — taking a student off PRESENT reverses the points that save gave them, which is the part nobody expects, and it happened silently. It flags an all-absent first save (almost always a mis-click, and it marks the day held against every student), and says "nothing to save" instead of a silent no-op. The rule is a tested pure function rather than counted inline, and the dialog renders through `createPortal`, per the trap that once left the follow-up composer's own controls unclickable. **+8 tests.** | `lib/portal/attendance-rules.ts`, `classes/[id]/attendance/AttendanceTaker.tsx` |

### Two defects in this wave's own work, caught by the browser pass

Neither was a type error, and neither unit tests nor either smoke suite would have found them.

- **The "Add standard grade classes" button was invisible.** It sat inside the "Add a class" Card,
  whose body is `hidden` until expanded — so the one button a brand-new church needs most was only
  findable by opening an unrelated form. Moved to the card header.
- **The attendance confirm fired on an untouched page.** I had correctly established that recording
  a student as absent *is* a change — it creates a row, and `heldOccasions` keys off row existence,
  so it marks the day held. Then I used that same rule to answer a different question. With no
  register stored, every student starts ABSENT on load, so "differs from storage" was true for the
  whole class before anyone touched anything. Two questions, conflated: *would saving change stored
  data* (yes) versus *has the servant touched anything* (no). "Nothing to save" means the second, so
  the gate is now a `dirty` check against the initial form state; the point-delta rule is unchanged.

Also a coverage hole worth recording: **neither smoke suite clicks "Save attendance"**, so this
confirm step would have shipped unverified on the most-used screen in the portal. `verify:ui` now
exercises it end to end — unchanged register says nothing to save, changing a mark opens the dialog,
the dialog escapes the page wrapper, it names the point change, and cancelling writes nothing.

Wave 17 verification: `tsc` clean · `npm test` **469** · `lint` clean · `build` compiles ·
`smoke` 126/126 · `smoke:write` 12/12 · `verify:ui` 220/220.

## Wave 18 — everything left that did not need a decision (9 findings)

| ID(s) | What | Where |
|---|---|---|
| F0338 | **Monthly Digest on the class page** — attendance, points, quiz average, new students and open cases, scoped to the month. The class's own stats are lifetime figures, which answer a different question: a class that was excellent last year and has slipped since looks fine on an all-time rate. Deliberately **outside every `canWrite` branch** — it is a read-only summary, and putting read-only things behind a write gate is how the print buttons got hidden from the pastor. | `lib/portal/data/class-digest.ts`, `classes/[id]/page.tsx` |
| F0793 | **Certificate generator** with the prototype's four wordings verbatim. Built as a **route, not a modal**: the portal's printable things are already routes, and it sidesteps the overlay trap that once left a dialog's own controls unclickable. Occasion, period and presenter live in the URL, so a servant can reopen the exact certificate they made. Offered to anyone on staff including the pastor — handing these out is precisely a pastor's job, and the header actions were restructured so read-only controls no longer sit inside the write gate. | `lib/portal/certificates.ts`, `students/[id]/certificate/` |
| F0804 | **Copy lessons one at a time.** Wave 11 fixed the empty-source-list half; the remaining half was that copying was all-or-nothing, and a class usually wants three lessons from another term rather than the whole year. The picker pre-ticks what this class does not already have and marks the rest "already here". Read access on the *source* is deliberately not required — the archive is open to every servant, and it is write access on the **target** that decides whether anything may be created; demanding `class.read` on the source would refuse exactly the servant this is for. | `lib/portal/actions/lessons.ts`, `lessons/LessonManager.tsx` |
| F0198 | **Recent-weeks strip on the attendance page**, each week expanding to name who was not in the room. The port showed one date and nothing around it, so a child quietly sliding away was invisible without opening four separate dates. **Excused counts as "not here" on purpose** — this answers *who was not in the room*, which is what a servant chasing a child is asking, and is a different question from the scored rate that drops excused absences from the denominator. The card says which one it is showing. **+4 tests.** | `lib/portal/reports.ts`, `classes/[id]/attendance/page.tsx` |
| F0077 | **The servant dashboard has its own stat row.** A servant was shown the admin's church totals — Classes / Servants / Students — which are not their job. Now: my students, quiz average (with best score and how many sat), and new students this month. Quiz figures were lifted out of the church-wide branch so a servant gets them for their own classes. | `lib/portal/data/dashboard.ts`, `app/portal/(app)/page.tsx` |
| F0802 | **Past meetings list on Servants Attendance.** Editing a past week already worked through the stepper; what was missing was any list of what had been held, so a coordinator had to step back through empty weeks to find the last meeting. Each row expands to who attended. Read-only and outside the write path, so the pastor — the role that wants the oversight view — sees it. | `lib/portal/data/servant-attendance.ts`, `servant-attendance/page.tsx` |
| F0805 | **Review before saving on QR scanning.** Every scan wrote immediately with only an after-the-fact Undo, so a mis-scan at the door was already a row in the register and a point in a child's ledger. A toggle queues scans instead — `resolveScan` identifies the card and writes nothing — and the servant removes mistakes before pressing Save. Off by default, because on a busy Sunday most servants want the card to mark the child as it is read. `resolveScan` keeps `scanStudent`'s exact permission check: without it, it would be a way to test which IDs exist in a class. | `lib/portal/actions/qr.ts`, `qr/ScanPanel.tsx` |
| F0319 | **Readings expand to the passage text.** The port showed the reference alone, so a child was told to read Ephesians 4 and left to find a Bible. The verses come from **the same coptic.io response the reference is derived from** — no second lookup, no new outbound dependency, and the exact Coptic pericope rather than a re-parse. Optional throughout, because rows cached before this change have no verses and must still render. | `lib/coptic-api.ts`, `lib/portal/data/community.ts`, `readings/page.tsx` |

Wave 18 verification: `tsc` clean · `npm test` **474** · `lint` clean · `build` compiles ·
`smoke` 126/126 · `smoke:write` 12/12 · `verify:ui` **231/231**.

### F0305 — nothing to migrate, and a finding that matters more

F0305 says the OG's historical events were never migrated because the importer has no path for the
`schedule` collection. The importer indeed has no such path — but the export in
`_incoming/sunday-school/data/stkyrillos_full_backup_2026-09-18.json` contains **zero schedule
rows**, so there is nothing to migrate and no shape to write an importer against.

Checking that file properly turned up something more consequential. Almost every behavioural
collection in it is empty:

```
users 348 · classes 12 · points 66 · agendas 3 · feed 3 · activities 3 · settings 2
attendance 1 · exams 0 · quiz_results 0 · schedule 0 · announcements 0 · visitations 0 · bible_reading 0
```

The export is stamped 2026-09-18. The church reported taking attendance in the old portal on roughly
2026-09-21 and supplied screenshots of six populated follow-up cases — follow-ups are the
`visitations` collection, which is empty here. **This snapshot predates the usage they were showing.**

So: the 348 accounts, 12 classes and 66 point entries came across; attendance history, exam results,
quiz results and follow-ups did not, because they were not in the file. No amount of importer work
changes that.

**Recorded as blocked on the church, not on code.** If they want that history in the portal, the
sequence is: take a fresh Firebase export, and only then build import paths for attendance, exams,
quiz results, visitations and schedule — against real rows rather than a guessed shape.

### A recurring trap in the verification harness, now fixed at the root

Four separate checks in `scripts/og-parity-verify-ui.mjs` were written against the *source* spelling
of a label and failed against working features, because this portal renders a great many labels
uppercase via CSS — `StatCard`, `Th`, section captions, the print letterhead. `innerText` returns
"CLASSES" where the JSX says "Classes".

Patched individually three times before the pattern was obvious. There is now a `textOf(locator)`
helper that normalises whitespace and lowercases, with a comment explaining why, so the next check
written cannot repeat it.

## Wave 19 — the church's three decisions

### F0292 — any servant may mark the team again (decided by the church)

The prototype had **no gate at all**: whoever ran the meeting marked the room. The port narrowed
that to coordinators, stage overseers and admins — defensible least privilege, but it meant that if
the person actually running Sunday was not flagged as a coordinator, nobody could record the team,
and every other row was simply dead to the touch.

Restored to the open rule, with one limit kept deliberately: **scope**. A servant may mark the
people their own grid already shows them — their classes, or the stage they oversee — not any
servant in the church. Marking yourself still works outside every scope, so a servant with no class
can record themselves. The rule is enforced in `canMarkServant`, not only in the page, so it holds
however the write arrives. The explanatory Callout added in Wave 14 is gone, because there is no
longer anything to explain away. **Tests updated** — the two that asserted the tighter rule now
assert the open one plus the surviving scope limit.

### F0018 — unchanged, by the church's decision

The OG treated `dueDate` as the quiz's date, so a future date locked it ("Opens 12 Oct"); the port
treats it as a deadline, available until then. The church chose **the portal's behaviour**, so
nothing changes. Recorded here so the difference from the OG is a decision on the record rather than
an open question — `tests/portal/exams.test.ts` already asserts it.

### F0305 — closed, no migration needed

The church confirmed there is no history in the OG worth carrying across, which matches what the
export actually contains (1 attendance row, 0 exams, 0 quiz results, 0 schedule, 0 announcements,
0 visitations). No importer work, and no fresh export required.

### F0075 / F0133 — Chart.js approved

The church chose Chart.js over a dependency-free SVG rebuild. Implementation follows.

## Wave 20 — F0075 / F0133, the dashboard charts

The church approved Chart.js. Before building, a read-only fan-out extracted every `new Chart(` in
the prototype, mapped each metric onto existing portal loaders, and planned the integration — then a
fourth agent tried to refute all three. That challenge changed what got built.

**What the challenge found:**

- **One of the "six" charts is dead code in the OG.** `new Chart(` appears at L1860, 1992, 2000,
  2044, 2064 and 2086, but the L2000 site has no canvas: both call sites pass `[]` and no
  `ad-chart-attendance` element exists anywhere. Building it would have been net-new design sold as
  parity.
- **A proposed chart sat on a page its audience cannot open.** The student's score chart was planned
  for `my-stage`, which does `if (!stage) notFound()` — a stage-coordinator page. A student 404s.
- **Class-scoped charts were planned for a page serving three roles.** `StaffHome` renders for
  SERVANT, ADMIN *and* PASTOR; a class-scoped trend means nothing to an admin with no class. This is
  the same servant/admin confusion this restoration already had to fix once.
- **Two loaders return newest-first** (`sessionTrend`, `loadMyServantHistory`), so a trend line would
  have been drawn backwards. The OG does `.slice(0,8).reverse()` for exactly this reason.
- **The bundle figures were presented as measured** when `chart.js` was not installed. Treated as
  estimates and measured properly after installing (below).
- **The print trap, which was the single most valuable item.** A `<canvas>` inside the
  `hidden print:block` idiom this app uses everywhere lays out 0×0 and prints an **empty rectangle**
  — and this portal prints report cards, rosters, QR sheets and church reports.

**Built — five charts, zero new queries, no new index:**

| Chart | Who sees it | Data |
|---|---|---|
| Attendance trend (line) | anyone who can open the class | `sessionTrend`, already in scope — reversed |
| Attendance trend (line) | servants only, behind `!churchWide` | `staffOverview`'s existing 28-day fetch |
| Average score by class (bar) | admin, pastor | `loadChurchReport` rows already rendered |
| Your score trend (line) | student, on **/portal/quizzes** not my-stage | `studentExams`, already loaded |
| Attendance by activity (bar) | servant-attendance report | `servantAttendanceReport.perActivity` |

**Dropped deliberately:** student growth (reconstructed from today's roster, so it can only ever
rise and every student carries the import date — honest and useless until real enrolments
accumulate); the church-wide attendance bar (the OG's dead canvas); follow-ups over time (no status
history to reconstruct from); per-exam average on the servant dashboard (`listExams.averagePercentage`
is not student-scoped, so a stage-wide exam averages the whole stage — a different number from the
one the OG drew).

**`PortalChart` handles the two things that make a chart honest here:**

1. **It prints.** The canvas is `print:hidden` and a plain table carrying the same numbers takes its
   place on paper. The chart is never the only copy of the data.
2. **It says what it measures.** Attendance means "who was in the room" on the class page and a
   scored rate that drops excused absences on the dashboard — the two legitimately disagree. Each
   chart carries the question it answers, and each reuses the rule already used by the numbers
   beside it, so no page contradicts itself.

Only the controllers actually drawn are registered — `chart.js/auto` would pull in every controller,
scale and plugin. `Filler` is required, not optional: the line charts use `fill: true`.

**Measured bundle impact** (`next build`, after installing): shared First Load JS **87.3 → 87.5 kB**,
so Chart.js is *not* in the shared bundle; the five pages that draw a chart carry roughly **50–65 kB**
more than comparable pages that do not. Chart.js loads only where a chart exists.

Wave 20 verification: `tsc` clean · `npm test` **474** · `lint` clean · `build` compiles ·
`smoke` 126/126 · `smoke:write` 12/12 · `verify:ui` **238/238** (7 new checks: the canvas draws,
it carries `role="img"` + an `aria-label`, the caption says what is being measured, the canvas is
**hidden under print media**, a `<table>` twin carries the same numbers onto paper, the seeded
attendance is cleaned up, and the admin dashboard does *not* show the servant-only trend).

---

## Wave 21 — the dashboard (first medium-tier wave)

Blockers and all 126 highs are closed. This is the first wave into the **medium**
tier, taken a page at a time rather than by finding number, starting with the
page every role opens first. Thirty medium findings sat on the dashboard.

### The audit's own fix for F0087 would have broken the portal

F0087 says: *"Add `app/portal/(app)/loading.tsx`."* That is the third audit fix
this restoration has had to refuse, after F0136's imaginary column and F0005's
infinite loop.

A `loading.tsx` covers its segment **and every route beneath it**. One placed on
`(app)` would put a Suspense boundary above `students/[id]`, `classes/[id]`,
`exams/[id]` and every other page that calls `notFound()` — and a boundary above
a 404 makes Next flush a **200** before the page component runs. This codebase
already carries a comment about that trap in `PageSkeleton.tsx`, written after it
once masked a permission regression. Taking the audit's wording literally would
have turned every permission refusal in the portal into a blank success.

The dashboard now lives in a `(home)` route group with its own `loading.tsx`.
Route groups add nothing to the URL, so the page is still `/portal`, and the
boundary covers that one page and nothing else. Verified in the build output:
`├ ƒ /portal`.

### Findings that were already closed

Four were re-checked against the current code rather than rebuilt: **F0693**
(topbar avatar dropdown — exists, `aria-haspopup="menu"` with the account menu),
**F0688** (My Profile nav item — `lib/portal/nav.ts:8`, in every role's list),
**F0695** (mobile bottom tab bar — `Shell.tsx`, five destinations plus More,
built in Wave 6) and **F0758** (Attendance Overview — already on the church-wide
dashboard). The audit's "Now: n/a" lines predate those waves.

| Finding | What changed | Files |
|---|---|---|
| F0087 | **The dashboard has a skeleton again**, shaped like what arrives — hero, five stat tiles, the quick-action row, the two-column body — and scoped by a route group so it cannot swallow a 404. See above. | `app/portal/(app)/(home)/{page,loading}.tsx` |
| F0357 | **Aggregate attendance is back on the dashboard, with the prototype's "vs last session" arrow.** A servant on three classes had a rate on each card and no number for all of them. `attendanceDelta` skips a session that could not be scored rather than reading it as zero — which would invent a collapse and then a recovery. **+3 tests.** | `lib/portal/reports.ts`, `lib/portal/data/dashboard.ts` |
| F0358 | **Exams stat tile** — total, with "N active" beneath. Active is `PUBLISHED` and not past its due date; the OG counted drafts too, which is a defect, not parity. | `lib/portal/data/dashboard.ts` |
| F0364 | **"Student reports" quick action** for servants and admins. Reports were in the sidebar but nowhere on the page a servant starts from. | `(home)/page.tsx` |
| F0365 | **"Not checked in today"**, shown only once somebody *has* checked in — before the first check-in, "nobody is here" is noise. The prototype counted a student as checked in if they had earned a point; this portal records real attendance, so either signal counts. Carries the OG's own caveat line verbatim. | `components/portal/widgets/ActivityWidgets.tsx` |
| F0081 | **"Top performing students"** — mean quiz percentage, minimum two quizzes, ties broken by who has sat more. The card says the minimum out loud, so a servant is not left wondering why a child they know did well is missing. **+5 tests.** | `lib/portal/reports.ts`, `ActivityWidgets.tsx` |
| F0082 / F0757 | **"Recent activity"** — the latest five point entries for a servant's classes, six church-wide for admin and pastor, with the prototype's own `timeAgo` ladder. **+4 tests**, including that a row written a few seconds ahead of this clock reads "just now" rather than "-1m ago": the server's clock and the database's are not the same clock. | `lib/portal/format.ts`, `ActivityWidgets.tsx` |
| F0369 | **Upcoming lessons shows three, not one**, with "View all" to the archive as the OG had. The port's own rule is kept: if this servant's own next lesson falls outside the three soonest it is pulled to the front rather than hidden behind two lessons somebody else is preparing. | `lib/portal/data/lessons.ts`, `LessonsWidget.tsx` |
| F0529 / F0756 | **"Average scores by class" is on the overview**, where the prototype drew it — not only on a reports tab that is not the default. The reports copy stays. Classes with no quiz sat are left out rather than drawn as zero. | `(home)/page.tsx` |
| F0088 | **The mobile bar is an identity bar again.** It showed the church's logo and name — which every page already says and which nothing could be done with. It now shows the signed-in person's photo or initials, their name and their role, and the whole card taps through to their profile. Church branding moved to the slide-out panel's header, on the way to the crest. | `components/portal/Shell.tsx`, `(app)/layout.tsx`, `lib/portal/{permissions,session}.ts` |
| F0089 | **The birthday chip counts servants too and renders for students.** A servant's own birthday is exactly the one colleagues would otherwise miss. It keeps the **page's** scope rather than the OG's church-wide scope on purpose: a church-wide chip over a class-scoped page would name someone the servant then could not find when they followed it. With nobody this week it says "None this week" instead of vanishing — a chip that disappears cannot be told apart from a chip that is broken. | `lib/portal/data/dashboard.ts`, `BirthdayChip.tsx` |
| F0689 | **Unread-quiz badge on the Quizzes nav item.** It counts the person's own unread quiz *notifications* rather than running a second query, so the badge and the bell always tell the same story and dismissing one clears the other. Costs no query: `loadNotifications` is already request-cached and already loaded by the bell. | `lib/portal/nav.ts`, `Shell.tsx`, `(app)/layout.tsx` |
| F0675 / F0676 / F0090 | **The student stat row is the prototype's again** — Quiz average (with the ↑/↓ arrow against their last quiz), Points (+N this month), Rank ("Top of the class" at #1), Pending — plus Sunday attendance as a fifth. The port had traded the two numbers a student actually asks about for a bare birthday count; birthdays keep their place but now name the person. | `(home)/page.tsx`, `lib/portal/data/dashboard.ts` |
| F0083 / F0677 | **"New quiz available"** — the prototype's 48-hour banner, linking straight to the quiz when there is only one. | `(home)/page.tsx` |
| F0080 / F0679 / F0681 | **The leaderboard card got its full treatment**: medals, avatars, a bar against the leader, a "View all", and the student's **own row appended below a divider when they are outside the podium** — previously a child ranked #7 saw three names and no sign of where they stood. | `(home)/page.tsx` |
| F0084 / F0682 | **"My progress"** — points against the leader, quiz average, attendance, together and each against what it is measured out of. The three numbers had been scattered across three pages. | `(home)/page.tsx` |
| F0683 | **"My score trend"** — the last eight quizzes as a line, through the same `PortalChart` that prints a table twin. | `(home)/page.tsx` |
| F0686 | **"Recent quizzes"** with the prototype's three-band score rings, kept **beside** the general points ledger rather than replacing it. | `(home)/page.tsx` |

### One definition of "pending", not two

The student's Pending tile and the Quizzes widget sit on the same screen. The
first draft of `studentOverview` re-derived "pending" with its own query and its
own rule; the widget uses `examStatusFor`, which also weighs `reopenedFor` and
`CLOSED`. Two rules on one page is how a tile ends up saying 3 while the list
below it shows 2. The tile now reads the same `studentExams` rows the widget
does, so they cannot disagree.

Likewise the "current streak" card reuses `presentStreak` — the function behind
the attendance badges — so the dashboard and `/portal/achievements` cannot
report different streaks.

### A test that was wrong before the code was

`topQuizPerformers`' first fixture gave Anba an 85% average over two quizzes and
Carol an 85% average over three, then asserted Anba ranked first. The tie-break
rule (more quizzes wins) correctly put Carol first. The test was testing two
rules with one fixture and had them backwards; the code was right. Split into
separate cases.

### Three of my own checks were wrong before the code was

The first Wave 21 browser run reported 258/258. Three of those checks were
weaker than their names claimed, and two more failed for reasons that were not
the product's:

- **`the stat row has five tiles`** searched the *page text* for "attendance"
  and "exams". Both words also appear on class cards, buttons and nav items, so
  the check would have passed with the stat row entirely empty. `StatCard` now
  carries a `data-stat` attribute and the check reads the tile labels; the same
  fix retired two more text-search checks on the student row. (The label also
  renders uppercase via CSS, which is the trap `textOf` exists for.)
- **`the identity bar carries a name and a role`** asserted the role reads
  "Administrator". `ROLE_LABEL.ADMIN` is `"Admin"` — the assertion named a
  label the portal never renders. The bar was right; the check was not.
- **`Top performing students`** printed *"fewer than two exams exist — skipped"*
  and counted as neither pass nor fail. A check that quietly does not run reads
  exactly like a check that passed. It now seeds the shortfall and removes it.
- **`student email persists`** failed twice in a row on a save path nothing had
  touched. It was not a product bug: the suite had been started eight seconds
  after an edit to `ui.tsx`, so the dev server was still recompiling, and the
  check's blind `waitForTimeout(2500)` made it a coin flip. Re-run on a warm
  server with no source changed, it passes. The check now waits for the
  navigation `StudentForm` actually performs instead of guessing a duration.
  (Running `next build` while `next dev` holds the same `.next` directory is
  the related trap — it strips the dev server's vendor chunks and every route
  starts 500ing. Restart dev after a build.)

Wave 21 verification: `tsc` clean · `npm test` **486** · `lint` clean ·
`build` compiles · `smoke` 126/126 · `smoke:write` 12/12 ·
`verify:ui` **267/267** (29 new checks, including seeded preconditions for all
three widget cards — each hides itself when it has nothing to say, so a check
that they are present proves nothing unless they are first given something to
say).

---

## Wave 22 — the student pages

Second medium-tier wave. The audit lists **38** medium findings across the
student roster, the All Students page and the student profile. Checking each
against the current code first, rather than building from the list, showed most
were already closed by earlier waves.

### Already closed — verified, not rebuilt

Bulk Edit and the bulk action bar (F0056, F0380, F0564–F0567), import
preview-before-commit (F0378), the CSV template (F0379), certificates (F0391),
the exam-results card (F0396), per-row Undo (F0398), the login ID on both the
roster card and the profile (F0390, F0569), the student's own email and phone
fields (F0382, F0383, F0561, F0562 — the schema **does** have the columns, the
audit's "schema has no such column" is wrong), roster search and Export CSV
(F0053, F0067-part, F0375, F0376), and the servants' own students page.

**F0065 / F0377 ("Export IDs & PINs") stay closed by decision, not by neglect.**
PINs are stored as `pinHash`. The prototype could export them because it kept
them in plaintext — one of the four defects §6 of ANALYSIS.md says not to carry
over. The replacement is the "Reset & print for a class" flow chosen earlier.

| Finding | What changed | Files |
|---|---|---|
| F0393 | **Avg score is back on the student profile.** `exams` was already loaded for the card below, so this is arithmetic, not another query — and it averages the same ten the card lists, because a stat over everything beside a card showing ten is two answers to one question. | `students/[id]/page.tsx` |
| F0392 | **The attendance stat breaks the misses down** — "8 of 10 · 2 unexcused". "8 of 10" alone cannot tell a servant whether the two gone were excused, which is the difference between a child who was away and a child who has stopped coming. An excused absence is already out of the denominator, so it is reported beside the rate rather than folded into it. | `students/[id]/page.tsx` |
| F0395 | **Bible reading streak card, with the Read-today badge.** `BibleReadingLog` has existed since the reading badges were built and nothing on the profile read it, so the one habit the portal asks a child to keep daily was invisible to the servant asking after them. Hidden until there is a reading to report: a card that always says "0 days" teaches people to skip it. Reuses `readingStreak`, so it cannot disagree with the badges. | `students/[id]/page.tsx` |
| F0068 / F0386 / F0387 | **Roster cards carry the quiz-average and streak pills again.** One grouped query for the class average; the streak is read off marks already loaded and scored on the **same headline session** as the attendance pill beside it, so two pills on one card cannot describe two different registers. The streak pill appears from two sessions up — "1w streak" is not a streak. | `classes/[id]/page.tsx` |
| F0062 / F0559 | **"Add a student to any class" is back on All Students**, with its own class chooser. The port made an admin open a class first, so adding a child meant knowing their class before starting. Collapsed by default, and the control is in the card **header** — Wave 15 already learned that a control inside a collapsed body cannot be found. The create form reuses the Class field the edit form already had rather than growing a second one; it defaults to "Choose a class…", because a student created with no class appears on no roster. | `admin/students/page.tsx`, `components/portal/StudentForm.tsx` |
| F0563 | **All Students search matches email.** See below — the parent-email half needed care. | `admin/students/page.tsx` |
| F0067 | **The roster filters as you type again.** Finding one child in a class of thirty cost a round trip per attempt. The cards stay **server-rendered** — they carry per-student figures that belong on the server — and are handed to the filter as nodes, so nothing about a card is duplicated into the client bundle. `?q=` remains the starting value, so an existing link to a filtered roster still opens filtered. | `classes/[id]/RosterFilter.tsx`, `classes/[id]/page.tsx` |

### The email search would have lied

`Student.parentEmails` is a Postgres array. Prisma's only predicate for a scalar
list is `has`, which is an **exact** match — so a partial query like `gmail`
returns nothing. On a page whose whole job is answering "is this child with
us?", a search that silently matches nothing is worse than a search that is not
offered: the servant reads the empty result as *no such child*.

The parent-email arm is therefore added **only when the query is a complete
address**; otherwise it is left out. The student's own email is an ordinary
column and uses `contains`, so partial search works there. Stored lowercased by
`toData()`, hence the fold before matching.

### Not restored — these need an explicit decision

- **F0399 — permanent delete of a single points row.** Undo exists and keeps the
  history; a permanent delete erases it. Destroying an audit trail of children's
  points is not a default to pick on someone's behalf.
- **F0571 — one-click inline Delete on the All Students card.** The bulk bar
  already deletes, behind a deliberate select-then-act step. A per-card delete
  button sits one mis-click from removing a child, and would make the page less
  safe than the prototype's, not more faithful to it.
- **F0069 — servants removing a student from their own class.** That changes who
  may alter enrolment, not just who may see it.
- **F0070 / F0384 — Street / City / State / ZIP as four inputs.** The schema has
  one `address` column, so this is a migration against live church data, not a
  UI change.

### A control that rendered and could not be pressed

The live roster search first shipped with its visible **Search** button replaced
by a screen-reader-only one plus a decorative icon. An `sr-only` button is 1x1
and clipped, so the card grid above it takes the pointer: `verify:ui` aborted
with *"div.lg:col-span-2 intercepts pointer events"*, and a person with a mouse
would have had exactly the same experience. A control that renders but cannot be
pressed is worse than one that is absent, because the page claims the feature is
there.

The button is visible again, and it is not redundant with the live filter:
submitting is what puts `?q=` in the URL, which is what makes a filtered roster
shareable, and it is the path for anyone without JavaScript.

### And a check that was a false pass by construction

`attendance names unexcused absences separately` was written as
`includes('unexcused') || includes(' of ')`. **Every** version of that hint
contains `" of "`, so the check would have gone green with the breakdown
missing — the exact failure mode called out three paragraphs above it in the
Wave 21 notes. The breakdown only renders when there *is* an absence, so the
check now seeds one and asserts on `unexcused` alone, then removes it.

Wave 22 verification: `tsc` clean · `npm test` **486** · `lint` clean ·
`build` compiles · `smoke` 126/126 · `smoke:write` 12/12 ·
`verify:ui` **285/285** (18 new checks; the attendance one was rewritten
afterwards and re-runs with Wave 23).

---

## Wave 23 — the agenda

Third medium-tier wave. Twenty-one medium findings on Lesson Preparation.

**Two were already closed:** F0589 and F0493 (assigning a servant from another
class) were the blocker **F0215**, fixed in Wave 1 — `agendaServantOptions`
returns `{ onClass, others }` and the editor renders both groups.

| Finding | What changed | Files |
|---|---|---|
| F0588 / F0222 | **The Agpeya row is a dropdown again** — the prototype's six hours (1st, 2nd, 3rd, 9th, 11th, 12th). As free text, "3rd" and "Third" and "3rd hour" were three different answers to one question and nothing downstream could group them. A value already saved that is not one of the six is offered as an extra option rather than silently dropped on the next save. | `lib/portal/agenda.ts`, `agenda/AgendaEditor.tsx` |
| F0226 | **Weeks are named the way the church names them** — "3rd Week of OCT", not a date range. See below for the judgement this needed. **+16 tests.** | `lib/portal/agenda.ts`, `lib/portal/data/agenda.ts`, `agenda/page.tsx` |
| F0591 | **The archive searches the saved topics** ("Search lessons, saints, verses…"), which is how a servant looks for a week: *when did we do St. Moses?*, not *what was the week of the 14th?*. With the box empty the month accordion is untouched; typing replaces it with a flat list, because a match buried inside a collapsed month is not a search result. | `agenda/ArchiveSearch.tsx`, `lib/portal/data/agenda.ts` |
| F0218 | **The archive lays out the whole school year**, not only the weeks already saved. A future week was reachable by URL and by the date picker but appeared nowhere in the overview, so a servant planning ahead could not see what was left to fill. Weeks saved *outside* this school year are kept rather than vanishing from their own archive. | `agenda/page.tsx` |
| F0593 / F0223 | **Blank template CSV.** A class with nothing saved has nothing to export, so there was no way to get a year to fill in offline. Emitted in the **importer's own shape**, with a test that round-trips it through the real parse pipeline — a template whose columns differ from the importer's is a file that cannot come back, which is exactly the trap F0216 describes. **+4 tests.** | `lib/portal/agenda.ts`, `agenda/AgendaTools.tsx`, `agenda/page.tsx` |
| F0224 | **"Open" beside the slide link in the editor.** It existed on the read-only views but not for the person editing — who is the one with the deck open in another tab. Offered only once the field holds an http(s) address, so it cannot become a link to nowhere. | `agenda/AgendaEditor.tsx` |
| F0225 / F0595 | **The week sheet has its own class and week choosers.** It was reachable only by arriving from the schedule with both parameters already set. Deliberately **not** built on `ClassPicker`: that writes `?class=` alone, which would drop `week` and send every choice to the current week — the same dead-link shape this restoration has hit before. | `agenda/week/WeekSheetPicker.tsx`, `agenda/week/page.tsx` |

### Naming a week that belongs to two months

The prototype listed a week straddling two months under **both** of them —
Mon 28 Sep–Sun 4 Oct was "5th Week of SEP" *and* "1st Week of OCT". That is fine
in speech and wrong for a dropdown keyed by Monday: two options would carry the
same value.

The first fix simply dropped the duplicate. A test written for it caught what
that costs: with the September copy kept, **October had no first week** — its
numbering began at "2nd". Weeks are now assigned to the month containing their
**Thursday**, the ISO rule, which matches how a week reads (Mon 31 Aug–Sun 6 Sep
is the first week of September, not the fifth of August) and leaves every month
numbered 1..n with no gaps. Two tests hold that: every month starts at 1st, and
each month's ordinals run consecutively.

### A fixed wait reported a working link as broken

`full-year view loads` failed three times in a row on the birthdays page. The
link was fine: the check clicked it and then slept 1500ms, which is not enough
for the dev server's **first** compile of `?show=all` after a `.next` wipe.
Proved by driving the same flow by hand — the URL changes, the page says "across
the whole year", the way back is offered — and the check now waits for the
navigation rather than a duration. This is the third fixed-timeout check in this
file to be caught doing the same thing; `waitForURL` is the pattern.

### Still open in this cluster

- **F0216 — prototype-era schedule exports cannot be imported.** The CSV changed
  from one row per week (wide) to one row per week *and activity* (tall). Either
  a legacy-shape detector, or the church retypes a year by hand. Worth a
  decision rather than a default.
- **F0221 / F0490 / F0585 / F0586 — bulk week selection and "Clear Selected
  Weeks".** Needs a new multi-week destructive action; clearing several weeks at
  once deserves the same typed-phrase treatment the other bulk operations got.

Wave 23 verification: `tsc` clean · `npm test` **506** · `lint` clean ·
`build` compiles · `smoke` 126/126 · `verify:ui` **296/299** — all 13 new agenda
checks pass; the 3 failures are the birthdays timing described above, fixed and
re-running with Wave 24.

---

## The verification sweep

Before building further, all **566** open medium/low findings were re-checked
against the current code by 12 read-only agents, each shadowed by a challenger
whose job was to **refute** its "already built" claims. Results in
`.audit/sweep-results.json`.

| verdict | n |
|---|---|
| MISSING | 267 |
| PARTIAL | 132 |
| ALREADY_BUILT | 133 |
| NOT_APPLICABLE | 33 |

**The challengers overturned 32 claims** — 24% of everything a verifier called
already-built. That is the whole reason the second stage existed: a wrong
ALREADY_BUILT silently drops a real gap from the church's backlog, while a wrong
MISSING only costs somebody a second look. The verifiers were told to answer
MISSING when unsure, so the asymmetry is built into the method rather than left
to judgement.

A representative overturn, F0511: the verifier found `?show=all` widens the
birthday window to 366 days and called it built. The challenger read the OG
section and found the prototype's roster was **always on**, not behind a query
parameter — placement again, not existence.

So the real remaining work is **399 findings**, of which 296 are trivial/small
and 52 need a decision from the church rather than a default from me.

---

## Wave 24 — the light tier, batch one

| Finding | What changed | Files |
|---|---|---|
| F0108 / F0247 / F0788 / F0789 / F0790 | **Sidebar badges for every destination, not just Quizzes.** `withQuizBadge` became `withNavBadges`, matching on each notification's own `href` — so a new notification kind gets its badge for free and no href can be badged that the nav does not contain. Badges count **what a notification stands for** (twelve open cases) rather than how many notifications there are: a "1" beside Follow-ups while twelve children wait is worse than no badge. Costs no query — `loadNotifications` is request-cached and the bell already loads it, so badge and bell can never disagree. **+6 tests.** | `lib/portal/{nav,notifications}.ts`, `(app)/layout.tsx` |
| F0169 | **"Academic Year" is back in front of the year label.** Without it the topbar showed a bare pair of years under the church name, reading as a date rather than as the year the portal's figures belong to. | `lib/portal/format.ts` |
| F0168 | **The desktop topbar shows the person's photo and full name.** The column and the uploader have existed since `/portal/photo` was built; this was the one place that never read it. A first name alone is ambiguous in a church with several Minas. | `components/portal/Shell.tsx` |
| F0154 | **The sidebar crest shows the person, not the church logo.** Their name and role were already underneath it, so the logo was the one element in that block saying nothing the rest did not. Falls back to the logo. | `components/portal/Shell.tsx` |
| F0233 | **Hymn lyrics open independently.** An exclusive accordion closes the hymn you were comparing against the moment you open the next one — which is exactly what comparing two tunes needs. | `hymns/HymnManager.tsx` |
| F0232 | **"Add a hymn" in the empty state.** Telling somebody to add the first hymn without offering the way to do it sends them hunting for the panel. | `hymns/HymnManager.tsx` |
| F0235 | **The silent 300-row hymn cap raised.** A book that stops at 300 gives no sign it has stopped, so a hymn that exists reads as one never added. | `hymns/page.tsx` |
| F0238 | **The Tasbeha.org card has its icon tile back** — without it the strip reads as a paragraph rather than a card you can act on. | `hymns/page.tsx` |
| **F0109** | **Resolving a case now records the closing conversation.** The reason was written onto the case but nothing went onto the timeline, so the conversation that actually closed a case was missing from that case's own history. Written in one transaction with the status change: a resolved case with no record of why is the thing this page exists to prevent. | `lib/portal/actions/followups.ts` |
| F0110 | **Closing a case starts blank and "Other" must say something.** "Attending again" was pre-selected, so the happiest possible outcome was one click from being recorded for a child nobody had spoken to. Enforced on the server as well as the form. | `lib/portal/actions/followups.ts`, `follow-ups/[id]/CaseActions.tsx` |
| F0117 | **Resolve reasons and contact methods read as the church says them.** A pastor was shown `attending again` and `lost interest` — raw database values, lowercased, in a report about a child. **+7 tests**, including that an unrecognised value is title-cased rather than dropped: a case closed before this list existed still has to read as something. | `lib/portal/followups.ts` (new), both follow-up pages |
| F0111 | **The latest contact note is on the list row**, so nobody repeats the call that was made yesterday. | `follow-ups/page.tsx` |
| F0114 | **"Last seen" is on the row** — the number a servant opens the phone call with. Says "No attendance recorded" rather than going blank. | `follow-ups/page.tsx` |
| F0112 | **Open cases are ordered worst-first.** Oldest-first is *nearly* worst-first and quietly is not: a child who missed six Sundays last month sat below one who missed two last year. Ordered by missed Sundays, age as the tiebreak. | `follow-ups/page.tsx` |
| F0121 | **The list says when it has stopped.** The tiles counted every case; the list stops at 200. A church with 250 open cases read "250" over a list of 200 with nothing saying 50 children were not on it. | `follow-ups/page.tsx` |
| **F0312** | **The add-event form no longer renders inside the maroon banner.** `EventManager` was passed as `PageHeader`'s `actions`, and that slot renders *inside* the dark header — so opening "Add event" drew the whole form, labels and inputs and checkboxes, on burgundy. The trigger and the form share one piece of state, so the component moved out of the banner rather than being split in two. | `events/page.tsx` |
| F0317 | **A native time picker for events, without destroying what is already stored.** Event times are free text — "6:00 PM", "after liturgy", "6:00 PM - 8:00 PM". A bare `type="time"` silently blanks anything it cannot parse, so `toTimeInputValue` reads what it confidently can and returns null otherwise, and those keep the text box. **+6 tests**, including that midnight and noon survive the 12-hour clock and that unparseable text is never coerced. | `lib/portal/format.ts`, `events/EventManager.tsx`, `events/page.tsx` |
| F0599 / F0600 / F0627 / F0628 | **Per-column "All" and "Clear" on the servant grid.** Marking a dozen servants present one cell at a time is the most repetitive thing on this page and it happens weekly. Only cells this user may write are touched, and only cells that actually change are marked dirty — so "All" on a complete column does not manufacture an empty save. Hidden entirely when the viewer may write to nobody. | `servant-attendance/ServantGrid.tsx` |

### Deliberately not built in this batch

- **F0167 — sticky page header on phones.** The header is a tall maroon banner
  and the phone already carries a sticky identity bar and a bottom nav; making
  it sticky could eat half a small screen. This is a design judgement on the
  surface servants actually use on a Sunday, not a gap to fill blind.
- **F0234 — allow two hymns to share a title.** The block is a deliberate,
  commented application rule, not an oversight. Reversing a documented safeguard
  to match the prototype is the church's call.
- **F0237 — require lyrics when adding a hymn.** Adding a validation rule blocks
  a servant who knows only the title. The finding is also flagged unverified.
- **F0629 — link a servant's name to their profile.** The only servant profile
  route is admin-only, so linking it for everyone would 404 for the servants it
  is meant for. Needs a role-aware href threaded from the page — correct, but
  not a one-line change.

Wave 24 verification: `tsc` clean · `npm test` **525** (+19) · `lint` clean ·
`build` compiles.

---

## Wave 25 — the light tier, batch two

| Finding | What changed | Files |
|---|---|---|
| **F0142** | **The "Church reports" tab no longer lies to a servant.** Report Cards offered it to everyone, but a plain servant has no church-wide scope — so `?tab=church` quietly fell back to Attendance: the tab looked like somewhere they could go and then pretended they had never clicked. Gated on the same `churchReportScope` the Reports page itself uses, so the two pages agree. | `reports/cards/page.tsx` |
| **F0137** | **Printing knows what shape the paper is, and stops clipping.** The real defect was not the missing `@page` rule but `TableWrap`: it scrolls horizontally on screen, and an overflow container **clips** on paper — a twelve-week attendance grid printed however many columns happened to fit the viewport, with the rest simply gone and nothing saying so. Print now unclips every scroll container, and a named `@page landscape` lets the wide grids ask for landscape while report cards, QR sheets and rosters stay portrait. | `app/globals.css`, `reports/page.tsx` |
| F0428 / F0429 | **Report cards carry a class header and three class-level figures** — Total students, Avg points, Total points. A stack of cards gave no sense of the class as a whole and a pastor had to add them up himself. Suppressed on a single child's sheet, where the class totals are somebody else's data. | `reports/cards/page.tsx` |
| F0432 | **"This card only" on each card.** The only route to one child's sheet was through their profile, so a servant printing for three families left the page three times. | `reports/cards/page.tsx` |
| F0139 / F0441 | **The twelve school-year month pills are back.** A native month input is three interactions to reach October and gives no sense of the year; the pills are one tap each and match how the church talks about a year that starts in September. The input stays for anything outside it. **+4 tests.** | `lib/portal/reports.ts`, `reports/ReportFilters.tsx`, both reports pages |
| F0251 / F0243 | **Servants appear in the birthday week cards**, suffixed "(servant)". They had sat in a separate card at the foot of the page, so a servant whose birthday fell this Sunday was invisible on the one card the church actually reads. Their tiles carry **no link**: a servant id in the `/portal/students/` route would 404, or open an unrelated child. | `birthdays/page.tsx` |
| F0250 | **A birthday that is today says so** — "🎉 Today" and a gold badge. Nothing distinguished the one day the card exists to catch. | `birthdays/page.tsx` |
| F0508 | **The week cards name their seven days.** "This week" on a Sunday is ambiguous exactly when it matters most. | `birthdays/page.tsx` |
| F0511 | **The whole roster in date order is always on the page**, collapsed, rather than living behind `?show=all`. This was one of the 32 challenger overturns: a verifier found the 366-day window and called it built; the challenger read the OG and found its roster was *permanently rendered*. The students are already all loaded and `upcomingBirthdays` filters in memory, so it costs no extra query. | `birthdays/page.tsx` |

### A check that only failed after 8pm

`and it marks today as read` failed on a feature that was fine. The check seeded
a `BibleReadingLog` with `new Date().toISOString().slice(0,10)` — the **UTC**
date — while the page asks `todayInNewYork()`. At the time of the run UTC was
already 2026-09-23 and the church was still on 2026-09-22, so the check wrote a
reading for *tomorrow* and then asserted the page called it today. It would have
passed every morning and failed every evening.

Fixed at the root rather than at the call site: a `churchToday()` helper, and all
**seven** seeded dates in the suite now use it. Three of the others — the exam
due date, the attendance month prefix, the wrong-date guard — carried the same
latent bug and would have surfaced later as mystery evening failures.

Wave 25 verification: `tsc` clean · `npm test` **529** (+4) · `lint` clean ·
`build` compiles · `smoke` 126/126 · `smoke:write` 12/12 · `verify:ui`
**299/299**.

---

## Wave 26 — the light tier, batch three

| Finding | What changed | Files |
|---|---|---|
| **F0281** | **The student's "new announcement" notification goes to the announcements.** It pointed at `/portal` — the page the student is already standing on when they open the bell. Tapping the alert about a new announcement did nothing visible at all. | `lib/portal/notifications.ts` |
| **F0280** | **Daily Readings is in the admin and pastor sidebars.** Every other role could reach it; the two who read at the altar could not. Checked the page has no role gate before adding the entry — a nav item that 404s is the trap this restoration keeps finding. | `lib/portal/nav.ts` |
| F0275 | **Pin checkbox in the post composer.** `createPost` has always accepted `pinned`; only the checkbox was missing, so the one thing a servant wants when posting "no class this Sunday" took a second action on the card afterwards. Edit deliberately leaves it alone — changing a pin has its own control, and `UpdateSchema` omits the field. | `feed/FeedComposer.tsx` |
| F0278 | **"Class posts" on the class profile.** A servant asking "what did we post to this class?" had to go to Posts and pick the class again. `/portal/feed` validates `?class=` against the viewer's own classes and falls back, so this cannot become a dead link; read-only, so it sits outside the write gate. | `classes/[id]/page.tsx` |
| F0273 | **Tag chips on the feed.** `tag` already rode on every post; nothing let anyone filter by it, so finding "that resource link from a month ago" meant scrolling the whole feed. Only tags that actually appear in this feed get a chip, so no chip ever filters to nothing, and the empty state offers the way back. | `feed/page.tsx` |
| F0276 | **The feed says when it has stopped.** It ended at 40 posts silently, so older ones were both unreachable *and* unmentioned. There is still no paging — but the page no longer pretends 40 is all of it. Third instance of this pattern after the hymn book and the follow-up list. | `lib/portal/data/feed.ts`, `feed/page.tsx` |

### Not built — a deliberate redesign, not a regression

The **achievements** cluster (F0187, F0727–F0741 — 14 findings) is not light work
and is not mine to close. The sweep's own notes say the badge and level ladder
were **deliberately re-themed**: "Quiz Pro (3 quizzes)" became "Scholar
(5 quizzes)", thresholds moved, and `faithful` was re-pointed from a lifetime
count to a 3-in-a-row streak. Restoring the prototype's ladder would change what
every child in the church has already earned. That is the church's call.

### Two more of my own checks, and why the second failure was the good kind

`the topbar says "Academic Year"` failed reading the text "notifications".
`page.locator('header')` matches every `Card` header and the notification
dropdown as well as the topbar, and `.first()` picked one of those. The label was
never wrong — proved with a unit test on `academicYearLabel` rather than by
adjusting a selector and declaring victory. The locator now filters on the header
that actually contains the church name. **+3 tests.**

The feed-chip and case-resolve checks had been printing
*"(no posts — skipped)"* and *"(no open case — skipped)"*, counting as neither
pass nor fail — the same dead-check pattern called out in the Wave 21 notes and
then allowed to recur twice. Both now seed their own precondition and assert the
cleanup.

That change paid for itself immediately: the seeded post failed on
`FeedPost.authorName`, which is required and denormalised so a post still names
its author after the account is `SetNull`'d. The old version of that check would
have printed "skipped" and gone green. **The new one said "feed still empty" and
failed** — same condition, but one version hides a gap and the other reports it.

Wave 26 verification: `tsc` clean · `npm test` **532** (+3) · `lint` clean ·
`build` compiles · `smoke` 126/126 · `verify:ui` **319/319** (20 new checks
across waves 24-26; two of them were previously dead).

---

## Wave 27 — the light tier, applied from machine-written specs

Ten read-only agents were given the 241 remaining light findings (achievements
excluded, see Wave 26) and asked for **ready-to-apply change specs** rather than
prose: `{file, anchor, replacement, extra_imports, risk, check}`, with
`feasible: false` and a reason for anything needing a migration, reversing a
recorded decision, destroying data or widening scope. They returned **141
feasible specs**; 138 anchored exactly against current source.

**Applied: 136 findings.** Two were quarantined and 34 turned out to be the same
capability filed two or three times over.

### The duplicates are the story

Eleven findings collapsed into four features. Three separate findings (F0141,
F0206, F0394) each asked for a present-streak tile on the student profile, with
three different labels, two different icons and **two different `presentStreak`
implementations** — one from `lib/portal/achievements`, one from `lib/portal/qr`,
with incompatible argument shapes. Applying all three would have put three tiles
on one row computing the same number two different ways. It is now one tile,
scored with the same call the class roster already uses (F0387), so the number a
servant reads before ringing a family and the `6w streak` pill on the roster
cannot drift apart.

Likewise F0272/F0503 (one YouTube preview), F0119/F0463 (one donut), F0100/F0774
(one WhatsApp link), F0024/F0483, F0520/F0521/F0751 (one readings regrouping),
F0611/F0644 (one profile strip), F0180/F0412 (one profile link on a points card).

### Two agents contradicted each other, and one of them was right

F0272 and F0503 both rendered the YouTube still as a raw
`<img src="https://img.youtube.com/...">`. F0768, working on the events page,
had explicitly warned **not** to: the portal's own CSP is `img-src 'self' data:`
(next.config.js:18), so that markup is blocked outright and renders as a
broken-image box — worse than the grey pill it replaced. The thumbnail has to go
through `next/image`, which re-serves it from `/_next/image` on this origin.

Both call sites now share `lib/portal/links.ts` (`youtubeId`, `youtubeThumbnail`)
— they had independently written the regex twice with different URL shapes, so a
`/live/` link previewed in the feed and not on the events page. **+4 tests.**

### The spec agents missed a middleware gate, and the browser check found it

F0279 adds an Announcements row to a child's sidebar. Its author checked the
page's own gate (`announcements/page.tsx` calls only `requirePortalUser`) and
declared it safe. It was not: `/portal/announcements` was listed in `STAFF_ONLY`
in `lib/auth.config.ts`, so **the middleware bounced every student before that
page ever ran.**

And it had been bouncing them already — F0281 pointed the student announcement
notification at `/portal/announcements` in an earlier wave, which has been a dead
end ever since. F0092's author found the same thing independently and worked
around it by deleting the link.

Fixed at the root instead: the route is open to students, because
`listAnnouncements` already scopes a non-`seesEverything` viewer to church-wide
notices plus their own class and stage, and `canCreate` is false for them.
`tests/portal/nav-reachability.test.ts` now holds it open — **42 new tests** that
walk every sidebar, phone bar and avatar menu for all four roles and assert each
row both resolves to a real `page.tsx` **and** survives the middleware. It was
checked by re-adding the entry: two tests fail.

This is the fourth time trap 4 has bitten. Checking the page component is not
enough; the middleware runs first.

### `nav.ts` was rebuilt rather than patched

Fifteen specs targeted this one file and four pairs overlapped, because six of
them rewrote whole role branches. Merging string patches would have been
guesswork, so all four role rails were rebuilt in one pass, checked line by line
against the prototype: the servant's seven groups (F0157/F0160/F0161/F0253/
F0264/F0328/F0425), the pastor's six flat rows (F0165), the student's four
(F0164/F0039/F0236) and the admin's single "Settings" heading (F0151/F0667).

Verified against `index.stripped.html` rather than trusted: L11585-11605 confirms
a child's rail said **"Daily Quiz"** and **"Today's Reading"** — the words printed
on the sheets servants hand out — and L19123-19128 confirms the pastor's six.

Adding `/portal/reports/cards` beside `/portal/reports` exposed a real defect the
spec author had noted and shrugged at as a "known wart": `Shell`'s `isActive` is
prefix-based, so standing on the cards page lit **both** rows and neither looked
like the page you were on. Now resolved to the most specific match, per list.

### Real defects fixed on the way

- **F0204 — the register contradicted the number beside it.** A column exists
  only because somebody was marked that day, so a student with no row was absent,
  not "not marked". The absence count already said 2 while the grid printed an
  empty box. On a QR Sunday — where `actions/qr.ts` writes a row only for the
  children who scanned — that was *every child who did not scan*, so a printed
  sheet read as a servant who never took the register.
- **F0839 — a class photo could be set but never cleared.** `setClassPhoto` had
  shipped with no counterpart, so an admin who uploaded the wrong picture had no
  way back. Added `removeClassPhoto`.
- **F0092 — `latestAnnouncementFor` became dead code** and was deleted rather
  than left looking live.
- **F0785/F0786 — the birthday window.** The bell used seven days rolling from
  today while `/portal/birthdays` used the church's Mon–Sun week, so on a
  Thursday the two named different children. Both now use the church week.

### Three tests were wrong before the code was

`npm test` went red three times in this wave, and each time the **test** was
describing the old behaviour:

- two notification tests encoded the rolling 7-day birthday window;
- one matrix test asserted `marks: ['ABSENT', null]` — the blank cell F0204
  exists to remove, on a row whose own `absent` count already said 2.

All three were rewritten to state the new rule and to fail under the old one,
rather than having their expected values flipped.

### Held back deliberately

- **F0022** — a bulk delete/reopen bar for exams. Gated on page-level
  `canWrite`, so a servant with write on one class could tick an exam belonging
  to another; the server refuses per id, so the worst case is a refusal rather
  than a wrong delete, but it is a destructive bulk control nobody has asked for.
- **F0177** — scoping points totals per class. Its own author noted that totals
  and ranks would drop for any student who has changed class, and that the
  report-card query is a separate `groupBy` that would **not** change, so a
  report card and a leaderboard could then disagree about the same child.

The other ~100 specs came back `feasible: false` for stated reasons that hold up:
most need two or more files, and several would leave a control on screen that
does nothing. Those are not decisions — they are simply not one-anchor edits.

### Four of my own checks were wrong, and one of them found a real defect

The wave-27 browser block failed four checks on its first run. None was a broken
feature; all four were faults in the checks — but fixing the first properly
uncovered something real.

**The real defect.** The check asserted that exactly one sidebar row is marked
current, and got **zero**. An admin's "Church Reports" row is
`/portal/reports?tab=church`, and `Shell`'s match compared the whole href string
including the query — so an admin standing on `/portal/reports` had no row
highlighted at all and the rail could not say which page they were on. Matching
is now on the href's path, and `mostSpecific` ranks on the path too, so
`?tab=group&mode=points` cannot out-specific a genuinely deeper route like
`/portal/reports/cards`.

**The three bad checks**, fixed rather than loosened:

- it signed in as an **admin** to test the two-report-rows case, which only
  exists on the servant rail;
- `clsBody.includes('most active student') || clsBody.includes('no points')`
  accepted either outcome, so it would have passed with the card never built. It
  now aggregates that class's `PointEntry` and asserts the card is present *iff*
  somebody has points;
- the dashboard announcement check asserted a card that cannot render without
  notices to show, and nothing had seeded any. It now seeds three, proves at
  least two appear (the one-item version cannot pass), and asserts the cleanup.

That last one is the third recurrence of the pattern in these notes: **a check
whose precondition nobody seeded reports a working feature as broken**, the
mirror image of the "(skipped)" checks caught in Wave 26. Both hide the truth;
they differ only in which direction they lie.

Wave 27 verification: `tsc` clean · `npm test` **587** (+55) · `lint` clean ·
`build` compiles · `smoke` 126/126 · `smoke:write` **16/16** (+4, the composer
confirmation) · `verify:ui` **352/352** (+33 checks).

The dev server was stopped before `npm run build` and restarted with a clean
`.next` afterwards — they share that directory, and a build strips the dev
server's vendor chunks until it restarts.

---

## Wave 28 — the multi-file light tier

The 100 specs Wave 27's agents returned as `feasible: false` were not decisions;
they were the ones needing two or more files. Working through them by hand.

**Triage first, because a third of them were not work at all.** Of the 100:

- **6 were already built** under another finding's id and verified as such:
  F0829/F0747 (feed tag chips, Wave 26), F0454 (the follow-ups nav badge),
  F0464 (worst-first case ordering), F0203 (school-year month pills), F0287
  (the servant grid's per-column All/Clear). Checked against the source rather
  than taken on the agents' word — the Wave 26 sweep overturned 24% of such
  claims — and all six hold.
- **5 more were closed by Wave 27 itself:** F0160, F0161 and F0253 were all
  built by the `nav.ts` rebuild, F0482 by F0034 and F0488 by F0037.
- **10 were correct refusals**, kept with their reasons: F0283/F0310 (moving a
  composer into a header reintroduces F0312's bug — the form renders inside the
  maroon banner), F0167 (a third sticky band on a phone), F0234/F0237 (reverses
  documented validation decisions), F0498 (would widen who sees children's
  birthdays), F0072/F0143/F0779 (premise stale, or the OG code had no call
  sites), F0416 — a chime on every points award, with no mute setting anywhere
  in the portal, playing during prayer time.
- **3 more went to the church's list** (now 57): F0301 (auto-check-in on QR
  scan turns a page load into a write, and Next prefetches links), F0335 (what
  "the class's attendance rate" means), F0631/F0299 (a meeting title needs a
  column).

### Built

- **F0153 — the class photo had nowhere to appear.** Wave 27 wired the upload
  control (F0839); this finding is the other half, and it is the one that
  mattered: *nothing in the portal rendered `SchoolClass.photo`.*
  `listVisibleClasses` and `requireClassAccess` did not even select the column.
  A servant would have set a photo, seen the preview, and never found it again —
  the silent dead feature the spec author warned about. The column is now carried
  through both queries and drawn on the class cards (dashboard and
  `/portal/classes`) and in the class page's own header, with the coloured tile
  still the fallback. A data URL is fine here, unlike the YouTube case: the CSP
  is `img-src 'self' data:`.
- **F0179 / F0410 — the leaderboard could only be read one way.** Fixed on rank,
  the grid answers "who is winning?" and nothing else: finding a child by name in
  a class of thirty meant reading every tile, and "who has fallen behind?" — the
  question that leads to a phone call — could not be asked. Highest / Lowest /
  A–Z. The rank badge and medals stay tied to the child's real standing, so
  reordering never changes what a card claims, and "Select all" still acts on the
  whole class rather than the visible order.
- **F0415 — a real bug, and a costly one.** Remove mode had no amount field, so
  `magnitude` fell through to whichever activity was still selected in Add mode.
  A servant who had just given "Memory verse (5)" and switched to Remove was
  about to take five points off a child, with nothing on screen saying so.
  Remove now reads its own field, defaulting to 1.
- **F0159 — "QR Points" promised one flow and delivered the other.** The nav
  entry pointed at `?tab=group&mode=points`, the projected group-code generator,
  where the prototype's `openQRAttendance('points')` was the servant *scanning*
  children's codes. And the scanner ignored `?mode=` entirely — `qr/page.tsx`
  computed `initialMode` for the group tab and never passed it to `ScanPanel`.
  Both halves fixed.
- **F0190 / part of F0845 — `AttendanceSession.icon`.** The column has existed
  since the table was added and nothing ever wrote or read it, so every session
  drew the same generic tile. Now settable per session and on the add-card, and
  counted as dirty by "Save all" so a changed glyph cannot be silently dropped.
  Deliberately **not** included: deleting an admin-added session, and locking the
  six fixed sessions against renaming. Both are on the church's list — one
  destroys attendance history, the other changes what an admin may do.
- **F0698 — the reading's message never reached the card offering the quiz.**
  `StudentExamRow` carried `bibleReading` but not `readingMessage`, so the one
  sentence a servant wrote to make a child want to read the passage only appeared
  after they had already opened the quiz. It now expands from the card rather
  than always showing: a long note would otherwise push the Start button off a
  phone screen.
- **F0776 — "Print selected" printed everything.** Hiding the unselected class
  *cards* left every class's per-student table in the printout, which is the bulk
  of the paper: a servant printing one class still got the whole school. The
  tables are server-rendered and cannot read the grid's state, so rather than
  reach into the DOM the grid emits one print-media rule naming the classes to
  drop. Ids are filtered to slug characters before entering a selector, and the
  rule is never emitted with an empty selector — that is malformed CSS.
- **F0262 — the archive knew a week had slides and threw the link away.**
  `listAgendaWeeks` kept `hasSlides: !!w.slideLink` and discarded the URL, so
  reaching last month's deck meant opening the week. Search hits now carry a
  Slides pill, as a sibling of the week link rather than nested inside it: an
  anchor within an anchor is invalid, and opening the deck must not also navigate
  to the week sheet.
- **F0293 — a servant's name in the attendance grid was plain text.** An admin
  who noticed somebody had missed three weeks had to leave, open the roster and
  find them again. The rows link to the profile now — **ADMIN only, and not by
  preference**: `/portal/admin/servants/[id]` calls `notFound()` for every other
  role, so linking it for the pastor would have put a 404 behind every name in
  the grid. The existing check "roster tiles are not links for the pastor" is the
  same rule one page over.

### Wave 28b — the rest of the batch, and a live bug found while working

- **F0337 + F0339 together.** Wave 27's F0150 gave "Open cases" its own tile in
  the lifetime strip, which left the class page stating the same number **three
  times**: the new tile, the digest's header badge, and the digest's own
  "Open cases / all time" cell. The cell was the one F0150 called out as
  confusing — an all-time figure sitting among month-scoped ones — so it goes,
  and the slot it frees takes **F0339's "Top this month"**: the one name a
  month-scoped card could not give, because the class leaderboard is all-time and
  a child who turned a corner in November is invisible behind a year of somebody
  else's points. Ties break alphabetically so the same month always reads the
  same way.
- **F0541 — the admin class cards said "3 servants" and stopped.** The count came
  off `_count`, so the names were never queried. An admin checking cover had to
  open the roster and filter it, and the thing they usually want — which of the
  three is the coordinator — was not on that screen at all. Names now expand from
  the card, coordinators first, with their title badges. Folded away rather than
  always open: a class with five servants would otherwise be twice the height of
  the cards beside it in the grid.
- **F0342 — the class page could not say what had just happened in the class.**
  It carried every total and no recent activity, so "did Abanoub already get his
  point for the memory verse?" meant opening the points page and searching. Six
  rows and a link to the full ledger rather than a second copy of it. Reversals
  are excluded: an undo and the row it cancels would otherwise fill the preview
  with a pair that nets to nothing.
- **F0506 — sending an announcement resolved in silence.** Added
  `InlineNotice` to `components/portal/ui.tsx` rather than a fourth hand-rolled
  copy of the pattern F0505 introduced. Deliberately **not** a floating toast, and
  the doc comment says why: `position: fixed` inside page content is trapped by
  `.portal-enter`'s transform, a notice that fades on a timer has told nobody
  anything if they looked away, and this one has to survive the `router.refresh()`
  that follows the write. **F0753 needed nothing** — that exact wording was
  already on the reading check-in. **F0787** (a floating birthday toast, once per
  session) stays deferred: it needs the portal layer, `sessionStorage`, and a
  judgement about interrupting a child that is not mine to make.
- **F0655 — a title-only announcement was impossible.** "No class this Sunday" is
  a complete announcement and the title already says it, but the body was
  `required` on the textarea, gated the submit button, and carried
  `z.string().min(1)` in the action. All three relaxed together — a half-fix here
  is a trap, since relaxing only the form leaves zod rejecting the submission.
  No migration: the column stays non-nullable and holds `''`. Both readers now
  guard against the empty case rather than drawing a blank paragraph.
- **F0315 — the event card drew initials while the poster's photo sat one join
  away.** `EVENT_SELECT` never took `photo`. On a church-wide feed the face is
  how a servant recognises who put the trip up, and initials shared by two people
  say nothing.

**A live bug, found while wiring F0506.** The announcements composer was passed
as `PageHeader`'s `actions`, and that slot renders **inside the dark maroon
banner** (`ui.tsx`). `AnnouncementManager` is not a button — it is a button that
expands into the whole compose form — so clicking "New announcement" opened
emoji, title, body, date, target and sort-order fields inside the banner. This is
exactly the defect Wave 24 fixed on the events page as F0312, still live one page
over, and it is the same reason F0283/F0501 were refused rather than built. The
component now renders below the header. The browser check asserts the trigger
**and** the form it expands into are outside `.bg-brand-950`, so this cannot
regress quietly.

**Closed without code:** F0306 (the same renderer F0768 already fixed), F0746
(the finding names the wrong destination — the notification is built from
`Announcement` rows, which never appear on `/portal/feed`; the real problem was
the middleware bounce fixed in Wave 27), F0501 and F0534/F0539 (documented
refusals), F0769 (an arbitrary remote image is not the same risk as a fixed
trusted host, even through the `next/image` proxy — it stays a decision).

Wave 28 verification: `tsc` clean · `npm test` **587** · `lint` clean ·
`build` compiles · `smoke` 126/126 · `smoke:write` **16/16** ·
`verify:ui` **381/381** (+29 checks).

### Two of my own checks failed for the same reason, and both times the feature was right

`verify:ui` reported the quiz reading message missing and the admin class cards
unnamed. Both features worked. Both findings ask for **collapsed** disclosures —
F0698 is titled "Bible reading collapsible panel" and F0541 is "lost its
click-to-expand name list" — and `innerText` does not include the contents of a
closed `<details>`. The checks were reading the shut card and calling a working
panel broken.

Fixed by opening what they assert on, rather than by relaxing the assertion: the
quiz check clicks the summary and waits for `details[open]` before looking for the
note, and the class check opens every disclosure on the page first. That is the
mirror of the skip-shaped failure in the same wave: **a check that reads hidden
markup reports a working feature as broken, and one whose precondition nobody
seeded reports it as passing.** Both are the same bug in the observer, not the
observed.

---

## Wave 29 — the last of the light tier

Everything left after Wave 28 that could be built without a church decision.

### Built

- **F0288 / F0580 / F0617 — an excused servant could not be given a reason.**
  The column, the zod field and the upsert have all stored `reason` since servant
  attendance was written, and `loadWeekGrid` already selected it. The grid was the
  only thing that never collected or showed it, so "Excused" carried exactly as
  much information as a blank cell. The box appears only under an excused mark —
  the action nulls the reason for every other status, so a note under "present"
  would be silently dropped — and it is read-only for somebody who cannot write
  that row, so the reason still explains the week to whoever is only looking.
- **F0329 / F0754 — the reading grid was a rolling 30 days.** A child on the 3rd
  saw 27 squares belonging to *last* month, and "9/30" described a stretch nobody
  thinks in. It is the calendar month now, with the month named above it, scored
  over the days that have actually happened — dividing by the whole month would
  tell a child on the 2nd they were on 1/30 — and future days drawn as not-yet
  rather than as missed. `readingMonthDays` is pure string maths so it cannot slip
  a month at either end. **+6 tests**, including every awkward month length.
- **F0324 — the Bible reading was capped at 300 characters on one line.** Both
  sides raised to 2000 together, because a taller box that zod still rejects loses
  the servant's work at submit. The quiz card opens to show a long reading in full
  rather than only ever truncating it.
- **F0013 — the servant's own class is pre-checked in the group-code panel** and
  labelled "my class". A servant serving one class among twelve had to find it
  every Sunday, and an admin generating a code for the wrong class is a silent
  mistake: the children scan and the marks land on somebody else's register.
- **F0657 — "Posted by Marina" became "Posted by Marina · Grade 3".** On a
  church-wide feed, which class they serve is most of what tells you why they are
  the one saying it.
- **F0256 — archive search hits now show their topics.** A hit said "2nd Week of
  SEP · 6 filled" and nothing about what was in it, so a servant searching for a
  saint had to open the week to find out whether it was the one they meant.
- **F0185 — the report card said "184 points" and stopped.** That cannot answer
  the question a parent asks at the door: is it because he turns up, or because he
  works? Broken down by source, in the family's words rather than the database's
  (`ATTENDANCE` → "Attending"), zero rows dropped and negative corrections kept —
  the correction is the row that needs explaining. The top three get the OG's
  medal glyph, which also survives a black-and-white printer, where a gold ribbon
  does not. **+7 tests.**
- **F0094 — a quiz written after its due date never reached the dashboard.** The
  widget filtered on `dueDate >= today`, which excluded the commonest case there
  is: a servant types Sunday's quiz up on the Tuesday and dates it to the Sunday.
  It shows for 48 hours whatever the due date says, marked "just added" so it is
  never read as still taking submissions, and kept out of the headline count.
  Extracted to `dashboardExams` and **+8 tests**, because every date rule here
  that read the clock itself has been wrong at least once.
- **F0547 — the servant CSV import committed on the first click.** The student
  importer had had a preview arm since it was written; the servant one is the more
  dangerous of the two, since a wrong `role` column makes somebody an ADMIN and a
  `classes` column rewrites who serves which class. The preview names both.
- **F0546 — and there was no servant template**, so an admin adding the year's
  servants guessed the column names. The two nobody guesses are `classes`
  (semicolon-separated) and `titles`, which lines up with it position by position.
- **F0797 — "12 rows skipped" told a servant nothing they could act on.** The
  agenda import now names the line and the column, quotes the offending value, and
  explains the duplicate-activity case that nobody guesses. **+6 tests.**
- **F0823 — the roster search needed a keypress per refinement.** It refines as
  you type now, and the **server** still does the filtering — deliberately. The
  roster query stops at 500 rows, so a client-side filter would search the first
  500 and tell an admin the 501st student does not exist.
- **F0086 / F0359 / F0528 / F0687 — the stat counters and their reduced-motion
  accommodation.** The markup carries the final number, so the page is right
  before any JavaScript runs, right in a print, and right to anything reading it;
  only the browser, only after mount, ever shows an intermediate value.
- **F0227 — an inconsistency Wave 27 created.** The rail was relabelled so
  "Lesson Preparation" meant the agenda (the OG's own wiring), but
  `/portal/lessons` still called *itself* "Lesson Preparation" in its metadata and
  three headers. A servant clicking "Lessons" landed on a page headed "Lesson
  Preparation", and clicking "Lesson Preparation" landed on one headed "Schedule
  of the Year" — both rails lying about their own page. The lessons page is
  "Lessons" now, and the agenda heading follows the viewer, because the two rails
  legitimately name it differently and a single fixed heading makes one of them
  wrong.

### Closed without code

F0663 and F0636 are F0776, built in Wave 28. F0629 is F0293, likewise. F0497 is
F0503. F0265's widget half was already right — `nextPlannedLessons` defaults to
three. F0618's documented alternative is in place. F0495 and F0791 are refusals
the findings themselves argue for. **F0071 is superseded by F0640**: that card is
already one overlay link, so a nested disclosure inside it would be an unclickable
control — the sr-only-button trap in another shape.

### The bug that only `smoke` could catch

`CountUp` shipped taking a `render` **function** prop. `tsc`, `npm test` and
`next lint` were all clean; every page carrying a stat tile returned **500** with
*"Functions cannot be passed directly to Client Components"*. The type checker
cannot see the server/client boundary, and `StatCard` is on nearly every page, so
this took the whole portal down while three green checks said otherwise. Only
`npm run smoke` found it.

It now takes a suffix string, and `tests/portal/stat-countable.test.ts` asserts
that `CountUp`'s prop list contains no function type at all — verified by putting
the old signature back and watching the test fail.

**The rule this adds: after touching a shared UI primitive, `npm run smoke` is not
optional.** Three clean checks meant nothing here.

### The last two

- **F0623** — its premise is gone. A meeting history exists and each row's "Open"
  link lands on that week's editable roster, so what the finding asks for is a
  second, parallel write UI for the same rows, not a missing capability.
- **F0354** — the audit itself took the other side: its verified note calls the
  sidebar card "a defensible redesign, not a regression", since it surfaces
  earlier in the day than the OG's 5pm gate. Restoring the gate is a question
  about when a servant should be nagged, which is the church's to answer.

**The light tier is closed.** Of the 296 light findings the sweep identified,
everything that could be built without a church decision has been built; what
remains is recorded above with the reason, or on the decision list.

### The count-up took three attempts, and each failure was real

`CountUp` is fifty lines and broke three different ways, all of them invisible to
`tsc`, `npm test` and `lint`:

1. **A function prop across the server/client boundary.** It took a `render`
   callback, which cannot be serialised. Every page with a stat tile — nearly all
   of them — returned 500. Caught by `npm run smoke`, not by the three green
   checks.
2. **No guarantee it ever finished.** `requestAnimationFrame` is throttled hard
   in a backgrounded tab and can stop outright, so a tile could sit on 0 — showing
   a wrong number for as long as the tab stayed hidden, which is worse than never
   animating. A timer now settles it regardless.
3. **A Strict Mode remount left it on zero for good.** The effect carried a
   "have I already run" ref to stop the count restarting. In development React
   mounts, unmounts and remounts: the first run set the value to 0 and scheduled
   the animation, the unmount's cleanup cancelled it, and the ref made the second
   run return early. The ref is gone — re-running the animation on a remount is
   harmless; not finishing it is not.

The browser check reported the second and third identically, as `12 vs 0`. Each
time the honest move was to fix the component rather than relax the assertion.
All three are now pinned by source assertions in
`tests/portal/stat-countable.test.ts`, each verified by reintroducing the bug and
watching the test fail.

### A check that closed the thing it was about to read

`and finds the student it was given` failed on a search that worked. The server
matched three students for "Chris" — confirmed straight against the database —
and the page did not appear to contain any of them.

The check opened every `<details>` on the roster by **clicking its summary**. A
click *toggles*, and the stage groups render with `open` already set, so the loop
shut the very groups the students were in. Both places that do this now set
`.open = true` on the element instead of clicking it.

That is the fourth distinct way a check in this file has lied about a working
feature: reading a collapsed disclosure, skipping on an unseeded precondition,
racing a fixed timeout, and now closing what it meant to open. Each was fixed at
the check rather than by loosening what it asserts.

Wave 29 verification: `tsc` clean · `npm test` **621** (+34) · `lint` clean ·
`build` compiles · `smoke` 126/126 · `smoke:write` 16/16 ·
`verify:ui` **391/391** (+10 checks).

## Wave 30 — the 39 church decisions, answered

The last tier. 60 held findings collapsed to 39 distinct questions; the church
answered them in one sitting, and this wave is the build. Twenty-seven needed
code; twelve were "keep the portal's refusal" and needed none.

### One of them was not a decision at all

**F0799 — the student CSV import silently erased data.** `pick()` returns an
empty string for a column the file does not have, and the update payload wrote
that straight through as `null`. An admin uploading three tidy columns of
corrected spellings blanked every matched child's father's name and phone,
mother's name and phone, address, date of birth, grade, gender, parent emails and
notes. The preview said only "Would update" and named nothing. Nothing brought it
back.

This was filed as "there should be a way to undo an import". The undo was never
the fix: the harm is that a partial sheet was treated as a complete one.
`lib/portal/import-columns.ts` now splits "the cell is empty" from "the file has
no such column", and an update writes only the columns the sheet actually
carries. A sheet with no name column at all is treated as a corrections sheet:
matched rows update, an unmatched row is refused rather than creating a nameless
child, and the preview names the fields it will change. Seven tests.

### The church's five

- **F0047** — 30 rolling days for servants, admins and the pastor; 12 hours for
  children, capped from sign-in rather than rolled forward, because a child signs
  in on a tablet the whole family uses. Enforced in the middleware *and* in
  `getPortalUser`, because server actions never pass through the middleware. A
  token issued before this shipped is treated as current, so the deploy itself
  signs nobody out.
- **F0850** — a senior who grew up here can become a servant without losing a
  year of records. One Account already carries both a Student and a Servant row,
  so no migration. **`endOfYearReset` had to be narrowed in the same change**: it
  deleted on `role = STUDENT` **OR** `student != null`, which would have deleted
  every converted servant each September and made the conversion a postponement
  rather than a fix.
- **F0540** — class deletion stays refused.
- **F0728 / F0187 / F0733** — the badges stay exactly as they are.
- **F0035** — praise moves to the pass mark. The portal contradicted itself about
  one score: 65 read "Good job" to a child and "Good" on their report card while
  the servant looking at that same result saw red and the results table graded it
  D, because the exam screens have always counted 70 as a pass. Every quiz band
  now comes through `QUIZ_PASS_PERCENT`.

### The church's one override

**F0113** — the recommendation was to keep refusing; the church asked for the
bulk delete *with a confirmation*. Built as `ClosedCaseCleanup`: resolved list
only, folded shut, never a tick box beside a row on the page servants read day to
day. It refuses any case still open, checks permission per class rather than once
per batch, and the confirmation names the children and says in those words that
the contact log goes with them.

### The rest

F0304 confirm before a save that deletes marks · F0175 corrected pairs hidden
from the child's own ledger, kept in full for staff, with the total explained
rather than silently short · F0424 the register pointer on the child's profile,
not only on the class points page · F0670 an unused session is deletable, one with
a single mark is not · F0668 the health check as a check, never the old
delete-what-it-finds · F0285/F0313/F0496 a stage coordinator can address her own
stage and no wider · F0103/F0455 the absence threshold shown read-only where the
cases are listed · F0057 servants fetch the blank sheet, the office uploads it ·
F0845 the six standard session names locked · F0036/F0699 the blank count on the
hand-in button itself · F0024/F0483 a duplicate-quiz warning, never a merge ·
F0052 switch a child's login off without deleting them · F0009/F0605 manual vs
scanned, **derived from the QR receipts already stored** — no migration, and it
reads correctly for meetings held long before anyone asked · F0106 backdate and
"already sorted out" · F0535/F0538 the notes line on the cards servants open ·
F0536 no pre-picked age group · F0316 the weekday derived from the date and
echoed beside it · F0282 pinning no longer marks a notice "edited" · F0325 the
readings refresh made admin-only and stopped from wiping four weeks before
fetching · F0354 a banner from Sunday afternoon, the side panel before that.

### The fifth way a check lied about working code

`and IS on the resolved list` failed. The panel was correct: it renders nothing
when there is nothing to clear, and the dev database held **zero** follow-up
cases. The check now seeds its own resolved case, asserts the panel appears,
deletes it, and asserts the panel disappears again — so it tests both halves of
the rule instead of reading an empty database as a missing feature.

### Deliberately not built

**F0734** (a second "ten Sundays altogether" badge). Its own recommendation was
to add it, but the church answered the achievements question as "keep the badges
exactly as they are" and a new rung changes the ladder. Held for them to confirm.

Wave 30 verification: `tsc` clean · `npm test` **641** (+20) · `lint` clean ·
`build` exit 0 · `smoke` 126/126 · `smoke:write` 16/16 ·
`verify:ui` **406/406** (+15 checks).

## Wave 31 — the six that were never in the audit

The leftovers, answered on 2026-09-23. Five needed code; one needed nothing.

### F0734 — "Faithful" meant two different things

The old app gave **Faithful** for ten Sundays *altogether*; the portal gives it
for three *in a row*, under the same key. Every other attendance badge here is a
streak too — so the child who comes every other Sunday all year, often the one
whose family drives furthest, could never earn a single attendance badge.

**Not fixed by re-pointing the key.** That would have contradicted the rule the
church had just endorsed under F0728: the name and the picture are decoration,
the hidden key is what is recorded, and changing what a key means takes the badge
away from every child holding it, dated. So the lifetime badge is a **new key**,
`ten-sundays`, sitting beside the streaks. `AchievementStats.sundaysAttended` is
a `count`, not a slice of the 60-row window the streak uses, so it cannot quietly
cap. Five tests, including one asserting `faithful` still means three in a row.

### F0216 — schedules from the old app imported as nothing

Not "imported badly" — as *nothing*. The old export is one row per week, 26
columns: `Week, Date`, then a Topic/Servant pair per activity, then
`Slide Link, Lead Servant, Back-Up, Notes`. Its `Week` column reads
"1st Week of SEP", which is not a date, so every row was skipped for having no
week and the church would have retyped a year of planning.

`legacyAgendaCsvToRecords` pivots wide → tall and hands the result to the
ordinary importer, so there is one set of rules about what a valid week is. Three
things made it cheaper than it looked: the activity **keys** are identical in both
apps, `resolveActivityKey` already knew the old app's own wordings (F0228's
aliases — "SAINT", "Agpeya Prayer", "The Seasons of the Coptic Church"),
`parseDateOnly` already read `M/D/YYYY`, and both apps run weeks Monday→Sunday.

**The trap was the header normaliser.** `normaliseHeader` turns every run of
punctuation into one space, so `"LESSON - Topic"` arrives as `lesson topic`, not
`lesson - topic`. The first version of the reader matched on `' - topic'` and
found nothing; six of seven tests failed and said so. The detection now resolves
the label against the activity table, which also keeps the portal's *own* export
out of this reader — its `lead servant` column ends in ` servant`, so a looser
test would have matched it.

A week carrying notes or a slide link but no topics yet is kept, with one row
carrying the week-level columns. Seven tests, including a full 40-week year.

### F0221 / F0490 / F0585 / F0586 — bulk clear selected weeks

The church asked for it with a confirmation. A folded `ClearWeeksPanel`, not a
tick box on each tile: the tiles are links, so a checkbox inside one fights the
click it already has, and this deletes lesson planning. Only weeks with something
saved are listed, the confirmation names the weeks and counts the filled rows, and
`clearAgendaWeeks` skips already-empty weeks rather than failing the batch on one
stale tile.

### F0571 — per-row delete on the All Students cards

Restored, with the church's requirement that it spell out the consequence. The
confirmation names the register, the points, the quiz results and answers, the
reading days, the badges and the follow-up cases, says it cannot be undone, and
points at **switch off login** for the case that is really being solved.
`bulkDeleteStudents` was already admin-gated; its audit line now **names** the
children, because "Deleted 1 student" answers nothing a fortnight later.

### F0069 — the refusal is now explained

Removing a child stays with the office. What changed is that a servant used to
find *nothing* where the old app had a red card, so they hunted for a control that
was not there and concluded the portal had lost it — the original complaint in
miniature. One line now answers it.

### F0070 / F0384 — address stays one field

The church never posts or mails anything, so four structured fields would be
slower to fill in and never read, against a migration on live children's records.
Closed, not deferred.

### A trap this wave exposed: the build typechecks the iCloud duplicates

`npm run build` failed on `tests/portal/achievements.test 2.ts` — an untracked,
byte-identical iCloud copy that had gone stale the moment the real test changed.
`tsc --noEmit` reported it too; it had only ever been invisible because the
greps in this session filtered `" 2.ts"` out of the output. So every edit
silently had to be mirrored into a dead file or the build broke. **The 98 duplicates
have now been deleted**, after checking each one had a live original (all 98 did),
that none was tracked by git (none was), that nothing in live source referenced
them (nothing did), and that no diverged copy was *newer* than the file it
duplicated (none was — 59 were byte-identical, 39 were stale snapshots of files
this restoration had edited). A backup sits in the session scratchpad as
`icloud-duplicates-backup.tgz`.

`tsconfig.json` keeps an exclusion as a guard, since iCloud can create them again
at any time. **The first version of that guard did not work**: it used
`**/* [0-9].ts`, and TypeScript's exclude globs support `*`, `?` and `**/` but not
character classes — a canary file with a deliberate type error was still reported.
The patterns are now spelled out literally for " 2" through " 9", and the canary
proves they hold.

### And the sixth way a check lied about working code

`while clearing a single week stays where it was` failed on a control that works.
The week editor's Clear button reads **"Clear"** at rest and only says "Clear this
week" *after* the confirm tap — so the check was matching text that does not exist
until you click. It now asserts on the button by role and name.

Fixing the check exposed a real problem it had stumbled onto, though: "Clear" on
its own was unambiguous while it was the only clear on the page, and this wave put
"Clear several weeks" right beside it. The resting label is now **"Clear this
week"** and the confirm names the week itself ("Yes, clear Sep 14 – Sep 20, 2026"),
so neither control can be mistaken for the other.

Wave 31 verification: `tsc` clean · `npm test` **652** (+11) · `lint` clean ·
`build` exit 0 · `smoke` 126/126 · `smoke:write` 16/16 · `verify:ui` **416/416**
(+10 checks).

## Wave 32 — what the verification pass caught in its own record

A 9-agent read-only fan-out catalogued every place the portal deliberately
differs from the prototype and then tried to refute each claim against current
source. **92 divergences, 65 confirmed, 4 refuted, 24 unverified.** Two of the
four refutations were worth acting on, and one was a live bug.

### F0462 — the false "Back on" date had come back through a side door

This finding was closed in an earlier wave on the grounds that the prototype
"closed a visitation case for a child who was absent that very week and wrote a
false 'back on' date into the child's record". The refutation showed the portal
still did exactly that, by a path nobody had looked at:

`absenceStreak` counts backwards and stops at anything that is not `ABSENT`.
**EXCUSED is not ABSENT.** So a child marked excused on the most recent Sunday —
excused meaning *not in the room*, as `sessionTrend`'s own comment says — scored a
streak of zero, `decideFollowUp` returned `close`, and the case was resolved with
`resolveReason: 'attending_again'` and `resolveNote: 'Back on <date>'`.

A servant reading that record afterwards is told a child came back who did not.
On a visitation list, that is the one thing the record exists to get right.

**Fixed by requiring evidence rather than the absence of evidence.**
`latestHeldStatus()` reports the child's mark at the most recent Sunday the class
actually held, and `decideFollowUp` now closes only when the streak is zero **and**
that mark is `PRESENT`. Both read one shared occasion list (`scoredOccasions`), so
the streak and the "latest" mark cannot disagree about which Sunday came last.
`latestHeld` is a **required** parameter, not optional — an optional one would let
a future caller silently reacquire the old behaviour.

The note is also now dated from the Sunday the child was actually seen rather than
from the day the sync ran. Those differ whenever a register is typed up midweek,
and the note goes into a child's record as a statement of fact. `lastSeen` is
written at the same time. **+9 tests.**

### The comment that claimed more than the code did

`attendance-rules.ts` carried: *"Use lib/portal/reports.ts's roster-aware
attendanceRate … so every surface agrees."* Two implementations exist —
`reports.ts:96` (roster-aware, takes `occasions` + `studentIds`) and `qr.ts:156`
(scores cells the caller has already built, used by the servant grid **and by a
child's own My Attendance page**).

No child sees a contradictory number: `my-attendance` builds its cells from a
class-wide `groupBy` first, so a held Sunday with no row still counts against
them, and both functions drop EXCUSED from the denominator. But the comment hid
where the roster-awareness actually lives — in the caller — and a future caller
trusting it would have written a rate that silently flattered every child with
missing rows. The comment now says which function is which and who uses each.

### Two claims corrected in the record rather than in the code

- The XSS note said "three `dangerouslySetInnerHTML` sites". There are **two**
  (`app/layout.tsx:113`, `ChurchClassGrid.tsx:148`), neither carrying user input.
  The third was a **comment** in `QrImage.tsx` saying the QR code deliberately
  avoids it — cited as evidence of the very thing it disclaims.
- The answer-key note read "never reaches the browser". Precisely: `correctIndex`
  is rendered in two **server** components (`quizzes/[id]/review/page.tsx:131`,
  `exams/[id]/page.tsx:357`) purely to pick a CSS class, and is never passed to a
  client component. It never reaches a browser holding an unsubmitted paper, which
  is the claim that matters — but a grep finds it, and the record should say why.

Wave 32 verification: `tsc` clean · `npm test` **660** (+8) · `lint` clean ·
`build` exit 0.
