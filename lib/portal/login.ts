// Pure sign-in policy for the ID + PIN login. The DB is behind `LoginRepo` so
// this can be unit-tested and so the lockout counter lives server-side, not in
// the browser like the prototype.

export type LoginRole = 'STUDENT' | 'SERVANT' | 'ADMIN' | 'PASTOR'

export interface LoginAccount {
  id: string
  loginId: string
  pinHash: string
  role: LoginRole
  displayName: string
  isActive: boolean
  failedAttempts: number
  lockedUntil: Date | null
  lastLoginAt: Date | null
}

export interface LoginRepo {
  findByLoginId(loginId: string): Promise<LoginAccount | null>
  /**
   * Atomically add one to the failure counter and return the stored value
   * afterwards. Must not be a read-modify-write of a row read earlier —
   * concurrent guesses all verify against the same snapshot, so a counter
   * computed in JS would stay at 1 no matter how many land at once.
   */
  bumpFailure(id: string): Promise<number>
  lockAccount(id: string, until: Date): Promise<void>
  recordSuccess(id: string, at: Date): Promise<void>
}

export interface LoginDeps {
  now?: Date
  verify: (pin: string, hash: string) => Promise<boolean>
}

export type LoginResult =
  | { ok: true; account: LoginAccount }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; until: Date }

export const LOCKOUT = {
  maxAttempts: 5,
  lockMs: 15 * 60 * 1000,
} as const

export const LOGIN_ID_RE = /^\d{4}$/
export const PIN_RE = /^\d{4,8}$/

export async function attemptLogin(
  repo: LoginRepo,
  input: { loginId: string; pin: string },
  deps: LoginDeps,
): Promise<LoginResult> {
  const now = deps.now ?? new Date()
  const loginId = (input.loginId ?? '').trim()
  const pin = (input.pin ?? '').trim()
  if (!LOGIN_ID_RE.test(loginId) || !PIN_RE.test(pin)) return { ok: false, reason: 'invalid' }

  const account = await repo.findByLoginId(loginId)
  if (!account || !account.isActive) return { ok: false, reason: 'invalid' }

  if (account.lockedUntil && account.lockedUntil.getTime() > now.getTime()) {
    return { ok: false, reason: 'locked', until: account.lockedUntil }
  }

  const valid = await deps.verify(pin, account.pinHash)
  if (!valid) {
    const failedAttempts = await repo.bumpFailure(account.id)
    if (failedAttempts >= LOCKOUT.maxAttempts) {
      await repo.lockAccount(account.id, new Date(now.getTime() + LOCKOUT.lockMs))
    }
    return { ok: false, reason: 'invalid' }
  }

  await repo.recordSuccess(account.id, now)
  return { ok: true, account: { ...account, failedAttempts: 0, lockedUntil: null, lastLoginAt: now } }
}

/** Where a signed-out visitor is sent to authenticate. */
export const PORTAL_LOGIN_PATH = '/portal/login'

/**
 * Validate a post-sign-in destination taken from the URL.
 *
 * A child who scans the projected group code while signed out has to be
 * returned to that code after authenticating — the middleware used to drop the
 * path, so they landed on the dashboard and the code (five-minute expiry) was
 * gone. Carrying the destination in the URL means it is attacker-controlled,
 * so only a relative path inside /portal is ever accepted: no absolute URLs,
 * no protocol-relative `//host`, no backslash tricks, and never the login page
 * itself, which would loop.
 *
 * Returns null when there is nothing safe to use; callers fall back to /portal.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value.startsWith('/')) return null
  // `//host` is protocol-relative and `/\host` is treated as such by browsers.
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.includes('\\')) return null
  const path = value.split(/[?#]/)[0]!
  if (path !== '/portal' && !path.startsWith('/portal/')) return null
  if (path === PORTAL_LOGIN_PATH) return null
  return value
}

