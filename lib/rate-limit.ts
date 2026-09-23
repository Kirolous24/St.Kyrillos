const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
/** Keys come from user input, so cap them before they become Map entries. */
const MAX_KEY_LEN = 128
/** Expired entries are swept once the Map is bigger than this. */
const SWEEP_AT = 500

function sweep(now: number) {
  attempts.forEach((record, key) => {
    if (now > record.resetAt) attempts.delete(key)
  })
}

/** True once `identifier` has spent its budget. Pure: it never consumes one. */
export function isRateLimited(identifier: string): boolean {
  const record = attempts.get(identifier.slice(0, MAX_KEY_LEN))
  if (!record || Date.now() > record.resetAt) return false
  return record.count >= MAX_ATTEMPTS
}

/**
 * Spend one unit of budget. Call this ONLY after a credential check has
 * actually failed — counting the attempt itself would refuse the sixth
 * sign-in of any window even when the PIN is correct.
 */
export function recordFailedAttempt(identifier: string): void {
  const key = identifier.slice(0, MAX_KEY_LEN)
  const now = Date.now()
  const record = attempts.get(key)
  if (!record || now > record.resetAt) {
    if (attempts.size > SWEEP_AT) sweep(now)
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  record.count++
}

/**
 * Release the budget. A successful sign-in calls this, and so does an admin
 * PIN reset — otherwise the reset cannot help, because a locked-out caller
 * never reaches the success path that would clear the counter.
 */
export function clearRateLimit(identifier: string): void {
  attempts.delete(identifier.slice(0, MAX_KEY_LEN))
}

/**
 * Check-and-consume in one call. Correct for endpoints where every request
 * costs budget; NOT for sign-in, which must only charge failures — use
 * `isRateLimited` + `recordFailedAttempt` + `clearRateLimit` there.
 */
export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const key = identifier.slice(0, MAX_KEY_LEN)
  const now = Date.now()
  const record = attempts.get(key)

  if (!record || now > record.resetAt) {
    if (attempts.size > SWEEP_AT) sweep(now)
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count }
}
