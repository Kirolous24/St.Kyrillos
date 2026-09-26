import { LOGIN_EMAIL_SUBJECT } from './login-share'

/**
 * Who has been emailed their login, asked of Resend itself.
 *
 * The portal used to keep only a count ("Emailed 48 logins"), so Send logins
 * could not say who already had theirs. Resend keeps every message and what
 * became of it, bounces included, which a column of our own could not. So the
 * answer comes from Resend's list, matched to each account's current address
 * and counted only if it went out after that account's PIN was issued. An
 * email carrying a PIN that has since been reissued does not count.
 */

export interface SentLoginEmail {
  to: string[]
  createdAt: Date
  /** Resend's last_event: delivered, sent, bounced, complained, … */
  lastEvent: string
}

export type LoginEmailState = { state: 'emailed'; at: Date } | { state: 'bounced'; at: Date } | { state: 'none' }

const FAILED = new Set(['bounced', 'failed', 'complained', 'canceled'])

/** Resend returns "2026-09-26 22:20:44.996+00", which Date does not reliably parse. */
export function parseResendTime(raw: string): Date | null {
  const iso = String(raw)
    .trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function loginEmailStates(
  accounts: readonly { id: string; email: string | null; pinIssuedAt: Date | null }[],
  sent: readonly SentLoginEmail[],
): Map<string, LoginEmailState> {
  const byAddress = new Map<string, SentLoginEmail[]>()
  for (const m of sent) {
    for (const to of m.to) {
      const key = to.trim().toLowerCase()
      byAddress.set(key, [...(byAddress.get(key) ?? []), m])
    }
  }
  const out = new Map<string, LoginEmailState>()
  for (const a of accounts) {
    const email = a.email?.trim().toLowerCase()
    const issued = a.pinIssuedAt?.getTime() ?? -Infinity
    const latest = (email ? byAddress.get(email) ?? [] : [])
      .filter((m) => m.createdAt.getTime() > issued)
      .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0]
    if (!latest) out.set(a.id, { state: 'none' })
    else out.set(a.id, FAILED.has(latest.lastEvent) ? { state: 'bounced', at: latest.createdAt } : { state: 'emailed', at: latest.createdAt })
  }
  return out
}

/** Every login email Resend holds, newest first, a page of 100 at a time. */
export async function fetchSentLoginEmails(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<SentLoginEmail[]> {
  const out: SentLoginEmail[] = []
  let after: string | null = null
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://api.resend.com/emails')
    url.searchParams.set('limit', '100')
    if (after) url.searchParams.set('after', after)
    const res = await fetchImpl(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' })
    if (!res.ok) throw new Error(`Resend answered ${res.status}`)
    const body = (await res.json()) as { has_more?: boolean; data?: Array<Record<string, unknown>> }
    const data = body.data ?? []
    for (const e of data) {
      // Exactly the login subject: a test send carries "[TEST for …]" in front.
      if (e.subject !== LOGIN_EMAIL_SUBJECT) continue
      const createdAt = parseResendTime(String(e.created_at))
      if (!createdAt || !Array.isArray(e.to)) continue
      out.push({ to: e.to.map(String), createdAt, lastEvent: String(e.last_event ?? '') })
    }
    if (!body.has_more || data.length === 0) break
    after = String(data[data.length - 1]!.id)
  }
  return out
}
