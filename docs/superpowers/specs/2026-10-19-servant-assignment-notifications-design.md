# Servant assignment notifications — design (2026-10-19)

## Intent

Servants are handed parts of the Sunday class in the portal:

- the Schedule's ten activities (Agpeya, Song, Seasons, Lesson, Bible Study,
  Coptic, Ritual, Verse, Memorization, Saint of the Week);
- Lead and Backup for the week;
- dated lessons.

Today a servant only learns of an assignment by opening the portal or being
told. The church wants two things:

1. **The moment a servant is assigned**, a notification saying what and for
   which Sunday. Tapping it opens the page.
2. **A reminder the day before it is due.**

The user asked what a web app can do, agreed to the bell + phone + email
recommendation, and said: **"focus on sunday"**.

## Goals

- An instant notice on being assigned, and on being taken off.
- An evening-before reminder.
- A tap goes to the page.
- It works on the phones servants already carry.

## Non-goals

- Friday Bible Study / Saturday hymns duties. The portal has nowhere to
  assign them yet; the user said Sunday only.
- Notifications for students or parents.
- Text messages: per-text cost, weeks of US carrier registration, and an
  unknown sender number.
- A native app.

## Anti-goals (would make it a failure even if it works)

- **A flood.** A coordinator filling a month of the Schedule must not buzz a
  servant's phone forty times.
- **Telling a servant about an assignment they just gave themselves.**
- **A reminder for something they were taken off.**
- **The same reminder twice**, from a retried or overlapping job.
- **Secrets in the repo.** It is public.

## Channels (agreed)

1. **The bell** in the portal, for everyone, always. Stored notices sit beside
   the existing computed ones and show as unread until opened.
2. **Phone notifications** (Web Push), opted into per device in Settings.
   - Android and computers: tap Allow once.
   - iPhone: only from the Home Screen app (iOS 16.4+). Settings shows the
     steps (Share → Add to Home Screen → open it from there → Turn on).
   - Tapping a notification opens its link.
   - A device the push service reports gone (404/410) is forgotten.
3. **Email**, through Resend from `noreply@stkyrillostn.org`, as the login
   emails already do.
   - Sent to a servant with an email on file **while none of their devices
     has phone notifications on**, so nobody gets both on one phone.
   - A servant can turn email off in Settings.

## What counts as an assignment (Sunday only)

| Source | Notice reads | Due |
|---|---|---|
| `AgendaItem.servantId` | "Coptic for Sunday, Oct 26 · 5th & 6th Boys" (+ topic if set) | Sunday of that week |
| `AgendaWeek.leadServantId` / `backupServantId` | "Lead (or Backup) for Sunday, Oct 26 · 5th & 6th Boys" | Sunday of that week |
| `Lesson.assignedToId` | "Lesson “The Good Shepherd” for Sunday, Oct 26" | the lesson's date |

- **Undated lessons** get the assigned notice but no reminder.
- **Something due before today** (backfilling history) sends nothing.

## When

### Assigned / taken off

Right after the save that changed it, one notice per servant per save.

- **How changes are found:** compare who was on what before and after the
  write, for the weeks and lessons that save touched. This covers every
  write path:
  - saving a week;
  - the week tools (copy and shift);
  - importing a schedule;
  - a linked class's plan;
  - creating, editing and copying lessons.
- **One save, one notice per servant.** A save that gives a servant several
  parts sends a single notice: "You're on Coptic and Memorization for
  Sunday, Oct 26". If they span several Sundays: "You have 5 new
  assignments, Oct 26 – Nov 23".
- **Taken off:** "Coptic for Sunday, Oct 26 has been given to someone else".
- **Changed by the servant themselves:** no notice to that servant.
- **Topic change only** (same servant): no notice. The reminder carries the
  latest topic.
- **Inactive servant accounts:** never notified.

### Reminder

A daily job at **6 PM church time**. It is scheduled for 23:00 UTC, which is
6 PM in summer and 5 PM in winter. Hobby runs once a day, within the hour.

- **Who gets one:** every servant with anything due tomorrow.
- **What it says:** one notice listing everything for tomorrow, e.g.
  "Tomorrow: Coptic (Lesson 4 letters) and Memorization · 5th & 6th Boys".
- **Read at send time,** so reassignments since are respected.
- **No repeats:** at most once per servant per day.
- **Housekeeping:** the job prunes notices older than 60 days.

## Where a tap goes

`/portal/assignments` (My Assignments), anchored to that Sunday's week. A
lesson notice opens the lesson.

## Settings → Notifications (servants)

- **Phone notifications on this device:** the current status and a Turn on /
  Turn off button. On an iPhone that is not running the Home Screen app, the
  steps to install it instead.
- **Email:** "Email me when phone notifications are off". On by default.
- **Send me a test notification.**
- A short line on My Assignments points servants who have neither phone
  notifications nor an email to Settings.

## Data (one additive migration)

- `PushSubscription`:
  - `id`, `accountId` → Account (cascade);
  - `endpoint` (unique), `p256dh`, `auth`;
  - `userAgent?`, `createdAt`, `lastSentAt?`.
- `Notice`:
  - `id`, `accountId` → Account (cascade);
  - `kind`: `assigned` | `unassigned` | `reminder`;
  - `title`, `body`, `href`;
  - `dedupeKey` (unique), `createdAt`, `readAt?`.
- `Account.noticeEmails Boolean @default(true)`.

## Secrets and setup (the user adds these on Vercel before deploying)

- **`WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY`** (VAPID).
  - Generated locally; never committed.
  - Without them the phone toggle is hidden; bell and email still work.
- **`CRON_SECRET`** already exists. The new job checks it like the others.

## Constraints

- Hobby cron: daily, ±59 min ([Vercel limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)).
- Resend's free tier is 100/day and 3,000/month. 75 servants with a notice
  plus a reminder a week each is well inside it.
- Church time comes from `CHURCH_TIMEZONE`. Never hard-code a zone.
- **The public website is untouched.**
  - The web-app manifest and the notification service worker are served for
    `/portal` only.
  - The worker's scope is `/portal/`.
- Writes come from server actions, so delivery runs in the Node runtime.
  `web-push` needs Node.

## Left to the builder

- Wording.
- Icons, made from the church logo (192, 512, and a 180 Apple touch icon).
- The Settings card's layout.
- How the bell shows stored notices beside computed ones.
- Retry and timeout details for push sends.

## Calls I made (the user hasn't decided these)

- Email only while phone notifications are off.
- Taken-off notices.
- No notice for self-assignment.
- 6 PM reminder.
- One notice per servant per save.
- Undated lessons: notify, no reminder.
- 60-day retention.
