import bcrypt from 'bcryptjs'
import { sealPin } from './pin-vault'
import { MEMBER_NO_LOGIN_HASH } from './fellowship'

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

/**
 * `pinIssuedAt` marks when the portal handed out this PIN: a login email sent
 * before it carries an older PIN and no longer counts (lib/portal/login-email-status).
 */
export type PinFields = { pinHash: string; pinSealed: string | null; pinIssuedAt: Date }

/** bcrypt on its own, so a batch can hash in parallel before its login IDs are known. */
export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

/** issuedPinFields for a PIN whose hash was made earlier with hashPin. */
export function issuedPinFieldsFromHash(pin: string, pinHash: string, loginId: string): PinFields {
  return { pinHash, pinSealed: sealPin(pin, loginId), pinIssuedAt: new Date() }
}

export async function issuedPinFields(pin: string, loginId: string): Promise<PinFields> {
  return issuedPinFieldsFromHash(pin, await hashPin(pin), loginId)
}

export async function selfSetPinFields(pin: string): Promise<{ pinHash: string; pinSealed: null }> {
  return { pinHash: await hashPin(pin), pinSealed: null }
}

/**
 * A Fellowship member who does not serve (2026-10-24): an account that never
 * signs in. Its hash is not a bcrypt hash, so no PIN matches it, and there is
 * no PIN to keep a copy of.
 */
export function noSignInPinFields(): { pinHash: string; pinSealed: null } {
  return { pinHash: MEMBER_NO_LOGIN_HASH, pinSealed: null }
}
