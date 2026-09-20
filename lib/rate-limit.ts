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
