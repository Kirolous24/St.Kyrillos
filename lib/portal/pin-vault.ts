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
