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

/** The production Neon endpoint (also named in scripts/portal-write-smoke.mjs). */
const PRODUCTION_DB = 'ep-dark-term-ai3c2hag'

/**
 * Where login emails may go.
 *
 * Only the live site writes to real addresses. Local development and Vercel
 * previews run against the dev database, which is a copy of production and
 * holds real servants' addresses. So outside production every message goes to
 * PORTAL_EMAIL_REDIRECT, and with no redirect set nothing is sent at all.
 *
 * "Live" is VERCEL_ENV=production, or being connected to the production
 * database. The second is the safety line that matters, since real addresses
 * only exist there, and it holds even if a project does not expose Vercel's
 * system variables at runtime.
 */
export function emailRouting(env: { VERCEL_ENV?: string; DATABASE_URL?: string; PORTAL_EMAIL_REDIRECT?: string }): EmailRouting {
  if (env.VERCEL_ENV === 'production' || (env.DATABASE_URL ?? '').includes(PRODUCTION_DB)) return { mode: 'live' }
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

/**
 * The Resend key, looked up the way the Resend library itself does.
 *
 * The membership form passes RESEND_API_KEY2, and when that is empty the
 * library falls back to RESEND_API_KEY. The live site's key is stored under
 * that second name, so the website's emails worked through the fallback while
 * a check for RESEND_API_KEY2 alone refused to send (found 2026-09-26).
 */
export function resendApiKey(env: { RESEND_API_KEY2?: string; RESEND_API_KEY?: string }): string | null {
  return env.RESEND_API_KEY2?.trim() || env.RESEND_API_KEY?.trim() || null
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
