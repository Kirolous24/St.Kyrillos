import { prisma } from '@/lib/prisma'
import { openPin } from '../pin-vault'

/**
 * Which of these accounts have a readable PIN on file. Returns ids only; the
 * sealed value itself never leaves the logins actions.
 */
export async function onFileAccountIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await prisma.account.findMany({ where: { id: { in: ids }, pinSealed: { not: null } }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}

/**
 * The PINs on file for these accounts, opened from their sealed copies; null
 * where none is on file. Only the logins actions call this, after their own
 * permission check, and they write each view to the activity log.
 */
export async function pinsOnFile(accountIds: string[]): Promise<Map<string, string | null>> {
  if (accountIds.length === 0) return new Map()
  const rows = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, loginId: true, pinSealed: true } })
  return new Map(rows.map((a) => [a.id, openPin(a.pinSealed, a.loginId)]))
}
