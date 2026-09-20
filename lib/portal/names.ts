export interface NameParts {
  firstName: string
  lastName: string
}

function clean(value: string): string {
  return value
    .replace(/[.‎‏‪-‮]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a free-text name into first / last. Accepts "First Last",
 * "Last, First" (the prototype's CSV imports produced these) and
 * "First Middle Last" (middle names stay with the last name).
 */
export function splitName(raw: string | null | undefined): NameParts {
  const value = clean(raw ?? '')
  if (!value) return { firstName: '', lastName: '' }

  if (value.includes(',')) {
    const [last, ...rest] = value.split(',')
    return { firstName: clean(rest.join(' ')), lastName: clean(last) }
  }

  const tokens = value.split(' ')
  if (tokens.length === 1) return { firstName: tokens[0], lastName: '' }
  return { firstName: tokens[0], lastName: tokens.slice(1).join(' ') }
}

export function formatFullName(parts: NameParts): string {
  return [parts.firstName, parts.lastName].filter(Boolean).join(' ')
}
