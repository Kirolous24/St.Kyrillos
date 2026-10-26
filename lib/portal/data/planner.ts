import { prisma } from '@/lib/prisma'
import { safeUrl } from '../agenda'

/** Where the planner link is kept (PortalSetting). */
export const PLANNER_KEY = 'planner.link'

/**
 * The planner every class uses (2026-10-25: "the planner is universal and
 * permanent for all classes"), or null until the admin adds it. Read
 * defensively: only a web address ever becomes a link.
 */
export async function plannerLink(): Promise<string | null> {
  const row = await prisma.portalSetting.findUnique({ where: { key: PLANNER_KEY }, select: { value: true } })
  const value = row?.value as { url?: unknown } | null | undefined
  return safeUrl(value?.url)
}
