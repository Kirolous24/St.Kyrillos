# Lesson-prep links, Sundays and UNASSIGNED: implementation plan

> **For agentic workers:** executed inline (the church asked for no subagents).
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make curriculum links grant read-and-copy access to the linked
lesson prep, and let servants create them. Key Lesson Preparation by Sunday.
Replace "ask the office to delete" with a reasoned Unassign plus a
coordinator-handled UNASSIGNED list.

**Architecture:**
- **Pure helpers** (`lib/portal/lesson-links.ts`, `lib/portal/unassigned.ts`,
  `lib/portal/agenda.ts`, `lib/portal/nav.ts`), unit-tested.
- **Server data** (`lib/portal/data/lesson-prep.ts`,
  `lib/portal/data/unassigned.ts`) and **actions**
  (`lib/portal/actions/agenda.ts`, `lib/portal/actions/unassigned.ts`), all
  through `runAction` and `audit`.
- **One additive migration** on `Student`.

**Tech stack:** Next.js 14 App Router server actions, Prisma 5 on Neon
Postgres, vitest, playwright-core for the dev-branch E2E.

**Spec:** `docs/superpowers/specs/2026-09-26-lesson-links-sundays-unassigned-design.md`

## Global constraints

- **Databases.** Never touch production from here. Print the DB endpoint
  before any Prisma command and refuse `ep-dark-term-ai3c2hag`. Production
  gets the migration only through Vercel's `prisma migrate deploy`.
- **Code rules.**
  - A `'use server'` file exports async functions only.
  - Every write goes through `runAction` and `audit()`.
- **Builds.** Never run `next build` while `next dev` is up.
- **The repo is public:** no names or PII in code, tests or docs.

---

### Task 1: Sunday helpers and the date box
**Files:** `lib/portal/agenda.ts` (add `sundayOfWeek`, `isCompleteDateInput`),
`app/portal/(app)/agenda/AgendaTools.tsx` (`AgendaNav`),
`app/portal/(app)/agenda/page.tsx` (heading and "This Sunday" pill), and
`tests/portal/agenda.test.ts`.
- [ ] Write the failing tests:
  - `sundayOfWeek('2026-09-21') === '2026-09-27'`.
  - `isCompleteDateInput` rejects `''`, `'0002-10-04'` and `'2026-02-30'`,
    and accepts `'2026-10-04'`.
- [ ] Implement, run the tests, and wire up the UI.

### Task 2: The link graph and read access
**Files:** `lib/portal/lesson-links.ts` (`linkedWith`, `linkedReadable`),
`lib/portal/data/lesson-prep.ts` (`lessonPrepClasses(user)`),
`lib/portal/data/curriculum-link.ts` (`applyCurriculumLink`, the shared
core), `lib/portal/actions/admin.ts` (`setCurriculumLink` uses the core),
`lib/portal/actions/agenda.ts` (the new `linkClassCurriculum`;
`shareAgendaWeek` accepts a directly linked source), and
`tests/portal/lesson-links.test.ts`.
- [ ] Tests: one hop in both directions, no self, no duplicates, and
  `linkedReadable` excludes the user's own classes.
- [ ] Implement.

### Task 3: Linked classes on the agenda and weekly sheet
**Files:** `app/portal/(app)/agenda/page.tsx`,
`app/portal/(app)/agenda/week/page.tsx`,
`app/portal/(app)/agenda/CurriculumLink.tsx` (new wording, plus "Followed
by"), and a new `app/portal/(app)/agenda/LinkedPlan.tsx` (read-only banner and
copy-into). The new `LinkPicker.tsx` holds the servant's follow/unlink card.
- [ ] A linked class opens read-only. It shows no editor, tools or
  clear-weeks panel, and has a copy button into the user's linked class.

### Task 4: Schema and migration
**Files:** `prisma/schema.prisma` (four `Student` fields, an index, and
`Account.studentsUnassigned`) and
`prisma/migrations/20260926220000_student_unassigned/migration.sql`.
- [ ] Generate with `--create-only` against dev, review the SQL (additive
  only), apply it to dev, and run `prisma generate`.

### Task 5: Unassigned helpers and permission
**Files:** `lib/portal/unassigned.ts` (`cleanUnassignReason`,
`manageableFromClassIds`, `CLEAR_UNASSIGNED`), `lib/portal/permissions.ts`
(`unassigned.manage`), `tests/portal/unassigned.test.ts`, and
`tests/portal/permissions.test.ts`.
- [ ] Test the reason bounds, the scoping (admin sees all; overseer by stage;
  Coordinator by class; assistants and plain servants see none) and the
  permission matrix.

### Task 6: Unassigned data and actions
**Files:** `lib/portal/data/unassigned.ts` (`unassignedWhere`,
`listUnassigned`, `countUnassigned`) and `lib/portal/actions/unassigned.ts`
(`unassignStudent`, `putBackUnassigned`, `moveUnassigned`,
`deleteUnassigned`). Clear the fields in `moveStudent`, `bulkMoveStudents`
and the student import. `tests/portal/unassigned-actions.test.ts` is the
audit guard.

### Task 7: Unassigned UI
**Files:**
- `app/portal/(app)/unassigned/page.tsx` and `UnassignedActions.tsx`
- `app/portal/(app)/students/[id]/StudentProfileActions.tsx` (Unassign flow)
  and the `students/[id]/page.tsx` props and admin callout
- `lib/portal/nav.ts` (`withUnassignedFlag`, tested)
- `components/portal/Shell.tsx` (`tone: 'alert'`, `unassigned` icon)
- `app/portal/(app)/layout.tsx` (count and flag)
- `lib/auth.config.ts` (`/portal/unassigned` is staff-only)
- `scripts/portal-smoke.mjs` (the new route)

### Task 8: Verify, ship
- [ ] `npm test`, `tsc --noEmit`, `npm run lint` and `next build`, with the
  dev server stopped.
- [ ] Start `next dev`, then run the dev-branch E2E, `npm run smoke` and
  `npm run smoke:write`.
- [ ] Commit, then push (the church asked for it).
- [ ] Watch the Vercel status, then check production over HTTP only.
