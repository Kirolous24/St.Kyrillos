/**
 * The prototype's class-accent palette, verbatim from its `palette = [...]`.
 * A class always gets the same colour: index by its position in the class list
 * so the assignment is stable across pages.
 */
export const CLASS_ACCENTS = [
  '#6F1D1B',
  '#2563EB',
  '#CA8A04',
  '#16A34A',
  '#DB2777',
  '#7C3AED',
  '#0891B2',
  '#EA580C',
  '#059669',
  '#D946EF',
  '#F59E0B',
  '#4F46E5',
] as const

/**
 * Accent by the class's own sortOrder, which is how the prototype coloured
 * them: palette position = position in the class list. Preferred over
 * accentFor because it gives every class a distinct colour.
 */
export function accentByOrder(sortOrder: number): string {
  const i = ((sortOrder % CLASS_ACCENTS.length) + CLASS_ACCENTS.length) % CLASS_ACCENTS.length
  return CLASS_ACCENTS[i]!
}

/** Fallback when sortOrder is not to hand: stable accent derived from the id. */
export function accentFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return CLASS_ACCENTS[hash % CLASS_ACCENTS.length]!
}

/** The soft tint behind an icon tile of that accent. */
export function accentTint(hex: string): string {
  return `${hex}1A` // 10% alpha
}
