import { prisma } from '@/lib/prisma'
import type { PortalUser } from './permissions'

/** Best-effort audit trail for portal mutations; never breaks the main operation. */
export async function audit(
  user: PortalUser,
  action: string,
  entity: string,
  entityId: string | null,
  detail: string,
): Promise<void> {
  try {
    await prisma.portalAuditLog.create({
      data: { actorId: user.accountId, actorName: user.displayName, action, entity, entityId, detail },
    })
  } catch {
    // ignore
  }
}
