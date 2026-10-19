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


export interface KidPhone {
  /** Father, Mother, Parents (one number they share) or Student. */
  label: 'Father' | 'Mother' | 'Parents' | 'Student'
  digits: string
  display: string
  tel: string
}

/**
 * A child's numbers for the cards a servant sees (2026-10-19): the family's
 * first, as the servant usually rings a parent, then the child's own. A number
 * the parents share is shown once, and the child's own is left out when it is
 * one of theirs.
 */
export function kidPhoneList(s: {
  fatherPhone?: string | null
  motherPhone?: string | null
  ownPhone?: string | null
}): KidPhone[] {
  const father = normalizePhone(s.fatherPhone)
  const mother = normalizePhone(s.motherPhone)
  const own = normalizePhone(s.ownPhone)
  const out: Array<{ label: KidPhone['label']; digits: string }> = []
  if (father && father === mother) out.push({ label: 'Parents', digits: father })
  else {
    if (father) out.push({ label: 'Father', digits: father })
    if (mother) out.push({ label: 'Mother', digits: mother })
  }
  if (own && own !== father && own !== mother) out.push({ label: 'Student', digits: own })
  return out.map((p) => ({ ...p, display: formatPhone(p.digits), tel: `tel:${p.digits}` }))
}
