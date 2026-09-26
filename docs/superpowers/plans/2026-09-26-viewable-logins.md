# Viewable Logins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin can see, export and send every servant's and child's ID + PIN, without resetting anyone who already knows theirs.

**Architecture:**
- Sign-in keeps using the bcrypt hash.
- Every PIN the portal *issues* also gets an AES-256-GCM sealed copy in the new `Account.pinSealed`. The ciphertext is bound to its login ID, and the key lives only in the `PORTAL_PIN_KEY` env var.
- All PIN writes go through one helper module, and a source-scanning test enforces that.
- Admin-only server actions in one new module handle reveal, export, recovery, reissue and email. Every one of them writes to the audit log.

**Tech Stack:** Next.js 14 App Router server actions, Prisma 5 / Neon Postgres, `node:crypto`, bcryptjs, Resend (batch send), vitest, playwright-core for E2E.

**Spec:** `docs/superpowers/specs/2026-09-26-viewable-logins-design.md`

## Global Constraints

- **Access:**
  - Only role **ADMIN** can reveal, export, recover, reissue in bulk, or email logins. Each check is `requireAdmin()` inside the action, not just in the UI.
  - Every reveal, export, recovery, reissue and email goes through `audit()`.
- **Which PINs are kept:**
  - A PIN set on **My PIN** (`changeOwnPin`) keeps **no** sealed copy: `pinSealed = null`.
  - `pinHash` may be written **only** in `lib/portal/pin-issue.ts`.
  - `pinSealed` may be mentioned **only** in `lib/portal/pin-vault.ts`, `lib/portal/pin-issue.ts`, `lib/portal/actions/logins.ts` and `lib/portal/data/logins.ts`.
- **The key:** `PORTAL_PIN_KEY` is 32 bytes, base64. **If it's missing, the vault is off:** nothing is sealed, nothing opens, and resets still work.
- **Email safety:**
  - Only `VERCEL_ENV === 'production'` sends to real addresses.
  - Anywhere else, every message goes to `PORTAL_EMAIL_REDIRECT`. If that isn't set, nothing is sent.
- **Portal UI conventions:**
  - explicit px type sizes only (`text-[12px]`, never `text-sm`)
  - `brand-*` / `parch-*` tokens and the existing status hexes, with no `stone-`, `gray-`, `slate-` or `primary-` classes
  - every action returns `ActionResult` via `runAction`
- **A `'use server'` file may export only async functions.** This is checked by `tests/portal/use-server-exports.test.ts`.
- **Database:** only the Neon **dev** branch, (see the infra notes). Print the endpoint and refuse `ep-dark-term-ai3c2hag` before any DB command.
- **No commits or pushes.** The user reviews first. Each task ends with a checkpoint instead.

---

### Task 1: The vault and the single PIN-issuing helper

**Files:**
- Create: `lib/portal/pin-vault.ts`
- Create: `lib/portal/pin-issue.ts`
- Test: `tests/portal/pin-vault.test.ts`
- Test: `tests/portal/pin-issue.test.ts`

**Interfaces:**
- Produces:
  - `pinVaultEnabled(): boolean`
  - `sealPin(pin: string, loginId: string): string | null`
  - `openPin(sealed: string | null | undefined, loginId: string): string | null`
  - `hashPin(pin: string): Promise<string>`
  - `issuedPinFields(pin: string, loginId: string): Promise<{ pinHash: string; pinSealed: string | null }>`
  - `issuedPinFieldsFromHash(pin: string, pinHash: string, loginId: string): { pinHash: string; pinSealed: string | null }`
  - `selfSetPinFields(pin: string): Promise<{ pinHash: string; pinSealed: null }>`

- [ ] **Step 1: Write the failing tests** — `tests/portal/pin-vault.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { sealPin, openPin, pinVaultEnabled } from '@/lib/portal/pin-vault'

const KEY_A = randomBytes(32).toString('base64')
const KEY_B = randomBytes(32).toString('base64')

describe('pin vault', () => {
  const saved = process.env.PORTAL_PIN_KEY
  beforeEach(() => {
    process.env.PORTAL_PIN_KEY = KEY_A
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.PORTAL_PIN_KEY
    else process.env.PORTAL_PIN_KEY = saved
  })

  it('opens what it sealed, for the same login ID', () => {
    const sealed = sealPin('0042', '1234')!
    expect(sealed.startsWith('v1.')).toBe(true)
    expect(sealed).not.toContain('0042')
    expect(openPin(sealed, '1234')).toBe('0042')
  })

  it('uses a fresh IV every time', () => {
    expect(sealPin('0042', '1234')).not.toBe(sealPin('0042', '1234'))
  })

  it('will not open under another login ID', () => {
    expect(openPin(sealPin('0042', '1234'), '4321')).toBeNull()
  })

  it('will not open under another key', () => {
    const sealed = sealPin('0042', '1234')
    process.env.PORTAL_PIN_KEY = KEY_B
    expect(openPin(sealed, '1234')).toBeNull()
  })

  it('rejects a tampered body and a truncated tag', () => {
    const [v, iv, tag, body] = sealPin('0042', '1234')!.split('.')
    const flipped = Buffer.from(body!, 'base64url')
    flipped[0] = flipped[0]! ^ 1
    expect(openPin([v, iv, tag, flipped.toString('base64url')].join('.'), '1234')).toBeNull()
    expect(openPin([v, iv, tag!.slice(0, 8), body].join('.'), '1234')).toBeNull()
  })

  it('is off without a valid key', () => {
    delete process.env.PORTAL_PIN_KEY
    expect(pinVaultEnabled()).toBe(false)
    expect(sealPin('0042', '1234')).toBeNull()
    process.env.PORTAL_PIN_KEY = Buffer.from('too short').toString('base64')
    expect(pinVaultEnabled()).toBe(false)
    expect(sealPin('0042', '1234')).toBeNull()
  })

  it('opens nothing when there is nothing sealed', () => {
    expect(openPin(null, '1234')).toBeNull()
    expect(openPin('garbage', '1234')).toBeNull()
  })
})
```

`tests/portal/pin-issue.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { issuedPinFields, issuedPinFieldsFromHash, hashPin, selfSetPinFields } from '@/lib/portal/pin-issue'
import { openPin } from '@/lib/portal/pin-vault'

describe('issuing a PIN', () => {
  const saved = process.env.PORTAL_PIN_KEY
  beforeAll(() => {
    process.env.PORTAL_PIN_KEY = randomBytes(32).toString('base64')
  })
  afterAll(() => {
    if (saved === undefined) delete process.env.PORTAL_PIN_KEY
    else process.env.PORTAL_PIN_KEY = saved
  })

  it('an issued PIN signs in and reads back under its login ID', async () => {
    const f = await issuedPinFields('0042', '1234')
    expect(await bcrypt.compare('0042', f.pinHash)).toBe(true)
    expect(openPin(f.pinSealed, '1234')).toBe('0042')
  })

  it('a batch can hash first and seal once the login ID is known', async () => {
    const hash = await hashPin('7777')
    const f = issuedPinFieldsFromHash('7777', hash, '5555')
    expect(f.pinHash).toBe(hash)
    expect(openPin(f.pinSealed, '5555')).toBe('7777')
  })

  it('a PIN someone chose keeps no readable copy', async () => {
    const f = await selfSetPinFields('9876')
    expect(await bcrypt.compare('9876', f.pinHash)).toBe(true)
    expect(f.pinSealed).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/portal/pin-vault.test.ts tests/portal/pin-issue.test.ts`
Expected: FAIL — cannot resolve `@/lib/portal/pin-vault`.

- [ ] **Step 3: Implement** — `lib/portal/pin-vault.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Admin-issued PINs, kept readable for the office (option B, 2026-09-26).
 *
 * Sign-in never reads this: it checks the bcrypt hash exactly as before. This is
 * a second, encrypted copy of a PIN the portal *issued*, so an admin can look it
 * up and hand it out again without resetting it. A PIN somebody sets for
 * themselves is never sealed; see selfSetPinFields in ./pin-issue.
 *
 * AES-256-GCM, a fresh 12-byte IV per seal, and the login ID as associated data,
 * so a sealed value copied onto another account's row will not open. The key is
 * PORTAL_PIN_KEY (32 bytes, base64) and exists only in the environment. Without
 * it the vault is off: nothing is sealed, nothing opens, and resets still work.
 */

const VERSION = 'v1'
const TAG_BYTES = 16

function currentKey(): Buffer | null {
  const raw = process.env.PORTAL_PIN_KEY?.trim()
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  return key.length === 32 ? key : null
}

export function pinVaultEnabled(): boolean {
  return currentKey() !== null
}

export function sealPin(pin: string, loginId: string): string | null {
  const key = currentKey()
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(loginId, 'utf8'))
  const body = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.')
}

export function openPin(sealed: string | null | undefined, loginId: string): string | null {
  const key = currentKey()
  if (!key || !sealed) return null
  const [version, iv, tag, body] = sealed.split('.')
  if (version !== VERSION || !iv || !tag || !body) return null
  try {
    // authTagLength pins the tag at 16 bytes; without it GCM accepts a truncated tag.
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'), { authTagLength: TAG_BYTES })
    decipher.setAAD(Buffer.from(loginId, 'utf8'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
```

`lib/portal/pin-issue.ts`:

```ts
import bcrypt from 'bcryptjs'
import { sealPin } from './pin-vault'

/**
 * The only way a PIN reaches the database.
 *
 * `issuedPinFields` is for a PIN the portal hands out (on create, reset or
 * import) and keeps an encrypted copy the admin can look up.
 * `selfSetPinFields` is for a PIN somebody chose on My PIN, and deliberately
 * keeps no copy: people reuse their bank and phone PINs, and those must never
 * sit where an admin can read them.
 *
 * tests/portal/pin-writes-seal.test.ts fails if any other file writes pinHash,
 * so a new path cannot quietly skip that choice.
 *
 * No `@/` imports: scripts/import-firebase.ts loads this through a relative path.
 */

export type PinFields = { pinHash: string; pinSealed: string | null }

/** bcrypt on its own, so a batch can hash in parallel before its login IDs are known. */
export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

/** issuedPinFields for a PIN whose hash was made earlier with hashPin. */
export function issuedPinFieldsFromHash(pin: string, pinHash: string, loginId: string): PinFields {
  return { pinHash, pinSealed: sealPin(pin, loginId) }
}

export async function issuedPinFields(pin: string, loginId: string): Promise<PinFields> {
  return issuedPinFieldsFromHash(pin, await hashPin(pin), loginId)
}

export async function selfSetPinFields(pin: string): Promise<{ pinHash: string; pinSealed: null }> {
  return { pinHash: await hashPin(pin), pinSealed: null }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/portal/pin-vault.test.ts tests/portal/pin-issue.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Checkpoint.** Do not commit; the user reviews first.

---

### Task 2: Store the sealed copy, route every PIN write through the helper, and guard it

**Files:**
- Modify: `prisma/schema.prisma` (model `Account`: add `pinSealed`)
- Create: `prisma/migrations/20260926190000_account_pin_sealed/migration.sql`
- Modify: `lib/portal/actions/admin.ts` (`createServant`, `resetServantPin`, `resetClassPins`; drop the unused `bcrypt` import)
- Modify: `lib/portal/actions/students.ts` (`createStudent`, `resetStudentPin`; drop `bcrypt` if unused)
- Modify: `lib/portal/actions/data-tools.ts` (the student and servant CSV imports; drop `bcrypt` if unused)
- Modify: `lib/portal/actions/account.ts` (`changeOwnPin` → `selfSetPinFields`)
- Modify: `scripts/import-firebase.ts`
- Modify: `lib/portal/reports.ts` (add `CONFIRM_PHRASE.reissuePins`)
- Modify: `.env.local` (add a dev `PORTAL_PIN_KEY`; the file is gitignored)
- Test: `tests/portal/pin-writes-seal.test.ts`

**Interfaces:**
- Consumes: `issuedPinFields`, `issuedPinFieldsFromHash`, `hashPin`, `selfSetPinFields` from Task 1.
- Produces:
  - the column `Account.pinSealed String?`
  - `CONFIRM_PHRASE.reissuePins === 'RESET PINS'`
  - after this task, every issued PIN is sealed

- [ ] **Step 1: Write the failing guard test** — `tests/portal/pin-writes-seal.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Option B keeps an encrypted copy of every PIN the portal issues, and never of
 * a PIN somebody chose. That only holds if no write path can skip the choice,
 * so pinHash may be written in exactly one file, lib/portal/pin-issue.ts, whose
 * two helpers force it. Reading the source is deliberate: the invariant is about
 * where the code is allowed to touch these columns, not about any one path.
 */
const REPO = path.resolve(__dirname, '../..')
const ROOTS = ['app', 'lib', 'components', 'scripts']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|mjs|js)$/.test(entry)) out.push(full)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(path.join(REPO, r)))
const rel = (f: string) => path.relative(REPO, f).split(path.sep).join('/')
const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length

describe('PIN storage', () => {
  it('writes pinHash only through lib/portal/pin-issue.ts', () => {
    // `pinHash: <value>` other than a select (`true`) or a type (`string`), or
    // the shorthand `{ ..., pinHash }`.
    const WRITE = /pinHash\s*:\s*(?!true\b|string\b)|[{,]\s*pinHash\s*(?=[,}])/g
    const offenders: string[] = []
    for (const file of files) {
      if (rel(file) === 'lib/portal/pin-issue.ts') continue
      const src = readFileSync(file, 'utf8')
      for (const m of Array.from(src.matchAll(WRITE))) offenders.push(`${rel(file)}:${lineOf(src, m.index ?? 0)}`)
    }
    expect(offenders, `write PINs with issuedPinFields/selfSetPinFields instead:\n${offenders.join('\n')}`).toEqual([])
  })

  it('touches pinSealed only in the vault, the issuer and the admin logins code', () => {
    const allowed = new Set([
      'lib/portal/pin-vault.ts',
      'lib/portal/pin-issue.ts',
      'lib/portal/actions/logins.ts',
      'lib/portal/data/logins.ts',
    ])
    const offenders: string[] = []
    for (const file of files) {
      if (allowed.has(rel(file))) continue
      const src = readFileSync(file, 'utf8')
      for (const m of Array.from(src.matchAll(/\bpinSealed\b/g))) offenders.push(`${rel(file)}:${lineOf(src, m.index ?? 0)}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('keeps the JSON backup free of PIN fields', () => {
    const src = readFileSync(path.join(REPO, 'lib/portal/actions/data-tools.ts'), 'utf8')
    const start = src.indexOf('export async function buildBackup')
    const end = src.indexOf('export async function', start + 10)
    expect(start).toBeGreaterThan(-1)
    expect(src.slice(start, end)).not.toMatch(/pinHash\s*:\s*true|pinSealed/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/portal/pin-writes-seal.test.ts`
Expected: FAIL. It lists the offenders:
- `admin.ts` ×3
- `students.ts` ×2
- `data-tools.ts` ×2
- `account.ts` ×1
- `scripts/import-firebase.ts` ×2

- [ ] **Step 3: Add the column**
  - In `prisma/schema.prisma`, model `Account`, directly under `pinHash String`, add:

    ```prisma
      pinSealed      String? // encrypted copy of a PIN the portal issued (lib/portal/pin-vault.ts); null once the owner sets their own
    ```

  - Create `prisma/migrations/20260926190000_account_pin_sealed/migration.sql`:

    ```sql
    -- Option B (2026-09-26): an encrypted copy of a PIN the portal issued, so an
    -- admin can look it up. Sign-in never reads it. Nullable with no backfill:
    -- existing PINs are recovered by the admin's one-time Recover PINs upload.
    ALTER TABLE "Account" ADD COLUMN "pinSealed" TEXT;
    ```

  - Apply it to the dev branch only:

    ```bash
    node --env-file=.env -e 'const h=(process.env.DATABASE_URL.match(/@([^/?]+)/)||[])[1]||"";if(h.includes("ep-dark-term-ai3c2hag")){console.error("REFUSING: production");process.exit(1)}console.log("db:",h)' \
      && npx prisma migrate deploy && npx prisma generate
    ```

    Expected: the dev endpoint, then `Applying migration 20260926190000_account_pin_sealed`.

- [ ] **Step 4: Rewire the writers.**

  **`admin.ts` `createServant`:** add `import { issuedPinFields } from '../pin-issue'`, and replace `pinHash: await bcrypt.hash(pin, 10),` with `...(await issuedPinFields(pin, loginId)),`.

  **`admin.ts` `resetServantPin`:** the account's login ID is needed before the update. Replace the lookup and the update with:

  ```ts
      const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { role: true, displayName: true, loginId: true } })
      if (!acc || acc.role === 'STUDENT') throw new PortalError('Account not found.')
      const pin = randomPin()
      const updated = await prisma.account.update({ where: { id: accountId }, data: { ...(await issuedPinFields(pin, acc.loginId)), failedAttempts: 0, lockedUntil: null }, select: { loginId: true } })
  ```

  **`admin.ts` `resetClassPins`:** replace the `hashes` line and the transaction data with:

  ```ts
      const pins = students.map(() => randomPin())
      const fields = await Promise.all(students.map((s, i) => issuedPinFields(pins[i]!, s.account.loginId)))

      await prisma.$transaction(
        students.map((s, i) =>
          prisma.account.update({
            where: { id: s.accountId },
            data: { ...fields[i]!, failedAttempts: 0, lockedUntil: null },
          }),
        ),
      )
  ```

  Remove `import bcrypt from 'bcryptjs'` from `admin.ts`.

  **`students.ts` `createStudent`:** replace `const pinHash = await bcrypt.hash(pin, 10)` with `const pinFields = await issuedPinFields(pin, loginId)`. In the nested create, use `{ loginId, ...pinFields, role: PortalRole.STUDENT, displayName: studentName(data), ...toAccountData(input) }`.

  **`students.ts` `resetStudentPin`:** replace the body between `const existing = …` and `clearRateLimit` with:

  ```ts
      const pin = randomPin()
      const target = await prisma.student.findUnique({ where: { id: studentId }, select: { accountId: true, account: { select: { loginId: true } } } })
      if (!target) throw new PortalError('Student not found.')
      const account = await prisma.account.update({
        where: { id: target.accountId },
        data: { ...(await issuedPinFields(pin, target.account.loginId)), failedAttempts: 0, lockedUntil: null },
        select: { loginId: true },
      })
  ```

  Add `import { issuedPinFields } from '../pin-issue'`. Remove `import bcrypt` if `grep -n bcrypt lib/portal/actions/students.ts` shows no other use.

  **`data-tools.ts`, both CSV imports, Pass 3:** change `bcrypt.hash(pin, 10)` to `hashPin(pin)`.

  **`data-tools.ts`, both CSV imports, Pass 4:** change `pinHash: hash,` to `...issuedPinFieldsFromHash(pin, hash, loginId),`. Add `import { hashPin, issuedPinFieldsFromHash } from '../pin-issue'`, and remove `import bcrypt` if it's unused.

  **`account.ts` `changeOwnPin`:** replace the update with:

  ```ts
      // A PIN somebody chose is theirs: the office's readable copy goes with the old one.
      await prisma.account.update({ where: { id: user.accountId }, data: await selfSetPinFields(input.newPin) })
  ```

  Add `import { selfSetPinFields } from '../pin-issue'`. **Keep** `bcrypt` there, since `compare` still uses it.

  **`scripts/import-firebase.ts`:** add `import { issuedPinFields } from '../lib/portal/pin-issue'` and remove `import bcrypt`. Replace the `pinHash` line with:

  ```ts
    const pinFields = !existing || resetPins ? await issuedPinFields(a.pin, a.loginId) : undefined
  ```

  In the `create` block, change `pinHash: pinHash!,` to `...pinFields!,`. In the `update` block, change `...(pinHash ? { pinHash } : {}),` to `...(pinFields ?? {}),`.

  **`reports.ts` `CONFIRM_PHRASE`:** add `reissuePins: 'RESET PINS',`.

- [ ] **Step 5: Add a dev key to `.env.local`.** The file is gitignored, and the command never prints the key:

  ```bash
  grep -q '^PORTAL_PIN_KEY=' .env.local || printf '\nPORTAL_PIN_KEY=%s\n' "$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')" >> .env.local
  ```

- [ ] **Step 6: Run the guard, the suite and the type check**

  Run: `npx vitest run tests/portal/pin-writes-seal.test.ts && npm test && npx tsc --noEmit`
  Expected: the guard passes. All 695 earlier tests plus the new ones pass, and tsc is clean. `tests/portal/pin-reset-unlocks.test.ts` still passes, because every lockout-clearing action still calls `clearRateLimit`.

- [ ] **Step 7: Checkpoint (no commit).**

---

### Task 3: Share helpers, the Sign-in card, and reveal

**Files:**
- Create: `lib/portal/login-share.ts`
- Test: `tests/portal/login-share.test.ts`
- Create: `lib/portal/data/logins.ts`
- Create: `lib/portal/actions/logins.ts` (`revealLogins` only in this task, plus the local `requireAdmin`)
- Create: `components/portal/LoginShareButtons.tsx`
- Create: `components/portal/LoginCard.tsx`
- Modify: `app/portal/(app)/admin/servants/[id]/page.tsx` (render `LoginCard`)
- Modify: `components/portal/ServantForm.tsx`:
  - remove the edit-mode reset block, and the dead `copied` / `shareText` / `shareRow` code
  - add `LoginShareButtons` to the "Account created" card
- Modify: `app/portal/(app)/students/[id]/page.tsx` (show `LoginCard` for ADMIN)
- Modify: `app/portal/(app)/students/[id]/StudentProfileActions.tsx` (new `showPinReset` prop)
- Modify: `app/portal/(app)/settings/ChangePinForm.tsx` (a privacy line)

**Interfaces:**
- Consumes: `openPin` and `pinVaultEnabled` from Task 1, and the `pinSealed` column from Task 2.
- Produces:
  - `LOGIN_URL: string`
  - `LOGIN_EMAIL_SUBJECT: string`
  - `loginMessage({ name, loginId, pin }): string`
  - `smsHref(phone, text): string | null`
  - `whatsappHref(phone, text): string | null`
  - `mailtoHref(email, text): string | null`
  - `onFileAccountIds(ids: string[]): Promise<Set<string>>`
  - `revealLogins(accountIds: string[]): Promise<ActionResult<{ enabled: boolean; rows: { accountId: string; loginId: string; pin: string | null }[] }>>`
  - `<LoginShareButtons name loginId pin email? phone? />`
  - `<LoginCard accountId studentId? loginId name email? phone? onFile vaultEnabled />`

- [ ] **Step 1: Write the failing test** — `tests/portal/login-share.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { loginMessage, smsHref, whatsappHref, mailtoHref, LOGIN_URL } from '@/lib/portal/login-share'

describe('login share', () => {
  const text = loginMessage({ name: 'Mariam Guirguis', loginId: '1234', pin: '0042' })

  it('greets by first name and keeps the leading zero', () => {
    expect(text).toBe(`Hi Mariam, here is your St. Kyrillos Sunday School portal login.\nID: 1234\nPIN: 0042\nSign in at ${LOGIN_URL}`)
  })

  it('texts a US number in +1 form with the body encoded', () => {
    expect(smsHref('6155550123', 'a b')).toBe('sms:+16155550123?&body=a%20b')
    expect(smsHref('', 'x')).toBeNull()
    expect(smsHref(null, 'x')).toBeNull()
  })

  it('opens WhatsApp with the message', () => {
    expect(whatsappHref('6155550123', 'a b')).toBe('https://wa.me/16155550123?text=a%20b')
    expect(whatsappHref(undefined, 'x')).toBeNull()
  })

  it('opens a mail draft only when there is an address', () => {
    expect(mailtoHref('a@example.com', 'hi')).toMatch(/^mailto:a%40example\.com\?subject=.+&body=hi$/)
    expect(mailtoHref(null, 'hi')).toBeNull()
  })

  it('falls back to "there" when there is no name', () => {
    expect(loginMessage({ name: ' ', loginId: '1', pin: '2' }).startsWith('Hi there,')).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/portal/login-share.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/portal/login-share.ts`**:

```ts
import { SITE_URL } from '@/lib/constants'
import { waLink } from './phones'

/**
 * What a person receives with their login, and the links that deliver it from
 * the admin's own phone or mail app. Pure, so it is shared by the Sign-in card,
 * Send logins and the login emails.
 */

export const LOGIN_URL = `${SITE_URL}/portal/login`
export const LOGIN_EMAIL_SUBJECT = 'Your St. Kyrillos Sunday School portal login'

export function loginMessage(input: { name: string; loginId: string; pin: string }): string {
  const first = input.name.trim().split(/\s+/)[0] || 'there'
  return [
    `Hi ${first}, here is your St. Kyrillos Sunday School portal login.`,
    `ID: ${input.loginId}`,
    `PIN: ${input.pin}`,
    `Sign in at ${LOGIN_URL}`,
  ].join('\n')
}

/** Opens Messages with the text typed. `?&body=` is the form both iOS and Android accept. */
export function smsHref(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D+/g, '')
  if (!digits) return null
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`
  return `sms:${e164}?&body=${encodeURIComponent(text)}`
}

export function whatsappHref(phone: string | null | undefined, text: string): string | null {
  const base = waLink(phone)
  return base ? `${base}?text=${encodeURIComponent(text)}` : null
}

export function mailtoHref(email: string | null | undefined, text: string): string | null {
  if (!email) return null
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(LOGIN_EMAIL_SUBJECT)}&body=${encodeURIComponent(text)}`
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/portal/login-share.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add `lib/portal/data/logins.ts`**:

```ts
import { prisma } from '@/lib/prisma'

/**
 * Which of these accounts have a readable PIN on file. Returns ids only; the
 * sealed value never leaves the admin logins actions.
 */
export async function onFileAccountIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await prisma.account.findMany({ where: { id: { in: ids }, pinSealed: { not: null } }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}
```

- [ ] **Step 6: Create `lib/portal/actions/logins.ts` with `revealLogins`**:

```ts
'use server'

import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { openPin, pinVaultEnabled } from '../pin-vault'
import type { PortalUser } from '../permissions'

// Every action here reads or changes a login, so every one is admin-only on the
// server and writes the activity log. See the viewable-logins spec.
async function requireAdmin(): Promise<PortalUser> {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') throw new PortalError('Only the Sunday School admin can do that.')
  return user
}

function cleanIds(ids: unknown, max = 400): string[] {
  const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 64) : []
  const unique = Array.from(new Set(list))
  if (unique.length > max) throw new PortalError(`At most ${max} at a time.`)
  return unique
}

export async function revealLogins(
  accountIds: string[],
): Promise<ActionResult<{ enabled: boolean; rows: Array<{ accountId: string; loginId: string; pin: string | null }> }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const ids = cleanIds(accountIds)
    if (ids.length === 0) throw new PortalError('Nobody was selected.')
    const accounts = await prisma.account.findMany({
      where: { id: { in: ids } },
      select: { id: true, loginId: true, displayName: true, pinSealed: true },
    })
    const rows = accounts.map((a) => ({ accountId: a.id, loginId: a.loginId, pin: openPin(a.pinSealed, a.loginId) }))
    const shown = rows.filter((r) => r.pin).length
    await audit(
      user,
      'login.reveal',
      'account',
      accounts.length === 1 ? accounts[0]!.id : null,
      accounts.length === 1
        ? `Viewed the PIN for ${accounts[0]!.displayName}`
        : `Viewed ${shown} PIN${shown === 1 ? '' : 's'} (${accounts.length} requested)`,
    )
    return { enabled: pinVaultEnabled(), rows }
  })
}
```

- [ ] **Step 7: Create `components/portal/LoginShareButtons.tsx`**:

```tsx
'use client'

import { useState } from 'react'
import { Copy, Mail, MessageCircle, MessageSquare } from 'lucide-react'
import { buttonClass } from './ui'
import { cn } from '@/lib/utils'
import { loginMessage, mailtoHref, smsHref, whatsappHref } from '@/lib/portal/login-share'

/**
 * Hand one person their login. Copy it, or open Messages, WhatsApp or the
 * admin's own mail app with it already written. The portal sends nothing from
 * here: the admin presses Send in their own app, from a number or address the
 * person already knows, which is also why it never reads as a scam.
 */
export function LoginShareButtons({
  name,
  loginId,
  pin,
  email,
  phone,
}: {
  name: string
  loginId: string
  pin: string
  email?: string | null
  phone?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const text = loginMessage({ name, loginId, pin })
  const sms = smsHref(phone, text)
  const wa = whatsappHref(phone, text)
  const mail = mailtoHref(email, text)
  const cls = cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')

  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
      <button
        type="button"
        className={cls}
        onClick={() => {
          if (!navigator.clipboard) return setError('This browser will not copy. Write it down instead.')
          navigator.clipboard
            .writeText(text)
            .then(() => {
              setError('')
              setCopied(true)
            })
            .catch(() => setError('This browser will not copy. Write it down instead.'))
        }}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? 'Copied' : 'Copy'}
      </button>
      {sms && (
        <a href={sms} className={cls}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Text
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={cls}>
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
        </a>
      )}
      {mail && (
        <a href={mail} className={cls}>
          <Mail className="h-3.5 w-3.5" aria-hidden /> Email
        </a>
      )}
      {error && (
        <span role="alert" className="text-[11.5px] text-[#B91C1C]">
          {error}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Create `components/portal/LoginCard.tsx`**:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Eye, KeyRound } from 'lucide-react'
import { revealLogins } from '@/lib/portal/actions/logins'
import { resetServantPin } from '@/lib/portal/actions/admin'
import { resetStudentPin } from '@/lib/portal/actions/students'
import { Callout, Card, buttonClass } from './ui'
import { LoginShareButtons } from './LoginShareButtons'
import { cn } from '@/lib/utils'

/**
 * A person's ID and PIN, for the admin (option B). The PIN stays hidden until
 * asked for, and every Show is written to the activity log. Reissue works
 * whether or not a PIN is on file; a student is reissued through
 * resetStudentPin, anybody else through resetServantPin.
 */
export function LoginCard({
  accountId,
  studentId,
  loginId,
  name,
  email,
  phone,
  onFile,
  vaultEnabled,
}: {
  accountId: string
  studentId?: string
  loginId: string
  name: string
  email?: string | null
  phone?: string | null
  onFile: boolean
  vaultEnabled: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [pin, setPin] = useState<string | null>(null)
  const [stored, setStored] = useState(onFile)
  const [error, setError] = useState('')

  function show() {
    setError('')
    startTransition(async () => {
      const r = await revealLogins([accountId])
      if (!r.ok) return setError(r.error)
      const row = r.data!.rows[0]
      if (row?.pin) setPin(row.pin)
      else {
        setStored(false)
        setError('That PIN is not on file any more. Reissue to give them one you can see.')
      }
    })
  }

  function reissue() {
    if (!confirm(`Give ${name} a new PIN? The one they use now stops working.`)) return
    setError('')
    startTransition(async () => {
      const r = studentId ? await resetStudentPin(studentId) : await resetServantPin(accountId)
      if (!r.ok) return setError(r.error)
      setPin(r.data!.pin)
      setStored(vaultEnabled)
    })
  }

  return (
    <Card title="Sign-in" icon={<KeyRound className="h-[15px] w-[15px]" />}>
      <dl className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3">
          <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">ID</dt>
          <dd className="font-serif text-[24px] font-bold tracking-[0.2em] text-brand-800 tabular-nums">{loginId}</dd>
        </div>
        <div className="rounded-[12px] border border-brand-gold/40 bg-brand-wash p-3">
          <dt className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">PIN</dt>
          <dd className="font-serif text-[24px] font-bold tracking-[0.2em] text-brand-800 tabular-nums" data-testid="login-pin">
            {pin ?? '••••'}
          </dd>
        </div>
      </dl>
      {!vaultEnabled ? (
        <p className="mt-2.5 text-[11.5px] text-parch-500">
          PIN viewing is switched off on this site (PORTAL_PIN_KEY is not set). Reissuing still works.
        </p>
      ) : !stored && !pin ? (
        <p className="mt-2.5 text-[11.5px] text-parch-500">
          Not on file. They may have chosen their own; reissue to give them one you can see.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        {!pin && vaultEnabled && stored && (
          <button type="button" disabled={pending} onClick={show} className={cn(buttonClass('primary', 'sm'), 'min-h-[36px]')}>
            <Eye className="h-3.5 w-3.5" aria-hidden /> {pending ? 'Opening…' : 'Show PIN'}
          </button>
        )}
        <button type="button" disabled={pending} onClick={reissue} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px]')}>
          Reissue PIN
        </button>
      </div>
      {pin && (
        <div className="mt-3">
          <LoginShareButtons name={name} loginId={loginId} pin={pin} email={email} phone={phone} />
        </div>
      )}
      {error && (
        <div className="mt-3" role="alert">
          <Callout tone="bad">{error}</Callout>
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 9: Put the card on the servant page.** In `app/portal/(app)/admin/servants/[id]/page.tsx`:
  - Add these imports:

    ```tsx
    import { LoginCard } from '@/components/portal/LoginCard'
    import { onFileAccountIds } from '@/lib/portal/data/logins'
    import { pinVaultEnabled } from '@/lib/portal/pin-vault'
    ```

  - After the `notFound()` check, add:

    ```tsx
      const onFile = (await onFileAccountIds([account.id])).has(account.id)
    ```

  - Directly above `<ServantForm`, render:

    ```tsx
      <div className="mb-3.5">
        <LoginCard accountId={account.id} loginId={account.loginId} name={account.displayName} email={account.email} phone={account.phone} onFile={onFile} vaultEnabled={pinVaultEnabled()} />
      </div>
    ```

- [ ] **Step 10: Clean up `ServantForm.tsx`.**
  - Remove the `copied` state, `shareText`, `shareRow`, and the edit-mode `{creds ? (<span>New PIN…</span>) : (<button>Reset PIN</button>)}` block. Keep the `This is you` badge and **Delete** as they are.
  - Remove `resetServantPin` from the import.
  - In the create-mode "Account created" card, add this between `</dl>` and the Back button:

    ```tsx
            <div className="mt-3.5">
              <LoginShareButtons name={form.displayName} loginId={creds.loginId} pin={creds.pin} email={form.email} phone={form.phone} />
            </div>
    ```

    with `import { LoginShareButtons } from './LoginShareButtons'`.

- [ ] **Step 11: Student profile.**
  - In `StudentProfileActions.tsx`, add the prop `showPinReset = true` to the destructure and type (`showPinReset?: boolean`). Wrap the existing `{pin ? (…) : (<button>Reset PIN</button>)}` block in `{showPinReset && (…)}`.
  - In `app/portal/(app)/students/[id]/page.tsx`, add the same three imports as Step 9, then compute:

    ```tsx
      const isAdmin = user.role === 'ADMIN'
      const onFile = isAdmin ? (await onFileAccountIds([s.account.id])).has(s.account.id) : false
    ```

  - Directly above the `{canWrite && (<StudentProfileActions …`, render:

    ```tsx
              {isAdmin && (
                <LoginCard
                  accountId={s.account.id}
                  studentId={s.id}
                  loginId={s.account.loginId}
                  name={`${s.firstName} ${s.lastName}`.trim()}
                  email={s.account.email ?? s.parentEmails[0] ?? null}
                  phone={s.account.phone ?? s.fatherPhone ?? s.motherPhone ?? null}
                  onFile={onFile}
                  vaultEnabled={pinVaultEnabled()}
                />
              )}
    ```

  - Pass `showPinReset={!isAdmin}` to `StudentProfileActions`.

- [ ] **Step 12: Add the privacy line.** In `ChangePinForm.tsx`, directly after the closing `</form>`, add:

```tsx
      <p className="mt-3 text-[11.5px] text-parch-500">
        Once you choose your own PIN, only you know it. The office can give you a new one, but can&rsquo;t look yours up.
      </p>
```

- [ ] **Step 13: Verify**

  Run: `npm test && npx tsc --noEmit && npm run lint`
  Expected: all pass.

- [ ] **Step 14: Checkpoint (no commit).**

---

### Task 4: Exports

**Files:**
- Create: `lib/portal/logins-csv.ts`
- Test: `tests/portal/logins-csv.test.ts`
- Modify: `lib/portal/actions/logins.ts` (add `exportLoginsCsv`)
- Create: `app/portal/(app)/admin/data/LoginsPanel.tsx` (the export half)
- Modify: `app/portal/(app)/admin/data/page.tsx` (render `LoginsPanel`)

**Interfaces:**
- Produces:
  - `NOT_ON_FILE_NOTE`
  - `interface LoginRow { name: string; group: string; loginId: string; pin: string | null }`
  - `loginsCsv(kind: 'servants' | 'students', rows: LoginRow[]): string`
  - `exportLoginsCsv(kind): Promise<ActionResult<{ filename: string; csv: string; rows: number; missing: number }>>`
  - `<LoginsPanel vaultEnabled />`

- [ ] **Step 1: Write the failing test** — `tests/portal/logins-csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { loginsCsv, NOT_ON_FILE_NOTE } from '@/lib/portal/logins-csv'
import { parseCsv } from '@/lib/portal/csv'

describe('logins CSV', () => {
  const rows = [
    { name: 'Mariam G', group: 'Servant', loginId: '1234', pin: '0042' },
    { name: '=HYPERLINK("x")', group: 'Servant', loginId: '5678', pin: null },
  ]

  it('keeps leading zeros by writing ID and PIN as text formulas', () => {
    const m = parseCsv(loginsCsv('servants', rows))
    expect(m[0]).toEqual(['Name', 'Role', 'ID', 'PIN', 'Note'])
    expect(m[1]).toEqual(['Mariam G', 'Servant', '="1234"', '="0042"', ''])
  })

  it('says why a PIN is missing, and still neutralises a formula in a name', () => {
    const m = parseCsv(loginsCsv('servants', rows))
    expect(m[2]).toEqual(["'=HYPERLINK(\"x\")", 'Servant', '="5678"', '', NOT_ON_FILE_NOTE])
  })

  it('leads with the class for students', () => {
    const m = parseCsv(loginsCsv('students', [{ name: 'Kid', group: '4th', loginId: '1111', pin: '2222' }]))
    expect(m[0]).toEqual(['Class', 'Name', 'ID', 'PIN', 'Note'])
    expect(m[1]).toEqual(['4th', 'Kid', '="1111"', '="2222"', ''])
  })

  it('refuses anything but digits in the text-formula columns', () => {
    expect(() => loginsCsv('servants', [{ name: 'x', group: 'y', loginId: '12a4', pin: null }])).toThrow()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/portal/logins-csv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/portal/logins-csv.ts`**:

```ts
import { escapeCsvField } from './csv'

/**
 * The admin's ID + PIN export (option B).
 *
 * A PIN like 0042 opened in Excel becomes 42, and a family handed "42" cannot
 * sign in. So the ID and PIN columns are written as ="0042", which Excel,
 * Numbers and Google Sheets all show as the digits. That is a formula, which
 * the portal's CSVs otherwise neutralise; it is safe here only because the
 * value is checked to be digits first. Every other cell goes through
 * escapeCsvField as usual.
 */

export const NOT_ON_FILE_NOTE = 'Not on file — reissue to see it'

export interface LoginRow {
  name: string
  group: string
  loginId: string
  pin: string | null
}

function digitsCell(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error('Only digits may be written as a text formula')
  return `"=""${value}"""`
}

export function loginsCsv(kind: 'servants' | 'students', rows: readonly LoginRow[]): string {
  const header = kind === 'servants' ? ['Name', 'Role', 'ID', 'PIN', 'Note'] : ['Class', 'Name', 'ID', 'PIN', 'Note']
  const lines = [header.map(escapeCsvField).join(',')]
  for (const r of rows) {
    const lead = kind === 'servants' ? [r.name, r.group] : [r.group, r.name]
    lines.push(
      [
        ...lead.map(escapeCsvField),
        digitsCell(r.loginId),
        r.pin ? digitsCell(r.pin) : '',
        escapeCsvField(r.pin ? '' : NOT_ON_FILE_NOTE),
      ].join(','),
    )
  }
  return lines.join('\r\n')
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/portal/logins-csv.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add `exportLoginsCsv` to `lib/portal/actions/logins.ts`.** Add these imports:

```ts
import { reportFilename } from '../reports'
import { formatDateOnly } from '../dates'
import { ROLE_LABEL } from '../format'
import { loginsCsv, type LoginRow } from '../logins-csv'
```

Then add:

```ts
export async function exportLoginsCsv(
  kind: 'servants' | 'students',
): Promise<ActionResult<{ filename: string; csv: string; rows: number; missing: number }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    if (kind !== 'servants' && kind !== 'students') throw new PortalError('Unknown export.')
    let rows: LoginRow[]
    if (kind === 'servants') {
      const accounts = await prisma.account.findMany({
        where: { role: { in: ['SERVANT', 'ADMIN', 'PASTOR'] } },
        orderBy: { displayName: 'asc' },
        select: { loginId: true, displayName: true, role: true, isActive: true, pinSealed: true },
      })
      rows = accounts.map((a) => ({
        name: a.displayName,
        group: `${ROLE_LABEL[a.role]}${a.isActive ? '' : ' (inactive)'}`,
        loginId: a.loginId,
        pin: openPin(a.pinSealed, a.loginId),
      }))
    } else {
      const students = await prisma.student.findMany({
        orderBy: [{ class: { sortOrder: 'asc' } }, { firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          firstName: true,
          lastName: true,
          class: { select: { name: true } },
          account: { select: { loginId: true, pinSealed: true } },
        },
      })
      rows = students.map((s) => ({
        name: `${s.firstName} ${s.lastName}`.trim(),
        group: s.class?.name ?? 'No class',
        loginId: s.account.loginId,
        pin: openPin(s.account.pinSealed, s.account.loginId),
      }))
    }
    const missing = rows.filter((r) => !r.pin).length
    await audit(user, 'login.export', 'portal', null, `Exported ${rows.length} ${kind} logins (${rows.length - missing} with a PIN)`)
    return {
      filename: reportFilename([`${kind}-logins`, formatDateOnly(new Date())], 'csv'),
      csv: loginsCsv(kind, rows),
      rows: rows.length,
      missing,
    }
  })
}
```

- [ ] **Step 6: Create `app/portal/(app)/admin/data/LoginsPanel.tsx`** (the export half; Task 5 adds recovery):

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Download, KeyRound } from 'lucide-react'
import { exportLoginsCsv } from '@/lib/portal/actions/logins'
import { Callout, Card, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'

function saveCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const CAPTION = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500'

export function LoginsPanel({ vaultEnabled }: { vaultEnabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function exportKind(kind: 'servants' | 'students') {
    setError(null)
    setNote(null)
    startTransition(async () => {
      const r = await exportLoginsCsv(kind)
      if (!r.ok) return setError(r.error)
      saveCsv(r.data!.filename, r.data!.csv)
      setNote(
        `${r.data!.rows} ${kind} exported${
          r.data!.missing ? `; ${r.data!.missing} have no PIN on file yet (reissue them to fill the gap)` : ''
        }.`,
      )
    })
  }

  return (
    <Card title="IDs & PINs" icon={<KeyRound className="h-4 w-4" />}>
      {!vaultEnabled && (
        <div className="mb-3">
          <Callout tone="warn" title="PIN viewing is switched off">
            Set PORTAL_PIN_KEY on the site to keep and show the PINs the portal issues.
          </Callout>
        </div>
      )}
      <span className={CAPTION}>Export</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !vaultEnabled} onClick={() => exportKind('servants')} className={cn(buttonClass('secondary'), 'min-h-[40px]')}>
          <Download className="h-4 w-4" aria-hidden /> Servants — IDs &amp; PINs
        </button>
        <button type="button" disabled={pending || !vaultEnabled} onClick={() => exportKind('students')} className={cn(buttonClass('secondary'), 'min-h-[40px]')}>
          <Download className="h-4 w-4" aria-hidden /> Students — IDs &amp; PINs
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-parch-500">
        The students file holds every child&rsquo;s login. Print per class (Class → Logins &amp; PINs) rather than forwarding
        the file, and delete it when you are done. Every export is written to the activity log.
      </p>
      {note && <p role="status" className="mt-2 text-[12px] font-semibold text-[#15803D]">{note}</p>}
      {error && <div className="mt-3" role="alert"><Callout tone="bad">{error}</Callout></div>}
    </Card>
  )
}
```

- [ ] **Step 7: Render the panel.** In the Admin → Data page:
  - add `import { LoginsPanel } from './LoginsPanel'`
  - add `import { pinVaultEnabled } from '@/lib/portal/pin-vault'`
  - render `<LoginsPanel vaultEnabled={pinVaultEnabled()} />` directly after `<ImportPanel classes={classes} />`

- [ ] **Step 8: Verify.** Run `npm test && npx tsc --noEmit`. Expected: pass.

- [ ] **Step 9: Checkpoint (no commit).**

---

### Task 5: Recover today's PINs without resetting anyone

**Files:**
- Create: `lib/portal/recover-pins.ts`
- Test: `tests/portal/recover-pins.test.ts`
- Modify: `lib/portal/actions/logins.ts` (add `recoverPinsBatch`)
- Modify: `app/portal/(app)/admin/data/LoginsPanel.tsx` (the recovery half)
- Create: `scripts/legacy-pins-csv.ts`

**Interfaces:**
- Produces:
  - `interface RecoveryRow { loginId: string; pin: string }`
  - `type RecoveryOutcome = 'sealed' | 'already' | 'changed' | 'unknown'`
  - `parseRecoveryCsv(text): { rows: RecoveryRow[]; skipped: number }`
  - `classifyRecovery(row, account | undefined, compare): Promise<RecoveryOutcome>`
  - `recoverPinsBatch(rows): Promise<ActionResult<Record<RecoveryOutcome, number>>>`

- [ ] **Step 1: Write the failing test** — `tests/portal/recover-pins.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseRecoveryCsv, classifyRecovery } from '@/lib/portal/recover-pins'

describe('recovering PINs', () => {
  it('reads an id,pin file, header or not, and skips junk and duplicates', () => {
    expect(parseRecoveryCsv('id,pin\n1234,0042\n1234,9999\n12,0042\n5678,12\n4321,7777\n')).toEqual({
      rows: [
        { loginId: '1234', pin: '0042' },
        { loginId: '4321', pin: '7777' },
      ],
      skipped: 3,
    })
    expect(parseRecoveryCsv('1111,2222').rows).toEqual([{ loginId: '1111', pin: '2222' }])
  })

  it('accepts its own export back, with the ="0042" text cells', () => {
    const exported = 'Name,Role,ID,PIN,Note\r\nMariam,Servant,"=""1234""","=""0042""",\r\n'
    expect(parseRecoveryCsv(exported).rows).toEqual([{ loginId: '1234', pin: '0042' }])
  })

  it('seals only a PIN that still matches, and never one already on file', async () => {
    const compare = async (pin: string, hash: string) => hash === `hash:${pin}`
    const row = { loginId: '1234', pin: '0042' }
    expect(await classifyRecovery(row, undefined, compare)).toBe('unknown')
    expect(await classifyRecovery(row, { pinHash: 'hash:0042', hasSealed: true }, compare)).toBe('already')
    expect(await classifyRecovery(row, { pinHash: 'hash:9999', hasSealed: false }, compare)).toBe('changed')
    expect(await classifyRecovery(row, { pinHash: 'hash:0042', hasSealed: false }, compare)).toBe('sealed')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/portal/recover-pins.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/portal/recover-pins.ts`**:

```ts
import { parseCsv } from './csv'
import { LOGIN_ID_RE, PIN_RE } from './login'

/**
 * One-time recovery of the PINs people already use (option B).
 *
 * Nearly every PIN in the portal came from the old app's export, which still
 * holds them in plain text. Given that file as id,pin rows, the server seals a
 * PIN only when it still matches the stored hash. So this can never change
 * anybody's PIN, and never stores a wrong one.
 */

export interface RecoveryRow {
  loginId: string
  pin: string
}

export type RecoveryOutcome = 'sealed' | 'already' | 'changed' | 'unknown'

/** Our own export writes ="0042" so spreadsheets keep the zero; read it back as 0042. */
function cell(raw: string | undefined): string {
  const v = (raw ?? '').trim()
  const m = /^="(.*)"$/.exec(v)
  return (m ? m[1]! : v).trim()
}

export function parseRecoveryCsv(text: string): { rows: RecoveryRow[]; skipped: number } {
  const matrix = parseCsv(text).filter((r) => r.some((c) => c.trim()))
  if (matrix.length === 0) return { rows: [], skipped: 0 }
  const header = matrix[0]!.map((c) => c.trim().toLowerCase())
  let idCol = header.findIndex((h) => h === 'id' || h === 'login id' || h === 'loginid')
  let pinCol = header.findIndex((h) => h === 'pin')
  let body = matrix.slice(1)
  if (idCol === -1 || pinCol === -1) {
    idCol = 0
    pinCol = 1
    body = matrix
  }
  const rows: RecoveryRow[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const r of body) {
    const loginId = cell(r[idCol])
    const pin = cell(r[pinCol])
    if (!LOGIN_ID_RE.test(loginId) || !PIN_RE.test(pin) || seen.has(loginId)) {
      skipped++
      continue
    }
    seen.add(loginId)
    rows.push({ loginId, pin })
  }
  return { rows, skipped }
}

export async function classifyRecovery(
  row: RecoveryRow,
  account: { pinHash: string; hasSealed: boolean } | undefined,
  compare: (pin: string, hash: string) => Promise<boolean>,
): Promise<RecoveryOutcome> {
  if (!account) return 'unknown'
  if (account.hasSealed) return 'already'
  return (await compare(row.pin, account.pinHash)) ? 'sealed' : 'changed'
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/portal/recover-pins.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `recoverPinsBatch` to `lib/portal/actions/logins.ts`.** Add these imports:

```ts
import bcrypt from 'bcryptjs'
import { sealPin } from '../pin-vault'
import { classifyRecovery, type RecoveryOutcome, type RecoveryRow } from '../recover-pins'
import { LOGIN_ID_RE, PIN_RE } from '../login'
```

Then add:

```ts
/**
 * Seal the PINs in one batch of the old app's id,pin file. The client sends the
 * file in batches of 25, because each row costs one bcrypt compare and a whole
 * file would outlast a serverless request. The hash is never written: the
 * update is conditional on it being unchanged since it was read.
 */
export async function recoverPinsBatch(rows: RecoveryRow[]): Promise<ActionResult<Record<RecoveryOutcome, number>>> {
  return runAction(async () => {
    const user = await requireAdmin()
    if (!pinVaultEnabled()) throw new PortalError('PIN viewing is switched off: PORTAL_PIN_KEY is not set.')
    const clean = (Array.isArray(rows) ? rows : [])
      .filter((r) => r && LOGIN_ID_RE.test(String(r.loginId)) && PIN_RE.test(String(r.pin)))
      .slice(0, 50)
    if (clean.length === 0) throw new PortalError('Nothing to recover in that batch.')
    const accounts = await prisma.account.findMany({
      where: { loginId: { in: clean.map((r) => r.loginId) } },
      select: { id: true, loginId: true, pinHash: true, pinSealed: true },
    })
    const byLogin = new Map(accounts.map((a) => [a.loginId, a]))
    const counts: Record<RecoveryOutcome, number> = { sealed: 0, already: 0, changed: 0, unknown: 0 }
    for (const r of clean) {
      const a = byLogin.get(r.loginId)
      const outcome = await classifyRecovery(r, a ? { pinHash: a.pinHash, hasSealed: !!a.pinSealed } : undefined, bcrypt.compare)
      if (outcome === 'sealed' && a) {
        const res = await prisma.account.updateMany({
          where: { id: a.id, pinHash: a.pinHash, pinSealed: null },
          data: { pinSealed: sealPin(r.pin, a.loginId) },
        })
        counts[res.count === 1 ? 'sealed' : 'changed']++
      } else counts[outcome]++
    }
    await audit(
      user,
      'login.recover',
      'portal',
      null,
      `Recovered ${counts.sealed} PIN${counts.sealed === 1 ? '' : 's'}; ${counts.changed} changed since, ${counts.already} already on file, ${counts.unknown} unknown ID${counts.unknown === 1 ? '' : 's'}`,
    )
    return counts
  })
}
```

- [ ] **Step 6: Add the recovery half to `LoginsPanel.tsx`.**
  - Update the imports:

    ```tsx
    import { exportLoginsCsv, recoverPinsBatch } from '@/lib/portal/actions/logins'
    import { parseRecoveryCsv, type RecoveryRow } from '@/lib/portal/recover-pins'
    ```

    and add `Upload` to the lucide import.
  - Inside the component, add the state and handlers:

    ```tsx
      const [rows, setRows] = useState<RecoveryRow[] | null>(null)
      const [skipped, setSkipped] = useState(0)
      const [progress, setProgress] = useState<{ done: number; sealed: number; already: number; changed: number; unknown: number } | null>(null)

      async function pickFile(file: File | undefined) {
        setError(null)
        setProgress(null)
        if (!file) return setRows(null)
        const parsed = parseRecoveryCsv(await file.text())
        setRows(parsed.rows)
        setSkipped(parsed.skipped)
      }

      function recover() {
        if (!rows?.length) return
        setError(null)
        startTransition(async () => {
          const total = { done: 0, sealed: 0, already: 0, changed: 0, unknown: 0 }
          for (let i = 0; i < rows.length; i += 25) {
            const batch = rows.slice(i, i + 25)
            const r = await recoverPinsBatch(batch)
            if (!r.ok) return setError(r.error)
            total.done += batch.length
            total.sealed += r.data!.sealed
            total.already += r.data!.already
            total.changed += r.data!.changed
            total.unknown += r.data!.unknown
            setProgress({ ...total })
          }
        })
      }
    ```

  - Render this block below the export paragraph:

    ```tsx
          <div className="mt-5 border-t border-parch-200 pt-4">
            <span className={CAPTION}>Recover the PINs people already use</span>
            <p className="mb-2 text-[12px] text-parch-700">
              Upload the old app&rsquo;s <strong>id,pin</strong> file. A PIN is kept only if it still matches the one in use, so this
              never changes anybody&rsquo;s PIN. Delete the file afterwards.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={pending || !vaultEnabled}
              onChange={(e) => void pickFile(e.target.files?.[0])}
              className="block text-[12px] text-parch-700"
              aria-label="Old app id,pin file"
            />
            {rows && (
              <p className="mt-2 text-[12px] text-parch-700">
                {rows.length} row{rows.length === 1 ? '' : 's'} ready{skipped ? ` · ${skipped} skipped (not an ID and PIN)` : ''}.
              </p>
            )}
            <button
              type="button"
              disabled={pending || !vaultEnabled || !rows?.length}
              onClick={recover}
              className={cn(buttonClass('primary'), 'mt-2 min-h-[40px]')}
            >
              <Upload className="h-4 w-4" aria-hidden /> {pending && progress ? `Working… ${progress.done}/${rows?.length ?? 0}` : `Recover ${rows?.length ?? 0} PINs`}
            </button>
            {progress && (
              <p role="status" className="mt-2 text-[12px] text-parch-800" data-testid="recover-result">
                Kept {progress.sealed} · already on file {progress.already} · changed since {progress.changed} · unknown ID {progress.unknown}
              </p>
            )}
          </div>
    ```

- [ ] **Step 7: Create `scripts/legacy-pins-csv.ts`**:

```ts
/**
 * Write the old app's IDs and PINs as a two-column CSV for Admin → Data →
 * IDs & PINs → Recover. Reads the gitignored Firebase export. It prints counts
 * and never prints a PIN; the file it writes is mode 600 and should be deleted
 * once uploaded.
 *
 *   node --import tsx scripts/legacy-pins-csv.ts <backup.json> <out.csv>
 */
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { transformBackup, type BackupJson } from '../lib/portal/import-transform'

const [file, out] = process.argv.slice(2)
if (!file || !out) {
  console.error('usage: legacy-pins-csv.ts <backup.json> <out.csv>')
  process.exit(1)
}
const result = transformBackup(JSON.parse(readFileSync(file, 'utf8')) as BackupJson)
const lines = result.accounts.filter((a) => a.loginId && a.pin).map((a) => `${a.loginId},${a.pin}`)
writeFileSync(out, `id,pin\n${lines.join('\n')}\n`, { mode: 0o600 })
chmodSync(out, 0o600)
console.log(`Wrote ${lines.length} rows to ${out} (mode 600). Delete it after the upload.`)
```

- [ ] **Step 8: Verify.** Run `npm test && npx tsc --noEmit`. Expected: pass.

- [ ] **Step 9: Checkpoint (no commit).**

---

### Task 6: Send logins (bulk reissue, email, text, print)

**Files:**
- Create: `lib/portal/login-email.ts`
- Test: `tests/portal/login-email.test.ts`
- Modify: `lib/portal/actions/logins.ts` (add `reissuePins` and `emailLogins`)
- Create: `app/portal/(app)/admin/servants/logins/page.tsx`
- Create: `app/portal/(app)/admin/servants/logins/SendLogins.tsx`
- Modify: `app/portal/(app)/admin/servants/page.tsx` (a **Send logins** button for admin)

**Interfaces:**
- Consumes: `CONFIRM_PHRASE.reissuePins`, `issuedPinFields`, `revealLogins`, `LoginShareButtons`, `onFileAccountIds`.
- Produces:
  - `emailRouting(env): { mode: 'live' } | { mode: 'redirect'; to: string } | { mode: 'off' }`
  - `buildLoginEmails(items, routing)`
  - `sendLoginEmails(payloads, apiKey)`
  - `reissuePins(accountIds, confirm): Promise<ActionResult<{ rows: { accountId: string; loginId: string; pin: string }[] }>>`
  - `emailLogins(accountIds): Promise<ActionResult<{ mode: 'live' | 'redirect'; results: { accountId: string; status: 'sent' | 'no-email' | 'not-on-file' | 'failed'; error?: string }[] }>>`

- [ ] **Step 1: Write the failing test** — `tests/portal/login-email.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emailRouting, buildLoginEmails, LOGIN_EMAIL_FROM } from '@/lib/portal/login-email'
import { LOGIN_EMAIL_SUBJECT } from '@/lib/portal/login-share'

const item = { accountId: 'a1', name: 'Mina Saad', email: 'mina@example.com', loginId: '1234', pin: '0042' }

describe('login emails', () => {
  it('sends to real addresses only from production', () => {
    expect(emailRouting({ VERCEL_ENV: 'production' })).toEqual({ mode: 'live' })
    expect(emailRouting({ VERCEL_ENV: 'preview' })).toEqual({ mode: 'off' })
    expect(emailRouting({})).toEqual({ mode: 'off' })
    expect(emailRouting({ PORTAL_EMAIL_REDIRECT: ' me@example.com ' })).toEqual({ mode: 'redirect', to: 'me@example.com' })
  })

  it('builds one message per person with only their own login', () => {
    const [m] = buildLoginEmails([item], { mode: 'live' })
    expect(m).toMatchObject({ from: LOGIN_EMAIL_FROM, to: 'mina@example.com', subject: LOGIN_EMAIL_SUBJECT })
    expect(m!.text).toContain('Hi Mina,')
    expect(m!.text).toContain('ID: 1234')
    expect(m!.text).toContain('PIN: 0042')
  })

  it('redirects every message when testing, and says who it was for', () => {
    const [m] = buildLoginEmails([item], { mode: 'redirect', to: 'me@example.com' })
    expect(m!.to).toBe('me@example.com')
    expect(m!.subject).toBe(`[TEST for mina@example.com] ${LOGIN_EMAIL_SUBJECT}`)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/portal/login-email.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/portal/login-email.ts`**:

```ts
import { Resend } from 'resend'
import { LOGIN_EMAIL_SUBJECT, loginMessage } from './login-share'

export const LOGIN_EMAIL_FROM = 'St. Kyrillos Sunday School <noreply@stkyrillostn.org>'

export interface LoginEmailItem {
  accountId: string
  name: string
  email: string
  loginId: string
  pin: string
}

export type EmailRouting = { mode: 'live' } | { mode: 'redirect'; to: string } | { mode: 'off' }

/**
 * Where login emails may go.
 *
 * Only the live site writes to real addresses. Local development and Vercel
 * previews run against the dev database, which is a copy of production and
 * holds real servants' addresses. So outside production every message goes to
 * PORTAL_EMAIL_REDIRECT, and with no redirect set nothing is sent at all.
 */
export function emailRouting(env: { VERCEL_ENV?: string; PORTAL_EMAIL_REDIRECT?: string }): EmailRouting {
  if (env.VERCEL_ENV === 'production') return { mode: 'live' }
  const to = env.PORTAL_EMAIL_REDIRECT?.trim()
  return to ? { mode: 'redirect', to } : { mode: 'off' }
}

export function buildLoginEmails(items: readonly LoginEmailItem[], routing: Exclude<EmailRouting, { mode: 'off' }>) {
  return items.map((i) => ({
    from: LOGIN_EMAIL_FROM,
    to: routing.mode === 'live' ? i.email : routing.to,
    subject: routing.mode === 'live' ? LOGIN_EMAIL_SUBJECT : `[TEST for ${i.email}] ${LOGIN_EMAIL_SUBJECT}`,
    text: `${loginMessage(i)}\n\nPlease keep this message; you will need it to sign in.\n\nSt. Kyrillos Sunday School`,
  }))
}

/** Resend's batch endpoint takes up to 100 messages and succeeds or fails as a whole. */
export async function sendLoginEmails(
  payloads: ReturnType<typeof buildLoginEmails>,
  apiKey: string,
): Promise<Array<{ ok: boolean; error?: string }>> {
  const resend = new Resend(apiKey)
  const out: Array<{ ok: boolean; error?: string }> = []
  for (let i = 0; i < payloads.length; i += 100) {
    const chunk = payloads.slice(i, i + 100)
    const { error } = await resend.batch.send(chunk)
    for (let j = 0; j < chunk.length; j++) out.push(error ? { ok: false, error: error.message } : { ok: true })
  }
  return out
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/portal/login-email.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `reissuePins` and `emailLogins` to `lib/portal/actions/logins.ts`.** Add these imports:

```ts
import { CONFIRM_PHRASE } from '../reports'   // merge with the existing reports import
import { randomPin } from '../credentials'
import { issuedPinFields } from '../pin-issue'
import { buildLoginEmails, emailRouting, sendLoginEmails } from '../login-email'
import { clearRateLimit } from '@/lib/rate-limit'
```

Then add:

```ts
/**
 * Give each of these accounts a fresh, sealed PIN, for the people with none on
 * file. It invalidates the PIN they use now, so it takes the typed phrase, and
 * it clears lockouts like every other reset.
 */
export async function reissuePins(
  accountIds: string[],
  confirm: string,
): Promise<ActionResult<{ rows: Array<{ accountId: string; loginId: string; pin: string }> }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    if ((confirm ?? '').trim() !== CONFIRM_PHRASE.reissuePins) throw new PortalError(`Type ${CONFIRM_PHRASE.reissuePins} to confirm.`)
    const ids = cleanIds(accountIds)
    if (ids.length === 0) throw new PortalError('Nobody was selected.')
    const accounts = await prisma.account.findMany({ where: { id: { in: ids } }, select: { id: true, loginId: true, displayName: true } })
    const pins = accounts.map(() => randomPin())
    const fields = await Promise.all(accounts.map((a, i) => issuedPinFields(pins[i]!, a.loginId)))
    await prisma.$transaction(
      accounts.map((a, i) =>
        prisma.account.update({ where: { id: a.id }, data: { ...fields[i]!, failedAttempts: 0, lockedUntil: null } }),
      ),
    )
    // Same reason as resetServantPin: the in-process limiter is read before the PIN.
    for (const a of accounts) clearRateLimit(`portal:${a.loginId}`)
    const named = accounts.slice(0, 20).map((a) => a.displayName).join(', ')
    await audit(
      user,
      'login.reissue',
      'portal',
      null,
      `Issued new PINs to ${accounts.length}: ${named}${accounts.length > 20 ? `, and ${accounts.length - 20} more` : ''}`,
    )
    return { rows: accounts.map((a, i) => ({ accountId: a.id, loginId: a.loginId, pin: pins[i]! })) }
  })
}

type EmailStatus = 'sent' | 'no-email' | 'not-on-file' | 'failed'

/** Email each person only their own login, from noreply@, through Resend. */
export async function emailLogins(
  accountIds: string[],
): Promise<ActionResult<{ mode: 'live' | 'redirect'; results: Array<{ accountId: string; status: EmailStatus; error?: string }> }>> {
  return runAction(async () => {
    const user = await requireAdmin()
    const routing = emailRouting(process.env)
    if (routing.mode === 'off') {
      throw new PortalError('Emails are only sent from the live site. To test here, set PORTAL_EMAIL_REDIRECT.')
    }
    const apiKey = process.env.RESEND_API_KEY2
    if (!apiKey) throw new PortalError('Email is not set up on this site (RESEND_API_KEY2 is missing).')
    const ids = cleanIds(accountIds, 200)
    if (ids.length === 0) throw new PortalError('Nobody was selected.')
    const accounts = await prisma.account.findMany({
      where: { id: { in: ids } },
      select: { id: true, loginId: true, displayName: true, email: true, pinSealed: true },
    })
    const results: Array<{ accountId: string; status: EmailStatus; error?: string }> = []
    const items: Array<{ accountId: string; name: string; email: string; loginId: string; pin: string }> = []
    for (const a of accounts) {
      const pin = openPin(a.pinSealed, a.loginId)
      if (!a.email) results.push({ accountId: a.id, status: 'no-email' })
      else if (!pin) results.push({ accountId: a.id, status: 'not-on-file' })
      else items.push({ accountId: a.id, name: a.displayName, email: a.email, loginId: a.loginId, pin })
    }
    if (items.length > 0) {
      const sent = await sendLoginEmails(buildLoginEmails(items, routing), apiKey)
      items.forEach((it, i) =>
        results.push(sent[i]!.ok ? { accountId: it.accountId, status: 'sent' } : { accountId: it.accountId, status: 'failed', error: sent[i]!.error }),
      )
    }
    const n = results.filter((r) => r.status === 'sent').length
    await audit(user, 'login.email', 'portal', null, `Emailed ${n} login${n === 1 ? '' : 's'}${routing.mode === 'redirect' ? ' (test redirect)' : ''}`)
    return { mode: routing.mode, results }
  })
}
```

- [ ] **Step 6: Create `app/portal/(app)/admin/servants/logins/page.tsx`**:

```tsx
import { notFound } from 'next/navigation'
import { Send } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader } from '@/components/portal/ui'
import { onFileAccountIds } from '@/lib/portal/data/logins'
import { pinVaultEnabled } from '@/lib/portal/pin-vault'
import { SendLogins, type Candidate } from './SendLogins'

export const metadata = { title: 'Send logins' }
// Issuing new PINs hashes each one with bcrypt; for the whole staff that is a
// few seconds of CPU, so the page's actions get room.
export const maxDuration = 60

export default async function SendLoginsPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const accounts = await prisma.account.findMany({
    where: { role: { in: ['SERVANT', 'PASTOR', 'ADMIN'] }, isActive: true },
    orderBy: { displayName: 'asc' },
    select: { id: true, displayName: true, role: true, loginId: true, email: true, phone: true, lastLoginAt: true },
  })
  const onFile = await onFileAccountIds(accounts.map((a) => a.id))
  const candidates: Candidate[] = accounts.map((a) => ({
    accountId: a.id,
    name: a.displayName,
    role: a.role as Candidate['role'],
    loginId: a.loginId,
    email: a.email,
    phone: a.phone,
    neverSignedIn: !a.lastLoginAt,
    onFile: onFile.has(a.id),
    isSelf: a.id === user.accountId,
  }))
  return (
    <>
      <PageHeader
        title="Send logins"
        icon={<Send className="h-5 w-5" aria-hidden />}
        subtitle="Give each servant their own ID and PIN by email, text, WhatsApp or a printed slip."
        back={{ href: '/portal/admin/servants', label: 'Servants' }}
      />
      <SendLogins candidates={candidates} vaultEnabled={pinVaultEnabled()} />
    </>
  )
}
```

- [ ] **Step 7: Create `app/portal/(app)/admin/servants/logins/SendLogins.tsx`**:

```tsx
'use client'

import { useMemo, useState, useTransition } from 'react'
import { KeyRound, Mail, Printer, RotateCcw } from 'lucide-react'
import { emailLogins, reissuePins, revealLogins } from '@/lib/portal/actions/logins'
import { CONFIRM_PHRASE } from '@/lib/portal/reports'
import { LOGIN_URL } from '@/lib/portal/login-share'
import { formatPhone } from '@/lib/portal/phones'
import { Badge, Callout, Card, buttonClass, checkboxClass, inputClass } from '@/components/portal/ui'
import { LoginShareButtons } from '@/components/portal/LoginShareButtons'
import { cn } from '@/lib/utils'

export interface Candidate {
  accountId: string
  name: string
  role: 'SERVANT' | 'PASTOR' | 'ADMIN'
  loginId: string
  email: string | null
  phone: string | null
  neverSignedIn: boolean
  onFile: boolean
  isSelf: boolean
}

type EmailStatus = 'sent' | 'no-email' | 'not-on-file' | 'failed'
type SheetRow = Candidate & { pin: string | null; emailStatus?: EmailStatus; emailError?: string }

const EMAIL_BADGE: Record<EmailStatus, { tone: 'good' | 'bad' | 'neutral' | 'warn'; label: string }> = {
  sent: { tone: 'good', label: 'Emailed' },
  failed: { tone: 'bad', label: 'Email failed' },
  'no-email': { tone: 'neutral', label: 'No email' },
  'not-on-file': { tone: 'warn', label: 'No PIN on file' },
}

export function SendLogins({ candidates, vaultEnabled }: { candidates: Candidate[]; vaultEnabled: boolean }) {
  const [scope, setScope] = useState<'never' | 'all'>('never')
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const [typed, setTyped] = useState('')
  const [sheet, setSheet] = useState<SheetRow[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const phrase = CONFIRM_PHRASE.reissuePins

  const inScope = useMemo(
    () => candidates.filter((c) => !c.isSelf && (scope === 'all' || c.neverSignedIn)),
    [candidates, scope],
  )
  const chosen = inScope.filter((c) => !unchecked.has(c.accountId))
  const needNew = chosen.filter((c) => !c.onFile)
  const withEmail = chosen.filter((c) => c.email).length
  const phoneOnly = chosen.filter((c) => !c.email && c.phone).length
  const neither = chosen.filter((c) => !c.email && !c.phone).length

  if (!vaultEnabled) {
    return (
      <Callout tone="bad" title="PIN viewing is switched off">
        Set PORTAL_PIN_KEY on the site first. Without it the portal cannot keep the PINs it issues, so there would be
        nothing to send.
      </Callout>
    )
  }

  function toggle(id: string) {
    setUnchecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function prepare() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const pins = new Map<string, string | null>()
      if (needNew.length > 0) {
        const r = await reissuePins(needNew.map((c) => c.accountId), typed)
        if (!r.ok) return setError(r.error)
        for (const row of r.data!.rows) pins.set(row.accountId, row.pin)
      }
      const known = chosen.filter((c) => c.onFile)
      if (known.length > 0) {
        const r = await revealLogins(known.map((c) => c.accountId))
        if (!r.ok) return setError(r.error)
        for (const row of r.data!.rows) pins.set(row.accountId, row.pin)
      }
      setSheet(chosen.map((c) => ({ ...c, onFile: true, pin: pins.get(c.accountId) ?? null })))
      setTyped('')
    })
  }

  function emailAll() {
    if (!sheet) return
    const targets = sheet.filter((r) => r.email && r.pin && r.emailStatus !== 'sent')
    if (targets.length === 0) return
    setError(null)
    startTransition(async () => {
      const r = await emailLogins(targets.map((t) => t.accountId))
      if (!r.ok) return setError(r.error)
      const by = new Map(r.data!.results.map((x) => [x.accountId, x]))
      setSheet((prev) =>
        prev!.map((row) => {
          const x = by.get(row.accountId)
          return x ? { ...row, emailStatus: x.status, emailError: x.error } : row
        }),
      )
      if (r.data!.mode === 'redirect') setNotice('Test mode: every email went to the redirect address, not to the servants.')
    })
  }

  if (sheet) {
    const emailable = sheet.filter((r) => r.email && r.pin && r.emailStatus !== 'sent').length
    return (
      <>
        <div className="print:hidden">
          <Card title={`${sheet.length} login${sheet.length === 1 ? '' : 's'} ready`} icon={<KeyRound className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending || emailable === 0} onClick={emailAll} className={cn(buttonClass('primary'), 'min-h-[40px]')}>
                <Mail className="h-4 w-4" aria-hidden /> {pending ? 'Sending…' : `Email the ${emailable} with an address`}
              </button>
              <button type="button" onClick={() => window.print()} className={cn(buttonClass('secondary'), 'min-h-[40px]')}>
                <Printer className="h-4 w-4" aria-hidden /> Print slips
              </button>
              <button type="button" onClick={() => setSheet(null)} className={cn(buttonClass('ghost'), 'min-h-[40px]')}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Start over
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-parch-500">
              Text and WhatsApp open on this device with the message typed. Press Send in the app. Each person gets only
              their own login.
            </p>
            {notice && <p role="status" className="mt-2 text-[12px] font-semibold text-[#D97706]">{notice}</p>}
            {error && <div className="mt-3" role="alert"><Callout tone="bad">{error}</Callout></div>}
          </Card>
          <div className="mt-4 space-y-2.5" data-testid="login-sheet">
            {sheet.map((r) => (
              <div key={r.accountId} className="rounded-[14px] border border-parch-200 bg-parch-50 p-3.5" data-login-row={r.loginId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-serif text-[14px] font-bold text-parch-900">{r.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.emailStatus && <Badge tone={EMAIL_BADGE[r.emailStatus].tone}>{EMAIL_BADGE[r.emailStatus].label}</Badge>}
                    {!r.email && !r.phone && <Badge tone="warn">Print a slip</Badge>}
                  </div>
                </div>
                <p className="mt-1 text-[12.5px] text-parch-700">
                  ID <strong className="font-mono tabular-nums">{r.loginId}</strong> · PIN{' '}
                  <strong className="font-mono tabular-nums text-brand-800" data-testid="sheet-pin">{r.pin ?? '—'}</strong>
                  {r.phone ? ` · ${formatPhone(r.phone)}` : ''}
                  {r.email ? ` · ${r.email}` : ''}
                </p>
                {r.emailError && <p className="mt-1 text-[11.5px] text-[#B91C1C]">{r.emailError}</p>}
                {r.pin && (
                  <div className="mt-2">
                    <LoginShareButtons name={r.name} loginId={r.loginId} pin={r.pin} email={r.email} phone={r.phone} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Print: one cut-out slip per person. */}
        <div className="hidden grid-cols-2 gap-3 print:grid">
          {sheet.map((r) => (
            <div key={r.accountId} className="break-inside-avoid rounded-[10px] border border-dashed border-parch-500 p-3">
              <p className="font-serif text-[13px] font-bold">{r.name}</p>
              <p className="mt-1 text-[12px]">ID: <strong className="font-mono">{r.loginId}</strong></p>
              <p className="text-[12px]">PIN: <strong className="font-mono">{r.pin ?? '—'}</strong></p>
              <p className="mt-1 text-[10.5px]">Sign in at {LOGIN_URL}</p>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-4">
      <Card title="Who gets their login" icon={<KeyRound className="h-4 w-4" />}>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Who">
          {(
            [
              ['never', `Never signed in (${candidates.filter((c) => !c.isSelf && c.neverSignedIn).length})`],
              ['all', `Everyone (${candidates.filter((c) => !c.isSelf).length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={scope === k}
              onClick={() => {
                setScope(k)
                setUnchecked(new Set())
              }}
              className={cn(buttonClass(scope === k ? 'primary' : 'secondary', 'sm'), 'min-h-[36px]')}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-parch-700" data-testid="send-summary">
          <strong>{chosen.length}</strong> selected · {withEmail} by email · {phoneOnly} by phone only · {neither} need a
          printed slip{needNew.length ? ` · ${needNew.length} need a new PIN` : ''}
        </p>
        <ul className="mt-3 divide-y divide-parch-200 rounded-[12px] border border-parch-200">
          {inScope.map((c) => (
            <li key={c.accountId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-semibold text-parch-900">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={!unchecked.has(c.accountId)}
                  onChange={() => toggle(c.accountId)}
                  data-account={c.loginId}
                />
                <span className="truncate">{c.name}</span>
              </label>
              <span className="text-[11px] text-parch-500">{c.email ? 'Email' : c.phone ? 'Phone' : 'No contact'}</span>
              {c.onFile ? <Badge tone="good">PIN on file</Badge> : <Badge tone="warn">Needs a new PIN</Badge>}
            </li>
          ))}
          {inScope.length === 0 && <li className="px-3 py-3 text-[12px] text-parch-500">Nobody here.</li>}
        </ul>
      </Card>

      {needNew.length > 0 && (
        <Callout tone="warn" title={`${needNew.length} will get a new PIN`}>
          {needNew.slice(0, 12).map((c) => c.name).join(', ')}
          {needNew.length > 12 ? `, and ${needNew.length - 12} more` : ''}. Their PIN is not on file, so the portal issues a new
          one, and the PIN they use now stops working. They get the new one on the next screen.
          <label className="mt-2.5 block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              Type <span className="font-mono text-[12px] normal-case tracking-normal text-[#B91C1C]">{phrase}</span> to confirm
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={cn(inputClass, 'max-w-xs font-mono')} placeholder={phrase} autoComplete="off" spellCheck={false} />
          </label>
        </Callout>
      )}

      {error && <div role="alert"><Callout tone="bad">{error}</Callout></div>}

      <button
        type="button"
        disabled={pending || chosen.length === 0 || (needNew.length > 0 && typed.trim() !== phrase)}
        onClick={prepare}
        className={cn(buttonClass('primary'), 'min-h-[44px]')}
      >
        <KeyRound className="h-4 w-4" aria-hidden /> {pending ? 'Getting logins…' : `Get ${chosen.length} login${chosen.length === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Link to the page.** In `app/portal/(app)/admin/servants/page.tsx`, inside the admin-only header actions, add this next to the existing `LinkButton`s:

```tsx
                <LinkButton href="/portal/admin/servants/logins" variant="secondary">
                  Send logins
                </LinkButton>
```

- [ ] **Step 9: Verify.** Run `npm test && npx tsc --noEmit && npm run lint`. Expected: pass.

- [ ] **Step 10: Checkpoint (no commit).**

---

### Task 7: The class logins page shows current PINs without resetting

**Files:**
- Modify: `app/portal/(app)/classes/[id]/credentials/page.tsx`
- Modify: `app/portal/(app)/classes/[id]/credentials/ClassCredentials.tsx`

**Interfaces:**
- Consumes: `revealLogins`, `reissuePins`, `onFileAccountIds`, `pinVaultEnabled`, `CONFIRM_PHRASE.reissuePins`.

- [ ] **Step 1: The page passes the roster.** In `page.tsx`, replace the `studentCount` query with:

```tsx
  const roster = await prisma.student.findMany({
    where: { classId: cls.id },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, account: { select: { id: true, loginId: true } } },
  })
  const onFile = await onFileAccountIds(roster.map((s) => s.account.id))
  const students = roster.map((s) => ({
    studentId: s.id,
    accountId: s.account.id,
    name: `${s.firstName} ${s.lastName}`.trim(),
    loginId: s.account.loginId,
    onFile: onFile.has(s.account.id),
  }))
  const studentCount = students.length
```

Render `<ClassCredentials classId={cls.id} className={cls.name} studentCount={studentCount} students={students} vaultEnabled={pinVaultEnabled()} />`. Import `onFileAccountIds` and `pinVaultEnabled`.

- [ ] **Step 2: Show current logins above the existing reset card.** In `ClassCredentials.tsx`:
  - Extend the props with `students: ClassLogin[]` and `vaultEnabled: boolean`, where:

    ```tsx
    export interface ClassLogin { studentId: string; accountId: string; name: string; loginId: string; onFile: boolean }
    ```

  - Add a `CurrentLogins` component. It renders:
    - **Before Show:** a Card "Current logins" with "N of M have a PIN on file" and a **Show current logins** button. The button calls `revealLogins(onFileIds)`.
    - **After Show:** a table (Student / ID / PIN / Given to), with "Not on file" in the PIN cell for the rest, plus **Print this sheet**.
    - **When some aren't on file:** a typed-confirm block, "Give new PINs to the N not on file". It calls `reissuePins(missingIds, typed)` and merges the returned PINs into the table.
  - The component returns the existing results markup unchanged when `rows` (the full-reset result) is set.
  - Otherwise it renders `<CurrentLogins … />`, then the existing reset card with `print:hidden` added to its className.

```tsx
function CurrentLogins({ students, vaultEnabled }: { students: ClassLogin[]; vaultEnabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [pins, setPins] = useState<Map<string, string | null> | null>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const phrase = CONFIRM_PHRASE.reissuePins
  const onFileCount = students.filter((s) => s.onFile).length
  const missing = pins ? students.filter((s) => !pins.get(s.accountId)) : []

  function show() {
    setError('')
    startTransition(async () => {
      const ids = students.filter((s) => s.onFile).map((s) => s.accountId)
      const next = new Map<string, string | null>(students.map((s) => [s.accountId, null]))
      if (ids.length > 0) {
        const r = await revealLogins(ids)
        if (!r.ok) return setError(r.error)
        for (const row of r.data!.rows) next.set(row.accountId, row.pin)
      }
      setPins(next)
    })
  }

  function reissueMissing() {
    setError('')
    startTransition(async () => {
      const r = await reissuePins(missing.map((s) => s.accountId), typed)
      if (!r.ok) return setError(r.error)
      setPins((prev) => {
        const next = new Map(prev ?? [])
        for (const row of r.data!.rows) next.set(row.accountId, row.pin)
        return next
      })
      setTyped('')
    })
  }

  if (!pins) {
    return (
      <Card title="Current logins" icon={<KeyRound className="h-4 w-4" aria-hidden />} className="mb-4 print:hidden">
        <p className="text-[12.5px] text-parch-700">
          {onFileCount} of {students.length} have a PIN on file. Showing them changes nothing, and it is written to the activity log.
        </p>
        {!vaultEnabled && <p className="mt-1 text-[11.5px] text-parch-500">PIN viewing is switched off on this site (PORTAL_PIN_KEY is not set).</p>}
        <button type="button" disabled={pending || !vaultEnabled} onClick={show} className={cn(buttonClass('primary'), 'mt-3 min-h-[40px]')}>
          {pending ? 'Opening…' : 'Show current logins'}
        </button>
        {error && <div className="mt-3" role="alert"><Callout tone="bad">{error}</Callout></div>}
      </Card>
    )
  }

  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={buttonClass('primary')}>
          <Printer className="h-4 w-4" aria-hidden /> Print this sheet
        </button>
      </div>
      <Card bodyClassName="p-0">
        <table className="w-full text-[12.5px]" data-testid="current-logins">
          <thead>
            <tr className="border-b border-parch-200 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5 text-right">ID</th>
              <th className="px-4 py-2.5 text-right">PIN</th>
              <th className="w-[40%] px-4 py-2.5">Given to</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const pin = pins.get(s.accountId)
              return (
                <tr key={s.accountId} className="border-b border-[#F5F2ED]">
                  <td className="px-4 py-2 font-semibold text-parch-900">{s.name}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{s.loginId}</td>
                  <td className="px-4 py-2 text-right font-mono text-[14px] font-bold tabular-nums text-brand-800">
                    {pin ?? <span className="text-[11px] font-semibold text-parch-500">Not on file</span>}
                  </td>
                  <td className="px-4 py-2 text-parch-300">&nbsp;</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      {missing.length > 0 && (
        <div className="mt-3 print:hidden">
          <Callout tone="warn" title={`${missing.length} without a PIN on file`}>
            Give them a new PIN to complete the sheet. The PIN they use now stops working.
            <label className="mt-2.5 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
                Type <span className="font-mono text-[12px] normal-case tracking-normal text-[#B91C1C]">{phrase}</span> to confirm
              </span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className={cn(inputClass, 'max-w-xs font-mono')} placeholder={phrase} autoComplete="off" spellCheck={false} />
            </label>
            <button type="button" disabled={pending || typed.trim() !== phrase} onClick={reissueMissing} className={cn(buttonClass('danger'), 'mt-2.5 min-h-[40px]')}>
              {pending ? 'Issuing…' : `Give ${missing.length} new PIN${missing.length === 1 ? '' : 's'}`}
            </button>
          </Callout>
        </div>
      )}
      {error && <div className="mt-3" role="alert"><Callout tone="bad">{error}</Callout></div>}
    </div>
  )
}
```

  Add these imports: `revealLogins` and `reissuePins` from `@/lib/portal/actions/logins`.

- [ ] **Step 3: Verify.** Run `npm test && npx tsc --noEmit && npm run lint`. Expected: pass.

- [ ] **Step 4: Checkpoint (no commit).**

---

### Task 8: End-to-end verification on the dev branch

**Files:**
- Modify: `scripts/portal-smoke.mjs` (route checks)
- Create (scratchpad, not committed): `e2e-logins.mjs`

- [ ] **Step 1: Smoke routes.** Add `/portal/admin/servants/logins` to `ROUTES.admin.ok`, and to the `gone` lists of pastor, servant and student.

- [ ] **Step 2: Static checks.** Run `npm test && npx tsc --noEmit && npm run lint`.

- [ ] **Step 3: Build check.** Make sure no dev server is running, then run `npm run build`. Expected: the build succeeds. **Never run this while `next dev` is up.**

- [ ] **Step 4: Start the dev server on a clean port.**

  ```bash
  lsof -ti :3000 | xargs kill -9
  npm run dev
  ```

  Wait for the first compile.

- [ ] **Step 5:** Run `npm run smoke` and `npm run smoke:write`. Expected: all pass, including the new route checks.

- [ ] **Step 6: Run the scratchpad E2E** (playwright-core with local Chrome, signing in with the backup's admin credentials, which are never printed). It checks:
  1. **Create:** create servant `ZZSMOKE Logins` (phone 6155550100, email zzsmoke@example.com). The Account-created card shows the PIN and Copy / Text / WhatsApp / Email.
  2. **Show:** open the servant page and click Show PIN. It must equal the created PIN.
  3. **Reissue:** click Reissue, then reload and Show. It must equal the new PIN. Signing in as ZZSMOKE with that PIN in a fresh context must succeed.
  4. **Self-set PIN:** as ZZSMOKE, change the PIN on My PIN. Back as admin, the card says "Not on file".
  5. **Send logins:** choose Everyone, keep only ZZSMOKE, type `RESET PINS`, and press Get 1 login. The sheet shows a PIN, and signing in with it succeeds. **Email** must return the "only sent from the live site" error.
  6. **Export:** the servants export contains the ZZSMOKE row with `="<pin>"`.
  7. **Recover:** run `node --import tsx scripts/legacy-pins-csv.ts _incoming/sunday-school/data/stkyrillos_full_backup_2026-09-18.json <scratchpad>/legacy.csv`, upload it on Admin → Data, and wait for the result. Expect `Kept` > 300, with anything drifted on dev under "changed since". Then Show PIN on the smoke servant's page, which must equal the backup's PIN.
  8. **Class sheet:** on the smoke servant's class, open Logins & PINs and click Show current logins. The table has PINs for recovered students.
  9. **Cleanup:** delete ZZSMOKE. Delete the scratchpad `legacy.csv`.

- [ ] **Step 7: Stop the dev server.** Report the results faithfully, including anything that failed.

## Self-review against the spec

The table maps each part of the spec to the task that builds it.

| Spec item | Task |
|---|---|
| Storage: column, vault, key, switched off without a key | 1, 2 |
| One helper for every write; the guard test; `changeOwnPin` wipes | 2 |
| Recovery with the bcrypt-match rule, in batches | 5 |
| Servant and student Sign-in card, reveal logged, share buttons, dead helper wired | 3 |
| Class logins without a reset | 7 |
| Exports (two files, the Note column, leading zeros kept) | 4 |
| Send logins (never signed in by default, reissue with typed confirm, email / text / WhatsApp / print, per-row status) | 6 |
| Admin-only and audited | every action in `logins.ts` uses `requireAdmin` + `audit`; resets keep theirs |
| Backup stays free of PIN fields | 2 (test) |
| Rollout: key on Vercel, deploy, recover, send | the user's action after review |
