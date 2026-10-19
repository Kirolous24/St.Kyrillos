# Kids see only their own points; follow-up excuses; Class Groups; phones on cards

Requested 2026-10-19 by the user, from servant feedback. "Start on those" — no
question round; the calls below are mine and are listed for review.

## 1. Kids see only their own points

- Leaderboard leaves the kids' menu; `/portal/leaderboard` joins `STAFF_ONLY`
  in `lib/auth.config.ts` (edge), and the page refuses a STUDENT (defence in
  depth).
- Kid's dashboard: drop "My rank", the "Class leaderboard" card and "Points vs
  leader". `studentOverview` stops computing classmates' totals; the kid's own
  total comes from their own entries.
- Class rank is hidden from a kid on Grades & Points, My Profile and their own
  student page. Staff still see a child's rank.
- Guards: staff-only route test, nav test, source guard on the kid's dashboard.

## 2. Follow-up excuses

- New table `FollowUpExcuse` (studentId, startsOn, endsOn date-only, reason,
  createdBy/At, updatedBy/At). Per child, not per class: a trip is a trip.
- Who: anyone with `followup.write` on any of the child's classes (home or
  a class they also belong to) — their servants, the stage overseer, admin,
  pastor. Same people edit and remove; the card says who set it and who last
  changed it; every add/change/remove is in the activity log.
- Rules (pure, `lib/portal/excuses.ts`): end ≥ start; at most 366 days; reason
  required, ≤ 500 chars; start may be in the past.
- Effect while today is inside the range:
  - the child stays on every list, marked "Excused until …" with the reason and
    who set it;
  - no automatic case opens for Sundays inside the range, and those Sundays
    don't count toward the streak afterwards (`withExcusedDates` feeds the
    existing streak rule EXCUSED marks; a PRESENT mark still wins);
  - an open case stays open but sits in an "Excused for now" section and is
    left out of every "needs a check-in" count (nav badge, bell, dashboard,
    class digest, Who is following up).
- Shown on: the child's profile (manage here), the case page, follow-up cards,
  My Group and Class Groups cards, the class roster card.

## 3. Assistant Coordinators arrange groups too

`group.manage` widens to the class's Assistant Coordinator: Split evenly, Move
children, fixing anyone's contact notes, group flags in the bell. UNASSIGNED
decisions (`unassigned.manage`) stay Coordinator/overseer/admin — that is not
group work.

## 4. Class Groups tab + follow-up log

- `/portal/my-group` gets tabs: My Group · Class Groups · Follow-up log, with a
  class picker over the classes the viewer may follow up.
- Class Groups: every servant's group as cards (Sundays, case, excuse, last
  contact and by whom, phones, Log check-in, Excuse). Anyone of the class can
  log a check-in on any child — `logCheckIn` already allows it.
- `FollowUpLog.groupServantId` records whose group the child was in when the
  note was written, so the log can say "George → Mina (Mariam's group)".
- Follow-up log tab: the class's contacts, newest first — when, who, which
  child, whose group, how, result, note.
- The class page's Groups card links to Class Groups; overseers without a class
  of their own get My Group in the menu too.

## 5. Phone numbers wherever a servant sees a child's card

`kidPhoneList` (father, mother, the child's own; a shared number once) and a
`KidPhones` row of tap-to-call links on: class roster cards, My Group and Class
Groups cards, follow-up cards, admin All Students cards. Already on: profile,
case page, UNASSIGNED. Not on registers, points or leaderboard grids (marking
screens). Never on a page a child can open.

## Migration

`20261019120000_followup_excuses`: additive — the new table and the nullable
column. Generated with `migrate diff` against the dev branch, applied to dev
with `migrate deploy`. Production gets it from `vercel-build` on push.

## Verification

`npm test`, `tsc`, `lint`, `next build`, `npm run smoke`, `npm run smoke:write`,
and a browser pass as a kid, a servant, an assistant and the admin.
