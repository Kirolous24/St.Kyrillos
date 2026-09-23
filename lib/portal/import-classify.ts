// Classifies one CSV-import row (student or servant) as a create, an update,
// or an error, against a *pre-fetched* map of existing accounts keyed by
// login ID. Pulling this out of the import loop is what lets the caller
// batch-fetch every account the file references in one query instead of a
// `findUnique` per row — see lib/portal/actions/data-tools.ts.

export type ExistingImportAccount = {
  id: string
  role: 'ADMIN' | 'PASTOR' | 'SERVANT' | 'STUDENT'
  /** The linked Student.id or Servant.id, whichever the role implies. */
  linkedId: string | null
  /**
   * The name already on file. A corrections sheet that carries no name column
   * has nothing to call the row, and "Row 14" is no use to an admin reading
   * the preview — so the existing name stands in.
   */
  displayName?: string | null
}

export type ImportClassification =
  | { kind: 'create' }
  | { kind: 'update'; account: ExistingImportAccount }
  | { kind: 'error'; message: string }

/** A blank login ID always means "create"; a login ID absent from the map
 * (not yet used) also creates, keeping its own ID rather than a random one. */
export function classifyStudentImportRow(
  loginId: string,
  existingByLoginId: ReadonlyMap<string, ExistingImportAccount>,
): ImportClassification {
  if (!loginId) return { kind: 'create' }
  const account = existingByLoginId.get(loginId)
  if (!account) return { kind: 'create' }
  if (account.role !== 'STUDENT' || !account.linkedId) {
    return { kind: 'error', message: `ID ${loginId} belongs to a servant account` }
  }
  return { kind: 'update', account }
}

/**
 * Same rule for a servant-import row, plus the guard that stops a row from
 * silently demoting the admin who is running the import.
 */
export function classifyServantImportRow(
  loginId: string,
  existingByLoginId: ReadonlyMap<string, ExistingImportAccount>,
  selfAccountId: string,
  newRole: 'ADMIN' | 'PASTOR' | 'SERVANT',
): ImportClassification {
  if (!loginId) return { kind: 'create' }
  const account = existingByLoginId.get(loginId)
  if (!account) return { kind: 'create' }
  if (account.role === 'STUDENT') {
    return { kind: 'error', message: `ID ${loginId} belongs to a student` }
  }
  if (account.id === selfAccountId && newRole !== 'ADMIN') {
    return { kind: 'error', message: 'This row would remove your own admin access' }
  }
  return { kind: 'update', account }
}
