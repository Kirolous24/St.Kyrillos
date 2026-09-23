# Resume the OG-parity restoration

Last updated 2026-09-23 after Wave 30. **The audit is closed.** Everything below is **local and
uncommitted** — nothing has been pushed or deployed.

## Where it stands

**Both blockers, all 126 highs, the whole light tier, all 39 church decisions and the six
leftovers are closed.** Waves 1–31 are logged in `OG-PARITY-FIXED.md`; read Waves 30 and 31 first —
between them they hold every decision and why it was answered the way it was.

| | n |
|---|---|
| real gaps after the 24-agent sweep | 399 |
| built in waves 24–30 | **257** |
| light still to do | 0 |
| church decisions still open | **0** |
| deliberately not built, with reasons recorded | 28 |

The 60 held findings collapsed to **39 distinct questions** — verified one by one against current
source by a 20-agent read-only fan-out, each verifier shadowed by a challenger. **All 20 "this is
already moot" claims were overturned**, so nothing on the list had quietly resolved itself. The
church answered all 39 in one sitting on 2026-09-23. 27 needed code; 12 were "keep the portal's
refusal" and needed none.

### The one that was a live bug, not a decision

**F0799 — the student CSV import silently erased data.** A sheet of three corrected columns blanked
every matched child's parents' names and phones, address, date of birth, grade, gender, parent
emails and notes, because a column the file did not have was written as `null`. The preview said
only "Would update". `lib/portal/import-columns.ts` now separates "the cell is empty" from "the file
has no such column"; only columns the sheet carries are written. Seven tests.

### Nothing is held back

F0734 was the one item left after Wave 30. The church answered it, and Wave 31 built it as a **new**
badge key rather than by re-pointing `faithful` — which would have un-earned that badge for every
child already holding it.

### The trap that came with F0850

`endOfYearReset` deleted accounts matching `role = STUDENT` **OR** `student != null`. A servant who
grew up here keeps a Student row so their years as a child stay readable — so without narrowing that
predicate, the conversion would have been undone every September. It is now guarded with
`servant: { is: null }`. **Anything new that sweeps students must respect that guard.**

## Verification state

`tsc` clean · `npm test` **652** · `lint` clean · `build` exit 0 ·
`smoke` 126/126 · `smoke:write` 16/16 · `verify:ui` **416/416**.

Everything is **local and uncommitted** — 31 waves, **zero commits**. Production is still serving
`cb72b26`, which has none of this. Committing and pushing needs the user to ask.

**The ~98 untracked iCloud duplicate files are gone.** They were being typechecked, so
`npm run build` broke the moment a real file changed and its stale copy did not. All 98 were
verified first: every one had a live original, none was tracked, nothing referenced them, and no
diverged copy was newer than the file it duplicated. Backup: `icloud-duplicates-backup.tgz` in the
session scratchpad.

`tsconfig.json` keeps literal `**/* 2.ts` … `**/* 9.tsx` exclusions as a guard, because iCloud can
recreate them at any time. **Do not "simplify" those to `**/* [0-9].ts`** — TypeScript's exclude
globs have no character classes, so that version silently does nothing. A canary file with a
deliberate type error is the way to check a guard like this actually holds.

`tests/portal/nav-reachability.test.ts` (42 tests) holds every sidebar, phone-bar and avatar-menu row
open for all four roles: each must resolve to a real `page.tsx` **and** survive
`lib/auth.config.ts`'s middleware. It exists because spec agents checked a page's own gate and missed
the middleware, which had been bouncing every student off `/portal/announcements` — a route the
announcement notification had been pointing them at.

## Nothing is open

Wave 31 closed the six that had never been part of the audit. All answered by the church on
2026-09-23:

- **F0734** — the lifetime attendance badge added as its own key, `ten-sundays`. `faithful` still
  means three in a row, deliberately: changing what an existing key means un-earns it for every
  child holding it.
- **F0216** — schedules exported from the old Firebase app now import. `legacyAgendaCsvToRecords`
  pivots the wide one-row-per-week shape and hands it to the ordinary importer.
- **F0221/F0490/F0585/F0586** — bulk week clearing, as a folded panel with a confirmation that names
  the weeks and counts the filled rows.
- **F0069** — removing a child stays with the office; the refusal is now explained rather than silent.
- **F0070/F0384** — address stays one field. The church never posts anything, so four structured
  fields would be slower to fill in and never read. **Closed, not deferred.**
- **F0571** — per-row delete restored on the All Students cards, behind a confirmation that names
  everything it destroys and points at "switch off login" instead.


## Rules that must not be dropped

- **Never point an agent at a database.** A subagent wiped production on 2026-09-19. The sweep
  prompts say this explicitly; keep it there.
- **Do not push or deploy** without the user asking. All 30 waves are local.
- **Do not carbon-copy the OG's known defects** (ANALYSIS.md §6): plaintext PINs, answer keys shipped
  to the browser, innerHTML XSS, the admin Take Attendance page that throws. F0065/F0377 ("Export IDs
  & PINs") stays closed for this reason — PINs are hashed.
- **Never run `npm run build` while `next dev` is up.** They share `.next`; the build strips the dev
  server's vendor chunks and every route starts 500ing. Restart dev after a build.
- **Never start a browser suite right after editing source.** Wait for the recompile. Three runs were
  invalidated this way.
- **After touching a shared UI primitive, `npm run smoke` is not optional.** `tsc`, `npm test` and
  lint cannot see the server/client boundary: a function prop passed to a client component 500'd
  every page while all three stayed green.
- **Fixed `waitForTimeout` after a click is a bug**, not a wait. Use `waitForURL`.
- **Labels render uppercase via CSS.** Compare with the `textOf()` helper.
- **A text search is not a presence check.** "Attendance" and "Exams" appear on buttons and nav
  items; assert on `data-stat` instead.

## The six ways a check has lied about working code

Every one was fixed at the check, never by loosening what it asserts.

1. Reading a **collapsed `<details>`** — `innerText` excludes it, so a working feature read as broken.
2. **Clicking a `<summary>` toggles** — the loop shut the very groups it meant to open. Set
   `.open = true`.
3. Racing a **fixed timeout** instead of `waitForURL`.
4. **Skipping on an unseeded precondition** — a "skip" reads exactly like a pass.
5. **Reading an empty dev database as a missing feature** (Wave 30). The closed-case cleanup panel
   renders nothing when there is nothing to clear, and the dev database held zero follow-up cases.
   The check now seeds its own case, asserts the panel appears, deletes it, and asserts it disappears.
6. **Matching text that only exists after a click** (Wave 31). The week editor's Clear button reads
   "Clear" at rest and "Clear this week" only once confirmed, so the check failed on a working
   control. Assert on the button by role and name, never on a label a state change reveals.

## Verification battery

`npx tsc --noEmit` · `npm test` (652) · `npx next lint` · `npm run build` ·
`npm run smoke` (126) · `npm run smoke:write` (16) · `npm run verify:ui` (416)

`verify:ui` takes 10–15 minutes. Start `next dev`, wait for the first compile, then run it — and
never while a build is in flight.
