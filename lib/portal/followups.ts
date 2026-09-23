/**
 * The church's own vocabulary for closing a follow-up case.
 *
 * The prototype's `reasonLabels` (OG L17258, L17574). The port stored the keys
 * and rendered them with `.replace('_', ' ')`, so a pastor read "attending
 * again" and "lost interest" — raw database values, lowercased, in a report
 * about a child. These are the labels the church actually uses (F0117).
 */
export const RESOLVE_REASONS = [
  { key: 'attending_again', label: 'Attending again' },
  { key: 'moved', label: 'Moved away' },
  { key: 'sick', label: 'Illness' },
  { key: 'family', label: 'Family circumstance' },
  { key: 'lost_interest', label: 'Lost interest' },
  { key: 'other', label: 'Other' },
] as const

export type ResolveReasonKey = (typeof RESOLVE_REASONS)[number]['key']

const RESOLVE_BY_KEY = new Map<string, string>(RESOLVE_REASONS.map((r) => [r.key, r.label]))

/**
 * The label for a stored reason. An unrecognised value is title-cased rather
 * than dropped — a case closed before this list existed still has to read as
 * something, and showing nothing would hide that the case was resolved at all.
 */
export function resolveReasonLabel(key: string | null | undefined): string | null {
  if (!key) return null
  const known = RESOLVE_BY_KEY.get(key)
  if (known) return known
  const words = key.replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null
}

/** How the contact methods on a case's timeline are named. */
export const CONTACT_METHODS = [
  { key: 'call', label: 'Phone call' },
  { key: 'text', label: 'Text message' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'visit', label: 'Visit' },
  { key: 'other', label: 'Other' },
  // Written by resolveCase, so the closing conversation appears on the
  // timeline with everything else rather than only in the case header.
  { key: 'resolved', label: 'Case resolved' },
] as const

const METHOD_BY_KEY = new Map<string, string>(CONTACT_METHODS.map((m) => [m.key, m.label]))

export function contactMethodLabel(key: string | null | undefined): string {
  if (!key) return 'Contact'
  return METHOD_BY_KEY.get(key) ?? key.charAt(0).toUpperCase() + key.slice(1)
}
