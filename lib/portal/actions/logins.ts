'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '../session'
import { runAction, PortalError, type ActionResult } from '../action-result'
import { audit } from '../audit'
import { openPin, pinVaultEnabled, sealPin } from '../pin-vault'
import { classifyRecovery, type RecoveryOutcome, type RecoveryRow } from '../recover-pins'
import { LOGIN_ID_RE, PIN_RE } from '../login'
import { CONFIRM_PHRASE, reportFilename } from '../reports'
import { randomPin } from '../credentials'
import { issuedPinFields } from '../pin-issue'
import { buildLoginEmails, emailRouting, resendApiKey, sendLoginEmails } from '../login-email'
import { clearRateLimit } from '@/lib/rate-limit'
import { formatDateOnly } from '../dates'
import { ROLE_LABEL } from '../format'
import { loginsCsv, type LoginRow } from '../logins-csv'
import type { PortalUser } from '../permissions'

// Every action here reads or changes somebody's login (option B, 2026-09-26),
// so every one is admin-only on the server and writes the activity log.
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

/** Read back the PINs on file for these accounts. A PIN not on file comes back null. */
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

/**
 * Every servant's or every child's ID and PIN as a spreadsheet. A PIN that is
 * not on file is left blank with a note saying how to fill it.
 */
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

/**
 * Seal the PINs in one batch of the old app's id,pin file. The client sends the
 * file in batches of 25, because each row costs one bcrypt compare and a whole
 * file would outlast a serverless request. The hash is never written, and the
 * update only lands if the hash is still the one that was compared, so a PIN
 * changed in the meantime is counted as changed rather than sealed wrongly.
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
      const outcome = await classifyRecovery(
        r,
        a ? { pinHash: a.pinHash, hasSealed: !!a.pinSealed } : undefined, // pin-guard: not a write
        (pin, hash) => bcrypt.compare(pin, hash),
      )
      if (outcome === 'sealed' && a) {
        const res = await prisma.account.updateMany({
          where: { id: a.id, pinHash: a.pinHash, pinSealed: null }, // pin-guard: not a write
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
    const routing = emailRouting({
      VERCEL_ENV: process.env.VERCEL_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      PORTAL_EMAIL_REDIRECT: process.env.PORTAL_EMAIL_REDIRECT,
    })
    if (routing.mode === 'off') {
      throw new PortalError('Emails are only sent from the live site. To test here, set PORTAL_EMAIL_REDIRECT.')
    }
    const apiKey = resendApiKey({ RESEND_API_KEY2: process.env.RESEND_API_KEY2, RESEND_API_KEY: process.env.RESEND_API_KEY })
    if (!apiKey) throw new PortalError('Email is not set up on this site (no RESEND_API_KEY or RESEND_API_KEY2).')
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
        results.push(
          sent[i]!.ok ? { accountId: it.accountId, status: 'sent' } : { accountId: it.accountId, status: 'failed', error: sent[i]!.error },
        ),
      )
    }
    const n = results.filter((r) => r.status === 'sent').length
    await audit(user, 'login.email', 'portal', null, `Emailed ${n} login${n === 1 ? '' : 's'}${routing.mode === 'redirect' ? ' (test redirect)' : ''}`)
    return { mode: routing.mode, results }
  })
}
