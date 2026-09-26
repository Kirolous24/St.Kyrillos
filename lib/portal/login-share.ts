import { SITE_URL } from '@/lib/constants'
import { waLink } from './phones'

/**
 * What a person receives with their login, and the links that deliver it from
 * the admin's own phone or mail app. Pure, so it is shared by the Sign-in card,
 * Send logins and the login emails.
 */

export const LOGIN_URL = `${SITE_URL}/portal/login`
export const LOGIN_EMAIL_SUBJECT = 'Your St. Kyrillos Sunday School portal login'

export function loginMessage(input: { name: string; loginId: string; pin: string }): string {
  const first = input.name.trim().split(/\s+/)[0] || 'there'
  return [
    `Hi ${first}, here is your St. Kyrillos Sunday School portal login.`,
    `ID: ${input.loginId}`,
    `PIN: ${input.pin}`,
    `Sign in at ${LOGIN_URL}`,
  ].join('\n')
}

/** Opens Messages with the text typed. `?&body=` is the form both iOS and Android accept. */
export function smsHref(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D+/g, '')
  if (!digits) return null
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`
  return `sms:${e164}?&body=${encodeURIComponent(text)}`
}

export function whatsappHref(phone: string | null | undefined, text: string): string | null {
  const base = waLink(phone)
  return base ? `${base}?text=${encodeURIComponent(text)}` : null
}

export function mailtoHref(email: string | null | undefined, text: string): string | null {
  if (!email) return null
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(LOGIN_EMAIL_SUBJECT)}&body=${encodeURIComponent(text)}`
}
