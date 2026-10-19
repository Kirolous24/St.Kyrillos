# Family messages + the kids' weekly attendance report (2026-10-19)

Two requests, in the servants' words:

1. **A 5th & 6th Boys coordinator:** the follow-up message sent to parents is
   the same for every meeting. For Friday Bible Study he wants to say which
   chapters they read, and make it sound different from Sunday's. Editing it
   inside each child's composer means copy-pasting it once per child, "so
   there's no difference really than if I were to have just texted their moms
   independently without the website".
2. **The Middle School overseer:** "have this report for the kids too,
   not just the servants": the Servant attendance weekly report, for students.

## 1. Message families

**What a servant does:** take the register (or open any past one), tap
*Message families*. They see who missed it, write one message, and tap down
the list. Each child's button opens WhatsApp or Messages with that child's
own message already written. No copy-paste.

- **Saved message per class per meeting** (`MeetingMessage`, keyed by
  `classId + sessionKey`). It is what the page starts from and what the case
  composer starts from. Any servant who may follow the class up
  (`followup.write`) can change it or go back to the standard text. The page
  says who last changed it.
- **Placeholders:** `{name}` becomes the child's first name. `{meeting}`,
  `{day}` and `{date}` become the meeting, its weekday and its date. The
  standard text reuses the church's existing words, addressed to the family.
- **One-off edits** (today's chapters) apply to every child on the page. They
  stay in that phone's browser until saved or reset, so the text survives
  switching to WhatsApp and back.
- **Who missed it:** children on that register's roster who were not marked
  present or excused. A child the register never marked counts too, which
  covers QR-only registers, but only when they joined on or before that day.
  A child under a follow-up excuse is still listed, last, with the reason.
- **Channels:** WhatsApp (wa.me, with the US 1) and Text (`sms:` with the body,
  in the form iPhone and Android both read). Mother's number first ("texted
  their moms"), then a shared Parents number, Father, then the child's own.
  Any number can be picked.
- **Every send is recorded** as a contact note (`FollowUpLog`, method
  `whatsapp`/`text`, note `To Mother: …`). The note sits on the child's open
  case in that class if there is one. It records whose group the child was
  in, and the meeting it was about (new `missedSessionKey` + `missedOn`). So
  the page shows "Sent" per child, two servants don't message the same
  family twice, and the Follow-up log shows who messaged whom.
- The portal still **sends nothing itself**. A one-click send to every family
  would need a paid SMS service and US carrier registration, and parents would
  get texts from a number they don't know. One tap per family, from the
  servant's own phone, keeps it personal.

**Entry points:** the register page (a "Message the families" card once a
register exists), the class page, and the Follow-ups page when it shows one
class.

**Case composer (`CaseQuickActions`):**
- starts from the class's saved Sunday School message (or the class's own
  meeting for a class like Pre-Servants), filled in for the child;
- gains a **Text** channel;
- WhatsApp now goes through `waLink` (adds the missing US 1);
- each send is recorded like the page's.

## 2. Weekly attendance report for students

`/portal/reports/weekly`, a new **Weekly report** tab beside Attendance,
Church reports and Report cards. It has the servant report's shape:

- the same range chips (Last 4/8/13/26 weeks) and school-year month chips;
- a class picker. Default is the viewer's own class; *All classes* is offered
  when there are several;
- Overall rate · Students · Weeks;
- **By meeting** bars with the weekday, plus a bar chart when there are ≥2
  meetings;
- **By class** table when several classes are shown;
- **Week by week** matrix (✓ E ✗ —) for one class;
- **By student** table with per-meeting attended/held and the rate badge,
  grouped by class under All classes;
- Print button.

**Counting rule:** the church's (ANALYSIS §5), as everywhere:

- A meeting is *held* in a week when the class has any row for it that week.
- An excused mark leaves the occasion out; anything else counts against the
  child.
- Like the follow-up rule, weeks before a child joined the class (the earlier
  of when they were added and their first register mark) are left out, so a
  new child isn't marked down for weeks they weren't there.
- A Pre-Servants member counts only at that class's own meeting, as on its
  register.
- Meetings with no register in the range are named in a footnote and left out
  of the columns.

The servant report's week grid becomes a shared `WeekMatrix` component. The
servant report's markup is unchanged.

## Not done (say so)

- No automatic sending, as above.
- Follow-up excuses don't change attendance rates (no attendance report does);
  they only stop follow-up.
- Templates are per class, not per servant.

## Schema

Migration `20261019180000_family_messages`, additive:

- `MeetingMessage(classId, sessionKey, body, updatedById, updatedAt)`, with PK
  `(classId, sessionKey)`;
- `FollowUpLog.missedSessionKey String?` and `FollowUpLog.missedOn Date?`.
