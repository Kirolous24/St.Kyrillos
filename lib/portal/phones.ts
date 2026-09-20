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
