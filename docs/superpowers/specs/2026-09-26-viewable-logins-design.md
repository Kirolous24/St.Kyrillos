# Viewable logins: see, export and send every ID + PIN

**Status:** design, awaiting review · **Date:** 2026-09-26 · **Decision:** option B

## Goal

An admin can see any servant's or child's ID and PIN at any time, export them
all, and send each servant their own login by email, text or WhatsApp, without
resetting anyone who already knows theirs.

## Decisions already made

- Sign-in is unchanged: it still checks the bcrypt hash.
- Alongside the hash, the portal keeps an **encrypted copy of every PIN it
  issues**: on create, on reset, on a class reset and on import.
- **A PIN someone sets themselves is never kept.** Changing your own PIN deletes
  the encrypted copy. People reuse their bank and phone PINs, and those must not
  sit where an admin can read them.
- Only the **ADMIN** role can reveal, export, send or recover PINs. That excludes
  the pastor, coordinators and servants. Every one of those actions is written to
  the activity log.

## How it works

### Storage

- A new nullable column: `Account.pinSealed String?`. The migration only adds
  the column and backfills nothing.
- `lib/portal/pin-vault.ts` does two things:
  - `sealPin(pin, loginId)` encrypts with **AES-256-GCM**. It uses a random 12-byte
    IV and the **login ID** as associated data, and produces
    `v1.<iv>.<tag>.<ciphertext>`.
  - `openPin(sealed, loginId)` returns the PIN, or `null` when the value can't be
    read.
- The associated data ties each copy to its own ID, so a value pasted onto
  another row won't decrypt.
- **Why the login ID and not the account id:** every create path knows the
  login ID before the row exists, and the portal never changes a login ID.
- The key is `PORTAL_PIN_KEY`: 32 random bytes, base64, kept only in Vercel env
  vars. Production and Preview/local get **different keys**.
- **If the key is missing, the feature switches off cleanly.** Resets keep
  working, nothing is sealed, and admin screens say that PIN viewing is off.

### One way to set a PIN

Every issued PIN goes through a single helper that returns both the hash and the
sealed copy. These paths all use it:

| Path | File |
|---|---|
| create servant, reset servant PIN, reset class PINs | `lib/portal/actions/admin.ts` |
| create student, reset student PIN | `lib/portal/actions/students.ts` |
| CSV import, both students and servants | `lib/portal/actions/data-tools.ts` |
| Firebase import script | `scripts/import-firebase.ts` |
| the new bulk issue on *Send logins* | new |

A servant resetting a child's PIN still issues it, so that PIN is sealed too.
Only an admin can read it back.

`changeOwnPin` (`lib/portal/actions/account.ts`) sets `pinSealed = null`.

A unit test fails if any file writes `pinHash` other than through the helper,
so a future path can't quietly skip the sealing.

### Recovering today's PINs without resetting anyone

Almost every current PIN came from the Sept 18 export, and on Sept 20 all 347
matched. So:

1. Locally, I make a slim `id,pin` CSV from that export. It goes to Downloads with
   `chmod 600` and contains nothing else.
2. Under **Admin → Data → Recover PINs**, the admin uploads it.
3. For each row, the server seals the PIN **only if it still matches the stored
   hash** (`bcrypt.compare`) and the account has no sealed copy yet. The tool can
   never change a PIN or store a wrong one.
4. It reports how many matched, how many changed since, and how many IDs it
   didn't know. The file itself is not stored.
5. It runs in batches so each request stays within Vercel's time limit.

Afterwards, everyone who hasn't changed their PIN since the import shows up on
file, and nobody's PIN has changed. Two groups stay "not on file" until they're
reissued: accounts created in the portal after the import, and anyone whose PIN
changed since.

### Admin screens

- **Servant page** (Admin → Servants → a servant) gets a sign-in card:
  - The ID, and the PIN hidden behind **Show**. Each reveal is logged.
  - **Copy**, **Email**, **Text** and **WhatsApp** buttons. This wires up the share
    helper that was already written in `components/portal/ServantForm.tsx` but
    never rendered.
  - **Reissue PIN**.
- **Student profile:** the same card. **Show** appears only for an admin.
  Servants keep today's Reset + Copy.
- **Class logins** (`/portal/classes/[id]/credentials`) prints the class's
  current PINs without resetting anyone. Reissue stays available for any child
  whose PIN isn't on file.
- **Admin → Data → Export** gets two new files:
  - *Servants: IDs & PINs* (Name, Role, ID, PIN, Note)
  - *Students: IDs & PINs* (Class, Name, ID, PIN, Note)

  The Note reads "Not on file — reissue to see it" when there's no sealed copy.
  The page warns that the students file holds every child's login.

### Send logins (Admin → Servants → Send logins)

1. **Who:** the default is active servants who have **never signed in**. You can
   also pick everyone, or choose individuals. The page shows who has an email, a
   phone, or neither.
2. **Anyone picked whose PIN isn't on file gets a new one.** They're listed by
   name, and it needs a typed confirmation.
3. **Send:**
   - **Email N servants now** sends each person only their own login, through
     Resend from `noreply@stkyrillostn.org`.
   - Each row has **Text** (`sms:`) and **WhatsApp** (`wa.me`) buttons. They open
     on the admin's phone with the message already typed.
   - There's a **Print slips** option for the people with neither.
4. Each row shows what happened: emailed, failed, or "print a slip".

## Safety

- Admin-only on the server, via `requireAdmin` in every new action, and not just
  hidden in the UI. The new pages sit under `/portal/admin`, which the edge
  already restricts to ADMIN.
- Every reveal, export, send and recovery goes into the activity log with the
  count.
- `pinSealed` is never selected outside the vault and these admin paths. The
  JSON backup keeps excluding PIN fields, and a test pins that.

## Not included

- Coordinators or servants viewing PINs.
- Parent accounts.
- Sending children's logins to parents. 266 of 270 have a parent phone, so this
  is a natural next step.
- 6-digit PINs and the per-IP limiter. Both are still parked by the church.
- Automated SMS: it needs carrier registration.

## Testing

- **Unit:**
  - vault round-trip; wrong account id fails; wrong key fails; switched off
    without a key
  - every issuing action writes a sealed copy
  - `changeOwnPin` wipes it
  - recovery seals only on a hash match and never touches `pinHash`
  - export columns and formula-safe CSV
  - admin-only guards
  - the `pinHash` write guard
- **Smoke:** the new routes return 200 for an admin and 404 for a servant.
- **Write-smoke on dev:** issue, show and check they match. Recover from a small
  CSV. Send one email to a test address.

## Rollout

1. Generate `PORTAL_PIN_KEY`. Add it to Vercel **Production**, and a different
   key to Preview and to local `.env.local`.
2. Push. The migration is additive and deploys itself.
3. The admin runs **Recover PINs** with the CSV, then deletes it.
4. The admin opens **Send logins**.

**Rollback:** sign-in never reads `pinSealed`, so reverting the code leaves a
harmless unused column.
