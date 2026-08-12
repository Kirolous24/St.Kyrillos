import { prisma } from './prisma'
import { scheduleWindowUTC, dateStrToNoonUTC, SCHEDULE_WEEKS } from './schedule-window'
import { planWeeklyMaterialization, eventKey } from './weekly-services-plan'

// Global master switch (stored in AppSetting). Weekly services auto-populate the
// rolling window unless this is explicitly turned off.
export const AUTO_MATERIALIZE_KEY = 'autoFillWeeklyServices'

/** Default ON: absence of the setting means "auto-populate is on". */
export function isAutoMaterializeEnabled(value: string | null | undefined): boolean {
  return value !== 'false'
}

export interface MaterializeResult {
  created: number
  skipped: 'disabled' | 'no-services' | 'up-to-date' | null
}

/**
 * Ensure every enabled weekly service has a ScheduleEvent for every week of the
 * rolling window. Idempotent: only missing instances are created, and a fresh
 * re-read inside the transaction guards against concurrent runs creating dupes.
 *
 * MUST be called from a Route Handler / Server Action (never during page render),
 * because on success it revalidates the public + admin paths.
 */
export async function materializeWeeklyServices(opts?: {
  now?: Date
  force?: boolean // bypass the master switch (used by the manual "Apply" action)
}): Promise<MaterializeResult> {
  const now = opts?.now ?? new Date()

  if (!opts?.force) {
    const setting = await prisma.appSetting.findUnique({ where: { key: AUTO_MATERIALIZE_KEY } })
    if (!isAutoMaterializeEnabled(setting?.value)) {
      return { created: 0, skipped: 'disabled' }
    }
  }

  const { weekStart, weekEnd } = scheduleWindowUTC(now, SCHEDULE_WEEKS)

  const [services, existing] = await Promise.all([
    prisma.weeklyService.findMany({ where: { enabled: true } }),
    prisma.scheduleEvent.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      select: { date: true, sortOrder: true, title: true },
    }),
  ])

  if (services.length === 0) return { created: 0, skipped: 'no-services' }

  const plan = planWeeklyMaterialization(
    services.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      title: s.title,
      time: s.time,
      durationMinutes: s.durationMinutes,
      location: s.location,
      description: s.description,
      enabled: s.enabled,
      sortOrder: s.sortOrder,
    })),
    existing.map((e) => ({ date: e.date.toISOString(), sortOrder: e.sortOrder, title: e.title })),
    now,
    SCHEDULE_WEEKS,
  )

  if (plan.length === 0) return { created: 0, skipped: 'up-to-date' }

  // Re-check against a fresh read inside the transaction so two concurrent
  // materializations (e.g. cron firing while an admin mutates) can't both insert
  // the same instance. This is the app-level stand-in for a DB unique constraint.
  const created = await prisma.$transaction(async (tx) => {
    const fresh = await tx.scheduleEvent.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      select: { date: true, sortOrder: true, title: true },
    })
    const seen = new Set(fresh.map((e) => eventKey(e.date.toISOString(), e.sortOrder, e.title)))
    const rows = plan.filter((p) => !seen.has(eventKey(p.date, p.sortOrder, p.title)))
    if (rows.length === 0) return 0
    const res = await tx.scheduleEvent.createMany({
      data: rows.map((p) => ({
        date: dateStrToNoonUTC(p.date),
        time: p.time,
        sortOrder: p.sortOrder,
        durationMinutes: p.durationMinutes,
        title: p.title,
        description: p.description,
        location: p.location,
      })),
    })
    return res.count
  })

  return { created, skipped: created > 0 ? null : 'up-to-date' }
}
