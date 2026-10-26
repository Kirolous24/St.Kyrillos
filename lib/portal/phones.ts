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

/** Whose number a servant reaches first about a child (Student.callFirst). */
export type CallFirst = 'MOTHER' | 'FATHER' | 'STUDENT'

/** The choices on the child's edit form; '' is the church's default, the mother's. */
export const CALL_FIRST_OPTIONS: ReadonlyArray<{ value: CallFirst | ''; label: string }> = [
  { value: '', label: 'Mother (the usual)' },
  { value: 'FATHER', label: 'Father' },
  { value: 'STUDENT', label: 'The child’s own phone' },
]

const CHOSEN: Record<CallFirst, ReadonlyArray<KidPhone['label']>> = {
  MOTHER: ['Mother', 'Parents'],
  FATHER: ['Father', 'Parents'],
  STUDENT: ['Student'],
}

/**
 * A child's numbers for the cards a servant sees (2026-10-19): the family's
 * first, as the servant usually rings a parent, then the child's own. A number
 * the parents share is shown once, and the child's own is left out when it is
 * one of theirs.
 *
 * The mother's comes first (2026-10-25: "Moms and not dads"), unless a servant
 * chose another number for this child. The first entry is the one the Call and
 * WhatsApp buttons use.
 */
export function kidPhoneList(s: {
  fatherPhone?: string | null
  motherPhone?: string | null
  ownPhone?: string | null
  callFirst?: CallFirst | null
}): KidPhone[] {
  const father = normalizePhone(s.fatherPhone)
  const mother = normalizePhone(s.motherPhone)
  const own = normalizePhone(s.ownPhone)
  const out: Array<{ label: KidPhone['label']; digits: string }> = []
  if (father && father === mother) out.push({ label: 'Parents', digits: father })
  else {
    if (mother) out.push({ label: 'Mother', digits: mother })
    if (father) out.push({ label: 'Father', digits: father })
  }
  if (own && own !== father && own !== mother) out.push({ label: 'Student', digits: own })
  const chosen = s.callFirst ? out.findIndex((p) => CHOSEN[s.callFirst!].includes(p.label)) : -1
  if (chosen > 0) out.unshift(...out.splice(chosen, 1))
  return out.map((p) => ({ ...p, display: formatPhone(p.digits), tel: `tel:${p.digits}` }))
}

const COMPOSER_LABEL: Record<KidPhone['label'], string> = {
  Mother: "Mother's phone",
  Father: "Father's phone",
  Parents: 'Parents’ phone',
  Student: "Student's phone",
}

/**
 * The numbers the follow-up composer offers (2026-10-25), in the order a
 * servant reaches the family: the mother's first unless a servant chose
 * another. A Fellowship member (`member`, their first name) has only their own.
 */
export function composerPhones(
  s: { fatherPhone?: string | null; motherPhone?: string | null; ownPhone?: string | null; callFirst?: CallFirst | null },
  member?: string,
): Array<{ label: string; value: string }> {
  if (member !== undefined) {
    const own = normalizePhone(s.ownPhone)
    return own ? [{ label: `${member}'s phone`, value: formatPhone(own) }] : []
  }
  return kidPhoneList(s).map((p) => ({ label: COMPOSER_LABEL[p.label], value: p.display }))
}
