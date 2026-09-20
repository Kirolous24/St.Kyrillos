// Narrow helper so route handlers can map a unique-constraint violation to a
// 409 without importing Prisma's runtime error classes everywhere.
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

/** A foreign key still points at the row a delete/update tried to change (P2003). */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2003'
  )
}

/**
 * The columns (or index name) a P2002 names, lower-cased. Postgres reports
 * either shape depending on the constraint, so callers match on substrings.
 * Empty when the error is not a unique violation or names nothing.
 */
export function uniqueViolationTargets(error: unknown): string[] {
  if (!isUniqueViolation(error)) return []
  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (typeof target === 'string') return [target.toLowerCase()]
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase())
  return []
}

/**
 * True when a P2002 came from one named constraint. Use it instead of
 * `isUniqueViolation` wherever a transaction writes more than one table, so a
 * clash on the wrong table is not reported as the expected one.
 */
export function isUniqueViolationOn(error: unknown, ...needles: string[]): boolean {
  const targets = uniqueViolationTargets(error)
  if (targets.length === 0) return false
  return needles.some((n) => targets.some((t) => t.includes(n.toLowerCase())))
}
