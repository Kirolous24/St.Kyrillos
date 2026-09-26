import { prisma } from '@/lib/prisma'

/**
 * Which of these accounts have a readable PIN on file. Returns ids only; the
 * sealed value itself never leaves the admin logins actions.
 */
export async function onFileAccountIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await prisma.account.findMany({ where: { id: { in: ids }, pinSealed: { not: null } }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}
