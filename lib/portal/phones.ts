/** Digits only; a leading US country code is dropped so 10-digit numbers compare equal. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D+/g, '')
  if (!digits) return null
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return ''
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits
}

/**
 * A WhatsApp deep link for a stored phone number, ported from the prototype's
 * `waLink` (OG L16751). Numbers here are entered by servants and stored without
 * a country code, but wa.me needs the international form — so a bare 10-digit
 * US number gets a 1 prepended. Anything already longer is assumed qualified
 * and passed through.
 */
export function waLink(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/\D+/g, '')
  if (!digits) return null
  if (digits.length === 10) digits = `1${digits}`
  return `https://wa.me/${digits}`
}

