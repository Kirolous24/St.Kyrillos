# Classes that take children from other classes: implementation plan

**Goal:** a class the admin marks (Pre-Servants) can hold children who stay in
their own class, with its own meeting, points, quizzes and follow-ups.

**Architecture:**
- Each child keeps one home class (`Student.classId`).
- A new `ClassMember` table holds extra memberships.
- `SchoolClass.takesOtherClasses` marks which classes may have members.
- `AttendanceSession.classId` makes a session belong to one class.
- One pure module decides roster, session and import rules; each screen calls
  it.

**Stack:** Next.js 14 server actions, Prisma 5 / Neon, vitest, Playwright E2E
on the dev branch.

**Spec:** `docs/superpowers/specs/2026-09-28-classes-that-take-other-classes-design.md`

## Global constraints

- Never touch the production DB directly. Migrations run on the dev branch
  (`ep-jolly-bread`) locally and on production only through Vercel's
  `prisma migrate deploy`.
- The migration is additive only: no existing row is rewritten.
- Grade classes behave exactly as before.
- Commit messages end with the Co-Authored-By line. The repo is public: no real
  names in code, tests or docs.

## Tasks

1. **Schema + migration.** Add `ClassMember`, `SchoolClass.takesOtherClasses`
   and `AttendanceSession.classId`. SQL comes from `prisma migrate diff`; apply
   to dev and generate the client.
2. **Rules module (`lib/portal/class-members.ts`), with tests:**
   - `rosterWhere` (home plus members);
   - `sessionsForClass` (church sessions plus the class's own; other classes
     never see them);
   - `sessionTakesMembers` (only the class's own sessions list members);
   - `importJoinDecision` (join, already a member, or unchanged rules for grade
     classes);
   - `studentClassIds` (home plus memberships, for access and quizzes).
3. **Membership actions:**
   - `addClassMember`, `removeClassMember` and `findChildrenToAdd`;
   - `moveStudent` keeps an open-class home as a membership;
   - moving into a class the child is already a member of drops that
     membership.
4. **Class page:** members on the roster with their own class; "Add a child
   from another class" and "Take out".
5. **Attendance:** the register and `saveAttendance` use session-aware rosters;
   QR `scanStudent` and `redeemCode` accept members; the QR page sessions list.
6. **Points:** the leaderboard and `givePoints` include members.
7. **Quizzes:** a child sees their memberships' quizzes and may take them;
   results list members.
8. **Follow-ups:**
   - `syncAutoFollowUps` works per class and per meeting session;
   - `saveAttendance` syncs the class's own meeting;
   - the new-case form lists members;
   - `createManualCase` files a case in a class the servant serves.
9. **Access:** `requireStudentRead` allows a membership class; the profile
   shows "Also in"; editing stays with the home class.
10. **Import:** in a class that takes others, a known child from another class
    joins, and a member is skipped as already in.
11. **Admin:** a Manage Classes checkbox; Sessions & Points gets "For: every
    class / one class".
12. **Verify:**
    - `tsc`, lint, vitest, build;
    - a dev E2E of the whole flow;
    - the existing E2Es and smoke 138/16.
13. **Ship:**
    - commit, push, watch the deploy, verify live;
    - through the admin UI, tick Pre-Servants and add "Pre-Servants meeting"
      at 2 points;
    - update memory.
