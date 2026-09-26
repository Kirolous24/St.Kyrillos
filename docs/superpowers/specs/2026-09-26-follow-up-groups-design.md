# Follow-up groups: every kid has their own servant

**Status:** design, awaiting review · **Date:** 2026-09-26

## Goal

Each class's kids are split evenly across that class's servants. For example,
4 servants and 16 kids gives 4 kids each. A servant's group is theirs to follow
up with, check in on and watch closely. Coordinators can see every group in their
scope and how each servant is doing.

## Decisions made with the user (2026-09-26)

- **Nobody's access shrinks.** A servant can still see and act on every kid in
  their class. Groups add focus. They don't add walls.
- **A plain servant's follow-up list shows only their group.**
- **Coordinators see everything in their scope, with who it's assigned to.**
  - A stage overseer (the Middle School overseer, for example) sees every class in their stage.
  - A class Coordinator sees their class.
  - Admin and the pastor see the whole church.
  - Anyone who serves in a class also has their own group there, overseers included.
- **Everyone is split automatically at launch.** Nobody presses anything.
- **After launch, groups only change in small steps:**

  | Event | What happens |
  |---|---|
  | A kid is added, or moves into the class | They join one group. Nobody else moves. |
  | A kid leaves | Nothing else changes. |
  | A servant joins, leaves, or is deactivated | Nothing moves automatically. The class is **flagged**, and an overseer uses **Split evenly**. |

- **Servants can log a check-in on any kid**, not just kids who missed a Sunday.

## Behaviour

### The first split (automatic, once per class)

A class that has never been split is split the first time the portal is used
after the update. It uses the class's active servants and active kids.

1. **Kids from the same family stay together whenever that still leaves the
   groups even.** Kids in the class who share a parent phone number count as one
   family. (5th–6th and 7th–8th span two grades, so siblings do share a class.)
   A family is split only if keeping it together would raise a flag (see below),
   which in practice means three or more siblings in one class.
2. Families go, biggest first, to the servant with the fewest kids so far. Ties
   go by servant name, so the result is always the same.
3. Group sizes come out equal to within one, or within two when siblings are
   kept together. **A fresh split never raises a flag.**
4. The class is marked as split (`SchoolClass.groupsSplitAt`). The automatic split
   never runs on that class again.

Classes with no kids or no servants are skipped until they have both.

### A kid is added or moves into a class

This covers the create-student form, CSV import, **Move** and bulk move.

- If a sibling is already in a group in that class, the kid joins that group.
- Otherwise they join the smallest group. Ties go by servant name.

Nobody else moves. If the class has no active servants, the kid starts
unassigned (see the flags below).

### A kid leaves

Nothing moves. The group is one smaller.

### A servant joins or leaves

Nothing moves automatically:

- **A new servant** starts with no kids.
- **A servant who leaves** the class, or whose account is deactivated, stops
  counting. Their kids show as **Unassigned**.

The assignment stays stored. If that servant is added back, their group
reappears as it was.

**Unassigned kids are never invisible.** Their follow-ups show to every servant
in the class, which is how everything worked before groups, until they're placed.

### Flags (for the class's overseer, its Coordinator and admin)

One pure function checks each class's groups and raises up to three flags:

| Flag | When |
|---|---|
| **Kids with no servant** | Any active kid in the class is unassigned. |
| **Servant with no kids** | An active servant has 0 kids while another has 2 or more. |
| **Uneven** | The biggest group has at least **3** more kids than the smallest. |

A single kid leaving never raises **Uneven**, and a class with more servants than
kids is never flagged. Flags show in three places:

- the class's **Groups** section
- **My Stage**, per class
- the **bell**: "Groups need attention in 2 classes"

### Split evenly (button)

It's for admin, the stage overseer and the class's Coordinator. It works out the
**fewest moves** that clear the flags:

1. Unassigned kids are placed first, siblings together.
2. Next, it takes kids from any group above its fair size. It picks kids without
   a sibling in that group, most recently added first, so the kids a servant has
   known longest stay with them.
3. Those kids go to the groups below their fair size.

Families stay together unless splitting one is the only way to clear a flag.

**It shows the exact moves before doing anything** ("Mina → Mariam's group") and
only acts after you confirm.

A manager can also **move one kid** by hand, from the Groups section or from the
kid's profile.

## Screens

- **My Group** is a new sidebar item for every servant with a group. Each kid
  shows:
  - the last 8 Sundays at a glance, and how many they've missed in a row
  - any open follow-up
  - **last contacted N days ago**
  - points and upcoming birthday
  - one-tap Call or WhatsApp to the parents
  - **Log check-in**

  Kids who need attention come first: an open follow-up, then the longest since
  last contact. A servant with groups in two classes sees both.
- **Class page → Groups:** each servant with their kids and counts, the flags,
  **Split evenly** and **Move**. Everyone in the class can see it. Only managers
  can change it.
- **Follow-ups:**
  - A plain servant sees their own group's cases, plus any unassigned kids in
    their class. Assistant coordinators count as plain servants here.
  - Coordinators, overseers, admin and the pastor see their whole scope. Each case
    shows **Assigned to**, and filter chips let them narrow to All, Mine, one
    servant, or Unassigned.
  - For coordinators, a **per-servant summary**: kids, open cases, and
    **contacted in the last 30 days** (for example, 3 of 5).
- **My Stage:** each class's group flags and per-servant summary.
- **Kid's profile:** shows their group ("Mariam S."), with **Change** for
  managers, the kid's full contact history, and **Log check-in**.

## Check-ins

- A contact can be logged on **any kid**. It's the same form as a follow-up
  contact: how, the result, and a note.
- If the kid has an **open follow-up**, the check-in goes on that case's
  timeline. Otherwise it stands on its own.
- "Last contacted" is the most recent contact of either kind.
- **Who can log one:** anyone with `followup.write` on the class. That's the
  class's servants, its coordinator, the overseer, admin and the pastor. Every
  entry records who made it.

## Data (one migration)

**`Student`**
- `groupServantId String?`, linked to `Servant` with `onDelete: SetNull`, plus an
  index.
- `groupAssignedAt DateTime?`

**`SchoolClass`**
- `groupsSplitAt DateTime?`

**`FollowUpLog`**
- Gains `studentId` and becomes contacts for any kid.
- The migration backfills `studentId` from each log's case, then makes it
  required. It links to `Student` with cascade delete, indexed by
  `(studentId, at desc)`.
- `caseId` becomes optional. The cascade stays, so deleting a case still removes
  its own timeline.

**How a group is resolved:** it's checked when read. A kid's servant only counts
if they are **currently assigned to the kid's class and active**. Otherwise the
kid is unassigned.

**Trap this avoids:** groups deliberately do **not** hang off `ClassServant`.
Two things delete and re-create a servant's `ClassServant` rows on every save:
`updateServant` in `lib/portal/actions/admin.ts`, and the servant CSV import in
`data-tools.ts`. A cascade from there would wipe a servant's group every time
their phone number was edited.

## Permissions

- **`can()` is unchanged for every existing action.** Groups never hide a kid
  from anyone.
- **A new action, `group.manage`** (split and move):
  - ADMIN: yes
  - SERVANT: yes, as the class's stage overseer or its `COORDINATOR`
  - PASTOR and assistant coordinators: no
- **Follow-up list scope** comes from one pure, tested function. **Every count
  that points at the follow-ups page uses that same function**, so the badge
  never says 12 over a list of 3. That covers:
  - the sidebar badge and the bell
  - the dashboard's Open follow-ups, and its per-class chips that link to the
    list

  The class page's own tiles and the church reports describe the whole class,
  don't link to the list, and keep class totals.

## Not included

- Choosing groups by hand from scratch. The split is automatic, and people only
  adjust it.
- Co-led groups (two servants sharing one group).
- Excluding a servant from having a group.
- Reminders about cadence ("call each kid every 2 weeks").
- Changes to how attendance is taken.

## Testing

- **Unit:**
  - **first split:** sizes equal within one; siblings together; the same result
    every run
  - **joining:** a new kid goes to the smallest group, or to a sibling's group
  - **Split evenly:** minimal moves; clears every flag; never moves a kid it
    doesn't need to
  - **flags:** "one kid left" never raises Uneven
  - **group resolution:** a servant who was removed, or deactivated, leaves their
    kids unassigned; a servant who returns gets the group back
  - **list scope:** checked for every role; a plain servant sees their group plus
    unassigned kids
  - **counts:** they use the list scope
  - **`group.manage`:** grants and boundaries
  - **check-ins:** land on an open case when there is one
  - **migration backfill:** covered, including that deleting a case removes only
    its own logs
- **Smoke:** My Group, Groups and the scoped Follow-ups page for each role.
- **Write-smoke on dev:** split, move a kid, add a kid, log a check-in.

## Rollout

1. Push. The migration adds the columns and backfills `FollowUpLog.studentId`
   on deploy.
2. The first portal use after deploy splits every class.
3. Check My Stage for flags and confirm the groups look right.
