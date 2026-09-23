# OG → Portal Parity Audit

**779 real gaps** between the Firebase prototype ("the OG") and the live portal.

## How this was produced

- Every one of the OG's 19,999 lines was read by an agent: **1,685 capabilities catalogued**.
- **901 OG UI elements** were then checked page-by-page across all four roles (374 were at parity).
- All findings went through an adversarial verify pass that re-checked each claim against the code.
- Verified: **574**. Unverified (all medium/low): **205**.
- Dropped as false or duplicate: **73** ({'DUPLICATE': 62, 'FIXED': 2, 'PRESENT': 2, 'REFUTED': 7}).

## Totals

| Severity | n |  | State | n |  | Role | n |
|---|---|---|---|---|---|---|---|
| blocker | 2 |  | BROKEN | 42 |  | servant | 408 |
| high | 126 |  | MISSING | 337 |  | student | 131 |
| medium | 400 |  | MOVED | 126 |  | admin | 153 |
| low | 251 |  | DEGRADED | 274 |  | all | 30 |
|  |  |  |  |  |  | pastor | 57 |

**State meanings** — MISSING: no equivalent anywhere. MOVED: exists but reached from a different place than the OG, so someone who knew the OG cannot find it. DEGRADED: exists with fewer options/fields/columns. BROKEN: in the code but does not work, or nothing links to it.


---

## BLOCKER (2)

### `F0215` [BROKEN] A servant from another class can no longer be assigned to an agenda activity — the grouped 'This Class / Other Classes' dropdown is gone, and the server independently rejects any cross-class id
- **Role:** servant · **Area:** agenda
- **OG:** OG getAgendaServantOptions + buildServantSelectOptions (L8245-8270), used building the Lead/Backup/activity selects at L8437 and L8447-8448
- **Now:** lib/portal/data/agenda.ts:25-35 classServants(classId) — queries only prisma.classServant where classId matches, no cross-class group; enforced again server-side by requireServant/servantIdsOn in lib/portal/actions/agenda.ts:44-54,130
- **Verified:** Verified on both ends. classServants() has no 'others' branch at all (confirmed by reading the function directly), so the UI literally cannot offer another class's servant — it's not that a selection is attempted and bounced, it's that the option never appears. Independently, requireServant() would also throw 'The <role> must be a servant on this class' if a cross-class id somehow reached the server. Both pieces of the OG's optgroup UI (This Class / Other Classes) and its use are fully gone. Kept at blocker: any class pair that relies on cross-assigning servants (which the OG explicitly supported) has no working path at all, with no admin override visible either.
- **Fix:** Add an 'others' branch to classServants() (or a new function) that also returns active servants outside the class, grouped separately in the AgendaEditor's servant selects, and relax requireServant()'s allowed-set check to include them.

### `F0001` [BROKEN] Signed-out student scanning a projected QR code is bounced to login and the token is discarded
- **Role:** student · **Area:** qr
- **OG:** index.stripped.html L14607-14618 (checkQRScan holds the token in a closure and polls for window._me before processing it)
- **Now:** lib/auth.config.ts:66 redirects to /portal/login with no return path; app/portal/login/PortalLoginForm.tsx:54 hard-codes router.replace('/portal'); app/portal/(app)/scan/[token]/page.tsx is gated behind the same middleware
- **Verified:** Confirmed all three citations exactly. Also confirmed the portal's JWT session maxAge is 24 hours (lib/auth.config.ts:38) — since Sunday School meets weekly, most students who haven't opened the portal since last Sunday will already be signed out when they scan Sunday's group code, so this is not a rare edge case.
- **Fix:** Carry the original path through the login redirect (e.g. /portal/login?next=...) and have PortalLoginForm honor a validated next param instead of hard-coding /portal, as given.


---

## HIGH (126)

### `F0821` [MISSING] Confirmed — no servant name-search box on Admin → Servants, and the class groups default to closed
- **Role:** admin · **Area:** Admin > Servants (id='servants')
- **OG:** index.stripped.html L3070, L15184-15202 — live-filter input over stage/class groups
- **Now:** app/portal/(app)/admin/servants/page.tsx (full read) — no <input> anywhere; ServantGroup's per-class sections render as <details> defaulting to closed (only Leadership/Unassigned get defaultOpen)
- **Verified:** Independently confirmed beyond the finding's own grep that the class groups default to collapsed, meaning finding a specific servant by name genuinely requires opening every group one at a time — supports the filed high severity.
- **Fix:** Add a client-side name filter over the already-rendered groups, auto-expanding matches, as proposed.

### `F0795` [MISSING] Confirmed — no "Add Standard Grade Classes" bulk-seed button or action anywhere
- **Role:** admin · **Area:** Admin → Classes
- **OG:** index.stripped.html L2959, L3516-3541 — bulk-create 14 grade classes with dedupe and toast
- **Now:** nowhere — grep -rn -i "standard grade|addstandardgrade|pre-k" across app/lib/components returns no such feature; only single-class createClass exists in lib/portal/actions/admin.ts
- **Verified:** Confirmed as stated with no independent nuance to add.
- **Fix:** Add the bulk-seed button and server action as proposed.

### `F0810` [MISSING] Confirmed — no Print Roster button on Admin → Servants, and there is no usable print workaround
- **Role:** admin · **Area:** Servants (admin)
- **OG:** index.stripped.html L3015, L7704-7787 — printServantsRoster() opens a letterhead-style roster grouped by stage→class→title
- **Now:** nowhere — grep -rln "PrintButton" app/portal/(app)/ (9 files) does not include admin/servants
- **Verified:** Went beyond the finding's own evidence: the page's class groups render inside <details> that default to closed except Leadership/Unassigned, and there's no .portal-print-page wrapper or print CSS forcing them open — so even a manual browser print would omit most class groups' names, confirming there's no usable print workaround at all today.
- **Fix:** Add a Print Roster button/print view that force-opens all groups, as proposed.

### `F0848` [MISSING] Confirmed — no bulk "delete every student in a class" tool; DangerZone has exactly 3 cards, not 4
- **Role:** admin · **Area:** adLoad('settings') — Danger Zone: Delete All Students in a Class
- **OG:** index.stripped.html L17783-17864 — openDeleteClassStudentsModal flow with live count and type-to-confirm
- **Now:** app/portal/(app)/admin/data/DangerZone.tsx — exactly 3 "This permanently deletes" cards; lib/portal/actions/students.ts has no deleteClassStudents or bulk equivalent
- **Verified:** Confirmed as stated with no independent nuance to add.
- **Fix:** Add a deleteClassStudents(classId, confirm) action and a 4th Danger Zone card, as proposed.

### `F0217` [MISSING] Confirmed — Agenda CSV import writes immediately on file selection, with no preview or confirm step
- **Role:** admin · **Area:** agenda
- **OG:** index.stripped.html L8815-8827, L8831-8849 — parse and write are separate functions, write only reachable through a confirm() dialog listing week count/unmatched names/skipped rows
- **Now:** app/portal/(app)/agenda/AgendaTools.tsx — onFile()'s reader.onload calls importAgendaCsv(...) directly inside startTransition, no confirm()/preview UI anywhere in the file
- **Verified:** Confirmed by full read of the file with no independent nuance to add.
- **Fix:** Split into a previewAgendaCsv action (parse-only) and the existing commit action, with an explicit confirm panel, as proposed.

### `F0220` [MOVED] The three-mode tab strip is gone from the agenda page (confirmed) — but the claim that "Lesson Archive has no equivalent at all" is wrong: it exists at /portal/lessons?view=archive
- **Role:** admin · **Area:** agenda
- **OG:** index.stripped.html L3209-3211, L8501-8505 — three pill buttons (Edit List / Weekly Assignment View / Lesson Archive) directly under the agenda page title; verified directly
- **Now:** app/portal/(app)/agenda/page.tsx has no Tabs, only a "Weekly assignments" button; BUT app/portal/(app)/lessons/page.tsx (a separate top-level nav item, "Lesson Prep") has its own Tabs/TabLink pair — "By class" vs "Archive · all classes" (view=archive) — backed by listLessonArchive(), rendering a full archive timeline via ArchiveView()
- **Verified:** Confirmed the agenda page's own tab strip is gone. But searching beyond the cited file/route turned up a real, working Lesson Archive equivalent under a different sidebar item entirely (Lesson Prep, not Schedule of the Year). The finding's specific claim that Lesson Archive "has no equivalent at all" is factually wrong, though the broader point — the OG's three co-located modes are now spread across two unrelated top-level pages, hurting discoverability from the agenda page — is real and still supports high severity.
- **Fix:** Add a link/tab from the agenda page to /portal/lessons?view=archive for discoverability, or restore a shared three-tab strip spanning both concepts.

### `F0594` [DEGRADED] Agenda CSV import commits immediately with no preview -- and its unconditional upsert silently overwrites already-filled-in weeks with no warning or undo
- **Role:** admin · **Area:** agenda
- **OG:** OG previewAgendaCSV()/confirmAgendaImport() area L8742-8836
- **Now:** app/portal/(app)/agenda/AgendaTools.tsx onFile() calls importAgendaCsv(lib/portal/actions/agenda.ts:231) immediately; writeWeek() at lines 66-98 does an unconditional upsert
- **Verified:** Confirmed onFile() has no preview step. Traced into writeWeek(): every week/row from the CSV is written via `upsert` with `update: week` and `update: payload` for each activity -- this overwrites slideLink/notes/lead/backup and every activity's topic/servant for any week present in the file, with no merge against what's already saved and no diff shown beforehand. Re-importing a stale, wrong, or partial file over a term a servant already filled in silently destroys that work with no undo. This meets the 'high = data is lost/corrupted' bar in this task's own calibration, not just friction -- upgrading from medium.
- **Fix:** As given: add a dry-run parse+preview step (diff against existing data) before any write, and require an explicit second confirm to commit.

### `F0558` [MISSING] Export All IDs & PINs (plaintext CSV) has no equivalent — PINs are never exportable
- **Role:** admin · **Area:** allstudents
- **OG:** exportAllStudentCredentialsCSV(), index.stripped.html L17952, button at L3375
- **Now:** app/portal/(app)/admin/data/ImportPanel.tsx — 'Export students CSV' has no PIN column by design
- **Verified:** Verified OG stores and exports s.pin in plaintext directly. Verified the new ImportPanel explicitly states 'no export ever contains a PIN or a hash' — a deliberate hashing/security decision, not an oversight. The only way to see any PIN is resetStudentPin (destructive, new value, shown once) or the new-account reveal at import time; there is no batch view of EXISTING students' credentials for e.g. reprinting a whole class's ID cards. Kept at high since there's no efficient recourse for that real workflow.
- **Fix:** Confirm with the user whether this security tradeoff (never storing/showing plaintext PINs) is intentional; if bulk credential handouts are still needed, consider a bulk 'reset & print' flow instead of trying to restore plaintext export.

### `F0195` [MISSING] A register saved on the wrong date can never be removed, and every rate is permanently corrupted
- **Role:** admin · **Area:** attendance
- **OG:** index.stripped.html L13111-13121 and L8890-8915 (absent deletes the doc / prunes presentIds); L18212-18272 (fixOrphanedAttendance, a real but narrower repair tool — it prunes stale present-marks whose points were deleted, not general wrong-date rows)
- **Now:** nowhere — prisma/schema.prisma:341-364 (AttendanceRecord stores real ABSENT rows), lib/portal/reports.ts:51-55 (heldOccasions keys off row existence), lib/portal/actions/attendance.ts (saveAttendance only upserts, never deletes), app/portal/(app)/admin/data/RepairPanel.tsx (5 tools, none of which clear a wrongly-dated session)
- **Verified:** Verified every OG citation matches the described behaviour (with the orphan-tool citation being a real but narrower analog than implied). Verified the new AttendanceRecord model has no equivalent self-healing: any saved date, even all-absent, permanently counts as 'held' for that class/session with no admin recourse anywhere. The only delete on the whole attendance surface is undoScan in lib/portal/actions/qr.ts:641, a single-student, immediate, same-session undo — not a fix for a mistake noticed later. Confirmed exactly as described.
- **Fix:** Add a per-date 'Remove this session' action (admin/servant-of-the-class only) that deletes the AttendanceRecord rows for that class+date+session, letting the PointEntry cascade run, plus a matching entry in RepairPanel.tsx / data-tools.ts. Audit both.

### `F0200` [MOVED] Attendance Report has no sidebar item under Attendance -- an admin looking there for it genuinely won't find it
- **Role:** admin · **Area:** attendance
- **OG:** OG L4017, data-label='Attendance Report', in the 'Attendance & Rewards' sidebar group directly under Attendance
- **Now:** /portal/reports (default tab is Attendance), reached via 'Church Reports'/'Reports' filed under Administration/Community in lib/portal/nav.ts
- **Verified:** Confirmed OG sidebar grouping and label. Confirmed lib/portal/nav.ts's Attendance section (QR Check-in/Servants Attendance/My Attendance) has no report link for any role; confirmed /portal/reports does default to the Attendance tab so the content itself is reachable. This is a textbook match for this task's own calibration ('high = they can do it but will not find it') rather than mere friction -- upgrading from medium to high.
- **Fix:** Add an 'Attendance Report' item to the Attendance nav section pointing at /portal/reports, for ADMIN and SERVANT, as given.

### `F0271` [MISSING] Confirmed — church-wide announcements have no public-facing equivalent anywhere on the new site
- **Role:** admin · **Area:** feed-posts
- **OG:** index.stripped.html L2476-2491 — loadHomeData() step 2, church-wide (!a.classId) announcements block on the SPA's signed-out home view, capped at 4; verified directly
- **Now:** nowhere — app/(site)/page.tsx renders only Hero, QuickActions, WelcomeSection, WeeklyScheduleSection, VisitSection; only mention of "announce" in app/(site) or components/home is an unused bullet string in the unrendered components/home/SubscribeSection.tsx
- **Verified:** Confirmed accurate as stated. Corrected severity only: this church's own calibration explicitly buckets "data lost" scenarios as high, not blocker, and blocker is reserved for a staff member unable to complete a weekly task (attendance, finding a student, printing). This is a lost public communication channel, not a blocked staff workflow — admins can still write announcements via /portal/announcements, they just don't surface to the public.
- **Fix:** Add a server component reading church-wide announcements to app/(site)/page.tsx, as proposed.

### `F0261` [DEGRADED] Lesson Archive lost per-class grouping and the red "No lessons" oversight flag
- **Role:** admin · **Area:** lessons
- **OG:** index.stripped.html L15542-15597 (per-class cards over the 'lessons' collection, red 'No lessons' badge for empty classes), L16111 (filterPtLesson chips)
- **Now:** app/portal/(app)/lessons/page.tsx:96-155 (ArchiveView) + lib/portal/data/lessons.ts:90 (listLessonArchive, cap 200)
- **Verified:** Verified this OG panel is genuinely over the SAME 'lessons' collection as the new Prisma Lesson table (allLessons3 comes from collection(db,'lessons')) — unlike F0592, this is a true same-data-model comparison. Verified ArchiveView iterates lesson rows, not the class list, so a class with zero lessons produces no card at all — silently. No chip row or per-class grouping exists. Kept at high: this removes the tool a pastor uses to notice a servant who has logged nothing all year, a real silent blind spot rather than cosmetic reordering.
- **Fix:** Group ArchiveView by class (iterate classes, not lessons) so empty classes still render with a red 'No lessons' badge, cap each at 5 with a '+N more' expander, and add a class chip row above the cards.

### `F0583` [BROKEN] Confirmed — an account with no linked Servant row (e.g. a pure ADMIN) cannot self-track weekly attendance anywhere in the portal, even through the alternate route
- **Role:** admin · **Area:** myattendance
- **OG:** index.stripped.html L6821-6830 — doc id is activityKey_weekKey_uid, any authenticated uid works; verified
- **Now:** lib/portal/actions/servant-attendance.ts:114-133 (markMyServantAttendance throws without a servantId) AND lib/portal/data/servant-attendance.ts:65-72 loadServantScope()'s query is prisma.servant.findMany(...) — an admin with no Servant row never appears as a grid row anywhere, including at /portal/servant-attendance
- **Verified:** Went beyond the finding's own evidence (which only names the dead markMyServantAttendance action) to check whether the alternate write surface discovered while verifying F0579/F0582 fixes this — it does not: loadServantScope queries the Servant table directly, so a Servant-less account (isSelf checks s.id === user.servantId) can never appear as a writable or even visible row. The gap is real and total for that account type.
- **Fix:** Let ADMIN self-track keyed by accountId directly, or auto-provision a Servant row for admin accounts that also serve. Severity lowered from blocker because it only affects accounts lacking a Servant profile and doesn't block the core class-attendance-taking workflow.

### `F0125` [MISSING] Confirmed — no per-class checkbox / Select All / Print Selected on Church Reports; only a generic print-everything button (which already covers "Print All Classes")
- **Role:** admin · **Area:** reports
- **OG:** index.stripped.html L7431-7433, L7636-7638 — Select All / Print Selected / Print All Classes buttons with a guard toast; pattern consistent with rest of OG
- **Now:** app/portal/(app)/reports/page.tsx (church tab) + ReportFilters.tsx — one class <select> filter (single class), a generic PrintButton that always prints every class currently rendered
- **Verified:** Confirmed by full read: all classes render unconditionally on the church report, so "Print All Classes" is trivially already the default. Only the finer-grained "Print Selected" (a filtered subset for handing to specific coordinators) capability is actually gone. Severity corrected down from blocker since basic printing already works out of the box.
- **Fix:** Add per-class checkboxes + Select All, carry selection in the URL, and filter the print view by it.

### `F0604` [MISSING] "Edit Activity Days" modal — no way to change a servant activity's day of week
- **Role:** admin · **Area:** servantattendanceall
- **OG:** openServantActivityTimesModal()/saveServantActivityTimes(), OG L7996-8027; modal markup L19782-19797
- **Now:** nowhere
- **Verified:** Verified prisma/schema.prisma has ServantActivity.dayOfWeek (L452-458), read only by lib/portal/data/servant-attendance.ts::listServantActivities(). Grepped all lib/portal/actions for 'ServantActivity' — zero write paths. No admin UI references this anywhere. Genuinely impossible today short of a direct DB edit.
- **Fix:** Add an admin action (updateServantActivity) and a small settings UI to edit each ServantActivity's dayOfWeek/label/isActive.

### `F0548` [MISSING] "Export All IDs & PINs" (plaintext CSV) for servants is architecturally impossible now — PINs are hashed, and there is no bulk credential-reissue flow to replace it
- **Role:** admin · **Area:** servants
- **OG:** exportAllServantCredentialsCSV(), OG L3014 / def L17977-17990
- **Now:** /portal/admin/data "Export servants CSV" has no PIN column; no bulk PIN reset exists (resetServantPin/resetStudentPin are single-id only)
- **Verified:** Confirmed Account.pinHash (hashed, not plaintext) in prisma/schema.prisma. Confirmed ImportPanel.tsx states no export ever contains a PIN or hash. Confirmed no bulk-reset action exists anywhere (grep for bulkReset — zero). This is a deliberate, sound security fix; the finding already correctly frames it as a decision to confirm with the user rather than a bug to fix by restoring plaintext.
- **Fix:** Build a bulk 'reset PINs for N selected servants and export the new IDs+PINs once' flow (server generates fresh PINs, returns them once, never persists plaintext) rather than restoring the old export.

### `F0552` [MISSING] No search box on the "All Servants"/Servants admin page (students have one; servants don't)
- **Role:** admin · **Area:** servants
- **OG:** sv-name-search input, OG L3068-3069
- **Now:** nowhere
- **Verified:** Read the full app/portal/(app)/admin/servants/page.tsx (167 lines) — no input/filter of any kind. Confirmed no global/app-wide search exists either. Notably app/portal/(app)/admin/students/page.tsx DOES have a working name/ID search box, confirming a real asymmetry between the two admin people-lists.
- **Fix:** Add a client-side name-filter input (or a `q` query param like the Students page uses) to app/portal/(app)/admin/servants/page.tsx.

### `F0554` [MISSING] "View ID" (show existing PIN without changing it) is architecturally impossible now — only Reset PIN exists
- **Role:** admin · **Area:** servants
- **OG:** showServantCredentialsModal(...), OG L3133
- **Now:** /portal/admin/servants/[id] via components/portal/ServantForm.tsx — only a "Reset PIN" button (resetServantPin), which invalidates the old PIN
- **Verified:** Confirmed Account.pinHash is hashed, so an existing PIN is cryptographically unrecoverable — 'view without changing' cannot exist. Confirmed ServantForm.tsx's only credential control is Reset (with a confirm() prompt), which issues a brand-new PIN. Same deliberate tradeoff as F0548.
- **Fix:** Confirm with the user that this tradeoff is acceptable; if forgotten-PIN lookups without invalidation are needed often, the only real option is a short-lived admin-visible plaintext cache at creation/reset time with a TTL, which is itself a security tradeoff to weigh carefully.

### `F0672` [MISSING] "Reset Activities to Standard 6" (church-wide, preserves the 6 standard activities) does not exist — only a per-class, delete-everything variant does
- **Role:** admin · **Area:** settings
- **OG:** settingsRow OG L2913-2916; resetActivitiesToStandard5() L18087-18106
- **Now:** app/portal/(app)/admin/data/DangerZone.tsx — only "Reset a class's point activities", per-class, unconditional deleteMany with no standard-key filter
- **Verified:** Read DangerZone.tsx in full — exactly 3 tools, none church-wide, none standard-preserving. Verified lib/portal/actions/data-tools.ts::resetClassActivities does `tx.pointActivity.deleteMany({ where: { classId: cls.id } })` — no filter at all, single class only. Grepped for 'STANDARD' across lib/portal — zero hits.
- **Fix:** Add a 4th Danger Zone tool that loops every class and deletes only non-standard-key point activities, matching the OG's scope (all classes) and safety (never touches the six standard activities).

### `F0673` [MISSING] "Delete All Students in a Class" (pick one class, keep class & servants) does not exist — only a church-wide end-of-year reset does
- **Role:** admin · **Area:** settings
- **OG:** settingsRow OG L2918-2921; openDeleteClassStudentsModal() L17783, runDeleteClassStudents() L17831-17877
- **Now:** app/portal/(app)/admin/data/DangerZone.tsx has no such tool
- **Verified:** Confirmed endOfYearReset (lib/portal/actions/data-tools.ts:974+) takes no classId parameter and unconditionally deletes every student church-wide — cannot substitute for a single-class tool. Grepped for deleteClassStudents/DeleteClassStudents/bulkDeleteStudent across lib/portal and app/portal — zero matches.
- **Fix:** Add a 4th Danger Zone tool: pick a class, type its name to confirm, bulk-delete only that class's students and their dependent records (points/attendance/quiz/bible-reading/follow-ups), mirroring the OG's runDeleteClassStudents().

### `F0055` [BROKEN] Confirmed exactly as stated — student CSV import misreads the un-spaced "ParentEmails" header, silently writing the student's own email into parentEmails; Phone is dropped entirely
- **Role:** admin · **Area:** students
- **OG:** index.stripped.html L10791 — STUDENT_CSV_COLS includes 'ParentEmails' as one camelCase word with no separators; verified
- **Now:** lib/portal/csv.ts:98 normaliseHeader (strips to 'parentemails', no space) + lib/portal/actions/data-tools.ts:415 pick list ('parent emails','parent email','emails','email' — none match) + prisma/schema.prisma:266-291 (Student has no email/phone columns)
- **Verified:** Independently re-derived the bug from first principles (normaliseHeader's regex behavior on an already-alphanumeric string) rather than just trusting the finding's claim, and it holds exactly as described: pick() falls through to 'email' (the student's own column), corrupting parentEmails, while Phone is never picked for students at all and Student has no email/phone fields to fall back to. Severity corrected: this church's calibration explicitly buckets data corruption as high, not blocker.
- **Fix:** Add 'parentemails' to the pick list, give the student's own email its own field (write to Account, which has email/phone columns), and pick 'phone' for students too.

### `F0058` [MISSING] Admin bulk student actions are gone: no selection checkboxes, no sticky action bar, no bulk Move/Delete, no Select All
- **Role:** admin · **Area:** students
- **OG:** OG L3265-3266 (per-card checkbox), L3281 (group-header checkbox), L3367 (global Select All), L3370-3379 (sticky bar: adBulkMoveStudentsToClass, adBulkDeleteStudents, Deselect All)
- **Now:** nowhere — app/portal/(app)/admin/students/page.tsx has only a per-student single-item MoveStudentSelect dropdown; deletion is single-student-at-a-time from app/portal/(app)/students/[id]/StudentProfileActions.tsx
- **Verified:** Spot-checked the OG sticky bar directly (L3369-3378) and confirmed it matches the finding precisely (position:sticky, 'N selected', Move-to-class select, Delete Selected, Deselect All). Read the full admin/students/page.tsx and MoveStudentSelect.tsx: zero checkboxes, zero bulk affordances anywhere.
- **Fix:** Add per-card and per-group-header checkboxes plus a global Select All to admin/students/page.tsx, and a sticky action bar calling new bulkMoveStudents(ids, classId) / bulkDeleteStudents(ids) server actions built on the existing moveStudent/deleteStudent logic.

### `F0060` [MISSING] CSV import template download is gone, while the Help page still tells admins to download it first
- **Role:** admin · **Area:** students
- **OG:** Template link OG L4636; downloadStudentImportTemplate() L10957-10964
- **Now:** nowhere — app/portal/(app)/admin/data/ImportPanel.tsx has Export/Choose/Import buttons only, no Template control
- **Verified:** Grepped ImportPanel.tsx for 'Template'/'template' — zero matches; read the full button row, confirmed no template control. Independently re-read help/page.tsx:61-66, confirmed it literally says '...download the template first so the columns line up' — actively misleading, not just an omission.
- **Fix:** Add a 'Download template' button to ImportPanel.tsx that emits the exact header importStudentsCsv's pick-list accepts plus one worked example row, matching exportStudentsCsv's column order for a lossless round trip.

### `F0061` [DEGRADED] CSV import commits immediately with no preview step, though the Help page promises a preview "before anything is saved"
- **Role:** admin · **Area:** students
- **OG:** Preview modal OG L11087-11115; Import All commits L11117-11158; skip-report modal L2337-2345 + L19312-19324
- **Now:** app/portal/(app)/admin/data/ImportPanel.tsx
- **Verified:** Verified importStudentsCsv(csvText, defaultClassId) has no dryRun parameter. Verified ImportPanel.tsx: pickFile() only reads the file into local state; a separate runImport() button calls importStudentsCsv directly and only afterwards renders the 'summary' — the write has already happened by the time anything is shown. Reconfirmed help/page.tsx:65's 'You see a preview of every row... before anything is saved' is factually false against this code.
- **Fix:** Add a dryRun param to importStudentsCsv that runs the parse/validate passes without writing and returns the same ImportSummary shape; have ImportPanel call it on file pick, show the preview + skip list, and only call the real (writing) import on a second explicit button press. Fix the Help page copy in the meantime regardless.

### `F0066` [MISSING] Bulk Edit (mass single-field edit across many students) doesn't exist at all — not just its Undo — and CSV import has no Undo either; the Help page promises both
- **Role:** admin · **Area:** students
- **OG:** Undo toast markup OG L1404-1407, showUndoToast() L2417-2432; bulk-edit snapshot + undoBulkEditStudents() L10650-10685; openBulkEditStudents() L10541 (the feature itself); import undo L11160-11182
- **Now:** nowhere for either the Bulk Edit feature or any Undo
- **Verified:** The original title/framing centers on 'Undo' being missing, which understates the gap: I grepped app/portal, lib/portal and components/portal for 'bulkEdit'/'BulkEdit'/'bulk edit' and the ONLY hit anywhere in the codebase is app/portal/(app)/help/page.tsx describing a feature ('bulk edit changes one field... Promoting a whole class to the next grade becomes one action rather than thirty') that has zero implementation. CSV import does exist (importStudentsCsv) but performs direct writes with no prior-value snapshot, confirming no undo is possible for it either.
- **Fix:** Build the Bulk Edit feature itself first (pick a field, pick students, apply one value) — it doesn't exist to have an Undo for. Then add prior-value snapshot + an 8s Undo action to both it and importStudentsCsv, matching the OG's honest caveat about login accounts on import-undo.

### `F0152` [BROKEN] /portal/photo is a fully-built orphan route — no nav entry, crest, or avatar links to it anywhere, so nobody can discover how to change their photo
- **Role:** all · **Area:** nav-ia
- **OG:** index.stripped.html: L2701 admin sidebar crest onclick="openMyPhotoModal()", L19119 pastor sidebar crest (identical), L5613 servant My Profile avatar onclick="openMyPhotoModal()", L12392 student profile avatar (same pattern) — all four click paths confirmed real in the OG
- **Now:** app/portal/(app)/photo/page.tsx — confirmed fully wired (setMyPhoto/removeMyPhoto). Confirmed zero inbound UI links: grep of app/portal, components/portal, lib/portal for 'portal/photo'/'/photo' only turns up revalidatePath('/portal/photo') calls in lib/portal/actions/photos.ts (cache revalidation, not a link). lib/portal/nav.ts has no photo entry in any role. Shell.tsx's crest image just Links to /portal. There is also no self-view 'My Profile' page in the new portal at all (only an admin-facing students/[id] view of a student's profile).
- **Verified:** Matches the finding exactly. All four OG entry points (admin crest, pastor crest, servant profile avatar, student profile avatar) are confirmed gone with no replacement path of any kind — this is a genuine 'fully built but 100% undiscoverable' case, which is exactly the calibration's definition of high severity ('can do it but will not find it').
- **Fix:** Add a nav entry (fold into a future /portal/profile page, or link the crest/avatar image) so the already-working /portal/photo page becomes reachable.

### `F0132` [MOVED] My Stage no longer embeds the reports system; "Print Stage Report" label is gone
- **Role:** all · **Area:** reports
- **OG:** index.stripped.html L16974-16981 renderChurchReportsPage('mystage-reports-container', stage) embedded at the bottom of the stage overview (comment: 'the same reports system admin uses ... scoped to this stage's classes'); L7326-7369 stage-scoped fetch; L7433 print button label switches to 'Print Stage Report' when activeStage is set — all confirmed exactly as cited
- **Now:** app/portal/(app)/my-stage/page.tsx (read in full — classes/servants/students stat cards only, zero reports content/import). Stage-scoping logic genuinely exists but relocated to lib/portal/data/reports.ts:198-217 churchReportScope(), used by app/portal/(app)/reports/page.tsx, reached via a generic 'Reports'/'Church Reports' sidebar item (lib/portal/nav.ts).
- **Verified:** Verified on every point: OG behavior, current total absence from My Stage (read the whole page file), and the real but relocated/unlabeled replacement (churchReportScope correctly scopes SERVANT+stageOversight to their stage's classes). Grepped case-insensitively for 'print stage'/'stage report' across app/portal, components/portal, lib/portal: zero matches; PrintButton (components/portal/PrintButton.tsx) always defaults to plain 'Print'. High severity is justified: a stage coordinator lands on their day-to-day My Stage page and finds no reports at all, with no textual clue that the separate, generically-labeled 'Reports' sidebar item is where their stage-scoped view now lives.
- **Fix:** Embed the stage-scoped church report at the bottom of /portal/my-stage (reuse churchReportScope/loadChurchReport), or at minimum add a prominent 'Stage reports →' link from My Stage to /portal/reports, and relabel the print button 'Print stage report' when scope is a stage.

### `F0809` [MISSING] One-click "Print [this class]" button with no navigation or filters
- **Role:** pastor · **Area:** Pastor Dashboard (per-class card) / Pastor+Admin Classes page (per-class row) / Servant Class Profile
- **OG:** OG dashboard/classes buttons L15383, L15478; printClassReport L15652-15762; servant button L4831 (verified: printServantClassReport() next to 'Print Report'); printServantClassReport L18034
- **Now:** nowhere — re-ran the citing greps: no print/Print in classes/[id]/page.tsx, classes/page.tsx, or app/portal/(app)/page.tsx; grep -rln PrintButton app/portal/(app)/ lists 9 files, none a class list, class detail, or dashboard
- **Verified:** Confirmed as the broadest, most accurate framing of this gap. F0762 and F0780 describe the identical missing feature narrowly from the pastor's angle and are marked DUPLICATE of this one.
- **Fix:** Add an inline 'Print class report' button to the class detail page and to class cards on the dashboard/Classes list.

### `F0197` [DEGRADED] The Attendance Report shows one session at a time — the OG showed all six side by side per week
- **Role:** pastor · **Area:** attendance
- **OG:** OG weeklyreport L6228-6284, renderAttendanceMonthTable L8938-9017, abbrMap L8944 — verified
- **Now:** app/portal/(app)/reports/page.tsx:236-243 (single sessionKey only); AttendanceMatrix.tsx has no week-grouped multi-session layout; no legend/abbrMap anywhere in reports/
- **Verified:** Confirmed exactly as described.
- **Fix:** Add an 'All sessions' mode grouping columns by week with one sub-column per session, the OG abbreviation map, and the session legend strip.

### `F0044` [MISSING] 'My Profile' is gone: servants can no longer edit their own email, phone, address or birthday
- **Role:** pastor · **Area:** auth-login
- **OG:** OG sidebar L4041, dropdown L1607, mobile bar L1616; page body L5609-5648 (editable contact fields + Save Changes)
- **Now:** app/portal/(app)/settings/page.tsx (read-only Account card + ChangePinForm only); lib/portal/actions/account.ts exports exactly changeOwnPin
- **Verified:** Confirmed by reading both files in full — zero editable contact fields, zero other actions, no other self-service page exists anywhere in the portal.
- **Fix:** Restore a 'My Profile' page carrying the OG's four editable contact fields over a new updateOwnContactDetails server action, with Change PIN below it.

### `F0078` [MOVED] Pastor dashboard gutted — per-class Quiz Avg / Attendance / Top student, the Attendance Overview list and the church-wide Servants roster are gone or moved behind Church Reports
- **Role:** pastor · **Area:** dashboard
- **OG:** OG L15294-15430; stat tiles L15352-15357; class cards w/ quiz-avg border + Print button L15373-15392 (verified printClassReport call present); Attendance Overview L15394-15409; Servants section L15411-15426
- **Now:** app/portal/(app)/page.tsx — PASTOR shares StaffHome with ADMIN/SERVANT (confirmed no Attendance Overview or Servants section, no quiz-avg border/Print button on pastor's ClassCard rows); /portal/admin/servants hard-blocks non-ADMIN
- **Verified:** Fully confirmed by reading the file end to end. Quiz-avg/attendance data did move to /portal/reports?tab=church (verified those fields exist there); the Servants roster is genuinely MISSING for pastor. The finding's own hedge ('gone or moved') is accurate.
- **Fix:** Give PASTOR its own dashboard branch with the church-wide Quiz Avg tile, per-class metrics with the OG's colour bands, the Attendance Overview list, and a read-only Servants section.

### `F0305` [MISSING] Existing OG events (`schedule` collection) were never migrated — the importer has no path for them
- **Role:** pastor · **Area:** events
- **OG:** OG `schedule` Firestore collection, addDoc L14847-14860; exportAllData backup list L18006; class-delete cascade L3615 — all verified by direct read
- **Now:** nowhere — lib/portal/import-transform.ts has zero references to `schedule` (confirmed by grep); prisma.portalEvent is only written by createEvent() in lib/portal/actions/events.ts
- **Verified:** Confirmed real: the importer drops `schedule` entirely, so any Firebase-backup restore leaves the Events calendar empty of history. Downgraded from blocker to high — this is one-time historical data loss on migration, not an ongoing weekly task that's blocked (creating a NEW event today works fine via createEvent()). Calibration buckets 'data lost/corrupted' under high.
- **Fix:** Extend transformBackup() to read backup.schedule and emit ImportEvent rows (title/date/time/location/link/notes/targetAll/targetClassIds), upserted idempotently by legacy doc id in scripts/import-firebase.ts.

### `F0025` [MISSING] The Student Profile lost its exam results card
- **Role:** pastor · **Area:** exams
- **OG:** OG L5061-5067 (pExamHistory, top 10 reversed, ≥70% green/else red), L5099 (placement) — verified
- **Now:** app/portal/(app)/students/[id]/page.tsx — confirmed zero occurrences of QuizResult/exam/quiz anywhere in the file
- **Verified:** Confirmed by direct grep — no import, query, or card referencing exam data on the student profile. QuizResult already has the needed (studentId, submittedAt desc) index.
- **Fix:** Add an 'Exam results' Card querying the student's last 10 QuizResults, rendering title + percentage with ≥70 green / below red, and an empty state.

### `F0026` [DEGRADED] Exam statistics lost the Pass Rate tile and the ranked ALL RESULTS list with A–F letter grades
- **Role:** pastor · **Area:** exams
- **OG:** OG L15117-15132 (3-tile row incl. Pass Rate), L15119-15123 (A-F ladder), L15163-15175 (ranked list with letter) — verified
- **Now:** app/portal/(app)/exams/[id]/page.tsx — confirmed exactly 4 tiles (Submitted, Average, Best question, Hardest question); Results table has Student/Score/%/Band/Submitted only, no rank, no letter; gradeFor/GRADES exist only for the distribution histogram
- **Verified:** Confirmed exactly as described by reading the full file.
- **Fix:** Add a Pass rate tile using the existing gradeFor helper, and add a rank column plus the A-F letter to the Results table.

### `F0097` [BROKEN] Follow-up cases never open or close on QR check-ins — the sync logic lives only inside the manual Save-attendance action
- **Role:** pastor · **Area:** followups
- **OG:** OG renderVisitationTab() L17137-17204 recomputes cases on every open of the Follow-up tab, from any attendance-recording path — verified by direct read
- **Now:** lib/portal/actions/attendance.ts saveAttendance() lines ~99-154, gated by `if (session.key === 'sunday')`; confirmed zero followUpCase references anywhere in lib/portal/actions/qr.ts (670 lines); both GroupCodePanel.tsx and ScanPanel.tsx preselect 'sunday' as the default QR session
- **Verified:** Confirmed real and reproduced independently: QR-based Sunday check-in (the default flow) never opens or closes a follow-up case. Downgraded from blocker to high — attendance-taking itself succeeds; only the downstream pastoral-care automation silently fails, which the calibration explicitly places under high ('data is lost/corrupted'), not blocker.
- **Fix:** Extract the streak/open/close block into a shared syncFollowUps(classId, studentIds), call it from both QR paths in qr.ts after the transaction commits, and call it on every render of /portal/follow-ups.

### `F0104` [BROKEN] The pastor cannot open a manual follow-up case — the UI blocks what the permission model allows
- **Role:** pastor · **Area:** followups
- **OG:** OG L18586-18587 (pastor's own '+ Add Follow-up' -> openManualVisitModal()), servant twin L17279
- **Now:** app/portal/(app)/follow-ups/page.tsx:41,45-47; lib/portal/permissions.ts can() confirmed PASTOR's followup.write returns true unconditionally; createManualCase's only guard (assertClassAction ... 'followup.write') would pass
- **Verified:** Fully confirmed by reading the permission logic directly. This is the more complete/accurate of the two findings describing this gap; F0771 is its duplicate.
- **Fix:** Delete the role special-case and drive the form off can(user, 'followup.write', ...), loading the student list for pastors too.

### `F0105` [DEGRADED] The pastor's church-wide view lost its per-class grouping, open/all-clear chips and church-wide count
- **Role:** pastor · **Area:** followups
- **OG:** OG L18586 (header + church-wide count), L18589-18602 (per-class cards, chips, resolved block)
- **Now:** app/portal/(app)/follow-ups/page.tsx — confirmed a single flat cases.map() list with class name only as a detail row, two generic Open/Resolved StatCards, hard-coded subtitle; no groupBy, no per-class card
- **Verified:** Confirmed by reading the full page body. At real church scale (many classes, up to 200 cases), a flat ungrouped list is a genuine usability regression for the pastor's cross-class overview role.
- **Fix:** Group cases by class into one card per class with the open-count/all-clear chip, and set the subtitle to the church-wide open count (openCount is already computed).

### `F0107` [MISSING] The one-open-case-per-student rule is gone, and the auto rule ignores manual cases
- **Role:** pastor · **Area:** followups
- **OG:** OG manual duplicate guard L17440-17451; auto rule scans all open cases regardless of reason L17154-17155/17162
- **Now:** lib/portal/actions/followups.ts:92-105 createManualCase has no duplicate check; lib/portal/actions/attendance.ts's openAuto query filters origin:'AUTO' (confirmed by direct read)
- **Verified:** Confirmed both halves directly in the code — a student can end up with two simultaneously open cases (one manual, one auto).
- **Fix:** Reject duplicate opens in createManualCase; drop the origin:'AUTO' filter when deciding whether to OPEN in attendance.ts (keep it for auto-CLOSE).

### `F0755` [MISSING] Quiz Avg stat card (church-wide average) is gone from the pastor dashboard
- **Role:** pastor · **Area:** overview
- **OG:** Pastor overview stat row, OG L15353-15357 (Students, Servants, Classes, Quiz Avg)
- **Now:** app/portal/(app)/page.tsx:41-51 StatCards are Classes/Servants/Students/Open follow-ups; no quiz metric on /portal for any role
- **Verified:** Confirmed by reading both the OG stat-row markup and page.tsx. The number does exist elsewhere -- report.totals.quizAverage renders as a StatCard at /portal/reports?tab=church (reports/page.tsx:145-151) -- but that tab isn't linked from the dashboard and isn't the default (see F0775), so it isn't discoverable at a glance.
- **Fix:** Add a quiz-average StatCard to the staff dashboard for ADMIN/PASTOR, or make /portal/reports?tab=church the pastor's default landing and link it from the dashboard.

### `F0759` [MISSING] Full church-wide servant roster is unreachable for the pastor role
- **Role:** pastor · **Area:** overview
- **OG:** Pastor overview servant list, OG L15414-15426 (avatar, name, assigned class or 'No class assigned', student count)
- **Now:** nowhere reachable by PASTOR
- **Verified:** Confirmed, and the block is stronger than the original evidence stated: lib/auth.config.ts:75-78 bounces (redirects) any non-ADMIN role at the middleware level for any /portal/admin/* path unless it matches PASTOR_READABLE_ADMIN, which is hard-coded to '/portal/admin/audit' only (line 22). PASTOR never even reaches admin/servants/page.tsx's own role check. No servant list exists anywhere else on /portal for PASTOR.
- **Fix:** Add /portal/admin/servants to PASTOR_READABLE_ADMIN in lib/auth.config.ts (read-only), or restore a servants list on the pastor's dashboard.

### `F0760` [DEGRADED] Per-class card lost servant name, quiz avg, top student, and print button for the pastor
- **Role:** pastor · **Area:** overview
- **OG:** OG L15379-15397 (servant name, quiz avg %, top student, Print button); printClassReport L15652
- **Now:** app/portal/(app)/page.tsx:86-114 ClassCard
- **Verified:** Confirmed by full read. ClassCard rows are Stage/Students/Servants(count, not name)/Sundays(4wks)%; actions={user.role === 'PASTOR' ? undefined : (...)} at page.tsx:101-112 means PASTOR gets zero action buttons on the card, not just no print button.
- **Fix:** Show servant display name, add quiz-avg + top-student rows, give pastor a read-only print action.

### `F0124` [MISSING] Church report class cards are not clickable — the per-class, per-metric student drill-in is gone
- **Role:** pastor · **Area:** reports
- **OG:** OG L7519-7521 (onclick=openChurchReportClassModal), L7606-7628 (modal built from classStudentRowsHtml) — verified
- **Now:** app/portal/(app)/reports/page.tsx:168-221 renders ClassCard with no href; components/portal/ui.tsx:249-273 confirms ClassCard supports an unused optional href; grep for modal|drill in that directory returns nothing
- **Verified:** Confirmed, and checked for an alternate path: classes/[id]/page.tsx shows a roster but only an all-time Sunday attendance rate, not the report's chosen date range/session/mode. For the specific query a pastor just ran, there is genuinely no per-student view anywhere else. Kept at high.
- **Fix:** Pass an href on the ClassCard (or add a per-class detail route/modal) carrying the class id and the current report's query params through to a student-level breakdown.

### `F0126` [MISSING] The printable church report — letterhead, period line, per-student tables — is gone; PrintButton just prints the screen (which itself has no per-student rows)
- **Role:** pastor · **Area:** reports
- **OG:** OG printChurchReports() L7630-7702 (letterhead L7648-7654, per-class student table L7661-7688, cross footer L7689-7692, preview overlay L7694-7701) — verified
- **Now:** components/portal/PrintButton.tsx confirmed 14 lines, body is exactly onClick={() => window.print()}; confirmed no @page/landscape CSS anywhere in the app
- **Verified:** Confirmed. Downgraded from blocker to high — window.print() still produces a printout (stat tiles + class cards), so printing isn't blocked outright; the OG's specific letterhead/per-student document is what's missing, and the raw data remains reachable via the adjacent CSV export.
- **Fix:** Give the church report a dedicated hidden print:block section with letterhead, period line, printed-on date, and one page-break-avoiding block per class with student rows.

### `F0127` [DEGRADED] Exam Scores and Points report modes are gone -- the church report is one fixed view
- **Role:** pastor · **Area:** reports
- **OG:** OG L7332-7334 (three mode-switch buttons), L7487-7507 (computeClassStat per mode; Points mode's headline is avgPts = totalPts / studentCount, a per-student average, not a class total)
- **Now:** app/portal/(app)/reports/page.tsx:220 renders { key: 'Points', value: c.pointsTotal.toLocaleString() } -- a raw class total
- **Verified:** Confirmed via grep (no 'exam scores'/'points mode' anywhere in app/portal/(app)/reports/) and a read of the church-report branch: no mode switch, no per-metric class-card headline change, no Points-mode student ordering exists anywhere on the page.
- **Fix:** Add ?mode=attendance|exams|points to the church tab, switch the class card headline and drill-in ordering on it, surface a per-student points average as the Points-mode headline.

### `F0128` [DEGRADED] Period filter lost 'All Time' and 'By Month'; the church report silently defaults to the last 90 days
- **Role:** pastor · **Area:** reports
- **OG:** OG L7415-7429 (three period buttons), L7461-7467 (auto-select latest month)
- **Now:** app/portal/(app)/reports/ReportFilters.tsx, church tab passes show:{range:true, session:true} only (reports/page.tsx:127); reports/page.tsx:94 unconditional today-90-days default
- **Verified:** Confirmed by reading the whole ReportFilters component: only From/To date inputs and a Session select are rendered for the church tab. No All Time button, no month picker, and no UI indication that a 90-day filter is even silently active.
- **Fix:** Add All Time and By Month controls to the church tab's ReportFilters, and state the active period mode in words in the header.

### `F0133` [MISSING] Every dashboard chart is gone -- no charting library exists anywhere in the project
- **Role:** pastor · **Area:** reports
- **OG:** OG L2028-2103 (renderDashboardCharts), L1975-2010 (renderChurchWideCharts, called for admin and pastor overviews)
- **Now:** nowhere; no chart library, canvas, or SVG chart component exists in the new portal
- **Verified:** Re-verified with independent searches: no chart.js/recharts/d3 in package.json; grep for <canvas>/svg chart/sparkline/trend across app/portal, components/portal, lib/portal returns only components/portal/QrScanner.tsx:193's hidden decoder canvas, unrelated to charting.
- **Fix:** Decide explicitly whether charts come back (e.g. inline-SVG sparklines using data that already exists in lib/portal/data/reports.ts) or record the decision so it isn't rediscovered as a bug.

### `F0775` [MOVED] 'Church Reports' sidebar link lands on the wrong default tab for the pastor
- **Role:** pastor · **Area:** reports
- **OG:** OG L15637-15638: pastor's nav item calls renderChurchReportsPage(containerId, null) directly, landing on the all-classes church grid
- **Now:** app/portal/(app)/reports/page.tsx:75 defaults to the single-class Attendance tab unless ?tab=church is in the URL; lib/portal/nav.ts:65 links plainly to /portal/reports
- **Verified:** Confirmed. Also checked reportClasses()/listVisibleClasses -- PASTOR does get a non-empty class list, so the wrong-tab landing looks plausible rather than broken/empty, making it easy to mistake for the real report.
- **Fix:** Make /portal/reports default to ?tab=church for PASTOR, or split into separate nav items.

### `F0291` [DEGRADED] Weekly Report lost the servants x weeks x activities matrix -- you can no longer see WHICH week a servant missed
- **Role:** pastor · **Area:** servant-attendance
- **OG:** OG L8080-8089 (two header rows: week-span + activity abbreviation), L8098-8106 (per-cell checkmark/E/X/dash glyphs)
- **Now:** app/portal/(app)/servant-attendance/report/page.tsx 'By servant' table; lib/portal/data/servant-attendance.ts:192-214 servantAttendanceReport()
- **Verified:** Confirmed: the per-week cells (SessionWeekRow, each carrying week) are computed but immediately collapsed via attendanceRate(slice) into one aggregated {attended, held} per activity for the whole range before the function returns -- the per-week status never reaches the page. The raw data isn't lost from the database, just discarded before rendering.
- **Fix:** Return the raw (servantId, activityKey, week, status) rows from servantAttendanceReport and render a sticky-first-column table with a week-group header row and activity abbreviations, using the existing checkmark/E/X/dash glyphs.

### `F0824` [MISSING] Points-history search box (student name or reason) — confirmed missing
- **Role:** servant · **Area:** Servant > Points > History tab (renderPointsHistoryPage)
- **OG:** OG #ph-search input and onPhSearchInput (L9739, L9800-9803), part of the full-class 'Points History — All Students' view invoked from the servant grades page (L5847/9902)
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx 'Recent activity' card (read L284-314 in full) — plain <ul>, no input of any kind
- **Verified:** Confirmed by reading the full Recent-activity block — there is genuinely no search field. Independently found a compounding issue: the page that supplies this list (app/portal/(app)/classes/[id]/points/page.tsx:27) caps history at take: 60 with no pagination, so in an active class older transactions become unreachable with no way to search for them. Kept at high given this.
- **Fix:** Add a search input filtering the Recent-activity list by student name or reason, and either paginate past the 60-row cap or add server-side search so old transactions remain findable.

### `F0825` [MISSING] Points-history filter chips (All / Added Points / Removed Points) — confirmed missing
- **Role:** servant · **Area:** Servant > Points > History tab (renderPointsHistoryPage)
- **OG:** OG chip markup (L9741-9744) and setPhFilter (L9765-9773), filtering the points ledger by sign
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx — no equivalent control anywhere; grep for any add/remove filter across app/components/lib for points history is clean
- **Verified:** Confirmed genuinely absent. Same compounding factor as F0824 (60-row cap, no pagination) makes the lack of any filter more consequential than it would be on an unbounded list. Kept at high.
- **Fix:** Add All/Added/Removed filter controls above the Recent-activity list, filtering client- or server-side by sign of points.

### `F0826` [MISSING] Points-history group-by control (Flat / by Student / by Date / by Servant, with per-group net-points subtotal) — confirmed missing
- **Role:** servant · **Area:** Servant > Points > History tab (renderPointsHistoryPage)
- **OG:** OG select markup (L9736-9744), setPhGroup (L9743), grouping + subtotal rendering (L9852-9874)
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx — the Recent-activity list is a flat, ungrouped, unsubtotaled list capped at 60 rows; no grouping code found anywhere in the new portal
- **Verified:** Confirmed genuinely absent — no grouping, no subtotals, anywhere in the points UI. This was the OG's main tool for a servant to answer 'how many net points has this student earned this term' or 'what did I (as a servant) award this week' at a glance; now that requires manual tallying from a flat, capped list. Kept at high.
- **Fix:** Add a group-by control (Student/Date/Servant) with a per-group net-points subtotal to the Recent-activity card, matching the OG's grouped table rendering.

### `F0804` [BROKEN] Copy lesson plans from another class is broken for a typical servant (empty source list) and all-or-nothing instead of per-lesson
- **Role:** servant · **Area:** Servant → Curriculum / Lesson plan screen
- **OG:** L15899-15956 (openCopyPlanModal/loadCopyPlanLessons/copyLessonToMyPlan)
- **Now:** app/portal/(app)/lessons/page.tsx line 69 (copySources) + LessonManager.tsx copy(); lib/portal/actions/lessons.ts copyLessonsFromClass line 156-166; lib/portal/permissions.ts visibleClassIds lines 62-67 and can() lines 87-101
- **Verified:** Independently confirmed: copySources is built from listVisibleClasses(user), which for a SERVANT is restricted to assigned/stage-overseen classes (permissions.ts). For the typical single-class servant this list is empty after excluding their own class, so the UI reads 'There is no other class you can copy from.' The server action also gates the source read on the same assigned/stage condition, so even a hand-crafted request would fail. Also confirmed the copy is all classes' worth at once with no per-lesson picker. Matches the finding exactly.
- **Fix:** Broaden copySources to every active class (as the OG did) and relax copyLessonsFromClass's source check to class.read-for-any-active-class (or a dedicated 'lesson.copy-source' permission); add a per-lesson list with individual Copy buttons instead of one bulk action.

### `F0793` [MISSING] Certificate generator (button + printable modal) on the Student Profile is entirely absent
- **Role:** servant · **Area:** Servant → Students → Student Profile header
- **OG:** L5077 (button), L6517-6597 (openCertificateModal/generateCertificate), L19708-19735 (modal markup)
- **Now:** nowhere — app/portal/(app)/students/[id]/StudentProfileActions.tsx has only Reset PIN / Mark as reviewed / Delete student
- **Verified:** Independently confirmed via grep -rni certificate across app/, components/, lib/ (excluding _incoming and duplicate 'X 2' files) — zero hits. Read StudentProfileActions.tsx in full to confirm the action bar has no certificate option. OG behaviour (4 preset occasions + custom text, print-ready sheet) fully confirmed at cited lines.
- **Fix:** Add a Certificate action/modal to the student profile reproducing the four CERTIFICATE_TEXTS phrasings plus custom text, pre-filled date, reusing the existing print-page CSS pattern (PrintButton.tsx / .portal-print-page).

### `F0805` [DEGRADED] QR scan review-and-confirm step is gone — every scan writes immediately, with only after-the-fact Undo
- **Role:** servant · **Area:** Servant/Admin → QR Attendance → camera scan modal
- **OG:** L13900-13915, L14037-14135
- **Now:** app/portal/(app)/qr/ScanPanel.tsx lines 1-140 (submitCode -> scanStudent immediately via startTransition; per-row Undo only)
- **Verified:** Read ScanPanel.tsx in full and confirmed: no client-side accumulation, no review screen, no duplicate tally before commit, no single batched save — each decode is an individual server action call the instant it's read. Matches the finding exactly.
- **Fix:** Accumulate decodes client-side, add a Review & Confirm bar with duplicate tally, and make one batched server action the only write path (or at minimum show a pre-commit summary).

### `F0802` [DEGRADED] Editing a past servant meeting's attendance still works via the week-grid stepper, but there is no meeting history list, no source (Manual/QR) tracking, and no bulk delete
- **Role:** servant · **Area:** Servant/Admin → Servants Attendance → "QR Check-in" tab
- **OG:** L7067-7223 (history/cards), L7224-7269 (edit modal), L7299-7318 (delete)
- **Now:** Editing: app/portal/(app)/servant-attendance/page.tsx + ServantGrid.tsx (week stepper, cycle-and-save for any past week). Code generation: app/portal/(app)/qr/GroupCodePanel.tsx (MEETING mode). No history-list/source-badge/bulk-delete equivalent anywhere; prisma/schema.prisma ServantAttendance (lines 461-475) has no `source` field at all.
- **Verified:** The original 'MOVED' verdict undersells and mischaracterizes this. Editing a past meeting's attendance is NOT gone — ServantGrid already lets you step to any past week and cycle any servant's Present/Excused/Absent status, then save (a real, if differently-shaped, equivalent to the edit-attendees modal). What is genuinely and completely gone, confirmed against the Prisma schema: (1) any month-grouped list of 'meetings held' to browse/jump into — you must already know which week to step to; (2) the Manual-vs-QR source distinction, since there is no such column; (3) a one-click bulk delete-this-meeting (only per-cell clearing). Kept at high because losing the ability to audit/undo a whole mistaken meeting in one action, and losing the source distinction, are real data-integrity/usability regressions — but the state is DEGRADED, not MOVED, since the finding's own framing implied nothing at all survived.
- **Fix:** Add a meeting-history list (group ServantAttendance by activityKey+weekStart, newest first) on the Servants Attendance page that deep-links into the existing ServantGrid week view; add a `source` field to ServantAttendance if the Manual/QR distinction is operationally needed; add a bulk-clear action for a given activity+week.

### `F0214` [MISSING] Persistent cross-class curriculum link (curriculumLinkedTo) is gone — the schema column survives from import but nothing reads it; the replacement is a one-time copy, not a live link
- **Role:** servant · **Area:** agenda
- **OG:** Servant → Lesson Preparation → Schedule of the Year → Edit List; gold link banner + 'Share Schedule with Another Class' button (OG resolveAgendaClassId L8164-8174, openLinkCurriculumModal L8176-8193, saveCurriculumLink L8195-8222, buttons L8344-8357, modal L19766-19779; resolveAgendaClassId called on every read/write at L8287, L8549, L8620)
- **Now:** prisma/schema.prisma:244 (curriculumLinkedToId, import-only — populated by lib/portal/import-transform.ts:246 and scripts/import-firebase.ts:141, read nowhere else); replacement is AgendaTools.tsx 'Share this week' → shareAgendaWeek (one-time copy, confirmed by its own on-page text 'sharing copies, it never moves anything')
- **Verified:** Confirmed accurate and well-evidenced. Verified independently: grepped curriculumLinkedTo across the whole repo — only import/migration code touches it, zero reads in the live agenda read/write path. This is the clearest and best-cited of three near-identical findings (F0803, F0492 are the same gap). Severity corrected from blocker to high per this church's calibration: it never blocks a weekly task (both classes can still be edited independently every week), the damage is silent divergence between two schedules that used to be guaranteed identical.
- **Fix:** In lib/portal/data/agenda.ts (loadAgendaWeek, listAgendaWeeks, agendaCsvForClass) and lib/portal/actions/agenda.ts (every write), resolve curriculumLinkedToId the way OG's resolveAgendaClassId did so linked classes address one shared row. Add a banner + link-management UI to /portal/agenda that writes the link bidirectionally and clears the old partner's back-link, matching saveCurriculumLink.

### `F0193` [MISSING] No confirm step before saving attendance — no per-name point-delta warning, no 'no changes to save' guard
- **Role:** servant · **Area:** attendance
- **OG:** L5493-5495, L13004-13056, L19556-19567
- **Now:** app/portal/(app)/classes/[id]/attendance/AttendanceTaker.tsx save() lines 104-124
- **Verified:** Read AttendanceTaker.tsx in full (308 lines). save() calls saveAttendance directly from the button's onClick with zero confirmation step, no per-student +/- point breakdown anywhere in the file, and no guard against saving when diff.total === 0. Confirmed exactly as stated — this is the single biggest safety regression in the batch, since marking someone absent silently reverses previously-awarded points with no warning.
- **Fix:** Build present/absent/excused buckets from marks vs props.existing, show per-name point deltas (present +session.points, absent reverses them) in a confirm dialog, and only call saveAttendance on confirm. Add a client-side no-op guard when diff.total === 0.

### `F0196` [DEGRADED] Future-dated attendance is accepted client- and server-side — the OG's max=today guard is gone
- **Role:** servant · **Area:** attendance
- **OG:** L5477, L13183-13184
- **Now:** AttendanceTaker.tsx lines 158-163 (date input, no max); lib/portal/actions/attendance.ts (no todayInNewYork() comparison anywhere in the save path)
- **Verified:** Confirmed both the missing `max` attribute on the date input and the absence of any server-side future-date check. A mistyped year awards points immediately and permanently corrupts rate calculations, matching the calibration's 'data is corrupted' bar for high severity.
- **Fix:** Add max={todayInNewYork()} to the date input and re-validate server-side in the save action, throwing a PortalError if date > todayInNewYork().

### `F0198` [MISSING] The per-session donut-ring strip and its one-tap 'who was missing' drill-down are gone from the attendance page
- **Role:** servant · **Area:** attendance
- **OG:** L5394-5446, L18396-18414
- **Now:** AttendanceTaker.tsx lines 261-281 (plain date-label buttons, no % or colour, no drill-down)
- **Verified:** Confirmed the ring strip/colour-coding/drill-down panel has no equivalent on the attendance-taking page. Independently checked /portal/reports' attendance matrix (page.tsx lines 236-286): it can show a student x date grid, so the underlying data is not destroyed, but reaching it requires navigating to a separate page and choosing month/class/session — genuinely not the OG's one-tap glance from the register itself.
- **Fix:** Add a per-session % trend strip (last ~26 dates, OG's colour thresholds) above the register, with an expandable panel listing every student's status for a tapped date — the data is already loaded server-side for the class rate.

### `F0199` [DEGRADED] Every headline attendance stat (class page, student profile, dashboard) counts only the 'sunday' session, hiding all other recorded sessions
- **Role:** servant · **Area:** attendance
- **OG:** L16731-16747, L4713, L4836, L4217-4233
- **Now:** 14 hardcoded 'sunday' sites confirmed via rg -n "sessionKey: 'sunday'" across lib/portal/data/dashboard.ts, lib/portal/data/community.ts, lib/portal/actions/attendance.ts, app/portal/(app)/students/[id]/page.tsx, app/portal/(app)/classes/[id]/page.tsx
- **Verified:** Confirmed the pattern is pervasive across every headline stat card. Confirmed /portal/reports does support an all-sessions view (ReportFilters.tsx/page.tsx sessionKey is optional), so this is a display/aggregation problem, not permanent data loss — but a class whose primary recorded session isn't 'sunday' will show 'No sessions yet' on every card it actually sees day to day, which is a real, misleading regression.
- **Fix:** Compute the class/student headline rate over all active sessions (as the OG did), or fall back to all-sessions when there are zero 'sunday' rows but rows exist for other sessions.

### `F0444` [MOVED] One-click 'Attendance' sidebar shortcut is gone — taking attendance now takes 3 clicks instead of 1
- **Role:** servant · **Area:** attendance
- **OG:** L4012
- **Now:** No item in the SERVANT case of lib/portal/nav.ts; path is now My Classes (list, app/portal/(app)/classes/page.tsx) -> class card -> Take attendance button on classes/[id]/page.tsx
- **Verified:** Confirmed by reading the full SERVANT nav array (no such item) and the full click path, including that /portal/classes renders a class-card list even for a servant with a single class. Kept at high given this is the single most frequent weekly action and the calibration explicitly names attendance-taking as the reference blocker-adjacent task; the extra clicks compound every Sunday.
- **Fix:** Add a top-level 'Take Attendance' nav item for servants that resolves directly to their own class's attendance page (or the single class's attendance page when they have exactly one).

### `F0043` [MISSING] 'Export IDs & PINs' bulk CSV for a class is gone, and the only bulk-PIN-reveal moment left (admin import) cannot be re-opened or exported
- **Role:** servant · **Area:** auth-login
- **OG:** L4634, L10997-11017
- **Now:** nowhere on app/portal/(app)/classes/[id]/page.tsx (only 'Add student'); the only bulk credential surface is app/portal/(app)/admin/data/ImportPanel.tsx lines 189-191 (admin-only, one-time, not downloadable)
- **Verified:** Confirmed via full read of the class page header and a grep for Bulk Edit/Import CSV/Template across app and lib — no student-management header controls exist on the class page at all beyond Add student, let alone a credentials export. Confirmed the admin import result list is the only bulk-PIN-reveal moment and it is not persisted or exportable, matching the finding's 'one chance to capture PINs' data-loss framing.
- **Fix:** Add a 'Reset & export class PINs' action on the class page that mints fresh PINs for the whole class in one transaction and downloads a Name/Grade/ID/PIN CSV; at minimum, make the admin import result list downloadable as CSV at generation time.

### `F0240` [DEGRADED] 'This week' on Birthdays is a rolling 7 days from today, not the OG's calendar Monday–Sunday (ET) week — a birthday earlier in the week disappears from 'This week' the day after it happens
- **Role:** servant · **Area:** birthdays
- **OG:** OG getCurrentWeekRangeET() computing an actual Mon–Sun ET week, Sunday clamped to 23:59:59.999, used at L5994-6018 (Birthdays panel inWeek) and L14904-14922 (loadScheduleBirthdays); also L1772-1783 and L4275-4288 (dashboard widget), L17105-17120 (badge)
- **Now:** lib/portal/birthdays.ts upcomingBirthdays() (pure days-until, no calendar-week concept); app/portal/(app)/birthdays/page.tsx:109 thisWeek = studentRows.filter(b => b.daysUntil <= 6)
- **Verified:** Confirmed by reading both implementations directly. OG's inWeek()/bdayThisWeek() test a birthday against a fixed Monday–Sunday range regardless of whether that day has already passed within the week, so a Monday birthday is still 'this week' through the following Sunday. The new portal's daysUntilBirthday wraps to next year the moment a birthday passes, dropping it out of the <=6 rolling window — exactly the described bug, and it also affects the notification badge (same upcomingBirthdays() call site pattern, confirmed by grep). Severity corrected from blocker to high: no weekly task is literally blocked, but the widget can silently underreport whose birthday was this week by the time Sunday programming happens.
- **Fix:** Replace the rolling <=6 filter with an actual calendar Monday–Sunday (ET) window matching getCurrentWeekRangeET's semantics: a birthday counts as 'this week' if its date (in any adjacent year) falls between this week's Monday and Sunday, regardless of whether that day has already passed.

### `F0244` [DEGRADED] Topbar birthday chip shows only one name and disappears entirely when there are no birthdays this week
- **Role:** servant · **Area:** birthdays
- **OG:** index.stripped.html L1785-1802 (three states: 'No birthdays this week' / single name+date(+servant) / 'N: name, name +more')
- **Now:** components/portal/BirthdayChip.tsx (single-name only) + app/portal/(app)/layout.tsx L21-33 (`topbarChip={nextBirthday ? <BirthdayChip/> : null}` renders nothing when null)
- **Verified:** Confirmed by direct read of both OG lines and the new chip/layout code. Real loss of two of three states. Mitigated somewhat because the full list is still on /portal/birthdays and the dashboard's Upcoming Birthdays card, but the topbar landmark vanishing entirely (rather than showing an empty state) can read as broken.
- **Fix:** Have nextBirthdayForTopbar return the full this-week list (or {count, firstTwo}); reproduce the OG's three states in BirthdayChip, always rendering the card.

### `F0245` [MISSING] No "All Students" full birthday roster — anyone more than 60 days out appears nowhere in the portal
- **Role:** servant · **Area:** birthdays
- **OG:** index.stripped.html L6041-6047 (withDob sorted by weeksUntil), L6060-6076 (tile markup), L6123-6129 (card wrapper)
- **Now:** app/portal/(app)/birthdays/page.tsx calling upcomingBirthdays(students, today, 60); lib/portal/birthdays.ts upcomingBirthdays() drops anyone with daysUntil > windowDays
- **Verified:** Confirmed by full read of both files: the page has This-week + month-grouped cards (capped at 60 days) + a Servants card, and nothing else. No uncapped/all-students view exists anywhere.
- **Fix:** Add an uncapped 'All students' card/section sorted by days-until-birthday.

### `F0246` [MISSING] "No birthday on file" placeholder tiles are gone — no way to see whose DOB is missing
- **Role:** servant · **Area:** birthdays
- **OG:** index.stripped.html L6037 (noDob filter), L6087-6096 (dimmed 'No birthday on file' tiles), L6129 (allRows+noDobRows)
- **Now:** lib/portal/birthdays.ts upcomingBirthdays() — `if (!p.dob) continue` drops no-DOB people before the page ever sees them
- **Verified:** Confirmed by direct read: no-DOB students/servants are filtered out upstream of the birthdays page entirely; no rendering path for them exists.
- **Fix:** Return no-DOB people separately and render dimmed placeholder tiles linking to their edit page.

### `F0248` [DEGRADED] Dedicated "Next Week" birthday card is gone — buried in a generic month bucket
- **Role:** servant · **Area:** birthdays
- **OG:** index.stripped.html L5995-5998 (nextMonday/nextSunday), L6037 (nextWeek filter), L6112-6120 (blue Next-Week card + empty state)
- **Now:** app/portal/(app)/birthdays/page.tsx — thisWeek/later split at daysUntil<=6, later grouped into calendar-month Cards
- **Verified:** Confirmed by full read: no distinct Mon-Sun next-week window or blue palette exists; a 25 Sep and 30 Sep birthday land in the same 'September 2026' card as the finding states.
- **Fix:** Insert a distinct 'Next week' Card between This-week and the month groups, OG blue palette and empty state.

### `F0334` [MISSING] One-click whole-class "Print Report" (letterhead summary) is gone, with no equivalent
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html L4831 (button) and L18034-18085 (printServantClassReport — letterhead HTML, 6-stat grid, top-performer callout, full roster table)
- **Now:** nowhere — app/portal/(app)/classes/[id]/page.tsx has no print/report action; repo-wide grep for letterhead|Top performer|Cases Opened|Cases Resolved|Excused Absences returns zero hits; app/portal/(app)/reports/cards/page.tsx is a different per-student report-card format
- **Verified:** Confirmed by full read of the class page, the printServantClassReport function, and the repo-wide grep.
- **Fix:** Rebuild the one-click whole-class letterhead summary, or explicitly repoint the button and document the format change.

### `F0338` [MISSING] "Monthly Digest" card (5 month-scoped metrics) is gone from the class page
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html L4842-4849 (card markup) and L4721-4760 (month-scoped computation: cpMonthAvgAtt/cpMonthExcused/cpMonthPtsTotal/cpMonthOpened/cpMonthResolved)
- **Now:** nowhere — app/portal/(app)/classes/[id]/page.tsx's stat row is all-time, not month-scoped; grep for digest|monthAvgAtt|Cases Opened|Cases Resolved|Excused Absences hits only Next.js's unrelated error.digest
- **Verified:** Confirmed by full read of the class page and the OG computation block.
- **Fix:** Rebuild this card, month-scoped, on the class page or as a dashboard widget.

### `F0075` [MISSING] All six Chart.js dashboard charts are gone — no charting library in the project at all
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L7 (chart.js@4.4.4 CDN) and renderDashboardCharts L2028-2100 (read in full: attendance-trend line, avg-scores bar with exam fullLabel tooltip, student-growth line, each gated on >=2 points, 0/reduced-motion animation); renderStudentScoreChart L1849-1890; renderChurchWideCharts L1975-2005
- **Now:** nowhere — grep for recharts|chart.js|<canvas|d3\b across app/portal, components/portal, lib/portal, package.json returns only unrelated <canvas> in components/portal/QrScanner.tsx (QR video frame); no charting dependency in package.json
- **Verified:** Confirmed by direct read of the OG chart code and an exhaustive grep of the new portal.
- **Fix:** Add a charting library (e.g. recharts) and rebuild the five charts with the OG's exact rules.

### `F0076` [MISSING] Servant dashboard has no Quick Actions tiles — the only ActionCard block is ADMIN-only, and even then isn't the OG's 5 actions
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L4548-4576 (5-tile grid: Create Exam / Add Points / Add Student / Attendance (gold) / Student Reports)
- **Now:** app/portal/(app)/page.tsx L54 — `{user.role === 'ADMIN' && (...)}` gates the only ActionCard block, which renders just 2 tiles ('Manage classes', 'Add a servant'), not the OG's 5, and none for SERVANT
- **Verified:** Confirmed by full read of page.tsx.
- **Fix:** Render the OG's 5-tile grid for SERVANT (destinations per the finding's suggestion).

### `F0077` [DEGRADED] Servant dashboard stat row is the admin-shaped totals — the OG's per-class Avg Score, Attendance-trend, and Active Exams stats are gone
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L4200-4266 (computation) and L4527-4546 (4-tile row: Students+delta, Avg Score+Highest, Attendance+trend-vs-last-session, Exams+active)
- **Now:** app/portal/(app)/page.tsx StaffHome() — one shared stat row (Classes/Servants/Students/Open follow-ups) for ADMIN, PASTOR and SERVANT alike
- **Verified:** Confirmed by full read: none of the OG's per-class metrics appear anywhere on the servant dashboard.
- **Fix:** Split StaffHome's stat row so SERVANT gets the OG's 4 class-scoped stats.

### `F0079` [MISSING] "Not Checked In Today" per-student widget is gone — dashboard only tracks whole classes missing attendance, not individual students
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L4394-4415 (roster-minus-checked-in list, red count pill, 'may still update' footer)
- **Now:** components/portal/widgets/CheckInWidget.tsx ServantCards() — `missing` is computed per-class via attendanceRecord.groupBy, not per-student via today's PointEntry
- **Verified:** Confirmed by full read: the new widget answers a different, coarser question (which classes haven't started attendance) than the OG's (which students within a class have earned no points today).
- **Fix:** Add a server-rendered per-student widget once any PointEntry exists today for a visible class.

### `F0309` [BROKEN] A servant can now edit and delete another servant's event — the OG's creator-only rule for servants was dropped
- **Role:** servant · **Area:** events
- **OG:** index.stripped.html L15006 (`canManage = admin||pastor||(servant && s.createdBy===_me.uid)`)
- **Now:** lib/portal/data/community.ts L41-46 (canTargetClasses, no creator check) and L140 (canManage=canTargetClasses(...)); lib/portal/actions/events.ts L88 (updateEvent) and L123 (deleteEvent), both gated solely on assertCanTarget
- **Verified:** Confirmed by direct read of all four locations: createdById is stored at creation (events.ts L54) but never checked on update or delete, so any servant sharing the target class(es) can mutate another servant's event.
- **Fix:** Add the creator check to the servant branch: canManage = ADMIN||PASTOR||(SERVANT && row.createdById===user.accountId && canTargetClasses(...)); enforce the same in updateEvent/deleteEvent.

### `F0019` [BROKEN] Exam CSV import now requires a Title column on every row — the OG's Day + Question + Correct-Answer-only sheets (with Month/Year/Points picked separately) fail entirely
- **Role:** servant · **Area:** exams
- **OG:** OG header/alias mapping L16281-16309, Month/Year/Points reads L16311-16313, QUESTIONS_PER_AUTO_DAY grouping L16314+16336-16341, auto-title 'Daily Quiz — <date>' L16375-16379, template header `Day,Question,Option A,Option B,Option C,Option D,Correct Answer` L17673-17681
- **Now:** lib/portal/exams.ts:318-389 parseExamCsv — title = pick(rec,['title',...]); if (!title) errors.push('Missing exam title.') at line 328-332; app/portal/(app)/exams/import/ExamImport.tsx has no Day/Month/Year/Points controls
- **Verified:** Confirmed the core claim: Title is unconditionally required per row (verified directly in parseExamCsv), and there is no Day/Month/Year/Points UI anywhere in ExamImport.tsx, so an OG-format sheet (Day,Question,Options,Correct Answer, no Title) fails on every single row with 'Missing exam title.' One correction to the finding's own evidence: Due Date is NOT required in the new parser — read lib/portal/exams.ts:334-339 directly; a blank due-date cell parses to null with no error, only Title is mandatory. Severity corrected from blocker to high: bulk-importing a term of quizzes isn't itself a weekly task (most weeks a servant just uses already-imported quizzes), but it's a complete, total break of the church's established sheet format for whenever they do it.
- **Fix:** Accept the OG shape as an alternate format: when there's no Title column, require only Question + Correct Answer, read an optional Day column, add Month/Year/Points fields to the import form, bucket 3 questions/day when Day is absent, and auto-title each day 'Daily Quiz — <Month D, YYYY>'.

### `F0020` [DEGRADED] Cross-exam bulk "Reopen Selected (N)" (set-union merge) is entirely gone; single-exam reopen merely moved to the detail page, three clicks deep
- **Role:** servant · **Area:** exams
- **OG:** Servant → Exams list toolbar and row icon, index.stripped.html L5197 (toolbar button), L5233 (row icon), L11377-11465 (openReopenExamModal/openBulkReopenModal/openReopenModalCore/saveReopenExamFB)
- **Now:** Single-exam reopen: /portal/exams/[id] → ExamActions.tsx ~lines 93-122 ("Reopen for students" card, bottom of page). ExamsFilter.tsx:184 shows only a read-only "N reopened" badge. Cross-exam bulk merge: nowhere — setReopenedStudents (lib/portal/actions/exams.ts:186-201) takes one examId only and always replaces reopenedFor, matching only the OG's single-exam branch.
- **Verified:** Verified both OG branches: the single-exam save (`examIds.length===1`) does a full replace, which the new setReopenedStudents correctly mirrors — that part genuinely just moved (real friction, but present). The multi-exam branch (`else`) does a set-union merge across every selected exam's reopenedFor list, and there is no equivalent anywhere in the new portal — no UI accepts multiple exam ids, and no action merges. So the true state is a mix: MOVED (single-exam) + MISSING (cross-exam bulk), which nets to DEGRADED overall since a real capability (act on many overdue exams at once) was lost, not relocated.
- **Fix:** Keep the detail-page card as the single-exam path. Separately, add a bulk-reopen flow (see F0478, folded into this fix): a "Reopen selected (N)" control in ExamsFilter.tsx enabled only for selected past-due rows, backed by a new server action that merges (set-union) into each selected exam's reopenedFor, matching OG L11455-11460.

### `F0021` [MISSING] Exams no longer grouped into collapsible month sections (CURRENT pill, counts, collapse/expand)
- **Role:** servant · **Area:** exams
- **OG:** Servant → Exams → All Exams, index.stripped.html L5202-5254 (examGroups build + ordering + header render), L11260-11268 (toggleExamMonthGroup)
- **Now:** /portal/exams → ExamsFilter.tsx, single flat `<ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">` of ExamCards, no grouping
- **Verified:** Read OG L5203-5254 directly: buckets by dueDate.slice(0,7), orders non-expired months first with a forced 'nodate' group last, renders a CURRENT pill and 'n exams · m past' counts, default-collapses every non-current month. `grep -rniE "monthGroup|MONTH_NAMES|currentMonthKey"` across app/portal and lib/portal/data/exams.ts and lib/portal/exams.ts returns zero hits — confirmed nothing survives, not even under a different name.
- **Fix:** Group ExamsTable's rows by dueDate.slice(0,7) in ExamsFilter.tsx, render a details-style header per month (label, CURRENT badge, available/past counts), default-open the current month, collapse the rest, and put a 'No due date' group last.

### `F0023` [BROKEN] Exam list ordering regressed: undated exams sort first (Postgres NULLS FIRST on DESC) and dated exams run furthest-due-first
- **Role:** servant · **Area:** exams
- **OG:** Servant → Exams, index.stripped.html L5172-5186 (comparator: non-expired first, soonest-due first, no-due-date last within upcoming, then most-recently-expired first)
- **Now:** lib/portal/data/exams.ts:140, `orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }]`
- **Verified:** Confirmed the exact orderBy clause has no `nulls` qualifier, so it relies on Postgres's default (NULLS FIRST for DESC), putting every exam with no due date ahead of all dated ones — the opposite of OG's explicit 'no due date goes last' rule at L5178-5179 — and among dated exams, DESC puts the furthest-future exam first instead of the soonest-due one.
- **Fix:** Change the orderBy to `{ dueDate: { sort: 'asc', nulls: 'last' } }` scoped to non-expired exams, with expired exams separately sorted most-recently-expired first, or replicate the OG's exact comparator client-side/in listExams so /portal/exams and any dashboard widget agree.

### `F0027` [DEGRADED] Report card exam section lost the percentage ring, correct/total counts, points earned and the per-exam "Show Details" breakdown
- **Role:** servant · **Area:** exams
- **OG:** Report card → EXAM RESULTS, index.stripped.html L6417-6440 (totals/verdict/per-exam ring cards), L6442-6454 (summary row + Show Details toggle), L16036 (rptToggleExams)
- **Now:** /portal/reports/cards, section "Exam results (N)" — one line with average% and quiz count, plus a band badge
- **Verified:** Verified the OG builds a 52px ring, correct/total, points-earned/max, a verdict label and a full per-exam list behind a toggle, all computed from correctCount/totalQs/score/pointsPerQ fields. Verified lib/portal/data/reports.ts:439 selects only `{ studentId: true, percentage: true }` from quizResult for the report-card query — correctCount, questionCount, score, submittedAt and exam.title are not queried at all, so the detail view cannot be rebuilt without a data-layer change first.
- **Fix:** Widen the per-student quiz query in lib/portal/data/reports.ts to include correctCount, questionCount, score, total, submittedAt and exam.title; carry them through the card builder; render the OG's summary line plus a collapsible per-exam list (a native `<details>` gives the toggle for free and prints open).

### `F0116` [BROKEN] Clearing a case's 'Next follow-up' date silently fails — Prisma update uses undefined instead of null
- **Role:** servant · **Area:** followups
- **OG:** N/A (bug introduced in the port; OG only ever wrote nextFollowUp once from a manual-add modal, per the finding's own note)
- **Now:** lib/portal/actions/followups.ts logContact (lines 29-42) — data: { nextFollowUp: next ? toUTCDate(next) : undefined }; undefined means Prisma skips the column entirely
- **Verified:** Upgraded from medium to high: this is a confirmed, reproducible correctness bug, not a UI-parity gap. A servant who blanks the field to mean 'no more reminder' silently fails, and the case list/detail keep showing a passed reminder date indefinitely — this fits the calibration's 'data is lost/corrupted' band, not mere friction.
- **Fix:** Write nextFollowUp: next ? toUTCDate(next) : null so a blank field actually clears the date.

### `F0414` [MISSING] Required 10-option canned misbehavior-reason dropdown for point removal is gone; reason is now optional free text
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html L5785-5798 (10 canned reasons + Other dropdown), L9419-9424 (removeLbPoints refuses without a reason)
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx — a single free-text input explicitly labelled "Reason (optional)", no required validation, no canned options
- **Verified:** Confirmed the OG's exact 10 options and confirmed the OG's validation genuinely blocks submission without a reason. Confirmed the new field is optional free text. Kept at high: this removes an accountability/consistency guarantee on records documenting a child's behavior — a real data-quality regression (inconsistent, sometimes absent reasons), not mere convenience friction.
- **Fix:** Add a required reason select with the same 10 canned options plus an Other/free-text fallback when mode==='remove', matching OG's required validation.

### `F0650` [BROKEN] Help topic "Import/Export Students (CSV)" 404s for a servant, and the feature it describes was a self-service tool on the servant's own Students page that no longer exists there
- **Role:** servant · **Area:** help
- **OG:** index.stripped.html L5653-5654 (feature description), L4633-4635 (Export CSV/Import CSV/Export IDs & PINs buttons on the servant's own Students page)
- **Now:** app/portal/(app)/help/page.tsx links to /portal/admin/data, which does `if (user.role !== 'ADMIN') notFound()`; the servant's own class roster page has no export/import UI at all
- **Verified:** Confirmed the OG buttons lived directly on the servant's own class Students page (self-service), not an admin page. Confirmed the new equivalent (exportStudentsCsv/importStudentsCsv in lib/portal/actions/data-tools.ts) is wired only to the admin-gated /portal/admin/data route, and confirmed no export/import UI exists anywhere under the servant's own classes/[id]/students route. This is a real capability loss for servants, not just a bad link.
- **Fix:** Rebuild a class-scoped, servant-reachable roster export/import tool (or open the existing admin one to servants for their own class), and point the Help link at it.

### `F0651` [MISSING] Help topic "Bulk Edit Students" 404s for a servant, and the underlying bulk-edit feature was never rebuilt for any role
- **Role:** servant · **Area:** help
- **OG:** index.stripped.html L5655-5656 (feature description), L4638 + modal L19372 (bulk edit with Undo)
- **Now:** app/portal/(app)/help/page.tsx links to /portal/admin/students (404 for non-admin); confirmed admin/students/page.tsx has no bulk-select/bulk-field-update UI either — only a per-row MoveStudentSelect
- **Verified:** Confirmed `grep -rln "bulkEdit|BulkEdit|bulk-edit"` across lib/portal/actions and app/portal returns only the Help page's own descriptive prose — there is no bulk-edit implementation anywhere in the codebase, for any role, not just a broken link for servants.
- **Fix:** Rebuild the bulk-edit feature (field + value across selected students, with an Undo affordance) and point the Help link at wherever it lands.

### `F0230` [MOVED] "+ Add Hymn" header button gone; the only add control renders below the entire hymn list on any screen narrower than 1024px
- **Role:** servant · **Area:** hymns
- **OG:** Servant → Teaching → Hymns, index.stripped.html L4892-4893 (header + button), L14663-14666 (toggleAddHymn)
- **Now:** app/portal/(app)/hymns/page.tsx PageHeader has no `actions` prop (confirmed against components/portal/ui.tsx:18/51 which supports one); HymnManager.tsx renders the hymn list (`lg:col-span-3`) before the "Add a hymn" card (`lg:col-span-2`) inside a `grid lg:grid-cols-5`, confirmed by reading the DOM order directly
- **Verified:** Confirmed the OG header button placement exactly, and confirmed the new layout's DOM order puts the add-hymn card after the whole hymn list, which in a single-column stacked grid (any width under the lg breakpoint, i.e. phones and most tablets) means scrolling past the entire book to add a hymn.
- **Fix:** Pass an `actions` button to PageHeader on the hymns page that opens/scrolls to the existing right-rail form, so there is a header-level entry point on every screen size, matching the OG's placement.

### `F0257` [MISSING] Live search over lesson content ("Search lessons, saints, verses...") is gone from the whole portal
- **Role:** servant · **Area:** lessons
- **OG:** Schedule of the Year → Lesson Archive tab, filter card below the class picker (index.stripped.html L8612-8615, L8666-8668)
- **Now:** nowhere — grepped app/portal/(app)/lessons/*, agenda/**, components/portal/* for "search", zero hits besides Next.js routing searchParams
- **Verified:** OG citations verified verbatim. LessonManager.tsx (full 487 lines) and the archive view have no search input anywhere in the portal.
- **Fix:** Add a search box to the restored agenda archive and to /portal/lessons?view=archive; a `q` searchParam filtering title/topics/notes server-side is sufficient.

### `F0258` [BROKEN] Servants can no longer browse or copy any other class's lessons — "Copy from Another Class" is empty for them
- **Role:** servant · **Area:** lessons
- **OG:** Servant lesson-plan screen, "Copy from Another Class" modal (index.stripped.html L15899-15914, L19179-19192)
- **Now:** app/portal/(app)/lessons/page.tsx (copySources built from listVisibleClasses) + lib/portal/actions/lessons.ts:165 assertClassAction(..., 'class.read')
- **Verified:** Confirmed: permissions.ts SERVANT case makes class.read = assigned || stageRead. An ordinary servant with one class sees no other class, so copySources is empty client-side, and the server action would reject a hand-crafted request too.
- **Fix:** Build copySources from all active classes and relax the source check in copyLessonsFromClass to not require class.read on the source (write access on the target is the check that matters).

### `F0260` [MISSING] Servants have no cross-class lesson archive at all — the Archive tab is gated to ADMIN/PASTOR
- **Role:** servant · **Area:** lessons
- **OG:** Lesson Archive tab's CLASS picker (allowClassPicker=true for servants too), index.stripped.html L6309, L8606-8610
- **Now:** app/portal/(app)/lessons/page.tsx L27: const canArchive = user.role === 'ADMIN' || user.role === 'PASTOR'
- **Verified:** Confirmed: a servant (including a stage overseer) visiting /portal/lessons?view=archive silently gets the class view back instead, because canArchive is false for role SERVANT.
- **Fix:** Change canArchive to include servants (gate only the write affordances), and render other classes' lessons read-only in the OG's 'View Only' style.

### `F0643` [BROKEN] My Photo page is fully built but has zero entry points anywhere in the portal
- **Role:** servant · **Area:** myprofile
- **OG:** Tap photo in banner opens upload modal (index.stripped.html L19637-19656, openMyPhotoModal L10374-10453)
- **Now:** app/portal/(app)/photo/page.tsx — functional page + validated server actions, but unlinked
- **Verified:** Confirmed via an independent search (grep for PhotoUpload and '/photo') that the component and route are referenced nowhere except by themselves. Kept at high, unlike the topbar findings above, because there is genuinely no alternate path to this page at all.
- **Fix:** Link this page from Settings/My Profile (wrap the avatar) so it becomes reachable.

### `F0838` [MISSING] Changing a student's photo works end-to-end but has no entry point anywhere in the UI — the page and actions are correct, just unreachable
- **Role:** servant · **Area:** page-servant-roster — 'Edit student info' panel (es- prefixed fields)
- **OG:** OG handleStudentPhotoSelect/setStudentPhotoPreview/removeStudentPhoto (L10167-10258); markup at L19283-19285, reached from the student profile
- **Now:** app/portal/(app)/photo/page.tsx (?student={id}) with setStudentPhoto/removeStudentPhoto — read the whole file: page and actions are correctly implemented and functional; grepped '/portal/photo' across app/components/lib and found zero links to it anywhere, including on app/portal/(app)/students/[id]/page.tsx itself, which renders only a plain non-interactive <Avatar> (line 98)
- **Verified:** Corrected 'BROKEN' to MISSING: nothing about the feature is actually broken — it works fully if you type the URL — the thing that's missing is the button/link that would ever send a servant there. Corrected severity from blocker to high per this church's own calibration language ('high = they can do it but will not find it'); it's not a weekly task, so not a blocker.
- **Fix:** Add a 'Change photo' button/click-target on the student profile's Avatar (and/or on the roster card) linking to /portal/photo?student={id}, matching how the page already expects to be invoked.

### `F0171` [DEGRADED] Points History tab (search, All/Added/Removed chips, 4 grouping modes, per-group subtotals, Type column) is gone
- **Role:** servant · **Area:** points
- **OG:** Points System page, History tab (index.stripped.html L5725-5727, L9703-9760, L9790-9879)
- **Now:** app/portal/(app)/classes/[id]/points/page.tsx + PointsPanel.tsx — a plain 'Recent activity' list capped at 60 rows
- **Verified:** Confirmed: the Prisma query selects `source` but PointsPanel's `history` type (L15) omits it entirely, and the full PointsPanel.tsx has no search/chips/grouping/subtotals. The `take: 60` cap makes older entries functionally unreachable through the UI (still in the DB, but invisible to a user), matching the high-severity 'as good as lost' calibration.
- **Fix:** Restore a History tab with search, the 3 filter chips, the 4 grouping modes with subtotals, and a Type column driven by PointEntry.source; replace take:60 with real paging/filtering.

### `F0173` [MISSING] Activities can be created and deleted but never edited — no pencil button, no edit action anywhere
- **Role:** servant · **Area:** points
- **OG:** index.stripped.html L5737-5738 (pencil button on each tile), L10726-10763 (openEditActivityModal / saveNewActivity's update-vs-create branches)
- **Now:** lib/portal/actions/points.ts (only givePoints/undoPoints/createActivity/removeActivity exported, no updateActivity); app/portal/(app)/classes/[id]/points/PointsPanel.tsx L121-159 (add + delete only)
- **Verified:** Verified by full read of both OG and new code. Exactly as claimed — no edit path exists at any layer, even though PointActivity's schema already supports mutable label/points/icon.
- **Fix:** Add updateActivity(activityId,label,points,icon) to points.ts (guarded by points.write, audited), and a pencil button on each tile in PointsPanel.tsx opening the add form prefilled, relabelled 'Edit Activity' / 'Save Changes'.

### `F0174` [DEGRADED] Student profile Points History lost its Undo/Delete buttons and Type/Servant columns
- **Role:** servant · **Area:** points
- **OG:** index.stripped.html L5102-5142 (table with Reason/Date/Servant/Type/Points + Undo/Delete actions)
- **Now:** app/portal/(app)/students/[id]/page.tsx L142-161 (plain <li> list, no buttons, no Type pill)
- **Verified:** Confirmed. Important nuance: Undo is NOT gone from the app — it still works on the class-wide Points page's 'Recent activity' history (PointsPanel.tsx L283-309, same undoPoints action), just not from the student's own profile. Delete, however, does not exist anywhere in the codebase — lib/portal/actions/points.ts has no delete-entry action at all.
- **Fix:** Select source/undoOfId on the profile query, add a Type pill, and add a per-row Undo button wired to the existing undoPoints action; Delete needs a new server action first since none exists yet anywhere.

### `F0000` [MOVED] 'Print QR Codes' is gone from the Class Profile header, but is a clearly-labelled one-click button under the 'QR Check-in' sidebar item — not lost
- **Role:** servant · **Area:** qr
- **OG:** OG Class Profile header button onclick="svLoad('printqr')" (index.stripped.html:4829), sibling 'Print Report' (4830); renderPrintQRPage at 14204-14238
- **Now:** app/portal/(app)/qr/page.tsx header has a 'Print QR cards' button and a third tab, linking to app/portal/(app)/qr/cards/page.tsx, which defaults to classes[0] and shows a ClassPicker (lines 15-31) to re-select when the servant has more than one class
- **Verified:** Confirmed the class page itself has no Print-QR link (grep clean) and the feature now lives under the 'QR Check-in' sidebar item instead, requiring a re-pick of class from a dropdown if the servant serves more than one class — exactly as described. Kept above medium (high, not the original blocker) because the calibration given for this church explicitly names 'printing what they hand out on Sunday' as blocker-grade behavior, but this doesn't fully block anything — the button is clearly labelled and one click from a clearly-labelled, always-visible sidebar item, not actually lost or hidden.
- **Fix:** Add a 'Print QR cards' shortcut back onto the class profile header (linking to /portal/qr/cards?class={id}) alongside the existing sidebar entry, so single-class servants don't need to re-select their class.

### `F0002` [DEGRADED] Print QR cards has no student selection — it always prints every card in the class
- **Role:** servant · **Area:** qr
- **OG:** index.stripped.html L14229-14277 (toolbar, toggle, select-all/clear, print-selected + guard toast)
- **Now:** app/portal/(app)/qr/cards/page.tsx (full file read — defaults to the servant's own class via ?class=, but always includes every student in that class with no subset option)
- **Verified:** Confirmed as the primary/comprehensive finding for this cluster (see F0345-348, which restate pieces of the same gap).
- **Fix:** Add a Set<string> selection state (mirroring PointsPanel.tsx), Select All/Clear controls, and hide unselected cards with print:hidden, defaulting to all-selected so current behaviour still works in one click.

### `F0004` [MOVED] 'QR Points' lost its own one-tap sidebar entry — giving points by QR is now tab + toggle + camera
- **Role:** servant · **Area:** qr
- **OG:** index.stripped.html L4013-4014 (two sidebar rows), L13848-13864 (points path skips the mode chooser straight to camera)
- **Now:** lib/portal/nav.ts L37 & L83 (single 'QR Check-in' entry per role); app/portal/(app)/qr/page.tsx (defaults tab=group); ScanPanel.tsx L40,168-178 (in-page 'Mark present'/'Give points' toggle, no searchParams-driven initial mode)
- **Verified:** Confirmed exactly as stated by direct grep/read — reaching points-scanning now takes three extra interactions versus the OG's dedicated entry.
- **Fix:** Add a second nav entry '/portal/qr?tab=scan&mode=points', and have ScanPanel read an initial mode from searchParams.

### `F0005` [MISSING] Group QR code never auto-regenerates at expiry and has no one-click Regenerate button
- **Role:** servant · **Area:** qr
- **OG:** index.stripped.html L14578-14587 (silent regenerate at 00:00), L19097 (manual Regenerate button)
- **Now:** app/portal/(app)/qr/GroupCodePanel.tsx L71-78 (countdown effect has no zero-branch), L176-184 ('New code' just resets to the setup form; 'End now' stops it — no direct regenerate)
- **Verified:** Confirmed as stated. Recovery from expiry is a 2-click 'New code' then 'Generate code' (selections are retained in state), not silent/one-click regeneration.
- **Fix:** Add an effect that calls generate() again when left<=0, and/or a direct 'Regenerate' button next to 'End now' while the code is still live.

### `F0123` [DEGRADED] Attendance Report collapsed from all six weekly sessions in one month grid to exactly one session at a time
- **Role:** servant · **Area:** reports
- **OG:** OG renderAttendanceMonthTable (L8938-9017): one grid per month, week-grouped columns, all six session abbreviations (BS/V/T/SL/SS/H per abbrMap at L8944/L9271) shown together for every week
- **Now:** app/portal/(app)/reports/page.tsx:236-330 — loadAttendanceMatrix({classId, month, sessionKey, blank}) resolves to a single sessionKey; rows=students, columns=calendar dates within that one session; ReportFilters exposes one Session <select>, not a multi-select
- **Verified:** Confirmed by reading the OG's month-table renderer and the new report page directly — the shapes really are different as described (six-session grid vs. one-session-at-a-time). Severity corrected from blocker to high: all the underlying data is still fully retrievable, just requires running/printing the report once per session instead of once per month — friction and print cost, not a blocked task.
- **Fix:** Add a 'Church Reports'-style month grid variant to the Attendance tab that shows all active sessions as grouped columns per week, matching the OG's renderAttendanceMonthTable, as an alternative to the current single-session matrix.

### `F0131` [MISSING] No way to view or print just one student's report card
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L6198-6201 (entry point), L6320-6515 (per-student sheet), L6495-6497 (Print Report Card)
- **Now:** app/portal/(app)/reports/cards/page.tsx L73-78 (SearchParams: class/from/to/session only, no student); no report link on app/portal/(app)/students/[id]/page.tsx
- **Verified:** Confirmed exactly as stated — the page always renders and would print every student in the class, one full sheet each; there's no per-student filter or link from the student profile or class roster. A real, common task (hand one family their child's report) is genuinely blocked without over-sharing the whole class's data.
- **Fix:** Accept ?student=<id> on /portal/reports/cards to render a single card, and link it from the student profile header and class roster rows.

### `F0135` [MISSING] Class Profile lost its 'Print Report' letterhead entirely, and its 'Print QR Codes' link (feature exists elsewhere, just unlinked here)
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L4828-4832 (both header buttons), L18034-18086 (printServantClassReport letterhead)
- **Now:** app/portal/(app)/classes[id]/page.tsx header actions (only Take attendance/Points/Add student); grep for 'Print Report|ClassReport|letterhead' across app/portal, lib/portal, components/portal returns zero hits anywhere in the codebase
- **Verified:** Confirmed: the letterhead class-report feature is a complete, ground-up loss (not merely unlinked) — no such document exists anywhere. The 'Print QR Codes' half is only a linking gap since /portal/qr/cards exists (see F0343, folded into this finding). The letterhead loss alone justifies keeping this at high.
- **Fix:** Add both header actions: 'Print QR codes' → /portal/qr/cards?class=<id>, and build a class-scoped printable letterhead report from the roster + digest data (F0134) the page already loads.

### `F0136` [BROKEN] Blank paper attendance form always uses Sunday dates regardless of the selected session
- **Role:** servant · **Area:** reports
- **OG:** OG L9213-9265 (buildAttendancePrintHTML with blank=true), L9306-9311 (downloadBlankAttendanceForm)
- **Now:** lib/portal/data/reports.ts:246 (forces records=[]); lib/portal/reports.ts:245-260 (buildMonthMatrix falls back to sundaysInMonth())
- **Verified:** Confirmed the blank-form path never looks at sessionKey and always derives columns from sundaysInMonth(), a pure day-of-week filter. AttendanceSession.dayOfWeek already exists in schema and is used elsewhere, so the fix is straightforward. Escalated to high: this silently mislabels a paper form's dates for any non-Sunday session, risking real date-misattribution once the paper roll is transcribed back — not just a print-time inconvenience.
- **Fix:** Derive blank-form columns from the selected AttendanceSession's dayOfWeek, not a hardcoded Sunday filter.

### `F0499` [DEGRADED] Any co-servant of a targeted class can edit/delete another servant's event, not just the creator or admin/pastor
- **Role:** servant · **Area:** schedule
- **OG:** OG L15008 (canManage = admin/pastor OR s.createdBy===_me.uid)
- **Now:** lib/portal/data/community.ts:140 (canManage = canTargetClasses(...), no createdById check)
- **Verified:** Confirmed: for SERVANT role there is no creator check at all — any servant whose classIds cover the event's targets can manage it. Escalated to high: this is a real permission regression that lets one servant silently alter or delete another servant's calendar entry — a data-loss/integrity risk on live church data, not mere friction.
- **Fix:** Add a createdById===user.accountId check back for the SERVANT role in canManage (or an equivalent explicit function), confirming with the church whether the relaxation was intended first.

### `F0292` [DEGRADED] A plain servant can no longer mark any servant but themselves on Servants Attendance — OG had no role gate at all
- **Role:** servant · **Area:** servant-attendance
- **OG:** sidebar 'Servants Attendance' item L4032; unconditional church-wide load of role=='servant' at L7804-7806; saveServantAttendanceBulk/no permission check L7964-7994
- **Now:** /portal/servant-attendance (page.tsx); lib/portal/data/servant-attendance.ts loadServantScope() L44-99; lib/portal/qr.ts canMarkServant() L230-236
- **Verified:** OG lines confirmed exactly as cited: an unconditional Firestore query for every role=='servant' user, sorted A-Z, and a save function with no permission check whatsoever. The new portal's loadServantScope() restricts the visible list to the caller's own class(es)/stage unless ADMIN/coordinator/stage-overseer, and canMarkServant() blocks writing anyone but yourself unless you are a coordinator, stage overseer, or admin. This is a real, deliberate behavior change, confirmed in code — but it reads as an intentional least-privilege tightening rather than an accidental regression, and needs a church policy call either way (who is actually supposed to mark the whole team's attendance on a Sunday). Same underlying gap as F0625 in this batch (identical files/lines cited from the opposite framing) — treating F0625 as the duplicate.
- **Fix:** Get an explicit answer from the church: if any servant should still be able to mark the whole team (the OG's model), drop the coordinator/stage-overseer requirement in canMarkServant(); if the tighter rule is correct, say so explicitly on the page (a Callout: 'you can mark yourself; ask a coordinator to mark the rest') instead of silently disabling other rows, and make sure whoever actually runs the weekly meeting has coordinator or stage-overseer status assigned.

### `F0290` [DEGRADED] 'My Attendance' is read-only and its save action (markMyServantAttendance) is dead code
- **Role:** servant · **Area:** servant-attendance
- **OG:** index.stripped.html L6825-6850 (self-scoped write page), L7024-7056 (saveServantAttendance)
- **Now:** app/portal/(app)/my-attendance/page.tsx (full file read — zero interactive elements for either branch); lib/portal/actions/servant-attendance.ts L114 markMyServantAttendance (defined, confirmed zero callers via grep)
- **Verified:** Confirmed. A servant CAN still self-mark, but only via app/portal/(app)/servant-attendance/page.tsx L92-97, where writableIds falls back to the caller's own row for a plain (non-coordinator) servant on the shared team-wide grid — a page whose name/purpose reads as a coordinator tool, not 'mark myself,' which is a genuine discoverability problem justifying high.
- **Fix:** Either wire markMyServantAttendance into a small write card on 'My Attendance,' or clearly cross-link/relabel the two pages so a plain servant knows where to self-mark.

### `F0298` [BROKEN] Attendance/Standing rates are corrupted by counting activities the servant's own group never held, computed church-wide
- **Role:** servant · **Area:** servant-attendance
- **OG:** OG L8063-8076/8098-8106 (raw glyphs only, no computed denominator/rate)
- **Now:** lib/portal/data/servant-attendance.ts:169-173 (heldPairs groupBy with no servantId scope)
- **Verified:** Confirmed: heldPairs is computed with zero servant scoping (any servant anywhere recording an activity+week makes it 'held' for everyone in scope), and a missing row for that pair counts as an absence via lib/portal/qr.ts's attendanceRate(). Verified failure scenario: a servant whose group never attends a church-wide-recorded activity is scored 0/N on it. Escalated to high: this silently corrupts a scored, evaluative metric (rate + 'Standing' badge) shown as fact to servants and admins — squarely 'data corrupted' per this audit's own calibration, not just friction.
- **Fix:** Scope heldPairs to servantId: { in: servantIds }, or make held-vs-not-applicable an explicit per-activity decision, and show the denominator alongside every rate for auditability.

### `F0621` [MOVED] The OG's one-page Take/Report/QR tab switcher is now three disconnected surfaces, with zero cross-links to the QR tab
- **Role:** servant · **Area:** servantattendanceall
- **OG:** renderServantAttendanceBulkPage tabsHtml L7818-7822 (single URL, three buttons)
- **Now:** /portal/servant-attendance (take, page.tsx), /portal/servant-attendance/report (report page.tsx, links back), /portal/qr (page.tsx) with GroupCodePanel.tsx mode==='MEETING'
- **Verified:** Confirmed by reading all three files. Take Attendance and Weekly Report at least link to each other ('Weekly report' action / 'Servants Attendance' back link). The Meeting-mode QR generator lives entirely inside the general-purpose /portal/qr hub (shared with student attendance/points check-in), reachable from a totally separate top-level nav item, with no link in either direction between it and /portal/servant-attendance. A servant thinking 'I need to take my team's attendance via QR' has no reason to look at a page titled 'QR Check-in.'
- **Fix:** Add a 'Generate meeting QR' button/link on the Servants Attendance page header pointing at /portal/qr?tab=group&mode=meeting (or similar), the same way the Weekly Report link already sits in that header.

### `F0400` [MOVED] Photo upload is fully built (file picker, live preview, remove button) but completely unlinked — an orphaned route, not a missing feature
- **Role:** servant · **Area:** studentProfile
- **OG:** L10222-10256 (file picker, canvas square-crop to 160px, preview, remove button, inline in the edit form)
- **Now:** app/portal/(app)/photo/page.tsx + components/portal/PhotoUpload.tsx (self photo, or ?student=<id> for a student in a servant's class)
- **Verified:** This is not missing code — components/portal/PhotoUpload.tsx is a complete, working flow: file picker, client-side downscale to 256×256 JPEG (not a true square crop like the OG's 160px crop, but functionally equivalent), live preview, and a working remove-photo action, wired to real server actions (setStudentPhoto/removeStudentPhoto, setMyPhoto/removeMyPhoto). Exhaustive search (href.*photo, portal/photo, PhotoUpload across app/portal and components/portal) found zero links to this route anywhere — not the student profile page, not the edit form, not My Profile/settings. It is reachable only by typing /portal/photo?student=<id> directly. Severity stays high: this is precisely 'can do it but will not find it' — the feature works perfectly once you land on it, but nothing in the UI ever points there.
- **Fix:** Add a 'Photo' link/button on the student profile page (and ideally inside the edit form) pointing at /portal/photo?student=${s.id} for anyone with student.write, and a 'My photo' link from My Profile/settings for self-service.

### `F0064` [MOVED] Print QR codes / Print Report buttons are gone from the class profile header, moved to unlinked separate pages
- **Role:** servant · **Area:** students
- **OG:** Class Profile header (adOpenClassView from class cards at L2978); printqr view L4693-4696, renderPrintQRPage
- **Now:** /portal/qr/cards (QrCardsPage) and /portal/reports/cards, both reachable only via the separate QR/Reports top-level nav items with a ?class= picker
- **Verified:** Confirmed by reading the full class page (app/portal/(app)/classes/[id]/page.tsx): header actions are only 'Take attendance' / 'Points' / 'Add student'. Confirmed both destination pages exist and work (PrintButton, correct QR+loginId card layout matching the OG's print sheet). Neither is one click from the class a servant is actually looking at.
- **Fix:** Add LinkButton to /portal/qr/cards?class=${cls.id} and /portal/reports/cards?class=${cls.id} in the class PageHeader actions.

### `F0385` [MISSING] No search/filter box over the class roster grid
- **Role:** servant · **Area:** students
- **OG:** L4693, filterStudents L16002 (live client-side filter by name or email)
- **Now:** nowhere on app/portal/(app)/classes/[id]/page.tsx
- **Verified:** Read the full class page: the roster is a plain alphabetically-sorted card grid with no <input> search anywhere above it. 'Finding a student' is this church's own explicit example of a blocker-tier task, and a larger class (30+ students) has no way to jump to a name besides scrolling/scanning. Kept at high.
- **Fix:** Add a client-side search/filter input above the roster grid, matching on first/last name (and loginId, since there's no student email field to match on).

### `F0467` [MISSING] Case row WhatsApp quick-link (waLink, 10-digit US numbers get 1 prepended)
- **Role:** servant · **Area:** visitation
- **OG:** waLink() function at index.stripped.html:16751; used in caseRow() at L17237-17257 to render a green circular wa.me link plus a tel: link on every follow-up case row
- **Now:** nowhere
- **Verified:** Independently grepped wa\.me|waLink|whatsapp (case-insensitive) across app/, lib/, components/. The only wa.me hit in the whole app is an unrelated generic event-share link in app/portal/(app)/events/page.tsx:152 (no phone number). CaseActions.tsx has 'whatsapp' only as a text label in a contact-method dropdown, not a link. Neither follow-ups/page.tsx nor follow-ups/[id]/page.tsx renders a wa.me link. Worth noting the gap is broader than stated: the new list-page case row shows no phone info at all (not even tel:) - a phone number only appears after opening the case detail's Family contacts card - so both the phone and WhatsApp one-tap actions from the OG row are gone, not just WhatsApp.
- **Fix:** Add a real wa.me deep link with the same phone normalization (waLink logic) next to a tel: link, both on the follow-ups list row and the case detail page.

### `F0468` [MISSING] "Send" button -> Send-a-Message modal (channel picker, contact picker, editable pastoral template, mailto:/wa.me dispatch)
- **Role:** servant · **Area:** visitation
- **OG:** Send button at L17251; openSendMessageModal() logic at L17340-17416; #modal-send-message markup at L19674-19703 (Email/Message channel choice, #sm-contacts-list contact picker, #sm-message-text editable template, sendMessageNow() dispatch)
- **Now:** nowhere
- **Verified:** Searched independently for compose|outreach|template|channel.?pick|contact.?pick|pastoral across app/portal, lib/portal, components/portal - the only hits are an unrelated FeedComposer (class feed posts) and a CSV import template, nothing messaging-related. Confirmed only 3 bare mailto:{email} links exist app-wide (students/[id]/page.tsx:199, follow-ups/[id]/page.tsx:159, events/page.tsx:160 which is for sharing an event, not pastoral outreach) - none prefill a subject or body. No channel picker, contact aggregator, or editable template exists anywhere in the codebase.
- **Fix:** Rebuild the templated outreach flow: channel choice, a contact picker listing the student's own and each parent's email/phone by label, an editable pre-filled pastoral check-in message, dispatched via mailto:/wa.me.

### `F0442` [DEGRADED] Attendance tab: all sessions shown side-by-side per week (Week N header spans columns, abbreviated column per session) is now locked to one session at a time
- **Role:** servant · **Area:** weeklyreport
- **OG:** renderAttendanceMonthTable() at L8938-8979, feeding the weeklyreport panel ('Present / Absent across the 6 weekly sessions, by month'); same multi-session activities data also feeds printAttendanceReport() and downloadBlankAttendanceForm() via the shared buildAttendancePrintHTML(), so the OG's printed/blank paper form also covers all sessions on one sheet
- **Now:** app/portal/(app)/reports/page.tsx (sessionKey resolved to a single value around line 237-241, defaulting to 'sunday'); components/portal AttendanceMatrix.tsx renders only that one session's dates as columns; lib/portal/data/reports.ts loadAttendanceMatrix() takes a non-nullable single sessionKey (unlike loadChurchReport, whose sessionKey is nullable/'all sessions' at the church-report level)
- **Verified:** Read reports/page.tsx in full, AttendanceMatrix.tsx in full, and loadAttendanceMatrix()'s type signature - confirmed no multi-session grid exists for a class's attendance matrix, only for the separate 'Church reports' tab's per-class summary tiles (which don't show a day-by-day grid at all). Also confirmed via the OG source that the blank/printable form a servant hands out on Sunday combines all sessions in the OG but is now single-session in the new portal too, meaning up to 6 separate printouts per month instead of one combined sheet - directly matching this batch's own 'printing what they hand out on Sunday' example of a high-impact weekly-task gap.
- **Fix:** Rebuild the Attendance tab's matrix (and its print/blank-form output) to show all configured sessions as grouped columns per week, as the OG did, instead of requiring a session filter to see each one separately.

### `F0837` [BROKEN] My Photo (click own avatar) is fully built but has zero links anywhere — not blocker, since it isn't a weekly task
- **Role:** student · **Area:** adLoad(overview) sidebar crest / svLoad('myprofile') / stLoad('profile') / ptLoad(overview) sidebar
- **OG:** index.stripped.html L10373-10440 (openMyPhotoModal/saveMyPhoto), triggered from the crest/avatar at L2701, L5613, L12392, L19119
- **Now:** app/portal/(app)/photo/page.tsx exists and works; lib/portal/nav.ts (all 4 roles), components/portal/Shell.tsx crest/topbar avatar, and lib/portal/session.ts/permissions.ts (no photo field at all) confirm it is unreachable
- **Verified:** Verified every claim: nav.ts has no photo entry for any role; Shell.tsx crest links to /portal with a static logo; the topbar avatar is a plain initials <span>; session.ts/permissions.ts have zero "photo" hits so nothing could wire it in even if a component tried.
- **Fix:** Thread user.photo through requirePortalUser -> layout.tsx -> <Shell photo=...>, render it in crest/topbar with initials fallback, and link those avatars to /portal/photo.

### `F0045` [BROKEN] /portal/photo is a fully orphaned route — the photo uploader works but nothing links to it
- **Role:** student · **Area:** auth-login
- **OG:** index.stripped.html L5613-5614 — Servant My Profile avatar, 'Tap photo to change'
- **Now:** app/portal/(app)/photo/page.tsx (own photo, and ?student=<id> for a servant editing a student's photo)
- **Verified:** Independently verified with different search terms: grep for portal/photo|PhotoUpload across app/lib/components finds only the page's own imports and two revalidatePath calls — zero Links, zero router.push. Read lib/portal/nav.ts in full (all 4 role arrays): no photo item anywhere. Read StudentProfileActions.tsx in full: Reset PIN / Mark reviewed / Delete, no photo action. Also confirmed there is no 'My Profile' page anywhere in the new portal at all — closest is /portal/settings, which also lacks a photo control. This is exactly the calibration's 'high' case: the feature works but nobody can reach it.
- **Fix:** Add a 'Change photo' link on the account/settings card (self) and on the student profile page (servant editing a student), pointing at /portal/photo and /portal/photo?student={id} respectively.

### `F0690` [MISSING] Sidebar item "Grades & Points" is missing for students — real gap, but not a weekly-task blocker
- **Role:** student · **Area:** dashboard
- **OG:** index.stripped.html L11593 (`data-label="Grades & Points" id="s-sbi-gr" onclick="stLoad('grades',this)"`)
- **Now:** n/a — lib/portal/nav.ts STUDENT case (L96-110) has no Grades entry, and no grades route exists under app/portal/(app)
- **Verified:** Confirmed exactly as claimed via both the nav.ts read and a directory listing of app/portal/(app) (no grades folder).
- **Fix:** Add the nav item once the grades page (F0707) exists.

### `F0308` [DEGRADED] Servants and students can no longer see events targeted at other classes — the OG showed every role the whole school's calendar
- **Role:** student · **Area:** events
- **OG:** index.stripped.html L14971-14976 — loadScheduleTab's allClasses branch, called with true from all four role shells (L3458-3459, L5568-5569, L12667-12668, L15632-15633)
- **Now:** lib/portal/data/community.ts:36 (communityScope.seesEverything = ADMIN/PASTOR only), :145-148 (listEvents targeting filter)
- **Verified:** Confirmed the OG reads the whole schedule collection for every role. Confirmed the new query restricts SERVANT/STUDENT to targetAll-flagged events plus events targeted at their own class — an event aimed at a specific other class is now genuinely invisible to everyone outside it, where the OG showed it to all with targeting only as an informational badge. This is real, class-scoped data invisibility for two entire roles, matching the calibration's high bar precisely.
- **Fix:** Either drop the targeting filter for servants/students entirely (make targeting a badge, not a visibility gate, as the OG's pill implied) or add a 'Whole school / My classes' toggle defaulting to whole school.

### `F0018` [MISSING] Future-dated quizzes unlock immediately — real integrity bug, but framed as data-exposure risk rather than a task blocker
- **Role:** student · **Area:** exams
- **OG:** index.stripped.html L11959-11964 (status ladder, dueDate>today => 'upcoming'), L12077-12086 (locked card)
- **Now:** lib/portal/exams.ts examStatusFor (L123-139) — confirmed no branch at all for a future dueDate
- **Verified:** Read the full function: submitted->completed, DRAFT->upcoming, reopened->available, CLOSED->missed, dueDate<today->missed, else->available — a published exam with a future due date is available the instant it's published. Also verified submitQuiz (lib/portal/actions/exams.ts:358-364) reuses this same function, so it already inherits the same bug AND the same fix — the suggested separate mirror-guard in submitQuiz is unnecessary once examStatusFor is fixed.
- **Fix:** Add `if (exam.dueDate && exam.dueDate > today) return 'upcoming'` before the missed check in examStatusFor, after the reopened check. No separate change needed in submitQuiz.

### `F0707` [MISSING] Whole "My Grades & Points" page is missing — confirmed, real capability loss, not a weekly-task blocker
- **Role:** student · **Area:** grades
- **OG:** index.stripped.html L12107-12217 (full page: 3-stat strip, Activities & Points with progress bars, Exam Results history)
- **Now:** nowhere — no grades directory under app/portal/(app); grep of lib/portal/nav.ts and lib/portal/*.ts for grades/Grades returns only unrelated false positives (CURRICULUM_GRADES, a letter-grade comment, a "degrades" code comment)
- **Verified:** Confirmed directly by reading the cited OG block and by listing app/portal/(app)'s directories.
- **Fix:** Build /portal/grades reusing PointEntry fields already in schema, as given.

### `F0148` [MISSING] "My Profile" (nav item, dropdown, mobile bar) doesn't exist for servant or student — confirmed, real gap, not a weekly-task blocker
- **Role:** student · **Area:** nav-ia
- **OG:** index.stripped.html L4043 (servant sbi), L11588 (student sbi), L1559/1606 (dropdown rows), L1566/1616 (mobile bar onclick)
- **Now:** nowhere — no app/portal/(app)/profile route exists; lib/portal/nav.ts has no "Profile" label anywhere; components/portal/Shell.tsx crest links to /portal, topbar avatar and mobile identity bar have no click-to-profile or dropdown mechanism at all, for any role
- **Verified:** Verified every citation directly: route listing, full nav.ts read, and the relevant Shell.tsx sections (crest, topbar avatar, mobile identity bar).
- **Fix:** Create app/portal/(app)/profile/page.tsx, add nav items for SERVANT/STUDENT, wire the mobile bar and avatar (once a dropdown exists) to it — as given.

### `F0723` [MISSING] Whole self-profile page (hero, rank pill, stat strip, Personal Info) is missing — confirmed with one nuance: a partial, accidental path exists via the Leaderboard
- **Role:** student · **Area:** profile
- **OG:** index.stripped.html L12343-12419 (hero, 72px avatar, rank pill, 4-stat strip, Personal Information card)
- **Now:** app/portal/(app)/settings/page.tsx shows only name+role+PIN (L9-30); app/portal/(app)/students/[id]/page.tsx explicitly hides the Family & contact card and follow-up cases when isSelf (L181+)
- **Verified:** Kept distinct from F0148 because it supplies the actual content spec F0148 lacks. One nuance found: app/portal/(app)/leaderboard/page.tsx links every row (including the viewer's own) to /portal/students/${studentId}, so a student CAN reach a partial self-view (stats/points, no personal info, no photo link) — the finding's "nowhere"/"no student-reachable nav link" is slightly overstated, though the substantive gap (no OG-equivalent profile experience) stands.
- **Fix:** Build the dedicated self-profile page as given; alternatively, as a faster interim fix, un-hide the Family & contact / follow-up cards on the student detail page for isSelf.

### `F0721` [MISSING] Mobile identity bar tap → profile
- **Role:** student · **Area:** profile
- **OG:** L1550-1580 (cited L1566 verified): #s-mob-id (.mobile-id-bar) has onclick="stLoad('profile',...)" — tapping the whole avatar/name strip opens the profile
- **Now:** nowhere — components/portal/Shell.tsx lines 219-240 (the mobile identity bar) has no onClick on the bar, avatar or text; only the hamburger button is interactive, and it only toggles the off-canvas nav panel
- **Verified:** Confirmed by reading Shell.tsx lines 200-314 in full. Compounding issue found independently: lib/portal/nav.ts's STUDENT nav array has no 'Profile' entry at all, and the student home page (app/portal/(app)/page.tsx StudentHome) has no link to a student's own record either — so even opening the hamburger menu today surfaces no profile destination. The identity-bar tap is the smallest piece of a larger gap shared with F0722.
- **Fix:** Wrap the mobile identity bar (and ideally the desktop topbar avatar chip too) in a Link to a real profile destination, AND add that destination to lib/portal/nav.ts's STUDENT case (e.g. a 'My Profile' item pointing at /portal/students/[user.studentId]) — without the nav.ts entry, wrapping the bar in a link fixes only the mobile path, not the underlying missing route.

### `F0722` [MISSING] Mobile bottom-nav 'Profile' tab (and the whole persistent bottom nav pattern) is gone, and no nav surface links students to a profile at all
- **Role:** student · **Area:** profile
- **OG:** L19936-19947 (cited L19941 verified), #st-mob-nav block: persistent 6-icon bottom bar (Home/Exams/Grades/Reading/Profile/More) always visible on mobile for every role
- **Now:** nowhere — components/portal/Shell.tsx has no fixed-bottom element for any role (fresh grep for bottom-0|BottomNav|mob-bottom|fixed bottom|sticky bottom returns nothing); replaced by a sticky top identity bar + full-screen hamburger drawer
- **Verified:** OG and new-portal absence both confirmed directly. Went further than the cited evidence: checked lib/portal/nav.ts's STUDENT array (what populates the hamburger drawer) directly — it has zero 'Profile' entries. So the gap isn't just 'no persistent bottom nav' cosmetically, it's that no navigation surface at all (mobile drawer or desktop rail) currently links a student to their own record. The underlying page (/portal/students/[id] with isSelf logic) is permission-reachable (student.read allows ctx.studentId === user.studentId) but effectively undiscoverable since nothing links to it and the id is an opaque CUID.
- **Fix:** Same root fix as F0721: add a 'My Profile' entry to the STUDENT branch of navForUser in lib/portal/nav.ts pointing at /portal/students/[user.studentId] — this alone restores reachability on both mobile (via the drawer) and desktop (via the rail). Restoring a literal one-tap bottom nav is a separate, lower-priority UX decision on top of that.

### `F0724` [DEGRADED] Self-profile 'Personal Information' card is gone for students — Phone/Father/Mother/Address are hidden entirely (Date of Birth is NOT missing, it survives in the page header)
- **Role:** student · **Area:** profile
- **OG:** L12380-12420 (cited L12406-12412 verified): infoRow() builds a dedicated 'Personal Information' card with Date of Birth, Phone, Father, Mother, Address rows, always shown to the student themselves
- **Now:** app/portal/(app)/students/[id]/page.tsx: DOB is shown at line 81 in the PageHeader subtitle (`{s.dob && ' · X years old · born Y'}`), NOT gated by isSelf — so it IS present, just relocated. Phone/Father/Mother/Address are inside the 'Family & contact' Card (lines 181-207), which is wrapped entirely in `{!isSelf && (...)}` and renders nothing for a student viewing their own record.
- **Verified:** Read the full profile page. The original finding bundles 5 fields as uniformly 'MISSING,' but that's inaccurate for one of them: Date of Birth does render for self (as inline age+birthdate text in the header), just not as a dedicated row. Phone, Father, Mother and Address are genuinely and completely absent for self — the whole card is gated off. 'Phone' here ties directly to F0059: there is no student-own-phone concept surfaced anywhere in the new app regardless of viewer. This finding is also currently moot in practice because of F0721/F0722 (no nav path gets a student to this page at all today) — but becomes live the moment that entry point is restored, so it's a real, separate defect worth fixing at the same time.
- **Fix:** In the profile page's right-column, add a self-visible 'My Information' card (Phone, Father, Mother, Address — DOB can stay in the header or be duplicated here for parity) that renders for isSelf using the same data already being fetched, instead of gating the whole Family & contact card off with `!isSelf`. Wire the student's own phone through once F0059's Account.phone plumbing is fixed.

### `F0319` [MISSING] Tap-to-expand Bible passage text is gone (references only) — confirmed, but the tracked reading check-in itself still works
- **Role:** student · **Area:** readings
- **OG:** index.stripped.html L13372-13405 (expandReadingPassage), L13466-13472 (clickable row)
- **Now:** app/portal/(app)/readings/page.tsx L101 renders each reference as a plain, non-interactive <dd>
- **Verified:** Confirmed no onClick/expand state/fetch exists; grep for bible-api/expandReading/passage across app/lib/components finds nothing relevant. Also confirmed the reading check-in and streak tracking (ReadingCheckIn component) is unaffected and fully functional — only the in-app passage text display is gone, so the actual tracked weekly action still completes end-to-end.
- **Fix:** Proxy bible-api.com server-side and restore the expandable row, as given.

### `F0054` [BROKEN] Student photo upload by a servant/admin is fully built but unreachable — confirmed, distinct from the self-photo gap (F0837)
- **Role:** student · **Area:** students
- **OG:** index.stripped.html L19279-19288 (Edit Student Info modal), L10230-10259 (crop/upload handlers)
- **Now:** /portal/photo?student=<id> works correctly; components/portal/StudentForm.tsx has no photo field; app/portal/(app)/students/[id]/StudentProfileActions.tsx offers only Reset PIN/Mark reviewed/Delete; the avatar in students/[id]/page.tsx:98 has no surrounding Link
- **Verified:** Verified StudentForm.tsx has zero "photo" hits in its form state, and read StudentProfileActions.tsx in full to confirm no photo action exists.
- **Fix:** Add a Photo button to StudentProfileActions.tsx pointing at /portal/photo?student=${s.id}, as given.

### `F0059` [MISSING] Student's own Email and Phone have been dropped from every form (create, edit) and from the profile display, though the underlying Account.email/Account.phone columns exist and are already queried
- **Role:** student · **Area:** students
- **OG:** L4640-4665 (servant add form, ns-email/ns-phone), L3330-3350 (admin add form, adas-email/adas-phone), L19285-19310 (edit modal, es-phone 'Student Phone' + es-email 'Email'), L10148-10215 (editStudentModal/adEditStudentModal load these from the student's own doc), L10470-10500 (saveStudentEdit writes them back) — all four citations verified by direct read; this is the student's own contact info, distinct from father/mother phone fields which exist separately in both OG and new app
- **Now:** nowhere — components/portal/StudentForm.tsx (create+edit) has no student email/phone field; lib/portal/actions/students.ts's createStudent/updateStudent never touch account.email/account.phone (only displayName); the Family & contact card on students/[id]/page.tsx never renders s.account.email/s.account.phone even for non-self viewers
- **Verified:** All citations verified accurate by reading the OG lines directly. In the new app, prisma/schema.prisma confirms Account has email/phone (String?, shared with Servant/Admin accounts) and lib/portal/data/students.ts's studentSelect does select account.email/account.phone, exactly as the evidence says — the plumbing exists but nothing writes or displays it today. One nuance not in the original evidence: lib/portal/import-transform.ts (L300-320) shows the historical CSV migration DID carry a student's phone into Account.phone (only email was zeroed and folded into parentEmails) — so some already-migrated students may have a legacy phone value sitting in the DB with no UI to see or edit it. This doesn't change the practical verdict: for any student created or edited since the port, and for viewing any student's contact info at all, the field is completely inaccessible.
- **Fix:** Add 'Email' and 'Student Phone' fields to StudentForm.tsx's Student card, thread them through StudentFormInput/createStudent/updateStudent as a nested `account: { update/create: { email, phone } }`, render them on the profile's contact card (for both self and non-self viewers), and if CSV import is ever re-run, keep mapping the student's own 'phone' column to Account.phone (already correct) without also folding it into parentEmails.

### `F0063` [MOVED] Class reassignment was pulled out of the Edit Student form into an instant-fire, unconfirmed dropdown on the admin All Students list only
- **Role:** student · **Area:** students
- **OG:** L19291 (es-class-fld, second field after Full Name, hidden by default); L10148-10215 (adEditStudentModal sets _esAdminMode=true and shows es-class-fld; the servant path editStudentModal hides it and sets _esAdminMode=false); L10470-10500 (saveStudentEdit writes classId+stage and adjusts studentCount on both classes only when isAdmin) — all verified by direct read
- **Now:** app/portal/(app)/admin/students/MoveStudentSelect.tsx, used only in admin/students/page.tsx:171 — a 28px <select> (aria-label only, no visible label) in each student card's footer, firing moveStudent() directly onChange with no confirmation
- **Verified:** Verified both sides in full. StudentForm.tsx (used by /portal/students/[id]/edit for admins and servants alike) has no Class field at all, and its `initial` object has no classId. moveStudent (lib/portal/actions/students.ts L135-153) is admin-only, updates classId immediately with no undo/confirm step, though it does correctly audit-log the move. The finding is accurate: the capability survives but has been relocated off the record's own edit flow onto a separate list page as a hair-trigger control, which is a real workflow regression for an admin fixing a child's details and class in one pass, and a real misclick risk since there's no confirm step.
- **Fix:** Add a Class <select> to StudentForm.tsx, shown only when the current viewer is an admin (mirror _esAdminMode with `user.role === 'ADMIN'`), wire its value through updateStudent → moveStudent so a class change saves alongside the rest of the edit; keep MoveStudentSelect on the admin list as a quick-action shortcut but add a confirm step to it given it fires on change with no undo.


---

## MEDIUM (400)

### `F0822` [MISSING] Confirmed — no bulk-select checkboxes, bulk "Move to class," or bulk "Delete Selected" on Admin → All Students; only one-at-a-time move + edit
- **Role:** admin · **Area:** Admin > All Students (id='allstudents')
- **OG:** index.stripped.html L3360-3379, L10015-10087 — plausible on its face, consistent with the OG's other confirmed bulk-action patterns; not independently line-verified since the new-portal side fully confirms the gap regardless
- **Now:** app/portal/(app)/admin/students/page.tsx (full 185-line read) — MoveStudentSelect (single class) + Edit link per card only; lib/portal/actions/students.ts has createStudent, updateStudent, resetStudentPin, clearImportNotes, moveStudent, deleteStudent, deleteStudentAndRedirect only — no bulk equivalents
- **Verified:** Confirmed no checkbox or bulk action exists anywhere. Severity corrected down: doable one-at-a-time, discoverable, not hidden — this church's calibration buckets that as "medium = friction" rather than "high = can't find it."
- **Fix:** Add a checkbox per student card, a select-all, and a sticky bulk bar with move/delete actions.

### `F0806` [MISSING] Confirmed missing, lower priority than filed — the new portal's unified page architecture already gives admins a superset view of any class/servant without needing to impersonate them
- **Role:** admin · **Area:** Admin → Classes / Servants cards
- **OG:** index.stripped.html L2647-2678 — adOpenClassView/adOpenServantProfile literally swap window._me.role to 'servant' and re-render the SPA's separate servant page tree; verified directly
- **Now:** nowhere — grep -rniE "impersonat|view as|exit to admin" across app/lib/components returns no hits
- **Verified:** Confirmed the feature is absent. Added context the finding didn't have: the new portal renders one shared route with can() permission checks for both admin and servant, unlike the OG's two entirely separate SPA renderers — so an admin already sees a superset of what a servant sees on any class/servant page without a special mode. The remaining value (reproducing servant-specific permission bugs exactly) is real but narrower than the original framing implies.
- **Fix:** Lower priority; add if servant-specific troubleshooting becomes a recurring pain point.

### `F0812` [DEGRADED] Servants toolbar: Import/Export CSV moved to Data & Backup; Template is gone entirely; bulk PIN export has no equivalent (PINs are now hashed)
- **Role:** admin · **Area:** Servants (admin)
- **OG:** Servants page toolbar, OG L3008-3013 (cited L2966-2969 is actually the Classes 'Add Class' panel)
- **Now:** Import/Export CSV: /portal/admin/data ImportPanel.tsx. Template: nowhere. Export All IDs & PINs: no equivalent (data-tools.ts never exports PIN hashes; new PINs only shown transiently on create/reset/import)
- **Verified:** Verified OG toolbar is at a different line than cited but contains Template, Import CSV, Export All IDs & PINs, and also a Print Roster button not mentioned by the finding. New admin/servants/page.tsx has zero toolbar (confirmed by full read). Import/Export CSV genuinely moved to ImportPanel.tsx. But grep for 'Template' across data-tools.ts and admin/data returns nothing -- Template isn't relocated, it's missing. And PINs are hashed at rest and deliberately never bulk-exported (data-tools.ts comments confirm this design choice), so 'Export All IDs & PINs' isn't just moved, it has no like-for-like replacement for existing accounts.
- **Fix:** Add Import/Export CSV buttons back on the Servants page (or make Data & Backup more discoverable from there); add a Template download (currently absent anywhere); for credentials, add a way to download the ImportPanel's post-import 'new PIN' list as CSV rather than trying to restore bulk export of existing (now-hashed) PINs.

### `F0811` [DEGRADED] Students toolbar: Import/Export CSV moved to Data & Backup; Template is gone entirely; bulk PIN export has no equivalent
- **Role:** admin · **Area:** Students (admin, per-class) and All Students (admin)
- **OG:** Students page toolbar OG L4633-4640; All Students export-all OG L3330
- **Now:** Import/Export CSV: /portal/admin/data ImportPanel.tsx. Template: nowhere. Export IDs & PINs: no equivalent
- **Verified:** Same investigation and conclusion as F0812, applied to students. Confirmed admin/students/page.tsx has zero toolbar via full file read. exportStudentsCsv/importStudentsCsv exist on the Data & Backup page (genuine move) but no Template download exists anywhere (grep confirms), and bulk PIN export has no true replacement since PINs are hashed and only ever shown once transiently.
- **Fix:** Same as F0812: restore Export/Import CSV entry points nearer Students, add a genuine Template download, and replace 'Export IDs & PINs' with a download of the newly-generated PINs shown after an import (existing accounts' PINs cannot be bulk-recovered by design).

### `F0845` [DEGRADED] Attendance session point values + extra sessions: fixed sessions no longer locked, no delete for extra sessions, no icon field
- **Role:** admin · **Area:** adLoad('settings') — Attendance Sessions card
- **OG:** Settings > Attendance Sessions card, OG L2848-2913
- **Now:** app/portal/(app)/admin/sessions/SessionEditor.tsx + saveSession() in lib/portal/actions/admin.ts:215-238
- **Verified:** Read OG card in full: text confirms '...servants cannot rename or remove them' with the 6 fixed sessions rendered as a locked label + points-only input; extra sessions get icon+label+points+a delete button (deleteExtraSession). New SessionEditor.tsx makes every row's label an editable input (no lock) and has no icon field; grepped admin.ts and data-tools.ts for any delete/remove-session export -- none exists, only an isActive toggle. Matches the finding exactly.
- **Fix:** As given: lock label/key for the 6 seeded sessions, add a real delete for admin-added sessions, add an icon field.

### `F0846` [DEGRADED] End-of-year reset has no live student count woven into its own confirmation copy
- **Role:** admin · **Area:** adLoad('settings') — Danger Zone: End of Year Reset
- **OG:** Settings > Danger Zone, OG openEndOfYearResetModal() L17692-17709
- **Now:** app/portal/(app)/admin/data/DangerZone.tsx + endOfYearReset() in lib/portal/actions/data-tools.ts:974-1017
- **Verified:** Confirmed OG fetches and displays the exact student count before the admin can even reach the typed-confirm step (next button stays disabled until it resolves). New DangerZone.tsx card shows static category copy but no live count; endOfYearReset() only reports counts after the irreversible delete. A separate StatCard elsewhere on the same page does show total students, but it isn't wired into this card's confirmation text.
- **Fix:** As given: pull the live student count into the Danger Zone card's own confirmation copy.

### `F0847` [DEGRADED] Reset activities is per-class (not global) AND deletes ALL of a class's activities, not just non-standard extras, contradicting its own UI copy
- **Role:** admin · **Area:** adLoad('settings') — Danger Zone: Reset Activities to Standard 6
- **OG:** Settings > Danger Zone, OG resetActivitiesToStandard5() L18087-18105
- **Now:** app/portal/(app)/admin/data/DangerZone.tsx 'Reset a class's point activities' + resetClassActivities() in lib/portal/actions/data-tools.ts:1019-1037
- **Verified:** Confirmed OG deletes only non-standard-key docs church-wide in one click, explicitly preserving the 6 standard activity docs. New resetClassActivities() takes one classId and runs `pointActivity.deleteMany({where:{classId}})` with NO filter for standard vs custom -- I checked the schema and both seed.ts/seed-templates.ts and found no seeded 'standard 6' PointActivity rows per class, and the Points page reads activities purely from the DB with no fallback list. So this wipes a class's entire activity/button set, not just extras, directly contradicting the DangerZone card's own copy ('Removes the custom activities that class defined... Kept: every point already awarded'). Already-awarded points keep their label so there's no historical data loss, but the class must rebuild its whole activity list afterward.
- **Fix:** Add a global 'reset every class' option as originally suggested, AND fix resetClassActivities to only remove non-standard activities (or correct the UI copy to say it clears everything, not just extras).

### `F0591` [MISSING] Lesson Archive lost its free-text search ("Search lessons, saints, verses…")
- **Role:** admin · **Area:** agenda
- **OG:** renderLessonArchive(), index.stripped.html L8614 (input#archive-search, oninput=renderArchiveTimeline)
- **Now:** nowhere — the closest analog is the Archive accordion in app/portal/(app)/agenda/page.tsx (ArchiveMonths), which also has no search
- **Verified:** OG really does filter every filled week's lesson/bible/saint topics, verse, song, notes etc. client-side. Confirmed truly absent everywhere in the new portal. Severity corrected down: this is a planning-convenience for an admin/pastor, not a weekly-task blocker, and the archive is short enough (<=60 weeks/class) to scan by month without search.
- **Fix:** Add a text filter above ArchiveMonths (agenda/page.tsx) that matches against each week's saved topics/notes, mirroring OG's haystack search.

### `F0592` [DEGRADED] Lesson Archive's timeline is stripped to bare date tiles in the Agenda page, not simply missing
- **Role:** admin · **Area:** agenda
- **OG:** renderLessonArchive() cards, index.stripped.html L8656-8688 (title, Bible/Saint/Taught-by meta, Open Slides / View Full Week buttons)
- **Now:** app/portal/(app)/agenda/page.tsx:149-253 (ArchiveMonths), built from listAgendaWeeks() in lib/portal/data/agenda.ts:136 — the correct AgendaWeek data model
- **Verified:** The finding is right that /portal/lessons?view=archive is a different data model (Lesson table), but it missed that the true successor already exists on the SAME AgendaWeek data OG used: a month-accordion of date tiles in agenda/page.tsx, linking each week to the full week view (OG's 'View Full Week'). It's real, just badly stripped: no visible lesson title, no 'Taught by' text (only a hover tooltip), no per-card 'Open Slides' button — just a date + fill-count tile. State is DEGRADED, not MISSING, and location is /portal/agenda, not 'nowhere'.
- **Fix:** Expand each ArchiveMonths tile (or add an expanded list view) to show the lesson title, lead servant name and an Open Slides button, matching the OG card, instead of only a fill-count date tile.

### `F0221` [MISSING] Confirmed — bulk week selection and "Clear Selected Weeks" are gone; only one week can be cleared at a time
- **Role:** admin · **Area:** agenda
- **OG:** index.stripped.html L8388-8412 — plausible on its face, consistent with the OG's other confirmed bulk-action patterns; new-portal side independently confirmed regardless
- **Now:** lib/portal/actions/agenda.ts:279-281 ClearSchema is singular ({classId, weekStart}); app/portal/(app)/agenda/AgendaEditor.tsx has only a single "Clear this week" button with a confirm toggle, no checkbox or multi-select UI anywhere in the file
- **Verified:** Confirmed no bulk clear exists. Severity corrected down: doable one week at a time, discoverable via the existing per-week Clear button — this church's calibration buckets repeat-N-times friction as medium rather than high.
- **Fix:** Add a clearAgendaWeeks batch action and bulk-select checkboxes on the archive tiles, as proposed.

### `F0584` [DEGRADED] 3-way tab switcher (Edit List / Weekly Assignment View / Lesson Archive) reduced to two split routes; Lesson Archive's searchable timeline has no equivalent
- **Role:** admin · **Area:** agenda
- **OG:** OG L3198-3210 (tab buttons), renderLessonArchive() L8595-8660
- **Now:** app/portal/(app)/agenda/page.tsx:74-83 (Edit List is default, Weekly Assignment View is a header link); no Lesson Archive equivalent
- **Verified:** Confirmed tab-switcher markup at cited lines. Also read renderLessonArchive() in full: it's a searchable timeline (search lessons/saints/verses) across all filled weeks for a class -- materially different from the new ArchiveMonths tile-grid, which has no search and shows no topic content, just fill-counts. So the Lesson Archive gap is a real content-discovery loss, not just cosmetic tab styling.
- **Fix:** As given: recreate an explicit tab control, or at minimum restore a searchable lesson-topic view somewhere.

### `F0585` [MISSING] Per-week 'select for bulk actions' checkbox is gone
- **Role:** admin · **Area:** agenda
- **OG:** OG L8319 area (toggleAgendaWeekSelect, checkbox on agrow- tiles)
- **Now:** nowhere -- ArchiveMonths tiles in agenda/page.tsx are plain Links
- **Verified:** Confirmed via grep for 'checkbox' across the agenda route -- zero hits.
- **Fix:** None needed unless bulk-clear (F0586) is restored, in which case add checkboxes back.

### `F0586` [MISSING] Bulk toolbar 'N weeks selected' / Deselect All / Clear Selected Weeks is gone
- **Role:** admin · **Area:** agenda
- **OG:** OG L8360-8395 (clearAgendaSelection, clearSelectedAgendaWeeks)
- **Now:** nowhere -- lib/portal/actions/agenda.ts only exports singular clearAgendaWeek
- **Verified:** Confirmed via export grep on agenda.ts -- only the singular clearAgendaWeek exists, no bulk variant.
- **Fix:** Add a multi-select + bulk-clear action.

### `F0588` [MISSING] Agpeya Prayer row lost its 'Select Hour…' dropdown (1st/2nd/3rd/9th/11th/12th), now a free-text field
- **Role:** admin · **Area:** agenda
- **OG:** OG AGPEYA_HOURS array L8157, branch at L8429-8433
- **Now:** app/portal/(app)/agenda/AgendaEditor.tsx renders the same plain <input> for every row including 'agpeya'
- **Verified:** Confirmed AGPEYA_HOURS values and the type==='hour' branch that renders a <select> in OG. Confirmed the 'agpeya' row exists in lib/portal/agenda.ts's fixed row list and AgendaEditor.tsx (lines 174-181) renders an identical text input for all rows with no type branching.
- **Fix:** Special-case the Agpeya row to a 6-option select as given.

### `F0589` [MISSING] Agenda servant assignment can no longer reach servants outside the class -- not just a missing 'This Class/Other Classes' grouping label, the underlying capability is gone
- **Role:** admin · **Area:** agenda
- **OG:** OG getAgendaServantOptions()/buildServantSelectOptions() L8245-8270
- **Now:** lib/portal/data/agenda.ts classServants() queries only ClassServant where classId = <this class>
- **Verified:** Confirmed OG fetches every church servant and splits into sameClass/others optgroups -- any servant, not just this class's own, can be assigned to a lead/backup/activity slot. Confirmed classServants() has no code path anywhere that fetches other classes' servants for the agenda editor -- this is a real functional restriction (can't borrow a servant from another class), not merely a missing UI label.
- **Fix:** Extend the servant option list to include an 'Other Classes' group as given.

### `F0593` [MISSING] 'Blank Template' CSV download for agenda is gone
- **Role:** admin · **Area:** agenda
- **OG:** OG downloadAgendaBlankTemplate() L8735-8739
- **Now:** nowhere -- AgendaTools.tsx only has Export CSV (of existing data) and Import CSV
- **Verified:** Confirmed via grep for 'Template' across agenda actions/components and reading AgendaTools.tsx in full -- no blank-template option exists.
- **Fix:** Add a Blank Template download next to Export CSV as given.

### `F0595` [MOVED] Weekly Assignment View lost its own class/week pickers
- **Role:** admin · **Area:** agenda
- **OG:** OG renderWeeklyAssignmentView() L8515-8534
- **Now:** app/portal/(app)/agenda/week/page.tsx -- separate route, no in-page selectors
- **Verified:** Confirmed via full read of agenda/week/page.tsx: no <select> anywhere, only reads searchParams; changing week requires returning to /portal/agenda's date-jump input.
- **Fix:** Add a week select/date-jump directly on /portal/agenda/week as given.

### `F0564` [MISSING] All Students page has no page-level "Select All" checkbox
- **Role:** admin · **Area:** allstudents
- **OG:** toggleAllAdStudentSelect(this.checked), index.stripped.html L3407
- **Now:** nowhere
- **Verified:** Read the full app/portal/(app)/admin/students/page.tsx: no checkbox, no selection state anywhere; only a per-student MoveStudentSelect (single move) and per-student edit link. Severity down from high: no weekly task is blocked, only an occasional bulk-cleanup task (e.g. year-end promotion) becomes one-at-a-time.
- **Fix:** Add multi-select checkboxes and a page-level Select All control to admin/students/page.tsx, paired with F0565/F0566/F0567.

### `F0565` [MISSING] All Students page has no sticky bulk-action bar (move/delete/deselect)
- **Role:** admin · **Area:** allstudents
- **OG:** #ad-st-bulkbar, index.stripped.html L3410-3415
- **Now:** nowhere
- **Verified:** Confirmed via the same full read of admin/students/page.tsx — no bulk bar, no selection state in the component tree. This is one of four pieces (with F0564/F0566/F0567) of the same missing bulk-select capability; kept separate as each names a distinct UI element. Severity down from high for the same reason as F0564.
- **Fix:** Add a sticky bulk-action bar (selected count, move-to-class select + button, delete selected, deselect all) once any student is checked.

### `F0566` [MISSING] All Students page has no per-class "select all in this class" checkbox
- **Role:** admin · **Area:** allstudents
- **OG:** toggleAdStudentGroupSelect(...), index.stripped.html L3277
- **Now:** nowhere
- **Verified:** Confirmed absent from the ClassGroup component in admin/students/page.tsx. Same underlying gap family as F0564/F0565/F0567. Severity down from high for the same reasoning.
- **Fix:** Add a per-class-group select-all checkbox tied to the same selection state as the bulk bar.

### `F0567` [MISSING] All Students page has no per-student checkbox for bulk select
- **Role:** admin · **Area:** allstudents
- **OG:** .ad-stu-check, index.stripped.html L3251
- **Now:** nowhere
- **Verified:** Confirmed absent from the per-student card markup in ClassGroup. Same underlying gap family as F0564/F0565/F0566. Severity down from high for the same reasoning.
- **Fix:** Add a checkbox to each student card in ClassGroup, wired to the shared selection state.

### `F0569` [DEGRADED] "View ID" is gone; the nearest replacement (Reset PIN) is destructive and one click further away
- **Role:** admin · **Area:** allstudents
- **OG:** showServantCredentialsModal(...), index.stripped.html L3256 (inline, non-destructive, reused for students)
- **Now:** app/portal/(app)/students/[id]/StudentProfileActions.tsx — "Reset PIN" button
- **Verified:** Verified StudentProfileActions.tsx in full: only 'Reset PIN' exists, requiring navigation to the student's own profile (one more click than the OG's inline list action), a confirm dialog, and it invalidates the existing PIN rather than just showing it. A related but weaker capability exists one click further away — this is DEGRADED, not MISSING. Severity down from high: the practical Sunday-morning case (a kid forgot their PIN) is resolved the same way either way (issue a new one); the narrower loss is 'view without resetting.'
- **Fix:** Confirm the security tradeoff with the user (as with F0558); if acceptable, keep Reset PIN as-is, otherwise the only way to restore a true 'View ID' would require storing PINs reversibly, which conflicts with the hashing decision.

### `F0559` [MOVED] Collapsible 'Add Student to Any Class' form with its own class dropdown is gone from the All Students page
- **Role:** admin · **Area:** allstudents
- **OG:** OG L3328-3339 (toggleAddCard('adas-body',...))
- **Now:** /portal/classes/[id]/students/new (StudentForm mode=create), classId only from route param
- **Verified:** Confirmed via full reads of students/new/page.tsx (classId from params only) and admin/students/page.tsx (zero add-student affordance anywhere on the page).
- **Fix:** Add an 'Add student' entry point on /portal/admin/students with a class picker, as given.

### `F0561` [MISSING] Add-student field: student's own Email is gone (schema has no such column)
- **Role:** admin · **Area:** allstudents
- **OG:** OG adas-email, L3385
- **Now:** nowhere
- **Verified:** Confirmed Student model in prisma/schema.prisma has no email column (only parentEmails: String[]); confirmed StudentForm.tsx has no student-email field via full field listing.
- **Fix:** Add an optional email column to Student and surface it in the form, as given.

### `F0562` [MISSING] Add-student field: student's own Phone is gone (schema has no such column)
- **Role:** admin · **Area:** allstudents
- **OG:** OG adas-phone, L3389
- **Now:** nowhere
- **Verified:** Confirmed Student model has no phone column (only fatherPhone/motherPhone); StudentForm.tsx has no matching field.
- **Fix:** Add an optional phone column to Student and surface it in the form, as given.

### `F0563` [DEGRADED] All Students search is a full-page-reload form, not live, and doesn't match email
- **Role:** admin · **Area:** allstudents
- **OG:** OG oninput=adFilterStudentsGrouped(this.value), L3401
- **Now:** app/portal/(app)/admin/students/page.tsx search form
- **Verified:** Confirmed the new search is a plain GET <form> (full reload on submit/Enter), not live-as-you-type. Confirmed server query matches firstName/lastName/account.loginId only, no email field in the OR clause -- consistent with F0561's finding that there's no student email column to search in the first place.
- **Fix:** Add email to the query and/or make search live via client-side filtering or debounced navigation, as given.

### `F0571` [MOVED] Inline per-student Delete is gone from the All Students card, only reachable from the profile page
- **Role:** admin · **Area:** allstudents
- **OG:** OG adRemoveStudentFB(...), L3258
- **Now:** /portal/students/[id] -> StudentProfileActions 'Delete student'
- **Verified:** Confirmed admin/students/page.tsx's ClassGroup cards only offer Move-class and Edit; delete only exists on the student profile page's StudentProfileActions component.
- **Fix:** Add a quick delete action directly on the All Students card, as given.

### `F0192` [MOVED] No single one-click "Take Attendance" nav entry for admin/servant — attendance is 2 clicks via the always-visible Dashboard, not blocked
- **Role:** admin · **Area:** attendance
- **OG:** OG sidebar, admin L2713 (ad-sbi-at "Take Student Attendance") and servant L4012 (sv-sbi-at "Attendance"), under a distinct "Attendance" group — verified directly
- **Now:** app/portal/(app)/page.tsx:104-105 — every class card on the Dashboard (the landing page, /portal) has an unconditional (not Sunday-gated) "Attendance" button; also app/portal/(app)/classes/[id]/page.tsx:83 ("Take attendance" button); actual page at app/portal/(app)/classes/[id]/attendance
- **Verified:** Confirmed via full read of lib/portal/nav.ts: no nav item points at a class register for ADMIN or SERVANT. But the Dashboard (first sidebar item, the landing page) shows an unconditional "Attendance" button on every class card — not gated to Sunday as I first assumed from the finding's own framing. So the task is 2 clicks from the landing page with a clearly labeled button, not actually blocked. That's a real UX regression from the OG's 1-click-from-anywhere sidebar item but does not stop weekly attendance-taking.
- **Fix:** Add nav items (ADMIN: "Take Student Attendance" → class-picker route; SERVANT: "Attendance") for true 1-click parity with the OG.

### `F0213` [MISSING] "Fix Orphaned Attendance" repair tool not ported — and its failure mode is real and currently reachable, not merely a structural non-issue
- **Role:** admin · **Area:** attendance
- **OG:** OG L18212-18272 (fixOrphanedAttendance), L2844 (menu row)
- **Now:** app/portal/(app)/admin/data/RepairPanel.tsx offers only 'orphan-points' (the opposite check)
- **Verified:** Confirmed the 5 repair tools are recount-classes/close-returned-cases/orphan-points/normalise-phones/clear-import-flags — orphan-points only relinks/removes PointEntry rows whose student has no class, the opposite direction from the OG tool. Went further than the batch evidence: verified that the OG's exact failure pattern (a PRESENT AttendanceRecord with no matching points entry) is fully reproducible today via 'Clear a class's points' in DangerZone.tsx, which explicitly deletes PointEntry rows while keeping AttendanceRecord rows by design. So this is a real, currently-reachable data-integrity gap with zero admin tool to detect or fix it — raised from low to medium since it silently skews reports with no way for an admin to notice. F0844 in this batch covers the identical gap but wrongly concludes it can't happen; see that entry.
- **Fix:** Add a repair tool that finds AttendanceRecord rows with status=PRESENT and no linked pointEntry (which 'Clear a class's points' can produce) and either relinks/recreates the points or flags the mismatch for review, batched like the other repair tools.

### `F0041` [DEGRADED] Login still shows one fixed lockout string instead of a real countdown; no visible "Locked" badge — but admins already have a working, if unlabeled, unlock action (Reset PIN)
- **Role:** admin · **Area:** auth-login
- **OG:** index.stripped.html L2556-2579 — OG computes and displays a real countdown message; verified
- **Now:** lib/portal/login.ts (LoginResult keeps reason:'locked'/until), lib/auth.ts's portal authorize() (`if (!result.ok) return null` still discards it), app/portal/login/PortalLoginForm.tsx (always renders one hardcoded string); unlock action already at lib/portal/actions/admin.ts:105-119 resetServantPin(), exposed via components/portal/ServantForm.tsx:175-177 "Reset PIN" button
- **Verified:** This finding describes a DIFFERENT mechanism than the two already-applied fixes noted in my instructions (those touched lib/rate-limit.ts's in-memory burst limiter and admin.ts clearing it on PIN reset). Verified lib/auth.ts still discards the DB-level lockout reason/countdown today, so the finding is NOT already fixed. However, verified resetServantPin() already clears both the DB lock (failedAttempts:0, lockedUntil:null) and the in-memory limiter (clearRateLimit) and is already exposed as a "Reset PIN" button on every servant/admin edit page — so an admin already has a functioning unlock mechanism, just unlabeled and with no lock-state visibility.
- **Fix:** Propagate reason/until to the login UI for a real countdown; add a "Locked until…" badge to admin/servants (Reset PIN already serves as the unlock action).

### `F0050` [MISSING] No toast/confirmation system; sign-out and several other actions give no success feedback
- **Role:** admin · **Area:** auth-login
- **OG:** OG #notif toast (L1403), showNotif on sign-out (L2635) and elsewhere
- **Now:** nowhere
- **Verified:** Grepped toast|Toast|sonner|showNotif|flash across all of components/portal, app/portal, lib/portal -- zero hits. signOutPortal() just redirects with no flash message. Spot-checked other flows: several (SessionEditor, ImportPanel, DangerZone, AgendaEditor) do show inline Callout success/error banners near the action, partially covering the gap; but others (student delete-and-redirect, 'Mark as reviewed') give zero confirmation of any kind, and the clipboard-copy toast use case is moot since no copy-to-clipboard feature exists anymore. Core claim holds.
- **Fix:** As given: add a small toast/flash primitive and route it through existing ActionResult success paths, including a sign-out flash.

### `F0661` [DEGRADED] "Church Reports" nav link lands on the wrong default tab, not a different page
- **Role:** admin · **Area:** churchreports
- **OG:** adLoad('churchreports') branch, index.stripped.html L2812-2816 -> renderChurchReportsPage() L7320, default grid L7328-7345
- **Now:** app/portal/(app)/reports/page.tsx:75 — same page, defaults to the 'attendance' tab unless ?tab=church is in the URL; nav.ts points the sidebar link at plain /portal/reports
- **Verified:** Verified the tab logic and the nav.ts href exactly as claimed. This is the same page (not a different location the feature 'moved' to) with the wrong default tab selected — DEGRADED fits better than MOVED. Severity down from high: the 'Church reports' tab sits directly next to 'Attendance,' clearly labeled and one click away, so this is friction, not something the admin will fail to find.
- **Fix:** Point the sidebar's 'Church Reports' href at /portal/reports?tab=church for ADMIN/PASTOR so it lands on the church-wide grid immediately.

### `F0662` [MISSING] Per-class checkbox + Select All on Church Reports grid is gone
- **Role:** admin · **Area:** churchreports
- **OG:** OG renderChurchReportGrid() checkbox + toggleAllCrSelect()
- **Now:** app/portal/(app)/reports/page.tsx church tab ClassCard usage has no checkbox/onClick/href
- **Verified:** Confirmed via full read of reports/page.tsx lines 90-215 -- ClassCard has no selection mechanism at all.
- **Fix:** Add a selectable checkbox per ClassCard plus a Select All control, as given.

### `F0663` [MISSING] 'Print Selected' (prints only checked classes) is gone
- **Role:** admin · **Area:** churchreports
- **OG:** OG printChurchReports() -- actually at L7630-7695, not the cited L7591-7628 (which is the tail of openChurchReportClassModal/classStudentRowsHtml)
- **Now:** components/portal/PrintButton.tsx is a bare window.print() with no selection concept
- **Verified:** Found and read the real printChurchReports() function: reads .cr-check:checked, errors via showNotif if none checked. The finding's line citation is slightly off but the described behavior is accurate. Confirmed PrintButton.tsx has no selection mechanism.
- **Fix:** Restore a subset-print path once selection (F0662) exists, as given.

### `F0664` [DEGRADED] Church letterhead branding on the printed report is gone
- **Role:** admin · **Area:** churchreports
- **OG:** OG printChurchReports() -- actually L7630-7695 (same citation correction as F0663)
- **Now:** app/globals.css .portal-print-page rules are plain layout/pagination CSS only
- **Verified:** Read the real printChurchReports() in full: confirmed masthead text 'St. Kyrillos the Sixth' / 'COPTIC ORTHODOX CHURCH · ANTIOCH, TN' / period / print date, plus a Coptic-cross SVG footer, verbatim as the finding describes. Grepped 'letterhead' across app/portal, components/portal, app/globals.css -- zero hits; no masthead markup exists anywhere in the reports pages.
- **Fix:** Add a print-only masthead/footer block as given.

### `F0665` [DEGRADED] Click-to-open per-student modal (points sorted descending) is gone; class cards now show aggregate stats inline but not per-student numbers
- **Role:** admin · **Area:** churchreports
- **OG:** OG computeStudentMetric/sortStudentsByPoints/classStudentRowsHtml/openChurchReportClassModal, L7539-7589
- **Now:** reports/page.tsx church tab ClassCard has no href/onClick; per-student numbers require a separate page (students/attendance/leaderboard)
- **Verified:** Confirmed points-descending sort is real and specific to mode==='points' only (exams/attendance stay in roster order), matching the finding precisely. Confirmed new ClassCard has no click handler. Worth noting the new card already shows several class-level numbers inline (attendance %, quiz avg, points) without a click, which the OG required a click for -- so this is a narrower gap than it may first appear: what's missing is specifically the per-student list, not all drill-down.
- **Fix:** Wire ClassCard's href to a per-class detail route or add a modal, as given.

### `F0537` [MISSING] "Add Standard Grade Classes (Pre-K–12th)" bulk-create button is gone
- **Role:** admin · **Area:** classes
- **OG:** index.stripped.html L2959 (button), L3516 (addStandardGradeClasses, 14 grades, skips existing names)
- **Now:** nowhere — app/portal/(app)/admin/classes/ClassManager.tsx only has a single-class Create-class flow
- **Verified:** Verified OG function and button. Verified ClassManager.tsx and lib/portal/actions have no bulk/standard-grades action of any kind. Severity down from high: this is a once-a-year setup convenience with an easy, if tedious, one-class-at-a-time workaround.
- **Fix:** Add a 'Set up standard grade classes' bulk-create action to ClassManager, matching the OG's 14-grade list and existing-name skip logic.

### `F0542` [DEGRADED] Class card opens a real but much thinner per-class page, not just a moved workspace
- **Role:** admin · **Area:** classes
- **OG:** adOpenClassView() impersonation, index.stripped.html L2643-2656; full servant sidebar L3992-4045
- **Now:** app/portal/(app)/classes/[id]/page.tsx
- **Verified:** Verified adOpenClassView really does impersonate the class's servant and launch the entire one-class servant sidebar (Dashboard, QR, Follow-up, Reports, Lesson Prep, Exams, etc.). Read the new class page in full: it is a real page (not simply moved) offering a roster grid, 4 stat tiles, a Servants card, and correctly-scoped 'Take attendance' / 'Points' / 'Add student' links — but QR scan, Follow-up, Reports, Lesson Prep and Exams are not reachable pre-scoped from here at all. Severity down from high: the actual weekly task (taking attendance for this class) is preserved and one click away, which is the calibration's bar for 'blocker'; what's lost is convenience for less-frequent per-class tools.
- **Fix:** Add scoped links (QR scan, Follow-up, Reports, Lesson Prep, Exams filtered to this class) directly on /portal/classes/[id], or clearly document the new navigation model for admins used to the one-class workspace.

### `F0534` [MOVED] Collapsible '+ Add New Class' card moved off the main Classes list
- **Role:** admin · **Area:** classes
- **OG:** OG L2943-2960 (toggleAddCard('addcls-body',...))
- **Now:** app/portal/(app)/admin/classes/ClassManager.tsx, reached via 'Manage classes' link
- **Verified:** Confirmed /portal/classes/page.tsx links to /portal/admin/classes (line 23) and ClassManager.tsx (lines 88-105) has the actual add-class card there.
- **Fix:** Inline the add-class form on /portal/classes, or make Manage classes more prominent, as given.

### `F0540` [DEGRADED] Class deletion no longer cascades -- it now refuses to delete any class with history, by design, not by malfunction
- **Role:** admin · **Area:** classes
- **OG:** OG L3596-3625 (cascading delete with live progress log)
- **Now:** lib/portal/actions/admin.ts deleteClass() ~L178-206
- **Verified:** Confirmed deleteClass() explicitly refuses to delete a class with any students or any attendance/exam/point/follow-up history, with a clear error message directing the admin to hide it instead -- no cascade path exists at all, and this is confirmed to fail safely and predictably, not to malfunction. The finding's own fix text already acknowledges this is an intentional safety change. 'BROKEN' mischaracterizes working-as-designed, safe-failure behavior -- correcting the state label to DEGRADED (capability intentionally replaced). Severity stays medium: an admin retiring an old class with real history faces genuine friction (must hide instead of delete).
- **Fix:** Confirm with the user whether to keep 'refuse + hide instead' (recommended, safer) or restore a guarded cascade with typed confirmation + progress log.

### `F0541` [DEGRADED] Class card servant summary lost its click-to-expand name list and title badges
- **Role:** admin · **Area:** classes
- **OG:** OG L2965-2992 (toggleClassSvList())
- **Now:** ClassManager.tsx ClassCard rows (~L150)
- **Verified:** Confirmed OG shows initials+name+title-pill on expand; new ClassCard only shows a count string ('N servants'/'Not assigned'), no expand, no names, no badges.
- **Fix:** Add an expandable servant-name list with title badges, as given.

### `F0543` [MISSING] 'Class Profile' digest (monthly stats, most-active student, reading drop-off alerts, activity feed) has no equivalent
- **Role:** admin · **Area:** classes
- **OG:** OG L4815-4870+ (Monthly Digest, Most Active Student, Reading Check-in drop-offs)
- **Now:** nowhere in app/portal/(app)/classes/[id]/page.tsx
- **Verified:** Read the new class page in full (184 lines): has current-state StatCards and roster/servants lists, but grepped Monthly|Most Active|dropoff|Recent Activity|digest -- zero hits. None of the digest content exists. The reading-drop-off piece has real pastoral-care value (flags students who stopped doing devotionals) beyond pure polish, so medium is warranted, not low.
- **Fix:** Port the digest content onto /portal/classes/[id], as given.

### `F0544` [MOVED] 'Print QR Codes' button moved out of the class workspace header
- **Role:** admin · **Area:** classes
- **OG:** OG L4830 (calibration case)
- **Now:** /portal/qr/cards
- **Verified:** Confirmed /portal/qr/cards exists and functions; confirmed classes/[id]/page.tsx header actions have only Take attendance/Points/Add student, no QR-print link.
- **Fix:** Add a 'Print QR Codes' link on the class page pointing to /portal/qr/cards, as given.

### `F0545` [MOVED] 'Print Report' button moved out of the class workspace header
- **Role:** admin · **Area:** classes
- **OG:** OG L4831 (calibration case)
- **Now:** /portal/reports/cards
- **Verified:** Confirmed /portal/reports/cards exists; same header check as F0544 shows no report-print link on the class page.
- **Fix:** Add a 'Print Report' link on the class page pointing to /portal/reports/cards, as given.

### `F0311` [DEGRADED] Past events are collapsed behind a closed <details> accordion and capped at 25, on the same page (not moved elsewhere)
- **Role:** admin · **Area:** events
- **OG:** OG L15082-15085 (one continuous list: today, future, past-reversed)
- **Now:** /portal/events -- same page, past events inside a closed <details> with a take:25 query cap (lib/portal/data/community.ts ~L160)
- **Verified:** Confirmed OG renders one continuous list with no collapse. Confirmed new events/page.tsx (lines 190-233) wraps past events in <details> with no open attribute (collapsed by default), and the query caps at 25. This is the same route/component, not a relocation to a different place -- 'MOVED' is the wrong state label; correcting to DEGRADED (present but altered in place).
- **Fix:** Render past events open by default and raise/paginate the take:25 cap, as given.

### `F0022` [DEGRADED] Exams list lost its always-visible "Select All" and bulk toolbar
- **Role:** admin · **Area:** exams
- **OG:** index.stripped.html L5193-5200 (toolbar built whenever exams.length, disabled-but-visible bulk buttons at 40% opacity), L11255-11258 (toggleAllExamSelect)
- **Now:** app/portal/(app)/exams/ExamsFilter.tsx:76 (Callout only renders once selected.size > 0); per-item checkboxes exist on every ExamCard at all times
- **Verified:** Verified the OG toolbar and the new gating exactly as claimed (grep for select-all-style terms only hits an unrelated PointsPanel.tsx:193). Also noted for context: OG's bulk 'Reopen Selected' has no equivalent at all in the new portal (only bulk Delete exists) — a related but separate gap. Severity down from high: exam cleanup is periodic admin housekeeping, not a weekly task, and individual per-exam checkboxes already work.
- **Fix:** Render the toolbar whenever rows.length > 0 with a Select-All checkbox and always-visible (disabled-until-selected) bulk buttons, matching the OG's 0.4-opacity treatment.

### `F0028` [DEGRADED] Exams CSV import commits immediately with no preview/confirm step
- **Role:** admin · **Area:** exams
- **OG:** OG L16381-16402 (preview + 'Ready to import' status card), L16511-16603 (csvImport with progress)
- **Now:** /portal/exams/import ExamImport.tsx -- commits on first submit
- **Verified:** Read ExamImport.tsx in full: readFile() only stores raw text, run() calls importExamsCsv directly and the result report only appears after the commit -- confirmed no dry-run/preview path exists. Considered upgrading to high by analogy with F0594, but exam import only ever creates new quizzes (never overwrites existing ones), so a bad file's blast radius is 'some wrong quizzes get created' -- easy to spot and delete, not a silent overwrite of prior work. Medium remains correct.
- **Fix:** Split into a dry-run parse (preview) and a separate commit step, as given.

### `F0274` [DEGRADED] Admin's Announcements page mixes church-wide, stage and class notices with no scope filter
- **Role:** admin · **Area:** feed-posts
- **OG:** index.stripped.html L3388-3391 (if(!d.data().classId) guard is the entire page), L3394 (title/subtitle)
- **Now:** app/portal/(app)/announcements/page.tsx + lib/portal/data/community.ts:265-273
- **Verified:** Verified the OG guard exactly. Verified listAnnouncements: scope.seesEverything ? {} : {...} returns every announcement (church/stage/class) with no scope param on the page, and canChurchWide only gates who may create church-wide, never what is shown. Confirmed exactly as claimed. Severity down from high: each row carries a clear Badge (Church-wide / stage / class name) so the admin can still tell them apart while scrolling — this is added noise, not lost information.
- **Fix:** Add a scope filter (?scope=church|stage|class chips) defaulting to church-wide for admins/pastors, or restore a separate church-wide-only view titled 'Church Announcements.'

### `F0278` [MOVED] Class Profile page has no link to that class's Posts or Announcements
- **Role:** admin · **Area:** feed-posts
- **OG:** OG L13532-13536 (classId-scoped feed, no picker needed), L4026/L11604 (one-click sidebar access)
- **Now:** /portal/feed (global page, defaults to classes[0], ClassPicker shown only when >1 class)
- **Verified:** Confirmed OG feed was hard-scoped to the servant's own classId with a one-click sidebar entry. Confirmed new feed/page.tsx defaults to classes[0] and shows a picker only conditionally; confirmed classes/[id]/page.tsx header has no link to /portal/feed or /portal/announcements. Real loss of a one-click, contextual entry point, especially for admins who serve no class of their own.
- **Fix:** Add 'Class posts' and 'Announcements' buttons to the Class Profile header, as given.

### `F0581` [MOVED] Deleting a mistaken servant-attendance mark moved to cycling the cell to blank on the Servants Attendance grid, not gone
- **Role:** admin · **Area:** myattendance
- **OG:** canDelete = _me.role==='admin' && ex.status, index.stripped.html L6957/L6961; handler L6982-L6999
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx (cycle a cell back to blank, then Save) — lib/portal/actions/servant-attendance.ts:64-71 deletes the row on a 'CLEAR' mark
- **Verified:** Confirmed My Attendance (app/portal/(app)/my-attendance/page.tsx) is fully read-only with no delete anywhere, and there is no dedicated delete function in servant-attendance.ts — the finding is right about that page specifically. But saveServantWeek's MarkSchema accepts a 'CLEAR' status that ServantGrid.tsx:64 sends when a cell is cycled back to blank, and that deleteMany's the ServantAttendance row outright. For ADMIN, writableIds on /portal/servant-attendance is every servant in scope (page.tsx:93-96), and loadServantScope returns literally every active servant for a church-wide role with no class filter — including the admin's own linked Servant row, if any. So the capability survived, just moved to a different page with no explicit delete affordance or confirmation dialog. Severity down from high given the capability exists; kept above low for the discoverability and missing-confirmation gap.
- **Fix:** Add an explicit delete/undo control (with confirmation) directly on My Attendance for an admin's own marks, or at minimum label the 'cycle to blank' behaviour on ServantGrid as a delete so it isn't accidental.

### `F0579` [MOVED] The per-activity self-mark write UI exists — at /portal/servant-attendance (tap-to-cycle grid), not /portal/my-attendance, and only for accounts with a Servant profile
- **Role:** admin · **Area:** myattendance
- **OG:** index.stripped.html L6939-6968 — three-button (Attended/Excused/Absent) card per Fri/Sat/Sun activity; verified
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx — click-to-cycle status button per servant×activity cell, gated by writableIds including the caller's own id, wired to saveServantWeek()
- **Verified:** Confirmed my-attendance/page.tsx is fully read-only as the finding states. But searching beyond that one file (different route than the finding's own evidence), /portal/servant-attendance's ServantGrid.tsx is a real, working self-mark write UI — same underlying capability (mark one of 3 statuses per weekly activity, self-writable), just a cycle-button instead of 3 explicit labeled buttons, and under the "Servants Attendance" nav item rather than "My Attendance." See F0583 for the real remaining gap (accounts with no Servant row can't appear in this grid at all).
- **Fix:** Either restyle the cycle-button as 3 explicit buttons for closer OG parity, or accept the redesign as-is; prioritize fixing F0583 instead.

### `F0151` [MOVED] Admin "Settings" split into five destinations with no unifying label
- **Role:** admin · **Area:** nav-ia
- **OG:** index.stripped.html L2721 (single sidebar item), page subtitle 'Data tools and maintenance utilities' L2817-2828
- **Now:** nav.ts: /portal/admin/classes, /portal/admin/sessions, /portal/admin/data, /portal/admin/audit under 'Administration', plus /portal/settings relabelled 'My PIN'
- **Verified:** Verified the OG single sidebar item and its page subtitle, consistent with the four things it split into. Verified nav.ts exactly as claimed. Confirmed accurate. Severity down from high: nothing is functionally lost, each destination is clearly labeled and grouped under one section header — this is a re-training issue for admins used to one word, not a capability gap.
- **Fix:** Either add a 'Settings' landing page at /portal/admin/settings linking to the four sub-pages, or rename the 'Administration' section header to 'Settings.'

### `F0529` [MISSING] "Average Scores by Class" chart is gone from the dashboard (data survives elsewhere, just not charted)
- **Role:** admin · **Area:** overview
- **OG:** index.stripped.html L2764-2797 (built), L1975-2003 (renderChurchWideCharts, Chart.js bar, >=2 classes gate)
- **Now:** nowhere on the dashboard — no chart library in package.json, no canvas/chart anywhere in the portal
- **Verified:** Verified the OG chart and its gating logic. Confirmed no chart dependency and no chart rendering anywhere. However, the underlying comparison is not entirely gone: /portal/reports?tab=church shows a 'Quiz average' badge on every class's card (reports/page.tsx:200-208) — a table/badge substitute exists, just one click away and not a chart, and not on the dashboard landing page. Severity down from high given the data is still reachable, just not visualized or on the home screen.
- **Fix:** Add a Chart.js (or equivalent) bar chart of average quiz score per class to the admin dashboard, gated the same way (>=2 classes with data), or at minimum surface the same 'Quiz average' comparison already computed for Church Reports directly on the dashboard.

### `F0175` [MISSING] Permanently deleting a points entry does not exist; only a visible offsetting "undo" does
- **Role:** admin · **Area:** points
- **OG:** deletePointFB(), index.stripped.html L9911-9966 (hard-deletes the points doc and its paired attendance record), button at L5137
- **Now:** lib/portal/actions/points.ts — only givePoints / undoPoints / createActivity / removeActivity exist
- **Verified:** Verified the OG hard-delete. Verified undoPoints (points.ts:69-99) marks the entry undone:true and adds an offsetting negative entry rather than removing it — the mistake stays visible forever as two extra ledger rows. Confirmed no hard-delete path anywhere. Severity down from high: undoPoints already fully corrects the total (net-zero effect on standings/leaderboard), so this is a ledger-cleanliness issue for admins clearing out visibly bogus rows, not a correctness or blocking issue.
- **Fix:** Add deletePointEntry(entryId) to lib/portal/actions/points.ts — admin-only, audited, refusing rows that are an undoOf target or linked to an AttendanceRecord — surfaced as a red X on the student profile ledger only, matching the OG's placement.

### `F0184` [MISSING] Admin "Reset Activities to Standard 6" (across every class at once) is gone
- **Role:** admin · **Area:** points
- **OG:** index.stripped.html L2910-2913 (Danger Zone row/button), L18087-18107 (resetActivitiesToStandard5, all-classes batch delete)
- **Now:** app/portal/(app)/admin/data/DangerZone.tsx lines 131-168 / lib/portal/actions/data-tools.ts:1019 resetClassActivities
- **Verified:** Confirmed DangerZone.tsx only offers a per-class 'Reset a class's point activities' op with a class <select>; grep for an all-classes variant in data-tools.ts finds none.
- **Fix:** Add a fourth Danger Zone op that resets every class's activities to the standard six in one confirm-phrase action, as proposed.

### `F0003` [MISSING] The "Past Meetings" history of servant meetings (month-grouped, attendee chips) is gone
- **Role:** admin · **Area:** qr
- **OG:** index.stripped.html L7067-7096 (groups servant_attendance by activity+week, ANY check-in method), L7100-7183 (month grouping/cards), L7216-7220 ('Past Meetings' heading + 'N held')
- **Now:** nowhere as a browsable history — app/portal/(app)/servant-attendance/report/page.tsx only shows aggregate x/y rates per servant per activity over a date range, with no meeting-by-meeting drill-down
- **Verified:** Verified the OG grouping and card structure. Confirmed grep -rniF 'Past Meetings' returns nothing anywhere. Read the servant-attendance report page in full: it's an aggregate rate table, not a list of individual meetings with attendee names. The closest partial substitute is the main ServantGrid at /portal/servant-attendance, which shows every servant's status for one specific week if you navigate there manually — not a scrollable history. Severity down from high: this is an after-the-fact oversight/review tool, not a weekly-task blocker, and the raw data is technically reachable, just inconveniently.
- **Fix:** Add a 'Meetings' tab/section to /portal/servant-attendance that groups ServantAttendance rows by (activityKey, weekStart) into month sections, each card showing the date, an 'N attended' pill and expandable attendee chips.

### `F0008` [MISSING] Meeting code lost its "Meeting Title" field — every servants meeting is titled with the activity label
- **Role:** admin · **Area:** qr
- **OG:** index.stripped.html:7196 (mt-title input), 14371/14388/14400 (title read/stored/displayed)
- **Now:** lib/portal/actions/qr.ts:207-238 MeetingSchema/createMeetingCode; app/portal/(app)/qr/GroupCodePanel.tsx MEETING branch
- **Verified:** Confirmed MeetingSchema = {activityKey, weekStart} with no title field, and line 232 hard-sets title: activity.label. GroupCodePanel's MEETING branch has no title input.
- **Fix:** Add optional title to MeetingSchema and a matching text input in GroupCodePanel's MEETING branch, as proposed.

### `F0012` [DEGRADED] Sharing a student's ID and PIN lost its Gmail and Copy buttons
- **Role:** admin · **Area:** qr
- **OG:** index.stripped.html:3699-3752 (credentials modal, Gmail deep link, copy-to-clipboard)
- **Now:** app/portal/(app)/students/[id]/StudentProfileActions.tsx lines 19-24
- **Verified:** Confirmed the PIN-reset panel shows the new PIN once with no share affordance. Broad re-search (clipboard|mailto:|gmail|copy.*pin|copy.*id) across the whole portal tree found zero credential-sharing code anywhere.
- **Fix:** Add Email/Copy buttons to the post-reset panel, porting the OG's email body builder and Gmail deep link, as proposed.

### `F0014` [MISSING] No one-click "Delete this meeting" — clearing a wrongly-taken meeting is a manual cell-by-cell job
- **Role:** admin · **Area:** qr
- **OG:** index.stripped.html:7153 (trash button), 7299-7318 (deleteMeetingToken)
- **Now:** lib/portal/actions/servant-attendance.ts (only per-cell clearing via saveServantWeek, no activityKey+weekStart bulk delete)
- **Verified:** Confirmed via grep for deleteMeeting/clearServantMeeting/deleteMany.*activityKey across all portal actions — none exist. F0607 in this same batch reports the identical gap under a different area tag.
- **Fix:** Add a clearServantMeeting({activityKey, weekStart}) action doing a scoped deleteMany, as proposed.

### `F0288` [BROKEN] The per-activity "Reason / note…" field is fully wired in the schema and read path but has no write UI anywhere
- **Role:** admin · **Area:** servant-attendance
- **OG:** index.stripped.html L6967 (input), L6926-6941 (prefill), L7036-7037 (read back on save), L7979-7984 (stored)
- **Now:** lib/portal/data/servant-attendance.ts:105,116,127 selects/returns reason; ServantGrid.tsx never renders or sends it; saveServantWeek (servant-attendance.ts:77-80) hard-codes reason to null except for EXCUSED; markMyServantAttendance never accepts one at all
- **Verified:** Verified the OG input and save/read cycle. Confirmed the new DB column and read path fully support 'reason' but ServantGrid.tsx (the only write UI for another servant's mark) has zero references to it, and the self-check-in path never accepts one either — a fully dead, half-wired feature. Confirmed exactly as described. Severity down from high: this affects pastoral follow-up context, which matters, but is not a weekly-task blocker and no existing data is corrupted, only unrecorded going forward.
- **Fix:** Add a compact note input per marked cell in ServantGrid.tsx, carry 'reason' through the marks prop and save payload, and change servant-attendance.ts:77 to persist the reason for any status (reason: mark.reason?.trim() || null), not only EXCUSED.

### `F0293` [MISSING] Clicking a servant's avatar or name in the grid no longer opens their profile
- **Role:** admin · **Area:** servant-attendance
- **OG:** OG L7899 (admin-gated onclick=adOpenServantProfile), function at L2659
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx lines 133-147
- **Verified:** Confirmed: the servant cell is a plain Avatar+<p> with no Link/onClick, and the file imports no Link at all. The destination page /portal/admin/servants/[id] exists but nothing in the grid links to it. F0601 in this same batch reports the identical gap.
- **Fix:** Wrap the avatar+name block in a Link to /portal/admin/servants/[id] for admins, as proposed.

### `F0295` [DEGRADED] Weekly Report month chips (school-year order) replaced by "Last N weeks," with no way to open a named month beyond ~6 months back
- **Role:** admin · **Area:** servant-attendance
- **OG:** OG L8033-8037 (saReportSetMonth), L8052-8059 (school-year chip loop), L8125-8142
- **Now:** app/portal/(app)/servant-attendance/report/page.tsx lines 13, 56-71
- **Verified:** Confirmed RANGES = [4,8,13,26] weeks only, validated against that fixed set (line 35) with no month-of-school-year control. Anything beyond 26 weeks back is unreachable in the UI without hand-editing the from/to URL params. F0602 in this same batch reports the identical gap.
- **Fix:** Add the twelve school-year month chips, each linking to a from/to range for that month, as proposed.

### `F0296` [MOVED] The Servants Meeting QR generator moved off the Servant Attendance page into the QR Check-in hub, with no cross-link
- **Role:** admin · **Area:** servant-attendance
- **OG:** OG L7820/7838 (QR Check-in tab on Servant Attendance page), L14363-14449 (generator)
- **Now:** app/portal/(app)/qr/GroupCodePanel.tsx, 'Meeting' segment of the Group Code tab
- **Verified:** Confirmed servant-attendance/page.tsx has exactly one LinkButton (to the report) and no QR mention; qr/page.tsx only accepts a tab param (group/scan), and GroupCodePanel has no mode param support to preselect Meeting, so the finding's own suggested deep-link doesn't exist yet either.
- **Fix:** Add a 'Meeting QR' link on /portal/servant-attendance to /portal/qr?tab=group&mode=meeting, and make GroupCodePanel honor a mode param, as proposed.

### `F0850` [MOVED] Change a user's role: reachable and working for staff-to-staff changes (net improvement over OG's dead modal), but no student↔staff conversion exists
- **Role:** admin · **Area:** servant/all-students context — Change Role modal (never wired to a button)
- **OG:** OG L18416-18432/18442-18459/19194-19215 (openChangeRoleModal — confirmed dead code, never called by any button in the 19,999-line file)
- **Now:** components/portal/ServantForm.tsx role select, backed by updateServant() in lib/portal/actions/admin.ts:78-104
- **Verified:** Confirmed updateServant() (line 84) explicitly rejects any account whose existing.role === 'STUDENT', and lib/portal/actions/students.ts has no promotion/conversion action. Staff-to-staff role change now genuinely works (an improvement, since the OG modal was unreachable); student↔staff conversion still requires delete+recreate.
- **Fix:** Add a 'Convert to servant' action from the student profile page to cover the one real remaining gap, as proposed.

### `F0599` [MISSING] "Select All (Attended)" button
- **Role:** admin · **Area:** servantattendanceall
- **OG:** OG L7858
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx
- **Verified:** Confirmed via full read of ServantGrid.tsx — no column-header bulk-action controls exist, only per-cell click-to-cycle.
- **Fix:** Add a per-activity-column 'mark all attended' control, as proposed.

### `F0600` [MISSING] "Clear Selection" button
- **Role:** admin · **Area:** servantattendanceall
- **OG:** OG L7859
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx
- **Verified:** Same file, same read as F0599 — no clear-column control exists.
- **Fix:** Add a per-activity-column 'clear' control, as proposed.

### `F0603` [DEGRADED] Weekly Report per-week per-activity ✓/E/✗ grid cell replaced by an aggregated ratio only
- **Role:** admin · **Area:** servantattendanceall
- **OG:** OG L8081-L8110 (byServantWeekAct matrix)
- **Now:** app/portal/(app)/servant-attendance/report/page.tsx lines 104-197
- **Verified:** Confirmed: 'By activity' shows an aggregate rate only, and the 'By servant' table shows one attended/held ratio per activity across the whole range — no per-week drill-down anywhere on the page.
- **Fix:** Add a per-week matrix view, or let a ratio cell expand to the weeks behind it, as proposed.

### `F0597` [MOVED] The OG's single-page 3-tab mental model is gone, but both destinations are independently reachable top-level nav items
- **Role:** admin · **Area:** servantattendanceall
- **OG:** Servant Attendance tabs, OG L7818-7820, switchSabMode() L7959-7962
- **Now:** /portal/servant-attendance (Take Attendance, links to /portal/servant-attendance/report for Weekly Report); QR Check-in for servants is the 'Meeting' segmented option inside GroupCodePanel.tsx on /portal/qr, itself a top-level sidebar item under 'Attendance' in lib/portal/nav.ts
- **Verified:** Verified: servant-attendance page links to the report page (real cross-link, works). Verified GroupCodePanel.tsx has an ATTENDANCE/POINTS/MEETING segmented control; MEETING calls createMeetingCode({activityKey}) — this is the servant QR check-in. Confirmed no link from servant-attendance to /portal/qr (grep returned nothing). But /portal/qr is its own top-level sidebar entry, exactly as prominent as 'Servants Attendance' — not 'unrelated' or buried. Also the suggested fix (/portal/qr?tab=group) is imprecise: 'Meeting' mode is client-only state inside GroupCodePanel with no URL param to preselect it; tab only toggles group-code vs scan-students.
- **Fix:** Add a small link from /portal/servant-attendance to /portal/qr (and add a mode= query param support in GroupCodePanel so it can deep-link straight into Meeting mode) to restore the cross-reference, rather than restoring three literal tabs.

### `F0605` [DEGRADED] Chronological "Past Meetings" card view is gone, but the same data is browsable via the main Servant Attendance week grid; the Manual/QR source badge is unrecoverable (not stored in schema at all)
- **Role:** admin · **Area:** servantattendanceall
- **OG:** Past Meetings cards, OG L7075-7222
- **Now:** /portal/servant-attendance — step the week picker back to any past week to see every servant × activity as a colored grid for that exact week
- **Verified:** Confirmed no 'Past Meeting' view exists anywhere (grep matches finding). But app/portal/(app)/servant-attendance/ServantGrid.tsx + the week-stepper on the page give the same underlying info (who attended a specific activity in a specific past week), just as a matrix instead of chronological cards. Deeper and unaddressed by the finding: prisma/schema.prisma's ServantAttendance model (L461-475) has no 'source' field at all, so the Manual/QR/Manual+QR badge can never be reconstructed without a migration — a structural, not just UI, gap.
- **Fix:** If a chronological view is wanted, build it by grouping existing ServantAttendance rows by weekStart+activityKey on top of the current data (no migration needed). To recover the Manual/QR badge, add a `source` enum column to ServantAttendance and set it at write time (grid edits = MANUAL, QR redemption = QR).

### `F0606` [DEGRADED] "Edit Who Attended" as a dedicated modal is gone, but the same correction is fully possible from the main Servant Attendance grid for any past week
- **Role:** admin · **Area:** servantattendanceall
- **OG:** openEditMeetingAttendeesModal()/saveMeetingAttendeesEdit(), OG L7224-7298
- **Now:** /portal/servant-attendance — click any servant's cell for the relevant activity, on the relevant past week
- **Verified:** Verified lib/portal/actions/servant-attendance.ts::saveServantWeek has no date-range restriction — an admin can navigate to any past week via the week stepper and toggle PRESENT/EXCUSED/ABSENT/clear per servant per activity, which is functionally identical to the OG's checklist (same underlying create/delete of a servant+activity+week attendance record). Real friction (must know/step to the right week; no direct link from a specific past QR session) but not impossible.
- **Fix:** Optional convenience: from the live QR 'Meeting' scan screen, after the code ends, link straight to /portal/servant-attendance?week=<that week> so an admin lands on the right week without stepping through the picker.

### `F0546` [MISSING] Header button "Template" (download servant CSV template + example row)
- **Role:** admin · **Area:** servants
- **OG:** OG L3011 (button), def at L10795
- **Now:** app/portal/(app)/admin/data/ImportPanel.tsx
- **Verified:** Confirmed via full read of ImportPanel.tsx (225 lines): only Export/Choose-CSV/Import controls exist, no template download of any kind.
- **Fix:** Add a 'Download template' link to the Import & export panel, as proposed.

### `F0547` [DEGRADED] CSV import commits immediately with no pre-commit preview/review step (a removed safety step, not a relocated one)
- **Role:** admin · **Area:** servants
- **OG:** OG L3012-3013 (button), previewServantsCSV def at L10803
- **Now:** app/portal/(app)/admin/data/ImportPanel.tsx runImport(), lines 78-94
- **Verified:** Confirmed runImport() calls importStudentsCsv/importServantsCsv and commits immediately; the results table (lines 172-221) only appears after the write. Recasting from MOVED to DEGRADED: there's no equivalent preview screen anywhere else in the app to point to — the capability (review before write) was removed, not relocated.
- **Fix:** Add a preview step (parsed rows + validation errors) before committing, or clearly warn that import is immediate, as proposed.

### `F0549` [MISSING] Header button "Print Roster"
- **Role:** admin · **Area:** servants
- **OG:** OG L3015 (button), def at L7704
- **Now:** nowhere
- **Verified:** Confirmed via grep for 'roster|Roster' across app/portal, lib/portal, components/portal, plus a second independent pass for print/window.print scoped to the servants admin page — no print-roster feature anywhere. A generic PrintButton.tsx component exists but is never used on admin/servants/page.tsx.
- **Fix:** Add a printable servant roster page/button, as proposed.

### `F0670` [MISSING] Delete an "extra" attendance session (permanent removal)
- **Role:** admin · **Area:** settings
- **OG:** OG delete button L2861, deleteExtraSession() L18135-18153
- **Now:** app/portal/(app)/admin/sessions/SessionEditor.tsx
- **Verified:** Confirmed SessionEditor.tsx only has an Active/Hidden checkbox toggle; `grep "^export async function" lib/portal/actions/admin.ts` lists saveSession but no deleteSession anywhere.
- **Fix:** Add a delete action for non-standard AttendanceSession rows, as proposed.

### `F0667` [MOVED] The OG's single "Settings" hub is split across My PIN (Account section) and Data & Backup / Sessions & Points (Administration section) — real, but the Administration section already groups the admin-facing ones
- **Role:** admin · **Area:** settings
- **OG:** adLoad settings branch, OG L2817-2937 (Backup, Data Repair Tools, Attendance Sessions, Account & Login, Danger Zone all on one page)
- **Now:** lib/portal/nav.ts — /portal/settings ('My PIN') under section 'Account'; /portal/admin/data ('Data & Backup') and /portal/admin/sessions ('Sessions & Points') under section 'Administration' alongside Reports/Manage Classes/Activity Log
- **Verified:** Confirmed the 3-way split directly in lib/portal/nav.ts. However, the finding's evidence citing 'the task's own calibration example (avatar dropdown's Settings link...)' does not check out — grepped components/portal/Shell.tsx for dropdown/Avatar/avatar/My PIN and found zero matches; there is no avatar dropdown in this codebase. That specific evidence line appears fabricated and should be dropped, though it doesn't change the core (independently-verified) claim. The sidebar's 'Administration' section header already functions as an implicit hub for the admin-facing settings; only 'My PIN' sits apart from it.
- **Fix:** Either move 'My PIN' into the Administration section too, or add a lightweight '/portal/admin' landing page that links Data & Backup, Sessions & Points, and My PIN together for anyone who remembers 'Settings' as one place.

### `F0062` [MOVED] "Add Student to Any Class" from the All Students page is gone — the class must be picked first, by opening that class
- **Role:** admin · **Area:** students
- **OG:** Collapsible card + inline class select, OG L3332-3357
- **Now:** /portal/classes → open a class → "Add student" → /portal/classes/<id>/students/new (components/portal/StudentForm.tsx)
- **Verified:** Confirmed admin/students/page.tsx has no add control (already read in full for F0058). Confirmed createStudent(classId!, form) takes classId fixed from the route and StudentForm has exactly one <select> (Gender) — no class field. Confirmed the finding's core claim. This is a real change in order-of-operations but not a blocker: 'Classes → pick class → Add student' is a clearly-labeled, intuitive 2-3 click path with no data loss and no possibility left unreachable.
- **Fix:** Optional convenience: add an 'Add student' action to the All Students PageHeader that opens the same StudentForm with an added class <select>, posting to a createStudent variant that takes the class from the form rather than the route.

### `F0223` [MISSING] The "Blank Template" CSV download is gone — there is no way to get an empty year to fill in offline
- **Role:** all · **Area:** agenda
- **OG:** Lesson Preparation → Weekly Assignment View, gold-outlined "Blank Template" pill button next to Export Schedule; downloadAgendaBlankTemplate() at OG L8735-8740, confirmed verbatim
- **Now:** app/portal/(app)/agenda/AgendaTools.tsx — offers only Export CSV / Import CSV / Share; no blank-template option anywhere
- **Verified:** Read the OG function (builds a CSV of every school-year week with empty content columns) and the full AgendaTools.tsx component plus a repo-wide grep for "blank" — no agenda blank-template feature exists anywhere in the new portal. Genuinely missing.
- **Fix:** Add a "Blank template" DownloadButton beside Export CSV in AgendaTools.tsx that emits the school-year week list with empty topic/servant/slide/notes columns, once a getSchoolYearWeeksList equivalent is ported.

### `F0204` [DEGRADED] In the month grid a held session a student has no row for shows as an empty box, not the OG's red ✗
- **Role:** all · **Area:** attendance
- **OG:** OG month grid / print sheets, cellStatus at L8971-8981 — confirmed: a date is "notheld" only if ZERO docs exist class-wide for that activity+date; otherwise any student missing a row resolves to 'absent'
- **Now:** lib/portal/reports.ts buildMonthMatrix (marks[i]=null for missing rows) rendered by app/portal/(app)/reports/AttendanceMatrix.tsx:84-91 as an empty box titled 'Not marked'
- **Verified:** Confirmed the mechanism end-to-end, including the real trigger: lib/portal/actions/qr.ts:394-410 writes a PRESENT row only for QR scanners, so non-scanners get no row on a QR Sunday and print as blank boxes even though the numeric totals (held/absent) already count them as absent internally.
- **Fix:** As given: in buildMonthMatrix, resolve a missing cell to ABSENT for any date already known to be held for that class+session, keeping null only for genuinely un-held dates.

### `F0049` [DEGRADED] The global busy indicator is gone — most routes show nothing at all while loading and no write shows a full-screen busy state
- **Role:** all · **Area:** auth-login
- **OG:** OG #loader overlay (gold Coptic cross + 'Loading...'), L1385-1402; showLoader/hideLoader L2326/2378; used on ~40 paths incl. login L2588/2596 — confirmed verbatim
- **Now:** app/portal/(app)/**/loading.tsx (only 10 of 53 route page.tsx files have one); components/portal/SubmitButton.tsx (button-local pending state only)
- **Verified:** Confirmed via `find app/portal -name loading.tsx` (10 hits) vs 53 page.tsx files, and a repo-wide grep for any global overlay/NProgress pattern (none found). F0166 in this same batch describes the identical gap from a slightly different angle — see F0166's verdict, marked DUPLICATE of this one.
- **Fix:** Add app/portal/(app)/loading.tsx built from PageSkeleton for a baseline fallback on every route, and a shared busy overlay (or consistent SubmitButton pending state) for server-action writes.

### `F0241` [BROKEN] Topbar 'Birthdays this week' card lost its click affordance (no onClick, no hover/cursor styling) — but Birthdays is still one ordinary sidebar click away for every role
- **Role:** all · **Area:** birthdays
- **OG:** index.stripped.html: student L1543, servant ~L1590, admin ~L1640, pastor L19141 — confirmed all four role shells wrap `.atb-meeting-card` in onclick="<role>Load('schedule', <sidebar item>)" style="cursor:pointer", navigating AND lighting up the matching sidebar item
- **Now:** components/portal/BirthdayChip.tsx — confirmed a plain <span>, zero interactive attributes (no onClick, no Link, no cursor-pointer/hover class); rendered only in the desktop topbar via app/portal/(app)/layout.tsx:32 (hidden below lg breakpoint). /portal/birthdays exists and IS a permanent top-level sidebar nav item for every role (lib/portal/nav.ts).
- **Verified:** Core claim (chip is non-interactive; OG was clickable) confirmed true. But the claim that there is 'now no path from the chip to anything' is misleading — /portal/birthdays is a real, always-visible, clearly-labeled sidebar item for every role, arguably more discoverable than the OG's chip-only path. The real regression is narrower: a lost shortcut plus a visual design that no longer signals clickability at all (no hover/cursor styling), which could produce a moment of confusion for someone who clicks expecting navigation, but does not hide or lose the feature. This is friction, not a discoverability failure — downgraded to medium.
- **Fix:** Wrap BirthdayChip's contents in <Link href="/portal/birthdays"> and add hover/focus-visible styling so it reads as interactive again. No extra work needed to sync the sidebar highlight since Shell.tsx already derives isActive from pathname.

### `F0087` [MISSING] The dashboard has no loading skeleton — it is the one heavy page in the portal without a loading.tsx
- **Role:** all · **Area:** dashboard
- **OG:** Shaped skeletons per role, e.g. servant dashboard OG L4152-4159 (header + 4 stat boxes + 6-tile quick-actions + 4-card widgets grid) — confirmed present
- **Now:** No app/portal/(app)/loading.tsx exists to cover app/portal/(app)/page.tsx; components/portal/PageSkeleton.tsx exists and is used by 10 other routes but not the dashboard
- **Verified:** Confirmed no loading.tsx at the (app) root or covering the dashboard route specifically, while the PageSkeleton primitive it would need already exists and is used elsewhere.
- **Fix:** Add app/portal/(app)/loading.tsx composed from PageSkeleton primitives: hero block, 4-up stat row, quick-actions row, two-column widget grid.

### `F0088` [DEGRADED] Mobile identity bar is no longer an identity bar — it shows church branding instead of who you are, and the tap-to-profile target is gone
- **Role:** all · **Area:** dashboard
- **OG:** OG .mobile-id-bar (L328-335 chrome) + populateMobileIdBar (L1734-1748): photo-or-initials avatar, full name, role sub-line, whole card is onclick to the user's profile — confirmed
- **Now:** components/portal/Shell.tsx:220-238 — the md:hidden top bar has identical chrome (sticky, gold border, rounded) but its content is the church logo, name, and academic year; no onClick/Link anywhere on it
- **Verified:** Read the full mobile-bar JSX block in Shell.tsx: only the separate hamburger button is interactive; the identity content is entirely absent. Matches the finding exactly.
- **Fix:** Replace the mobile bar's content with the user's initials-or-photo avatar, display name, and a role-aware sub-line, and make that portion a Link to the account page; move church branding to the slide-out crest or a second line.

### `F0145` [DEGRADED] Mobile nav is a hamburger + full-screen overlay instead of a persistent bottom tab bar — more taps per switch, but every destination is still reachable
- **Role:** all · **Area:** nav-ia
- **OG:** index.stripped.html L19934-19970 (four `.mob-bottom-nav` divs, one per role, each 5 destinations + More), CSS L1085-1122 (fixed 64px bar, `.on` = white text + gold top border), L2317-2324 (showPage shows one bar per role), L2203-2211 (mobSetActive) — all confirmed accurate
- **Now:** components/portal/Shell.tsx: Menu/X toggle in the sticky mobile identity bar opens a role="dialog" full-screen overlay (#portal-mobile-nav, md:hidden) rendering the SAME full sidebar/nav list as desktop (all items from lib/portal/nav.ts), with focus trap + Escape. Grepped repo for mob-bottom-nav/bottom-nav/BottomNav/tab-bar: no fixed bottom bar exists anywhere.
- **Verified:** OG claim is accurate as cited. But the new-portal claim ('nowhere ... no path') overstates it: nothing is actually unreachable — every OG bottom-bar destination is present, correctly labeled, in the overlay's full nav list, which is arguably more discoverable (text labels vs 5 icons) than the OG. The real regression is ergonomic: one extra tap (open hamburger, then tap destination) and the overlay takes over the whole screen instead of staying persistent — worse for one-handed glancing mid-class, but nobody is blocked from finding or completing anything, so 'blocker' fails the calibration bar ('cannot complete' vs 'extra taps'). Downgraded to medium (friction).
- **Fix:** If one-tap access is wanted back: add a <nav> fixed to viewport bottom, md:hidden, driven by a new bottomTabsForUser(user) export in lib/portal/nav.ts with ~4 primary per-role destinations plus a 'More' tab opening the existing overlay; add pb-20 md:pb-0 to <main>. This is a UX/ergonomics improvement, not a functional restoration, since the overlay already provides complete access.

### `F0011` [BROKEN] OG-printed QR cards will not scan: the payload format changed from STKQR:<uid> to SKSS-STU:<4-digit id>
- **Role:** all · **Area:** qr
- **OG:** OG L14273/14346 (STKQR:+uid on both printed and drawn personal QR codes), L13993 (scanner hard-rejects any other prefix) — confirmed verbatim
- **Now:** lib/portal/qr.ts — STUDENT_PAYLOAD_PREFIX='SKSS-STU:', parseStudentPayload requires a 4-digit numeric id; lib/portal/actions/qr.ts rejects anything that fails that parse
- **Verified:** Confirmed a legacy STKQR:<uid> payload fails both the prefix and digit-format checks in the new parser, and a repo-wide grep for "STKQR" returns zero hits — the old scheme is recognised nowhere. This looks like a deliberate, arguably better redesign (short numeric IDs vs. long Firebase uids), but it does mean any card printed under the old scheme is now dead. A manual/typed fallback and one-time reprint exist, keeping it at medium rather than a hard blocker.
- **Fix:** Either accept the legacy prefix as a compatibility shim in parseStudentPayload, or (simpler, and probably correct) tell every class plainly to reprint from /portal/qr/cards and add a note to the Help page.

### `F0323` [DEGRADED] Readings are no longer grouped by service — Vespers / Matins / Liturgy became up to twelve separate look-alike cards
- **Role:** all · **Area:** readings
- **OG:** OG L13432-13445 serviceGroups array (vespers/matins/liturgy, groupColors, omit-empty-group rule) — confirmed verbatim
- **Now:** lib/coptic-api.ts SECTION_LABELS (flat Record<string,string>, no service key) + lib/portal/data/community.ts:368-373 (buckets only by raw label) + app/portal/(app)/readings/page.tsx:81-105 (one Card per bucket in a sm:grid-cols-2 grid)
- **Verified:** Read all three files fresh (different search terms than the original evidence). Confirmed: SECTION_LABELS maps e.g. VPsalm -> 'Vespers Psalm' with no accompanying service/color metadata, and the page renders one identical white card per distinct label — exactly the flattening the finding describes.
- **Fix:** Add a service key ('vespers'|'matins'|'liturgy'|'other') to SECTION_LABELS/ReadingRef, carry it through CopticDayCache.readings, and render one card with three colour-coded service groups in readings/page.tsx.

### `F0137` [DEGRADED] Printing lost the OG's isolated A4-landscape print window; wide reports now print through the live page with no page setup
- **Role:** all · **Area:** reports
- **OG:** OG openIsolatedPrintWindow, L9189-9211 — separate window, `@page{size:A4 landscape;margin:10mm}`, pop-up-blocked toast — confirmed verbatim
- **Now:** components/portal/PrintButton.tsx (plain window.print()); app/globals.css (no @page rule anywhere in the file); components/portal/ui.tsx:460-465 TableWrap (overflow-x-auto + w-full)
- **Verified:** Confirmed no @page rule exists anywhere in the codebase (grep across app/globals.css and the portal tree). Genuine overflow risk is real for the widest report: app/portal/(app)/servant-attendance/report/page.tsx supports RANGES=[4,8,13,26] weekly columns. Most single-month reports (~4-5 columns) likely print fine even without landscape sizing; a CSV export exists as a fallback for the data-heavy ones, which keeps this at medium rather than higher.
- **Fix:** Add a scoped `@media print { @page { size: A4 landscape; margin: 10mm; } }` for wide report pages, and drop TableWrap's overflow-x-auto under print.

### `F0297` [DEGRADED] The activity picker dropdown is gone; the grid now shows all seven activities as columns, which does not fit a phone
- **Role:** all · **Area:** servant-attendance
- **OG:** OG L7847-7850 — `<select id="sab-activity-select">` filters the grid to one activity at a time — confirmed verbatim
- **Now:** app/portal/(app)/servant-attendance/page.tsx (searchParams only has `week`, no activity param); app/portal/(app)/servant-attendance/ServantGrid.tsx (renders every listServantActivities() row as a column in one TableWrap table with a sticky first column)
- **Verified:** Confirmed no activity filter exists anywhere in the route. Noted for balance: the sticky-column + horizontal-scroll pattern used instead is a legitimate mobile table pattern, but is still a busier UX than the OG's one-activity view for someone marking a single activity on a phone, so the finding's core claim stands.
- **Fix:** Add an optional `?activity=` filter above the grid that narrows the table to one column, defaulting to single-activity on narrow screens.

### `F0833` [DEGRADED] Period filter: All Time / By Month / Date Range toggle missing on Church Reports
- **Role:** pastor · **Area:** Admin/Pastor > Church Reports (renderChurchReportsPage)
- **OG:** index.stripped.html L7404-7425 (three setCrPeriodMode buttons, 'all' default) and L7458-7466 (setCrPeriodMode)
- **Now:** app/portal/(app)/reports/page.tsx L94-130 (church tab), ReportFilters show={{range:true, session:true}}
- **Verified:** Verified OG has three explicit mode buttons with conditional month/range pickers. New church tab only offers a manual date range (defaulting to a rolling 90-day window), no All-Time preset, no month quick-select for this tab. Accurate as filed.
- **Fix:** Add an 'All time' quick-preset that clears from/to, and turn on show.month for the church tab (ReportFilters already supports it elsewhere).

### `F0834` [MISSING] Per-class 'Select All' checkbox + 'Print Selected' vs 'Print All Classes' missing
- **Role:** pastor · **Area:** Admin/Pastor > Church Reports (renderChurchReportsPage)
- **OG:** index.stripped.html L7412 (cr-select-all checkbox), L7629-7630 (Print Selected / Print All buttons), L7630-7702 (printChurchReports)
- **Now:** app/portal/(app)/reports/page.tsx and reports/cards/page.tsx — only a single global PrintButton
- **Verified:** Confirmed via full grep of the reports folder: zero checkbox/select-all state anywhere, only one PrintButton with no per-class selection. Matches OG's two-button (Selected vs All) + checkbox pattern exactly.
- **Fix:** Add per-ClassCard checkboxes plus a page-level Select All, and a scoped print/export path fed by the selected class ids.

### `F0830` [MISSING] No per-class filter control on the Lesson Archive — only a flat, unfilterable list
- **Role:** pastor · **Area:** Pastor > Lessons / Servant > Classboard (Lesson Archive)
- **OG:** index.stripped.html L15579-15581 (filter tab markup), L16111-16121 (filterPtLesson)
- **Now:** app/portal/(app)/lessons/page.tsx ArchiveView (L100-162)
- **Verified:** Read the full ArchiveView component: it is one flat <ul> of every lesson from every class, newest first. The only tabs on the page are the outer 'By class' / 'Archive · all classes' toggle, which is a different control, not a per-class filter within the archive. There is no partial/degraded version of the OG's per-class tabs — the mechanism does not exist at all, so DEGRADED understates it; MISSING is accurate. Severity stays medium: browsing an unfiltered multi-class archive is friction, not a blocker.
- **Fix:** Add a ClassPicker-style filter above ArchiveView (the component is already used at leaderboard/page.tsx:51), or add the per-class grouping from F0765 as a substitute.

### `F0792` [MISSING] pastor-visit-badge sidebar count missing from Follow-ups nav item
- **Role:** pastor · **Area:** Pastor shell (sidebar 'Follow-up' nav item)
- **OG:** index.stripped.html L19127 (#pastor-visit-badge span), L18573-18584 and L18486-18497 (refreshPastorNotifs, kept live)
- **Now:** nowhere — lib/portal/nav.ts NavItem has no badge field; components/portal/Shell.tsx renderer only draws icon+label
- **Verified:** Confirmed OG keeps two separate always-visible open-case indicators (sidebar badge + bell badge), both driven by the same totalOpen. Checked the new portal's only candidate substitute, NotificationBell: its 'cases:open:${open}' key is dismissible, and because the key embeds the exact count, a pastor who dismisses it gets NO visible indicator anywhere until the count changes — a real functional loss, not cosmetic.
- **Fix:** Add a badge field to NavItem and surface the pastor's openCases count (already computed in reports.ts) on the Follow-ups sidebar row, independent of notification dismissal.

### `F0761` [MISSING] Roster Quiz Avg column/badge missing from the class roster
- **Role:** pastor · **Area:** classes
- **OG:** index.stripped.html L15479-15486 (Student/Points/Quiz Avg/Attendance table)
- **Now:** app/portal/(app)/classes/[id]/page.tsx roster card grid (L104-160)
- **Verified:** Verified the OG table header and row markup include a dedicated Quiz Avg column. Full read of the new roster grid: each student card shows only an attendance-rate badge and a points badge — no quiz-average figure anywhere, and no quiz data is even computed for the roster view.
- **Fix:** Compute per-student quiz average alongside the existing attendance/points aggregates and add a third badge to each roster card.

### `F0781` [MISSING] Persistent mobile bottom navigation bar missing
- **Role:** pastor · **Area:** cross-cutting chrome
- **OG:** index.stripped.html L19964-19969 (#pt-mob-nav), shown via L2324
- **Now:** nowhere in components/portal/Shell.tsx
- **Verified:** Full read of Shell.tsx confirms the only mobile nav is a hamburger-triggered full-screen overlay; no fixed bottom-0 element exists anywhere in the chrome.
- **Fix:** Add a persistent 5-icon bottom bar for one-tap access to the most common destinations on mobile.

### `F0782` [DEGRADED] Topbar 'Birthdays This Week' chip is non-clickable, student-only, and never shows the multi-birthday summary
- **Role:** pastor · **Area:** cross-cutting chrome
- **OG:** index.stripped.html L1758-1799 (loadNextMeetingCard, includes servants + 'N: a,b +more' format), L19142-19144 (clickable card, ptLoad('schedule',...))
- **Now:** components/portal/BirthdayChip.tsx + lib/portal/data/dashboard.ts computeNextBirthday (L183-201)
- **Verified:** Confirmed all three sub-claims by reading the OG function and the new component/query in full: BirthdayChip is a plain non-interactive <span>; computeNextBirthday queries prisma.student only (no servants); it always returns just upcoming[0], never a multi-name 'N: A,B +more' summary.
- **Fix:** Make the chip a Link to /portal/events, include servant birthdays in the query, and restore the multi-birthday summary format when more than one falls in the window.

### `F0768` [MISSING] YouTube link auto-preview (thumbnail + play button) missing on Events
- **Role:** pastor · **Area:** events
- **OG:** index.stripped.html L15040-15046 (ytId branch: hqdefault.jpg thumbnail + red play button)
- **Now:** nowhere — app/portal/(app)/events/page.tsx EventRow link renderer
- **Verified:** Full read of events/page.tsx confirms every event.link renders as one generic 'Details' chip with an ExternalLink icon; no regex detection, no thumbnail, confirmed by grep for youtu/hqdefault returning nothing.
- **Fix:** Detect youtu.be/watch?v= links and render the hqdefault.jpg thumbnail with a play-button overlay, as the OG did.

### `F0769` [MISSING] Image link auto-preview missing on Events
- **Role:** pastor · **Area:** events
- **OG:** index.stripped.html L15050-15051 (isImageLink branch renders inline <img>)
- **Now:** nowhere — same link renderer as F0768
- **Verified:** Same full read of events/page.tsx confirms there is no media-type branching at all in the link renderer.
- **Fix:** Detect .jpg/.png/.gif/.webp links and render an inline <img> preview.

### `F0770` [MOVED] 'Birthdays This Week' strip removed from the Events page (relocated to a dedicated page + dashboard card)
- **Role:** pastor · **Area:** events
- **OG:** index.stripped.html L14879-14944 (loadScheduleBirthdays), wired at L15631
- **Now:** lib/portal/nav.ts /portal/birthdays item (all staff roles) + app/portal/(app)/page.tsx 'Upcoming birthdays' card (L145-159)
- **Verified:** Confirmed events/page.tsx (full file) has zero birthday code, and confirmed the two replacement surfaces genuinely exist and are reachable. Data isn't lost, just relocated off the Events page specifically, matching the MOVED framing.
- **Fix:** Either add a compact birthdays-this-week strip back to /portal/events for parity, or accept the dedicated-page tradeoff explicitly — no further verification action needed either way.

### `F0030` [MISSING] Servant dashboard lost the 'Average Scores' exam-trend chart
- **Role:** pastor · **Area:** exams
- **OG:** index.stripped.html L4325-4347 (examScoreTrend, last 8, ' · Mon D' disambiguation), L4421-4425 (canvas widget, shown when >=2 exams)
- **Now:** nowhere — components/portal/widgets/ExamsWidget.tsx and app/portal/(app)/page.tsx widget grid
- **Verified:** Full read of ExamsWidget.tsx and the dashboard's widget grid confirms no chart, no trend query. Repo-wide grep for chart/canvas/recharts finds only the QR scanner and photo-upload cropper's <canvas> elements, unrelated.
- **Fix:** Add a small inline-SVG bar chart fed by a per-exam average query (last 8 by createdAt, same disambiguation rule), shown beside ExamsWidget when >=2 exams have results.

### `F0280` [BROKEN] Daily Readings unreachable for admins and pastor — no sidebar link, and the OG's combined Posts/Readings tab strip is gone
- **Role:** pastor · **Area:** feed-posts
- **OG:** index.stripped.html L13336-13371 (switchFeedTab), L18897-18904 (the pills)
- **Now:** /portal/readings exists and renders for any role (app/portal/(app)/readings/page.tsx, gated only by requirePortalUser) but is absent from both the ADMIN and PASTOR arrays in lib/portal/nav.ts
- **Verified:** Verified nav.ts in full: neither ADMIN nor PASTOR arrays include /portal/readings. Verified readings/page.tsx has no role gate excluding them. Also verified feed/page.tsx (full read, grep for Tabs/Posts/Readings/tab) has no tab strip at all — posts and readings are now fully separate pages, confirming the claim that the OG's single tabbed surface was split with one half left unlinked for two roles.
- **Fix:** Add { href: '/portal/readings', label: 'Daily Readings', icon: 'readings', section: 'Community' } to the ADMIN and PASTOR arrays in lib/portal/nav.ts.

### `F0772` [MISSING] Delete a follow-up case (single row) and bulk-delete resolved cases
- **Role:** pastor · **Area:** followup
- **OG:** OG deleteVisitationCase caller sites ~L17552-17583; bulk delete ~L17490-17520
- **Now:** lib/portal/actions/followups.ts — confirmed exported functions are exactly logContact, resolveCase, reopenCase, createManualCase; no delete action exists
- **Verified:** Confirmed. Downgraded from high to medium — resolveCase already gives a working cleanup path for a wrongly-opened or duplicate case (it stays in history rather than disappearing); this is housekeeping, not a task blocker or a source of incorrect data.
- **Fix:** Add a deleteCase server action and delete UI, at minimum for ADMIN/PASTOR.

### `F0773` [MISSING] Follow-up cases are not grouped by class with a per-class 'All clear' state
- **Role:** pastor · **Area:** followup
- **OG:** index.stripped.html L18580-18592
- **Now:** app/portal/(app)/follow-ups/page.tsx — flat cases.map list (full file read)
- **Verified:** Confirmed: one flat list, each card has only a 'Class: X' detail row; no per-class section headers, no open-count-per-class badge, no 'All clear' equivalent anywhere in the 168-line file.
- **Fix:** Reintroduce grouping/collapse-by-class on the follow-ups list, or explicitly accept the flat-list-with-filter as adequate.

### `F0100` [MISSING] WhatsApp outreach removed from every follow-up surface
- **Role:** pastor · **Area:** followups
- **OG:** OG waLink() L16751-16758 (incl. 10-digit -> prepend '1' rule), rendered at servant row L17250 and pastor row L17568 — verified
- **Now:** confirmed no wa.me/waLink in lib/portal/ or app/portal/(app)/follow-ups/**; a 'log contact as whatsapp' method option exists in CaseActions.tsx but generates no link
- **Verified:** Confirmed the deep link is gone. Downgraded from high to medium — follow-ups/[id]/page.tsx does render parents' numbers as tel: links (confirmed lines 125, 144), so a servant can still call or manually message via WhatsApp using the visible number; slower, not impossible, no data lost.
- **Fix:** Port waLink() into lib/portal/phones.ts and render a WhatsApp link beside every tel: link on the case page and case row.

### `F0108` [MISSING] The Follow-up count badge is gone from the sidebar — the nav has no badge mechanism at all
- **Role:** pastor · **Area:** followups
- **OG:** OG #visit-badge L4015, servant count L17073-17093; #pastor-visit-badge L19127, pastor count L18573-18575
- **Now:** lib/portal/nav.ts NavItem type confirmed to have only href/label/icon/section; components/portal/Shell.tsx confirmed zero occurrences of 'badge'
- **Verified:** Confirmed the mechanism is genuinely absent. Downgraded from high to medium — opening Follow-ups immediately shows the exact open-case count in a prominent StatCard; nothing is hidden, it's one click rather than an at-a-glance badge.
- **Fix:** Add an optional badge?: number to NavItem, render it in Shell.tsx, and populate it for the Follow-ups entry from the open-case count.

### `F0109` [DEGRADED] Resolving a case writes no FollowUpLog entry — the closing conversation is not recorded in the contact log
- **Role:** pastor · **Area:** followups
- **OG:** index.stripped.html L17317-17336 (saveVisitLog: log.push(entry) always runs, then resolve fields are added in the same write)
- **Now:** lib/portal/actions/followups.ts resolveCase (full function read) — updates only FollowUpCase fields, no FollowUpLog.create
- **Verified:** Verified the OG always appends to log[] before applying resolve fields in one atomic write. Verified resolveCase in the new code never creates a FollowUpLog row; 'Log a contact' and 'Resolve' are two fully independent forms in CaseActions.tsx.
- **Fix:** Have resolveCase create a FollowUpLog row (method from a select, note = resolve note, result = the reason) in the same transaction as the status update.

### `F0110` [DEGRADED] A reason is no longer required to close a case, and 'Attending again' is pre-selected
- **Role:** pastor · **Area:** followups
- **OG:** index.stripped.html L17321-17322 (guard: if(resolve && !reason) reject), markup L19866 (blank default option)
- **Now:** app/portal/(app)/follow-ups/[id]/CaseActions.tsx Resolve form — useState defaults to 'attending_again'
- **Verified:** Confirmed the OG guard and blank default option exist exactly as described. Confirmed the new Resolve form's select starts on a real enum value with no unselected/blank sentinel, and ResolveSchema has no guard against a thoughtless default — one click on 'Mark resolved' always succeeds.
- **Fix:** Default the select to an empty 'Select a reason…' option and reject an empty/placeholder value in both the form and ResolveSchema.

### `F0111` [DEGRADED] The case's latest contact note no longer appears on the follow-ups list row
- **Role:** pastor · **Area:** followups
- **OG:** index.stripped.html L17246 (servant row), L17564 (pastor row) — clipboard-icon note line; kept current by L17330 (note = newest log entry's note)
- **Now:** only inside /portal/follow-ups/[id] (Details field or Contact log timeline) — not on the list row
- **Verified:** Verified the follow-ups list query (app/portal/(app)/follow-ups/page.tsx, full select) fetches only _count.logs, no log content or note field; the row shows a bare 'Contacts: N' badge instead of the most recent note.
- **Fix:** Select details plus the newest log note (logs: {take:1, orderBy:{at:'desc'}}) in the list query and render it as a note line on the row.

### `F0766` [MISSING] Lesson notes/body text missing from the pastor/admin Lesson Archive cards (still shown on a servant's own class Lesson Prep cards)
- **Role:** pastor · **Area:** lessons
- **OG:** OG ptLessonCard() L15556, the same cross-class 'Lesson Archive' view a pastor sees — verified
- **Now:** app/portal/(app)/lessons/page.tsx:128-159 (archive branch shown to PASTOR/ADMIN) has no l.notes; app/portal/(app)/lessons/LessonManager.tsx:433-434 DOES render lesson.notes on a servant's own class view
- **Verified:** Confirmed the gap is scoped exactly to the cross-class archive view, matching the finding's own citation and role — not a portal-wide removal. Lesson.notes exists in the schema and is populated; it's just not shown on this one summary view. Downgraded from high to medium.
- **Fix:** Render the lesson's notes on the archive card too, same as LessonManager.tsx already does for a servant's own view.

### `F0263` [BROKEN] Archive lesson cards drop notes/links/author, and mislabel PLANNED lessons 'Taught by'
- **Role:** pastor · **Area:** lessons
- **OG:** index.stripped.html L15556-15572 (ptLessonCard: notes, topic chips, link chips, createdBy)
- **Now:** app/portal/(app)/lessons/page.tsx ArchiveView card (L124-157)
- **Verified:** Verified LessonView/lessonSelect/toView in lib/portal/data/lessons.ts already fetch notes, links (parsed), and createdByName on every lesson — the data is present, ArchiveView simply never renders them (confirmed reading the full card JSX). Also independently verified the mislabel: the assignee line is unconditional — {l.assignedToName ? `Taught by ${l.assignedToName}` : 'Unassigned'} — so a PLANNED lesson assigned to someone shows a 'Planned' badge next to 'Taught by Name' simultaneously.
- **Fix:** Render l.notes and l.links (as the existing gold-pill style), add 'Added by <l.createdByName>', and make the assignee line status-aware: TAUGHT -> 'Taught by X', PLANNED -> 'Assigned to X'.

### `F0765` [MISSING] Lessons are not grouped by class (no per-class card, no 'No lessons' badge, no '+N more')
- **Role:** pastor · **Area:** lessons
- **OG:** index.stripped.html L15586-15598
- **Now:** app/portal/(app)/lessons/page.tsx ArchiveView (L124-159) — flat <ul>
- **Verified:** Distinct from F0830/F0764 (which are about the missing filter control): this is about the missing grouped-by-class layout itself. Confirmed ArchiveView has no per-class .forEach grouping, no empty-class 'No lessons' indicator, and no 5-item-then-'+N more' cap — just one flat, date-sorted list.
- **Fix:** Group lessons under a per-class card (as OG did), or treat the class-filter control (F0830) as an accepted substitute.

### `F0767` [MISSING] Lesson archive cards drop resource link chips
- **Role:** pastor · **Area:** lessons
- **OG:** index.stripped.html L15558
- **Now:** app/portal/(app)/lessons/page.tsx ArchiveView card
- **Verified:** Confirmed l.links is never read in ArchiveView's JSX, despite LessonView.links already being populated (see F0263 note) — purely a rendering gap, not a data-model gap.
- **Fix:** Render l.links as clickable pill chips in each archive card (data already available).

### `F0756` [MISSING] 'Average Scores by Class' chart missing from the church-wide dashboard
- **Role:** pastor · **Area:** overview
- **OG:** index.stripped.html L15361-15366, renderChurchWideCharts wiring L1975
- **Now:** nowhere
- **Verified:** Repo-wide grep for chart/Chart/canvas/recharts across app/portal, lib/portal, components/portal turns up only unrelated <canvas> usage (QR scanner, photo cropper) and Lucide icons literally named *Chart* — no charting library or chart-rendering code exists anywhere.
- **Fix:** Add a lightweight chart (inline SVG needs no library) to the dashboard or the Reports church tab, per-class quiz average, shown when >=2 classes have data.

### `F0757` [MISSING] 'Recent Activity' widget (church-wide points log) missing from the dashboard
- **Role:** pastor · **Area:** overview
- **OG:** index.stripped.html L1956-1969 (buildChurchWideWidgets)
- **Now:** nowhere
- **Verified:** Full read of the staff dashboard (app/portal/(app)/page.tsx) confirms no recent-points feed; FeedWidget covers posts/reading/announcements only, and no query anywhere pulls the last N PointEntry rows church-wide.
- **Fix:** Add a 'Recent activity' card sourced from PointEntry ordered by createdAt desc, last 6 entries.

### `F0758` [MISSING] Attendance Overview section (per-class bar+badge list) missing from the dashboard
- **Role:** pastor · **Area:** overview
- **OG:** index.stripped.html L15399-15412
- **Now:** nowhere on /portal
- **Verified:** Full read of app/portal/(app)/page.tsx confirms ClassCard shows only a bare 'Sundays (4 wks)' percentage — no progress bar, no rate%, no Excellent/Good/Needs-attention badge, no dedicated section.
- **Fix:** Add a per-class attendance list/section with a colored progress bar and status badge, as the OG had.

### `F0321` [MISSING] Reading Check-in dropoff card is gone from the class view (real gap, but not blocker-grade)
- **Role:** pastor · **Area:** readings
- **OG:** Servant Class Profile, OG L4762-4790 (dropoff computation), L4864-4875 (card markup, between Most Active Student and Recent Activity)
- **Now:** nowhere; /portal/classes/[id]/page.tsx has no Most Active Student, Recent Activity, or Reading Check-in card at all -- the whole OG 'digest' concept wasn't ported, not just this piece
- **Verified:** Confirmed: grep for dropoff/streakAtDropoff across lib/portal and app/portal returns nothing; readingStateFor() (lib/portal/data/community.ts:402) only computes a single student's own streak, no class-level aggregation exists. Downgrading severity: this is a proactive pastoral-care nudge, not something that blocks a weekly task -- the underlying reading data is intact and a servant can still find a lapsed reader by opening each student's page manually, just slower. Friction, not a blocker.
- **Fix:** Add a readingDropoffs(classIds, today) query to lib/portal/data/community.ts (join BibleReadingLog to Student, skip <3 days since last read, count trailing streak, keep streak>=3) and render it as a Card on app/portal/(app)/classes/[id]/page.tsx.

### `F0322` [MISSING] Bible Reading Streak tile is gone from the student profile a servant opens (real gap, but not blocker-grade)
- **Role:** pastor · **Area:** readings
- **OG:** Student Profile (opened from Class Profile), OG L5015-5025 (computation), L5087-5095 (tile markup)
- **Now:** nowhere on app/portal/(app)/students/[id]/page.tsx -- readingStateFor is never imported there
- **Verified:** Confirmed: grep for readingStateFor/Bible in students/[id]/page.tsx returns nothing. The function IS already used, exactly as claimed, on the student's own page (app/portal/(app)/readings/page.tsx:22), so the data isn't lost, just not surfaced on this one page. Downgrading severity for the same reason as F0321: informational tile, not a blocker, data visible elsewhere.
- **Fix:** In app/portal/(app)/students/[id]/page.tsx, call the existing readingStateFor(s.id, today) and render a tile under the stats row (book icon, streak count, Read-today/Not-read-today badge). No new query needed.

### `F0122` [BROKEN] 'Church Reports' nav item opens the per-class Attendance tab instead of the church-wide report (the real report is one clearly labeled click away)
- **Role:** pastor · **Area:** reports
- **OG:** OG admin nav L2720 / pastor nav L19128 both render the church-wide report in one click (wrappers L2812-2815 / L15637-15639) — verified
- **Now:** lib/portal/nav.ts:44 (ADMIN) and :65 (PASTOR) link bare /portal/reports; app/portal/(app)/reports/page.tsx:74 defaults tab to 'attendance' with no ?tab=
- **Verified:** Confirmed the routing mismatch is real, but reports/page.tsx renders a visible Tabs strip with an explicit 'Church reports' tab right at the top whenever churchScope is set (always true for ADMIN/PASTOR) — so the report is one clearly labeled click away, not hidden or lost. That's a muscle-memory mismatch, not a blocked task. Downgraded from blocker to medium.
- **Fix:** Point the ADMIN/PASTOR nav entries at /portal/reports?tab=church, or default tab to 'church' when churchScope is set and no tab was requested.

### `F0776` [DEGRADED] 'Select All' + 'Print Selected' are gone; 'Print All Classes' already has a working substitute
- **Role:** pastor · **Area:** reports
- **OG:** OG L7368-7370 / L7429-7435: checkbox per class card, Select-All toggle, Print Selected and Print All Classes buttons
- **Now:** app/portal/(app)/reports/page.tsx church branch has one <PrintButton/> (components/portal/PrintButton.tsx, native window.print()) plus CSV export
- **Verified:** Confirmed no per-class checkboxes exist. Correcting the claim that the whole feature is missing: the single PrintButton already prints every class card on the page in one shot via the browser's native print, which functionally covers 'Print All Classes.' What's genuinely gone is printing a subset -- no substitute exists for that at all. Real but narrower gap, and a workaround (print everything, keep the relevant pages) exists, so this is friction rather than something blocking a weekly task.
- **Fix:** Add per-class checkboxes and a 'print selected' action; leave the existing native print-all as-is.

### `F0777` [MISSING] Click-through per-student breakdown modal is gone from the church report grid (a different, harder-to-find substitute exists)
- **Role:** pastor · **Area:** reports
- **OG:** OG L7606-7629: openChurchReportClassModal shows every student's value for the active metric, opened by clicking a class card
- **Now:** nowhere on the church-report grid (app/portal/(app)/reports/page.tsx:172-218 ClassCards have no onClick)
- **Verified:** Confirmed no modal/onClick/dialog exists in app/portal/(app)/reports/ apart from an unrelated button in ReportFilters.tsx. Correcting severity: a partial alternative exists that the original evidence missed -- /portal/reports/cards (same Tabs row, labelled 'Report cards') shows a per-student breakdown via loadReportCards(), just scoped to one class picked from a separate filter rather than a click-through from the grid, and not filtered to the active metric. Not a real substitute for the interaction, but it means a pastor wanting per-student detail has a non-obvious way to get it rather than none at all -- friction, not a full loss.
- **Fix:** Add a click-through modal or link to a per-student breakdown per class/metric on the church-report grid; consider reusing loadReportCards() rather than building a new query.

### `F0814` [DEGRADED] Single sheet covering all 6 session types per month (weeks x activities matrix)
- **Role:** servant · **Area:** Attendance Report / Blank Form (servant, weeklyreport)
- **OG:** weeklyreport / Attendance Report tab, buildAttendancePrintHTML L9209-9264, printAttendanceReport L9299, downloadBlankAttendanceForm L9306-9310
- **Now:** /portal/reports (attendance tab) — reports/page.tsx forces one sessionKey; AttendanceMatrix.tsx renders one session's dates as columns
- **Verified:** Verified both sides directly. OG builds a week x (all 6 activities) grid in one print/download; new report picks exactly one session at a time with no multi-session mode.
- **Fix:** Add a report/print mode that renders all configured sessions side by side per week, matching buildAttendancePrintHTML's shape.

### `F0817` [DEGRADED] My Stage lost its embedded stage-reports panel; the replacement at /portal/reports also lacks per-class selection and 'Print Selected'/'Print Stage Report' modes
- **Role:** servant · **Area:** My Stage (servant coordinator, svLoad('mystage'))
- **OG:** Servant Ministry > My Stage, renderMyStagePage calling renderChurchReportsPage('mystage-reports-container', stage) L16921-16983; renderChurchReportsPage itself L7320+, Print Selected L7432, Print Stage Report/Print All Classes L7433
- **Now:** /portal/reports?tab=church (separate nav item, no link from My Stage)
- **Verified:** Confirmed my-stage/page.tsx (full 121 lines) has no reports import and no link to /portal/reports. But this is more than a pure move: I checked the church-reports tab and it has a single plain PrintButton with no per-class checkboxes at all, so it always prints everything in scope — the OG's per-class selection plus dual 'Print Selected' vs 'Print Stage Report' modes are also gone, not just relocated.
- **Fix:** Add a link from My Stage to /portal/reports?tab=church, and add per-class checkbox selection plus a 'print selected only' mode to the church-reports tab to restore the OG's granularity.

### `F0813` [DEGRADED] Student selection checkboxes before printing QR codes
- **Role:** servant · **Area:** Print QR Codes (servant)
- **OG:** Print QR Codes page, renderPrintQRPage L14204-14268, printSelectedQRCodes L14276-14311
- **Now:** /portal/qr/cards — server component, always prints every student in the class
- **Verified:** Confirmed qr/cards/page.tsx queries prisma.student.findMany for the whole class with no selection state anywhere in the file. OG confirmed to have Select All/Clear Selection, a live counter, and per-student checkboxes.
- **Fix:** Add a client-side selection UI (checkboxes + Select all/Clear) to the QR cards page so only chosen students print.

### `F0831` [MISSING] Bulk 'Reopen Selected' (multi-exam reopen-for-students)
- **Role:** servant · **Area:** Servant > Exams (id='exams')
- **OG:** Servant > Exams toolbar L11189, updateExamBulkState L11266-11282, openBulkReopenModal L11381-11387
- **Now:** ExamActions.tsx (single examId only) on the exam detail page; ExamsFilter.tsx has bulk Delete only
- **Verified:** Confirmed setReopenedStudents (lib/portal/actions/exams.ts:186) takes one examId; ExamsFilter.tsx has no bulk reopen button. OG confirmed to have exam-bulk-reopen-btn, updateExamBulkState (enabled only when checked exams include a past-due one), and openBulkReopenModal applying across multiple exam ids.
- **Fix:** Add a bulk 'Reopen selected' action to ExamsTable, enabled when >=1 selected exam is past-due, sharing the student-picker modal across all selected exam ids.

### `F0828` [MISSING] Leaderboard sort toggle: A-Z / Highest / Lowest
- **Role:** servant · **Area:** Servant > Points (id='grades') leaderboard section
- **OG:** Servant > Points leaderboard, buttons L5758-5760, setLeaderboardSort L9567-9570, medals always by points-desc L5813-5814
- **Now:** nowhere — rankStudents() (lib/portal/points-math.ts:12-21) is points-descending only, no sort-mode concept
- **Verified:** Confirmed PointsPanel.tsx leaderboard card has only Select-all/Clear, no sort control; grep for lbSortMode/setLeaderboardSort across app/components/lib returns zero hits. OG confirmed to have exactly this three-button toggle with medals pinned to points-descending regardless of display sort.
- **Fix:** Add the three-button sort toggle to the leaderboard card, re-sorting the already-fetched students array client-side, keeping medal ranks pinned to points-descending.

### `F0827` [DEGRADED] Full, unbounded points-history list (no row cap)
- **Role:** servant · **Area:** Servant > Points > History tab
- **OG:** Servant > Points > History tab, renderPointsHistoryPage unbounded query L9727-9730
- **Now:** classes/[id]/points/page.tsx — prisma.pointEntry.findMany with take:60, no pagination
- **Verified:** Confirmed hard-coded take:60 with no 'load more' and no search/filter/group controls anywhere in PointsPanel.tsx. OG confirmed to fetch the entire class's points collection with no limit at all.
- **Fix:** Either remove the cap and paginate, or add search/group-by plus a 'View full history' link so older entries stay reachable.

### `F0789` [MISSING] bday-badge sidebar count
- **Role:** servant · **Area:** Servant shell (sidebar 'Birthdays' nav item)
- **OG:** Servant sidebar 'Birthdays' item, markup ~L4025 (`<span id="bday-badge">`), logic refreshBirthdayBadge L17097-17135
- **Now:** nowhere in nav.ts/Shell.tsx
- **Verified:** Confirmed lib/portal/nav.ts NavItem has no badge field and components/portal/Shell.tsx's NavItem interface (lines 32-37) has no badge concept at all — grep for badge/Badge in Shell.tsx returns zero hits. OG sidebar confirmed to have a live bday-badge span.
- **Fix:** Add an optional badge field to NavItem and populate the Birthdays item from the same birthdays-this-week count already computed for the notification bell.

### `F0788` [MISSING] visit-badge sidebar count
- **Role:** servant · **Area:** Servant shell (sidebar 'Follow-up' nav item)
- **OG:** Servant sidebar 'Follow-up' item, markup ~L4015 (`<span id="visit-badge">`), logic refreshVisitBadge L17056-17095
- **Now:** nowhere in nav.ts/Shell.tsx; nearest equivalents are the dashboard NotificationsWidget open-case count and the follow-ups page's own header count
- **Verified:** Same NavItem/Shell.tsx gap confirmed as F0789 — no badge concept exists in the sidebar component at all.
- **Fix:** Add an optional badge field to NavItem and populate the Follow-ups item from the same openCases figure already computed in lib/portal/data/reports.ts buildFacts().

### `F0790` [MISSING] My Assignments has no proactive badge or reminder — a servant only sees new assignments by remembering to open the page
- **Role:** servant · **Area:** Servant shell (sidebar 'My Assignments' nav item)
- **OG:** sidebar item markup L4033; refreshMyAssignmentsBadge/getMyAgendaAssignments logic L17020-17054
- **Now:** lib/portal/notifications.ts (NotificationFacts/buildNotifications, no assignment branch); components/portal/Shell.tsx NavItem (lines 32-37, no badge field); data reachable only via app/portal/(app)/assignments/page.tsx
- **Verified:** OG confirmed as described. New portal confirmed to have zero surfacing of upcoming assignments anywhere (no bell item, no badge). But 'My Assignments' is already a first-class, clearly-labelled sidebar item under Teaching in lib/portal/nav.ts, one click away — it isn't hidden. This is a lost reminder, not a lost capability, so it's friction (medium) rather than high.
- **Fix:** Add an assignments-upcoming-count fact (reuse assignmentsForServant) and a SERVANT branch in buildNotifications so it appears as a bell item; add badge support to NavItem/Shell.tsx if a persistent sidebar count is also wanted.

### `F0787` [MISSING] One-time-per-session floating birthday toast
- **Role:** servant · **Area:** Servant shell (sidebar badge logic)
- **OG:** refreshBirthdayBadge(), L17097-17135 esp. L17126-17133; toast element/CSS L104-110, L1403
- **Now:** nowhere
- **Verified:** Confirmed via grep across components/portal, lib/portal and app/portal for sessionStorage|toast|Toast — zero hits anywhere; no toast mechanism exists in the new portal at all. OG confirmed to fire showNotif(...) once per browser session via sessionStorage.bdayToastShown. F0249 in this same batch is the same gap restated (see its entry).
- **Fix:** Add a lightweight toast/flash component fired once per session when the servant's birthday notification fact is non-empty.

### `F0786` [DEGRADED] 'Birthdays this week' bell item scope/window
- **Role:** servant · **Area:** Servant shell / dashboard bell
- **OG:** getCurrentWeekRangeET-based Mon-Sun window, L18836-18845
- **Now:** lib/portal/notifications.ts:105-120, BIRTHDAY_WINDOW_DAYS=7 rolling forward from today
- **Verified:** Confirmed directly: BIRTHDAY_WINDOW_DAYS = 7 and the filter is daysUntilBirthday(b.dob, today) <= 7 — a rolling window, not a calendar Mon-Sun week.
- **Fix:** Replace the rolling window with the same Mon-Sun calendar-week test the OG used.

### `F0799` [MISSING] showUndoToast (undo affordance for bulk student edits and CSV import)
- **Role:** servant · **Area:** Servant → Students page
- **OG:** showUndoToast L2416-2430; bulk edit + undo L10650-10685; import + undo L11160-11182
- **Now:** nowhere — no bulk-edit feature exists at all; importStudentsCsv (lib/portal/actions/data-tools.ts:357) writes with no snapshot
- **Verified:** Confirmed admin/students/page.tsx (full file) has only per-student Move/Edit, no bulk-edit UI. Notably app/portal/(app)/help/page.tsx *describes* a 'bulk edit' feature that does not actually exist in the code, corroborating that this capability (and its undo) was dropped wholesale. Points/QR undo (undoPoints, undoScan) do exist, confirming the gap is specific to bulk-edit/import as claimed.
- **Fix:** Snapshot prior values before any bulk write and CSV import, add an undo toast component, and wire undo actions that restore/delete accordingly. Also fix the Help page copy, which currently documents a nonexistent feature.

### `F0835` [MISSING] Class roster has no live search box (friction on a small list, not a blocker)
- **Role:** servant · **Area:** Servant/Admin > Class Profile (student roster)
- **OG:** L4688 (input), L16002-16017 (filterStudents)
- **Now:** nowhere on app/portal/(app)/classes/[id]/page.tsx (read in full — plain server-rendered grid, no filter state or input)
- **Verified:** Confirmed missing exactly as stated. Downgraded severity: this is a single class's roster (typically a small, alphabetically-sorted grid), and the admin already has a proper full-text search at /portal/admin/students (page.tsx lines 17-23, 68-80) for the church-wide list where search actually matters. Losing search on one class's small roster is friction, not a task-blocker.
- **Fix:** Add a small client-side search input above the roster grid on classes/[id]/page.tsx, same pattern as admin/students.

### `F0815` [DEGRADED] Detailed per-student report card content: session-by-session attendance, itemised manual points, per-exam breakdown
- **Role:** servant · **Area:** Student Reports grid (servant, svLoad('reports')) - per-student report modal
- **OG:** printStudentReport L6320-6496; session breakdown L6390-6398, manual points L6399-6407, per-exam list L6420-6455
- **Now:** /portal/reports/cards — loadReportCards/buildReportCard return only aggregate {pointsTotal, quizAverage, quizCount, attendance rate, rank, badges}
- **Verified:** Confirmed buildReportCard (lib/portal/reports.ts:422) has no per-session, per-manual-entry, or per-exam fields. OG confirmed to build exactly this level of detail (session pills, itemised manual entries with reason+date, per-exam Show-Details list).
- **Fix:** Extend loadReportCards / the report-card component to include a per-session attendance breakdown, itemised manual point entries, and a per-exam list.

### `F0216` [BROKEN] The agenda CSV shape changed from one-row-per-week (wide) to one-row-per-week-and-activity (tall) — any file exported from the old Firebase app can no longer be imported
- **Role:** servant · **Area:** agenda
- **OG:** OG agendaCsvRowsForClass (L8690-8712), consumed by exportAgendaSchedule (L8712-8730) and the import parser (L8777-8812); AGENDA_ACTIVITIES at L8145-8156
- **Now:** lib/portal/agenda.ts:184-232 AGENDA_CSV_HEADERS/agendaToCsvRows (one row per week+activity) and lib/portal/agenda.ts:257+ csvRowsToAgenda; surfaced via app/portal/(app)/agenda/AgendaTools.tsx Export/Import CSV
- **Verified:** Confirmed the shapes are genuinely incompatible: OG is 26 columns, one row per week; new format is 9 columns, one row per (week, activity) — ~10 rows per week. Verified by reading both agendaCsvRowsForClass and agendaToCsvRows directly. Severity corrected down from blocker to medium: within the new app, export→edit→import round-trips fine using its own consistent shape (this is described as the tool's actual intended weekly workflow), so this only breaks importing files that were exported from the old Firebase app before migration — a one-time compatibility gap, not an ongoing weekly blocker.
- **Fix:** Either add a legacy-format detector/importer that accepts the OG's wide per-week shape, or explicitly document that old exported schedule files are no longer importable and any such files must be re-entered once.

### `F0218` [DEGRADED] The year-overview accordion only lists saved weeks, but any week (including empty future ones) is still directly reachable via a 'Jump to a date' picker
- **Role:** servant · **Area:** agenda
- **OG:** L8159-8162, L8224-8335 (getSchoolYearWeeksList + Filled/Empty tile accordion)
- **Now:** app/portal/(app)/agenda/page.tsx ArchiveMonths (only lists saved AgendaWeek rows via lib/portal/data/agenda.ts listAgendaWeeks lines 136-157); app/portal/(app)/agenda/AgendaTools.tsx AgendaNav lines 15-51 ('Jump to a date' date-input, goes to any week)
- **Verified:** Confirmed the accordion narrowly only shows weeks with a saved DB row, exactly as claimed — listAgendaWeeks never synthesises unfilled weeks. But the finding's practical alarm ('an empty future week cannot be seen or opened') is refuted at the page level: AgendaNav's 'Jump to a date' input sits on the same page and goes straight to any date, including an unfilled future week, landing on the writable AgendaEditor for it. So the capability to plan ahead is fully present; what's actually lost is only the 'see the whole year's fill status at a glance' overview, which is real friction for someone auditing many weeks but not a blocker.
- **Fix:** If a full-year overview is still wanted, synthesize the Sept-Aug week list and left-join saved AgendaWeek rows onto it for the accordion (as the OG did), keeping the existing 'Jump to a date' picker as-is since it already solves reachability.

### `F0219` [DEGRADED] The searchable, content-summary Lesson Archive is gone for every role (not just servants) — a plain navigational archive substitute exists for browsing, just without search or topic previews
- **Role:** servant · **Area:** agenda
- **OG:** L8595-8688 (renderLessonArchive/renderArchiveTimeline)
- **Now:** Servants: ArchiveMonths on app/portal/(app)/agenda/page.tsx (available to all roles, tile-only, no search). Admin/Pastor only: app/portal/(app)/lessons/page.tsx view=archive, built from the unrelated Lesson model (canArchive gate at line 27) — also has no search.
- **Verified:** Confirmed the OG's rich, free-text-searchable, content-summary timeline (topic/saint/bible-study/lead-servant, Open Slides, View Full Week) is completely gone — grep for 'Search lessons'/'archive-search' across the whole app returns nothing. But 'servants lost the archive entirely' overstates it: servants do have an archive of past agenda weeks (ArchiveMonths on /portal/agenda, not role-gated), they just get tiles with no content preview or search, which is the same limitation admins have on their separate Lesson-based archive. Confirmed via prisma/schema.prisma that Lesson (L602-621) and AgendaWeek (L625-643) are genuinely different tables, so the admin's archive isn't even reading the same data the OG's was. This is real, but it's a lesson-prep research aid, not a weekly task-blocker.
- **Fix:** Add a searchable, content-summary timeline fed by AgendaWeek/AgendaItem (filled = slideLink or any topic, newest first) with a text filter over topic/saint/verse/notes fields, reachable by servants from /portal/agenda, with Open Slides and a link to that week.

### `F0222` [DEGRADED] The Agpeya Prayer hour dropdown is now a free-text box
- **Role:** servant · **Area:** agenda
- **OG:** Edit Schedule week modal, AGPEYA_HOURS L8157, type==='hour' select L8429-8435, field markup L19748
- **Now:** /portal/agenda week editor — agenda.ts AGENDA_ACTIVITIES has no type field; AgendaEditor.tsx renders one text input for all ten rows
- **Verified:** Confirmed directly: lib/portal/agenda.ts has no type field or AGPEYA_HOURS constant; AgendaEditor.tsx has one uniform text input. OG confirmed to branch on a.type==='hour' to render a <select> with the six canonical hours.
- **Fix:** Add type?: 'hour' back to AGENDA_ACTIVITIES with an AGPEYA_HOURS constant, and branch in AgendaEditor so the agpeya row renders a select.

### `F0224` [MISSING] "Open Slide in Canva" is gone from the editor for anyone who can actually edit
- **Role:** servant · **Area:** agenda
- **OG:** Edit Schedule week modal, link L19756, openSlideInCanva L8495-8499
- **Now:** nowhere for writers — 'Open Slides' only exists in ReadOnlyWeek (agenda/page.tsx) and agenda/week/page.tsx, both non-writer/viewer paths
- **Verified:** Confirmed AgendaEditor.tsx's slide-link field (lines 142-150) has no test/open link. Confirmed 'Open Slides' anchors exist only in the read-only views, which render for users who cannot write. OG confirmed openSlideInCanva() reads the live, unsaved input value, letting a writer test a pasted link before saving.
- **Fix:** Add an 'Open slides' anchor next to the Slide link field in AgendaEditor that opens the field's current value in a new tab (disabled when empty).

### `F0225` [DEGRADED] Servants can no longer look at another class's weekly assignments; the week sheet has no class picker at all
- **Role:** servant · **Area:** agenda
- **OG:** Weekly Assignment View/Archive CLASS: select over all classes L8522-8527, wavSelectClass L8578-8587, allowClassPicker=true for servants at L3225/L6307, all-classes load L6289-6293
- **Now:** /portal/agenda's class picker (AgendaTools.tsx AgendaNav) only lists classes from listVisibleClasses(user), renders only when >1; /portal/agenda/week has no class picker at all
- **Verified:** Confirmed visibleClassIds (lib/portal/permissions.ts:62-67) restricts SERVANT to assigned/oversight classes; confirmed neither agenda/page.tsx nor agenda/week/page.tsx has an admin-style all-classes override for the read-only views, and week/page.tsx imports no picker component whatsoever. OG confirmed to load every class for servants and pass allowClassPicker=true identically to the admin path.
- **Fix:** On the read-only Weekly Assignment View and archive, source the class list from all active classes (keeping writes gated by TEACHING_WRITE), and add a class picker to /portal/agenda/week.

### `F0226` [DEGRADED] Weeks are no longer named the way the church names them — ordinal week labels became a date range, and the week dropdown became a date field
- **Role:** servant · **Area:** agenda
- **OG:** ordinalLabel L8159-8162, week list construction L8224-8243, Sunday: select over every week L8528-8531
- **Now:** /portal/agenda — weekLabel() (lib/portal/agenda.ts:85) plus a `<input type="date">` and Previous/This week/Next pills (AgendaTools.tsx)
- **Verified:** Confirmed weekLabel() has no ordinal/month concept, just a date range string; the only week-selection control is the date input. OG confirmed ordinalLabel() plus a dropdown listing every week of the school year by 'Nth Week of MONTH (M/D/YYYY)'.
- **Fix:** Port ordinalLabel and the school-year week list; show the ordinal label alongside the date range, and offer a week dropdown over the school year.

### `F0227` [MOVED] The servant sidebar label "Lesson Preparation" now points at a different feature than it did in the OG
- **Role:** servant · **Area:** agenda
- **OG:** Servant sidebar Planning group, id sv-sbi-ag, label 'Lesson Preparation' -> svLoad('agenda') L4021; agenda header 'Schedule of the Year' L6296
- **Now:** nav.ts line 78 binds 'Lesson Prep' -> /portal/lessons; app/portal/(app)/lessons/page.tsx titles itself 'Lesson Preparation' (metadata + PageHeader)
- **Verified:** Confirmed directly: /portal/lessons page and metadata are literally titled 'Lesson Preparation', while nav.ts labels it 'Lesson Prep' — colliding with the OG's name for the agenda feature, which now sits beside it as 'Schedule of the Year'.
- **Fix:** Rename the /portal/lessons entry/page title to something that does not collide (e.g. 'Lesson Records'), or relabel the agenda entry to reclaim 'Lesson Preparation'.

### `F0490` [MISSING] Week-selection checkboxes + 'Deselect All' + bulk 'Clear Selected Weeks'
- **Role:** servant · **Area:** agenda
- **OG:** Edit List accordion, L19360, L8355-8393
- **Now:** nowhere
- **Verified:** Confirmed independently: grep for checkbox/bulk/Clear-Selected across all agenda page/component files returns zero hits.
- **Fix:** No fast way exists to bulk-clear mistakenly filled weeks; each must be cleared individually via the editor until this is added.

### `F0493` [MISSING] Assign an activity/lead/backup to a servant from another class ('Other Classes' optgroup)
- **Role:** servant · **Area:** agenda
- **OG:** getAgendaServantOptions / buildServantSelectOptions, L8245-8280
- **Now:** lib/portal/data/agenda.ts classServants(classId) L25-35 — single-class query only; no optgroup in AgendaEditor.tsx
- **Verified:** Confirmed classServants queries only the one class's ClassServant rows; grep for optgroup/'Other Classes' in AgendaEditor.tsx returns zero hits. OG confirmed to build 'This Class' + 'Other Classes' optgroups from a sameClass/others split across all servants.
- **Fix:** Add an 'Other Classes' optgroup sourced from all active servants outside the current class, so guest/cross-class servants can still be assigned.

### `F0506` [MISSING] Success toast "Announcement sent!" / "Deleted"
- **Role:** servant · **Area:** announcements
- **OG:** addAnnouncementFB / deleteAnnouncementFB, L9327, L9337
- **Now:** nowhere — AnnouncementManager.tsx shows only error messages, none on success
- **Verified:** Confirmed via full read of AnnouncementManager.tsx (221 lines): create/update/delete/hide all just router.refresh() on success with no confirmation UI at all.
- **Fix:** Add a lightweight success toast/banner on create, update, hide/show and delete, matching the same pattern used elsewhere once a toast component exists.

### `F0201` [MISSING] Servant dashboard "Not Checked In Today" per-student widget is gone
- **Role:** servant · **Area:** attendance
- **OG:** OG servant Dashboard, wCard('absent-today',...) L4394-4415
- **Now:** components/portal/widgets/CheckInWidget.tsx ServantCards — class-level only
- **Verified:** Confirmed CheckInWidget's missing-section logic shows a class only when it has zero attendance records yet today, and disappears the moment one student is marked — the opposite lifecycle of the OG widget, which appears once check-ins have started and lists every student still unmarked. OG confirmed to build exactly the per-student missing list with the 'may still update' footer.
- **Fix:** Add a dashboard widget that, once any attendance exists today for a writable class, lists students on that roster with no PRESENT row yet, with count pill and footer caption, hiding when empty.

### `F0202` [MISSING] Servant dashboard lost the Attendance stat tile, its delta, and the attendance trend chart
- **Role:** servant · **Area:** attendance
- **OG:** Stats row tile 3 L4535-4538, delta rule L4256-4264, rate computation L4217-4233, Chart.js widget L4417-4420
- **Now:** app/portal/(app)/page.tsx StaffHome stat row (Classes/Servants/Students/Open follow-ups); only a per-class 'Sundays (4 wks)' row exists elsewhere
- **Verified:** Confirmed no attendance figure appears in the four staff stat tiles, and grep for Trend/Chart across page.tsx and dashboard.ts returns no chart or delta logic at all.
- **Fix:** Add an Attendance StatCard (rate over the class's real session dates) with a signed delta against the previous session date, and a small trend visualization.

### `F0203` [DEGRADED] The month picker lost the Sep→Aug school-year chips and became a typed month field
- **Role:** servant · **Area:** attendance
- **OG:** Attendance Report month chips, L6249-6262, L6275, L6747-6750
- **Now:** /portal/reports — plain <input type="month"> plus a 'Show report' submit button (ReportFilters.tsx)
- **Verified:** Confirmed ReportFilters.tsx has no chip UI at all, just a native month input and submit button. OG confirmed 12 tappable school-year-ordered chips.
- **Fix:** Render the twelve school-year month chips above the report as links to ?month=YYYY-MM, ordered September→August, highlighting the active one.

### `F0206` [DEGRADED] Student profile attendance tile lost the "N unexcused · N excused" breakdown and the present-streak tile
- **Role:** servant · **Area:** attendance
- **OG:** pAbsentExcused/pAbsentUnexcused L5027-5039, tiles L5081-5086, getConsecutivePresentStreak L16840-16848
- **Now:** /portal/students/[id] — attendance tile hint is just "X of Y"; only tile shown is negative "Missed in a row"
- **Verified:** Confirmed the hint is exactly `${rate.attended} of ${rate.held}` with no excused/unexcused split, and presentStreak() (lib/portal/qr.ts:206) exists in the codebase but is not called from this page — confirming this is a straightforward display fix, not a missing capability.
- **Fix:** Add 'N unexcused · N excused' as the tile sub-label, and restore a present-streak tile using the existing presentStreak() function.

### `F0207` [DEGRADED] Excusing a student now takes three taps on the same card — the ✎ pencil and its reassurance sub-label are gone
- **Role:** servant · **Area:** attendance
- **OG:** ✎ button L5455, reason chips L5462-5467, toggleExcuseRow L12897-12901, setExcuse reassurance text L12903-12915
- **Now:** /portal/classes/[id]/attendance AttendanceTaker.tsx — cycle() tap-cycles ABSENT→PRESENT→EXCUSED→ABSENT; reason chips only shown once already EXCUSED; no reassurance text anywhere
- **Verified:** Confirmed directly in AttendanceTaker.tsx: no dedicated excuse button exists, and grep for 'will not count'/'unexplained' returns zero hits in the file.
- **Fix:** Add a small ✎ button on each card that opens the reason row directly and sets EXCUSED on choice, and add the reassurance sub-label under an excused card.

### `F0445` [MISSING] Global search quick-link to Attendance with contextual subtitle
- **Role:** servant · **Area:** attendance
- **OG:** sv-search-dd quick link, L18705
- **Now:** nowhere
- **Verified:** Confirmed no search/command-palette component exists anywhere in components/portal or app/portal, including Shell.tsx (grep for search/Search returns zero relevant hits).
- **Fix:** Add a global search/quick-jump feature whose Attendance entry mirrors this OG behavior.

### `F0447` [MISSING] Click a trend ring -> per-student week detail
- **Role:** servant · **Area:** attendance
- **OG:** showWeekAttendanceDetail, L18396-18414
- **Now:** nowhere — AttendanceTaker.tsx recentDates.map only navigates between dates
- **Verified:** Confirmed the only use of recentDates in AttendanceTaker.tsx is a navigate() call for switching dates; no roster-breakdown UI exists on click anywhere.
- **Fix:** Bundle with the trend-ring/dashboard chart fix; add an expandable per-student present/absent list for a clicked week.

### `F0453` [MOVED] QR Attendance / QR Points sidebar shortcuts collapsed into one combined item
- **Role:** servant · **Area:** attendance
- **OG:** Two sidebar items, openQRAttendance('attendance')/openQRAttendance('points'), L4013-4014
- **Now:** Single 'QR Check-in' nav item (/portal/qr) in lib/portal/nav.ts, combining both modes in one interface
- **Verified:** Confirmed nav.ts SERVANT case has exactly one QR item, and qr/page.tsx builds a combined attendance+points interface rather than two separate one-click shortcuts.
- **Fix:** Low priority / cosmetic reorganization — flagging for completeness; likely fine as a single combined entry point.

### `F0042` [MISSING] There is no 'View ID' lookup for an existing PIN (architecturally impossible now that PINs are hashed), but the practical goal is already one click away via the existing Reset PIN action
- **Role:** servant · **Area:** auth-login
- **OG:** L3087, L3271, L5076, L3699-L3750, L19366
- **Now:** Reset PIN: app/portal/(app)/students/[id]/StudentProfileActions.tsx + lib/portal/actions/students.ts resetStudentPin lines 107-122; PIN storage: prisma/schema.prisma line 196 (pinHash only, no plaintext)
- **Verified:** Confirmed PINs are stored as pinHash only, so the OG's plaintext lookup is genuinely impossible to restore, as the finding's own fix text acknowledges. Confirmed resetStudentPin keeps the same loginId and only rotates the PIN, and this action is already present and one click away. Downgraded from high: the actual church need (get a family a working login) is fully achievable today in one click; the only loss is being unable to view an *unchanged* PIN a family merely misplaced, which forces an unnecessary rotation — real friction, not a blocked task.
- **Fix:** Add a 'Send login details' action that resets the PIN and immediately renders a copy/mailto-ready message with the new ID+PIN in one step, so the one click both fixes the login and produces text to send.

### `F0243` [DEGRADED] The topbar birthday chip omits servants, but the full Birthdays page already includes them correctly
- **Role:** servant · **Area:** birthdays
- **OG:** L1765-1769, L1789, L1793
- **Now:** lib/portal/data/dashboard.ts computeNextBirthday lines 183-200 (student-only); app/portal/(app)/birthdays/page.tsx lines 85-99 (already queries both prisma.student and prisma.servant)
- **Verified:** Confirmed computeNextBirthday queries only prisma.student with no servant branch, exactly as claimed. Downgraded from high: independently confirmed the full /portal/birthdays page already does the correct merged student+servant query one click away, so the data is not lost or hard to find — only the small at-a-glance topbar chip is incomplete. That's friction on a decorative summary, not a blocked task.
- **Fix:** Query prisma.servant alongside prisma.student in computeNextBirthday (mirroring birthdays/page.tsx lines 93-99), merge the two lists by date, and append '(servant)' to servant names in BirthdayChip.

### `F0250` [MISSING] Today's birthday is no longer visually escalated anywhere on the Birthdays page
- **Role:** servant · **Area:** birthdays
- **OG:** isToday branch, L14907, L14932, L14938, L14946-14949
- **Now:** /portal/birthdays — every tile in the This-week card uses the same CakeTile tone="now" styling; date always renders via formatShortDate, never "Today"
- **Verified:** Confirmed CakeTile is called uniformly with tone="now" for every entry with daysUntil<=6, with no daysUntil===0 branch anywhere in birthdays/page.tsx. Judged this as informational (identifying which specific child to celebrate today) rather than purely cosmetic polish, so kept at medium rather than downgrading to low.
- **Fix:** Add an isToday branch to CakeTile: amber border/gradient, a 🎉 marker, and a 'Today · <date>' label using the existing formatMonthDay helper.

### `F0251` [DEGRADED] Servants on the Birthdays page are demoted to a trailing card with no age, no week grouping, and no visual distinction
- **Role:** servant · **Area:** birthdays
- **OG:** role filter L14886/14892, servantPalette/SERVANT badge L14933-14944, violet border L14951-14953
- **Now:** /portal/birthdays — a separate 'Servants' Card rendered last, using generic PersonTile with no turning (age) prop passed
- **Verified:** Confirmed the Servants card passes no turning prop and uses identical styling to the month-group PersonTiles, with no purple badge/palette anywhere. OG confirmed servants interleaved inline with students in date order, with a distinct purple badge, palette, and age pill.
- **Fix:** Merge servantRows into the same date-sorted list as studentRows with an isServant flag, pass turning, and give servant tiles the OG's purple badge/palette.

### `F0252` [BROKEN] The topbar birthday chip is cached for an hour against a tag nothing ever revalidates
- **Role:** servant · **Area:** birthdays
- **OG:** loadNextMeetingCard refetched on every shell render, L1758-1804 with call sites L2728/4056/11614/15275
- **Now:** lib/portal/data/dashboard.ts:172-180 nextBirthdayForTopbar, unstable_cache with tags:['portal-topbar-birthday'], revalidate:3600
- **Verified:** Confirmed via grep that 'portal-topbar-birthday' appears in exactly those two lines and nowhere else in the codebase — no revalidateTag call exists. Also confirmed app/portal/(app)/layout.tsx line 17 already sets export const dynamic = 'force-dynamic', making the unstable_cache layer redundant on an already-dynamic page.
- **Fix:** Call revalidateTag('portal-topbar-birthday') from student/servant create/update actions, or simply drop the cache since the page is already force-dynamic.

### `F0508` [MISSING] "Next Week" dedicated section with its own header + date range
- **Role:** servant · **Area:** birthdays
- **OG:** Next Week card, L6111-6120
- **Now:** nowhere as a distinct section — those people are folded into month-grouped cards; individual tiles do get a 'Next week' text label via PersonTile's away calculation
- **Verified:** Confirmed birthdays/page.tsx has only a 'This week' (<=6 days) card and then month-grouped cards, no separate Next-Week bucket with its own Mon-Sun header. OG confirmed a full dedicated 'Next Week' card styled distinctly from 'This Week'.
- **Fix:** Add a distinct 'Next week' bucket/card with its own Mon-Sun date-range header, matching the OG's three-tier layout.

### `F0511` [DEGRADED] "All Students" full-roster section, no time cutoff
- **Role:** servant · **Area:** birthdays
- **OG:** All Students section, L6120-6127
- **Now:** birthdays/page.tsx uses upcomingBirthdays(...,60), capped to a 60-day window
- **Verified:** Confirmed lib/portal/birthdays.ts line 24: `if (daysUntil > windowDays) continue`, called with windowDays=60. Any birthday more than 60 days out is silently excluded from the entire page, not just a section.
- **Fix:** Either raise the window substantially or add a true full-roster table sorted by nearest birthday with no cutoff, as the OG had.

### `F0513` [MISSING] Students with no DOB on file, shown greyed-out with explicit 'No birthday on file' label
- **Role:** servant · **Area:** birthdays
- **OG:** noDobRows, L6097-6104
- **Now:** nowhere — silently dropped by upcomingBirthdays()'s `if (!p.dob) continue`
- **Verified:** Confirmed lib/portal/birthdays.ts line 24 drops any student with no dob entirely; they never appear on the page in any form. OG confirmed a dedicated 45%-opacity 'No birthday on file' row for these students.
- **Fix:** Surface a 'missing birthdate' list/count on the Birthdays page so data-entry gaps stay visible to servants.

### `F0247` [MISSING] Sidebar "Birthdays" nav item lost its this-week count badge
- **Role:** servant · **Area:** birthdays
- **OG:** index.stripped.html L4025 (#bday-badge span) and L17097-17124 (refreshBirthdayBadge)
- **Now:** lib/portal/nav.ts NavItem interface (no badge field) and components/portal/Shell.tsx nav renderer (icon+label only)
- **Verified:** Confirmed by full read of both files — no badge slot exists in the type or the renderer. Downgraded from high to medium because the same count is still fully visible via /portal/birthdays (always in the sidebar) and the dashboard's 'Upcoming birthdays' card for staff — nothing is actually hidden, just less glanceable.
- **Fix:** Add badge?: number to NavItem, render it in Shell.tsx, populate it in navForUser using data the layout already computes.

### `F0335` [DEGRADED] Stat tile: Attendance % (all session types combined, last 60 sessions)
- **Role:** servant · **Area:** classprofile
- **OG:** computeClassAttendanceRate over all attendance docs, L4713 (query), L4836 (call)
- **Now:** classes/[id]/page.tsx 'Sunday rate' stat, prisma query filtered to sessionKey:'sunday' only (line 41)
- **Verified:** Confirmed the prisma query is `where: { classId, sessionKey: 'sunday' }`. OG confirmed to query all attendance docs for the class with no session filter, then average across all of them.
- **Fix:** Add the all-sessions average back as a separate tile, or clearly relabel the current tile to make the Sunday-only scope explicit.

### `F0336` [DEGRADED] Stat tile: Points (Total Awarded, sum)
- **Role:** servant · **Area:** classprofile
- **OG:** cpTotalPts, sum of all points, L4799 (computation), L4837 (display, labeled 'Total Awarded')
- **Now:** classes/[id]/page.tsx line 94 shows 'Avg points' (per-student average) instead of the class-wide total
- **Verified:** Confirmed directly: the tile shows a per-student average, not a sum. OG confirmed cpTotalPts is a straight sum across all students, explicitly labeled 'Total Awarded'.
- **Fix:** Show the class-wide total (or show both total and average) instead of only the average.

### `F0341` [MISSING] "Reading Check-in" card (Bible-reading streak drop-off alerts) missing, no substitute anywhere
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html compute L4762-4791 (≥3-day streak, quiet ≥3 days), render L4864-4875
- **Now:** nowhere — BibleReadingLog table exists in prisma/schema.prisma but nothing reads it for this purpose
- **Verified:** Unlike the other class-profile cards in this group, this signal has no substitute anywhere else in the new portal — the only genuinely unique loss among the five class-profile findings.
- **Fix:** Port the drop-off computation onto the class page or a Bible-reading report.

### `F0332` [MOVED] No direct "Class Profile" sidebar entry — servants reach their class one extra click away, via "My Classes"
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html L4008 (sv-sbi-cp, onclick=svLoad('classprofile'))
- **Now:** lib/portal/nav.ts SERVANT case (only '/portal/classes' → My Classes); app/portal/(app)/classes/page.tsx always shows a class grid, then app/portal/(app)/classes/[id]/page.tsx has the roster/stats content
- **Verified:** Confirmed by full read of nav.ts (no Class Profile item) and classes/page.tsx (no auto-redirect even for a single class). Downgraded from high to medium: the destination content is intact and is only one extra click away (the servant's one class is the only card shown), so this is friction, not a 'can't find/do it' problem.
- **Fix:** Add a dedicated nav item pointing straight at the servant's own class, or accept the one-extra-click list as intentional.

### `F0333` [MOVED] "Print QR Codes" button removed from the class page, relocated to the QR Check-in hub
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html L4830 (onclick=svLoad('printqr') inside the classprofile panel header)
- **Now:** app/portal/(app)/classes/[id]/page.tsx header (confirmed absent); present instead at app/portal/(app)/qr/page.tsx as both a 'Print QR cards' header action and tab, linking to /portal/qr/cards; 'QR Check-in' is a top-level sidebar item for every servant
- **Verified:** Confirmed by full read of classes/[id]/page.tsx (no print-QR control) and qr/page.tsx (clearly labelled action + tab). Downgraded from high to medium: this is a relocation to a well-known, always-visible destination, not a capability loss.
- **Fix:** Add the link back onto the class detail page header if a one-click shortcut is wanted, or leave as-is and note the new location for servants.

### `F0081` [MISSING] "Top Performing Students" dashboard widget gone — no quiz-average ranking anywhere
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L4291-4305 (MIN_EXAMS_FOR_RANKING=2, tie-break by exam count), L4459-4469 (medal render)
- **Now:** nowhere — only per-student quiz averages exist (lib/portal/reports.ts ReportCard.quizAverage), never an aggregated top-N ranking widget
- **Verified:** Verified true and unique — no dashboard widget or leaderboard tab ranks by quiz average anywhere in the new portal.
- **Fix:** Add a dashboard widget and/or leaderboard tab ranking by mean QuizResult.percentage, min 2 exams, ties broken by exam count.

### `F0082` [MOVED] Dashboard "Recent Activity" feed gone — moved to per-class Points page, no church-wide version
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L4310-4311 (latest 5, per-class), L4482-4496 (render); church-wide twin via buildChurchWideWidgets (latest 6)
- **Now:** /portal/classes/<id>/points — per-class history only; StaffHome dashboard has no activity-feed widget for any role
- **Verified:** Confirmed as stated: the per-class version exists, but no church-wide equivalent exists anywhere for admin/pastor's dashboard.
- **Fix:** Re-add a Recent Activity card to the dashboard widget column (per-visible-class for servant, church-wide latest 6 for admin/pastor); keep the per-class Points-page card too.

### `F0089` [DEGRADED] Topbar "Birthdays This Week" chip degraded — one name, servants dropped, class-scoped, hidden for students/when empty
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html loadNextMeetingCard L1758-1804, called with classId=null (truly church-wide) on every portal
- **Now:** components/portal/BirthdayChip.tsx + lib/portal/data/dashboard.ts computeNextBirthday, wired in app/portal/(app)/layout.tsx:31-33
- **Verified:** Verified point by point: hidden for STUDENT role (confirmed), students-only query with no servant/Account birthdays unioned (confirmed), scoped via listVisibleClasses rather than church-wide for a servant (confirmed), rolling 7-day window from today rather than an ET Monday–Sunday calendar week (confirmed, a real difference), returns only the single soonest person with no count (confirmed). Note: the dashboard body already has a separate, richer 'Upcoming birthdays' Card (page.tsx ~line 148, up to 8 people) for staff, which tempers real-world impact but doesn't change that the topbar chip itself is accurately described as degraded.
- **Fix:** Widen to the ET week, union student+servant birthdays, church-wide scope, full list with 0/1/2+ display states including 'No birthdays this week'; also render for STUDENT.

### `F0357` [MOVED] Aggregate attendance-rate stat + week-over-week delta arrow gone from top-level dashboard
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html getClassSessionDates(dashAttDocs,60) 60-session cap; attWeekDelta trending arrow at L4538 area
- **Now:** app/portal/(app)/page.tsx (~line 98) ClassCard row 'Sundays (4 wks)' — per-class only, 4-week window, no delta
- **Verified:** Confirmed: both the dashboard-level aggregation and the delta arrow are genuinely gone, replaced by a narrower per-class figure.
- **Fix:** Surface an aggregate attendance-rate stat card on the dashboard again, or restore the week-over-week delta on the per-class card.

### `F0358` [MISSING] Dashboard Exams stat tile ("N exams · N active") gone
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L4541, stat tile: allExams.length + activeExamsCount ('N active'/'No active exams')
- **Now:** nowhere — app/portal/(app)/page.tsx StatCard row is Classes/Servants/Students/Open follow-ups; ExamsWidget is a separate list with a different metric
- **Verified:** Confirmed true gap. F0029 in this same batch describes the identical widget from the domain source — see duplicate note there.
- **Fix:** Add exam totals to staffOverview and a fifth StatCard on the staff dashboard.

### `F0364` [MISSING] 'Student Reports' quick-action tile missing, no dashboard-level substitute
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html ~L4570-4573, among the same 5 quick-action tiles (cited L361-365 is unrelated CSS)
- **Now:** nowhere on the dashboard; reachable only via sidebar nav → Reports/Church Reports (lib/portal/nav.ts, confirmed present for every staff role)
- **Verified:** Unlike Attendance, there is no other one-click path to Reports from the dashboard — only the sidebar, one extra click.
- **Fix:** Add a Reports quick-action tile back to the dashboard for staff.

### `F0365` [MISSING] 'Not Checked In Today' widget missing
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html L4394-4425, absentTodayList, shown only once ≥1 activity logged today
- **Now:** nowhere — confirmed no such widget under any name in components/portal/widgets/
- **Verified:** Confirmed a true, clean gap.
- **Fix:** Add an absentee-today widget to the servant dashboard.

### `F0369` [DEGRADED] 'Upcoming Lessons' widget shows only 1 lesson instead of top 3
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html upcomingLessons sliced to 3 at L4272, 'View all' link to curriculum at L4447
- **Now:** components/portal/widgets/LessonsWidget.tsx — renders only nextPlannedLesson (singular), inside a combined 'This week in class' card; 'All assignments' link goes to /portal/assignments, not a lessons list
- **Verified:** Confirmed exactly as stated by reading the component.
- **Fix:** Show the next 2-3 upcoming lessons, not just one, matching the OG's list.

### `F0310` [MOVED] Event card Edit/Delete moved from header to bottom of card, under Share row
- **Role:** servant · **Area:** events
- **OG:** index.stripped.html header-row pencil/trash buttons next to poster name (L15033 region), handlers L15083-15095
- **Now:** app/portal/(app)/events/page.tsx EventRow → EventManager.tsx, edit/delete controls render last, after notes and the Share/WhatsApp/Email row
- **Verified:** Confirmed by reading both files — controls are genuinely at the bottom now, not the header.
- **Fix:** Move EventManager's edit/delete controls into the poster row, right-aligned, matching the OG.

### `F0312` [BROKEN] 'Add event' form renders inside the dark maroon header banner instead of below it
- **Role:** servant · **Area:** events
- **OG:** index.stripped.html add-form div is a sibling of the header div (closes header </div>, then opens a separate #sch-add-form div), confirmed at all 3 cited call sites
- **Now:** EventManager.tsx's non-editing branch returns a Card as PageHeader's actions prop (page.tsx:205); PageHeader (ui.tsx:51) renders actions inside its bg-brand-950 dark banner div
- **Verified:** Confirmed: Card is a light cream box (bg-parch-50, ui.tsx:113-150), so opening it nests a full form inside the dark header banner, ballooning its height and looking out of place — a genuine layout defect, not cosmetic.
- **Fix:** Keep only the trigger button in actions; render the open form Card as a sibling in the page body above the event list.

### `F0313` [DEGRADED] Servant event 'Directed To' list narrowed to own classes; classless servants lose Add Event entirely
- **Role:** servant · **Area:** events
- **OG:** index.stripped.html buildDirectedToSection L14721-14733 (unfiltered getDocs over all classes, no role check); unconditioned Add Event button L5547-5548
- **Now:** app/portal/(app)/events/page.tsx — targetable filtered to user.classIds for non-admin/pastor; canCreate false when that list is empty for a SERVANT
- **Verified:** Confirmed both halves of the claim by reading the page's targetable/canCreate logic.
- **Fix:** Widen targeting to scope.classes (including stage oversight); always render Add Event for a servant, falling back to an inline message when they have no class.

### `F0033` [MISSING] AI vs Manual exam-provenance badge gone; schema has no field to hold it
- **Role:** servant · **Area:** exams
- **OG:** index.stripped.html L5230 (row render: aiGenerated ? 'AI' : 'Manual')
- **Now:** prisma/schema.prisma Exam model (lines 529-552) has no aiGenerated/source/importedFromCsv field of any kind; ExamsFilter.tsx's ExamCard shows only subject + question count
- **Verified:** Confirmed by reading the full Exam model — the field genuinely does not exist, so this is unrenderable even if the UI were restored.
- **Fix:** Add a provenance field to the Exam model and set it in the CSV importer; render a small marker on exam cards.

### `F0034` [MISSING] Exam due-date input no longer blocks picking a past date
- **Role:** servant · **Area:** exams
- **OG:** index.stripped.html #ex-due input has min set to today-in-ET
- **Now:** app/portal/(app)/exams/new/ExamEditor.tsx:200 — plain date input, no min attribute; lib/portal/actions/exams.ts parseDue only checks parseability, not date-vs-today
- **Verified:** Confirmed by reading both the form and the server action.
- **Fix:** Set min={todayInNewYork()} on the create form's due-date input; warn (don't block) server-side for an already-past date.

### `F0477` [MISSING] 'Select All' checkbox missing from exam bulk-actions toolbar
- **Role:** servant · **Area:** exams
- **OG:** index.stripped.html #exam-select-all checkbox L5195, toggleAllExamSelect L11252
- **Now:** app/portal/(app)/exams/ExamsFilter.tsx ExamsTable — only a 'Clear' button once something is selected; only per-card checkboxes exist
- **Verified:** Confirmed by reading the full ExamsTable component.
- **Fix:** Add a master 'Select all' checkbox to the bulk-actions bar.

### `F0479` [MISSING] Exam list has no month grouping/accordion; one flat scrolling grid
- **Role:** servant · **Area:** exams
- **OG:** index.stripped.html examGroups/groupOrder build L5204-5254, toggleExamMonthGroup L11257
- **Now:** app/portal/(app)/exams/ExamsFilter.tsx ExamsTable — rows.map(...) straight into one flat grid, no bucketing in this file or lib/portal/data/exams.ts
- **Verified:** Confirmed; a class running frequent quizzes will accumulate a long unbroken scroll.
- **Fix:** Restore month-accordion grouping, or add a month filter as a lighter-weight alternative.

### `F0483` [MISSING] Creating a second exam for the same due date now duplicates instead of merging
- **Role:** servant · **Area:** exams
- **OG:** index.stripped.html same-day merge logic L11207-11224 (match classId+dueDate, merge questions via updateDoc)
- **Now:** lib/portal/actions/exams.ts createExam (lines 73-104) always prisma.exam.create, no prior lookup for an existing same-date exam
- **Verified:** Confirmed by reading createExam in full — no query for an existing exam precedes the create call.
- **Fix:** Decide intentionally whether to keep the new one-exam-per-batch behavior or restore merging; currently the change is silent.

### `F0484` [DEGRADED] CSV exam import now requires a full Due Date per row instead of Month/Year + bare day number
- **Role:** servant · **Area:** exams
- **OG:** index.stripped.html Month+Year dropdown + shared Points field, bare day-of-month CSV rows, L5343-5361
- **Now:** app/portal/(app)/exams/import/ExamImport.tsx SAMPLE constant (lines 24-27) uses a full Due Date column per row; no month/year/points convenience inputs
- **Verified:** Corrected state from MISSING to DEGRADED: the finding's own text calls this 'a deliberate format redesign, not an oversight,' which is accurate — the import feature works end-to-end, it just requires a different (more verbose) CSV shape, so it is a workflow change, not a lost capability.
- **Fix:** Document the new format for servants, or add a month/year convenience mode back for classes that still do daily bare-day-number quizzes.

### `F0024` [MISSING] Same-due-date exam auto-merge is gone — creates a duplicate exam record instead, but Edit remains a working alternative path
- **Role:** servant · **Area:** exams
- **OG:** Servant → Exams → Create New → Save Exam, index.stripped.html L11207-11226 (merge branch scanning classId+dueDate), L11227-11244 (create-only fallback)
- **Now:** /portal/exams/new → createExam, lib/portal/actions/exams.ts:80-97 — always `prisma.exam.create`, no same-day lookup
- **Verified:** Confirmed OG's merge scan and append-questions logic exactly as cited, and confirmed createExam has zero lookup before insert. However, the new portal also has a proper single-exam Edit flow (/portal/exams/[id]/edit) that the OG's merge was effectively working around; a servant adding more questions to the same day's quiz can use Edit instead of Create. Worst case of the regression is a visible, deletable duplicate exam record for one date — a data-hygiene annoyance, not lost or corrupted data, and not a blocked task.
- **Fix:** Either look up an existing same-classId/same-dueDate exam before creating and append (matching OG), or, if the team prefers explicit separate exams, add a warning in the create form when an exam already exists for that date pointing the servant to Edit instead.

### `F0486` [MISSING] Separate "Bible Reading File" CSV auto-parser (crammed weekly-email format) gone; reading text must now be typed per question row
- **Role:** servant · **Area:** exams
- **OG:** index.stripped.html L5364-5375 (upload UI + template), L16405-16503 (csvReadingsPreview/auto-parse), L17683+ (template)
- **Now:** app/portal/(app)/exams/import/ExamImport.tsx — one CSV input; sample header is `Title,Subject,Due Date,Bible Reading,Question,...`, Bible Reading typed per row
- **Verified:** Confirmed: grep for csvReadingsPreview/autoParseCrammedCell/'Daily Bible Reading' across app and lib returns zero hits, and readingMessage is not even part of the CSV import schema (only the manual single-exam form). This is a real, admitted weekly time-saver loss. Downgraded from high because it's an optional field on an optional workflow — a servant can still create and administer exams without it, just with more manual typing.
- **Fix:** Rebuild a 'paste the weekly reading email' helper that auto-detects the church's crammed cell format or a structured Day/Reading/Message CSV and matches by day number, as a second optional upload in ExamImport.tsx.

### `F0275` [DEGRADED] Pin checkbox gone from New Post composer; action already supports it, only the UI and edit path are missing it
- **Role:** servant · **Area:** feed-posts
- **OG:** index.stripped.html #fd-pin checkbox in composer (L5518-5519), #edit-fd-pin in Edit modal (L13793/13816)
- **Now:** app/portal/(app)/feed/FeedComposer.tsx has no pinned field at all; lib/portal/actions/feed.ts createPost's schema DOES accept pinned (used) but UpdateSchema explicitly omits it; PostCard.tsx has a post-hoc Pin/Unpin button instead
- **Verified:** Confirmed precisely — including that the create action already supports pinned, so this is a pure UI/schema-omission gap, not missing plumbing.
- **Fix:** Add the pinned checkbox to FeedComposer's form and JSX; stop omitting pinned from UpdateSchema so editing can change it too.

### `F0272` [MISSING] YouTube links in feed posts no longer render as a playable thumbnail card (link still opens correctly)
- **Role:** servant · **Area:** feed-posts
- **OG:** Class feed post card, index.stripped.html L13613-13629 (regex id extraction, 280x158 thumbnail, scrim, play button, YouTube badge)
- **Now:** app/portal/(app)/feed/PostCard.tsx — post.link always renders as a plain "Open link" pill; no URL inspection anywhere in the file
- **Verified:** Confirmed the OG regex/thumbnail/scrim/badge sequence and confirmed PostCard.tsx does no link parsing at all. Downgraded from high: the link still works and opens the video fine on click; what's lost is the visual preview/engagement affordance, which is closer to a presentation regression than a functional block.
- **Fix:** In PostCard.tsx, extract the 11-char video id with the same regex; when it matches, render the img.youtube.com/vi/<id>/hqdefault.jpg thumbnail with scrim/play button/badge above the byline, and suppress the plain link pill and post.imageUrl for that post, exactly as OG's three branches do.

### `F0098` [MISSING] A follow-up case can never be deleted — only logged, resolved, or reopened
- **Role:** servant · **Area:** followups
- **OG:** OG trash button (17253), swipe delete panel (17241), deleteVisitationCase (17534-17543), pastor rows (17570, 17583), deleteSelectedHistCases (17520-17532)
- **Now:** lib/portal/actions/followups.ts exports only logContact, resolveCase, reopenCase, createManualCase (grep confirms no delete/remove export); app/portal/(app)/follow-ups/[id]/CaseActions.tsx offers only Log a contact / Mark resolved / Reopen case
- **Verified:** Confirmed by reading both the actions file and the client component in full — there is genuinely no delete path anywhere in the new follow-ups code. Severity corrected from blocker to medium: the actual weekly pastoral-care workflow (log a contact, resolve when the student returns) is fully supported; the gap is data hygiene — a case created in error (e.g. wrong student) has no way to be removed and lingers in closed-case history forever. Not a blocker to any weekly task.
- **Fix:** Add a deleteCase server action (admin-only, or admin+the case's own class servant) and a delete button on the case page, gated behind a confirm dialog, matching the OG's intent even if not its exact four entry points.

### `F0113` [MOVED] Resolved-case history moved to a toggle view, lost Select All/Clear/multi-select/bulk-delete
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html History card on the same page as open list (L17264-17296), Select All/Clear/delete-bar helpers (L17485-17532)
- **Now:** app/portal/(app)/follow-ups/page.tsx — a show=done query param toggles/replaces the same list; no selection state, no avatars; confirmed no delete action exists at all in lib/portal/actions/followups.ts
- **Verified:** Confirmed both that it replaces rather than appends, and that bulk delete has no backing action yet to restore.
- **Fix:** Render resolved as a second section below open (not a toggle); a delete action would need to be built before bulk-delete can return.

### `F0114` [DEGRADED] 'Last seen'/'No attendance recorded' dropped from the case list row (data exists, just not selected)
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html sub-line pattern combining consecutiveAbsences/Manual + lastSeen/'No attendance recorded'
- **Now:** app/portal/(app)/follow-ups/page.tsx list select (lines 32-37) omits lastSeen; it IS written on case-open (lib/portal/actions/attendance.ts:138-139) and IS rendered, but only on the case detail page (follow-ups/[id]/page.tsx)
- **Verified:** Confirmed the data isn't lost, only unfetched for the list view; the exact phrase 'No attendance recorded' appears nowhere in the new portal.
- **Fix:** Add lastSeen: true to the list select and render the OG's sub-line, including the AUTO/no-lastSeen branch.

### `F0115` [DEGRADED] Absence look-back window is unbounded, inflating 'N missed' beyond the OG's display ceiling
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html getSundaySchoolSessionDates(...,maxCheck||8) pattern, callers pass Math.max(threshold+4,8)
- **Now:** lib/portal/attendance-rules.ts absenceStreakAgainst (lines 34-46) unions every held date since the student's first record, no cap; caller (actions/attendance.ts:110-114,127) queries all held dates with no take/date filter
- **Verified:** Confirmed uncapped. Worth noting the new number is a true count, not fabricated — it diverges from the OG's arbitrary display ceiling rather than corrupting data, so this is a display/expectation mismatch rather than a data-integrity bug; kept at medium.
- **Fix:** Cap the held-date list to max(threshold+4,8) most recent sessions before scoring, matching the OG.

### `F0099` [MISSING] "Send a Message" templated outreach modal (channel + contact picker + mailto/wa.me) gone; direct tel:/mailto: contact links remain
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html L17251 (Send button), L17340-17416 (openSendMessageModal/selectSendChannel/selectSendContact/sendMessageNow), markup L19675-19706
- **Now:** nowhere — confirmed no template text, no contact-picker UI, and no mailto:/wa.me construction anywhere under app/portal/(app)/follow-ups
- **Verified:** Confirmed the OG's exact template string, contact-list construction (student/parent email or phone) and mailto:/wa.me handoff. Confirmed nothing in the new follow-ups pages composes a message body. Downgraded from high because the case detail page already surfaces plain tel:/mailto: links for the parents (see F0102's evidence), so a servant can still reach the family directly — what's lost is the guided template and channel/contact picker, which is real friction but not a blocked task.
- **Fix:** Add a client 'Send a message' component on the case page reproducing the three steps (channel, contact radio list built from student+parent contacts, prefilled/editable template) and window.open to mailto:/wa.me — no server action needed, matching the OG's client-only implementation.

### `F0101` [MISSING] Student's own phone is stored but never surfaced anywhere; the student's own "email" was deliberately folded into parentEmails during migration, not orphaned
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html L17228 (phoneMap from s.phone), L17249-17250 (tel:/wa from that number), L17369+L17376 (Student's Email / Student's Phone first in contact picker)
- **Now:** Account.phone is selected in lib/portal/data/students.ts:23 but a repo-wide grep for `.account.phone`/`.account.email` usage returns zero hits — never rendered anywhere. StudentForm.tsx has no field to enter a student's own phone/email at all.
- **Verified:** Verified the phone claim is accurate: import-transform.ts keeps `base.phone = normalizePhone(u.phone)` on the student's Account row during migration, and it is genuinely dead data (queried, never displayed, never editable going forward). The email claim is not accurate as stated: import-transform.ts explicitly sets `base.email = null` for every student and merges the OG's email field into parentEmails, with an explicit comment that it's 'almost always a parent's address' — a deliberate, reasoned migration decision, not an accidental loss. Only phone is genuinely orphaned data.
- **Fix:** Add `account: { select: { phone: true } }` to the follow-up case and student-profile queries and render it as a contact option (labelled 'Student's phone'), and add a phone field to StudentForm so new students can have one entered. Do not re-add a 'student's email' contact option — the data model correctly treats that as the parent's email.

### `F0102` [DEGRADED] Inline call/message/Send/log/delete removed from follow-up case rows — every contact now costs one extra page load
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html L17249-17253 (servant row action cluster), L17567-17570 (pastor row action cluster)
- **Now:** /portal/follow-ups → page.tsx row action slot (~lines 101-109) and body (~144-148): two badges and a single "Open case" LinkButton, nothing else
- **Verified:** Confirmed exactly — no tel:, no wa.me, no inline log form, no delete on the list row; everything moved one navigation away to /portal/follow-ups/[id]. Downgraded from high: this is friction on a frequent task, but it doesn't block completing it — CaseActions.tsx on the detail page has a working log-contact/resolve flow.
- **Fix:** Restore an inline action cluster on each list row (tel:, WhatsApp, a compact 'log follow-up' that opens a small dialog against the existing logContact action, delete), keeping the detail page for full history.

### `F0103` [MOVED] Per-class absence threshold moved from the Follow-up page header to Admin → Manage Classes; servants lost write access to it
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html L17276-17278 (header input + Save), L17473-17483 (saveVisitThreshold)
- **Now:** /portal/admin/classes → ClassManager.tsx:116, ADMIN-only per lib/portal/nav.ts (confirmed 'Manage Classes' appears only in the ADMIN case, not SERVANT)
- **Verified:** Confirmed both the OG header placement and the new portal's admin-only gating exactly as claimed, with no cross-link from /portal/follow-ups. Downgraded from high: this is an infrequently changed setting (set once per class, rarely revisited), so losing self-service here is real but low-frequency friction rather than a weekly blocker.
- **Fix:** Add the threshold control back to the Follow-ups page header, gated on followup.write for that classId (same access check the OG used), and keep the admin editor as the bulk/overview view.

### `F0106` [DEGRADED] Manual case creation lost the Type taxonomy and a custom open date; "Result" and "Next follow-up date" survive one step later, not at creation
- **Role:** servant · **Area:** followups
- **OG:** index.stripped.html L17418-17427 (open modal), L17431-17470 (save, including the 'born resolved' branch), markup L19888-19933
- **Now:** /portal/follow-ups → NewCaseForm.tsx (Student, title, details only). Result/Next-follow-up exist one step later on CaseActions.tsx's "Log a contact" and "Resolve" cards on the case detail page.
- **Verified:** Confirmed NewCaseForm.tsx has no caseType, and confirmed `FollowUpCase` in prisma/schema.prisma has no caseType column at all — the 7-option Type taxonomy is genuinely missing from the whole system, not just the form. But Result and Next Follow-up Date are not wholly gone as originally stated: CaseActions.tsx's Log-a-contact form has a working 'next follow-up' date input, and its Resolve form has a working reason+note flow — both reachable immediately after creating the case. What's genuinely lost is a custom opened-on Date (always server 'now') and the OG's 'born already resolved' shortcut (Result=resolved at creation skips ever showing as open).
- **Fix:** Add a `caseType` field to FollowUpCase and the create form/schema (the 7 OG values). Add an optional opened-on date override. Add a 'mark as already resolved' checkbox on NewCaseForm that calls resolveCase right after creation, reproducing the OG's born-closed path, without needing to duplicate the Result/Next-follow-up fields that already exist on the detail page.

### `F0410` [MISSING] Leaderboard sort toggle (A–Z/Highest/Lowest) missing
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html setLeaderboardSort buttons L5758-5760, function L9567
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx — no sort state or controls; grid order fixed to server-provided rank
- **Verified:** Confirmed by reading the full component; the only Select all/Clear pair present is unrelated (point-giving selection).
- **Fix:** Add A-Z/Highest/Lowest sort controls above the leaderboard grid.

### `F0412` [MISSING] No per-card 'view profile' shortcut on the points-page leaderboard cards
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html openStudentProfile button L5831 ('View profile' title), function L9968
- **Now:** PointsPanel.tsx's leaderboard card is entirely one selection button; the only profile link (/portal/students/[id]) is on the separate /portal/leaderboard page
- **Verified:** Confirmed both halves by reading each file.
- **Fix:** Add a small profile-link icon/button on each leaderboard card in PointsPanel.tsx.

### `F0418` [DEGRADED] Points history hard-capped at 60 rows, no pagination
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html renderPointsHistoryPage loads every points doc for the class, no cap
- **Now:** app/portal/(app)/classes/[id]/points/page.tsx:27 take: 60, no load-more control anywhere in PointsPanel.tsx
- **Verified:** Confirmed by reading the query and the panel component.
- **Fix:** Add pagination or a 'load more' control instead of a hard 60-row cap.

### `F0419` [MISSING] History search box "Search by student name or reason…" ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** Live-filters history rows
- **Now:** nowhere
- **Fix:** Add a search input above the Recent activity list filtering by student/reason client-side.

### `F0420` [MISSING] History filter chips: All / Added Points / Removed Points ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** Quick filter by transaction sign
- **Now:** nowhere
- **Fix:** Add All/Added/Removed filter chips above the history list.

### `F0421` [MISSING] History "Group by" dropdown: Flat List / By Student / By Date / By Servant ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** Regroups the same rows into per-student, per-date or per-servant sections with subtotals
- **Now:** nowhere (always flat)
- **Fix:** Add the group-by select and grouped rendering with subtotal headers.

### `F0423` [DEGRADED] Undo button with confirm dialog ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** confirm('Undo "X" (±N pts)? This will add a reversing entry…') before undoing
- **Now:** PointsPanel.tsx:72-78 `undo()` calls undoPoints() immediately, no confirmation
- **Fix:** Add a confirmation step (native confirm or styled dialog) before calling undoPoints().

### `F0424` [DEGRADED] Undo works on any non-undone entry, including attendance-sourced points ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** No source restriction in undoPointFB
- **Now:** lib/portal/points-math.ts:30 canUndo() returns false when source==='ATTENDANCE'; those rows never show Undo
- **Fix:** Either allow undo for attendance-sourced entries too, or clearly explain in the UI that attendance points must be reversed by toggling attendance instead.

### `F0404` [MOVED] Top-level sidebar "Points" item for servants gone — now two taps deep via My Classes
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html L4016 (sv-sbi-gr, always-visible top-level sidebar icon)
- **Now:** lib/portal/nav.ts SERVANT array (full read, lines ~69-92) has no points/grades entry; reachable via app/portal/(app)/classes/[id]/page.tsx:84 "Points" button
- **Verified:** Confirmed both the OG's top-level placement and the absence from the new SERVANT nav array. Downgraded from high: most servants have exactly one class, so this is two extra taps, not a lost capability — still fits the calibration's 'will not find it' concern for a new servant, but not enough to block the weekly point-giving task once learned.
- **Fix:** Add a top-level 'Points' sidebar item for SERVANT in lib/portal/nav.ts that resolves directly to the servant's own class's points page when they have exactly one class.

### `F0408` [MISSING] Per-activity Edit (pencil) button gone — fixing a typo'd activity requires delete + recreate
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html L5738 (edit button), L10727-10756 (modal + save)
- **Now:** nowhere — lib/portal/actions/points.ts exports only givePoints/undoPoints/createActivity/removeActivity; PointsPanel.tsx has no edit affordance
- **Verified:** Confirmed no updateActivity action exists and no pencil icon in PointsPanel.tsx. Checked the data-loss risk: PointEntry.activityLabel is a frozen text snapshot, not a foreign key to PointActivity, so deleting and recreating an activity does not corrupt or lose historical point records. Downgraded from high: this is friction (extra steps to fix a typo), not data loss.
- **Fix:** Add an updateActivity server action and a pencil/edit affordance on each activity chip in PointsPanel.tsx.

### `F0652` [BROKEN] Help topic "Custom Activities" links to an admin-only 404 page, but the real feature already works for servants on their class's Points page
- **Role:** servant · **Area:** help
- **OG:** index.stripped.html L5657-5658 (feature description), L5745 (+ Add Activity tile)
- **Now:** app/portal/(app)/help/page.tsx links to /portal/admin/sessions (confirmed `if (user.role !== 'ADMIN') notFound()` at line 11-12); the real feature is `addActivity()` in app/portal/(app)/classes/[id]/points/PointsPanel.tsx (confirmed, line 80)
- **Verified:** Confirmed the link is dead for a servant, but downgraded from high because — unlike F0650/F0651 — the underlying capability was not lost: a servant who bypasses the broken Help link and goes directly to their class's Points page can add a custom activity exactly as the OG allowed. This is a documentation/routing bug, not a regression in what servants can do.
- **Fix:** Fix the Help link to point at the class Points page instead of the admin sessions page.

### `F0653` [BROKEN] Help topic "Edit Student Info" links to an admin-only 404 page, but the real, permission-gated edit feature already works for servants
- **Role:** servant · **Area:** help
- **OG:** index.stripped.html L5659-5660
- **Now:** app/portal/(app)/help/page.tsx links to /portal/admin/students (404 for non-admin); the real feature is /portal/students/[id]/edit, confirmed gated correctly via `can(user, 'student.write', ...)`
- **Verified:** Confirmed the link 404s for a servant, but confirmed the actual edit page works fine and is properly permission-scoped to a servant's own students. Downgraded from high for the same reason as F0652 — it's a wrong link in the Help article, not a lost capability; a servant reaching the edit page through normal navigation (student profile → Edit) is unaffected.
- **Fix:** Fix the Help link to route through the servant's own roster path (e.g. /portal/classes/[id]/students → student → edit) instead of the admin students list.

### `F0231` [DEGRADED] Save/delete confirmations and validation errors render at the top of the page, out of sight of the form ⚠️ *unverified*
- **Role:** servant · **Area:** hymns
- **OG:** Hymns page — showNotif() toast, fixed-position, always visible wherever the servant is on the page
- **Now:** /portal/hymns — a Callout rendered as the first child of the LEFT column, above the hymn list; the form that produced the message is in the right column, i.e. below the whole list on mobile
- **Fix:** Render the message inside the add/edit Card itself (directly above the Save button in HymnManager.tsx:212-241), or keep the Callout and add a `ref` + `scrollIntoView({block:'center'})` plus `focus()` in the `startTransition` callback at HymnManager.tsx:64 and :76.

### `F0268` [DEGRADED] New lesson always saves undated and PLANNED — logging what you just taught now takes an extra step every single week
- **Role:** servant · **Area:** lessons
- **OG:** index.stripped.html L15849-15882 (cbSaveLesson: blank date defaults to today in America/New_York, status born 'taught')
- **Now:** lib/portal/actions/lessons.ts:61 (date stays null if blank), :70 (status defaults to PLANNED); app/portal/(app)/lessons/LessonManager.tsx (single "Add lesson" button, no status passed)
- **Verified:** Fully confirmed via direct reads of both the action and the client form: no code path sets status:'TAUGHT' or defaults the date on the main save; the separate toggleStatus function (LessonManager.tsx ~101-113) flips status but never touches date, so a 'taught, today' lesson still requires opening the card afterward and still ends up undated. Raised from low to medium because this is friction on the single most common weekly servant action, not a one-off or cosmetic issue.
- **Fix:** Give the lesson form two save actions — 'Add to plan' (PLANNED) and 'Log as taught' (status: TAUGHT, and default date to todayInNewYork() when left blank). The action already accepts status; only the client needs to send it.

### `F0262` [MISSING] "🔗 Open Slides" straight from the archive is gone — you must open the week to reach the deck ⚠️ *unverified*
- **Role:** servant · **Area:** lessons
- **OG:** Bottom of every Lesson Archive card that has a slide link
- **Now:** nowhere in any archive; Open Slides survives only inside a single week (agenda read-only view and the print sheet)
- **Fix:** Have `listAgendaWeeks` return `slideLink` (not just the boolean) and render an "Open Slides" pill on each archive entry when it is set — in the restored archive view, and on the month-accordion tiles as a secondary link if that view stays.

### `F0264` [MOVED] The sidebar item "Lesson Prep" now opens a completely different page than the OG's "Lesson Preparation" ⚠️ *unverified*
- **Role:** servant · **Area:** lessons
- **OG:** Servant sidebar → group "Planning" → "Lesson Preparation" → svLoad('agenda') → the Schedule of the Year weekly curriculum plan
- **Now:** Servant sidebar → group "Teaching" → "Lesson Prep" → /portal/lessons, which is the lesson-card manager. The Schedule of the Year is now a SEPARATE item right below it.
- **Fix:** Rename the /portal/lessons entry to something unambiguous ("Lesson Plans" or "Class Lessons") for all three roles and retitle its PageHeader to match, freeing "Lesson Preparation" for /portal/agenda — or label /portal/agenda "Lesson Preparation · Schedule of the Year" so the OG name still lands where the OG sent it.

### `F0265` [DEGRADED] The dashboard "Upcoming Lessons" widget shrank from three lessons to one, and its "View all" now goes somewhere else ⚠️ *unverified*
- **Role:** servant · **Area:** lessons
- **OG:** Servant Dashboard → smart widget grid → a card headed "Upcoming Lessons" with an indigo "View all" link to Curriculum; also a "lessons taught" count among the dashboard stats
- **Now:** Servant Dashboard → the "This week in class" card → a "Next lesson" strip at the bottom showing ONE lesson; the card's link is "All assignments" → /portal/assignments
- **Fix:** Add a `nextPlannedLessons(classIds, servantId, limit = 3)` beside `nextPlannedLesson` and render up to three rows in the widget (OG row shape: a small day-number tile, the title or 'Untitled lesson', and "Wed, Mon D" or 'No date'). Point the section's link at /portal/curriculum as the OG did, and wire the already-written `lessonCounts()` into a "Lessons taught" stat.

### `F0266` [DEGRADED] "My Assignments" lost its count badge and its second entry point in the avatar menu ⚠️ *unverified*
- **Role:** servant · **Area:** lessons
- **OG:** Servant sidebar → "My Assignments" carrying a live count badge (#myassign-badge), AND the topbar avatar dropdown → "My Assignments"
- **Now:** /portal/assignments, reachable only from the sidebar item, with no badge
- **Fix:** Add an optional `badge?: number` to `NavItem` in components/portal/Shell.tsx and render it as the existing notification pill; have navForUser (or a small server component wrapper) fill it from `assignmentsForServant`. Restoring the avatar dropdown is the nav-ia fix, but "My Assignments" should be one of its entries when it comes back.

### `F0267` [DEGRADED] The Curriculum book button says "3rd Grade" instead of "Download Book" — the call to action is gone ⚠️ *unverified*
- **Role:** servant · **Area:** lessons
- **OG:** Curriculum Resources → under each of the 14 book covers, a gold-outlined pill reading "Download Book", with "Lesson Slides" beneath it where slides exist
- **Now:** /portal/curriculum → the same pill now renders the grade name ("Pre-K", "KG", "1st Grade"…), and the slides link reads just "Slides"
- **Fix:** app/portal/(app)/curriculum/page.tsx:112 — render the literal "Download Book" instead of `{g.pill}` (keep `aria-label` as it is, which already names the grade and title), and line 124 — restore "Lesson Slides".

### `F0259` [DEGRADED] "Copy from Another Class" is all-or-nothing bulk copy, no per-lesson picker
- **Role:** servant · **Area:** lessons
- **OG:** Servant lesson-plan, Copy modal per-lesson list + "+ Copy" buttons (index.stripped.html L15916-15956)
- **Now:** app/portal/(app)/lessons/LessonManager.tsx — class select + "Planned lessons only" checkbox + single "Copy lessons" button
- **Verified:** Confirmed accurate as described. Downgraded from high: the servant can still complete the copy in bulk and delete unwanted lessons afterward — this is friction, not a blocked task.
- **Fix:** Load the source class's lessons and render one row per lesson with a per-row Copy button (lessonIds filter); keep the bulk button as a secondary 'Copy all'.

### `F0256` [MISSING] Searchable "Lesson Archive" (full-text search, per-week topic/meta cards) replaced by a navigation-only calendar of unlabeled tiles
- **Role:** servant · **Area:** lessons
- **OG:** Schedule of the Year → third tab "Lesson Archive", index.stripped.html L8594-8637 (renderLessonArchive, search box) + L8646-8690 (renderArchiveTimeline, per-week cards with title/meta/Open Slides/View Full Week)
- **Now:** app/portal/(app)/agenda/page.tsx, `ArchiveMonths` component (confirmed ~lines 149-250) — a month accordion of 64px tiles showing only a month abbreviation, day number and "N/10 filled", linking each tile straight to that week's editor
- **Verified:** Confirmed the OG feature is a genuine full-text search over lesson/Bible-study/saint topics and notes, rendering timeline cards with visible title/meta text and action buttons. Confirmed the new 'Archive' section (which does exist, under a different design) shows no visible topic text and no search box — the only content is in a non-searchable `title=` tooltip attribute per tile. Downgraded from high: no data is lost and every week remains one click away from the same accordion, so this is a browsing/searching regression, not data loss — a real but medium-severity gap.
- **Fix:** Add a search input above the archive accordion that filters by topic/notes text (server-side or client-side over the already-fetched weeks), and show the resolved title/topic as visible text on or near each tile rather than only in a tooltip.

### `F0609` [MISSING] Sidebar badge #myassign-badge (live upcoming-assignment count) ⚠️ *unverified*
- **Role:** servant · **Area:** myassignments
- **OG:** Badge on the sidebar nav item showing the number of upcoming assignments, refreshed by refreshMyAssignmentsBadge()
- **Now:** nowhere
- **Fix:** Add an unread-count badge to NavItem/Shell rendering, backed by the same upcoming-count query used on the assignments page

### `F0611` [MISSING] Quick-stat 'My Assignments' card on My Profile ⚠️ *unverified*
- **Role:** servant · **Area:** myassignments
- **OG:** Clickable card on My Profile showing upcoming count and 'Next: {role} / {className}', navigates to My Assignments
- **Now:** nowhere
- **Fix:** Add the quick-stat card back once a real My Profile page exists

### `F0617` [MISSING] 'Reason / note...' free-text field per activity ⚠️ *unverified*
- **Role:** servant · **Area:** myattendance
- **OG:** Text input next to each activity's status buttons for an optional note (e.g. reason for absence)
- **Now:** nowhere
- **Fix:** Add a reason field/popover to the grid or my-attendance UI

### `F0618` [MISSING] Week stepper (‹ range ›) to view/edit any specific week ⚠️ *unverified*
- **Role:** servant · **Area:** myattendance
- **OG:** Prev/next arrows shift the visible/editable week
- **Now:** nowhere
- **Fix:** Add week navigation, or link out to /portal/servant-attendance for single-week editing

### `F0619` [MISSING] 'Edit Activity Days' header button ⚠️ *unverified*
- **Role:** servant · **Area:** myattendance
- **OG:** Any servant can change which day (Fri/Sat/Sun) each of the 7 weekly activities falls on; applies for everyone
- **Now:** nowhere
- **Fix:** Add an editor for ServantActivity.dayOfWeek/label, per OG's own copy open to any servant

### `F0614` [MOVED] Self attendance-marking moved off the read-only My Attendance page onto the Servants Attendance grid, where it already works
- **Role:** servant · **Area:** myattendance
- **OG:** renderMyAttendancePage self-marking grid, 3-status buttons (index.stripped.html L6825-6856, L6949-6980, saSetStatus L7002-7009)
- **Now:** app/portal/(app)/servant-attendance/page.tsx + ServantGrid.tsx, with the caller's own row always included and writable (lib/portal/data/servant-attendance.ts L59-65)
- **Verified:** my-attendance/page.tsx (full file) is confirmed 100% read-only. But loadServantScope always includes the signed-in servant (comment: 'always including the caller themselves'), and writableIds includes the self row even for a plain servant. ServantGrid's tap-to-cycle cells (null→Present→Excused→Absent) are functionally equivalent to the OG's 3 buttons. This page is already linked from the sidebar ('Servants Attendance') and from the dashboard's 'My week' card ('Open grid').
- **Fix:** Either embed a self-cycle control inline on My Attendance for the current week, or add a prominent 'Mark this week' button on My Attendance linking to /portal/servant-attendance.

### `F0644` [MISSING] Quick-stat 'My Assignments' card (upcoming count + next assignment), clickable ⚠️ *unverified*
- **Role:** servant · **Area:** myprofile
- **OG:** Card on My Profile summarizing assignments and linking to My Assignments
- **Now:** nowhere
- **Fix:** Add once a real profile page exists

### `F0645` [MISSING] Quick-stat 'My Attendance' card (last-4-week rate + label), clickable ⚠️ *unverified*
- **Role:** servant · **Area:** myprofile
- **OG:** Card on My Profile summarizing recent attendance and linking to My Attendance
- **Now:** nowhere
- **Fix:** Add once a real profile page exists

### `F0649` [MISSING] Mobile identity bar tap -> opens My Profile ⚠️ *unverified*
- **Role:** servant · **Area:** myprofile
- **OG:** Tapping the mobile bar (avatar+name) navigated to myprofile
- **Now:** nowhere
- **Fix:** Restore a tap target on the mobile identity bar

### `F0641` [MISSING] 'Contact Information' editable fields (Email, Phone, Address, Birthday) are missing from My Profile
- **Role:** servant · **Area:** myprofile
- **OG:** My Profile page, Contact Information card (index.stripped.html L5632-5637)
- **Now:** app/portal/(app)/settings/page.tsx (31 lines) — read-only name/role card + PIN change form only
- **Verified:** Confirmed no contact fields exist anywhere in the portal. Notably prisma/schema.prisma already has Account.email/phone and Servant.address/birthday — the data model supports this, only the self-service UI is missing. Downgraded from high: not a weekly task, and an admin can update this data as a workaround via admin/servants/[id].
- **Fix:** Add a real My Profile page with these 4 fields, backed by a new self-service writer action (see F0642).

### `F0642` [MISSING] saveMyServantProfile() self-service contact-info writer is missing
- **Role:** servant · **Area:** myprofile
- **OG:** index.stripped.html L5639, L10284-10297
- **Now:** lib/portal/actions/account.ts — only changeOwnPin exists
- **Verified:** Confirmed by grep. Same root cause and severity reasoning as F0641 — effectively one gap.
- **Fix:** Add an updateMyProfile server action validating and writing email/phone/address/birthday to the caller's own Account/Servant rows.

### `F0635` [MISSING] Reports: Select All + per-class checkboxes ⚠️ *unverified*
- **Role:** servant · **Area:** mystage
- **OG:** Checkbox on each class card plus a master 'Select All'
- **Now:** nowhere
- **Fix:** Add selection controls

### `F0636` [MISSING] Reports: 'Print Selected' button ⚠️ *unverified*
- **Role:** servant · **Area:** mystage
- **OG:** Prints only the checked classes
- **Now:** nowhere
- **Fix:** Add selective print

### `F0639` [DEGRADED] Reports: Period filter (All Time/By Month/Date Range toggle) ⚠️ *unverified*
- **Role:** servant · **Area:** mystage
- **OG:** 3-mode period selector with month dropdown or date-range inputs
- **Now:** app/portal/(app)/reports/page.tsx L93-101, ReportFilters.tsx - only a From/To date range, default last 90 days
- **Fix:** Add All Time and By Month modes

### `F0633` [MOVED] My Stage has no embedded reports section, but the same stage-scoped report already exists one click away on the Reports page
- **Role:** servant · **Area:** mystage
- **OG:** renderChurchReportsPage embedded in My Stage (index.stripped.html L16973-16981, engine L7320-7601+)
- **Now:** app/portal/(app)/my-stage/page.tsx (no reports section, confirmed) — but app/portal/(app)/reports/page.tsx?tab=church already shows stage-scoped attendance/quiz/points for exactly this persona
- **Verified:** Confirmed my-stage/page.tsx ends after the roster grid. But churchReportScope() (lib/portal/data/reports.ts L207-216) returns the stage's classes for a SERVANT with stageOversight set — exactly this persona — making the 'Church reports' tab appear on /portal/reports, which is already a permanent sidebar item ('Reports'). The report engine and stage scoping both exist and are one click away; they're just not embedded on My Stage itself.
- **Fix:** Add a 'View stage reports' link from My Stage to /portal/reports?tab=church, or inline the church-report component directly for closer OG parity.

### `F0634` [MOVED] Reports: 3 mode tabs merged into one combined panel — reachable via the sidebar, not just 'unreachable from My Stage'
- **Role:** servant · **Area:** mystage
- **OG:** Three switchable reports tabs (index.stripped.html L7332-7335)
- **Now:** app/portal/(app)/reports/page.tsx L80-200 — attendance/quiz/points merged into one panel
- **Verified:** Confirmed the merge into one panel. But the 'unreachable' framing is misleading: the sidebar's permanent 'Reports' item takes any servant straight there, and the Church reports tab appears automatically for a stage overseer. The servant can reach and read every number, just organized differently and via a different starting point than My Stage (see F0633).
- **Fix:** Link from My Stage (see F0633), or split the combined panel back into switchable tabs for closer OG parity.

### `F0638` [MISSING] Reports: per-class card has no click-through to a per-student drill-down
- **Role:** servant · **Area:** mystage
- **OG:** openChurchReportClassModal per-student breakdown (index.stripped.html L7509-7526, L7571+)
- **Now:** app/portal/(app)/reports/page.tsx — ClassCard usage has no href/onClick, confirmed by reading the JSX
- **Verified:** This part of the finding is accurate: no modal or drill-down exists on this page. Downgraded from high because a workaround exists across two other already-linked pages: a class's own page shows per-student attendance rate and points, and a student's own page shows exam scores — the data isn't lost, just not consolidated in one view.
- **Fix:** Add a class-detail drill-down (modal or a dedicated route) with per-student attendance/quiz/points rows, color-coded as the OG did.

### `F0147` [MOVED] Servant sidebar has no permanent Students/Attendance/Points items — but the two safety-critical ones (Attendance, Points) are one click from the Dashboard, not buried
- **Role:** servant · **Area:** nav-ia
- **OG:** OG sidebar group 'Attendance & Rewards': Students (L4011, id sv-sbi-st), Attendance (L4012, sv-sbi-at), Points (L4017, sv-sbi-gr) — three always-visible one-click items
- **Now:** lib/portal/nav.ts SERVANT case has no Students/Attendance/Points entries (confirmed by reading the whole switch); the class page app/portal/(app)/classes/[id]/page.tsx:83-89 has 'Take attendance'/'Points' buttons and the roster; app/portal/(app)/page.tsx:104-107,127 (Dashboard) already links directly to /portal/classes/{id}/attendance and /portal/classes/{id}/points per class
- **Verified:** Confirmed the sidebar items are gone (grep of nav.ts) and the destinations moved to the class page as described. But severity is overstated: I read the Dashboard page directly and it already surfaces one-click 'Take attendance' and 'Points' links per class right on the servant's landing page — the two time-critical weekly actions are not 'buried two clicks', they're immediately available from the page a servant sees first. Only the standalone Students/roster destination has no shortcut anywhere (tracked separately as F0053). Corrected to medium.
- **Fix:** If a permanent nav item is still wanted for muscle memory, add a 'My Class' section item for a servant's primary class resolving straight to /portal/classes/{id}, or add three fixed items (Students/Attendance/Points) that resolve to the servant's one class when they have exactly one.

### `F0157` [MOVED] Servant sidebar regrouped from 7 named groups to 5, and the groups no longer match what servants were trained on ⚠️ *unverified*
- **Role:** servant · **Area:** nav-ia
- **OG:** Servant sidebar groups, in order: Overview | Attendance & Rewards | Planning | Community | Servant Ministry | Teaching | Support
- **Now:** lib/portal/nav.ts SERVANT: (ungrouped) | My Class | Teaching | Attendance | Community | Account
- **Fix:** Rename the SERVANT sections in lib/portal/nav.ts back to the OG seven and re-sort the items into them. This is a pure data edit in one file and costs nothing but the labels.

### `F0159` [MOVED] "QR Attendance" and "QR Points" were two sidebar items; points is now a radio button three levels deep ⚠️ *unverified*
- **Role:** servant · **Area:** nav-ia
- **OG:** Servant sidebar → Attendance & Rewards → "QR Attendance" (#sv-sbi-qra) and "QR Points" (#sv-sbi-qrp), adjacent one-click items
- **Now:** one nav item "QR Check-in" → /portal/qr → "Scan students" tab → a "Give points" radio inside ScanPanel
- **Fix:** Add a second nav item `{ href: '/portal/qr?tab=scan&mode=points', label: 'QR Points', icon: 'qr', section: 'Attendance' }` next to QR Check-in (relabel that one "QR Attendance"), and have ScanPanel read the `mode` search param as its initial Mode.

### `F0160` [MOVED] "Attendance Report" and "Student Reports" collapsed into one "Reports" item, filed under Community ⚠️ *unverified*
- **Role:** servant · **Area:** nav-ia
- **OG:** Servant sidebar → Attendance & Rewards → "Attendance Report" (#sv-sbi-wr → weeklyreport) and "Student Reports" (#sv-sbi-rp → reports), two separate one-click destinations in the attendance group
- **Now:** one item labelled "Reports" in the SERVANT "Community" section → /portal/reports, with Attendance / Church reports / Report cards as tabs
- **Fix:** Move the item to the "Attendance" section and split it into two nav entries pointing at the existing tabs: "Attendance Report" → /portal/reports and "Student Reports" → /portal/reports/cards. No new pages needed.

### `F0161` [MOVED] Servant "Lesson Preparation" now points at a different page than it used to ⚠️ *unverified*
- **Role:** servant · **Area:** nav-ia
- **OG:** Servant sidebar → Planning → "Lesson Preparation" (#sv-sbi-ag) → svLoad('agenda') — the agenda/weekly-plan view
- **Now:** the label "Lesson Prep" is attached to /portal/lessons, while the agenda now appears for servants as "Schedule of the Year" (the ADMIN's wording)
- **Fix:** In lib/portal/nav.ts relabel the SERVANT's /portal/agenda item to "Lesson Preparation" (keep "Schedule of the Year" for ADMIN), and give /portal/lessons a name that does not collide — e.g. "Lessons" or "Lesson Archive" — matching what the OG actually called that content.

### `F0163` [MISSING] Admin "open class view" impersonation and its "Exit to Admin" affordances do not exist ⚠️ *unverified*
- **Role:** servant · **Area:** nav-ia
- **OG:** Admin → Classes / Servants cards open the servant shell as that class; exit via the green button in the servant sidebar crest, or the green "Exit to Admin" row pinned to the top of the mobile More sheet
- **Now:** nowhere
- **Fix:** Larger than a nav fix — needs a session-level impersonation flag. If it is being deferred, record that decision; if not, add an "Open as class" action on the admin class card, a banner/crest button to exit, and pin the exit row to the top of the mobile overlay.

### `F0150` [DEGRADED] Servant "Class Profile" summary is not missing — it exists at /portal/classes/[id], just one click deeper and missing the open-case count
- **Role:** servant · **Area:** nav-ia
- **OG:** Servant sidebar → Overview, position 2, "Class Profile" (index.stripped.html L4008, L4701-4730+)
- **Now:** app/portal/(app)/classes/[id]/page.tsx (184 lines, read in full)
- **Verified:** The claim 'not the class summary, just a roster page' is inaccurate: the page already has StatCards for Students/Servants/Avg points/Sunday rate, per-student attendance % and points on every roster card, a Follow-up badge for open cases, and a Servants list. What's genuinely missing is an aggregate open-case count tile, a 60-day-windowed rate specifically, and a one-click nav path — confirmed /portal/classes/page.tsx has no auto-redirect for a single-class servant, so it is a real 2 clicks (Dashboard → My Classes → the class card).
- **Fix:** Add an aggregate 'Open cases' StatCard to the existing class page, and either add a direct 'Class Profile' nav item for servants or auto-open a single-class servant's own class page.

### `F0839` [MISSING] Class photo ⚠️ *unverified*
- **Role:** servant · **Area:** page-servant-class — sidebar class icon
- **OG:** Clicking the class icon in the servant sidebar opens openClassPhotoModal(): upload/crop/remove a square photo saved to classes/{classId}.classPhoto via saveClassPhoto(), shown as the class icon in servant and student sidebars.
- **Now:** nowhere — prisma/schema.prisma:243 has a dormant SchoolClass.photo column that no code reads or writes
- **Fix:** Add a photo control (reuse PhotoUpload) to the class edit form or class detail page, writing to the existing SchoolClass.photo column, and render it as the class icon wherever classes are listed.

### `F0841` [MISSING] My Profile — self-service contact info (email/phone/address/birthday) — confirmed missing
- **Role:** servant · **Area:** page-servant-self — svLoad('myprofile')
- **OG:** OG My Profile page (L5573-5644): Email/Phone/Address/Birthday inputs plus tap-photo-to-change, saved via saveMyServantProfile() (L10284-10298)
- **Now:** app/portal/(app)/settings/page.tsx — read in full: only a read-only identity card (name + role Badge) and ChangePinForm; grep for a saveMyServantProfile equivalent across lib/portal/actions/*.ts returns nothing
- **Verified:** Confirmed exactly as stated — no contact-info fields, no save action, anywhere in the new portal. Severity corrected from blocker to medium: updating one's own contact details isn't a weekly task, and the workaround (ask an admin, who can already edit any servant's profile at /portal/admin/servants/[id]) fully substitutes for it, just with more friction.
- **Fix:** Add Email/Phone/Address/Birthday fields and a save action to /portal/settings for the signed-in servant's own account, scoped to fields the OG allowed self-service edits on (name/class/title stay admin-managed, per the OG's own note).

### `F0188` [MISSING] No way to edit an existing point activity — only create and delete exist, so fixing a typo means delete-and-recreate
- **Role:** servant · **Area:** points
- **OG:** index.stripped.html L19424-19436 (modal markup), L10682-10698 (openManageActivitiesModal with openEditActivityModal per row), L19018 (QR-modal deep link)
- **Now:** lib/portal/actions/points.ts (only createActivity and removeActivity are exported); PointsPanel.tsx tile grid offers only delete (the X button)
- **Verified:** Confirmed the 'no Manage Activities modal' claim, but went further: grepped `^export async function` in points.ts and confirmed there is no updateActivity/editActivity action at all anywhere in the codebase — not just a missing modal shell, the underlying edit capability doesn't exist. A servant who mistypes an activity name or sets the wrong point value has no fix short of delete-and-recreate. Raised from low to medium: this is real recurring friction (activities are typically set up once per season and mistakes are common), not cosmetic.
- **Fix:** Add an updateActivity server action and an edit affordance (pencil) on each activity chip in PointsPanel.tsx, and/or the compact Manage Activities list the original fix suggested, reachable from both the QR panel and the Points page.

### `F0177` [BROKEN] Leaderboard totals now count points a student earned in a previous class ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Points page → Class Leaderboard, and the student's own Grades & Points totals — both summed only the point rows belonging to THIS class
- **Now:** /portal/classes/[id]/points, /portal/leaderboard, /portal (student), /portal/students/[id] — all via classTotals(), which groups every PointEntry the student has ever had
- **Fix:** Change classTotals to `where: { classId: { in: classIds } }` (the entry's own class), and scope the student-profile aggregate to the student's current classId, so a leaderboard total means "points earned in this class" exactly as it did in the OG.

### `F0178` [DEGRADED] Attendance-sourced points can no longer be undone from the ledger — canUndo hard-refuses them ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Both the class-wide Points History and the Student Profile points table showed a ↶ Undo button on EVERY row that was not already undone, regardless of source
- **Now:** /portal/classes/[id]/points → Recent activity — the Undo button is suppressed on every attendance row; there is no undo on the student profile at all
- **Fix:** Keep the rule but make it visible: on an ATTENDANCE row render a disabled/secondary control reading "Fix on the attendance sheet" that links to /portal/classes/[id]/attendance for that date and session, so the servant is routed rather than dead-ended.

### `F0179` [MISSING] The leaderboard sort toggle (A–Z / Highest / Lowest) is gone ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Points page → "Class Leaderboard" card header, right side — a three-button segmented control in a #F3EFE6 track, defaulting to Highest
- **Now:** nowhere. /portal/classes/[id]/points always renders in rank order; /portal/leaderboard likewise.
- **Fix:** Add a three-way segmented control to the leaderboard card header in PointsPanel.tsx holding local state 'az' | 'high' | 'low', sorting the already-ranked `students` array client-side while keeping `s.rank` (and therefore the medal and the amber pill) untouched.

### `F0180` [MISSING] The 👁 "View profile" button on each leaderboard card is gone ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Points page → each student tile in the Class Leaderboard grid → a small 👁 icon-button at the TOP-RIGHT, titled "View profile", opening the profile without selecting the card (the helper text above the grid explicitly taught it: "Tap 👁 to view a profile instead")
- **Now:** nowhere. Tapping anywhere on a card only toggles selection.
- **Fix:** Add an absolutely-positioned top-right `<Link href={`/portal/students/${s.id}`}>` (with an Eye icon and aria-label "View profile") inside each leaderboard card, stopping propagation so it does not toggle selection, and restore the second sentence of the helper text.

### `F0181` [DEGRADED] The activity emoji picker (24 curated icons) was replaced by a bare four-character text box ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Add/Edit Activity modal → the Icon field: a read-only, centred, 20px input that opens a 6-column, 236px popover of exactly 24 emoji, closed by a document-level outside click
- **Now:** /portal/classes/[id]/points → "+ New activity" panel → a plain `<input maxLength={4} placeholder="⭐">` the servant must type or paste an emoji into
- **Fix:** Add a small popover component holding the OG's exact 24-emoji list in a 6-column grid, open it from a read-only icon field, close it on outside click, and default to ⭐ — reusing it in both the create and (once added) the edit activity form.

### `F0182` [MISSING] The staff dashboard lost the "Recent Activity" points feed and the "Top Performing Students" widget ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Servant Dashboard → smart-widgets grid → two cards: "Recent Activity" (the 5 newest point awards with the activity icon, "<b>Name</b> earned <activity>", a green +N and a relative timeAgo) and "Top Performing Students" (top 4 by quiz average with 🥇🥈🥉🏅, min 2 exams to rank)
- **Now:** nowhere. /portal for a servant shows class cards, LessonsWidget and ExamsWidget only.
- **Fix:** Add a PointsActivityWidget to components/portal/widgets/ (the 5 newest PointEntry rows across the user's classes, with the OG's timeAgo formatting) and a TopStudentsWidget (top 4 by average QuizResult.percentage, filtered to students with ≥2 results), and render both in the staff branch of app/portal/(app)/page.tsx alongside the existing two.

### `F0183` [MISSING] The class profile lost "Most Active Student", "Top this month" and its Recent Activity card ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Class Profile → a gold star tile reading "Most Active Student / <name> / <N> points earned", a "⭐ Top this month: <name> (N pts)" line under the Monthly Digest, and a bottom "Recent Activity" card listing the last 8 point awards
- **Now:** nowhere. /portal/classes/[id] shows Students / Servants / Avg points / Sunday rate stat cards, a roster grid and a Servants list.
- **Fix:** Add a "Most Active Student" tile and a "Recent activity" card (last 8 PointEntry rows for the class, newest first, with the +N in gold) to app/portal/(app)/classes/[id]/page.tsx, and show Total points alongside Avg points in the stat strip.

### `F0185` [DEGRADED] The report card lost the points breakdown by source and the medal rank label ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Servant → Student Reports → the printed report card: a Rank tile reading 🥇 1st / 🥈 2nd / 🥉 3rd / #n, and a "Points breakdown by source" section splitting the non-quiz total into Attendance / Manual / Undo / Other, with the manual entries listed individually (most recent 8) because each carries its own reason
- **Now:** /portal/reports/cards — a "Total pts" stat and a plain "#n" Rank stat, with no breakdown of any kind
- **Fix:** Extend the report-card query in lib/portal/data/reports.ts to group each student's PointEntry rows by `source`, add the four buckets plus the recent manual entries to the ReportCard type in lib/portal/reports.ts, render them as a breakdown block in app/portal/(app)/reports/cards/page.tsx, and restore the medal glyph for ranks 1-3.

### `F0186` [MOVED] QR Points lost its own sidebar item and is now a dropdown option inside QR Check-in ⚠️ *unverified*
- **Role:** servant · **Area:** points
- **OG:** Servant sidebar → "Attendance & Rewards" → two separate items: "QR Attendance" (id sv-sbi-qra) and "QR Points" (id sv-sbi-qrp), each opening the scanner in its own mode
- **Now:** /portal/qr → "Group code" tab → a Mode <select> whose second option is "Points" — three levels down, with no label anywhere in the nav mentioning points
- **Fix:** Either add a second nav item `{ href: '/portal/qr?tab=group&mode=points', label: 'QR Points', icon: 'points', section: 'Attendance' }` that pre-selects the POINTS mode, or at minimum rename the existing item to "QR Check-in & Points" and mention points in the page subtitle.

### `F0172` [DEGRADED] Removing points lost its ten preset discipline reasons, the 'Other (specify)' field and its own amount input
- **Role:** servant · **Area:** points
- **OG:** Points page, Remove mode reason select + amount input (index.stripped.html L5784-5797, L9412-9457)
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx — submit() L48-52, remove mode reuses the activity-chip grid plus one shared free-text 'Reason (optional)' field
- **Verified:** Confirmed exactly as described: no reason validation, no preset options, no independent points amount for remove mode. Downgraded from high: a servant can still complete the discipline task (remove points with a typed reason) — the loss is structure/consistency for later auditing, not a blocked task or lost data.
- **Fix:** In remove mode, swap the activity picker for the OG's 11-option reason select plus an 'Other (specify)' reveal, add an independent min=1 points input, make the reason required, and write it into activityLabel with activityKey 'manual_remove'.

### `F0503` [MISSING] YouTube link thumbnail with play-button overlay ⚠️ *unverified*
- **Role:** servant · **Area:** posts
- **OG:** detects youtube link, shows hqdefault.jpg thumbnail with red play button, 280x158
- **Now:** nowhere - PostCard.tsx:111-121 renders every link (incl. YouTube) as a plain 'Open link' button
- **Fix:** add YouTube-ID regex + img.youtube.com thumbnail branch to PostCard.tsx, mirroring OG L13609-13620

### `F0505` [MISSING] Success toast on publish/update/delete
- **Role:** servant · **Area:** posts
- **OG:** showNotif() calls at OG L13764/13816/~13908
- **Now:** app/portal/(app)/feed/FeedComposer.tsx, PostCard.tsx — form closes/refreshes silently on success
- **Verified:** Read FeedComposer.tsx and PostCard.tsx in full; createPost/updatePost/deletePost/togglePin/toggleReaction all call router.refresh() with no toast/Callout. grep for toast/Toaster/useToast across app+components+lib is empty.
- **Fix:** Add a transient success Callout/toast after each feed action resolves, reusing the Callout tone="good" pattern already in components/portal/ui.tsx.

### `F0344` [MISSING] Live counter "N students · M selected" (#pqr-count)
- **Role:** servant · **Area:** printqr
- **OG:** OG L14230, L14241-14245
- **Now:** app/portal/(app)/qr/cards/page.tsx (whole file read)
- **Verified:** New page has zero selection concept — it prints every student in the class unconditionally, only a static 'N card(s)' count in the subtitle.
- **Fix:** Add checkbox selection + Select All/Clear Selection + live counter, or accept the all-cards-always model and drop the OG comparison.

### `F0006` [DEGRADED] Batch scanning is gone: every scan writes immediately, no review/confirm step
- **Role:** servant · **Area:** qr
- **OG:** OG L13899-14156 (beginScanning/renderBatchList/openBatchReview/confirmBatchSave)
- **Now:** app/portal/(app)/qr/ScanPanel.tsx (whole file read) — submitCode() calls scanStudent() per decode
- **Verified:** Confirmed each decode writes immediately via a server action; an Undo link exists per row but there is no accumulate-then-confirm batch flow.
- **Fix:** As stated: either restore accumulate+review+confirm, or at minimum surface a duplicate tally / batch summary before the servant walks away.

### `F0007` [MISSING] All scan audio feedback is gone
- **Role:** servant · **Area:** qr
- **OG:** OG L9459-9509 (playPointsSound/playQRAttendanceSound), branched at L14012
- **Now:** nowhere — app/portal/(app)/qr/ScanPanel.tsx has only the visual row
- **Verified:** grep -rn "AudioContext|Oscillator|new Audio|vibrate" across app/components/lib returns zero matches.
- **Fix:** Port the two OG oscillator functions into lib/portal/sound.ts and call the right one from ScanPanel's result handler.

### `F0009` [MISSING] Manual-vs-QR provenance unrecordable — ServantAttendance has no source column
- **Role:** servant · **Area:** qr
- **OG:** OG L7094-7095, L7133-7135
- **Now:** prisma/schema.prisma:461-476 (model ServantAttendance, no source field); lib/portal/actions/qr.ts and servant-attendance.ts write identical shapes
- **Verified:** Confirmed schema has no source/provenance field on ServantAttendance and both write paths (QR redemption, manual grid save) are indistinguishable.
- **Fix:** Add a source enum/string to ServantAttendance, set it on both write paths, render the 3-state badge on a restored meeting-history view (needs a migration).

### `F0010` [MOVED] Servant-meeting QR check-in moved off the Servants Attendance page, no link left behind
- **Role:** servant · **Area:** qr
- **OG:** OG L7836-7840 (3rd tab wiring), L7067 renderServantMeetingQRTab
- **Now:** /portal/qr?tab=group → GroupCodePanel.tsx → 'Meeting' segment of a 3-way control
- **Verified:** servant-attendance/page.tsx header actions is only a 'Weekly report' link; the capability survives but only via the QR hub, several clicks away with no cross-link.
- **Fix:** Add a 'Meeting check-in code' link on the Servants Attendance header pointing to /portal/qr?tab=group&mode=meeting.

### `F0013` [DEGRADED] Servant's own class no longer pre-checked/labelled '(my class)' in group-code list
- **Role:** servant · **Area:** qr
- **OG:** OG L13920-13940
- **Now:** app/portal/(app)/qr/GroupCodePanel.tsx:60 and ~245-260
- **Verified:** selected state starts empty whenever the servant can see 2+ classes; the checklist has no self-marking, label suffix, or sort-to-top.
- **Fix:** Pass the user's own class ids in, pre-select + sort + label them as OG did.

### `F0320` [DEGRADED] No bulk/crammed-cell importer for the church's whole-month reading export — but per-quiz Bible Reading + Message is fully supported via the unified CSV, and the daily reading calendar is now automated
- **Role:** servant · **Area:** readings
- **OG:** index.stripped.html L5366-5372 (dropzone), L16405-16509 (crammed-cell auto-parse), L16518-16520 (day-of-month join), L17683-17690 (template)
- **Now:** app/portal/(app)/exams/import/ExamImport.tsx (one file, but its CSV already has Bible Reading + Reading Message columns, SAMPLE L24-28); lib/portal/exams.ts L372-373/385-386 and lib/portal/actions/exams.ts L42-43/88-89/135-136/292-293 (parsed and saved per exam); prisma/schema.prisma L538-539 (Exam.bibleReading/readingMessage); lib/portal/data/community.ts loadDailyReadings() L348-390 + CopticDayCache model (schema.prisma L61-74) — the whole-church daily calendar is now an automated external feed, not a manual upload
- **Verified:** The claim 'can no longer be loaded at all' is materially wrong: attaching a reading+message to a quiz works fine (just as inline columns in one file instead of a second file joined by day), and the church-wide daily reading display is now automatic (arguably more reliable than a manual monthly CSV). The genuine remaining gaps are narrower: no bulk-paste/auto-parse of the church's existing crammed export format, and no field anywhere for the church's own custom per-day encouragement message (CopticDayCache has none). Neither blocks a weekly task or loses data that used to exist in the new architecture, so severity is overstated at high.
- **Fix:** Either add crammed-cell auto-parsing to the existing quiz-CSV's two reading columns so the church's existing export can be pasted with less reformatting, or add an editable overlay table for a custom daily message layered onto CopticDayCache rather than reintroducing a parallel manual calendar.

### `F0522` [MISSING] Daily Readings rows are no longer tappable to fetch and show the full verse text
- **Role:** servant · **Area:** readings
- **OG:** index.stripped.html L13372-13386 (expandReadingPassage fetches bible-api.com per reference), L13450 (onclick), all inside the OG's Class Feed 'Bible' tab (loadFeedBible, L13326+), not a standalone readings page
- **Now:** app/portal/(app)/readings/page.tsx L92-104 (static dt/dd, no click handler); app/portal/(app)/feed/* has no Bible tab at all (grepped every file) — the OG feature was dropped outright, and /portal/readings (a live Coptic-calendar feed) is its nearest replacement
- **Verified:** Facts confirmed accurate, but severity is overstated: the scripture reference itself is still shown, nothing is silently lost/corrupted, and no weekly task depends on reading the full verse text in-app. That's friction (medium), not high.
- **Fix:** Port expandReadingPassage's fetch/toggle into a small client component wrapping each readings/page.tsx entry.

### `F0324` [DEGRADED] Bible reading capped at 300 chars on a single-line input, was a full multi-line devotional in OG
- **Role:** servant · **Area:** readings
- **OG:** OG L16441-16456 (autoParseCrammedCell builds multi-line 'reading'), L12026 (white-space:pre-line render)
- **Now:** lib/portal/actions/exams.ts:42 (max(300)); app/portal/(app)/exams/new/ExamEditor.tsx:221 (<input>)
- **Verified:** Confirmed OG's bibleReading-equivalent field held the full multi-line passage; new portal's bibleReading is a short-citation <input> capped at 300, while the separate readingMessage textarea (2000 chars) is used for a short note, not the passage, and isn't rendered pre-line either.
- **Fix:** Change the reading field to a textarea, raise the cap to match readingMessage's 2000, render with whitespace-pre-line everywhere it appears.

### `F0142` [BROKEN] "Church reports" tab is shown unconditionally on Report Cards and silently does nothing for servants with no church scope
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L2812-2815 (admin only), L15637-15639 (pastor only), L16974-16981 (stage coordinator only)
- **Now:** app/portal/(app)/reports/cards/page.tsx:87-98 (unconditional TabLink); app/portal/(app)/reports/page.tsx:75,82 (correctly guarded with churchScope)
- **Verified:** Fully confirmed: reports/cards/page.tsx never calls churchReportScope and always renders the tab; reports/page.tsx does call it and guards the same tab with `{churchScope && ...}`, falling back silently to 'attendance' when scope is null (line 75). Raised from low to medium: this isn't a hidden dead branch, it's a visible, clickable control on a page every servant visits for reports, that produces no feedback at all when clicked — exactly the kind of thing that erodes trust in the rest of the tool.
- **Fix:** Call churchReportScope in reports/cards/page.tsx and wrap the Church reports TabLink in the same {churchScope && ...} guard reports/page.tsx already uses.

### `F0129` [MOVED] Attendance Report and Student Reports became tabs under one 'Reports' item, one section (not three) below Attendance
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L4010 (Attendance & Rewards group), L4017-4018 (two sidebar rows)
- **Now:** lib/portal/nav.ts L83-91 (servant: Attendance section L83-85 immediately followed by Community section, whose last item L91 is 'Reports'); app/portal/(app)/reports/page.tsx L75-90 (tabs: Attendance default / Church reports / Report cards)
- **Verified:** The 'three sections away' claim is inaccurate — Community is the very next section after Attendance in the actual array order (Overview, My Class, Teaching, Attendance, Community). Both former pages are one click + one tab away under a clearly labelled 'Reports' item, which is a real reorganization but not a hard-to-find one and blocks no task — medium fits better than high.
- **Fix:** Optional polish: split back into 'Attendance Report' and 'Student Reports' nav entries under the Attendance section if the church specifically wants the old names/location back.

### `F0130` [DEGRADED] Report cards page lost its class-level stat row and each student's top-scoring-activity line (rank/medal is still shown, just as a ribbon badge)
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L6207-6215 (header+3-tile stats), L6175-6197 (medal/rank, top-activity line, card grid), L6198-6201 (per-card Report button)
- **Now:** app/portal/(app)/reports/cards/page.tsx (no StatCard/stat row; SheetStat 'Rank' tile L195-201 + gold ribbon+Award badge for rank<=3 L203-210); lib/portal/data/reports.ts loadReportCards() L412-484 (points summed via groupBy, never broken down by activityLabel)
- **Verified:** The stat row and per-activity top-line are genuinely missing, confirmed by code read. But 'lost medal ranks' overstates it — a top-3 ribbon badge with an Award icon is functionally the same signal, just restyled. 'No per-student Report button' is also misleading: the new page has no small-card+button architecture at all — it already renders every student's FULL report sheet directly (richer than the OG's preview card: attendance breakdown, exam results, badges, servant's-note line). The real consequence — can't isolate one student's sheet — is the same gap F0131 already reports; restating it here is redundant.
- **Fix:** Add the 3-tile class summary above the card list, and extend loadReportCards to group points by activityLabel so a top-activity line can be added per card. Leave the rank/medal styling and per-student isolation to F0131.

### `F0134` [MISSING] Class Profile lost its Monthly Digest card (informational summary only)
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L4721-4760 (computation), L4841-4853 (card markup)
- **Now:** app/portal/(app)/classes/[id]/page.tsx (full file read — only 4 all-time StatCards, no month-scoped digest of any kind)
- **Verified:** Confirmed missing, but every figure it aggregated (monthly attendance, points, open/resolved cases) remains independently visible on other existing pages (Reports, Points, Follow-ups). No task is blocked and no data is lost — only a convenient one-page summary — which fits medium, not high.
- **Fix:** Add a month-scoped digest card using the attendance/points queries already on the page plus a FollowUpCase groupBy, if the church wants the aggregated view back.

### `F0138` [MISSING] Report card lost the per-exam breakdown and its Show Details/Hide Details toggle
- **Role:** servant · **Area:** reports
- **OG:** OG L6449-6454 (detail rows), L6452 (toggle button), rptToggleExams ~L16036-16047
- **Now:** app/portal/(app)/reports/cards/page.tsx:235-250 (Exam results section, aggregate only)
- **Verified:** Confirmed lib/portal/data/reports.ts:441 selects only {studentId, percentage} on quizzes — exam title/date aren't even fetched, so the per-exam list can't be rendered without widening the query.
- **Fix:** Widen the quiz query to include exam title and submittedAt, render a collapsible per-exam list (a <details> needs no client component).

### `F0139` [DEGRADED] Attendance Report lost its session legend pills, symbol legend and month chips
- **Role:** servant · **Area:** reports
- **OG:** OG L6255-6278 (month chips, session pills, symbol legend)
- **Now:** app/portal/(app)/reports/page.tsx + ReportFilters.tsx (single <input type="month">, one grey footnote line)
- **Verified:** Confirmed the gradient month-chip pattern already exists elsewhere in the codebase (servant-attendance/report/page.tsx) but wasn't reused on this tab.
- **Fix:** Reuse the existing chip-row component for the 12 school-year months, add a coloured session legend row above the matrix.

### `F0140` [MISSING] Reports reachable only from the sidebar — no dashboard quick-action card, no global search
- **Role:** servant · **Area:** reports
- **OG:** OG L4569-4574 (dashboard tile), L18710-18712 (search quick link)
- **Now:** app/portal/(app)/page.tsx (dashboard) has no mention of reports anywhere
- **Verified:** Confirmed no 'reports' text on the dashboard, and confirmed no global-search feature exists anywhere in the portal at all (grep for SearchBox/GlobalSearch/quickLinks/cmdk is empty).
- **Fix:** Add a Reports quick-action card to the dashboard for SERVANT/ADMIN/PASTOR; global search is a separate, larger missing feature.

### `F0425` [MOVED] Sidebar nav item "Student Reports" folded into a shared "Reports" item
- **Role:** servant · **Area:** reports
- **OG:** OG L4018 (own top-level sidebar icon)
- **Now:** lib/portal/nav.ts:91 (single 'Reports' entry); reports/cards/page.tsx reached via a second click on the 'Report cards' tab
- **Verified:** Confirmed via nav.ts and the Tabs component in reports/cards/page.tsx.
- **Fix:** Add a distinct 'Report cards' sidebar entry, or land the sidebar link directly on the cards tab.

### `F0428` [MISSING] Class-level stat cards: Total Students / Avg Points / Total Points
- **Role:** servant · **Area:** reports
- **OG:** OG L6212-6214
- **Now:** nowhere — app/portal/(app)/reports/cards/page.tsx has no StatCard import/usage
- **Verified:** Confirmed via full-file read; only per-student SheetStats exist, no class-aggregate tiles.
- **Fix:** Add the 3 aggregate stat tiles above the per-student cards.

### `F0430` [DEGRADED] Compact report-card grid preview replaced by full stacked sheets
- **Role:** servant · **Area:** reports
- **OG:** OG L6182-6223 (minmax(130px,1fr) grid of small cards)
- **Now:** app/portal/(app)/reports/cards/page.tsx:154-277 (every student's full sheet renders inline, stacked)
- **Verified:** Confirmed via full-file read — no compact/summary view exists; every card is the full expanded sheet.
- **Fix:** Add a compact grid overview with on-demand expand/print per student.

### `F0432` [MOVED] Per-student '🖨 Report' button (opens the detail sheet) replaced by one page-level print button
- **Role:** servant · **Area:** reports
- **OG:** OG L6197/6200 (button), L6320 (printStudentReport fn)
- **Now:** app/portal/(app)/reports/cards/page.tsx:133 (single 'Print all cards' PrintButton)
- **Verified:** Confirmed distinct from F0436: this OG button *opens* the detail sheet (despite its printer icon), it doesn't itself print. No per-student trigger of any kind exists in the new portal.
- **Fix:** Add a per-card action (open/print) alongside the page-level button.

### `F0433` [DEGRADED] Attendance section lost its per-session breakdown rows
- **Role:** servant · **Area:** reports
- **OG:** OG L6444-6459, L6476-6484 (sessionStats loop)
- **Now:** app/portal/(app)/reports/cards/page.tsx:204-233 (combined rate + progress bar only)
- **Verified:** Confirmed one layer up too: lib/portal/data/reports.ts's loadReportCards computes attendanceRate() once over the whole range with no per-sessionKey grouping, so the per-session split doesn't exist even before rendering.
- **Fix:** Group attendance rows by sessionKey per student and render a per-session attended/held row list.

### `F0434` [MISSING] 'Manual Points' section (net total + itemized recent entries) missing from report card
- **Role:** servant · **Area:** reports
- **OG:** OG L6485-6490
- **Now:** nowhere — app/portal/(app)/reports/cards/page.tsx has no manual-points section
- **Verified:** Confirmed via full-file read.
- **Fix:** Add a Manual Points section listing recent manual point entries with reason and date.

### `F0436` [MOVED] 'Print Report Card' button inside the detail sheet replaced by one page-level print button
- **Role:** servant · **Area:** reports
- **OG:** OG L6496 (window.print() button inside the opened overlay)
- **Now:** app/portal/(app)/reports/cards/page.tsx:133 (single 'Print all cards' PrintButton)
- **Verified:** Confirmed distinct from F0432: this is the OG's actual browser-print trigger inside the already-opened sheet, not the button that opens it. Kept separate since restoring the compact-grid+modal flow would still need this wired up on its own.
- **Fix:** Add an in-sheet (or per-card, given the new stacked layout) scoped print action alongside the page-level one.

### `F0496` [DEGRADED] 'DIRECTED TO' class list now restricted to the servant's own classes (was unrestricted in OG)
- **Role:** servant · **Area:** schedule
- **OG:** OG L14721-14733 (buildDirectedToSection, unrestricted query)
- **Now:** lib/portal/data/community.ts:41-46 (canTargetClasses) + app/portal/(app)/events/EventManager.tsx:147-165
- **Verified:** Confirmed a SERVANT can never set targetAll and classIds must be a subset of their own — a real, deliberate-looking capability reduction.
- **Fix:** Confirm with the church whether this restriction is intentional; if not, relax canTargetClasses for servants.

### `F0498` [MOVED] 'Birthdays This Week' widget moved off the schedule page to its own route
- **Role:** servant · **Area:** schedule
- **OG:** OG L5562, L14879-14964 (loadScheduleBirthdays embedded in schedule panel)
- **Now:** /portal/birthdays (separate nav.ts entry), not shown on /portal/events
- **Verified:** Confirmed via grep (no birthday mention in events files) and nav.ts entry.
- **Fix:** Re-embed a birthdays strip at the top of /portal/events, or accept the separate-page model.

### `F0300` [DEGRADED] Servant Attendance grid shows only an abbreviated weekday with no date, and the week label runs Monday-Sunday instead of the OG's Friday-Sunday
- **Role:** servant · **Area:** servant-attendance
- **OG:** index.stripped.html L6944-6980 (three dated FRIDAY/SATURDAY/SUNDAY columns, numbered cards), L6840-6843 (Fri-Sun week label)
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx:118-128 (header renders {a.label} + {DAY_LABEL[a.dayOfWeek]} only); app/portal/(app)/servant-attendance/page.tsx:46-49 (week stepper spans weekStart..weekStart+6, i.e. Mon-Sun)
- **Verified:** Confirmed both claims by direct code read. Raised from low to medium: the finding's own framing is a servant marking a *past* week — with only an abbreviated weekday and no concrete date, there is genuine ambiguity about which specific Friday/Saturday/Sunday is being marked once you're a few weeks back, which is more than cosmetic for a record-keeping task.
- **Fix:** Compute and display the concrete date under each activity column header (weekStart + dayOfWeek), and label the week Friday-to-Sunday to match how all seven activities actually fall.

### `F0287` [MISSING] Servant Attendance bulk grid lost its 'Select All (Attended)' / 'Clear Selection' shortcuts
- **Role:** servant · **Area:** servant-attendance
- **OG:** index.stripped.html L7857-7860 (buttons), L7936-7945 (sabSelectAll/sabClearSelection)
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx (full file read — only a per-cell 4-state cycle and one Save button, no bulk controls)
- **Verified:** Confirmed missing. But each cell needs only one tap to go from unset straight to PRESENT (first step of the cycle), so marking one person costs the same click either way — the OG shortcut only saved clicks when marking many people at once. Recurring friction for whoever runs this weekly, but not a blocked task or lost data — medium fits the given calibration better than high. Also note the new grid shows all activities as simultaneous columns, a real capability gain over the OG's one-activity-at-a-time view.
- **Fix:** Add a per-column 'mark all attended' control plus a global Clear, operating on the existing cells/dirty state.

### `F0289` [MISSING] No editor exists for the seven ServantActivity day/time records — a rare configuration task, not a weekly one
- **Role:** servant · **Area:** servant-attendance
- **OG:** index.stripped.html L7825/L6888/L6900 (Edit Activity Days buttons), L7996-8027 (save logic)
- **Now:** prisma/schema.prisma L453-459 (ServantActivity model, unchanged); lib/portal/data/servant-attendance.ts L35 and lib/portal/actions/servant-attendance.ts L120 (read-only findMany/findUnique, no update/create/upsert anywhere); app/portal/(app)/admin/sessions/page.tsx (confirmed to edit the distinct AttendanceSession model instead)
- **Verified:** Confirmed there is genuinely zero write path for this model today (would require a manual DB edit). But this is a set-once/rarely-revisited configuration item, not something any servant does weekly — per the given calibration ('blocker = cannot complete a weekly task'), this doesn't block recurring church operations the way attendance-taking would, so medium fits better than high.
- **Fix:** Add a small editor (label/day-of-week/sort-order/active) alongside /portal/admin/sessions, plus a saveServantActivity action mirroring saveSession.

### `F0294` [DEGRADED] Three labelled Attended/Excused/Absent buttons collapsed into one cycling button per cell
- **Role:** servant · **Area:** servant-attendance
- **OG:** OG L7903-7910 (3 buttons), L7923-7928 (tap-again-to-clear)
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx:152-173 (single cycling button)
- **Verified:** Confirmed via full-file read: one button cycles null→PRESENT→EXCUSED→ABSENT→null; aria-label only announces the current value.
- **Fix:** Restore a 3-segment control per cell (✓/E/✗) with per-segment accessible names, keeping tap-active-to-clear.

### `F0622` [MISSING] No browsable 'Past Meetings' history (month-grouped, attendee chips, edit/delete) — but past weeks remain correctable via the week-stepper
- **Role:** servant · **Area:** servantattendanceall
- **OG:** renderServantMeetingQRTab L7185-7222 (month-grouped cards, avatar chips, Manual/QR/Manual+QR badge, edit-attendees and delete-meeting buttons)
- **Now:** nowhere as a dedicated view; underlying data lives in ServantAttendance (prisma/schema.prisma L461-474) and is reachable via /portal/servant-attendance?week=<any Monday> and .../report
- **Verified:** Confirmed zero hits for any past-meeting history UI (grep for past meeting/meeting histor/edit attende/delete meeting all empty). However this is not a dead end for the underlying task: the week-stepper on /portal/servant-attendance lets anyone with write access navigate to any past Monday-keyed week and re-mark it, which is a (clumsier) substitute for the OG's inline edit-attendees action, and the Weekly Report page gives aggregate per-activity/per-servant rates over any range. No ServantAttendance data is at risk of being lost or hidden; what's missing is a convenient month-grouped browsing/audit view, not the ability to see or fix a mistake.
- **Fix:** Build a 'Past Meetings' view over ServantAttendance rows grouped by (activityKey, weekStart), as the original fix suggests — but this is a nice-to-have convenience/audit layer on top of already-correctable data, not a blocked workflow.

### `F0623` [MISSING] Per-meeting 'Edit who attended' checkbox-roster modal
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7152, openEditMeetingAttendeesModal L7224-7269
- **Now:** nowhere — no meeting-history view exists to launch it from
- **Verified:** Confirmed via grep across app/lib for Past Meeting/meetingCardHtml/deleteMeeting/editMeetingAttendee — zero hits; the whole parent feature (meeting history) is absent.
- **Fix:** Ships with a Past Meetings rebuild (tracked as its own, larger gap outside this batch).

### `F0624` [MISSING] Per-meeting 'Delete meeting' button
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7153, deleteMeetingToken L7299-7317
- **Now:** nowhere — same absent parent feature as F0623
- **Verified:** Distinct control from F0623 (delete vs. edit-roster); both would need to ship together with any Past Meetings rebuild, so not a duplicate of each other.
- **Fix:** Ships with the Past Meetings rebuild.

### `F0626` [MISSING] Weekly Report lost its full per-week ✓/E/✗ grid (rolled up to one rate per activity instead)
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L8080-8122 (renderServantAttendanceReport, one column per week)
- **Now:** app/portal/(app)/servant-attendance/report/page.tsx (whole file read) — one column per activity, rolled-up ratio only
- **Verified:** Confirmed via full-file read: the 'By servant' table has one column per activity showing an attended/held ratio over the whole range; no per-week columns or drill-in exist.
- **Fix:** Add a week-by-week drill-in per servant/activity.

### `F0627` [MISSING] '✓ Select All (Attended)' bulk button
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7858, sabSelectAll L7936-7938
- **Now:** nowhere — app/portal/(app)/servant-attendance/ServantGrid.tsx has no bulk control
- **Verified:** Confirmed via full-file read.
- **Fix:** Add a 'mark all present' bulk action.

### `F0628` [MISSING] '✕ Clear Selection' bulk button
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7859, sabClearSelection L7940-7945
- **Now:** nowhere — same file, no bulk control
- **Verified:** Distinct control from F0627 (clear vs. select-all); not a duplicate of it.
- **Fix:** Add a 'clear all pending changes' bulk action.

### `F0629` [MISSING] Click a servant's avatar/name to open their profile
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7899, adOpenServantProfile
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx:135-146 (plain text, never a Link)
- **Verified:** Confirmed via full-file read, even for the admin role.
- **Fix:** Wrap the name in a Link to /portal/admin/servants/[id] when permitted.

### `F0630` [MISSING] 'Edit Activity Days' header button
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7825
- **Now:** app/portal/(app)/servant-attendance/page.tsx header actions (lines 35-39) — only 'Weekly report' link
- **Verified:** Confirmed via file read; no activity-day editor entry point on this page.
- **Fix:** Shared fix with the equivalent My Attendance finding — add an activity-day editor entry point for admins.

### `F0390` [MISSING] No non-destructive 'View ID' button on the student profile — but Reset PIN already reveals the (unchanging) login ID in one click
- **Role:** servant · **Area:** studentProfile
- **OG:** L5073 (View ID button on profile header), showServantCredentialsModal L3699 (modal with email/copy share actions)
- **Now:** nowhere as a dedicated view; app/portal/(app)/students/[id]/StudentProfileActions.tsx 'Reset PIN' returns {loginId, pin}
- **Verified:** Confirmed zero hits for View ID/credentials-modal/email-share anywhere in the codebase. However, resetStudentPin() (lib/portal/actions/students.ts:107) never changes loginId, only pinHash, and its result panel already shows both the (unchanged) ID and a fresh usable PIN in one click and one screen. So the practical need — 'tell me this kid's login details right now' — is one click away, just phrased as a PIN reset rather than a plain lookup, and it unnecessarily invalidates the old PIN each time (though it does not touch the printed QR card, which encodes loginId, not PIN). Not a clean substitute, but not a dead end either.
- **Fix:** Add a genuinely non-destructive 'View ID' action (shows the current loginId only, no PIN, no account mutation) alongside the existing 'Reset PIN', and add copy/email-to-parent buttons using Student.parentEmails.

### `F0391` [MISSING] Certificate generation (4 types + custom, printable) is completely gone, with no substitute anywhere
- **Role:** servant · **Area:** studentProfile
- **OG:** L5075 (Certificate button), openCertificateModal/generateCertificate L6517-6579
- **Now:** nowhere
- **Verified:** grep -rli certificate across app/portal, components/portal, lib/portal (excluding _incoming) returns zero hits. OG feature confirmed real and reasonably substantial. Not tied to any weekly task (attendance, finding a student, Sunday printing) and no underlying data is at risk — a servant could produce a certificate outside the portal in the interim.
- **Fix:** Rebuild certificate generation and print flow as a standalone page/modal off the student profile, once higher-priority weekly-workflow gaps are addressed.

### `F0396` [MISSING] No exam-results card on the student profile page (data exists, just not shown here)
- **Role:** servant · **Area:** studentProfile
- **OG:** L5097 (exam results card), computed at L5053-5058
- **Now:** nowhere on app/portal/(app)/students/[id]/page.tsx; QuizResult data exists in schema and is used by the dashboard's class-wide ExamsWidget and the /exams module
- **Verified:** Read the full student profile page: only 'Points ledger' and 'Attendance' cards are present, confirmed no exam-results card. Not a weekly task, and the underlying QuizResult data is not lost or hidden system-wide — it's visible in the exams module and the dashboard widget, just not consolidated onto this one page.
- **Fix:** Add a compact 'Exam results' card (last ~10 results, pass/fail coloring) back to the student profile page, pulling from the same QuizResult query the exams module already uses.

### `F0392` [DEGRADED] Attendance stat lost its 'N unexcused · N excused' breakdown hint
- **Role:** servant · **Area:** studentProfile
- **OG:** OG L5080
- **Now:** app/portal/(app)/students/[id]/page.tsx:117-124 (StatCard hint = '{attended} of {held}')
- **Verified:** Confirmed the hint text doesn't show the breakdown. Also confirmed the data is already computed: AttendanceRateResult (lib/portal/reports.ts:31-43) already carries `excused` and `absent` fields on the same `rate` object used for this StatCard — the finding's own suggested fix (restore the counts in the hint text) is exactly right and trivial, no new query needed.
- **Fix:** Change the hint to include `${rate.absent} unexcused · ${rate.excused} excused` — both values already exist on `rate`.

### `F0393` [MISSING] Stat: Avg Score (exam average) missing from student profile
- **Role:** servant · **Area:** studentProfile
- **OG:** OG L5081
- **Now:** nowhere on app/portal/(app)/students/[id]/page.tsx
- **Verified:** Confirmed exactly 4 StatCards exist (Points, Sunday attendance, Class rank, Missed in a row); grep for quizAverage/examAverage/Avg Score/exam on the file returns nothing.
- **Fix:** Add an Avg Score StatCard back, computed from the student's quiz results.

### `F0395` [MISSING] Bible Reading Streak card + Read-today badge ⚠️ *unverified*
- **Role:** servant · **Area:** studentProfile
- **OG:** Card showing consecutive days of Bible reading and whether read today
- **Now:** nowhere
- **Fix:** Add a Bible Reading Streak feature if the church still wants to track this.

### `F0398` [MOVED] Points History: per-row 'Undo' button ⚠️ *unverified*
- **Role:** servant · **Area:** studentProfile
- **OG:** Reverses a specific point transaction directly from the student's profile
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx:74,305-307
- **Fix:** Add an Undo action directly on the student profile's points ledger, not only on the class-wide Points page.

### `F0399` [MISSING] Points History: per-row 'Delete' button (permanent) ⚠️ *unverified*
- **Role:** servant · **Area:** studentProfile
- **OG:** Permanently deletes a point log entry (hard delete)
- **Now:** nowhere
- **Fix:** Add a permanent-delete action for point entries if servants need to correct mistaken entries without leaving a visible undo trail.

### `F0053` [DEGRADED] Servants have no dedicated Students page — the roster itself is present on the class page, but its whole toolbar (search, Export CSV, Export IDs & PINs, Import CSV, Template, Bulk Edit) is gone, not just moved
- **Role:** servant · **Area:** students
- **OG:** OG sidebar item (4011, id=sv-sbi-st), page header 'Students'/'Class roster' (4583), page body incl. toolbar (4630-4691), four call sites navigating to it (4559, 5071, 6732, 9981)
- **Now:** app/portal/(app)/classes/[id]/page.tsx (Roster section, confirmed present with Avatar/points/attendance-% per student) — but no search input, no Export CSV, no Export IDs, no Import CSV, no Bulk Edit anywhere on that page (only an 'Add student' button); CSV import/export for students does exist but only at /portal/admin/data, which is ADMIN-only in lib/portal/nav.ts
- **Verified:** The 'MISSING' state is wrong — I read app/portal/(app)/classes/[id]/page.tsx directly and the roster (grid of student cards with photo, points, attendance rate) is genuinely there and functional. What's actually true and worth flagging: the whole toolbar the finding calls out really is gone from that page, and a servant (as opposed to an admin) has literally no CSV export/import tool for their own class at all, since /portal/admin/data is admin-only. Corrected to DEGRADED (present, but stripped of search + all bulk tooling) and medium severity — real friction for a large class, but not a weekly-task blocker (the roster itself, which is what's actually needed weekly, works fine).
- **Fix:** Add a search input to the class roster, and either surface Export/Import CSV to servants scoped to their own class, or explicitly note in Help that only admins can bulk import/export student data.

### `F0056` [MISSING] Bulk Edit Students is gone entirely — and the Help page still sends admins to a page that doesn't have it
- **Role:** servant · **Area:** students
- **OG:** OG toolbar button (4638), 12-field selector + morphing value input (10518-10539), opener (10541-10583), picker grid (10561-10614), live counter/validation (10616-10664), 8-second undo toast (10650-10685), modal markup (19373-19420)
- **Now:** app/portal/(app)/admin/students/page.tsx — read in full: only per-student Edit (link to /portal/students/[id]/edit) and a Move-class select, no multi-select or bulk-apply UI anywhere; grep for any bulk-edit implementation across the repo is clean
- **Verified:** Confirmed on both counts. Also verified the Help-page claim directly: app/portal/(app)/help/page.tsx lines 67-70 has a 'Edit many students at once' topic linking to /portal/admin/students and describing bulk-editing a field for 'several students together' — a real dead reference to a feature that page doesn't have. Severity corrected from blocker to medium: this is an occasional admin task (e.g., yearly grade promotion), not a weekly one, and the fallback (edit each student individually) is tedious but fully functional with no data loss.
- **Fix:** Either build a bulk-edit UI on /portal/admin/students (multi-select + single-field apply, matching the OG's pattern), or update the Help page copy to stop describing a feature that doesn't exist.

### `F0057` [DEGRADED] Only half of the four toolbar buttons actually 'moved to admin' — Export IDs & PINs and Template download don't exist anywhere, even for admin
- **Role:** servant · **Area:** students
- **OG:** servant Students page toolbar L4633-4637 (Export CSV, Export IDs & PINs, Import CSV, Template), template L10955-10963, exportStudentsCSV L10966 (scoped to _me.classId), exportStudentCredentialsCSV L10997, import L11044-11182
- **Now:** Export CSV / Import CSV: /portal/admin/data → ImportPanel.tsx, gated ADMIN-only. Export IDs & PINs / Template: nowhere at all.
- **Verified:** Confirmed exportStudentsCsv/importStudentsCsv are real, working, ADMIN-gated (if (user.role !== 'ADMIN') notFound()) features at /portal/admin/data — so 'Export CSV' and 'Import CSV' genuinely did move behind an admin gate, as claimed. But ImportPanel.tsx only offers a generic CSV export/import with no PIN column (its own UI text says 'no export ever contains a PIN or a hash'), and grep for 'template' across admin/data and data-tools.ts is empty — so 'Export IDs & PINs' and the 'Template' download were not moved, they were dropped entirely, with no equivalent for any role including admin (see F0377 for why that's likely deliberate, not an oversight). Not a weekly task for any role; downgraded to medium.
- **Fix:** For Export CSV / Import CSV: either relax the gate to student.write scoped to the servant's own class(es), or add a class-scoped 'Import/Export roster' action on the class page. For Template: add a static downloadable header-row template (trivial, currently doesn't exist for anyone). Do not simply re-add a plaintext 'Export IDs & PINs' — see F0377.

### `F0065` [MISSING] No non-destructive way to look up or hand out a student's existing ID/PIN from the admin roster — same underlying gap as F0390
- **Role:** servant · **Area:** students
- **OG:** padlock 'View ID' on every admin student card L3267; modal L3699-3721; email/copy L3723-3752; auto-fires after Add Student L6666/6730 and CSV import L11157-11165
- **Now:** StudentForm.tsx 'created' panel (shown once, at creation only) + StudentProfileActions.tsx 'Reset PIN' (destructive to the old PIN)
- **Verified:** Confirmed the OG padlock button calls the identical showServantCredentialsModal used on the student profile page (same function as F0390). Confirmed the new portal's only mechanisms are the one-time creation panel and the destructive Reset PIN action; no copy/email anywhere. As with F0390, Reset PIN is a workable (if clumsy) one-click substitute that reveals the unchanged loginId plus a fresh usable PIN, so families aren't actually stuck — downgraded accordingly.
- **Fix:** Same as F0390: add a non-destructive 'View ID' button to each admin student card, and add copy/email actions built from Student.parentEmails; keep Reset PIN separate and clearly destructive.

### `F0376` [MOVED] 'Export CSV' is not 'nowhere, any role' — it exists and works for ADMIN at /portal/admin/data
- **Role:** servant · **Area:** students
- **OG:** L4643, exportStudentsCSV() L10966
- **Now:** lib/portal/actions/data-tools.ts:210 exportStudentsCsv(), surfaced in app/portal/(app)/admin/data/ImportPanel.tsx, gated ADMIN-only
- **Verified:** The evidence's grep (exportStudentsCSV|csvEscape|downloadCSV) missed the renamed export because it used the OG's exact function/helper names; the new implementation is exportStudentsCsv (camelCase, different file, different CSV-writer helper) and is real, working, and audited (data.exportStudents). True for a servant's own role (they have zero access), false as a global 'doesn't exist anywhere' claim. Same underlying gap as F0057.
- **Fix:** See F0057's fix. Not a distinct action item from F0057/F0378 — same toolbar, same root cause.

### `F0377` [MISSING] 'Export IDs & PINs' is genuinely gone for every role, and it looks like a deliberate security trade-off, not an oversight
- **Role:** servant · **Area:** students
- **OG:** L4644, exportStudentCredentialsCSV() L10997 (exports plaintext s.pin per student)
- **Now:** nowhere; PINs are bcrypt-hashed (pinHash) and 'deliberately absent' from every export per the codebase's own comment
- **Verified:** Confirmed no CSV or other bulk export of loginId+PIN exists anywhere, including for admin. This isn't an accidental drop: the OG stored PINs in plaintext in Firestore (s.pin), which is what made bulk export possible at all; the new schema only stores a bcrypt hash and never persists a retrievable PIN, so a PIN is only ever knowable at the moment it's created or reset (StudentForm's one-time panel, resetStudentPin, or the CSV-import summary's 'new PINs' callout). The original fix (re-add a CSV export of IDs & PINs) would reintroduce the exact plaintext-secret exposure the port intentionally removed.
- **Fix:** Don't rebuild bulk plaintext PIN export. Instead make the existing one-time reveal moments more useful for real handout scenarios: let the CSV-import 'new PINs' summary be downloaded/printed before the page is left (currently on-screen only), and offer a printable per-class credential handout sheet generated at the moment of a bulk class creation/import, when PINs are briefly known.

### `F0378` [MOVED] 'Import CSV' is not 'nowhere, any role' — it exists for ADMIN, but lost the OG's preview-before-commit step
- **Role:** servant · **Area:** students
- **OG:** L4645-4648, previewStudentsCSV L11037 (shows parsed rows + validation errors, requires a separate confirm before writing)
- **Now:** app/portal/(app)/admin/data/ImportPanel.tsx runImport(), calling lib/portal/actions/data-tools.ts importStudentsCsv()
- **Verified:** importStudentsCsv is real and reachable at /portal/admin/data for ADMIN — the grep in the evidence (csv import helpers) missed it because the new action is named differently. The genuinely new gap not mentioned by the original finding: runImport() commits to the database immediately on 'Import students' with no preview/confirm gate — the created/updated/skipped/error summary only appears after the write already happened, unlike the OG's preview-then-confirm flow. Real regression (a bad file can't be caught before it writes), but affects admin too and isn't a servant-specific or weekly-task gap.
- **Fix:** Add a preview step: show the parsed rows and validation errors from a dry-run before offering a 'Confirm import' button that actually writes. Also see F0057 for the servant-access half of this finding.

### `F0380` [MISSING] Bulk Edit is genuinely missing — and the in-app Help page falsely tells servants it exists
- **Role:** servant · **Area:** students
- **OG:** L4649, openBulkEditStudents L10541, applyBulkEditStudents/undoBulkEditStudents L10651-10680
- **Now:** nowhere; app/portal/(app)/admin/students/page.tsx has only a per-student 'Move to class' select and an 'Edit' pencil link, no multi-select or batch-field UI
- **Verified:** grep -rn bulk across app/portal, components/portal, lib/portal returns nothing relevant. Worth flagging beyond the original evidence: app/portal/(app)/help/page.tsx:68-71 has a Help topic titled 'Edit many students at once,' describing exactly this feature ('bulk edit changes one field... for several students together') and linking to /portal/admin/students — a page that does not have this capability at all. The help text actively misleads whoever reads it. Not a weekly task and no data is at risk (each student remains individually editable); downgraded to medium, though the stale help copy should be fixed regardless of when the feature itself is rebuilt.
- **Fix:** Add a bulk-edit flow for the class/admin roster (multi-select + apply-one-field), or, if deprioritized, remove/rewrite the misleading Help topic so it doesn't promise a feature that isn't there.

### `F0382` [MISSING] Student's own email field is missing from the UI — but the storage column already exists on Account and is already being fetched; no schema change is needed
- **Role:** servant · **Area:** students
- **OG:** L4659 (optional student email field on the add form)
- **Now:** components/portal/StudentForm.tsx (no email input); lib/portal/data/students.ts studentSelect already selects account.email (L23)
- **Verified:** The claimed root cause is wrong: Account (1:1 with Student via accountId) already has an email String? column (prisma/schema.prisma:199), and studentSelect already loads account.email into every student-profile page load — the plumbing exists end-to-end except the last mile (no input in StudentForm.tsx, and updateStudent()/the profile page never read or write it). Separately, the one-time Firebase migration (lib/portal/import-transform.ts:318-320) deliberately folds a migrated student's legacy 'email' field into parentEmails, with an explicit comment that the OG's student-email field 'almost always holds a parent's address' — a reasonable, intentional call, not data loss. Downgraded: this is a genuine but small UI-wiring gap, not a data-model gap requiring a migration.
- **Fix:** Add an 'Email' field to StudentForm.tsx and thread it through createStudent/updateStudent into account.update({ email }); display it on the profile. No prisma migration required — the column and the read query already exist.

### `F0383` [MISSING] Student's own phone field is missing from the UI, but the data was NOT lost in migration and the column already exists — same class of bug as F0382
- **Role:** servant · **Area:** students
- **OG:** L4663 (optional phone field on the add form)
- **Now:** components/portal/StudentForm.tsx (no phone input); Account.phone column exists and studentSelect already fetches it (lib/portal/data/students.ts:23)
- **Verified:** The claim 'no phone column on Student model... add a phone column' is misleading in the same way as F0382: Account already has a phone String? column (schema.prisma:200), used by every role. Traced the one-time migration further than the original evidence: unlike email, a student's phone is NOT nulled out — lib/portal/import-transform.ts:307 sets base.phone = normalizePhone(u.phone) and never clears it for role === 'STUDENT', and scripts/import-firebase.ts:72/82 writes that value into Account.phone for every account including students. So a migrated student's original phone number is very likely already sitting in the live database, not lost — the gap is purely that no form or page ever reads or writes it. This meaningfully changes the recommended fix.
- **Fix:** Add a 'Phone' field to StudentForm.tsx and wire it to account.update({ phone }) in createStudent/updateStudent; show it on the profile. No migration or backfill needed — check account.phone for existing migrated students first, it may already be populated.

### `F0067` [DEGRADED] The student search is no longer live and no longer exists on the servant's roster at all ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Two live filters: the servant Students page had a full-width `🔍 Search by name or email...` input filtering on every keystroke, and Admin → All Students had the same input plus a class filter, both `oninput`
- **Now:** /portal/admin/students has a Search field but it is a GET form needing a Search button press or Enter and a full round trip. /portal/classes/<id> (the servant's only roster) has no search box at all.
- **Fix:** Make the admin search an instant client-side filter over the rendered cards (data-name/data-email equivalents) as the OG did, add the same input above the class page Roster, and include parentEmails in the server query.

### `F0068` [DEGRADED] The roster cards lost the exam-average and attendance-streak pills ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Servant → Students, the card grid: up to three pills under each name — attendance % colour-banded, "{N}% avg" exam average in indigo, and "{N}w streak" in gold
- **Now:** /portal/classes/<id> Roster cards show the attendance % pill and a "{N} pts" pill, plus Follow-up / Review badges. There is no exam average and no streak anywhere on the card.
- **Fix:** Add a QuizResult/ExamResult aggregate and a present-streak calculation to the class page query and render the two extra pills, keeping the OG's colours and omission rules.

### `F0069` [DEGRADED] Servants can no longer remove a student from their own class ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Student Profile, the final red-bordered danger card: "Remove student" / "This permanently deletes their account and records." with a Remove button — available to the servant for their own class's students
- **Now:** /portal/students/<id> → Actions card → "Delete student", rendered only when `isAdmin`
- **Fix:** Either allow delete under `student.write` for the student's own class (matching the OG) with the typed confirm, or — if the restriction is deliberate — say so in the UI with a disabled button and an "ask an admin" hint, rather than hiding the card the servant is looking for.

### `F0070` [DEGRADED] The student add/edit form lost the split Street / City / State / ZIP address inputs and the "Add" flow left the page ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Servant → Students → the "+ Add" pill toggled an inline "Add New Student" panel open IN PLACE at the top of the roster (maroon header bar, ✕ Cancel chip), with Street Address on its own line above a 1fr/80px/100px City / State / ZIP(maxlength 10) row
- **Now:** /portal/classes/<id>/students/new — a separate full page, with a single free-text "Address" input
- **Fix:** Restore the Street / City / State / ZIP sub-grid in StudentForm (composing to the single address column on save, as the OG did), and render the create form inline on the class page / new servant Students page instead of on its own route.

### `F0375` [MOVED] Page header title 'Students' / subtitle 'Class roster' ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Dedicated page header for the roster
- **Now:** app/portal/(app)/classes/[id]/page.tsx:76-89 PageHeader title={cls.name}
- **Fix:** None required if the page merge is intentional; otherwise restore a distinct Students header.

### `F0379` [MISSING] 'Template' link (downloads example CSV) ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Downloads a starter CSV with header + example row matching the import format
- **Now:** nowhere, any role
- **Fix:** Add back once CSV import is rebuilt.

### `F0384` [DEGRADED] Add form fields: Street Address + City + State + ZIP ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Four separate structured address fields
- **Now:** components/portal/StudentForm.tsx:89 single 'Address' field
- **Fix:** Split back into structured fields if mailing/reporting by city/state/zip is needed; otherwise document as an intentional simplification.

### `F0386` [MISSING] Roster card: avg quiz score % badge (indigo) ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Shows the student's average exam score if any exist
- **Now:** nowhere on this card
- **Fix:** Add the avg score badge back to each roster card.

### `F0387` [MISSING] Roster card: 'Xw streak' badge ⚠️ *unverified*
- **Role:** servant · **Area:** students
- **OG:** Shows consecutive weeks present when streak > 0
- **Now:** nowhere on this card
- **Fix:** Add the streak badge back to each roster card.

### `F0454` [MISSING] No live open-case count badge on the Follow-ups nav item
- **Role:** servant · **Area:** visitation
- **OG:** L4015 (#visit-badge on nav item), refreshVisitBadge L17056-17095
- **Now:** nowhere; components/portal/Shell.tsx NavItem interface is {href, label, icon?, section?}, no count field, no badge markup in the render loop
- **Verified:** Confirmed by reading the NavItem type and the nav-render loop directly — no badge mechanism exists for any nav item except the (separate, already-present) birthdays topbar chip. However the Follow-ups page itself is a normal, always-visible nav item that shows the complete open-case list on load; nothing is hidden or harder to reach, the badge was only a proactive reminder that work exists before a servant navigates there. Downgraded to medium (a missed nudge, not a blocked task).
- **Fix:** Add an unread/open-case count badge to the Follow-ups nav item, computed the same way the follow-ups page itself already computes its open-case list.

### `F0455` [MOVED] Per-class absence threshold can only be changed by an admin, not by the class's own servant
- **Role:** servant · **Area:** visitation
- **OG:** L17276-17278 (inline number input + Save in the Follow-up page header), L17473-17483 (write + re-run auto-creation)
- **Now:** app/portal/(app)/admin/classes/ClassManager.tsx:116, via updateClass; app/portal/(app)/admin/classes/page.tsx gates the whole page to ADMIN (notFound() otherwise)
- **Verified:** Confirmed the only write path for visitationThreshold anywhere in the codebase is the admin classes manager, gated to ADMIN. Confirmed /portal/follow-ups has no threshold control of its own. This is an infrequent, per-class tuning knob, not a weekly task, and a servant can simply ask an admin to change it (no data loss, no blocked recurring workflow). Downgraded to medium.
- **Fix:** Give a servant with followup.write on a class an inline threshold control on /portal/follow-ups scoped to their own class(es), the same as the OG.

### `F0470` [MISSING] Trash icon-button -> delete case, with styled confirm "Delete follow-up case for X? This cannot be undone."
- **Role:** servant · **Area:** visitation
- **OG:** Trash button at L17253; deleteVisitationCase() at L17534-17544 (styled confirm, then permanently deletes the case doc, no undo)
- **Now:** nowhere
- **Verified:** Read every function in lib/portal/actions/followups.ts in full (logContact, resolveCase, reopenCase, createManualCase) - none deletes. Grepped deleteCase|removeCase|archiveCase|followUpCase.delete across app/ and lib/ - zero hits. Checked the FollowUpCase model in prisma/schema.prisma directly - no deletedAt/soft-delete field either. The gap is real, but the severity is overstated: resolveCase lets a servant close out an erroneous or duplicate case (pick 'Other' as the resolve reason) as a workaround, so no weekly task is blocked and no data is actually lost - if anything stale/wrong cases are retained forever rather than lost, which is a data-hygiene annoyance (pollutes a student's history and the resolved-count tile) rather than a high-severity gap under this batch's calibration (high = cannot find it / data lost or corrupted).
- **Fix:** Add a delete (or, better, a soft-archive to preserve audit trail) action for follow-up cases, permission-gated like followup.write, with a confirm-before-destroy step.

### `F0456` [MISSING] Manual case: Type select (7 categories) ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Absence/Health/Family/Behavior/Spiritual guidance/Academic/Other
- **Now:** nowhere
- **Fix:** Add a type enum column to FollowUpCase and expose it on the form

### `F0460` [MISSING] Duplicate-open-case guard ("This student already has an open case") ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Blocks creating a 2nd open case for the same student+class
- **Now:** nowhere
- **Fix:** Add the same pre-check to prevent duplicate open cases

### `F0461` [DEGRADED] Auto-creation/re-sync recomputed every time the tab is opened ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Opening the Follow-up view always recomputes every student's streak and opens/closes/updates cases live, self-healing after any data change
- **Now:** Logic now runs only inside saveAttendance (lib/portal/actions/attendance.ts:98-154); opening /portal/follow-ups does not recompute anything
- **Fix:** Also run the recompute on Follow-ups page load, or after any attendance-affecting write (imports, admin repairs)

### `F0464` [DEGRADED] Open-case ordering (worst-first by consecutiveAbsences descending) ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Most at-risk student surfaces first
- **Now:** follow-ups/page.tsx:30 orders by createdAt asc (oldest-opened first) instead
- **Fix:** Re-order by consecutiveAbsences desc so the most at-risk student surfaces first

### `F0465` [DEGRADED] Case row latest logged note preview ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Row shows the most recent contact-log note, kept in sync via note/lastContact fields
- **Now:** Row always shows the fixed opening title (page.tsx:112); FollowUpCase schema has no current-note field at all
- **Fix:** Surface the newest FollowUpLog.note on the list row

### `F0466` [MISSING] Case row call quick-link (tel:) ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Circular icon-link shown when phone on file
- **Now:** Only on the case detail page's Family Contacts card ([id]/page.tsx:125,144), not on the list row
- **Fix:** Add the quick-dial icon back to the list row

### `F0473` [MISSING] History "Select All" / "Clear" multi-select toggle ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Gold checkbox per card, turns solid red with white tick when selected
- **Now:** nowhere
- **Fix:** Add multi-select if bulk delete is restored

### `F0474` [MISSING] "Delete Selected (N)" bulk-delete bar with confirm ⚠️ *unverified*
- **Role:** servant · **Area:** visitation
- **OG:** Bulk-deletes selected resolved cases from history
- **Now:** nowhere (depends on delete existing at all)
- **Fix:** Bundle with the single-delete-action fix

### `F0437` [MOVED] Sidebar nav item "Attendance Report" ⚠️ *unverified*
- **Role:** servant · **Area:** weeklyreport
- **OG:** Own top-level sidebar icon
- **Now:** Folded into the same "Reports" sidebar item, as the default Attendance tab of /portal/reports
- **Fix:** See reports-page nav fix above; the two OG sidebar items collapsed into one with tabs.

### `F0438` [DEGRADED] Page header "Attendance Report" + subtitle "Present / Absent across the 6 weekly sessions, by month" ⚠️ *unverified*
- **Role:** servant · **Area:** weeklyreport
- **OG:** ph-t/ph-s header
- **Now:** app/portal/(app)/reports/page.tsx:260-263 header "Attendance · {month}", subtitle "{class} · {one session's label}" — no longer describes 6 sessions since only one shows at a time
- **Fix:** Restore the multi-session table (see row 7) so the subtitle claim is true again.

### `F0439` [DEGRADED] "⬇ Download Blank Form" button ⚠️ *unverified*
- **Role:** servant · **Area:** weeklyreport
- **OG:** 1-click, opens a new tab with a print-ready blank grid covering all 6 sessions
- **Now:** Replaced by a "Blank form for paper" checkbox (ReportFilters.tsx:121-126) requiring check + "Show report" + "Print blank form" (3 steps), and still single-session only
- **Fix:** Add a one-click "Download blank form" action covering all sessions for the month, matching OG's single-step flow.

### `F0829` [MISSING] Feed tag filter chip bar is missing — confirmed, but this is friction (medium), not a high-severity gap, since every post is still fully visible
- **Role:** student · **Area:** Class Feed / 'Class Posts' page (loadFeedPosts)
- **OG:** index.stripped.html L13556-13567 (student-only chip bar), L16091-16106 (filterFeedTag)
- **Now:** components/portal/PostCard.tsx still stores/displays the tag as a badge (L51-93) but nothing filters by it anywhere in app/lib/components
- **Verified:** Confirmed via grep that filterFeedTag/feedActiveFTag/any tag-filter mechanism has zero hits.
- **Fix:** Add a client-side chip-filter component gated to STUDENT role, as given.

### `F0794` [MISSING] PWA installability: web app manifest + iOS "Install this app" banner ⚠️ *unverified*
- **Role:** student · **Area:** Global <head> (manifest link, apple touch icons, theme-color) plus an auto-shown onboarding banner over any page
- **OG:** <link rel="manifest">, apple-touch-icon, four apple-mobile-web-app-* metas, theme-color #6F1D1B in <head>. Separately, #ios-install-banner auto-shows 1500ms after load, only on iPad/iPhone/iPod, only when not already standalone, and only if not previously dismissed (localStorage.iosInstallBannerDismissed): heading 'Install this app', body about adding to Home Screen, a dismiss X, and a 3-step Safa
- **Now:** nowhere
- **Fix:** Add app/manifest.ts (Next 14 App Router manifest route) with name/icons/theme_color/display:standalone, wire the missing apple-mobile-web-app-* metadata via Next's metadata export, and port the iOS-only install banner as a small localStorage-dismissible client component mounted in the portal root layout.

### `F0798` [MISSING] Mobile bottom tab bars are missing — confirmed, but this is friction (medium): the existing hamburger overlay is fully functional and reaches every page
- **Role:** student · **Area:** Global shell, all four portals -- bottom of every phone screen
- **OG:** index.stripped.html L19936-19970 (4 persistent 5-tab-plus-More bottom bars)
- **Now:** components/portal/Shell.tsx has a hamburger button opening a full-sidebar overlay with every nav item; no bottom-nav/mob-nav/BottomNav hits anywhere
- **Verified:** Confirmed the overlay actually exposes MORE items than the OG's 5-tab bar did, and the hamburger is always visible in the sticky mobile identity bar — so no task is blocked or hidden, only extra taps are required.
- **Fix:** Add a fixed bottom nav as a UX improvement, as given — not a functional fix.

### `F0791` [MISSING] exam-badge sidebar count and its 48-hour 'new exam' rule ⚠️ *unverified*
- **Role:** student · **Area:** Student shell (sidebar 'Daily Quiz'/Exams nav item)
- **OG:** Badge shows count of exams created in the last 48 hours and not yet done (newExams) -- narrower/different from the bell's broader 'all pending, not overdue' exam rule. Cleared the instant the student opens the Exams tab (clearExamBadge, wired to sidebar, mobile nav, and goToExams()).
- **Now:** nowhere; bell/dashboard only expresses the broader 'pending exam' rule (lib/portal/notifications.ts lines 63-80), one item per exam, no aggregate 'N new' concept
- **Fix:** If parity is required, add a sidebar badge (once NavItem supports counts) plus a 'freshly posted' (<=48h) tone/flag on individual exam notifications so the urgency cue OG gave is not lost, distinct from the general pending-exam list.

### `F0785` [DEGRADED] Own-birthday bell item ('Happy birthday this week!') ⚠️ *unverified*
- **Role:** student · **Area:** Student shell / dashboard bell
- **OG:** Fires for the whole Mon-Sun calendar week containing the student's DOB, via getCurrentWeekRangeET(), not just the exact day.
- **Now:** lib/portal/notifications.ts:94 (daysUntilBirthday(...) === 0)
- **Fix:** Change the STUDENT own-birthday check to use the same Mon-Sun calendar-week test as the servant birthdays rule (mondayOf/sundayOf), not daysUntilBirthday===0.

### `F0732` [MISSING] Point Master badge (≥50pts) dropped in a wholesale badge/level redesign
- **Role:** student · **Area:** achievements
- **OG:** index.stripped.html L12253 — allBadges array, id 'point_master'
- **Now:** lib/portal/achievements.ts BADGES (10/100/500-pt badges) and LEVELS (50pt = Candle, level 2)
- **Verified:** Confirmed: no 50-pt-specific badge exists in the new BADGES table. But this is one piece of a full, intentional 11-badge redesign (all keys/thresholds changed), not an accidental drop, and no weekly church task depends on it.
- **Fix:** Product decision, not a bug fix: either add a 50-pt badge back or accept the new Seed/Candle/Lampstand/Crown/Star level ladder as the replacement.

### `F0734` [DEGRADED] Badge key 'faithful' reused with a different rule (lifetime count → 3-in-a-row streak)
- **Role:** student · **Area:** achievements
- **OG:** index.stripped.html L12225, L12255 — attCnt (distinct attendance days) ≥10
- **Now:** lib/portal/achievements.ts:126-132 — faithful uses attendanceStreak (presentStreak, resets on a miss)
- **Verified:** Confirmed same key, different semantics. But no legacy Firebase badge data is migrated into StudentAchievement (grepped all usages), so no student silently gains/loses a badge they'd already earned — it's a naming collision worth a deliberate decision, not a live data bug.
- **Fix:** Rename the new badge's key (e.g. 'faithful-streak') or restore a lifetime-count badge under the old key so 'faithful' means one thing across any future data reconciliation.

### `F0735` [MISSING] Attendee/'Regular' badge (≥5 lifetime sessions) dropped in the badge redesign
- **Role:** student · **Area:** achievements
- **OG:** index.stripped.html L12256
- **Now:** lib/portal/achievements.ts BADGES — closest is 'steadfast' (8-in-a-row streak, different mechanic)
- **Verified:** Confirmed no lifetime-attendance-count badge exists in the new table. Same wholesale redesign as F0732/F0734.
- **Fix:** Add back or accept the redesign as a deliberate product decision.

### `F0736` [MISSING] Champion badge (rank #1) missing — not wired in, though a class rank is already computed elsewhere
- **Role:** student · **Area:** achievements
- **OG:** index.stripped.html L12257
- **Now:** lib/portal/achievements.ts AchievementStats (no rank field); lib/portal/data/community.ts loadAchievements never ranks
- **Verified:** Confirmed no rank field/query in achievements. 'Structurally impossible' overstates it though: lib/portal/data/dashboard.ts:151 already computes a per-student class rank for the dashboard leaderboard from the same PointEntry data — the stat exists in the codebase and could be reused, no schema change needed.
- **Fix:** Reuse the rank calculation already used by the dashboard leaderboard, thread it into AchievementStats as a new field, and add a champion badge keyed on rank===1.

### `F0728` [MOVED] Badge id first_quiz 🎓 "First Quiz" (≥1 quiz, +5pts) ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** BADGES[5] 'word-student' 📖 "Student of the Word" — same 1-quiz condition, renamed, no point-reward field
- **Fix:** rename back or accept

### `F0733` [MOVED] Badge id centurion 💎 "Centurion" (≥100pts, +20pts) ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** BADGES[1] 'hundredfold' 💯 "Hundredfold" — same 100pt condition, renamed, icon 💎→💯 (💯 reused from OG's perfect badge)
- **Fix:** rename back or accept

### `F0737` [MISSING] Badge id streak 🔥 "Streak Hero" (≥4-week attendance streak, +15pts) ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** 🔥 icon reassigned to 'month-in-the-word' (30-day READING streak); no attendance-streak badge distinct from faithful/steadfast
- **Fix:** add back or accept redesign

### `F0738` [MISSING] Badge id legend 🌟 "Legend" (≥350pts, +30pts) ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** closest point badge is 'treasure' 👑 at 500pts, different name/icon/threshold; 🌟 and 'Legend' unused
- **Fix:** add back or accept redesign

### `F0739` [MISSING] Point-reward chip (+<pts>) on earned badge cards ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** earned cards show a plain ✓ chip, no point value — the badge schema itself carries no point-reward field
- **Fix:** add a point-reward field back to the Badge type if parity intended

### `F0740` [DEGRADED] "In Progress" section — top 4 near-complete locked badges as a distinct horizontal-row list, duplicated above the full locked grid ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** folded into the single 'Locked badges' grid, sorted nearest-first but not visually distinguished
- **Fix:** add a top 'Almost there' strip pulling locked.slice(0,4) above the full grid

### `F0717` [MISSING] Month-by-month attendance calendar grid missing from My Attendance
- **Role:** student · **Area:** attendance
- **OG:** index.stripped.html L12464-12512 — byMonth grid, 7-col CSS grid, colored day cells
- **Now:** app/portal/(app)/my-attendance/page.tsx — StudentAttendance renders RateCard tiles + a flat 'Recent' list only
- **Verified:** Confirmed by reading the whole page: no month-grid rendering exists anywhere. Real visual loss, but the same underlying data (which days were present, rate per session) is still fully visible via the rate cards and the recent list — nothing is hidden or blocked.
- **Fix:** Add a simple CSS-grid calendar (7 cols, colored present/today/Sunday cells) grouped by month, reusing the existing AttendanceRecord data this page already loads.

### `F0205` [DEGRADED] The student's own Attendance page lost the month-by-month calendar and the "Pts Earned" tile ⚠️ *unverified*
- **Role:** student · **Area:** attendance
- **OG:** OG student sidebar → Class → Attendance: a 3-stat strip (Present / Pts Earned / Rate), the streak banner, then one 7-column calendar card per month with attendance, newest first, then the history list
- **Now:** /portal/my-attendance (student branch) — three tiles (rate, Sundays in a row, standing), the streak banner, per-session rate cards, a "Recent" list capped at 20
- **Fix:** Add the month calendar cards back to the student branch of /portal/my-attendance (present = brand maroon fill, today = gold ring, Sunday-not-present = cream) and a "Points earned" tile summing PointEntry rows with source ATTENDANCE.

### `F0047` [DEGRADED] 24-hour hard session expiry replaces the OG's indefinite persistent login
- **Role:** student · **Area:** auth-login
- **OG:** index.stripped.html L44-54 — onAuthStateChanged with no setPersistence call (Firebase default: browserLocalPersistence)
- **Now:** lib/auth.config.ts:36-39 — session.maxAge = 24*60*60, no updateAge override
- **Verified:** Confirmed the OG never calls setPersistence (grep empty) so it runs indefinitely until explicit sign-out. Confirmed lib/auth.ts registers BOTH the site-admin and the Sunday-School-portal Credentials providers under the one NextAuth({...authConfig}) call, so this maxAge genuinely governs student/servant portal sessions too, not just the site CMS. Confirmed the 'Remember my ID' checkbox (PortalLoginForm.tsx) only pre-fills the ID field via localStorage — it does not extend the session, so it isn't the mitigation the original evidence implied. Real regression, but a 4-digit ID + PIN login is quick and still works — this is friction, not a blocked task.
- **Fix:** Raise maxAge to match a weekly/monthly rhythm and set updateAge so activity refreshes the token, closer to the OG's effectively-indefinite session; keep the 'Remember my ID' UX as a separate, lesser convenience.

### `F0048` [DEGRADED] The 4-digit format message was replaced by a silently disabled Sign in button ⚠️ *unverified*
- **Role:** student · **Area:** auth-login
- **OG:** Inline error above the fields, before any network call: 'Please enter a 4-digit ID and PIN.'
- **Now:** /portal/login — the button is disabled with no explanation
- **Fix:** Let the button stay enabled, and on submit show the OG's exact copy in the existing error banner when either field fails /^\d{4}$/ (PIN allowing 4-8 to match lib/portal/login.ts:48). Or keep it disabled but add a persistent hint under the fields — never a dead control with no words.

### `F0750` [MISSING] Entire mobile bottom-nav pattern removed (all 5 pinned tabs, every role) — not Reading-specific
- **Role:** student · **Area:** biblereading
- **OG:** index.stripped.html L19935-19942 (#st-mob-nav: Home/Exams/Grades/Reading/Profile/More), duplicated per-role at L19943+ (#sv-mob-nav, #ad-mob-nav, etc.)
- **Now:** components/portal/Shell.tsx — only a sticky top identity bar + hamburger opening the full sidebar overlay; no bottom-nav markup for any role
- **Verified:** Confirmed by reading Shell.tsx in full: there is no bottom nav at all, for any role, not just missing a Reading tab. This finding is scoped too narrowly — the whole one-tap pattern (Home/Exams/Grades/Reading/Profile) is gone for every role equally. Reading is still reachable in one extra tap via the sidebar's Learning section, so this is added navigation depth, not a lost page.
- **Fix:** This is a Shell-level decision (add a bottom tab bar on mobile) affecting all 5 tabs across all 4 roles, not a Reading-specific fix.

### `F0752` [MISSING] Tap-to-expand full Bible passage text (bible-api.com) missing from Daily Readings
- **Role:** student · **Area:** biblereading
- **OG:** index.stripped.html L13372-13400 — expandReadingPassage(), fetches bible-api.com/{ref}?translation=web, chevron toggle
- **Now:** app/portal/(app)/readings/page.tsx — each reading renders as a static citation-only <dt>/<dd> pair, no expand affordance
- **Verified:** Confirmed zero hits for bible-api|expandReading|World English Bible|passage anywhere in the new codebase, and confirmed by reading the full readings page that there's no click-to-expand UI. Real feature loss, but the reference itself is always shown, so a student still knows what to read — just needs a separate Bible/app to read the text.
- **Fix:** Add a click-to-expand affordance on each reading row using bible-api.com (or an equivalent) exactly as the OG did.

### `F0751` [DEGRADED] Readings grouped by service (Vespers🕯️/Matins🌅/Liturgy✟) with per-service colour ⚠️ *unverified*
- **Role:** student · **Area:** biblereading
- **OG:** loadFeedBible groups items into 3 named services
- **Now:** readings/page.tsx L85-108 renders one generic Card per 'section' with a single BookOpen icon, no vespers/matins/liturgy grouping visible
- **Fix:** confirm and restore vespers/matins/liturgy grouping if the data still separates them

### `F0754` [DEGRADED] Current-calendar-month read-day grid (10 columns, 'Month Year' label) ⚠️ *unverified*
- **Role:** student · **Area:** biblereading
- **OG:** Day 1 through last day of the current month
- **Now:** rolling last-30-days window ending today (still 10 columns) in ReadingCheckIn.tsx L71-96
- **Fix:** cosmetic/semantic difference — confirm if acceptable or restore calendar-month framing

### `F0242` [MISSING] Topbar birthday chip hard-coded to never show for students
- **Role:** student · **Area:** birthdays
- **OG:** index.stripped.html L1543-1546 (student topbar markup), L11614 (loadNextMeetingCard('st', null))
- **Now:** lib/portal/data/dashboard.ts:189 — computeNextBirthday: 'if (user.role === STUDENT || classIds.length === 0) return null'
- **Verified:** Confirmed: an unconditional exclusion of every student, not merely a fallback for students with no class. Verified the suggested fix is actually feasible — lib/portal/session.ts:36-40 populates classIds=[the student's own classId], and visibleClassIds/isAssigned (permissions.ts:53-66) already admit that class, so removing the short-circuit works with no other plumbing changes. Real, confirmed bug; a social/awareness nicety though, not a task-blocker.
- **Fix:** Remove the 'user.role === STUDENT' branch of the short-circuit so a student's own class birthdays compute exactly like every other role's.

### `F0080` [DEGRADED] Dashboard 'Top of the class' widget is a plain list — full leaderboard treatment lives one tap away
- **Role:** student · **Area:** dashboard
- **OG:** index.stripped.html L11792-11849 — medals, avatars, progress bars, 'View all' pill, appended own-rank row
- **Now:** app/portal/(app)/page.tsx:225-241 (plain ranked list, no own-row when outside top 3); full treatment at app/portal/(app)/leaderboard/page.tsx
- **Verified:** Confirmed all four claimed gaps by reading page.tsx in full: no medals/avatars/progress bars, no 'View all' link, and data.top3.map never appends the student's own row when their rank > 3. But also confirmed the full OG-equivalent experience (medals, Avatar, ProgressBar, isMe row highlighting) already exists at /portal/leaderboard, a single clearly-labeled sidebar tap away. This is a degraded summary widget, not lost functionality.
- **Fix:** Add medal glyphs, an Avatar, a ProgressBar and a 'View all' link to the dashboard card, plus an appended own-rank row when outside top 3 — all four primitives already exist and are used correctly on the standalone leaderboard page.

### `F0693` [MISSING] Topbar avatar has no dropdown — and there's no 'My Profile' page left to link to anyway
- **Role:** student · **Area:** dashboard
- **OG:** index.stripped.html L1555-1563
- **Now:** components/portal/Shell.tsx:289-301 — avatar renders as a static initials <span>
- **Verified:** Confirmed by reading the full 314-line Shell.tsx: no onClick, no dropdown markup at all. Important caveat on the fix: there is no /portal/profile route anywhere in the new portal (checked nav.ts and the file tree) — the nearest analog is /portal/settings ('My PIN' + account card). Both real destinations (My Attendance, My PIN) are already one sidebar tap away, so this is a convenience-shortcut loss, not a lost feature.
- **Fix:** Make the avatar a dropdown/menu trigger linking to /portal/my-attendance and /portal/settings (not a nonexistent /portal/profile).

### `F0083` [MISSING] Student "NEW QUIZ AVAILABLE" 48-hour banner and the Daily Quiz count badge on the sidebar are both gone ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Student dashboard, maroon gradient banner between the stat cards and the leaderboard; plus the count badge on the sidebar "Daily Quiz" item and the mobile Exams tab
- **Now:** nowhere — the closest thing is the Quizzes card in the right-hand widget column, which shows every pending quiz with no notion of "new"
- **Fix:** Add a `count?: number` to NavItem in components/portal/Shell.tsx and render it as a pill on the Quizzes item; populate it in lib/portal/nav.ts from exams published within 48 hours that the student has not submitted. Add the maroon banner to StudentHome in app/portal/(app)/page.tsx above the widget rows, linking to /portal/quizzes.

### `F0084` [MISSING] Student "My Progress" card (three measured bars) is gone — points-vs-leader, quiz average and attendance are no longer shown together ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Student dashboard, the card under the leaderboard
- **Now:** nowhere as a card; the three numbers are now scattered across /portal (rank stat), /portal/quizzes (average) and /portal/my-attendance
- **Fix:** Add a "My progress" Card to StudentHome with the three ProgressBars, computing points-vs-leader from the existing ranked array in lib/portal/data/dashboard.ts, the quiz average from QuizResult percentages (the same mean already computed at app/portal/(app)/quizzes/page.tsx:58-60), and the attendance rate already returned as `data.rate`.

### `F0090` [MOVED] Student dashboard lost its Quiz Avg stat, Recent Quizzes card and Current Streak / Last Quiz mini widgets — all pushed onto other pages ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Student dashboard: 'Quiz Avg' stat card (tile 1 of 4), the 'Recent Quizzes' card (last 3 with % rings), and the two mini widgets 'Current Streak' and 'Last Quiz'
- **Now:** Quiz Avg → /portal/quizzes ("Average" StatCard); Recent Quizzes → /portal/quizzes completed section; Current Streak → /portal/achievements ("Sunday streak" StatCard); Last Quiz → folded into the Quizzes widget's footer line
- **Fix:** Swap one of the student StatCards for Quiz Avg (with the ↑/↓ delta), and add a compact Recent Quizzes card with the three-band % rings to StudentHome. Surface the Sunday streak on the dashboard too rather than only on /portal/achievements — the computation already exists in lib/portal/achievements.ts.

### `F0675` [MISSING] Stat card: Quiz Avg % with trend arrow ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Average quiz score with up/down trend chip vs previous quiz
- **Now:** n/a
- **Fix:** Add a Quiz Average StatCard back to the student dashboard hero stat row

### `F0676` [MISSING] Stat card: Pending exams count ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Count of currently available/pending quizzes as a hero stat
- **Now:** n/a
- **Fix:** Add pending-quiz count back to hero stat row, or accept the widget consolidation

### `F0677` [MISSING] 'NEW QUIZ AVAILABLE' 48-hour alert banner ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Burgundy clickable banner shown when a quiz was created <48h ago, links via goToExams()
- **Now:** n/a
- **Fix:** Add a createdAt freshness check and render a highlighted new-quiz banner

### `F0679` [MISSING] Class Leaderboard card 'View all' button → grades page ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Header button linking to the Grades & Points page
- **Now:** n/a
- **Fix:** Add a link once a destination (grades page) exists

### `F0681` [MISSING] 'You' row appended below top-3 when student isn't in podium ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** If the student's rank >3, an extra highlighted row shows their own rank/points below a divider
- **Now:** n/a
- **Fix:** Append the student's own ranked row when mine.rank > 3

### `F0682` [MISSING] My Progress card (3 bars: Points vs leader, Quiz Average, Attendance %) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Three progress bars comparing the student to class leader/averages
- **Now:** n/a
- **Fix:** Rebuild as a Card with ProgressBars using data already computed (total, quiz average, rate.rate)

### `F0683` [MISSING] Score Trend Chart (canvas line chart, last 8 quiz scores) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Line chart of the student's recent quiz score history
- **Now:** n/a
- **Fix:** Add a small chart/sparkline fed by the student's quiz results over time

### `F0686` [DEGRADED] Recent Quizzes list (last 3, % ring, correct count, points) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Quiz-specific recent results list with score rings
- **Now:** page.tsx 'Recent points' Card L209-228
- **Fix:** Keep a quiz-only recent list with % rings, or accept the generalized ledger as redesign

### `F0688` [MISSING] Sidebar item: My Profile ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Nav link to the student's own profile
- **Now:** n/a
- **Fix:** Add nav item / confirm a profile page and link it

### `F0689` [DEGRADED] Sidebar item: Daily Quiz unread-count badge (cleared on click) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Notif-style badge showing count of new-in-48h quizzes, cleared via clearExamBadge()
- **Now:** lib/portal/nav.ts L99 'Quizzes'
- **Fix:** Add an unread/new-quiz counter badge to the nav item

### `F0695` [MISSING] Mobile bottom tab bar (Home / Exams / Grades / Reading / Profile / More) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Persistent 6-item bottom tab bar for one-tap navigation on mobile
- **Now:** n/a
- **Fix:** Consider a 4-5 item bottom tab bar for the most-used student destinations

### `F0306` [MISSING] YouTube/image link preview on event cards replaced by a single generic 'Details' pill
- **Role:** student · **Area:** events
- **OG:** index.stripped.html L15013-15053 — ytMatch/isImageLink regexes, hqdefault thumbnail with play badge, inline image, blue 'Open Link' pill fallback
- **Now:** app/portal/(app)/events/page.tsx:126-136 — one <ExternalLink> 'Details' pill for every link type
- **Verified:** Confirmed the OG logic in full and confirmed zero YouTube/image-preview logic anywhere in app/portal or lib/portal. Real, verified loss of in-page richness, but the link still opens and shows the video/image (just in a new tab) — not blocked, just less rich in place.
- **Fix:** Port the two regexes into a linkPreview() helper and branch the event card: YouTube thumbnail, inline image, or the pill fallback, exactly as the OG did.

### `F0031` [MISSING] The unread-quiz count badge on the student's sidebar and mobile Exams tab is gone ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Student sidebar item "Daily Quiz" (#exam-badge) and the mobile bottom-nav "Exams" tab (#exam-mob-badge): a red count pill, cleared by clearExamBadge() when the student opens the quiz list or submits
- **Now:** nowhere — /portal sidebar "Quizzes" renders no badge; the NavItem type has no field for one
- **Fix:** Add an optional `badge?: number` to NavItem, render it as the prototype's red pill in Shell.tsx, and populate it for the student's Quizzes row from the same pendingExams count the notifications widget already computes.

### `F0032` [DEGRADED] Student quiz summary chips reduced to three tiles — the Upcoming count is gone entirely ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Student → My Quizzes, directly under the header: four pill chips, each hidden at zero — "N Done" (green), "N Available" (amber), "❌ N Missed" (red), "⏳ N Upcoming" (blue)
- **Now:** /portal/quizzes — three StatCards (To do, Completed, Average). Missed is demoted to a hint line under Completed; Upcoming is never surfaced
- **Fix:** Restore a chip row under the header with all four counts using the OG's colour contract, hiding any chip whose count is zero — the four buckets are already computed at quizzes/page.tsx:52-55.

### `F0699` [DEGRADED] Submit button disabled until all questions answered ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Submit stays disabled until 100% of questions answered
- **Now:** QuizTaker.tsx L149-169
- **Fix:** Confirm this relaxation is intentional; otherwise block the confirm button until unanswered===0

### `F0704` [MISSING] Sidebar 'Daily Quiz' unread badge ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Badge showing new-in-48h quiz count on nav item
- **Now:** n/a
- **Fix:** same fix as dashboard finding

### `F0705` [MISSING] Dashboard 'NEW QUIZ AVAILABLE' entry point into this page ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** 48-hour banner on dashboard linking into exams page
- **Now:** n/a
- **Fix:** same fix as dashboard finding

### `F0706` [MISSING] Mobile bottom-nav 'Exams' shortcut ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** One-tap mobile shortcut to exams page
- **Now:** n/a
- **Fix:** same fix as dashboard finding

### `F0273` [MISSING] Student tag-filter chips (All/Lessons/Announcements/Resources/Events) missing from the feed
- **Role:** student · **Area:** feed-posts
- **OG:** index.stripped.html L13557-13571 (chips built), L16091-16109 (filterFeedTag), gated to _feedRole==='st'
- **Now:** app/portal/(app)/feed/page.tsx — only a pinned/unpinned split, no tag filtering
- **Verified:** Confirmed no tag-filter UI in the feed page. Confirmed the underlying data already supports it — prisma/schema.prisma has a FeedTag enum (:508) and a tag field on the feed-post model (:682, default ANNOUNCEMENT) — so this is a UI-only gap, no migration needed. Removing a filter doesn't hide any post, just removes a convenience on a longer list.
- **Fix:** Add a tag-chip row driven by a ?tag= param, filtering the already-fetched posts array by the existing tag field.

### `F0276` [DEGRADED] The feed silently stops at 40 posts with no way to reach older ones ⚠️ *unverified*
- **Role:** student · **Area:** feed-posts
- **OG:** Class feed — loadFeedPosts fetched every post for the class, unlimited
- **Now:** /portal/feed — newest 40 only, no pagination, no "load more", no indication older posts exist
- **Fix:** Add a `?before=<cursor>` or `?page=` param to the feed page and a "Show older posts" button, and query pinned posts separately from the paged unpinned ones so a pin can never fall off the end.

### `F0277` [DEGRADED] Posts lost the coloured left accent bar, and every tag's colour was remapped ⚠️ *unverified*
- **Role:** student · **Area:** feed-posts
- **OG:** Left edge of every tagged post card — a 3px full-height bar in the tag's colour; plus the matching coloured tag pill
- **Now:** /portal/feed → PostCard renders only a small badge in the byline row; no accent bar, and the four tag colours are different ones
- **Fix:** Restore the 3px left accent bar in PostCard (an absolutely-positioned div, or a `border-l-[3px]` on the Card with a per-tag colour), and remap FEED_TAG_TONE so LESSON is green, ANNOUNCEMENT blue, RESOURCE amber and EVENT purple — matching the OG colours the servants already know.

### `F0279` [DEGRADED] The student dashboard's Class Announcements card shrank from the 3 most recent to 1, and students still have no Announcements page in their nav ⚠️ *unverified*
- **Role:** student · **Area:** feed-posts
- **OG:** Bottom of the student dashboard — an "ANNOUNCEMENTS" card listing the 3 most recent class announcements, each with title, message and a 📅 date line
- **Now:** /portal (student dashboard) → FeedWidget's "Latest announcement" card — one announcement, body clamped to 3 lines, linking to /portal/announcements
- **Fix:** Have FeedWidget's student branch call a `listAnnouncements`-style query limited to 3 and render all three with their dates, and add `{ href: '/portal/announcements', label: 'Announcements', icon: 'announcements', section: 'Community' }` to the STUDENT arm of nav.ts, where Class Posts and Events already sit.

### `F0281` [BROKEN] The student's "new announcement" notification dead-ends on the dashboard instead of opening the announcements ⚠️ *unverified*
- **Role:** student · **Area:** feed-posts
- **OG:** Student notification dropdown → "📣 N new announcement(s) — From your class", which opened the Posts page
- **Now:** /portal (dashboard) → "Needs you" card and the bell; clicking the row navigates to /portal, the page the student is already on
- **Fix:** Change `href: '/portal'` at lib/portal/notifications.ts:97 to `'/portal/announcements'` (and add the Announcements nav item per the finding above so the destination is also reachable on its own).

### `F0112` [DEGRADED] Open cases are sorted oldest-first instead of worst-first ⚠️ *unverified*
- **Role:** student · **Area:** followups
- **OG:** Follow-up list ordering — servant and pastor alike: open cases sorted by consecutiveAbsences DESCENDING
- **Now:** /portal/follow-ups — open cases ordered by createdAt ASCENDING
- **Fix:** Change the open branch to `orderBy: [{ consecutiveAbsences: 'desc' }, { createdAt: 'asc' }]`.

### `F0710` [MISSING] Dashboard leaderboard 'View all' button → grades ⚠️ *unverified*
- **Role:** student · **Area:** grades
- **OG:** Header button on dashboard leaderboard card linking to grades
- **Now:** n/a
- **Fix:** add link once destination page exists

### `F0711` [MOVED] Stats row: Quiz Avg / Total Pts / Quizzes count ⚠️ *unverified*
- **Role:** student · **Area:** grades
- **OG:** Three-tile stat row combining quiz average, lifetime points and quiz count
- **Now:** Quiz Avg+count on /portal/quizzes StatCards; Total Pts (lifetime) on /portal/achievements StatCard 'Points'
- **Fix:** Could be satisfied by building the dedicated grades page pulling these together

### `F0713` [DEGRADED] 'Exam Results' list: ALL quiz results with Show-all toggle ⚠️ *unverified*
- **Role:** student · **Area:** grades
- **OG:** Full history of every quiz result (not just recent ones), % ring, correct/total, points, Show-all(N) toggle
- **Now:** /portal/quizzes 'Completed' section
- **Fix:** Verify studentExams() scope is truly all-time; if cycle-scoped, a lifetime exam-results history is still missing

### `F0714` [MISSING] 'Show more/less' interaction pattern for both lists ⚠️ *unverified*
- **Role:** student · **Area:** grades
- **OG:** Collapsible pagination toggles for the activities and exam-results lists
- **Now:** n/a
- **Fix:** implement alongside the rebuilt grades page

### `F0709` [MISSING] Mobile bottom-nav 'Grades' shortcut ⚠️ *unverified*
- **Role:** student · **Area:** grades
- **OG:** One-tap mobile shortcut to grades page
- **Now:** n/a
- **Fix:** same fix as dashboard finding, plus build the destination page

### `F0155` [DEGRADED] Mobile identity bar shows church branding, not the signed-in user, and isn't a link
- **Role:** student · **Area:** nav-ia
- **OG:** index.stripped.html L1566-1571 (student, onclick→profile), L1616-1621 (servant), L1667-1672 (admin), L19163-19168 (pastor); populateMobileIdBar L1734-1748
- **Now:** components/portal/Shell.tsx:220-227 — logo + 'St. Kyrillos VI Sunday School' + academic year, hamburger only
- **Verified:** Confirmed: no user name/photo, and the block is not a Link — only the hamburger button is interactive. Caveat on the original fix: it suggests linking to /portal/profile, but (as in F0045/F0693) that route doesn't exist anywhere in the new portal; /portal/settings is the only real destination. Loses a personalization cue and a one-tap shortcut, but the real destination is still one sidebar tap away.
- **Fix:** Render the avatar/initials, name and a role/class sub-line, and make the block a Link to /portal/settings (not a nonexistent /portal/profile).

### `F0162` [MISSING] Student "Grades & Points" has no equivalent destination ⚠️ *unverified*
- **Role:** student · **Area:** nav-ia
- **OG:** Student sidebar → Learning → "Grades & Points" (#s-sbi-gr) → stLoad('grades'); also the 3rd tab of the student mobile bottom bar, labelled "Grades"
- **Now:** nowhere — the closest is /portal/leaderboard, which is a class ranking, not the student's own points breakdown
- **Fix:** Add `app/portal/(app)/my-points/page.tsx` showing the signed-in student's point ledger and exam grades, and add `{ href: '/portal/my-points', label: 'Grades & Points', icon: 'points', section: 'My Progress' }` to the STUDENT nav in lib/portal/nav.ts.

### `F0176` [DEGRADED] Points-by-activity breakdown is genuinely missing; the page's Exam Results half moved to Quizzes, it wasn't deleted
- **Role:** student · **Area:** points
- **OG:** index.stripped.html L11593 (sidebar item), L19939 (mobile tab), L12107-12215 (page: totals, activityLabel aggregation excl. quiz, tinted rows w/ bars capped at 6 + 'Show all', Exam Results % rings)
- **Now:** Points aggregation: nowhere (same gap as F0712). Exam results with score rings: app/portal/(app)/quizzes/page.tsx (own nav item, BAND-keyed ring/color treatment confirmed present)
- **Verified:** Confirmed no per-activity points aggregation exists anywhere (same grep as F0712) and no dedicated page/nav entry replaces it. But 'the whole page is gone' overstates it: read quizzes/page.tsx in full and confirmed the OG's Exam Results half (percentage-based score bands/rings) is alive and well, just relocated to its own 'Quizzes' page rather than deleted. A student can still see attendance rate, raw recent points, and exam scores individually — they just can't see points aggregated by activity type in one place.
- **Fix:** Build a points-by-activity aggregation (group the student's own PointEntry rows by activityLabel, excluding quiz source) and surface it either as its own page or a card on the dashboard — the Exam Results component does not need to be rebuilt, it already exists on /portal/quizzes.

### `F0187` [DEGRADED] Achievement badges lost their point rewards, the Class Champion badge, and the level ladder was silently replaced ⚠️ *unverified*
- **Role:** student · **Area:** points
- **OG:** Student → Achievements: a 5-level ladder (Beginner 🌱 0 / Rising Star ⭐ 50 / Scholar 🎓 100 / Champion 🏆 200 / Legend 👑 350) and 11 badges each carrying a gold "+N" reward chip in the top-right of the earned card, including "Class Champion 👑 — Rank #1 in class — +25"
- **Now:** /portal/achievements — a different 5-level ladder (Seed 🌱 0 / Candle 🕯️ 50 / Lampstand 🪔 150 / Crown 👑 400 / Shining Star ✨ 800) and 11 entirely different badges with no point values and no rank-based badge
- **Fix:** Restore the OG thresholds and level names in LEVELS (or get an explicit decision from the church before changing them), add a `reward: number` field to Badge and render it as the gold "+N" chip on earned cards, and add a rank-based "Class Champion" badge fed by the student's classTotals rank.

### `F0746` [DEGRADED] Notification-bell "N new announcements" click-through to Posts page ⚠️ *unverified*
- **Role:** student · **Area:** posts
- **OG:** notifItemHtml links to stLoad('posts',...)
- **Now:** lib/portal/notifications.ts announcement:* item has href:'/portal' (dashboard), not /portal/feed
- **Fix:** point the announcement notification href at /portal/feed

### `F0747` [MISSING] Feed tag filter bar (All/Lessons/Announcements/Resources/Events chips, student-only) is missing from Class Posts
- **Role:** student · **Area:** posts
- **OG:** loadFeedPosts, L13540-13575 (cited L13556-13563 verified): builds #feed-filter-bar with 5 chips only when _feedRole==='st', wired to filterFeedTag(this); posts tagged data-ftag-post for client-side show/hide
- **Now:** nowhere — app/portal/(app)/feed/page.tsx and PostCard.tsx have no filter UI; independent grep for feed-filter|filterFeedTag|ftag|FeedFilter|TagChip across app/lib/components returns zero hits
- **Verified:** OG behavior confirmed exactly as cited. New portal confirmed to have zero filter UI via a fresh grep (different terms than the original evidence). FEED_TAGS already exists in lib/portal/data/feed.ts and is imported into PostCard.tsx for the badge, so the fix is cheap. Downgrading severity: per this batch's calibration, 'high' means data is lost or unfindable; here a student can still scroll and read every post with nothing hidden or lost — it's browsing friction, which is medium.
- **Fix:** Add a small chip row above the post list in feed/page.tsx reusing FEED_TAGS from lib/portal/data/feed.ts, filtering the already-rendered post list client-side (a 'use client' wrapper or simple useState on a client child), shown only for STUDENT role.

### `F0326` [DEGRADED] The student's "📖 Today's Bible Reading" accordion on a quiz became an always-open card whose body shows only the servant's note ⚠️ *unverified*
- **Role:** student · **Area:** readings
- **OG:** Student → Daily Quiz → an expanded Available exam card, a cream band above the questions with its own chevron; tapping it reveals the reading text and, underneath, an italic "✨ <readingMessage>"
- **Now:** /portal/quizzes/[id] → a permanently open Card whose TITLE is `Today's reading: {bibleReading}` and whose body is readingMessage; and /portal/quizzes list → a one-line strip with `truncate`
- **Fix:** On quizzes/[id], give the card a fixed title "Today's Bible Reading" and move `paper.bibleReading` into the body rendered with `whitespace-pre-line`, with readingMessage below it in italics prefixed by ✨. Make it a <details>/<summary> so it collapses like the OG. On the quizzes list, drop `truncate` in favour of a two-line clamp, or show only the first line.

### `F0327` [MISSING] The "Today's Readings" tab is gone from the class feed — readings and posts are no longer one tap apart ⚠️ *unverified*
- **Role:** student · **Area:** readings
- **OG:** Feed page pill row, second tab: 📖 Today's Readings, beside 📰 Posts — reachable by students, servants and admins from the same screen as the class posts
- **Now:** /portal/feed has no tabs at all; readings live only at /portal/readings, and only students and servants have a sidebar link to it
- **Fix:** Either add a tab/segmented control to app/portal/(app)/feed/page.tsx that renders the same readings body, or — cheaper and enough for discoverability — put a prominent "Today's Readings" link button in the feed PageHeader actions, and add `{ href: '/portal/readings', label: 'Daily Readings', icon: 'readings', section: 'Community' }` to the ADMIN and PASTOR arrays in lib/portal/nav.ts.

### `F0141` [DEGRADED] The present-attendance streak a student sees is no longer the number the servant sees ⚠️ *unverified*
- **Role:** student · **Area:** reports
- **OG:** OG: getConsecutivePresentStreak(studentId, attDocs, 20) is called with the same 20-session window from the student dashboard (L11670), the servant Students roster (L4614) and the Class Profile student card (L5025), so all three agree by construction. The OG comment makes the guarantee explicit.
- **Now:** Split across two different metrics: /portal/my-attendance shows the student their own consecutive-present streak (presentStreak over Sunday weeks), while /portal/students/[id] shows the servant an ABSENCE streak, and /portal/classes/[id] shows no streak at all.
- **Fix:** Surface `presentStreak` on the student profile beside the absence streak and on the class roster card, computed from the same rows, so the student's number and the servant's number are the same number.


---

## LOW (251)

### `F0823` [DEGRADED] Live search box replaced by a full-page-reload search form
- **Role:** admin · **Area:** Admin > All Students (id='allstudents')
- **OG:** OG L3361-3366 (inputs), L10100-10123/10125-10138 (instant client-side filters)
- **Now:** app/portal/(app)/admin/students/page.tsx lines 62-76
- **Verified:** Confirmed search is a plain <form method="get"> causing a full round trip per search, versus OG's instant oninput filtering. Class filter via ClassPicker does correctly match the OG's All/per-class/Unassigned shape, as the finding notes.
- **Fix:** Convert the search box to client-side live filtering of the already-rendered groups, as proposed. Functionally it already finds the right student.

### `F0843` [MISSING] 4 of 5 OG data-repair tools have no analog, but their underlying defects are structurally impossible in the new relational schema
- **Role:** admin · **Area:** adLoad('settings') — Data Repair Tools card (5 tools)
- **OG:** Settings > Data Repair Tools card, OG fixBrokenStudentNames L18362-18383, fixClassServantLists L18330-18361, fixStudentBirthdates L18304-18329, fixServantStageNames L18274-18303
- **Now:** app/portal/(app)/admin/data/RepairPanel.tsx has 5 different tools: recount-classes, close-returned-cases, orphan-points, normalise-phones, clear-import-flags
- **Verified:** Verified schema thoroughly: PointEntry.studentId and AttendanceRecord.studentId are proper FK relations (not copied names), Student.dob is DateTime @db.Date, ClassServant is a real join table, Servant has no denormalized stage-name field. Broad grep for fixBroken/fixBirthdate/fixServant/fixClassServant/denormali across lib and app/portal found nothing else -- confirmed no hidden analog exists. The finding is accurate that these 4 tools are gone, but since the schema redesign makes their target bugs impossible to occur at all, there is zero practical user impact -- downgrading from medium to low (the finding's own fix of 'mostly N/A, add a callout' already reflects this).
- **Fix:** Add a one-line callout on the Data & Backup page noting these OG tools are obsolete under the relational schema.

### `F0842` [MOVED] Corrected — the admin toolbox is genuinely split into two pages (real), but the specific claim that a nav item literally labeled "Settings" misdirects admins is factually wrong: the shared item is already labeled "My PIN"
- **Role:** admin · **Area:** adLoad('settings') — single sidebar item 'Settings'
- **OG:** index.stripped.html L2839-2937 — one "Settings" sidebar item containing Backup + 5 Data Repair Tools + Attendance Sessions + Account & Login + Danger Zone together
- **Now:** lib/portal/nav.ts — SETTINGS = {href:'/portal/settings', label:'My PIN', ...} shared by all roles; admin toolbox split into /portal/admin/sessions ("Sessions & Points") and /portal/admin/data ("Data & Backup") under "Administration"
- **Verified:** Confirmed the toolbox is split, and confirmed via the finding's own cited lines that the shared nav item's label is 'My PIN' — yet the finding's narrative claims an admin would click something "literally called 'Settings'" and land on the wrong page. There is no nav item labeled "Settings" to click, so that specific confusion scenario cannot occur as described. What remains is a milder point: no unifying "Settings" destination groups the two admin pages, which reads as a defensible reorganization (specific labels) rather than a clear regression.
- **Fix:** Optional: group Sessions & Points and Data & Backup under a shared "Administration" umbrella if a single "Settings" concept is desired; not urgent.

### `F0228` [DEGRADED] Four of the ten activity labels were renamed, and the case change breaks import matching for at least one ('SAINT')
- **Role:** admin · **Area:** agenda
- **OG:** OG L8145-8156 (AGENDA_ACTIVITIES)
- **Now:** lib/portal/agenda.ts lines 34-49
- **Verified:** Confirmed labels are 'Agpeya' (not 'Agpeya Prayer'), 'Seasons' (not 'The Seasons of the Coptic Church'), 'Lesson' (not 'LESSON'), 'Saint of the Week' (not 'SAINT') — 4 of 10 differ as claimed. Also confirmed resolveActivityKey (line 69-74) lowercases and looks up BY_LABEL, so an import value of literal 'SAINT' resolves to nothing since the map holds 'saint of the week', not 'saint'.
- **Fix:** Restore the OG label strings, or add them as aliases in BY_LABEL so imports and printed sheets still line up, as proposed.

### `F0587` [MOVED] Per-week edit modal became an inline panel
- **Role:** admin · **Area:** agenda
- **OG:** OG L8407-L8408; markup L19741-L19759
- **Now:** app/portal/(app)/agenda/page.tsx lines 90-135
- **Verified:** Confirmed week selection is via Previous/This-week/Next links with a ?week= param, and the selected week's AgendaEditor renders inline in the main column instead of a popup — fully reachable and shareable via URL, as the finding's own note says.
- **Fix:** Cosmetic redesign; no fix needed, as the finding itself concludes.

### `F0590` [MISSING] "Open Slide in Canva" link missing from the editable agenda form
- **Role:** admin · **Area:** agenda
- **OG:** OG L19754
- **Now:** app/portal/(app)/agenda/AgendaEditor.tsx
- **Verified:** Confirmed via grep for 'Open Slides|window.open' in AgendaEditor.tsx — no match; the file only has a plain text field for slideLink (lines 142-146), with no accompanying open-link control, while it does exist in the read-only views as claimed.
- **Fix:** Add the same 'Open Slides' control to the editor form, as proposed.

### `F0568` [DEGRADED] Stage-level grouping is not collapsible (only class-level is)
- **Role:** admin · **Area:** allstudents
- **OG:** OG spotlightToggle(), L3297-3325
- **Now:** app/portal/(app)/admin/students/page.tsx lines 84-103
- **Verified:** Confirmed the stage-level wrapper is a plain <section> (no <details>), while the class-level ClassGroup one level down does use <details> (line 144).
- **Fix:** Make the stage-level section collapsible too, as proposed.

### `F0570` [MOVED] Per-student card "Edit" is now a full-page navigation instead of an inline modal
- **Role:** admin · **Area:** allstudents
- **OG:** OG adEditStudentModal(...), L3257
- **Now:** app/portal/(app)/admin/students/page.tsx lines 172-178 -> /portal/students/[id]/edit
- **Verified:** Confirmed a real <Link> to a full edit page rather than a modal, exactly as described.
- **Fix:** None needed — acceptable UX change, as the finding itself concludes.

### `F0655` [DEGRADED] Announcement body textarea is now required, so a title-only announcement can no longer be posted
- **Role:** admin · **Area:** announcements
- **OG:** OG L3386-3425 (field at L3397, optional); addChurchAnnouncementFB() L3468
- **Now:** app/portal/(app)/announcements/AnnouncementManager.tsx
- **Verified:** Confirmed 'required' on the body textarea (line 124) and submit disabled while form.body is empty (line 156).
- **Fix:** Drop the required/trim check on body to allow a title-only announcement, as proposed.

### `F0052` [DEGRADED] A student's login cannot be disabled — Account.isActive has no student-facing control
- **Role:** admin · **Area:** auth-login
- **OG:** OG L55-58 (orphaned-account guard forcing sign-out)
- **Now:** components/portal/StudentForm.tsx (no isActive field) vs ServantForm.tsx:103 (has one)
- **Verified:** Confirmed StudentForm.tsx has zero isActive references while ServantForm.tsx has the checkbox; login.ts:61 and session.ts:34 both gate on account.isActive, so enforcement works but is unreachable in the UI for students — only the destructive 'Delete student' lever exists.
- **Fix:** Add an Active toggle to StudentForm and a 'Deactivate login' action beside Reset PIN, as proposed.

### `F0666` [DEGRADED] Church Reports period filter has no "All Time" shortcut or month-list dropdown (though the month control already exists for a different tab)
- **Role:** admin · **Area:** churchreports
- **OG:** OG setCrPeriodMode()/periodHtml L7328-7345
- **Now:** app/portal/(app)/reports/ReportFilters.tsx, used from app/portal/(app)/reports/page.tsx line 129
- **Verified:** Confirmed the Church Reports tab passes show={{range:true, session:true}} (no month, no all-time), while a different tab in the same page (line 289) passes show={{class:true, month:true, session:true, blank:true}} — the month-input control the finding wants already exists in the same component, just isn't enabled for this tab.
- **Fix:** Add an All-time quick-select and reuse the existing month <input type=month> for the Church Reports tab too, as proposed — this is a config change on an existing component, not new UI.

### `F0536` [DEGRADED] Class Stage select has no "Unassigned" option, defaulting silently to Elementary — enforced by the schema's enum, not just the form
- **Role:** admin · **Area:** classes
- **OG:** OG L2949-2954, default 'Unassigned'
- **Now:** app/portal/(app)/admin/classes/ClassManager.tsx lines 111-113; prisma/schema.prisma enum Stage L156-160
- **Verified:** Confirmed ClassManager.tsx offers only Elementary/Middle/High. Went further: prisma's enum Stage has only ELEMENTARY | MIDDLE_SCHOOL | HIGH_SCHOOL, no UNASSIGNED value at all — this is a deliberate required-enum schema design, not a UI oversight, as the finding itself allows.
- **Fix:** Add an UNASSIGNED value to the schema and form if the church wants that state back, or accept the required-field design as intentional, as proposed.

### `F0535` [MISSING] Field: Age Range is missing (schema has no such column) -- purely cosmetic/informational, not a task blocker
- **Role:** admin · **Area:** classes
- **OG:** OG L2948, L2984 (text input, cls-age)
- **Now:** nowhere
- **Verified:** Confirmed no age-range column in SchoolClass and zero hits for ageRange/age_range/AgeRange/'Ages ' across schema, app, lib, components. Real gap, but it's a purely informational note under the class name with no functional dependency elsewhere in the code -- doesn't block or degrade any weekly task. Downgrading from medium to low per the cosmetic-polish calibration rule.
- **Fix:** Add an ageRange string column to SchoolClass and surface it in the form/card, as given (low priority).

### `F0538` [DEGRADED] Class card no longer shows age range under the class name -- direct consequence of F0535, same low severity
- **Role:** admin · **Area:** classes
- **OG:** OG cls-age span, L2986-2990
- **Now:** ClassManager.tsx ClassCard rows (Stage/Students/Servants only)
- **Verified:** Direct consequence of the missing schema column (F0535); same reasoning applies -- purely cosmetic/informational display, downgrading from medium to low.
- **Fix:** See F0535 fix.

### `F0539` [MISSING] Delete-class uses a native confirm() instead of a typed-DELETE gate -- but the catastrophic cascade that gate protected against no longer exists
- **Role:** admin · **Area:** classes
- **OG:** OG #dcls-confirm-input, L3579-3596
- **Now:** ClassManager.tsx remove() L77-84
- **Verified:** Confirmed remove() uses a bare confirm() dialog, no typed phrase. However, deleteClass() in admin.ts (see F0540) now refuses to delete any class with students or any historical records -- it only ever succeeds on an already-empty, history-free class. The one-click catastrophic wipe the OG's typed-DELETE gate guarded against no longer exists, so the real-world risk of an accidental native confirm() today is trivial and reversible (recreate an empty class). Downgrading from medium to low.
- **Fix:** Optional: add a typed confirmation for consistency/polish, but this is no longer protecting against meaningful data loss.

### `F0316` [MISSING] The DAY field (Sunday…Saturday) was dropped from the event form
- **Role:** admin · **Area:** events
- **OG:** OG L3441-3442 (admin), L5550-5551 (servant), L15616-15617 (pastor)
- **Now:** prisma/schema.prisma model PortalEvent, L729-746 (no day field); app/portal/(app)/events/EventManager.tsx
- **Verified:** Confirmed PortalEvent has no day field in the schema and EventManager.tsx has no day select anywhere.
- **Fix:** Confirm with the church that day-of-week is deliberately derived from the date, or add it back as a select, as proposed.

### `F0318` [DEGRADED] The admin/pastor owning-CLASS select is gone; the audience checkboxes now do double duty
- **Role:** admin · **Area:** events
- **OG:** OG L3437-3439 (admin), L15613-15614 (pastor)
- **Now:** prisma/schema.prisma model PortalEvent (no classId; only PortalEventClass join table + targetAll) and app/portal/(app)/events/EventManager.tsx lines 147-162
- **Verified:** Confirmed PortalEvent has no classId column, only the many-to-many PortalEventClass audience table and a targetAll boolean; EventManager.tsx has the targetAll checkbox plus per-class checkboxes and no distinct owning-class select.
- **Fix:** Low priority if the church agrees one concept is enough — relabel the checkbox group and add help text explaining the change, as proposed.

### `F0038` [DEGRADED] CSV import lost the file-size and row-count guards, so an oversized file fails with a raw validation error
- **Role:** admin · **Area:** exams
- **OG:** index.stripped.html L16243-16264 (csvPreview: MAX_SIZE 2MB check, MAX_LINES 500 check, both clear input.value)
- **Now:** app/portal/(app)/exams/import/ExamImport.tsx readFile() L58-64 (no guard); server validation lib/portal/actions/exams.ts:253 (z.string().max(500_000)); generic catch lib/portal/action-result.ts:23-32
- **Verified:** Verified: OG has both guards with tailored toasts and input clearing. New readFile() has zero client-side guard; the only limit is a Zod max(500_000) that, on violation, throws a ZodError which is not a PortalError and falls into runAction's generic 'Something went wrong. Please try again.' catch-all, exactly as claimed.
- **Fix:** Add the two guards (2MB size, 500-line count) to readFile in ExamImport.tsx with the OG's wording, clearing the file input on either failure.

### `F0117` [DEGRADED] Resolve reasons render as raw database values instead of the church's labelled vocabulary
- **Role:** admin · **Area:** followups
- **OG:** index.stripped.html L17258 (reasonLabels), L17574 (PT_VISIT_REASON_LABELS) — six-label map with icons
- **Now:** app/portal/(app)/follow-ups/page.tsx:140 and app/portal/(app)/follow-ups/[id]/page.tsx:75 (c.resolveReason.replace('_',' ')); lib/portal/format.ts has no label map
- **Verified:** Verified both render sites string-manipulate the raw enum instead of using a shared label map. Bonus finding: the Resolve <select> in CaseActions.tsx (L100-110) already has friendlier per-option text, but its wording still diverges from the OG (e.g. 'Sick' vs OG's 'Illness', 'Family reasons' vs 'Family circumstance'), so a single shared label map is needed to make list/detail/select agree, which the given fix already covers.
- **Fix:** Add a RESOLVE_REASON_LABELS map to lib/portal/format.ts with the OG's six labels; use it in the list card, the detail callout, and align the Resolve select's own wording to match.

### `F0269` [DEGRADED] Curriculum's three core links and three extras were merged into one undifferentiated strip
- **Role:** admin · **Area:** lessons
- **OG:** index.stripped.html L4948-5001 (suscoptsCore in a gold bordered box above the grid; suscoptsExtras in a dot-separated underlined strip below the grid, behind a top border)
- **Now:** app/portal/(app)/curriculum/page.tsx L52-58 ([...CURRICULUM_CORE, ...CURRICULUM_EXTRAS] rendered together via the same LinkRow in one Card above the grade grid)
- **Verified:** Verified the OG deliberately styles/positions core vs extra links differently; the port concatenates both arrays and renders them identically in one box above the grid. The two arrays are indeed already separate in lib/portal/curriculum.ts, confirming this is layout-only work.
- **Fix:** Render CURRICULUM_CORE in the gold box above the grid (as now) and move CURRICULUM_EXTRAS to a dot-separated underlined strip below the grade grid behind a top border.

### `F0580` [MISSING] Confirmed — a per-entry reason/note field is genuinely absent everywhere, not just on my-attendance
- **Role:** admin · **Area:** myattendance
- **OG:** index.stripped.html L6965 — <input data-field="reason"> per activity card; verified
- **Now:** nowhere — app/portal/(app)/servant-attendance/ServantGrid.tsx (the actual current self-mark write surface, see F0579) has no reason/note input of any kind, only the status-cycle button
- **Verified:** Unlike the status-write capability (F0579), which moved rather than disappeared, this specific reason/note field really is gone with no equivalent anywhere I could find.
- **Fix:** Add an optional note input to ServantGrid, e.g. a per-cell popover on the cycle button.

### `F0578` [MOVED] Week stepper for self attendance moved to the Servants Attendance grid; My Attendance became a read-only history view
- **Role:** admin · **Area:** myattendance
- **OG:** OG renderMyAttendancePage, L6805-6841 (self-only weekly marking with ‹/› stepper at L6839-6841)
- **Now:** app/portal/(app)/servant-attendance/page.tsx:13-63 has the identical ‹/› week stepper; an ADMIN's scope there includes every servant including themselves, so the same weekly self-marking is done on the shared grid instead of a dedicated page
- **Verified:** my-attendance/page.tsx is indeed a fixed 26-week read-only table with no stepper, but the OG capability (paging week-by-week to mark yourself) was folded into the Servant Attendance grid page, not dropped. Also found: lib/portal/actions/servant-attendance.ts:114 markMyServantAttendance ('one-tap self check-in ... My Attendance') exists but is never called from any component — dead code left over from an intended but unfinished lighter self-checkin flow.
- **Fix:** No fix required for parity (capability exists via /portal/servant-attendance). Optionally wire the orphaned markMyServantAttendance action into My Attendance or the CheckInWidget for the lighter one-tap flow it was clearly built for.

### `F0144` [MOVED] Topbar avatar is inert, confirmed — but for ADMIN, every destination the OG dropdown held is already one click away in the persistent sidebar; the real gap is a missing self-service "My Profile" page for servants/students
- **Role:** admin · **Area:** nav-ia
- **OG:** index.stripped.html L1652-1663 — admin pill: Classes, Servants, All Students, Settings, divider, Sign out; verified directly
- **Now:** components/portal/Shell.tsx:288-296 (avatar is a plain inert <span>); but lib/portal/nav.ts already lists Classes, Students (=All Students), Servants for ADMIN, and Shell.tsx:199-204 renders a permanent "Sign out" button at the sidebar bottom for every role
- **Verified:** Confirmed the avatar truly has no dropdown. But checking beyond the finding's own cited evidence: for the ADMIN role specifically, every one of the OG dropdown's destinations (Classes, Servants, All Students, Sign out) is already present and always visible in the persistent sidebar — nothing an admin needs is actually unreachable, just not consolidated into a quick-menu. The one OG dropdown item with truly no equivalent anywhere is "My Profile" for SERVANT/STUDENT (no /portal/profile route exists, confirmed by grep) — a real gap, but for those roles, not admin.
- **Fix:** Low priority for admin (pure convenience). Higher-value fix: add a self-service "My Profile" page for servants/students.

### `F0158` [DEGRADED] Admin sidebar grew from 12 items/4 groups to ~25 items/6 groups mostly to hold new features — every OG destination is still reachable, just regrouped and renamed
- **Role:** admin · **Area:** nav-ia
- **OG:** OG L2705-2723 (12-item, 4-group sidebar)
- **Now:** lib/portal/nav.ts ADMIN case, lines 24-51
- **Verified:** Counts and renames confirmed accurate. But every OG destination remains reachable under a new name/group (Classes, Servants, All Students→Students, Servant/My Attendance, Schedule of the Year→Agenda, Announcements, Events, Church Reports, Settings→My PIN). Nearly all the growth is genuinely new admin tooling (Exams, Lessons, Hymns, Curriculum, Follow-ups, Birthdays, Feed, Leaderboard, Data & Backup, Audit Log, Sessions & Points) that never existed in the OG — that's feature growth, not lost parity, so this doesn't block or hide any task an admin used to be able to do.
- **Fix:** Optional: relabel 'Students' back to 'All Students' for continuity with the OG. No functional work needed — this is IA polish, not a parity gap.

### `F0530` [MOVED] Avatar dropdown shortcut menu was dropped, but every destination it offered (including Sign out) is already always visible in the new sidebar
- **Role:** admin · **Area:** overview
- **OG:** index.stripped.html L1647-1665 (.atb-avatar-pill onclick=toggleUserDropdown('ad'), 5 menu items)
- **Now:** components/portal/Shell.tsx:286-296 (avatar, non-interactive) + the persistent labeled sidebar from nav.ts (Classes/Students/Servants/Settings) + Shell.tsx:199-204 (Sign out form in the sidebar rail)
- **Verified:** Verified Shell.tsx renders a plain non-interactive <span> for the avatar — no onClick, no chevron, no cursor-pointer, so it also doesn't visually suggest it's clickable, unlike OG's pill+chevron. But every destination the dropdown offered is already permanently visible one click away in the new persistent sidebar, and 'Sign out' is a form at the bottom of the same sidebar rail (used on both desktop aside and mobile drawer). This is not a dead control the user expects to work — it's a redundant shortcut intentionally dropped because the new nav model already surfaces the same items without opening a menu. Severity down from high to low: nothing is unreachable, and reaching it is no more effort than before (arguably less).
- **Fix:** No functional fix needed; if a quick-access affordance on the avatar is still desired, add a chevron/dropdown purely as a shortcut, purely cosmetic.

### `F0528` [DEGRADED] Stat-tile count-up animation is missing
- **Role:** admin · **Area:** overview
- **OG:** index.stripped.html def L2125 (animateStatCounters), called e.g. L2807
- **Now:** components/portal/ui.tsx StatCard L177-213
- **Verified:** Verified StatCard renders {value} statically with no count-up effect. This is explicitly called out in the task's own calibration as LOW regardless of the OG's behavior, so the original severity was already correct.
- **Fix:** Optional: add a small count-up effect (CSS or JS) to StatCard's value on mount. Not required.

### `F0532` [MOVED] Sidebar "All Students"/"Students" nav item relabelled and moved up one spot
- **Role:** admin · **Area:** overview
- **OG:** index.stripped.html ~L2711 (3rd item under People: Classes, Servants, All Students) — cited L2704 is off by a few lines but same block
- **Now:** lib/portal/nav.ts ~L26 (Classes, Students, Servants — 2nd position, relabelled 'Students')
- **Verified:** Verified the reorder and relabel. Purely cosmetic navigation change with no functional loss.
- **Fix:** Optional: match OG order (Classes, Servants, Students) for consistency. Not required.

### `F0533` [MOVED] Sidebar regrouped from 4 sections to 7, with a new "Administration" group unfamiliar to OG admins
- **Role:** admin · **Area:** overview
- **OG:** index.stripped.html L2695-2717 (sb-group-label: Overview, People, Attendance, Content)
- **Now:** lib/portal/nav.ts ADMIN case (People/Teaching/Attendance/Community/Administration/Account + unlabeled Dashboard = 7 groups)
- **Verified:** Verified the count and the new 'Administration' grouping (Manage Classes, Sessions & Points, Data & Backup, Activity Log) has no OG equivalent label. Correctly framed as a training/relearning note rather than a functional defect.
- **Fix:** Documentation/training note only; no code fix required.

### `F0531` [DEGRADED] Topbar birthday chip is not clickable (but the full Birthdays page is one click away in the main nav)
- **Role:** admin · **Area:** overview
- **OG:** OG L1639-1642, .atb-meeting-card onclick=adLoad('schedule',...)
- **Now:** components/portal/BirthdayChip.tsx (used unwrapped in app/portal/(app)/layout.tsx:32)
- **Verified:** Confirmed: BirthdayChip renders a plain non-interactive <span>, no href/onClick/cursor-pointer anywhere. However lib/portal/nav.ts gives admins a standalone 'Birthdays' nav item, so this only removes a one-click shortcut, not a destination — pure friction, not a lost capability.
- **Fix:** Wrap the chip in <Link href="/portal/birthdays">, as originally suggested — cheap and still worth doing, just not medium severity.

### `F0190` [DEGRADED] Admin "Add a session" lost the icon field, and an added session can be hidden but never removed
- **Role:** admin · **Area:** points
- **OG:** index.stripped.html L2865-2888 (extra-session tiles with a red X 'Remove' calling deleteExtraSession(); Add-a-session form with Icon/Name/Points)
- **Now:** app/portal/(app)/admin/sessions/SessionEditor.tsx (Add-a-session card L91-132 has no icon field; tiles always render a hard-coded CalendarCheck icon L48-51; no delete action anywhere, and none in lib/portal/actions/admin.ts's saveSession)
- **Verified:** Verified fully: schema.prisma:336 stores an icon column that the UI never reads or writes, and there is no delete/remove path for a session, only the Active/Hidden checkbox.
- **Fix:** Add an icon field to SessionSchema and both the tile and add-card in SessionEditor.tsx; add a delete action for sessions with no AttendanceRecord rows, keeping the Hidden toggle as fallback otherwise.

### `F0656` [MISSING] CLASS select field (event's "filed under" class, distinct from audience targeting) is missing from the Add/Edit Event form
- **Role:** admin · **Area:** schedule
- **OG:** index.stripped.html L3437-3442 (sch-class-select), validated and saved as classId in saveScheduleItem() L14825-14842
- **Now:** lib/portal/actions/events.ts EventSchema (only targetAll + classIds many-to-many); prisma/schema.prisma PortalEvent L729-746 has no single owning-class FK, only the PortalEventClass join table
- **Verified:** Verified the OG's classId is a genuinely separate concept from targetAll/targetClassIds, and the new schema/action has no equivalent field at all.
- **Fix:** Low priority as stated — its only visible effect is the poster-class label (F0657); not required unless that label is restored.

### `F0657` [DEGRADED] "Posted by <name> · <their class>" label is missing from event rows
- **Role:** admin · **Area:** schedule
- **OG:** index.stripped.html L15008 (posterClass = classNameById[s.classId]), rendered L15030
- **Now:** app/portal/(app)/events/page.tsx EventRow() L59-96 (only initials + createdByName)
- **Verified:** Verified EventRow shows only the creator's name/avatar with no class attribution anywhere in the file.
- **Fix:** Add the creator's primary class name next to their name in EventRow, using a class relation on the creator's Account/Servant record.

### `F0660` [MOVED] Edit-event form appears inline under the row instead of scrolling to a shared top form
- **Role:** admin · **Area:** schedule
- **OG:** index.stripped.html editScheduleItem() L14787-14819
- **Now:** app/portal/(app)/events/EventManager.tsx L180-224 (per-row inline Edit expands the form under that row)
- **Verified:** Verified. Different but equally discoverable placement; no functional loss.
- **Fix:** No fix required.

### `F0658` [MISSING] Event links show a plain "Details" button instead of an auto YouTube thumbnail / inline image preview
- **Role:** admin · **Area:** schedule
- **OG:** OG buildCard() ytMatch/isImageLink logic, L15053-15062
- **Now:** app/portal/(app)/events/page.tsx EventRow(), lines 128-139
- **Verified:** Confirmed: EventRow renders only a plain external-link 'Details' button; no YouTube-ID regex or image-extension check anywhere in the file. The link itself still fully works though — this is a visual richness loss, not a functional one, so per the church's own rule that cosmetic polish is low regardless of the OG, this is low not medium.
- **Fix:** Add the YouTube-ID/image-extension check and render a thumbnail, as proposed — nice-to-have, not urgent.

### `F0659` [MOVED] "Birthdays This Week" is a separate nav page instead of an embedded widget on Events
- **Role:** admin · **Area:** schedule
- **OG:** OG adLoad schedule branch, loadScheduleBirthdays(true) at L3458, render L14879-14964
- **Now:** app/portal/(app)/birthdays/page.tsx, its own top-level nav item (lib/portal/nav.ts)
- **Verified:** Confirmed app/portal/(app)/events/page.tsx has zero birthday-related code. The destination exists and is one click away in the primary admin nav, so this is discoverability friction, not a lost capability — same reasoning as F0531/F0158.
- **Fix:** Optional: add a compact widget or cross-link on Events for admins who expect it there, as proposed. Low priority.

### `F0299` [DEGRADED] Meeting QR's "Meeting Title" field is gone — every code is titled with the activity label
- **Role:** admin · **Area:** servant-attendance
- **OG:** index.stripped.html L14375 (mt-title input, defaults to 'Servants Meeting'), stored separately from activityLabel at L14389
- **Now:** lib/portal/actions/qr.ts createMeetingCode() L213-236 (title: activity.label, hard-coded); app/portal/(app)/qr/GroupCodePanel.tsx has only an activity <select> (L237), no title input anywhere
- **Verified:** Verified the OG record has two independent fields (title, activityLabel) while the new action collapses them into one.
- **Fix:** Add an optional 'Meeting title' text input to the Meeting branch of GroupCodePanel (default to the activity label), pass through MeetingSchema, and store it as title while leaving activityLabel as the activity's own name.

### `F0851` [DEGRADED] Sharing new/reset ID+PIN with a servant lost the "Send by email" and "Copy" actions
- **Role:** admin · **Area:** servant/pastor creation flow + Account & Login — Servant Credentials Modal
- **OG:** index.stripped.html L3699-3749 (showServantCredentialsModal: Gmail-compose email button + clipboard copy button, both built from buildCredentialsEmailText)
- **Now:** components/portal/ServantForm.tsx post-create display (~L66-83) and post-reset-PIN display (~L168-176) — plain ID/PIN cards only
- **Verified:** Verified with a project-wide grep for mailto:/clipboard.writeText in lib/portal and components/portal — no matches. Both credential-display blocks in ServantForm.tsx are static, with no share affordance.
- **Fix:** Add a Copy button (navigator.clipboard.writeText) and, when an email is on file, a mailto: link with a pre-filled body, next to the ID/PIN display in ServantForm.tsx.

### `F0598` [DEGRADED] Activity select (pick ONE of 7 activities to view/mark) replaced by one always-on 7-column matrix
- **Role:** admin · **Area:** servantattendanceall
- **OG:** index.stripped.html L7848 (sab-activity-select, onchange=sabSelectActivity)
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx L124, L148 (activities rendered as simultaneous table columns, no filter select)
- **Verified:** Verified. This is an intentional redesign that still exposes every activity (via columns) rather than data loss, correctly framed as a design change not a defect.
- **Fix:** Consider adding per-activity bulk controls to the matrix view, as the finding suggests; not required.

### `F0608` [MISSING] QR Check-in Manual/QR/Manual+QR source badge per meeting
- **Role:** admin · **Area:** servantattendanceall
- **OG:** OG L7106-L7108, L7175-L7178
- **Now:** nowhere — confirmed via grep for hasManual|hasQr|pastMeeting|PastMeeting|meetingHistory across lib/portal and app/portal/(app)/qr
- **Verified:** Confirmed no such tracking exists anywhere in the codebase. Downgraded from medium to low because this is a minor sub-detail of a larger 'no meeting-history view exists at all' gap that the finding itself says is tracked separately ('see the Past Meetings finding above') and is outside this batch — the badge alone, once history exists, is cheap polish.
- **Fix:** Restore alongside whatever Past Meetings history view gets built.

### `F0550` [MOVED] Collapsible "+ Add New Servant" inline form moved to its own page
- **Role:** admin · **Area:** servants
- **OG:** index.stripped.html L3021 (toggleAddCard('addsv-body','addsv-chev'))
- **Now:** app/portal/(app)/admin/servants/new/page.tsx (ServantForm mode="create")
- **Verified:** Verified the dedicated page exists and renders the same form. Acceptable UX change.
- **Fix:** None needed.

### `F0551` [DEGRADED] Role select gained an Admin option but lost the dynamic hide of the Classes card for Pastor
- **Role:** admin · **Area:** servants
- **OG:** index.stripped.html L3024-3027 (sv-role: Servant/Pastor only), toggleServantRoleFields() def ~L3796
- **Now:** components/portal/ServantForm.tsx L92-93 (role select now SERVANT/PASTOR/ADMIN); Classes Card L114 onward renders unconditionally
- **Verified:** Verified exactly: three role options now, and no role-conditional logic anywhere in the file to hide/disable the Classes card for Pastor.
- **Fix:** Hide/disable the Classes card when Role=Pastor, matching OG behavior.

### `F0553` [DEGRADED] Stage-level grouping in the servants list is not collapsible (only the class level is)
- **Role:** admin · **Area:** servants
- **OG:** index.stripped.html L3118 (spotlightToggle at class-group level, g.key) and L3136 (spotlightToggle at stage level, sid) — cited L3168-3198 lands on an unrelated panel in this build; corrected to L3118-3151
- **Now:** app/portal/(app)/admin/servants/page.tsx StageSection (L113-124, plain <section>, always expanded) vs ServantGroup (L127+, uses native <details>)
- **Verified:** OG line citation was imprecise (off by ~30-50 lines, pointing at a different admin panel) but the underlying claim is verified true against the correct OG lines and against the current portal code: only one of two OG collapse levels survived.
- **Fix:** Make the stage-level section collapsible too, e.g. wrap StageSection's body in a <details> like ServantGroup.

### `F0555` [MOVED] Per-servant "Edit" inline modal replaced by a full page
- **Role:** admin · **Area:** servants
- **OG:** index.stripped.html L3134 (editServantModal)
- **Now:** app/portal/(app)/admin/servants/[id]/page.tsx
- **Verified:** Verified the route exists and hosts the edit form. Acceptable UX change.
- **Fix:** None needed.

### `F0556` [MOVED] Per-servant "Reassign class" quick modal folded into the edit page
- **Role:** admin · **Area:** servants
- **OG:** index.stripped.html L3135 (reassignServantModal)
- **Now:** app/portal/(app)/admin/servants/[id]/page.tsx — class checkboxes inside ServantForm's Classes card
- **Verified:** Verified the class-assignment checkboxes live on the same edit page rather than a standalone modal. Acceptable.
- **Fix:** None needed.

### `F0557` [MOVED] Per-servant "Delete" now requires opening the edit page first, instead of an inline row action
- **Role:** admin · **Area:** servants
- **OG:** index.stripped.html L3136 (removeServantFB, inline)
- **Now:** components/portal/ServantForm.tsx ~L181-190 (Delete button on the edit page, reachable only via /portal/admin/servants/[id])
- **Verified:** Verified the delete action exists only on the per-servant edit page, requiring an extra click/navigation versus the OG's inline row action.
- **Fix:** None needed (acceptable UX change), as stated.

### `F0668` [MISSING] "Fix Orphaned Attendance" repair tool (attendance-vs-points reconciliation) is missing
- **Role:** admin · **Area:** settings
- **OG:** index.stripped.html fixOrphanedAttendance() L18212-18266
- **Now:** app/portal/(app)/admin/data/RepairPanel.tsx TOOLS array L11-38 (5 tools; 'orphan-points' fixes the opposite relationship — a PointEntry left without a classId)
- **Verified:** Verified none of the 5 listed repair tools reconciles AttendanceRecord rows against PointEntry rows. Also verified prisma/schema.prisma L395-396: PointEntry.attendanceRecordId cascades on AttendanceRecord delete, which prevents one direction of orphaning but not the case where a PointEntry is deleted independently (e.g. a manual undo) while the AttendanceRecord remains — so the OG scenario, while rarer under Postgres FKs, is not structurally impossible, exactly as the fix note already caveats.
- **Fix:** Add a repair tool that checks AttendanceRecord rows for a matching PointEntry (student+class+date) and reports/removes orphans, mirroring the OG's logic.

### `F0669` [DEGRADED] "Save Point Values" bulk save-all button is missing; sessions can only be saved one at a time
- **Role:** admin · **Area:** settings
- **OG:** index.stripped.html button L2863, saveAttendanceSessionPoints() L18154-18172
- **Now:** app/portal/(app)/admin/sessions/SessionEditor.tsx L82-84 (onClick={() => save(row)} is per-row only)
- **Verified:** Verified no aggregate/bulk save call exists anywhere in SessionEditor.tsx or the admin actions file.
- **Fix:** Add a 'Save all' button that submits every changed row's label/points/isActive in one server action call.

### `F0073` [DEGRADED] Empty classes disappear from the admin All Students page, and the roster is silently capped at 500
- **Role:** admin · **Area:** students
- **OG:** index.stripped.html L3255-3258 (a group pushed for every class regardless of member count), L3291 ('No students here'), L3329 (subtitle '<N> students total')
- **Now:** app/portal/(app)/admin/students/page.tsx L28 (take: 500), L44-46 (.filter((g) => g.members.length > 0)), L57 (subtitle '${students.length} shown')
- **Verified:** Verified virtually verbatim against the current file: the filter drops empty-class groups entirely and the cap is applied with no on-screen indication that it exists.
- **Fix:** Drop the empty-group filter and render the OG's 'No students here' empty state; either paginate or show 'showing 500 of N' when the cap is hit.

### `F0574` [MOVED] Take-attendance page header text changed ("Take Student Attendance" → "Attendance")
- **Role:** admin · **Area:** takeattendance
- **OG:** index.stripped.html ~L3184-3186 (static header 'Take Student Attendance' / 'Mark attendance for any class')
- **Now:** app/portal/(app)/classes/[id]/attendance/page.tsx L55-59 (title='Attendance', subtitle='{class} · mark who is present, excused or absent')
- **Verified:** Verified; purely cosmetic header copy. Confirmed unrelated to the already-applied AttendanceTaker key-prop fix (that fix addresses stale re-render state on date/session change, not header text), so no FIXED correction applies here.
- **Fix:** Cosmetic only, no fix required.

### `F0575` [DEGRADED] Attendance date field lost its `max` attribute, allowing backdating into the future
- **Role:** admin · **Area:** takeattendance
- **OG:** index.stripped.html ~L13182 (<input type="date" id="adat-date" value="todayET" max="todayET">)
- **Now:** app/portal/(app)/classes/[id]/attendance/AttendanceTaker.tsx L157-163 (date <input> with no max attribute)
- **Verified:** Verified: the date input has type/value/onChange/className but no max, so a servant could pick a future date. Genuinely an edge case (nothing forces someone to actually try backdating into the future), so low severity is fair.
- **Fix:** Add max={todayInNewYork()} to the date input.

### `F0577` [DEGRADED] Save confirmation toast dropped the point total ("+N pts for M students")
- **Role:** admin · **Area:** takeattendance
- **OG:** index.stripped.html ~L13317-13321 (msgParts includes '+' + act.pts + ' pts for ' + pts + ' students', plus excused/already-marked counts) — cited L13303-13307 is a few lines off but the same save routine
- **Now:** app/portal/(app)/classes/[id]/attendance/AttendanceTaker.tsx L119 (`Saved ${counts.p} present, ${counts.e} excused, ${counts.a} absent.` plus follow-up text; no points shown)
- **Verified:** Verified. Cosmetic message simplification, no functional loss (points are still awarded correctly, just not echoed in the toast).
- **Fix:** Optionally show the session's point value in the toast.

### `F0573` [MOVED] The any-class attendance picker moved into each class's detail page, but the Dashboard home already offers a faster, prominently-surfaced shortcut the finding missed
- **Role:** admin · **Area:** takeattendance
- **OG:** adat-class-select dropdown, OG L3184-3189
- **Now:** Primarily: app/portal/(app)/page.tsx (Dashboard) — for ADMIN, an "All classes" grid where every class card has its own "Attendance" button, plus a Sunday-specific reminder banner and a warning badge for classes with no attendance recorded yet today, all linking straight to /portal/classes/<id>/attendance. Secondarily: /portal/classes/<id>/page.tsx's "Take attendance" button, as the finding states.
- **Verified:** Verified directly by reading app/portal/(app)/page.tsx: for non-PASTOR roles the class cards render `<LinkButton href={`/portal/classes/${c.id}/attendance`}>Attendance</LinkButton>` right on the dashboard, with the section explicitly titled 'All classes' for ADMIN (not scoped to their own classes) and a hint reading 'It is Sunday — remember to take attendance.' Since Dashboard is the first, always-visible sidebar item for every role, this is a ~2-click path (Dashboard → Attendance) from literally any page — comparable effort to the OG's 1-click sidebar item + class-select dropdown. The finding's claim that the only path is 'Classes → open a class → Take attendance button' is true of the Classes list page specifically, but misses this more direct, more discoverable Dashboard path.
- **Fix:** Nice-to-have only: add a top-level 'Take Attendance' nav item (or make the /portal/classes list page itself show a direct Attendance button per row, matching the Dashboard) so the shortcut also persists when an admin is already deep in another section, not just when they return to the Dashboard.

### `F0051` [BROKEN] NextAuth's configured sign-in page for the whole app is /admin/login, not /portal/login, and the login page ignores callbackUrl
- **Role:** all · **Area:** auth-login
- **OG:** N/A per the finding — OG had a single page with its own auth-listener redirect logic; not a direct line-for-line comparison
- **Now:** lib/auth.config.ts:33-35 (pages.signIn: '/admin/login', global); the authorized callback's own hardcoded /portal/login redirect and PortalLoginForm.tsx:42 / lib/portal/actions/auth.ts:6 bypass it
- **Verified:** Confirmed the global misconfiguration and confirmed (via grep) there is no callbackUrl/searchParams handling anywhere in the portal login flow. Confirmed this is currently latent — the two explicit call sites paper over it — exactly as the finding itself states. Low severity is correct as given.
- **Fix:** Split pages.signIn by area or drop it and let each surface redirect explicitly; append callbackUrl in middleware and have PortalLoginForm honor it.

### `F0254` [DEGRADED] Topbar birthday chip is hidden on tablet widths (768-1024px) where the OG showed it
- **Role:** all · **Area:** birthdays
- **OG:** OG L973/1010 (topbar hides only below 769px) and L1125 (769-1024px tablet block never touches .atb-meeting-card) — confirmed, so OG shows the chip anywhere the topbar shows
- **Now:** components/portal/Shell.tsx (topbar shows from md/768px) vs components/portal/BirthdayChip.tsx (hidden ... lg:flex, i.e. only from 1024px)
- **Verified:** Confirmed a genuine 256px band (768-1024px) where the new portal's topbar is visible but the chip is not, which the OG never did.
- **Fix:** Change BirthdayChip's `hidden … lg:flex` to `hidden … md:flex`.

### `F0086` [MISSING] Animated stat counters gone — every dashboard number now snaps in, and the reduced-motion accommodation went with it
- **Role:** all · **Area:** dashboard
- **OG:** OG animateStatCounters, L2125-2146 — 800ms cubic ease-out count-up, honours prefers-reduced-motion — confirmed
- **Now:** nowhere — grep across the whole portal tree for data-count/CountUp/useSpring/requestAnimationFrame finds only unrelated hits in QrScanner.tsx
- **Verified:** Confirmed no count-up implementation exists anywhere. This is explicitly cosmetic per the task's own calibration rule (count-up animations are always low regardless of the original's treatment), so low is correct.
- **Fix:** Add a small client counter component used by StatCard for numeric values, honouring prefers-reduced-motion.

### `F0095` [DEGRADED] Stat card left border is hardcoded gold for every tile; the number's semantic colour hook exists but is almost never used
- **Role:** all · **Area:** dashboard
- **OG:** OG L481-494 — four semantic left-border/number colour variants (.stat.bl/.gr/.gd/.nv) — confirmed
- **Now:** components/portal/ui.tsx:150-216 StatCard
- **Verified:** Confirmed the left border is unconditionally `border-l-brand-gold` — that half of the claim is exactly right. But the number's colour is NOT structurally stuck: StatCard already derives `toneColor` from an optional `tone` prop and applies it to the number directly. The capability exists; a grep across ~20+ call sites shows `tone=` is passed at only one of them, so in practice every other tile does render near-black by default — the finding's observed behaviour is accurate even though its stated mechanism ("accent tints only the icon tile") slightly mischaracterises why.
- **Fix:** Pass `tone` consistently at call sites that want a coloured number, and additionally make the left border react to `tone`/`accent` (today only the icon tile does).

### `F0096` [DEGRADED] Topbar greeting flips to "Good evening" an hour earlier than the OG
- **Role:** all · **Area:** dashboard
- **OG:** OG getGreeting, L1711-1714 — `h < 18 ? 'Good afternoon' : 'Good evening'` — confirmed
- **Now:** lib/portal/format.ts:73-80 greetingFor() — `if (hour < 17) return 'Good afternoon'`
- **Verified:** Confirmed the off-by-one exactly as described; everything else (timezone, strings, first-name rendering) matches.
- **Fix:** Change `hour < 17` to `hour < 18` in lib/portal/format.ts:78.

### `F0314` [BROKEN] Topbar Birthdays-this-week card is a dead <span> (harmless, since Events is always one click away in the sidebar)
- **Role:** all · **Area:** events
- **OG:** OG .atb-meeting-card, e.g. L1640 (admin) `onclick="adLoad('schedule',...)"` — confirmed every role's card navigates to Events
- **Now:** components/portal/BirthdayChip.tsx — confirmed root element is a plain <span> with no Link/onClick anywhere in the file, used only at app/portal/(app)/layout.tsx:32
- **Verified:** The BROKEN fact is accurate — the chip really doesn't navigate. But lib/portal/nav.ts shows 'Events' is a full, permanent sidebar item for all four roles (lines 41/63/87/107), so losing this shortcut never blocks anyone or hides functionality — it's a cosmetic dead-link, not a medium-severity navigation gap. Also note F0156 in this same batch is effectively a duplicate/merge of this finding and F0254 (same component, same two facts).
- **Fix:** Wrap BirthdayChip's contents in <Link href="/portal/events">.

### `F0119` [DEGRADED] The Open/Resolved donut summary card was replaced by two plain, always-shown stat tiles
- **Role:** all · **Area:** followups
- **OG:** OG L17209-17223 — SVG donut with dash-array arc, wrapped in a card shown only when visTotal>0 — confirmed
- **Now:** app/portal/(app)/follow-ups/page.tsx:62-77 — two StatCards ('Open'/'Resolved'), no proportion visual, always rendered
- **Verified:** Confirmed exactly as described; purely visual, the same two numbers are still shown.
- **Fix:** Optional: render a small donut beside the counts and hide the block when openCount+doneCount===0, if the visual is wanted back.

### `F0232` [DEGRADED] Hymns empty state lacks an inline "+ Add Hymn" button, but a persistent "Add a hymn" panel with its own button already sits beside the list
- **Role:** all · **Area:** hymns
- **OG:** OG L4907, empty branch of the servant Hymns view — ends with an inline '+ Add Hymn' button calling toggleAddHymn() — confirmed
- **Now:** app/portal/(app)/hymns/HymnManager.tsx:92-101 (EmptyState with no action prop) — but HymnManager.tsx:211-239 renders a persistent, always-visible "Add a hymn" card with a "New hymn" button for any canWrite user, regardless of whether the list is empty
- **Verified:** Read the full HymnManager.tsx component, not just the empty-state branch. A servant setting up the hymn book for the first time is not blocked or meaningfully delayed: the add-hymn entry point is already on the same page as a separate panel, just not merged into the empty-state box itself. This is placement polish, not a lost capability, so it doesn't warrant medium severity.
- **Fix:** Optional: pass action={<button onClick={...}>Add Hymn</button>} to the EmptyState at HymnManager.tsx:92 so the shortcut also appears inline, matching the OG's exact layout.

### `F0235` [DEGRADED] The hymn list is silently capped at 300 rows
- **Role:** all · **Area:** hymns
- **OG:** OG L4886-4889 / L12648-12650 — both servant and student views fetch the entire hymns collection unbounded — confirmed
- **Now:** app/portal/(app)/hymns/page.tsx:16-21 — `prisma.hymn.findMany({ ..., take: 300 })`, no count query, no pagination UI
- **Verified:** Confirmed the hard cap and the absence of any indication a limit was applied. The finding's own framing ('nobody today, but once the book passes 300...') is honest about current impact.
- **Fix:** Either remove `take: 300`, or add a `prisma.hymn.count()` and show 'Showing the first 300 of N — search to find the rest.'

### `F0238` [DEGRADED] The Tasbeha.org card lost its book icon tile
- **Role:** all · **Area:** hymns
- **OG:** OG L4894-4897 — 38px rounded maroon-on-cream tile with a book-open icon before the text — confirmed
- **Now:** app/portal/(app)/hymns/page.tsx:33-48 — the card's two text lines are followed directly by the pill link, no icon element anywhere
- **Verified:** Confirmed exactly; the gold left-border accent the OG also used is present (Card component applies it), only the icon tile is missing.
- **Fix:** Add `<IconTile accent="#C89B3C"><BookOpen .../></IconTile>` before the text block at hymns/page.tsx:37.

### `F0167` [DEGRADED] Page header is not sticky on phones, so page actions scroll away
- **Role:** all · **Area:** nav-ia
- **OG:** OG CSS L562, inside the ≤768px block — `.ph{position:sticky;top:0;z-index:20;padding:16px 18px}`, also hides corner brackets — confirmed
- **Now:** components/portal/ui.tsx PageHeader (15-55) — no sticky class at any breakpoint, corner-bracket spans always rendered
- **Verified:** Confirmed exactly; scrolling back up to reach a header action is mild friction, not a blocker, so low is appropriate.
- **Fix:** Add `sticky top-0 z-20 md:static` to the PageHeader banner div and hide the corner-bracket spans below md.

### `F0168` [DEGRADED] Topbar avatar shows only the first name and never the person's photo
- **Role:** all · **Area:** nav-ia
- **OG:** OG L3994/L1557 — photo-or-initials fallback avatar, full name shown — confirmed
- **Now:** lib/portal/permissions.ts PortalUser interface (8-19) has no `photo` field at all; components/portal/Shell.tsx:299-311 always renders initials and only the first name
- **Verified:** Confirmed the gap is structural — PortalUser doesn't carry a photo field, so Shell.tsx has nothing to render even if it wanted to.
- **Fix:** Add `photo?: string` to PortalUser, populate it in requirePortalUser, and render an <Image> with initials as fallback; show the full name.

### `F0169` [DEGRADED] Academic year label drops the "Academic Year" prefix
- **Role:** all · **Area:** nav-ia
- **OG:** OG L1687 — `'Academic Year ' + startYear + ' – ' + (startYear+1) + ' (' + copticYear + ' Coptic)'` — confirmed
- **Now:** lib/portal/format.ts:65-69 academicYearLabel — identical math, missing the 'Academic Year ' prefix
- **Verified:** Confirmed the roll-over rule and -283 Coptic offset are reproduced exactly; only the leading label text differs.
- **Fix:** Prepend 'Academic Year ' in lib/portal/format.ts:69.

### `F0325` [DEGRADED] The readings page never fetches live (deliberately) — the real gap is no manual retry, not fragility to a missed cron
- **Role:** all · **Area:** readings
- **OG:** OG L13409-13417 — every readings view live-fetches api.coptic.io on each load, with an explicit failure notice — confirmed
- **Now:** lib/portal/data/community.ts:346-388 loadDailyReadings (DB-cache read only); app/api/coptic/cron/route.ts (daily cron); lib/coptic-api.ts getCopticDayData/getCopticDayDataBatch
- **Verified:** The DB-only read is confirmed and, per the function's own doc comment, is a deliberate design choice ('a page render must not depend on a third-party API'), not an oversight. More importantly, the 'missed cron leaves it permanently empty' framing is overstated: the cron pre-fetches a rolling 28-day window every day (vercel.json: daily), with a 24h cache TTL meaning each date is re-attempted on ~28 separate daily runs before it becomes 'today', and a failed live fetch explicitly falls back to returning the existing stale row rather than erasing it. There's also an authenticated manual refresh endpoint (app/api/coptic/refresh/route.ts) already in the codebase, just not wired to a UI button. A single missed cron essentially never produces the described empty state; it would take a brand-new date plus a live outage at the same moment, or ~28 consecutive daily failures.
- **Fix:** Wire the existing /api/coptic/refresh endpoint to a 'Try again' button in the EmptyState / an admin action, rather than adding a live-fetch fallback to the page render (which the original design intentionally avoided).

### `F0143` [MISSING] Legacy monthly Points report grid (per-activity columns, week/month totals) was already dead code in the OG — no successor exists, but none is owed
- **Role:** all · **Area:** reports
- **OG:** OG switchWeeklyReportView (L8851) / renderWeeklyReportTable (L9080) — confirmed via grep to have zero call sites anywhere in the 19,999-line file, i.e. already unreachable/dormant in production
- **Now:** nowhere — /portal/classes/[id]/points is a live award panel, /portal/leaderboard a ranking; neither is a per-week grid
- **Verified:** Independently re-ran the call-site grep and confirmed: this UI never rendered for any real user in the OG, so there is no actual behavioural regression to fix — only a documentation gap about an intentionally-dropped, already-dead feature. The finding already frames this correctly and asks only that the decision be recorded.
- **Fix:** Record the decision explicitly (drop it, or build a per-week per-activity points grid as a third Reports tab) so it isn't left as an open question.

### `F0304` [DEGRADED] Clearing a saved attendance record has no confirmation and is no longer admin-only
- **Role:** all · **Area:** servant-attendance
- **OG:** OG deleteServantAttendanceEntry, L6982-6999 — re-checks `_me.role==='admin'` and requires a styled confirm dialog before deleting — confirmed
- **Now:** lib/portal/actions/servant-attendance.ts saveServantWeek (CLEAR status handling) + app/portal/(app)/servant-attendance/ServantGrid.tsx (cell cycle)
- **Verified:** Confirmed a CLEAR mark is authorized only through the ordinary write-permission check (self/coordinator/stage-overseer/admin) with no extra admin gate, and the client cycles a cell to null then sends CLEAR on Save with no confirmation dialog anywhere.
- **Fix:** Show a confirm before saving when the payload contains any CLEAR affecting an existing record, and consider restricting CLEAR of someone else's record to ADMIN as the OG did.

### `F0071` [DEGRADED] My Stage cards no longer show an inline student roster, but the linked class page shows a richer one
- **Role:** all · **Area:** students
- **OG:** OG svOpenClassProfile modal, L16874-16919 — ≤460px modal listing every student + grade, plus servants grouped by title — confirmed
- **Now:** app/portal/(app)/my-stage/page.tsx (servant groupings + student-count badge, class name links to /portal/classes/[id]); app/portal/(app)/classes/[id]/page.tsx (full roster)
- **Verified:** Read the linked class page in full: it renders every student with name, attendance rate, follow-up flag, and points — more detailed than the OG's plain name+grade list, not less. The only real loss is the 'quick peek without leaving the stage overview' convenience for a coordinator comparing several classes at once — a minor friction point, not a missing capability, since the data is one click away and richer once there.
- **Fix:** If the quick-compare workflow matters, make the whole My Stage card open a lightweight roster disclosure (details/summary or a small dialog) in addition to keeping the class link.

### `F0774` [MISSING] WhatsApp (and phone) quick-contact icon-buttons missing from follow-up case rows/detail
- **Role:** pastor · **Area:** followup
- **OG:** index.stripped.html L17568 (pastor row), L17250 (servant row) — 💬 wa.me icon-button next to a 📞 tel: icon-button
- **Now:** nowhere — app/portal/(app)/follow-ups/[id]/page.tsx Family Contacts card has tel:/mailto: only; app/portal/(app)/follow-ups/page.tsx list rows have no phone/WhatsApp icons at all
- **Verified:** Confirmed the case-detail page lacks a wa.me link as filed. Broadened during verification: the OG actually placed both the phone AND WhatsApp icon-buttons on the LIST ROW (not the detail page), and the new list rows (full read of follow-ups/page.tsx) have neither — only a 'Contacts: N' count. So the gap is slightly larger than stated, though the finding's core claim (no wa.me link anywhere) and its fix are still correct and cheap to apply.
- **Fix:** Add a WhatsApp deep link next to the phone numbers already on the case-detail page; optionally also add quick tel:/wa.me icon-buttons back to the list rows to match the OG's at-a-glance pattern.

### `F0121` [DEGRADED] Follow-up case list capped at 200 rows with mismatched, uncapped summary counts
- **Role:** pastor · **Area:** followups
- **OG:** index.stripped.html L17206-17207, L18590-18591 (no limit anywhere)
- **Now:** app/portal/(app)/follow-ups/page.tsx L29-31 (take:200) vs L40-43 (uncapped counts)
- **Verified:** Confirmed via full read: the cases query applies take:200 for both open and resolved views, while openCount/doneCount are separately computed with no cap, so the tiles and the list could disagree once a church accumulates over 200 cases in either state (plausible only over several years, hence low).
- **Fix:** Paginate the list, or at minimum show 'Showing the first 200 of N' when the cap is hit; add a class filter for admins/pastor.

### `F0149` [MOVED] Sidebar count badges were consolidated into a global notification bell, not deleted
- **Role:** pastor · **Area:** nav-ia
- **OG:** Servant sidebar: #visit-badge L4015, #bday-badge L4025, #myassign-badge L4033; student sidebar: #exam-badge L11592; pastor sidebar: #pastor-visit-badge L19127 (the only one of the five on the pastor's own nav)
- **Now:** components/portal/NotificationBell.tsx, mounted for every role via headerSlot in app/portal/(app)/layout.tsx:34; fed by lib/portal/notifications.ts buildNotifications() and lib/portal/data/reports.ts buildFacts()
- **Verified:** Original evidence trails off mid-sentence and never finishes checking the bell before concluding MISSING. For PASTOR, buildFacts computes openCases and buildNotifications emits a warn-tone 'N open follow-up case(s)' item linking to /portal/follow-ups, shown as a live count directly on the bell icon on every page -- a full, arguably better replacement for #pastor-visit-badge. Servant Birthdays and student Daily Quiz are likewise replicated. The one real gap: servant 'My Assignments' has no equivalent fact anywhere in buildFacts -- but that's servant-specific, not part of the pastor experience this batch covers.
- **Fix:** No fix needed for the pastor view -- already present via the bell. If full parity is wanted, add an assignments-due fact for SERVANT to buildFacts/buildNotifications using existing assignment data; do not re-add per-nav-item badges, which would duplicate a system that already works better.

### `F0165` [MOVED] Pastor sidebar reorganized from a flat six items to 13 grouped items
- **Role:** pastor · **Area:** nav-ia
- **OG:** index.stripped.html L19122-19128 (six ungrouped .sbi rows, ending Church Reports, then Sign out)
- **Now:** lib/portal/nav.ts PASTOR case — Dashboard | People (Classes, Follow-ups, Birthdays) | Teaching (Lessons, Exams, Curriculum) | Community (Announcements, Events, Leaderboard, Church Reports) | Account (My PIN, Help)
- **Verified:** Verified the OG sidebar line-by-line: exactly six rows, no group labels. Verified the new PASTOR nav array has 13 items across 5 labeled sections. The Follow-up badge sub-claim duplicates F0792/F0783 and is tracked there rather than re-scored here.
- **Fix:** Optionally keep the six original destinations at the top in their original order for continuity, pushing added pages into a secondary group below; the badge fix is tracked separately under F0792.

### `F0779` [DEGRADED] Church Reports merged into one multi-metric card instead of switchable Attendance/Exam/Points tabs
- **Role:** pastor · **Area:** reports
- **OG:** index.stripped.html L7328-7332 (three switchChurchReportsMode tab buttons, one metric focus at a time)
- **Now:** app/portal/(app)/reports/page.tsx ClassCard rows (L172-217) — attendance, quiz average, and points all shown together
- **Verified:** Confirmed the OG's three single-metric tabs and the new portal's merged multi-row ClassCard. As the finding itself notes, showing all three metrics at once plausibly reads as an improvement over needing to click through three tabs, which is why low severity is appropriate here rather than a real defect.
- **Fix:** Optional — no change required; flag only if stakeholders prefer the OG's focused single-metric view.

### `F0820` [MISSING] Bible Reading CSV upload with a per-day custom inspirational message ⚠️ *unverified*
- **Role:** servant · **Area:** Exam import (servant) - Bible Reading CSV attachment
- **OG:** csvReadingsPreview() lets a servant attach a second CSV alongside the exam import to populate a per-day Bible reading passage plus a custom message for the Daily Readings feature, matched by day-of-month.
- **Now:** nowhere - /portal/readings instead pulls from an automated Coptic-calendar feed with no manual override/authoring path
- **Fix:** If the automated feed is intended to fully replace manual entry (likely correct), add an optional per-day custom-message override field a servant can set for the Daily Readings page, since the feed carries the passage but not that authorial content.

### `F0796` [MOVED] Styled confirm dialog (confirmStyled) shared across 22 destructive actions ⚠️ *unverified*
- **Role:** servant · **Area:** Global shared modal (#modal-confirm-styled), invoked from nearly every page with a delete/remove/clear action
- **OG:** One shared promise-based modal: red warning-circle icon, a pre-line message area (supports multi-line consequence text), red 'Confirm' button and 'Cancel'. Each of 22 call sites supplies its own consequence-specific copy, e.g. deleting a servant-meeting: 'This removes every servant's attendance record for this session permanently.'; bulk-deleting exams: 'Their questions and any related submissions
- **Now:** No shared confirm/dialog component exists (components/portal/ui.tsx has 20 exported primitives, none a confirm dialog). Most delete buttons instead use a local useState('confirming') toggle that swaps the button for 'Delete for good'/'Yes, delete' + Cancel in place (e.g. AnnouncementManager.tsx:50,198-213; PostCard.tsx:39,175-200; ExamsFilter.tsx:36,87-93; ExamActions.tsx:33,154-165; EventManager.tsx:46,203-218; HymnManager.tsx:51,147-164). A minority fall back to raw window.confirm() (ClassManager.tsx:78; StudentProfileActions.tsx:31,58 -- exactly 3 hits).
- **Fix:** Not urgent -- the inline-confirm pattern already prevents accidental deletes almost everywhere. If addressed, add a shared <ConfirmButton warning={...}> to components/portal/ui.tsx standardising the inline two-step pattern with per-action warning text, and swap the 3 remaining native confirm() calls to it.

### `F0832` [DEGRADED] Exam list grouped by month with collapsible sections (auto-expand current month) ⚠️ *unverified*
- **Role:** servant · **Area:** Servant > Exams (id='exams')
- **OG:** Exams are auto-sorted (upcoming first, then expired) and grouped into collapsible month sections; the current month auto-expands, others start collapsed with a chevron toggle.
- **Now:** app/portal/(app)/exams/ExamsFilter.tsx L101-113, a flat responsive card grid
- **Fix:** Optional: add month-based grouping headers above the card grid if the exam list grows large enough that flat scrolling becomes a problem in practice.

### `F0801` [MISSING] openSlideInCanva (test slide link before saving) ⚠️ *unverified*
- **Role:** servant · **Area:** Servant → Lesson Preparation → Edit Schedule week modal
- **OG:** Purple link opposite Cancel/Save & Close that opens whatever URL is currently typed into the live Slide Link input in a new tab, letting a servant test a pasted link before saving.
- **Now:** nowhere -- AgendaEditor renders the Slide Link input with no adjacent 'open/test' affordance
- **Fix:** See PARITY-AUDIT.md ~line 1041: add an 'Open slides' anchor next to the Slide Link field in AgendaEditor that opens the field's current value in a new tab (disabled when empty).

### `F0797` [DEGRADED] CSV import skip-report (showSkipReport) granularity ⚠️ *unverified*
- **Role:** servant · **Area:** Servant/Admin → Exams & Quizzes → Import CSV (also modeled for) Servant/Admin → Schedule of the Year → Import Schedule
- **OG:** showSkipReport(skippedRows) pops a modal titled 'N row(s) skipped during import' with a scrollable list where every skipped row gets its own line, e.g. 'Line 14 -- Question is empty', 'Line 22 -- Day "35" should just be a number from 1-31' -- real per-row diagnostics, not just a count.
- **Now:** Exams import: app/portal/(app)/exams/import/ExamImport.tsx:103-120 renders an inline TableWrap with Row / Why-it-was-skipped columns, one row per report.errors entry with the exact rejection message (lib/portal/exams.ts:328-341) -- functionally equivalent, PRESENT as an inline card instead of a modal. Agenda import: app/portal/(app)/agenda/AgendaTools.tsx:107-108 only surfaces an aggregate count ('N row(s) skipped.') plus a list of unmatched servant names, never the per-row reason.
- **Fix:** Extend importAgendaCsv's return shape with a skippedRows: { line: number; reason: string }[] (mirroring exams) and render it in AgendaTools.tsx the same way ExamImport.tsx does.

### `F0818` [DEGRADED] Plaintext PIN export/redisplay is gone by design — a correct security fix, not a real parity gap (login ID is still shown directly on the profile)
- **Role:** servant · **Area:** Students / Servants (admin) and Student Profile - Export IDs & PINs / View ID
- **OG:** exportStudentCredentialsCSV L10997, exportAllStudentCredentialsCSV L17952, exportAllServantCredentialsCSV L17977, View ID button L5075
- **Now:** lib/portal/actions/data-tools.ts exportStudentsCsv/exportServantsCsv (no PIN column, by design); students/[id]/page.tsx already shows the login ID directly as a header badge
- **Verified:** Confirmed exportStudentsCsv/exportServantsCsv never include a PIN, and the code comment 'pinHash is deliberately absent and must stay absent' is real. This matches what the finding's own fix text already concludes: this is a deliberate, correct security improvement (PINs are now bcrypt-hashed, so cannot be redisplayed, versus the OG storing them in plaintext) — not a regression to fix. I also checked the 'no View ID equivalent' claim specifically: the student's login ID (distinct from the PIN) is already shown unconditionally on the profile page header, so no separate button is needed for that part. Only the PIN itself is genuinely unrecoverable, by design.
- **Fix:** No code fix needed. Document this as an intentional security decision rather than tracking it as a gap; optionally add a bulk reset+print-slips workflow for start-of-year onboarding.

### `F0819` [MISSING] Blank Template download button, separate from Export Schedule ⚠️ *unverified*
- **Role:** servant · **Area:** Weekly Assignment / Agenda view (servant, admin)
- **OG:** renderWeeklyAssignmentView has three buttons: Import Schedule, Export Schedule (current filled-in schedule), and Blank Template (downloadAgendaBlankTemplate - identical row/column structure with every cell empty, for filling out offline before uploading).
- **Now:** nowhere
- **Fix:** Add a Blank template download to AgendaTools.tsx that reuses the same CSV row-builder as Export CSV but with all activity/topic/servant cells empty.

### `F0489` [DEGRADED] The old 3-way mode switch is gone, replaced by a single always-visible week editor — a structural description that mostly restates F0218 and F0219
- **Role:** servant · **Area:** agenda
- **OG:** L6297-6300, L8501-8506
- **Now:** app/portal/(app)/agenda/page.tsx (single merged layout); Weekly Assignment View moved to app/portal/(app)/agenda/week
- **Verified:** Confirmed there is no tri-state switch in the new agenda page — read the full file. But this finding does not, by itself, identify a capability loss beyond what F0218 (year overview) and F0219 (lesson archive search) already cover in more actionable, specific detail. A merged always-visible editor is a defensible UI pattern on its own; per the calibration, a restructuring/reordering claim without an independently-demonstrated capability loss is low severity.
- **Fix:** No independent fix needed beyond the fixes already given for F0218 and F0219.

### `F0229` [DEGRADED] My Assignments only reaches back eight weeks, so the "Past" section quietly loses the rest of the year ⚠️ *unverified*
- **Role:** servant · **Area:** agenda
- **OG:** Servant sidebar → My Assignments: an "UPCOMING (N)" card and a "PAST" card listing every past assignment in reverse chronological order, built by scanning every agenda document and every week
- **Now:** /portal/assignments → the collapsed "Past weeks (N)" details block, populated only from the last eight weeks
- **Fix:** Either widen the default to the school year (or make weeksBack a query parameter with a "show the whole year" toggle), or label the Past section "Last 8 weeks" so the number is not read as a year-to-date total.

### `F0494` [MOVED] Month-accordion archive of all weeks with green/dashed fill-status tiles ⚠️ *unverified*
- **Role:** servant · **Area:** agenda
- **OG:** renderAgendaForClass groups all school-year weeks by month into a collapsible accordion, tap a tile to edit
- **Now:** app/portal/(app)/agenda/page.tsx ArchiveMonths component L149-265 reproduces the same visual (month accordion, green/dashed tiles, N/M filled badge) but a tap navigates to that week inline in the main editor rather than opening a modal
- **Fix:** Mostly parity; one extra click to reach editable fields, note only

### `F0208` [MISSING] No sound when a student is marked present ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** OG servant Attendance page — every manual tap-to-present played a check-in sound (suppressed for bulk Select All and for the state-restore pass)
- **Now:** nowhere
- **Fix:** Play a short WebAudio blip in cycle() when the new status is PRESENT and the change came from a direct tap (not markAll, not the initial render), behind a user-preference toggle.

### `F0209` [BROKEN] The attendance page falls back to session key 'sunday' even when that session has been switched off, leaving a page that cannot save ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** OG built the Session dropdown from getFixedAttendanceSessions() and selected index 0, so the selection was always a live session
- **Now:** /portal/classes/[id]/attendance
- **Fix:** Change page.tsx:24 to fall back to the first active session: `?? (sessions.find(s => s.key === 'sunday') ?? sessions[0])?.key`, and render the existing "No attendance sessions are set up" empty state when the list is empty.

### `F0210` [DEGRADED] "Download Blank Form" button became a checkbox the admin has to find and tick ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** OG Attendance Report page header — a gold "⬇ Download Blank Form" button beside "Print Report"
- **Now:** /portal/reports — a "Blank form for paper" checkbox inside the filter card, which then changes the page's Print button to "Print blank form"
- **Fix:** Add a "Blank form" action button to the reports PageHeader actions (app/portal/(app)/reports/page.tsx:287-305) linking to the same URL with &blank=1, keeping the checkbox as the advanced control.

### `F0211` [MISSING] No way to correct one student's attendance from the report grid, and no week stepper (both were dead code in the OG) ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** OG Attendance Report — the weekly matrix whose ✓/✗ cells were clickable ("Tap to mark absent" / "Tap to mark present") with a confirmation naming student, activity and date and a prev/next week stepper
- **Now:** /portal/reports Attendance tab — the grid is read-only
- **Fix:** Optional. If you want the OG's in-place correction, make each matrix cell a small form posting to saveAttendance for that one (student, date, session) with a confirm naming the point change — and note that finding 1 must be fixed first, since the register's date navigation is the current correction path.

### `F0212` [MISSING] Absence Alert card (3+ consecutive Sundays, last seen, tap-to-call) never built — the rule lives on only as follow-up cases ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** OG servant Dashboard — an amber card "Absence Alert / N student(s) missed 3+ consecutive Sundays" with per-student last-seen, a weeks-absent pill that turns red at ≥5 weeks, and a circular tel: call button
- **Now:** nowhere; the nearest equivalent is the Follow-ups list
- **Fix:** Optional, and cheaper than the OG version: add the parent's phone as a tel: link to each row of the Follow-ups list and to the dashboard's open-case badges, and show "last seen N weeks ago" (FollowUpCase.lastSeen is already stored, lib/portal/actions/attendance.ts:131-139).

### `F0448` [MISSING] Trend-card empty state "Not enough attendance history yet" ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** Shown when fewer than 1 session exists
- **Now:** nowhere
- **Fix:** Bundle with the trend-ring fix

### `F0449` [DEGRADED] Tap card to mark present, plays a sound ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** attToggle marks green+check and calls playAttendanceSound() on marking present
- **Now:** AttendanceTaker.tsx:78-86 cycle() changes state with no audio anywhere
- **Fix:** Add a short audio cue on marking present

### `F0450` [MOVED] Per-card excuse-reveal button (Sick/Travel/Other chips) ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** Separate corner button toggles a hidden row of 3 reason chips; choosing one clears any present mark
- **Now:** AttendanceTaker.tsx - 3-state tap-cycle (Absent->Present->Excused); chips appear only once already Excused, no separate reveal button
- **Fix:** Interaction-model difference only; note for design review, not blocking

### `F0452` [DEGRADED] Validation toasts "No changes to save" / "Please choose a session" ⚠️ *unverified*
- **Role:** servant · **Area:** attendance
- **OG:** Blocks save with a specific error toast
- **Now:** lib/portal/actions/attendance.ts always accepts and re-writes the full marks array (idempotent); no "nothing changed" guard
- **Fix:** Not blocking; different-but-valid always-safe design

### `F0046` [DEGRADED] The topbar avatar is a non-interactive decoration, but Sign out and every nav destination the OG's dropdown listed are already present and more visible elsewhere
- **Role:** servant · **Area:** auth-login
- **OG:** L1602-1613, L1652-1663, L1560, doSignOut L2632-2636
- **Now:** components/portal/Shell.tsx lines 286-296 (dead <span> avatar); Sign out button lines 196-205 (always-visible, bottom of sidebar); nav destinations in lib/portal/nav.ts
- **Verified:** Confirmed the avatar has no onClick/menu. But the finding's framing that Sign out 'is gone' is wrong — it's an always-visible sidebar button, which is arguably more discoverable than the OG's hidden dropdown, not less. Also confirmed every destination the OG's dropdown listed (My Attendance, My Assignments for a servant; Classes/Servants/All Students/Settings for admin) is already a first-class, always-visible sidebar item in lib/portal/nav.ts. The only real issue is a decorative element that looks interactive but isn't — a cosmetic/consistency issue, not a lost capability.
- **Fix:** Either make the avatar pill a real button opening a small dropdown for parity/polish, or remove the unused ▾ chevron affordance so it doesn't look clickable when it isn't. Not urgent since Sign out and all nav destinations already work.

### `F0253` [MOVED] Birthdays moved out of the servant sidebar's "Community" group into "My Class" ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** Servant sidebar, group header "Community" — Birthdays sat first, above Posts and Events
- **Now:** Servant sidebar, group header "My Class" — after My Classes, My Stage and Follow-ups; "Community" now holds Class Posts, Events, Announcements, Daily Readings, Leaderboard, Reports
- **Fix:** Move the servant's Birthdays entry into the Community section in nav.ts (just above Class Posts) to match the OG grouping, or leave it and accept the retraining cost — but do not leave it silently different.

### `F0255` [DEGRADED] Status dots and the week-range subtitle are gone from the Birthdays page ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** Birthdays page — page subtitle showed the current ET week range '3/16/2026 — 3/22/2026', each section header repeated its own range on the right, and every All-Students tile carried a 7px status dot (green = this week, gold #C89B3C = next week, grey = later)
- **Now:** /portal/birthdays — subtitle reads "Everyone celebrating in the next 60 days"; the This-week card's right-hand slot shows a count, the month cards show a count, and no tile has a status dot
- **Fix:** Set the page subtitle to the current Mon–Sun ET range, repeat the range in the This-week (and restored Next-week) card headers alongside the count, and add the 7px green/gold/grey status dot to the all-students tiles.

### `F0507` [DEGRADED] Header subtitle: exact current-week Mon-Sun date range ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** ${fmtDate(monday)} — ${fmtDate(sunday)}
- **Now:** birthdays/page.tsx:126 subtitle is generic 'Everyone celebrating in the next 60 days', no explicit week date range shown anywhere
- **Fix:** add the current week's date range back into the subtitle or 'This week' card

### `F0509` [DEGRADED] Next-week grid cards with light-blue accent ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** bdRow() cards with #EFF6FF/#1D4ED8 accent for next week
- **Now:** individual next-week people appear as plain PersonTile inside month group with no light-blue accent, just a text label
- **Fix:** tied to the Next Week section finding above

### `F0510` [MISSING] Next-week empty state ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** "No birthdays next week" message
- **Now:** nowhere - no section, so no empty state either
- **Fix:** tied to Next Week section finding

### `F0512` [MISSING] Colored status dot per row (green=this week/gold=next week/gray=other) ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** dotClr indicator on each all-students card
- **Now:** nowhere - PersonTile has no colored dot, only a text 'away' label
- **Fix:** cosmetic; add the dot back if desired

### `F0514` [MOVED] Sidebar "Birthdays" nav item section grouping ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** grouped under sidebar section 'Community'
- **Now:** /portal/birthdays, group 'My Class' in lib/portal/nav.ts
- **Fix:** reachable either way; pure regrouping

### `F0515` [MOVED] Live numeric badge on the sidebar Birthdays item ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** bday-badge span showing count of this-week birthdays, set by refreshBirthdayBadge()
- **Now:** folded into the generic Notification Bell dropdown item ('N birthdays this week' -> /portal/birthdays) instead of a persistent sidebar count
- **Fix:** acceptable alternative; note only

### `F0516` [MOVED] One-time-per-session toast naming who has a birthday this week ⚠️ *unverified*
- **Role:** servant · **Area:** birthdays
- **OG:** sessionStorage-gated toast: names if <=2, else count
- **Now:** same notification-bell item carries up to 4 names (soon.slice(0,4)) instead of a popped toast
- **Fix:** acceptable alternative

### `F0349` [BROKEN] Sidebar entry for classboard (Lesson Archive, cross-class, lessons collection) ⚠️ *unverified*
- **Role:** servant · **Area:** classboard
- **OG:** No sidebar link exists anywhere in OG for this page — sv-sbi-cl referenced but never rendered
- **Now:** n/a — this is an OG-side defect (dead code), not a porting regression
- **Fix:** No fix needed for parity purposes — flagged for completeness only

### `F0351` [MOVED] "My Class" / "View Only" pills ⚠️ *unverified*
- **Role:** servant · **Area:** classboard
- **Now:** access enforced structurally instead (own-class edit UI vs read-only Archive subtitle 'Read only')
- **Fix:** none needed, different but equivalent UX pattern

### `F0352` [DEGRADED] Business rule: only status='taught' lessons shown (planned excluded) ⚠️ *unverified*
- **Role:** servant · **Area:** classboard
- **Now:** LessonManager.tsx shows both Planned and Taught in separate sections with a mark-taught toggle (L101-114,150-204)
- **Fix:** none — this resolves a real OG limitation rather than being a regression (intentionally changed, arguably improved)

### `F0337` [MISSING] Stat tile: Follow-up "Open Cases" (aggregate count) missing from class profile
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html L4838-4841, class-profile stats row
- **Now:** app/portal/(app)/classes/[id]/page.tsx — only a per-student Badge, no aggregate stat tile
- **Verified:** Confirmed missing exactly as stated. But the same count is already visible one click away: /portal/follow-ups has an 'Open' StatCard (same visible-class scope), and each affected student already shows a Follow-up badge on this very page. Real-world impact is low.
- **Fix:** Add an aggregate Open Cases StatCard back to the class page's stat row.

### `F0339` [MISSING] Monthly Digest "Top this month" callout line missing
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html L4746-4750 (compute), L4850 (render, conditional on cpTopThisMonth)
- **Now:** nowhere — the whole Monthly Digest card is absent from classes/[id]/page.tsx
- **Verified:** Real gap, confirmed, but it's one line of informational text within a larger missing digest card — closer to cosmetic/low-friction than a workflow loss.
- **Fix:** Port alongside a rebuilt Monthly Digest card.

### `F0340` [MISSING] "Most Active Student" card missing from class profile (info available via Points leaderboard)
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html L4793-4797 (compute), L4853-4862 (render)
- **Now:** nowhere on the class page; grep for 'Most Active'/'mostActive' across the portal returns nothing
- **Verified:** Card is gone, confirmed, but the same fact (class's #1 point earner) is already visible one click away on /portal/classes/[id]/points — PointsPanel's leaderboard puts a gold medal on the top student's card. Low real-world impact.
- **Fix:** Add the card back, or link to the class's points leaderboard.

### `F0342` [MISSING] "Recent Activity" preview card missing from class profile (fuller version exists on Points page)
- **Role:** servant · **Area:** classprofile
- **OG:** index.stripped.html compute L4801-4812 (slice 8, per-class), render L4877-4880
- **Now:** nowhere on the class profile page
- **Verified:** The underlying data isn't lost — /portal/classes/[id]/points already shows up to 60 recent PointEntry rows (student/activity/date/+pts) for the same class, a superset of the OG's 8-row preview. The gap is only that the profile page has no preview card; info is one click away.
- **Fix:** Add a small Recent Activity preview card to the class page, or link prominently to the Points page's history.

### `F0500` [MOVED] Extras row placement: Hymns Curriculum / Memorization Curriculum / User's Guidelines ⚠️ *unverified*
- **Role:** servant · **Area:** curriculum
- **OG:** OG places these as an underlined-text row below the grade grid, separate from the Core links row
- **Now:** lib/portal/curriculum.ts CURRICULUM_EXTRAS L27-31, merged into the same top banner as Core links (curriculum/page.tsx L52-60) rather than a separate bottom row
- **Fix:** Cosmetic regrouping only, same click targets, no functional loss

### `F0085` [MISSING] Collapsible dashboard widgets with remembered state gone
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html wCard chrome L4379-4390, toggleDashWidget persistence L2105-2123 (localStorage dashW_<id>)
- **Now:** nowhere — components/portal/ui.tsx's Card has no collapse affordance at all
- **Verified:** Confirmed missing. This is a mobile-scrolling convenience, not something that blocks or degrades a workflow — closer to the batch's cosmetic/low band than a functional loss.
- **Fix:** If revisited, add an optional collapsible chevron to the Card primitive with try/catch-guarded localStorage persistence.

### `F0354` [DEGRADED] Attendance-not-taken banner moved to a sidebar card and lost its 5pm-ET gate
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html ~L4517-4524 (full-width red banner, gated isSunday && hour>=17 ET, single CTA) — cited L302-316 is unrelated CSS
- **Now:** components/portal/widgets/CheckInWidget.tsx ServantCards (lines ~61-120) — right-column Card, gated only on isSunday, per-class Take/Code buttons
- **Verified:** Placement and gating differ as described, confirmed. But this reads as a defensible redesign, not a regression: it surfaces earlier in the day (before 5pm, when it's actually more useful) and gives direct per-class actions instead of one generic CTA. Downgraded to low.
- **Fix:** Optional — restore a prominent full-width banner with the 5pm gate only if servants report missing it.

### `F0363` [MISSING] Gold 'Attendance' quick-action tile missing, but per-class Attendance button already on the same dashboard
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html ~L4563-4568, gold-highlighted tile among 5 quick actions (cited L356-360 is unrelated CSS)
- **Now:** nowhere as a tile — confirmed the ADMIN-only actions gate is exactly at page.tsx:54, so SERVANT gets zero quick-action tiles
- **Verified:** Confirmed missing as a distinct tile, but the function isn't actually lost on this page: every ClassCard on the same dashboard already renders a one-click 'Attendance' LinkButton per class. A servant loses a generic shortcut but keeps an equivalent per-class one-click path on the very same screen. Downgraded to low.
- **Fix:** Optional polish — CheckInWidget + per-class ClassCard buttons already cover this need.

### `F0368` [MISSING] 'Student Growth' line chart missing, any role
- **Role:** servant · **Area:** dashboard
- **OG:** index.stripped.html studentGrowthTrend computed L4360, charted via Chart.js canvas L4428+
- **Now:** nowhere — no charting library or canvas widget anywhere in the new portal
- **Verified:** Confirmed absent, but this is a purely informational trend chart with no operational action tied to it (a vanity/awareness metric, not something acted on weekly). Downgraded to low.
- **Fix:** Rebuild as part of a future charting effort, low priority.

### `F0093` [DEGRADED] "Upcoming Lessons" widget degraded — three dated lessons with a View-all link replaced by a single next lesson ⚠️ *unverified*
- **Role:** servant · **Area:** dashboard
- **OG:** Servant Dashboard widget board, "Upcoming Lessons" card with a View all → Curriculum Resources link
- **Now:** components/portal/widgets/LessonsWidget.tsx:96-116 — a single "Next lesson" block at the bottom of the "This week in class" card
- **Fix:** Return the next three planned lessons and render them as rows with the day tile; point the header's View-all at /portal/curriculum as the OG did, in addition to the assignments link.

### `F0094` [DEGRADED] "Recent Exams" widget replaced by "Open exams" — a newly created exam that is already past due, or still a draft, never appears ⚠️ *unverified*
- **Role:** servant · **Area:** dashboard
- **OG:** Servant Dashboard widget board, "Recent Exams" card (latest 3 by createdAt) with View all → Exams
- **Now:** components/portal/widgets/ExamsWidget.tsx:127-193 — "Open exams", filtered and sorted differently
- **Fix:** Either add a small "Recently created" section to the exams widget (latest 3 by createdAt, any status), or keep the open-exams card and restore the OG's recency card alongside it.

### `F0353` [DEGRADED] Hero tag 'Sunday School · {stage} · {class}' ⚠️ *unverified*
- **Role:** servant · **Area:** dashboard
- **OG:** Tag shows servant's sidebarDisplayName/stage plus classTitle
- **Now:** app/portal/(app)/page.tsx:28 tag=`Sunday School · ${roleTag}`
- **Fix:** Include the servant's class/stage name in the hero tag, not just their role label.

### `F0359` [MISSING] Animated count-up on stat numbers ⚠️ *unverified*
- **Role:** servant · **Area:** dashboard
- **OG:** animateStatCounters(m) animates numbers counting up from 0 on load
- **Now:** components/portal/ui.tsx:177-210 StatCard
- **Fix:** Optional: add a count-up animation to StatCard if desired; cosmetic only.

### `F0371` [DEGRADED] Widget: 'Recent Exams' (latest created, 'View all' link) ⚠️ *unverified*
- **Role:** servant · **Area:** dashboard
- **OG:** Lists most recently created exams with question count and due date
- **Now:** components/portal/widgets/ExamsWidget.tsx:112-166 staffCard()
- **Fix:** Optionally add a 'recently created' sort mode or accept the redesign.

### `F0373` [MISSING] Per-widget collapse/expand chevron with localStorage persistence ⚠️ *unverified*
- **Role:** servant · **Area:** dashboard
- **OG:** Every dashboard widget can be collapsed; state remembered per widget id
- **Now:** components/portal/ui.tsx:113-150 Card
- **Fix:** Add a collapse toggle to the Card component used for dashboard widgets.

### `F0317` [DEGRADED] The TIME field lost its native time picker and is now a free-text box ⚠️ *unverified*
- **Role:** servant · **Area:** events
- **OG:** Add/Edit Event form, 2x2 grid, TIME cell — `<input type="time">`, a real picker
- **Now:** /portal/events form — a plain text input, max 40 chars, placeholder "6:00 PM", hinted "Free text" (app/portal/(app)/events/EventManager.tsx:125-127)
- **Fix:** Set `type="time"` on the input (keeping the String column) and format it for display in EventRow, or normalise free text on save so the card and the share text read consistently.

### `F0037` [DEGRADED] The reopen picker lost its "Select All Students" master checkbox ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** Reopen Exam modal, above the student list: a "Select All Students" checkbox that ticks every enabled row while deliberately skipping students who already submitted
- **Now:** /portal/exams/[id] → "Reopen for students" card — per-student checkboxes plus a "Clear all" button, but no way to select everyone
- **Fix:** Add a "Select all" button beside "Clear all" that sets `picked` to every id in `candidates` (which already excludes submitted students unless they were previously reopened).

### `F0476` [MOVED] All Exams / Create New / Import CSV tabs ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** 3-way tab switcher inside one page via switchExamTab()
- **Now:** Split into routes /portal/exams, /portal/exams/new, /portal/exams/import
- **Fix:** Cosmetic; all destinations reachable from header actions, no action required unless literal tabs are wanted back

### `F0480` [MOVED] Per-row inline 'Reopen' icon (shown only once expired) ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** One-click icon on the row opens the reopen modal scoped to that exam
- **Now:** app/portal/(app)/exams/[id]/ExamActions.tsx 'Reopen for students' card L92-130 (only reachable from the exam detail page, not the list)
- **Fix:** Consider adding a quick 'Reopen' link on the list card when overdue

### `F0481` [MOVED] Per-row inline 'Edit' icon opening a modal ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** openEditExamModal fills #modal-edit-exam in place
- **Now:** ExamCard 'Edit' LinkButton -> full page /portal/exams/[id]/edit (ExamEditor.tsx)
- **Fix:** Navigation cost only, feature intact

### `F0482` [DEGRADED] Create Exam due-date field floors at today (min attribute) ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** Due date input has min=today, preventing a past due date
- **Now:** app/portal/(app)/exams/new/ExamEditor.tsx:199-201 (no min attribute)
- **Fix:** Add min={todayInNewYork()} to the due-date input

### `F0485` [MISSING] Auto-group every 3 questions into a day when the CSV has no Day column at all ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** Fallback lets a servant paste a raw question list with no explicit day grouping
- **Now:** nowhere
- **Fix:** Edge-case convenience only, note for completeness

### `F0487` [DEGRADED] CSV live pre-import preview list with 'N exams will be created' status ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** Per-day preview cards with question counts shown before committing the import
- **Now:** app/portal/(app)/exams/import/ExamImport.tsx shows the result only AFTER running the import (report.created list L94-101); there is no dry-run preview step
- **Fix:** Minor UX regression, OG let you review before committing; new imports immediately. Consider adding a preview step

### `F0488` [MISSING] 'Select All Students' inside the reopen-for-students picker ⚠️ *unverified*
- **Role:** servant · **Area:** exams
- **OG:** #reopen-select-all master checkbox toggles every student row in the reopen modal
- **Now:** app/portal/(app)/exams/[id]/ExamActions.tsx:92-129 has only a 'Clear all' button, no 'select all'
- **Fix:** Add a 'Select all' control alongside the existing 'Clear all'

### `F0283` [MOVED] "+ New Post" moved out of the page header and was renamed ⚠️ *unverified*
- **Role:** servant · **Area:** feed-posts
- **OG:** Servant Posts page → the `.ph` page-header row, right-hand side, button labelled "+ New Post"
- **Now:** /portal/feed → a separate row BELOW the maroon page header, right-aligned next to the class dropdown, labelled "Write a post"
- **Fix:** Pass the composer to `<PageHeader actions={…}>` on the feed page exactly as the announcements page does, and label it "+ New Post" to match what servants learned.

### `F0284` [DEGRADED] Feed copy and the default post tag drifted from the prototype ⚠️ *unverified*
- **Role:** servant · **Area:** feed-posts
- **OG:** Empty class feed (📭 "No posts yet" / "Your servant will post lessons and announcements here") and the composer's tag select, which defaulted to Lesson
- **Now:** /portal/feed empty state reads "Nothing posted yet"; the composer's tag select defaults to Announcement
- **Fix:** Default the composer's tag to LESSON (and change the schema default to match), restore the OG empty-state wording, and give `relativeTime`'s fallback a year-bearing format so old posts are not mistaken for recent ones.

### `F0285` [BROKEN] A servant who oversees a stage but is assigned no class cannot post an announcement at all ⚠️ *unverified*
- **Role:** servant · **Area:** feed-posts
- **OG:** Servant Announcements page → "📣 Send Announcement" always present; addAnnouncementFB stamped the signed-in servant's own classId AND stage with no picker
- **Now:** /portal/announcements → the "New announcement" button is not rendered at all for such a servant
- **Fix:** Let a stage-overseeing servant target the classes in their stage: include `scope.classes.filter(c => c.stage === user.stageOversight)` in `targetable`, and widen `canManageAnnouncement` to accept `overseesStage(user, classStage)` so the server action agrees with the UI.

### `F0118` [MISSING] Swipe-left-to-delete on a case row is gone (mobile) ⚠️ *unverified*
- **Role:** servant · **Area:** followups
- **OG:** Every open Follow-up case row on a touch device is a .swipe-row hiding a full-height red "🗑 Delete" panel; drag past halfway and it snaps open
- **Now:** nowhere — no touch gesture anywhere in the portal
- **Fix:** Once a delete action exists, wrap the list row in a small client component that reproduces the OG gesture (or, at minimum, expose the delete button inline on the row so phones have a one-tap path).

### `F0120` [MOVED] Follow-ups moved out of the "Attendance & Rewards" sidebar group ⚠️ *unverified*
- **Role:** servant · **Area:** followups
- **OG:** Servant sidebar → group "Attendance & Rewards", between "QR Points" and "Points" — i.e. sitting with the attendance tools that create the cases
- **Now:** Servant sidebar → group "My Class" (after My Classes / stage, before Birthdays); Admin and Pastor → group "People". The "Attendance" group now holds QR Check-in, Servants Attendance and My Attendance, and does not mention follow-ups.
- **Fix:** Move the Follow-ups entry into the Attendance section for all three staff roles (or duplicate a link there), so it sits beside the tools that generate it.

### `F0411` [DEGRADED] Leaderboard helper text drops the "Tap 👁 to view a profile" clause
- **Role:** servant · **Area:** grades
- **OG:** Hymns... no — Grades page, leaderboard caption, index.stripped.html L5750
- **Now:** app/portal/(app)/classes/[id]/points/PointsPanel.tsx:202
- **Verified:** OG L5750 verbatim: 'Tap a card to select it — select several and give them points for the same activity below. Tap 👁 to view a profile instead.' New caption at PointsPanel.tsx:202 keeps only the first sentence; there is no view-profile affordance anywhere in the leaderboard grid to point to.
- **Fix:** Restore the eye-icon clause only once a view-profile action exists on the card; otherwise drop the reference entirely rather than leaving a dangling promise.

### `F0413` [DEGRADED] Give mode: sticky give bar has no independent activity dropdown
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html L5779 (#lb-act-select)
- **Now:** PointsPanel.tsx:242-283 (sticky give bar)
- **Verified:** Confirmed by reading PointsPanel.tsx 242-283: the give bar only has the Add/Remove toggle, a reason input, and Submit. Activity choice lives in the chip grid above via activityId state, not in the bar itself as OG's independent lb-act-select did.
- **Fix:** Optional: add a redundant activity <select> inside the sticky bar for parity, or accept the chip-grid-as-source-of-truth model.

### `F0415` [DEGRADED] Remove mode lost both its own amount field AND its 10-item preset reason dropdown
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html L5798-5810 (lb-remove-amount input AND lb-remove-reason-select with Misbehaving/Being late/etc. + Other)
- **Now:** PointsPanel.tsx — mode='remove' reuses the same magnitude/reason state as 'add'
- **Verified:** Confirmed the amount-field claim: PointsPanel.tsx derives a single `magnitude` from whichever activity chip or one-off value is active, used for both add and remove — no separate lb-remove-amount equivalent. But the finding understates the gap: OG remove mode also had a preset-reason dropdown (10 canned misconduct reasons + 'Other') at lb-remove-reason-select, entirely absent from the new portal, which now uses the same freeform text reason field for both directions. 'MOVED' undersells this as relocation when real capability (guided, consistent removal reasons) is gone.
- **Fix:** Give Remove mode its own numeric amount input, and restore the preset reason dropdown (with an 'Other' free-text fallback) alongside the shared reason field.

### `F0416` [MISSING] No chime/sound effects on give or remove
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html toggleLbSelect L9358-9371, giveLbPoints/removeLbPoints (playPointsSound/playDeductSound via Web Audio)
- **Now:** nowhere
- **Verified:** Grepped AudioContext|playPointsSound|playDeductSound|new Audio|howler across app/lib/components: zero hits except an unrelated video.play() call in QrScanner.tsx.
- **Fix:** Optional nice-to-have; add a short Web Audio chime on select/give/remove.

### `F0417` [DEGRADED] "Points History — All Students" panel lost its search box, filter chips, and group-by control
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html L9738-9762
- **Now:** PointsPanel.tsx:286 ("Recent activity" card)
- **Verified:** Confirmed OG built a full panel: search input, All/Added/Removed filter chips, and a Flat/Student/Date/Servant group-by select, none of which exist in the new 'Recent activity' card, which is just a plain reverse-chronological list.
- **Fix:** None beyond restoring scope/filters as the finding's own next row (F0422) covers; a search box would help large classes but isn't required for parity at low severity.

### `F0422` [DEGRADED] History table columns consolidated into one line, explicit Add/Remove badge dropped
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html L9789 onward (rowHtml, per-entry <tr> with typeBg/typeClr/typeLabel badge)
- **Now:** PointsPanel.tsx:290-312
- **Verified:** Confirmed: new markup is one <li> per entry with a colored +/- number, no separate colored 'Add'/'Remove' badge chip the way OG's rowHtml built one.
- **Fix:** Optional: add back an explicit Add/Remove badge chip next to the point delta.

### `F0405` [MISSING] No fixed mobile bottom-nav bar (affects overall nav pattern, not Points specifically)
- **Role:** servant · **Area:** grades
- **OG:** index.stripped.html fixed 5-tab bottom nav (Home/Students/Attend/Points/Exams)
- **Now:** components/portal/Shell.tsx uses a sticky mobile identity bar + hamburger-triggered full-screen drawer instead (lines 219-259), no fixed bottom tabs for any section
- **Verified:** This is a navigation-pattern difference affecting every section equally, not a Points-specific loss — a servant still reaches Points in the same number of steps as before (My Classes → class → Points) via the drawer. Downgraded to low.
- **Fix:** If a bottom nav is ever built, include Points as one of the primary tabs, per the OG.

### `F0406` [MISSING] Global search quick-link "Points" ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** Typing in sidebar search surfaces a Points quick link
- **Now:** nowhere
- **Fix:** Out of scope for this page alone (whole-portal search is missing); note for a global-search feature ticket.

### `F0407` [DEGRADED] Activities / History tab switcher ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** Two clickable tab headers toggling two panels via switchPointsTab()
- **Now:** components/portal/... PointsPanel.tsx (both sections rendered stacked, no tabs)
- **Fix:** Optional: keep as continuous scroll (arguably fine) or reintroduce tabs for parity.

### `F0409` [MOVED] "+ Add Activity" dashed tile in the grid ⚠️ *unverified*
- **Role:** servant · **Area:** grades
- **OG:** Opens modal to create a new persistent activity
- **Now:** PointsPanel.tsx:104-124 header "+ New activity" button; the dashed tile inside the grid is now "One-off" (a different, unsaved concept)
- **Fix:** None required; both concepts are reachable, just relabeled/relocated.

### `F0233` [DEGRADED] Only one hymn's lyrics can be open at a time (exclusive accordion, not independent)
- **Role:** servant · **Area:** hymns
- **OG:** index.stripped.html L14699-14706 (toggleHymnLyrics), L14708-14719 (buildHymnCard)
- **Now:** app/portal/(app)/hymns/HymnManager.tsx:50 (openId state), :116 (setOpenId call)
- **Verified:** Confirmed OG toggles each row's own hy-lyrics-<id> element independently — N rows can be open at once. New HymnManager.tsx:50 is `useState<string | null>` (single scalar); line 116's onClick sets openId to the new id or null, necessarily closing any other open row. Line references check out exactly.
- **Fix:** Change openId to a Set<string>/string[] at HymnManager.tsx:50 and toggle membership at :116.

### `F0234` [DEGRADED] Two hymns can no longer share a title (OG allowed duplicates, new portal blocks them)
- **Role:** servant · **Area:** hymns
- **OG:** index.stripped.html L14668-14685 (saveHymn — unconditional addDoc, no uniqueness check)
- **Now:** lib/portal/actions/hymns.ts:53-59 (rename) and :61-66 (create) — case-insensitive title clash check via prisma.hymn.findFirst
- **Verified:** Confirmed by reading both: OG validates only non-empty title+lyrics before an unconditional addDoc; new code throws 'A hymn with that title is already in the book.' on both create and rename paths.
- **Fix:** Either drop the clash checks, or downgrade to a non-blocking warning ('already exists — add anyway?') to restore OG's permissiveness.

### `F0517` [MOVED] "Add Hymn" button moved from the page header into the right-hand form card
- **Role:** servant · **Area:** hymns
- **OG:** index.stripped.html L4893 (button inside .ph header, toggleAddHymn())
- **Now:** HymnManager.tsx ~231-240 ("New hymn" button inside the "Add a hymn" card)
- **Verified:** Confirmed by reading the OG markup at L4893 (button lives in .ph header) and the new component (button lives in a separate right-column card). Purely cosmetic relocation.
- **Fix:** Cosmetic; no action required.

### `F0518` [DEGRADED] Hymn save no longer requires lyrics, only a title
- **Role:** servant · **Area:** hymns
- **OG:** index.stripped.html L14671 (`if (!title || !lyrics) { showNotif(...) }`)
- **Now:** lib/portal/actions/hymns.ts:23-27 (HymnSchema — lyrics is `.optional()`, no `.min()`)
- **Verified:** Confirmed both sides read exactly as cited.
- **Fix:** Intentional-looking relaxation given the new edit-in-place flow; flag only, no forced fix.

### `F0270` [DEGRADED] Curriculum book grid is denser than the OG at both the mobile and desktop ends
- **Role:** servant · **Area:** lessons
- **OG:** index.stripped.html L4970 (repeat(3,1fr) default), L1129 (2-up 769-1024px), L1141 (1-up ≤640px)
- **Now:** app/portal/(app)/curriculum/page.tsx ~65 (grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5)
- **Verified:** Confirmed both sides exactly as cited; OG never drops below 1 column, new portal never drops below 2, and goes up to 5 vs OG's 3 max.
- **Fix:** Use grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 to match OG's 1/2/3 progression, or accept as a deliberate visual refresh (cosmetic, correctly low severity).

### `F0612` [DEGRADED] Literal "Upcoming (N)" section header replaced by StatCards
- **Role:** servant · **Area:** myassignments
- **OG:** index.stripped.html L17018 ("Upcoming (" + upcoming.length + ")")
- **Now:** app/portal/(app)/assignments/page.tsx ~78-95 (three StatCards: This week/Coming up/Past weeks)
- **Verified:** Confirmed; the count is still visible (in the StatCards) just not as one literal header line.
- **Fix:** Optional: keep as an enhancement, or add the literal header back for muscle-memory parity.

### `F0613` [DEGRADED] Past assignments now collapsed by default behind a <details> disclosure
- **Role:** servant · **Area:** myassignments
- **OG:** index.stripped.html L17023-17026 (Past section always rendered inline)
- **Now:** app/portal/(app)/assignments/page.tsx ~119-135 (<details> with no open attribute)
- **Verified:** Confirmed: the <details> element has no `open` prop so it renders collapsed, requiring an extra tap to see past assignments that OG always showed.
- **Fix:** Default-open the details element, or accept as intentional decluttering.

### `F0615` [BROKEN] Dead server action markMyServantAttendance — real but harmless, a working alternate path (saveServantWeek) already covers self check-in
- **Role:** servant · **Area:** myattendance
- **OG:** n/a in OG
- **Now:** lib/portal/actions/servant-attendance.ts L114 markMyServantAttendance — zero callers confirmed by grep across app/, lib/, components/
- **Verified:** The doc comment claiming it 'powers the dashboard widget and My Attendance' is stale. CheckInWidget.tsx (read in full) shows the real dashboard card links to /portal/servant-attendance ('Open grid') rather than one-tap writing. No servant is blocked by this — saveServantWeek via the grid does the same job (see F0614).
- **Fix:** Either delete the dead function, or wire it into a genuine one-tap dashboard action as originally intended — either is a cleanup task, not a user-facing fix.

### `F0616` [MOVED] 'Save Attendance' button is on the Servants Attendance grid, not on My Attendance
- **Role:** servant · **Area:** myattendance
- **OG:** index.stripped.html L6847, saveServantAttendance L7024-7055
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx — 'Save N changes' button wired to saveServantWeek
- **Verified:** True that my-attendance/page.tsx has no save button. False that saving is gone from the portal — same root cause as F0614/F0615.
- **Fix:** Ships together with the F0614 fix.

### `F0646` [DEGRADED] My PIN/profile page shows only a generic 'Servant' badge, no class/stage line
- **Role:** servant · **Area:** myprofile
- **OG:** index.stripped.html L5614-5615 (e.g. 'Coordinator · Elementary' under the name)
- **Now:** app/portal/(app)/settings/page.tsx:18-23
- **Verified:** Read the full 31-line settings/page.tsx: avatar, name, a single role Badge (ROLE_LABEL[user.role]), and the PIN form — no classTitle or stage anywhere.
- **Fix:** Add a classTitle/stage line under the name for servants who have one.

### `F0647` [MISSING] Footer note telling the servant that name/class/position are admin-managed is gone
- **Role:** servant · **Area:** myprofile
- **OG:** index.stripped.html L5642
- **Now:** nowhere
- **Verified:** Confirmed via the same settings/page.tsx read — there is no contact-info section at all on this page, so the note has nothing to attach to.
- **Fix:** Re-add if/when a contact-info section returns to the profile page.

### `F0654` [MOVED] Topbar avatar dropdown is absent, but 3 of its 4 destinations (My Attendance, My Assignments, Sign out) are already permanent sidebar items
- **Role:** servant · **Area:** myprofile / myattendance / myassignments
- **OG:** Topbar avatar dropdown: My Profile / My Attendance / My Assignments / Sign out (index.stripped.html L1602-1613)
- **Now:** components/portal/Shell.tsx L275-301 (static avatar span) + lib/portal/nav.ts (sidebar items) + the sign-out form at the bottom of the sidebar nav list
- **Verified:** The static-span fact is true, but the framing overstates the loss: My Attendance and My Assignments are permanent sidebar links (see F0610/F0620), and Sign out is a permanent button at the bottom of that same sidebar. Only My Profile is a genuine destination gap, already tracked via F0641/F0642.
- **Fix:** Optional: add a topbar dropdown for OG-familiarity, linking to the existing sidebar destinations. The substantive fix is building My Profile (F0641/F0642).

### `F0640` [DEGRADED] My Stage class card: only the class-name text is a link, not the whole card
- **Role:** servant · **Area:** mystage
- **OG:** index.stripped.html L16963 (onclick on the whole card div)
- **Now:** app/portal/(app)/my-stage/page.tsx ~79-85
- **Verified:** Confirmed by reading the file: only the <Link href={.../classes/${c.id}}> wrapping the class name is clickable; the surrounding <Card> has no onClick or wrapping anchor.
- **Fix:** Wrap the whole Card in the Link, or make the Card itself navigate on click.

### `F0637` [MOVED] 'Print Stage Report' button already exists and is reachable via the sidebar's Reports link, not gated behind fixing My Stage
- **Role:** servant · **Area:** mystage
- **OG:** index.stripped.html L7433
- **Now:** app/portal/(app)/reports/page.tsx — single PrintButton inside the Church reports tab
- **Verified:** Confirmed the button exists and prints exactly the stage-scoped report (scopeLabel shows '{Stage} stage' for a servant). Reachable today via the sidebar 'Reports' item → Church reports tab — no other fix is a prerequisite, contrary to the original fix note.
- **Fix:** None required for reachability; optionally surface it more directly from My Stage per F0633.

### `F0153` [BROKEN] setClassPhoto is a dead server action — the class-icon 'Change class photo' control has no UI
- **Role:** servant · **Area:** nav-ia
- **OG:** Servant sidebar crest class tile (index.stripped.html L3998, openClassPhotoModal L10299)
- **Now:** lib/portal/actions/photos.ts:89 setClassPhoto (zero callers); components/portal/Shell.tsx L123-131 hardcodes a static /images/Logo.png with no per-class source or click handler
- **Verified:** Confirmed by an independent grep. SchoolClass.photo exists in prisma/schema.prisma L243, so the field and action are fully built, just unwired. Downgraded from high to low: unlike the student/self photo (F0643, used for identification on rosters/leaderboard/report cards), this is purely decorative class-icon branding with no effect on any task.
- **Fix:** Add a class-photo control (reuse components/portal/PhotoUpload.tsx) to the class page, bound to setClassPhoto, and pass the class photo into Shell for the crest icon.

### `F0849` [MISSING] No servant-scoped 'Delete all students in my class' feature (but the OG one was unreachable dead code anyway)
- **Role:** servant · **Area:** page-servant — 'Delete All Students' modal scoped to the servant's own class
- **OG:** index.stripped.html L17888-17952 (openDeleteAllStudentsModal/runDeleteAllStudents)
- **Now:** nowhere
- **Verified:** Grepped delete.*all.*student|deleteAllStudents|bulk.*delete across app/lib/components: no matches. Independently confirmed the finding's own caveat — grepping DeleteAllStudentsModal in the OG shows only the function definition and internal style toggles, no button/onclick anywhere ever opens it, so no live OG user could reach this either.
- **Fix:** Low priority given the OG bug; only worth building if a real need for bulk delete emerges.

### `F0840` [MISSING] No personal class-nickname (sidebarDisplayName) feature for servants
- **Role:** servant · **Area:** page-servant-class — sidebar class name pencil
- **OG:** index.stripped.html L10261-10283 (openRenameClassModal/saveRenamedClass), trigger L4001
- **Now:** nowhere
- **Verified:** Grepped sidebarDisplayName|renameClass|nickname across app/lib/components/prisma: zero hits. The admin's church-wide class-rename in ClassManager is a different, already-present capability, correctly distinguished by the finding.
- **Fix:** Cosmetic; add a nickname column on ClassServant plus a small edit affordance if pursued.

### `F0501` [MOVED] "+ New Post" button moved out of the page header into a separate row
- **Role:** servant · **Area:** posts
- **OG:** index.stripped.html L5508 (button inside .ph header)
- **Now:** app/portal/(app)/feed/page.tsx ~40-54 (FeedComposer in a flex row below PageHeader, no actions prop passed)
- **Verified:** Confirmed: PageHeader receives no actions prop; FeedComposer renders in its own row.
- **Fix:** Pass FeedComposer as PageHeader's actions to restore header placement, or accept as-is.

### `F0502` [MOVED] Pin control moved from compose-time checkbox to a per-post toggle action
- **Role:** servant · **Area:** posts
- **OG:** index.stripped.html L5515-5516 (#fd-pin checkbox in the new-post form)
- **Now:** app/portal/(app)/feed/PostCard.tsx:161 (togglePin); lib/portal/actions/feed.ts:58 (UpdateSchema omits pinned)
- **Verified:** Confirmed: grepped 'pin' in FeedComposer.tsx (zero hits) and in feed.ts's UpdateSchema (explicit .omit({ pinned: true })) — pinning is entirely a post-card action now, unavailable at compose time.
- **Fix:** Acceptable alternative; note only, no fix required.

### `F0504` [MOVED] Edit modal replaced by an inline in-place edit card
- **Role:** servant · **Area:** posts
- **OG:** index.stripped.html L18956-18991 (#feed-edit-overlay centered modal)
- **Now:** app/portal/(app)/feed/PostCard.tsx ~98-104 (`editing ? <FeedComposer/> : ...`)
- **Verified:** Confirmed by reading the file: editing state swaps the post's content for an inline FeedComposer in the same card position, not an overlay.
- **Fix:** Cosmetic only; same fields present except Pin (see F0502).

### `F0015` [DEGRADED] "No activities yet" QR panel messages are plain text, no link to fix it
- **Role:** servant · **Area:** qr
- **OG:** index.stripped.html L19016-19020 (deep-link button that closes the modal, navigates to Points, and opens Manage Activities after 150ms)
- **Now:** app/portal/(app)/qr/ScanPanel.tsx:194 (bare <p>); app/portal/(app)/qr/GroupCodePanel.tsx:276 (Callout tone="warn", plain text)
- **Verified:** Confirmed both cited lines verbatim: neither element is a link/button, both are plain static text.
- **Fix:** Turn both into LinkButtons pointing at /portal/classes/${classId}/points (the route already exists).

### `F0016` [DEGRADED] QR scan counter polls every 5s instead of updating live
- **Role:** servant · **Area:** qr
- **OG:** index.stripped.html L14589-14602 (listenForGroupScans, onSnapshot), L14441-14458 (listenForMeetingScans)
- **Now:** app/portal/(app)/qr/GroupCodePanel.tsx:88 (window.setInterval(..., 5000) around the codeStatus action)
- **Verified:** Confirmed the 5000ms interval at exactly line 88. Note: lib/live-poller.ts (the fix's suggested reuse target) is actually a livestream-player-specific controller per its own doc comment, not a generic live-query mechanism, so 'route through lib/live-poller.ts' is a slight misnomer — the underlying suggestion (push-based or shorter-interval updates) still stands.
- **Fix:** Shorten the interval to ~2s while a code is live, or add a proper SSE/websocket path for QR status rather than reusing the livestream-specific poller file.

### `F0017` [DEGRADED] QR page header subtitle is a static string, no stage or date shown before generating a code
- **Role:** servant · **Area:** qr
- **OG:** index.stripped.html L13851 (qr-session-info = stage + today), L14546 (rewritten to class names + date after generating)
- **Now:** app/portal/(app)/qr/page.tsx:41
- **Verified:** Confirmed: subtitle is the hard-coded string 'Show one code for the class to scan, or scan the students' own cards one by one.' with no interpolated date or stage.
- **Fix:** Make the subtitle dynamic: append the formatted today's date and, for servants, their stage label.

### `F0328` [MOVED] Readings moved out of the servant sidebar's Teaching group into Community
- **Role:** servant · **Area:** readings
- **OG:** index.stripped.html L4038 (Teaching group: Curriculum Resources, Hymns, Readings)
- **Now:** lib/portal/nav.ts SERVANT branch — Teaching section has no Readings entry; Readings sits under Community (line ~89)
- **Verified:** Confirmed by reading nav.ts in full: Teaching = Exams, Lesson Prep, Schedule of the Year, My Assignments, Hymns, Curriculum; Readings is grouped under Community alongside Class Posts/Events/Announcements/Leaderboard/Reports.
- **Fix:** Move the Readings entry in lib/portal/nav.ts into the Teaching section, directly after Hymns.

### `F0521` [DEGRADED] Reading service sections (Vespers/Matins/Liturgy) lost their distinct icons/colors
- **Role:** servant · **Area:** readings
- **OG:** index.stripped.html L13432-13440 (serviceGroups: 🕯️ Vespers, 🌅 Matins, ✟ Liturgy)
- **Now:** app/portal/(app)/readings/page.tsx (every section Card uses the same <BookOpen> icon)
- **Verified:** Confirmed both sides exactly as cited.
- **Fix:** Add a small icon/color map keyed by section.section.

### `F0526` [MOVED] Readings now come from a server-side cache instead of a live client-side coptic.io fetch
- **Role:** servant · **Area:** readings
- **OG:** index.stripped.html L13407 (client-side fetch on every page load)
- **Now:** lib/portal/data/community.ts:341-344 (loadDailyReadings reads a CopticDayCache table)
- **Verified:** Confirmed the doc comment verbatim: 'Never calls coptic.io: a page render must not depend on a third-party API.' This is a deliberate, more robust architecture change, correctly flagged as informational rather than a defect.
- **Fix:** None — note only.

### `F0520` [MISSING] Section label "Today's Readings — tap a line to read" is gone (cosmetic instructional copy)
- **Role:** servant · **Area:** readings
- **OG:** OG L13454
- **Now:** nowhere — app/portal/(app)/readings/page.tsx renders plain Cards with dl/dt/dd, no such copy
- **Verified:** Confirmed missing, but this is pure instructional chrome for a tap-to-expand feature that is itself tracked as missing elsewhere (not in this batch). Per this audit's own calibration, cosmetic labels with no independent function are low, not medium.
- **Fix:** Ships together with restoring the click-to-expand passage feature; add the label back at that point.

### `F0525` [MISSING] Chevron ▾/▴ per reading row is gone (cosmetic affordance icon)
- **Role:** servant · **Area:** readings
- **OG:** OG L13454 area (chev- span)
- **Now:** nowhere — dependent on the missing click-to-expand feature
- **Verified:** Same reasoning as F0520: purely a UI icon tied to a feature tracked separately; downgraded from medium to low.
- **Fix:** Ships with the click-to-expand fix.

### `F0426` [MISSING] No 'Reports' quick-action tile on the servant dashboard (Reports itself is still reachable via the sidebar)
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L4569-4572 (dash-quick-actions grid, 'Student Reports' tile)
- **Now:** app/portal/(app)/page.tsx — no Reports reference anywhere
- **Verified:** Confirmed via direct grep of page.tsx (zero hits for reports|Reports) and confirmed the feature remains reachable through lib/portal/nav.ts:91's sidebar entry — so this is specifically the dashboard shortcut, not the whole feature, exactly as the finding states.
- **Fix:** Add a Reports shortcut card/button to the servant dashboard.

### `F0427` [MISSING] No global search, so no 'Reports' quick-link from search either
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L18708-18711 (quickLinks.push for 'reports' search match)
- **Now:** nowhere — no search feature exists in the new portal
- **Verified:** Confirmed the OG citation verbatim, and confirmed via directory search that no search component exists anywhere under app/portal or components/portal.
- **Fix:** Out of scope pending a global search feature being built at all.

### `F0429` [MISSING] "Student Report Cards" section header with student count is gone
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L6218-6220 ('Student Report Cards' header + '${students2.length} students')
- **Now:** app/portal/(app)/reports/cards/page.tsx — cards render directly under the filter bar, no header
- **Verified:** Confirmed the OG citation verbatim; confirmed the new page has no equivalent header/count above the card grid.
- **Fix:** Add a section header restating class/count above the cards list.

### `F0431` [MISSING] Per-card "top activity" stat (student's most-earned activity) is gone
- **Role:** servant · **Area:** reports
- **OG:** index.stripped.html L6190-6198 (topAct[0]+' · '+topAct[1]+' pts')
- **Now:** app/portal/(app)/reports/cards/page.tsx and lib/portal/data/reports.ts — no such computation anywhere
- **Verified:** Confirmed the OG citation verbatim; grepped topActivity|top activity|mostEarned in lib/portal/data/reports.ts with zero hits.
- **Fix:** Add a 'top activity' line to each report card, computed as max of points grouped by activityLabel.

### `F0495` [DEGRADED] Add/Edit Event form dropped the standalone 'Day' selector (redundant with Date anyway)
- **Role:** servant · **Area:** schedule
- **OG:** index.stripped.html L5548-5550 (sch-day <select> Sun-Sat, separate from sch-date)
- **Now:** app/portal/(app)/events/EventManager.tsx:127-137 (Date/Time/Location only)
- **Verified:** Confirmed both sides; the OG's Day field was a fully independent manual select that could in principle disagree with the actual Date, so its removal is arguably a correctness improvement, not just a regression.
- **Fix:** Cosmetic; the date already encodes weekday, not worth restoring unless Day was ever used independently of Date downstream (it wasn't, per the schema).

### `F0497` [MISSING] Automatic YouTube-thumbnail/image preview on event link (cosmetic convenience)
- **Role:** servant · **Area:** schedule
- **OG:** OG L15013-15053 (buildCard regex-detect + thumbnail)
- **Now:** app/portal/(app)/events/page.tsx EventRow (128-139) — always a plain 'Details' link
- **Verified:** Confirmed missing via grep for youtu/thumbnail/hqdefault (zero hits). Downgraded from medium to low: the underlying task (open the linked video/flyer) works identically via the Details button; this is a decorative preview, cosmetic per this audit's own calibration.
- **Fix:** Restore the thumbnail-preview branch if desired, but it is not blocking or friction-causing.

### `F0301` [DEGRADED] Scanning the meeting QR no longer checks a servant in automatically — it now needs a button press
- **Role:** servant · **Area:** servant-attendance
- **OG:** OG L14462-14504 (checkMeetingQRScan/processMeetingQRScan): fires on app boot from ?meetingqr=, no UI, writes servant_attendance immediately
- **Now:** app/portal/(app)/scan/[token]/page.tsx — always renders a card with a 'Check me in, <FirstName>' submit button (redeemCodeForm)
- **Verified:** Read scan/[token]/page.tsx in full: every code path (invalid, already-redeemed, blocked, or valid) requires an explicit form submit. No auto-redeem path exists.
- **Fix:** Low priority; if OG parity is wanted, auto-submit for SERVANT_MEETING tokens or accept as a deliberate consent step.

### `F0302` [MISSING] The single-servant attendance page and its servant picker are gone (already orphaned in the OG)
- **Role:** servant · **Area:** servant-attendance
- **OG:** OG L6859-6918 renderServantAttendancePage; L7113-7117 servant select; L7011-7014 saSelectServant; L8028-8031 switchServantAttendanceMode
- **Now:** nowhere — /portal/servant-attendance only has the bulk matrix
- **Verified:** Grepped the OG for every call site of renderServantAttendancePage and for the string 'sa-container': only called from within itself (saSelectServant, switchServantAttendanceMode), never from a nav/router case. Confirms it was dead code in the OG too.
- **Fix:** Optional — add a 'This week' card to /portal/admin/servants/[id] instead of rebuilding a standalone page.

### `F0303` [DEGRADED] The sidebar no longer shows the servant's stage under their name (and has no 'Admin View' indicator)
- **Role:** servant · **Area:** servant-attendance
- **OG:** OG L4002 (stage pill markup) and L4053 (launchServant sets sv-sbh-pill to 'Admin View' or _me.stage)
- **Now:** components/portal/Shell.tsx crest, L108-140
- **Verified:** Confirmed the crest renders userName, roleLabel (ROLE_LABEL[user.role] from layout.tsx:27), and a static 'Sunday School' pill — no stage. stageOversight is only used in lib/portal/nav.ts:17-19 for a nav link. Also grepped the whole new portal for impersonat|Admin View|adminView — zero hits, so the impersonation concept itself doesn't exist yet, not just its indicator.
- **Fix:** When user.stageOversight is set, render STAGE_LABEL[stageOversight] in that pill instead of the static 'Sunday School' text.

### `F0631` [MISSING] QR Check-in: 'Meeting Title' free-text input is gone
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7195-7196 — labelled input#mt-title 'Meeting Title'
- **Now:** app/portal/(app)/qr/GroupCodePanel.tsx MEETING mode, L233-244
- **Verified:** Read GroupCodePanel.tsx in full: MEETING mode only has a servant-activity <select>. createMeetingCode's MeetingSchema (lib/portal/actions/qr.ts) also has no title param.
- **Fix:** Add an optional title field, or confirm the activity label is an acceptable substitute.

### `F0632` [MOVED] Activity picker dropdown (choose 1 of 7 activities) replaced by an all-activities matrix
- **Role:** servant · **Area:** servantattendanceall
- **OG:** OG L7847-7850 — sab-activity-select dropdown
- **Now:** app/portal/(app)/servant-attendance/ServantGrid.tsx, L95-135
- **Verified:** Confirmed the new grid shows every activity as its own table column simultaneously, with a legend row above — a strict superset of the dropdown view, not a loss.
- **Fix:** None needed; arguably improved.

### `F0394` [DEGRADED] Stat: Streak (consecutive weeks present) is gone — only an inverted absence-streak stat remains
- **Role:** servant · **Area:** studentProfile
- **OG:** OG L5083 (stat card), L5025 getConsecutivePresentStreak — labelled 'Streak / Consecutive present'
- **Now:** app/portal/(app)/students/[id]/page.tsx, L118-137 (StatCards: Points, Sunday attendance, Class rank, 'Missed in a row')
- **Verified:** Confirmed all 4 stat cards on the page; none is a present-streak. 'Missed in a row' is the absence streak and 'Class rank' is unrelated — neither substitutes for the OG's present-streak.
- **Fix:** Add a present-streak stat back alongside the existing absence-streak/rank stats.

### `F0397` [DEGRADED] 'Points History' table (Reason/Date/Servant/Type badge/Points columns, with per-row Undo/Delete) reduced to a plain read-only list
- **Role:** servant · **Area:** studentProfile
- **OG:** OG L5100-5136 — full <table> with Type badge column and per-row Undo (↺) / Delete (✕) buttons
- **Now:** app/portal/(app)/students/[id]/page.tsx, L143-159 'Points ledger' Card (plain <ul>)
- **Verified:** Confirmed no table, no Type badge, no Servant column header on the student-profile ledger. Important nuance the original finding missed: the Undo capability itself is NOT gone — it lives on app/portal/(app)/classes/[id]/points/PointsPanel.tsx (undoPoints action, canUndo-gated), just not reachable from this page. So the loss here is display fidelity + one page's worth of Undo access, not the Undo feature overall.
- **Fix:** Optionally restore the tabular layout with a Type badge, and/or surface the existing Undo action directly on the student profile so a lead doesn't have to go to the class Points page to undo one entry.

### `F0389` [DEGRADED] Profile subtitle dropped email — but the field already exists and is already loaded, just not rendered
- **Role:** servant · **Area:** studentProfile
- **OG:** OG L5070 ('{grade} · {email}')
- **Now:** app/portal/(app)/students/[id]/page.tsx ~101-106 (subtitle now 'Grade X · Boy/Girl · class name')
- **Verified:** The visible gap is real, but the finding's stated cause and fix are wrong: it claims 'email is absent because the field no longer exists on the Student model,' but Account.email exists in the schema (schema.prisma:199) and IS already selected in studentSelect (lib/portal/data/students.ts:22, account:{select:{...email:true...}}) — s.account.email is already in memory on this exact page, just not interpolated into the subtitle string. No schema change or migration needed. Severity lowered to low given the trivial fix and that the replacement info (grade/gender/class) is arguably more useful in a system that no longer uses email to sign students in.
- **Fix:** Add `· ${s.account.email}` (when present) to the existing subtitle string — no schema change required.

### `F0072` [MISSING] The Student Growth chart (and all dashboard charts) are gone from the servant dashboard
- **Role:** servant · **Area:** students
- **OG:** OG L4349-4364 (widget slot), L4427-4431 (studentGrowthTrend series from Student.createdAt), L4580 (renderDashboardCharts call)
- **Now:** nowhere — app/portal/(app)/page.tsx
- **Verified:** Grepped the entire new portal for canvas|Chart|sparkline|polyline: only hits were static BarChart3 lucide icons used as glyphs, not actual chart rendering. Dashboard imports only stat/list widgets (Notifications, CheckIn, Exams, Lessons, Feed) — confirms no chart of any kind exists anywhere in the new portal, not just this one.
- **Fix:** Add a small inline-SVG sparkline of cumulative students by month from Student.createdAt, with the OG's two-month minimum before showing it.

### `F0074` [MISSING] Swipe-to-reveal row actions on touch devices are gone
- **Role:** servant · **Area:** students
- **OG:** OG L2212-2251 initSwipeRows — 84px reveal drawer with 8px intent detection and .2s snap
- **Now:** nowhere — grepped whole new portal for swipe|touchstart|touchmove: zero hits
- **Verified:** Confirmed roster rows (classes/[id]/page.tsx, L114-131) are plain Links with no per-row action affordance at all, hidden or otherwise — the replacement actions live one navigation away on the student's profile/edit page.
- **Fix:** If per-row actions return, ship as long-press or an always-visible icon row rather than hover-only, since the primary device is a phone.

### `F0381` [MOVED] Header 'Add' button now navigates to a separate page instead of toggling an inline add-student form
- **Role:** servant · **Area:** students
- **OG:** OG toggleAddStudent (L6616) toggles inline #add-s-form (markup ~L4645-4655)
- **Now:** app/portal/(app)/classes/[id]/students/new/page.tsx via LinkButton at classes/[id]/page.tsx:84
- **Verified:** Confirmed the LinkButton routes to a distinct page rather than expanding a form in place.
- **Fix:** Acceptable UX change; no fix required unless the church prefers inline.

### `F0388` [MISSING] 'No students match your search' empty-search state is gone (there is no search box on the servant's class roster)
- **Role:** servant · **Area:** students
- **OG:** OG L4693 #st-empty, paired with #st-search/filterStudents
- **Now:** nowhere on the servant-facing classes/[id]/page.tsx roster
- **Verified:** Independently searched app/portal/(app)/students and .../classes for search|Search: only hits were an unrelated searchParams prop and the admin-only /portal/admin/students page (which does have a q search param, but that's an admin route, not the servant's own class roster).
- **Fix:** Implement together with restoring a search box on the class roster.

### `F0457` [MISSING] Manual follow-up case: no backdate field
- **Role:** servant · **Area:** visitation
- **OG:** OG L19910-19913 — input#mv-date
- **Now:** lib/portal/actions/followups.ts CreateSchema (L86-90) and NewCaseForm.tsx
- **Verified:** Confirmed CreateSchema is {studentId, title, details} only; createManualCase never sets createdAt (relies on Prisma's @default(now())); NewCaseForm.tsx has no date input.
- **Fix:** Add an optional backdate field.

### `F0458` [MISSING] Manual follow-up case: no Result select — can't open a case already resolved
- **Role:** servant · **Area:** visitation
- **OG:** OG L19923-19929 — Result <select> (Ongoing/No response yet/Resolved)
- **Now:** lib/portal/actions/followups.ts createManualCase / prisma/schema.prisma FollowUpCase.status
- **Verified:** Confirmed schema.prisma:415 defaults status to OPEN and createManualCase never writes status; NewCaseForm.tsx has no status control.
- **Fix:** Minor; resolvable as a quick second step (open then resolve) instead of at creation.

### `F0459` [MOVED] Next Follow-up Date is a required second step (case-detail 'Log a contact' form), not part of the creation form
- **Role:** servant · **Area:** visitation
- **OG:** OG L19931-19934 — #mv-next-wrap/#mv-next-date on the creation modal
- **Now:** app/portal/(app)/follow-ups/[id]/CaseActions.tsx, L81-83 'Next follow-up' field in the 'Log a contact' card, on the page the servant is routed to immediately after creating the case
- **Verified:** Labelling this 'MISSING' overstates it: NewCaseForm.tsx's onSubmit does router.push to the new case's detail page, where CaseActions.tsx immediately offers the same date field one click later. Nothing is lost, only deferred by a screen — this is a MOVED gap, not a MISSING one.
- **Fix:** None needed unless the church specifically wants same-screen entry at creation time.

### `F0462` [DEGRADED] Auto-close condition tightened: only closes at streak===0 instead of streak<threshold
- **Role:** servant · **Area:** visitation
- **OG:** OG L17188-17195 — if (live.streak < threshold) { status:'done' ... }
- **Now:** lib/portal/attendance-rules.ts, L52-59 decideFollowUp()
- **Verified:** Read decideFollowUp in full: if (hasOpenAutoCase) return streak===0 ? 'close' : 'none' — strictly narrower than the OG's '< threshold' condition (e.g. threshold 3, streak 2 would auto-close in the OG but not in the new portal).
- **Fix:** Change the close condition to streak < threshold to match the OG exactly.

### `F0463` [DEGRADED] Summary donut chart (Open vs Resolved) replaced by two StatCard tiles
- **Role:** servant · **Area:** visitation
- **OG:** OG L17209-17223 — 72px SVG donut, #DCFCE7 green track, #8B1C2E maroon arc
- **Now:** app/portal/(app)/follow-ups/page.tsx, L62-79
- **Verified:** Confirmed two StatCards (Open, Resolved) render the same counts with no chart. Purely cosmetic; all data present.
- **Fix:** None required unless the visual is specifically wanted back.

### `F0469` [MOVED] 'Log Follow-up' modal (two submit paths) restructured into two permanent cards on the case detail page
- **Role:** servant · **Area:** visitation
- **OG:** OG L17252, L17307-17336, L19847-19886 — one modal, Resolve-with-reason vs Save-and-continue
- **Now:** app/portal/(app)/follow-ups/[id]/CaseActions.tsx — 'Log a contact' card + separate 'Resolve' card
- **Verified:** Confirmed both actions (logContact, resolveCase) exist and are functionally equivalent to the OG's two modal buttons, just always-visible instead of modal.
- **Fix:** None required; restructuring only.

### `F0471` [MISSING] Swipe-to-delete gesture is gone — moot, because the delete-case action itself doesn't exist
- **Role:** servant · **Area:** visitation
- **OG:** OG L17240-17242 deleteVisitationCase bound to a swipe row; initSwipeRows L2212-2250
- **Now:** nowhere — lib/portal/actions/followups.ts exports only logContact, resolveCase, reopenCase, createManualCase
- **Verified:** Independently confirmed no delete action exists for a FollowUpCase anywhere in the new portal, so there is nothing to bind a swipe gesture to.
- **Fix:** Bundle with restoring a delete action for cases, if the church wants one.

### `F0472` [MOVED] Resolved-case history moved to a '?show=done' toggle instead of an inline second section
- **Role:** servant · **Area:** visitation
- **OG:** OG L17264 — inline 'History (Resolved)' section rendered below the open list
- **Now:** app/portal/(app)/follow-ups/page.tsx — LinkButton toggling ?show=done
- **Verified:** Confirmed the page branches its whole query/render on searchParams.show==='done'; only one list shows per page load, one click from the other.
- **Fix:** None required; cosmetic ordering difference only.

### `F0475` [MISSING] No scoped 'Failed to load follow-up data' error card — falls through to the generic route error boundary
- **Role:** servant · **Area:** visitation
- **OG:** OG L17301-17304 — catch block renders an in-page fallback message
- **Now:** app/portal/(app)/follow-ups/page.tsx (no try/catch) — falls back to app/portal/(app)/error.tsx
- **Verified:** Confirmed no try/catch around the Prisma calls in follow-ups/page.tsx, and confirmed app/portal/(app)/error.tsx exists as the generic boundary that would catch it instead.
- **Fix:** Wrap the data loads and render a scoped error card matching the OG's message.

### `F0440` [MISSING] Activity/session legend chips (one colored pill per session) missing from Reports
- **Role:** servant · **Area:** weeklyreport
- **OG:** OG ~L6272 — wrActMeta.map(...) colored pill row
- **Now:** nowhere — app/portal/(app)/reports/page.tsx and AttendanceMatrix.tsx have no legend/chip row
- **Verified:** Grepped both files for legend|chip|pill|Badge: only per-cell/per-row status badges exist, no session-legend row.
- **Fix:** Restore once/if a multi-session table view is restored; not needed for the current single-session view.

### `F0441` [DEGRADED] Tappable month-chips row (12 pills, Sep→Aug school year) replaced by a native month input
- **Role:** servant · **Area:** weeklyreport
- **OG:** OG L6261/6273 monthChips, setWeeklyReportMonth fn L6747
- **Now:** app/portal/(app)/reports/ReportFilters.tsx, L83-88 — <input type="month">
- **Verified:** Confirmed a single native month picker with no chips and no active-chip highlighting.
- **Fix:** Optional: restore tappable month chips for a more touch-friendly, at-a-glance school-year picker.

### `F0443` [MISSING] Week-of-month colspan super-header ('Week 1 (9/7–9/13)') missing from the attendance grid
- **Role:** servant · **Area:** weeklyreport
- **OG:** OG colspan 'Week N (...)' headers repeated at L8084/8990/9090/9142/9234
- **Now:** app/portal/(app)/reports/AttendanceMatrix.tsx, L45-70 (the route servants reach via the 'Reports'/'Attendance Report' nav item per lib/portal/nav.ts)
- **Verified:** Confirmed the new matrix renders one flat header row of individual day columns (matrix.dates.map(...)) with no grouping <tr> above it.
- **Fix:** Add week-of-month group headers once/if the multi-session grid is restored.

### `F0800` [MISSING] showPointsAnimation (confetti + sound on quiz/points award) ⚠️ *unverified*
- **Role:** student · **Area:** Student → Exams (after any quiz award); Servant → Points page (on every manual give/remove)
- **OG:** Full-screen confetti animation (18 dots, multiple colors) plus an ascending/descending audio chime and a tiered burgundy pill ('Excellent!'/'Good job!'/'Keep going!') after scoring or manual point changes.
- **Now:** nowhere
- **Fix:** See PARITY-AUDIT.md ~line 2219: add the confetti animation, tiered toast copy, and add/deduct sound effects at the equivalent new-portal call sites.

### `F0727` [DEGRADED] 5 level names/icons/thresholds were deliberately re-themed, not accidentally broken — cosmetic per this batch's own rule
- **Role:** student · **Area:** achievements
- **OG:** index.stripped.html L12231-12245 (Beginner/Rising Star/Scholar/Champion/Legend, 0/50/100/200/350)
- **Now:** lib/portal/achievements.ts LEVELS (L25-31): Seed/Candle/Lampstand/Crown/Shining Star, 0/50/150/400/800
- **Verified:** This is one part of a comprehensive, coherent re-theme of the entire level+badge system to church/scripture imagery (see F0729, F0731) — the leveling mechanic itself is fully present and works identically, only labels/thresholds changed.
- **Fix:** Restore OG names/thresholds only if literal parity is the actual goal; otherwise this is an intentional redesign needing a decision, not a code fix.

### `F0729` [DEGRADED] Badge "Quiz Pro" (3 quizzes) renamed/retuned to "Scholar" (5 quizzes) as part of the same wholesale redesign — cosmetic, not a functional loss
- **Role:** student · **Area:** achievements
- **OG:** index.stripped.html L12250
- **Now:** lib/portal/achievements.ts BADGES 'scholar' (L145-151): "Finish 5 quizzes"
- **Verified:** The reward-for-completing-quizzes mechanic persists under a new name/threshold; part of the same 11-badge re-theme as F0727/F0731, not an isolated accidental change.
- **Fix:** Restore the 3-quiz threshold only if literal parity is wanted.

### `F0731` [DEGRADED] No 20-point badge exists — confirmed factually, but framed better as a retuned ladder rung than a clean removal
- **Role:** student · **Area:** achievements
- **OG:** index.stripped.html L12252
- **Now:** lib/portal/achievements.ts BADGES point tiers are 10/100/500 (first-fruits/hundredfold/treasure) — confirmed no 20-point rung
- **Verified:** The point-badge ladder concept (low/mid/high tiers) is intact; only the specific values moved, as one piece of the same coherent redesign as F0727/F0729.
- **Fix:** Add a similar low-point badge back only if literal parity with the OG's specific numbers is wanted.

### `F0726` [MOVED] Sidebar item "Achievements" ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **OG:** Learning group
- **Now:** /portal/achievements, now under "My Progress" section
- **Fix:** cosmetic regroup only

### `F0730` [MOVED] Badge id perfect 💯 "Perfect Score" (100% on any quiz, +15pts) ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** BADGES[7] 'perfect-score' 🏅 "Perfect Score" — same condition, icon 💯→🏅
- **Fix:** cosmetic

### `F0741` [DEGRADED] Per-badge progress-bar colour coding (indigo=quiz, gold=points, green=attendance, red=Legend) ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **Now:** single amber tone="warn" bar for every locked badge
- **Fix:** restore per-category colour if desired

### `F0742` [MOVED] Earned/Locked/Pts-Total summary strip ⚠️ *unverified*
- **Role:** student · **Area:** achievements
- **OG:** 3 stat tiles
- **Now:** reformatted as section headings ('Earned badges (N)'/'Locked badges (N)') plus a 4-tile StatCard row (Points/Sunday streak/Reading streak/Quizzes)
- **Fix:** cosmetic

### `F0784` [DEGRADED] Notification dropdown closes on outside click ⚠️ *unverified*
- **Role:** student · **Area:** all 4 role shells (topbar bell)
- **OG:** toggleNotifDropdown(role) explicitly registers a document click-listener that closes the open .atb-notif-dd when the click target is outside it and not the bell itself.
- **Now:** components/portal/NotificationBell.tsx (bare <details>/<summary>)
- **Fix:** Add a small client-side close-on-outside-click handler (or use the Popover API) instead of relying on bare <details> semantics.

### `F0715` [DEGRADED] Stat: Present (raw count) ⚠️ *unverified*
- **Role:** student · **Area:** attendance
- **OG:** Headline number of sessions attended
- **Now:** StatCard 'Attendance rate' hint text L291-297
- **Fix:** cosmetic

### `F0716` [MISSING] Stat: Pts Earned (attendance points total) ⚠️ *unverified*
- **Role:** student · **Area:** attendance
- **OG:** Lifetime total points earned from attendance
- **Now:** n/a
- **Fix:** Optional: add a 4th StatCard summing attendance-sourced PointEntry rows

### `F0749` [MOVED] Sidebar item "Today's Reading" (Faith group) ⚠️ *unverified*
- **Role:** student · **Area:** biblereading
- **OG:** stLoad('biblereading')
- **Now:** /portal/readings, renamed "Daily Readings", now under "Learning" section — the OG's "Faith" section (Today's Reading + Hymns) no longer exists as a grouping
- **Fix:** cosmetic regroup, but note the section concept is gone

### `F0753` [DEGRADED] Success toast "Marked as read — keep it up!" on check-in ⚠️ *unverified*
- **Role:** student · **Area:** biblereading
- **OG:** showNotif()
- **Now:** no toast — page just router.refresh()es silently
- **Fix:** add a confirmation toast for parity

### `F0091` [DEGRADED] Next Exam countdown card degraded — the big day number and its three urgency colour tiers are gone ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Student dashboard, the NEXT EXAM card under the new-quiz banner
- **Now:** components/portal/widgets/ExamsWidget.tsx:66-80 — a one-line text pill inside the Quizzes card
- **Fix:** Promote the next-exam line in ExamsWidget to its own banded block with the OG's three colour tiers and the large day figure. daysUntilDue() in lib/portal/exams.ts already returns the number.

### `F0092` [DEGRADED] Student dashboard Announcements card cut from the latest three to one ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Student dashboard, the ANNOUNCEMENTS card at the bottom (latest 3 class announcements)
- **Now:** components/portal/widgets/FeedWidget.tsx:100-115 — a "Latest announcement" card showing exactly one
- **Fix:** Have latestAnnouncementFor return up to three and render them as a list in FeedWidget's student branch.

### `F0674` [MISSING] Hero photo banner (background photo behind hero text) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Full-bleed class/student photo background behind the welcome hero text
- **Now:** app/portal/(app)/page.tsx StudentHome HeroBanner
- **Fix:** Add optional photo/background prop to HeroBanner, or accept as deliberate flat redesign

### `F0678` [DEGRADED] Next Exam Countdown (big digit days-left box, color-graded urgency) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Large numeral countdown card, red/amber/green by urgency
- **Now:** components/portal/widgets/ExamsWidget.tsx L59-72
- **Fix:** optional visual upgrade; information is equivalent

### `F0680` [DEGRADED] Leaderboard top-3 rows w/ medal emoji + avatar circle ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Medal icons (🥇🥈🥉) and colored avatar circles per row
- **Now:** page.tsx L232-244
- **Fix:** Reuse Avatar/medal styling from leaderboard page on the dashboard card

### `F0684` [MOVED] Mini widget: Current Streak (weeks) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Standalone streak-weeks tile on the dashboard
- **Now:** /portal/my-attendance StatCard 'Sundays in a row'
- **Fix:** optional: add a small streak chip back to dashboard

### `F0685` [MISSING] Achievements teaser card (badge icon + 'N badges earned', click → Achievements) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Clickable teaser summarizing badge count on the dashboard
- **Now:** n/a
- **Fix:** Add a small teaser card, or accept sidebar link as sufficient

### `F0687` [MISSING] Animated stat counters (count-up on load) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Numbers animate upward from 0 on page load
- **Now:** components/portal/ui.tsx StatCard
- **Fix:** cosmetic

### `F0691` [DEGRADED] Sidebar crest: student's CLASS photo/icon + class name ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** sb-user block shows class photo/icon and class name via loadClassPhotoForSidebar
- **Now:** components/portal/Shell.tsx L113-139
- **Fix:** Optional: swap crest image for class photo when role===STUDENT

### `F0694` [DEGRADED] Mobile identity bar (tap → profile) ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Mobile bar showing avatar+name, clickable to open profile
- **Now:** components/portal/Shell.tsx L220-240
- **Fix:** low priority given My Profile page/nav is also missing

### `F0696` [MISSING] Dashboard skeleton loader while data loads ⚠️ *unverified*
- **Role:** student · **Area:** dashboard
- **OG:** Stat-box and row skeletons shown during data fetch
- **Now:** n/a
- **Fix:** optional loading.tsx for perceived performance

### `F0307` [MOVED] 'Birthdays This Week' strip moved off the Events page onto its own dedicated, prominent nav page
- **Role:** student · **Area:** events
- **OG:** index.stripped.html L3456/3460 (admin), L5567/5570 (servant), L12665/12669 (student), L15629/15634 (pastor); renderer L14879-14964
- **Now:** app/portal/(app)/birthdays/page.tsx — a top-level 'Birthdays' nav item for every one of the four roles in lib/portal/nav.ts
- **Verified:** Confirmed the Events page has zero birthday content, and confirmed 'Birthdays' is its own labeled sidebar item for ADMIN, PASTOR, SERVANT and STUDENT alike — arguably more discoverable than a strip buried at the top of Events was. The finding already correctly used MOVED rather than MISSING; the batch's blanket 'high' overstates an IA reorganization where the content is fully preserved and independently well-signposted.
- **Fix:** Optional polish only: if desired, also surface a compact birthday strip at the top of Events for parity with the OG's layout, reusing the existing birthdays data/component — not required for the information to be found.

### `F0315` [DEGRADED] The event card lost the poster's photo and, in the all-classes view, the poster's class name ⚠️ *unverified*
- **Role:** student · **Area:** events
- **OG:** Top row of every event card, above the title: the poster's real avatar photo (or coloured initials as fallback), then "{name} · {class}"
- **Now:** /portal/events — initials only, name only (app/portal/(app)/events/page.tsx:88-97)
- **Fix:** Add `photo: true` to EVENT_SELECT's createdBy, carry it through EventView, and swap page.tsx:90-96 for `<Avatar name={event.createdByName} photo={event.createdByPhoto} size="sm" />`. For admins and pastors, also append the target class name after the poster's name as the OG did.

### `F0035` [DEGRADED] Student praise thresholds changed from the OG's 90/70 to 90/60 ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Student quiz result and completed cards: ≥90% "Excellent 🏆", ≥70% "Good job ⭐", below "Keep studying 📖"; ≥70 also drives every green/red result colour
- **Now:** /portal/quizzes, /portal/quizzes/[id]/review, /portal/exams/[id] — a single scoreBand with cut-offs at 90 and 60
- **Fix:** Confirm the intended threshold with the church. If 70 is still the pass mark, change scoreBand's second cut-off to 70 and keep reports.ts in step; either way surface the 70% pass line explicitly somewhere (see the Pass Rate finding).

### `F0036` [DEGRADED] Quiz submit is no longer gated on answering every question ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Student quiz card footer: the "Submit ✓" button starts disabled at opacity .4 with cursor not-allowed and only unlocks once answeredCount ≥ totalQs; submitQuiz re-checks and refuses with "Please answer all N questions first"
- **Now:** /portal/quizzes/[id] — "Hand in" is always enabled; unanswered questions produce a warning line and a confirm step, then submit for zero
- **Fix:** Either disable Hand in until `unanswered === 0`, matching the OG, or make the confirm step name the count explicitly ("Hand in with 3 questions unanswered? They will score 0 and you cannot change them.") so an accidental early submit is a deliberate act.

### `F0039` [MOVED] The student quiz list is no longer called "Daily Quiz" anywhere ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Student sidebar item labelled "Daily Quiz" (page title "My Quizzes", mobile tab "Exams") — "Daily Quiz" is the label admins and students were taught
- **Now:** /portal/quizzes — sidebar says "Quizzes", page header says "My Quizzes"; the string "Daily Quiz" appears nowhere in the portal
- **Fix:** Rename the student nav item to "Daily Quiz" in lib/portal/nav.ts:99 (the page header "My Quizzes" already matches the OG), so the label the church taught still finds the page.

### `F0697` [MOVED] Available-now accordion card (expand inline to take quiz) ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Click header to expand quiz questions inline on the same list page
- **Now:** page.tsx AvailableCard L147-182 + /portal/quizzes/[id] route
- **Fix:** different but equivalent interaction, not a functional loss

### `F0698` [DEGRADED] Bible reading collapsible panel inside available card ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Expand/collapse panel showing reading text plus a separate 'reading message'
- **Now:** list: page.tsx L165-169 (truncated 1-line); take page: [id]/page.tsx L69-82 (full text+message)
- **Fix:** minor, important content available at question time

### `F0700` [MOVED] Instant grading with inline correct/incorrect reveal on same card ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Correct/incorrect highlighting shown immediately in place after submit
- **Now:** redirects to /portal/quizzes/[id]/review, QuizTaker.tsx L56
- **Fix:** cosmetic

### `F0701` [MISSING] Confetti + floating '+N pts' toast animation on submit ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Confetti dots and a floating points toast play on quiz submission
- **Now:** n/a
- **Fix:** nice-to-have, not core functionality

### `F0702` [MISSING] 'Quiz submitted!' success toast ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Toast notification confirming submission and score
- **Now:** n/a
- **Fix:** add a toast/flash message on the review page if desired

### `F0703` [MISSING] 'Show more (N)'/'Show less' pagination for groups >4 cards ⚠️ *unverified*
- **Role:** student · **Area:** exams
- **OG:** Collapsible pagination when a status group exceeds 4 cards
- **Now:** page.tsx uses a plain responsive grid, no cap
- **Fix:** none needed unless a class has dozens of quizzes

### `F0282` [BROKEN] Pinning a post falsely stamps it "· edited" ⚠️ *unverified*
- **Role:** student · **Area:** feed-posts
- **OG:** OG had no edited marker at all; pinning changed only the `pinned` field
- **Now:** /portal/feed → every post card's byline line
- **Fix:** Track edits explicitly: add an `editedAt DateTime?` column set only by `updatePost`, and compute `edited: !!post.editedAt`. Failing that, have `togglePin` write through `prisma.$executeRaw` or carry a `lastEditedAt` field that pin does not touch.

### `F0286` [DEGRADED] The three reactions lost their individual active colours ⚠️ *unverified*
- **Role:** student · **Area:** feed-posts
- **OG:** Post footer — heart went red (#E24B4A on #FFF0F0), pray went gold (#C89B3C on #FEF3E0), like went green (#1D9E75 on #EDFAF5) when you had reacted
- **Now:** /portal/feed → all three buttons share one gold active style
- **Fix:** Move the three colour triples into the `REACTIONS` constant in lib/portal/data/feed.ts and key the active class off `r.kind` in PostCard.tsx:144-151.

### `F0236` [MOVED] Student Hymns moved out of the "Faith" group into "Learning" ⚠️ *unverified*
- **Role:** student · **Area:** hymns
- **OG:** Student sidebar > Faith > Hymns (sitting directly under "Today's Reading"); the page header read "Hymns / Words to hymns and tasbeha for your class"
- **Now:** Student sidebar > Learning > Hymns (sitting under Quizzes and Daily Readings); header reads "Hymns / The church-wide hymn book." There is no "Faith" section anywhere in the new sidebar.
- **Fix:** Split the student nav at lib/portal/nav.ts:97-101 back into `Learning` (Quizzes) and `Faith` (Daily Readings, Hymns), and restore "tasbeha" to the student subtitle at app/portal/(app)/hymns/page.tsx:31 (e.g. "Words to hymns and tasbeha, shared across the whole church.").

### `F0237` [DEGRADED] Lyrics are no longer required when adding a hymn ⚠️ *unverified*
- **Role:** student · **Area:** hymns
- **OG:** Hymns page > Add Hymn — both TITLE and LYRICS were mandatory, red toast "Please enter a title and lyrics" otherwise
- **Now:** /portal/hymns > Add a hymn — only the title is validated; a hymn saves with empty lyrics and its row then reads "No lyrics have been added yet."
- **Fix:** Add a lyrics check beside the title check at app/portal/(app)/hymns/HymnManager.tsx:56 — `if (!draft.lyrics.trim()) return setMessage({ kind: 'err', text: 'Please enter a title and lyrics.' })` — for new hymns at least, matching the OG wording. Leave the field optional on the server so existing rows are not blocked from being edited.

### `F0743` [MOVED] Sidebar item "My QR Code" (Class group) ⚠️ *unverified*
- **Role:** student · **Area:** myqr
- **OG:** stLoad('myqr')
- **Now:** /portal/my-qr, now under "My Progress" section
- **Fix:** cosmetic regroup

### `F0744` [DEGRADED] "Print My Code" pill button and print flow ⚠️ *unverified*
- **Role:** student · **Area:** myqr
- **OG:** Opens an in-app bottom-sheet overlay with its own Print button, dismissible without printing, auto-closes on afterprint
- **Now:** PrintButton.tsx calls window.print() directly on the whole page, scoped by .portal-print-page CSS
- **Fix:** acceptable alternate implementation; same end result

### `F0154` [DEGRADED] Sidebar crest always shows the church logo, never the class photo or the person's own photo
- **Role:** student · **Area:** nav-ia
- **OG:** index.stripped.html L3996-4002 (servant class tile), L11583-11588 (student class icon), L2700-2704 (admin own photo), L19119-19121 (pastor own photo)
- **Now:** components/portal/Shell.tsx:108-131 — crest is unconditionally /images/Logo.png + userName + roleLabel
- **Verified:** Confirmed by reading the crest block in full: it never varies by role or class. Confirmed PortalUser (permissions.ts:8-18) has no photo or class-name field to render even if the crest logic were changed, so the fix is correctly scoped as a data-plumbing change, not just a template edit. This is a personalization/branding difference with no functional consequence — nothing is hidden or blocked, closer to the calibration's cosmetic bucket than to a real regression.
- **Fix:** Extend PortalUser with photo/primaryClassName and render class photo+name for SERVANT/STUDENT, own photo+name for ADMIN/PASTOR, falling back to the logo.

### `F0164` [MOVED] Student sidebar groups renamed and items redistributed (Overview / Learning / Faith / Class → Learning / My Progress / Community) ⚠️ *unverified*
- **Role:** student · **Area:** nav-ia
- **OG:** Student sidebar: [Overview] Dashboard, My Profile · [Learning] Daily Quiz(+badge), Grades & Points, Achievements · [Faith] Today's Reading, Hymns · [Class] Attendance, My QR Code, Events, Posts
- **Now:** lib/portal/nav.ts STUDENT: (ungrouped) My Page · [Learning] Quizzes, Daily Readings, Hymns · [My Progress] Achievements, Leaderboard, My Attendance, My QR Code · [Community] Class Posts, Events, Birthdays · [Account] My PIN
- **Fix:** Restore the four OG group names and item order in the STUDENT branch of lib/portal/nav.ts, and restore the labels "Daily Quiz", "Today's Reading" and "Dashboard". Cheap, one file.

### `F0189` [MISSING] The points celebration is gone — no confetti, no flying "+N pts" toast with tiered praise, no add/deduct chimes ⚠️ *unverified*
- **Role:** student · **Area:** points
- **OG:** Fires over the whole screen after any quiz award (Student → Exams) and on every manual give/remove (Points page)
- **Now:** nowhere. app/portal/(app)/quizzes/[id]/QuizTaker.tsx and PointsPanel.tsx show plain text messages only.
- **Fix:** Add a small client-side celebration helper (a CSS-keyframe confetti burst plus the two-line toast with the ≥90/≥70/else tiering) called after a successful quiz submit and after givePoints, and a tiny WebAudio helper reproducing the ascending add chime and the descending deduct tone, respecting prefers-reduced-motion.

### `F0745` [MOVED] Sidebar item "Posts" (Class group) ⚠️ *unverified*
- **Role:** student · **Area:** posts
- **OG:** stLoad('posts')
- **Now:** /portal/feed, renamed "Class Posts", now under "Community" section
- **Fix:** cosmetic

### `F0748` [MISSING] YouTube links in posts render as a generic 'Open link' pill instead of a thumbnail with play-button overlay
- **Role:** student · **Area:** posts
- **OG:** L13605-13625 (cited L13611-13621 verified): ytMatch regex on p.link renders img.youtube.com/vi/<id>/hqdefault.jpg with a red play-button overlay and '▶ YouTube' badge
- **Now:** nowhere — PostCard.tsx renders every link (YouTube or not) as the same ExternalLink pill; independent grep for hqdefault|img.youtube|ytMatch|youtu\. across app/lib/components returns zero hits
- **Verified:** OG behavior confirmed exactly as cited by reading PostCard.tsx in full. The link still works — clicking 'Open link' opens the YouTube video fine in a new tab; only the visual thumbnail treatment is gone. Per this batch's explicit calibration rule, cosmetic polish is low regardless of what the OG did, and this is purely visual (no functionality or data lost).
- **Fix:** Optional polish only: in PostCard.tsx, regex-match post.link for a YouTube video id and render an <img> thumbnail (img.youtube.com/vi/<id>/hqdefault.jpg) with a play-button overlay in place of the generic pill when matched.

### `F0329` [DEGRADED] The student's reading calendar changed from the current month to a rolling 30 days, losing the month label and the future-day shading ⚠️ *unverified*
- **Role:** student · **Area:** readings
- **OG:** Student → Today's Reading page, bottom of the second card: a 10-column grid running day 1 to the last day of the CURRENT month, headed by the month in uppercase, e.g. "SEPTEMBER 2026"
- **Now:** /portal/readings → the "My Bible reading" card, a 10-column grid of the last 30 days ending today, headed "Last 30 days" with an N/30 counter
- **Fix:** Change readingStateFor's grid to cover day 1 to the last day of the current month in America/New_York, mark entries past today as `future`, and in ReadingCheckIn.tsx label the block with the month and year and give future cells the OG's paler treatment (near-white background, very light text) so they read as "not yet" rather than "missed".

### `F0331` [DEGRADED] The "Marked as read — keep it up!" confirmation is gone; checking in now just silently refreshes the page ⚠️ *unverified*
- **Role:** student · **Area:** readings
- **OG:** Student → Today's Reading → tapping "✓ I read today" showed a success toast reading "Marked as read — keep it up!", and on failure a toast "Error: <message>" with the button restored to "✓ I read today"
- **Now:** /portal/readings → the button swaps to the green "Done for today" pill after a router.refresh(); there is no confirmation message, and the pastoral encouragement is gone
- **Fix:** Use the streak the action already returns: on success set a transient message such as "Marked as read — keep it up!" (and, when result.data.streak > 1, the streak count) above the button before the refresh lands. Purely client-side; no server change needed.
