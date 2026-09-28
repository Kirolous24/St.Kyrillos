# Classes that take children from other classes

**Date:** 2026-09-28
**Status:** approved by the user 2026-09-28; built

## Why

The church opened a **Pre-Servants** class for teenagers training to serve. Those
teens stay in their own class (High School Girls or High School Boys) and also
belong to Pre-Servants.

The portal gives every child exactly one class. So today:

- a Pre-Servants servant cannot add a teen who is already in a High School class;
- importing the Pre-Servants list skips every such teen as "already here".

## Decided with the user

| Question | Answer |
|---|---|
| Which classes take children from other classes | **Only classes the admin marks.** Grade classes keep today's rule: a child found in another class is skipped, and the admin moves them. |
| What Pre-Servants marks attendance for | **Its own meeting:** a session only that class sees, with its own points. It never touches the teen's Sunday School record. |
| What Pre-Servants servants do with teens from other classes | Roster, attendance, points, quizzes and follow-ups. |

## The model

- **Home class stays one per child** (`Student.classId`). Everything that
  belongs to the home class is unchanged:
  - Sunday School and the other church sessions;
  - follow-up groups;
  - UNASSIGNED;
  - moving between grade classes (admin);
  - reports, birthdays and certificates.
- **Extra memberships** are a new table, `ClassMember`:
  - fields: `classId`, `studentId`, `addedAt`, `addedById`;
  - one row per class a child joins beyond their home class;
  - cascades away with the class or the child.
- **Which classes can have members:** `SchoolClass.takesOtherClasses` (default
  false). The admin ticks it in Manage Classes: "Takes children from other
  classes".
- **Class-only sessions:** `AttendanceSession.classId` (null means every class).
  The admin sets it in Sessions & Points: "For: every class / one class".
  - Other classes never see a class-only session.
  - Records keep naming their session by key, so nothing existing moves.
- **One helper decides who is on a class's roster:** its home children plus its
  members.

## What changes in a class that takes other classes

- **Roster.** Members are listed with their own class beside their name
  ("High School Girls").
  - **Add a child from another class:** search the church by name or ID. It
    needs `student.write` on this class.
  - **Take out of Pre-Servants:** no reason needed, because they stay in their
    own class.
- **Import.** A row matching a child who is already in another class **adds
  them as a member**: "Joins Pre-Servants; stays in High School Girls".
  - A child who is already a member is skipped.
  - A child who is new to the portal is created with this class as home, as
    today.
  - Grade-class imports are unchanged.
- **Attendance.**
  - The register offers the church sessions and the class's own meeting.
  - The class's own meeting lists everyone on the roster.
  - Church sessions list only the class's home children, because members are
    marked for those in their own class.
  - QR codes and card scans accept members for the class's own meeting.
- **Points.**
  - Members are on the class leaderboard and can be given points there,
    including by QR.
  - A child has **one total**, so points given in Pre-Servants count wherever
    that child is ranked.
- **Quizzes.** A child sees the quizzes of every class they belong to.
- **Follow-ups.**
  - Missing the class's own meeting opens a case in that class, using its
    visitation threshold.
  - The automatic rule today only reads Sunday School, and one open case per
    child blocks every other. That rule becomes **per class, per meeting**: a
    case in High School Girls neither blocks nor closes a Pre-Servants one.
  - Members aren't in follow-up groups: a child has one group, in their home
    class. Every Pre-Servants servant sees Pre-Servants cases.
- **Access.**
  - A servant of any class a child belongs to may open the child's profile and
    contact details.
  - Editing the child's details stays with the home class and the admin.
  - The profile shows "Also in: Pre-Servants".
- **Moving a child whose home is Pre-Servants into a grade class** (admin)
  keeps them in Pre-Servants as a member.

## Not changing

- A grade class can never gain members.
- Sunday School follow-ups, groups, UNASSIGNED and the admin's moves work as
  today.
- Class stat cards count what was recorded in the class: the meeting's
  attendance and points given there.

## Rollout

1. **One migration, all additive:** the `ClassMember` table,
   `SchoolClass.takesOtherClasses` and `AttendanceSession.classId`. No existing
   row is rewritten.
2. **After deploy, through the admin screens:**
   - tick "Takes children from other classes" on Pre-Servants;
   - add the session "Pre-Servants meeting" for Pre-Servants at 2 points (the
     admin can change it).
3. **The class servant imports the Pre-Servants sheet** once this is live.

## Testing

- **Unit:**
  - the roster rule;
  - the import decision (add as member, already a member, new child);
  - which sessions a class sees;
  - follow-ups per class and meeting;
  - the access rule.
- **Dev-branch E2E:**
  - mark a class; add a child from another class by search and by import;
  - take the meeting's attendance, including by QR;
  - give points;
  - a member sees the class's quiz;
  - a missed meeting opens a case in that class only;
  - the child's own class, Sunday School record and group are untouched;
  - take them out again.
- **Regression:** the existing import, points and attendance E2Es, plus
  smoke 138/16.
