import { isForeignKeyViolation } from '@/lib/prisma-errors'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export function fail(error: string): ActionResult<never> {
  return { ok: false, error }
}

export class PortalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PortalError'
  }
}

/** Wrap a server action body so permission and validation errors surface as messages, not 500s. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err) {
    if (err instanceof PortalError) return { ok: false, error: err.message }
    // Next.js redirect()/notFound() throw and must propagate.
    if (typeof err === 'object' && err !== null && 'digest' in err) throw err
    console.error('Portal action failed:', err)
    // A row somewhere else still points at what this action tried to delete.
    // Without this the admin only ever sees "Something went wrong".
    if (isForeignKeyViolation(err)) {
      return { ok: false, error: 'Other records still point to this, so it cannot be deleted yet.' }
    }
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
