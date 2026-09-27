# Lesson-prep links, Sunday dates, and the UNASSIGNED list

Date: 2026-09-26. Status: design approved in chat. The church asked for it to be
built and pushed.

This covers three independent fixes to the servant side of the portal. They
ship together because they came in as one request.

## 1. Linking lesson prep actually grants access

### Problem

A class can follow another class's plan (`SchoolClass.curriculumLinkedToId`),
and the Lesson Preparation page then shows "Open <other class>'s plan". The
link gave nobody any access, though. A servant of the following class who
clicks it is dropped back on their own class, because the agenda page only
opens classes the servant is assigned to (or oversees). "Copy this week" fails
the same way, since `shareAgendaWeek` demands `class.read` on the source. On
top of that, only the admin could create a link, so a coordinator trying to
link two classes that teach the same material had no way to do it.

### Decision (the church chose "see + copy")

- **Who can link.** Any servant who can edit a class's Lesson Preparation
  (`attendance.write` on it) can make that class follow another class, or
  unlink it, from the Lesson Preparation page. The admin's control in Manage
  Classes stays, and both paths share one validation core:
  - the target exists and is active;
  - no self-links;
  - no direct two-way cycle;
  - every change is audited as `class.curriculumLink`.
- **What a link grants.** A link joins two classes, one hop, in either
  direction. Servants of **either** class may *read* the other's Lesson
  Preparation (every week, the weekly assignments sheet and the archive) and
  may copy a week of it into their own linked class.
- **What a link does not grant:**
  - editing the other class's plan;
  - anything else about that class: students, attendance, points or follow-ups.
- The **Lessons** page is unchanged: every servant can already read every
  class's lessons and copy from any class.
- **Visibility.** The follower shows "This class follows X's plan", and the
  source shows "Followed by: A, B". A linked class in the class picker is
  labelled "linked, read-only".

## 2. Lesson Preparation works in Sundays

### Problem

Weeks are keyed by their Monday. The date box always snapped back to that
Monday, so a servant who picked this Sunday saw the box jump to the Monday
before it, a past date. It read as "the page won't take a future date". Typing
a date on a computer also navigated on every keystroke, so a year typed as
"2026" passed through "0002".

### Decision

- The date box is labelled **Sunday** and shows the week's Sunday (Monday + 6).
  Picking any date opens the week that ends on that Sunday.
- The box only navigates on a complete date whose year is between 2000 and 2100.
- The heading reads "<class> · Sunday, Oct 4, 2026". The middle pill reads
  **This Sunday**.
- Storage is unchanged: weeks are still keyed by Monday.

## 3. UNASSIGNED instead of delete

### Problem and decision

Servants cannot remove a child today; only the admin can delete, and deleting
erases the child's history. The church wants a gentler path:

- **Unassigning.** Any servant with `student.write` on the child's class can
  **Unassign from class**, with a **required reason** of 3–500 characters.
  Unassigning:
  - takes the child off the class;
  - clears their follow-up group;
  - closes their open follow-up cases (status `DONE`, reason `other`, with the
    note "Unassigned from <class>: <reason>").
  - Attendance, points, quizzes and the login are all untouched.
- **What is recorded.** The student row gets four fields: `unassignedAt`,
  `unassignedById` (Account, `SET NULL`), `unassignedReason` and
  `unassignedFromClassId`. The last is a bare id, like `curriculumLinkedToId`,
  and holds the class the child came from.
- **Who handles the list.** A new permission, `unassigned.manage`, goes to:
  - the admin;
  - a stage overseer, for classes in their stage;
  - a class Coordinator, for their class.

  It uses the same rule as `group.manage`. Pastors, assistants and plain
  servants do not get it.
- **The /portal/unassigned page**, staff-only. Each card shows the red
  **UNASSIGNED** label, the child's name, grade, age, parents and phones, the
  class they came from, who unassigned them, the reason, and when.
  - **Put back:** return to the class they came from, if it still exists and
    is active.
  - **Move:** to any active class.
  - **Delete for good:** confirm first; the audit keeps the name, reason and
    who unassigned them.
  - Put back and Move rejoin a follow-up group (`placeNewKids`) and clear the
    four fields.
  - **The admin also sees children with no class on record** (legacy, or moved
    to "No class" by the admin), marked "no reason recorded". They can be moved
    or deleted, but only by the admin.
  - Accounts converted to servants, whose Student row has no class, are never
    listed. Only accounts with role `STUDENT` appear.
- **Clearing the fields elsewhere.** Any other path that puts a child into a
  class clears the four fields: the admin's move, bulk move and the student
  import.
- **Sidebar.** While at least one child is waiting in the user's scope, an
  item appears right under Dashboard: **UNASSIGNED** in red capitals, with a
  red count. It disappears when the list is empty. The count is state, not an
  alert, so it cannot be dismissed.

## Testing

- **Unit tests** for:
  - the Sunday helpers;
  - the link graph (`linkedWith`, `linkedReadable`);
  - reason cleaning and manageable-class scoping;
  - the sidebar flag insertion;
  - `unassigned.manage` in the permission matrix;
  - a source guard that every unassigned action audits.
- **The existing guards** must stay green: `use-server-exports`,
  `staff-only-routes` and `nav-reachability`.
- **A browser E2E on the dev branch**, never production:
  - a servant opens the linked class read-only and copies a week;
  - a servant sets and removes a link;
  - the Sunday box keeps the picked Sunday;
  - a servant unassigns a test child with a reason, and the coordinator or
    overseer sees the red flag and count;
  - put back, move, then delete.
- **Existing checks:** smoke and write-smoke, then tsc, lint and build.
