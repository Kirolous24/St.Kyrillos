import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * A PIN reset has to let the person straight back in.
 *
 * `lib/auth.ts` asks the in-process limiter whether this login ID has spent its
 * budget BEFORE it ever compares a PIN. So clearing the database lockout
 * (`failedAttempts: 0`, `lockedUntil: null`) is only half of a reset: without
 * also clearing the limiter, a child who had just used up five tries could not
 * sign in with the PIN their servant had only now handed them, for up to
 * fifteen more minutes — and the message they got was "that ID and PIN do not
 * match", which reads as the servant having misread it.
 *
 * `resetServantPin` had always done both. `resetStudentPin` and
 * `resetClassPins` cleared only the database, which is the path a child takes
 * every week. On Vercel the limiter's Map is per-instance, so the failure was
 * intermittent — worse than a reliable one, because it looked like human error.
 *
 * This reads the source rather than the behaviour: the ordering lives inside
 * NextAuth's `authorize`, and the resets are server actions over Prisma. The
 * invariant is what matters and it is cheap to hold.
 */

const ACTIONS_DIR = path.resolve(__dirname, '../../lib/portal/actions')
const AUTH = path.resolve(__dirname, '../../lib/auth.ts')

/** Split a module into `export async function` chunks, keyed by name. */
function exportedFunctions(source: string): Map<string, string> {
  const out = new Map<string, string>()
  const parts = source.split(/export async function /).slice(1)
  for (const part of parts) {
    const name = part.slice(0, part.indexOf('('))
    out.set(name, part)
  }
  return out
}

/** Every exported action that clears a DB lockout, across every actions module. */
function lockoutClearingActions(): { file: string; name: string; body: string }[] {
  const found: { file: string; name: string; body: string }[] = []
  for (const file of readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(path.join(ACTIONS_DIR, file), 'utf8')
    // Array.from: iterating a Map directly needs downlevelIteration, which this
    // tsconfig does not set.
    for (const [name, body] of Array.from(exportedFunctions(source))) {
      if (body.includes('failedAttempts: 0') || body.includes('lockedUntil: null')) {
        found.push({ file, name, body })
      }
    }
  }
  return found
}

describe('a PIN reset also lifts the lockout', () => {
  // Guard against a vacuous pass: a scan that matches nothing reads exactly
  // like a scan that matched everything and was happy.
  it('finds the reset actions at all', () => {
    const names = lockoutClearingActions().map((a) => a.name)
    expect(names).toContain('resetStudentPin')
    expect(names).toContain('resetServantPin')
    expect(names).toContain('resetClassPins')
  })

  it.each(lockoutClearingActions().map((a) => [`${a.file} → ${a.name}`, a] as const))(
    'clears the in-process limiter too: %s',
    (_label, action) => {
      expect(
        action.body.includes('clearRateLimit'),
        `${action.name} clears the database lockout but not the in-process limiter, ` +
          `so the new PIN is refused before it is ever checked. Add ` +
          `clearRateLimit(\`portal:\${loginId}\`).`,
      ).toBe(true)
    },
  )

  it('keys the limiter the same way the sign-in does', () => {
    // A reset that clears `pin:1234` while sign-in reads `portal:1234` would
    // pass the check above and still leave the person locked out.
    const auth = readFileSync(AUTH, 'utf8')
    expect(auth).toContain('`portal:${loginId}`')
    for (const action of lockoutClearingActions()) {
      expect(action.body, `${action.name} uses a different limiter key prefix`).toMatch(
        /clearRateLimit\(`portal:\$\{/,
      )
    }
  })

  it('still consults the limiter before the PIN, which is why the above matters', () => {
    const auth = readFileSync(AUTH, 'utf8')
    // Comments first: the line above the limiter check explains what
    // `attemptLogin` is for, so scanning raw source found that word before the
    // call it was looking for and this test failed on correct code. Match call
    // syntax on comment-free source, never a bare identifier.
    const code = readFileSync(AUTH, 'utf8').replace(/\/\/[^\n]*/g, '')
    const portalProvider = code.slice(code.indexOf("id: 'portal'"))
    const limiterAt = portalProvider.indexOf('isRateLimited(')
    const attemptAt = portalProvider.indexOf('attemptLogin(')
    expect(auth.length).toBeGreaterThan(0)
    expect(limiterAt).toBeGreaterThan(-1)
    expect(attemptAt).toBeGreaterThan(-1)
    expect(
      limiterAt < attemptAt,
      'the limiter is no longer read before the PIN — re-check whether resets still need to clear it',
    ).toBe(true)
  })
})
