import { prisma } from '@/lib/prisma'
import type { PortalUser } from '../permissions'
import { formatDateOnly, toUTCDate } from '../dates'
import { attendanceRate, type CheckInStatus, type SessionWeekRow } from '../qr'

/**
 * Reads behind /portal/servant-attendance. Every query is scoped to the
 * servants the caller may see; nothing loads a whole table to filter in JS.
 */

export interface ServantActivityRow {
  key: string
  label: string
  dayOfWeek: number
}

export interface ScopedServant {
  id: string
  accountId: string
  name: string
  photo: string | null
  classNames: string[]
  isSelf: boolean
}

export interface ServantScope {
  servants: ScopedServant[]
  /** True when the caller may write rows for servants other than themselves. */
  canMarkOthers: boolean
  isCoordinator: boolean
  hasStageOversight: boolean
}

export async function listServantActivities(): Promise<ServantActivityRow[]> {
  const rows = await prisma.servantActivity.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    select: { key: true, label: true, dayOfWeek: true },
  })
  return rows
}

/**
 * The servants the caller may see: everyone for an admin or pastor, the
 * servants of the overseen stage for a stage overseer, otherwise the servants
 * of the caller's own classes — always including the caller themselves.
 */
export async function loadServantScope(user: PortalUser): Promise<ServantScope> {
  const isCoordinator = user.coordinatorOf.length > 0
  const hasStageOversight = user.stageOversight !== null

  if (user.role === 'STUDENT') {
    return { servants: [], canMarkOthers: false, isCoordinator: false, hasStageOversight: false }
  }

  const churchWide = user.role === 'ADMIN' || user.role === 'PASTOR'
  const or: Array<Record<string, unknown>> = []
  if (!churchWide) {
    if (user.classIds.length > 0) or.push({ classes: { some: { classId: { in: user.classIds } } } })
    if (user.stageOversight) or.push({ classes: { some: { class: { stage: user.stageOversight } } } })
    if (user.servantId) or.push({ id: user.servantId })
    // A servant with no class and no oversight still sees only themselves.
    if (or.length === 0) return { servants: [], canMarkOthers: false, isCoordinator, hasStageOversight }
  }

  const rows = await prisma.servant.findMany({
    where: {
      account: { isActive: true },
      ...(churchWide ? {} : { OR: or }),
    },
    select: {
      id: true,
      accountId: true,
      account: { select: { displayName: true, photo: true } },
      classes: { select: { class: { select: { name: true, sortOrder: true } } } },
    },
  })

  const servants: ScopedServant[] = rows
    .map((s) => ({
      id: s.id,
      accountId: s.accountId,
      name: s.account.displayName,
      photo: s.account.photo,
      classNames: s.classes
        .slice()
        .sort((a, b) => a.class.sortOrder - b.class.sortOrder)
        .map((c) => c.class.name),
      isSelf: s.id === user.servantId,
    }))
    .sort((a, b) => (a.isSelf === b.isSelf ? a.name.localeCompare(b.name) : a.isSelf ? -1 : 1))

  return {
    servants,
    canMarkOthers: user.role === 'ADMIN' || (user.role === 'SERVANT' && (isCoordinator || hasStageOversight)),
    isCoordinator,
    hasStageOversight,
  }
}

export interface WeekGridMark {
  servantId: string
  activityKey: string
  status: CheckInStatus
  reason: string | null
}

/** The bulk grid for one Monday-keyed week. */
export async function loadWeekGrid(user: PortalUser, weekStart: string) {
  const [activities, scope] = await Promise.all([listServantActivities(), loadServantScope(user)])
  const servantIds = scope.servants.map((s) => s.id)

  const marks = servantIds.length
    ? await prisma.servantAttendance.findMany({
        where: { weekStart: toUTCDate(weekStart), servantId: { in: servantIds } },
        select: { servantId: true, activityKey: true, status: true, reason: true },
      })
    : []

  return {
    activities,
    scope,
    marks: marks.map((m) => ({
      servantId: m.servantId,
      activityKey: m.activityKey,
      status: m.status as CheckInStatus,
      reason: m.reason,
    })),
  }
}

export interface ServantReportRow {
  servantId: string
  name: string
  classNames: string[]
  attended: number
  held: number
  rate: number | null
  /** Per-activity attended/held, keyed by activity key. */
  byActivity: Record<string, { attended: number; held: number }>
}

export interface ServantReport {
  weeks: string[]
  activities: ServantActivityRow[]
  rows: ServantReportRow[]
  perActivity: Array<{ key: string; label: string; attended: number; held: number; rate: number | null }>
}

/**
 * Attendance rate per servant and per activity for a week range.
 * "Held" follows ANALYSIS §5: an activity counts for a week when any servant
 * has a row for it that week, so a week nobody recorded is not held against
 * anyone.
 */
export async function servantAttendanceReport(
  user: PortalUser,
  fromWeek: string,
  toWeek: string,
): Promise<ServantReport> {
  const [activities, scope] = await Promise.all([listServantActivities(), loadServantScope(user)])
  const servantIds = scope.servants.map((s) => s.id)
  const range = { gte: toUTCDate(fromWeek), lte: toUTCDate(toWeek) }

  if (servantIds.length === 0) {
    return { weeks: [], activities, rows: [], perActivity: [] }
  }

  const [heldPairs, rows] = await Promise.all([
    prisma.servantAttendance.groupBy({
      by: ['activityKey', 'weekStart'],
      where: { weekStart: range },
    }),
    prisma.servantAttendance.findMany({
      where: { weekStart: range, servantId: { in: servantIds } },
      select: { servantId: true, activityKey: true, weekStart: true, status: true },
    }),
  ])

  const activityKeys = new Set(activities.map((a) => a.key))
  const held = heldPairs
    .filter((p) => activityKeys.has(p.activityKey))
    .map((p) => ({ activityKey: p.activityKey, week: formatDateOnly(p.weekStart) }))

  const weeks = Array.from(new Set(held.map((h) => h.week))).sort()

  const mine = new Map<string, CheckInStatus>()
  for (const r of rows) {
    mine.set(`${r.servantId}|${r.activityKey}|${formatDateOnly(r.weekStart)}`, r.status as CheckInStatus)
  }

  const reportRows: ServantReportRow[] = scope.servants.map((s) => {
    const cells: SessionWeekRow[] = held.map((h) => ({
      sessionKey: h.activityKey,
      week: h.week,
      status: mine.get(`${s.id}|${h.activityKey}|${h.week}`) ?? null,
    }))
    const byActivity: Record<string, { attended: number; held: number }> = {}
    for (const a of activities) {
      const slice = cells.filter((c) => c.sessionKey === a.key)
      const r = attendanceRate(slice)
      byActivity[a.key] = { attended: r.attended, held: r.held }
    }
    const total = attendanceRate(cells)
    return {
      servantId: s.id,
      name: s.name,
      classNames: s.classNames,
      attended: total.attended,
      held: total.held,
      rate: total.rate,
      byActivity,
    }
  })

  const perActivity = activities.map((a) => {
    let attended = 0
    let heldCount = 0
    for (const r of reportRows) {
      attended += r.byActivity[a.key]?.attended ?? 0
      heldCount += r.byActivity[a.key]?.held ?? 0
    }
    return {
      key: a.key,
      label: a.label,
      attended,
      held: heldCount,
      rate: heldCount === 0 ? null : Math.round((attended / heldCount) * 100),
    }
  })

  return { weeks, activities, rows: reportRows, perActivity }
}

/** One servant's own history, newest week first — powers /portal/my-attendance. */
export async function loadMyServantHistory(servantId: string, fromWeek: string) {
  const [activities, heldPairs, mine] = await Promise.all([
    listServantActivities(),
    prisma.servantAttendance.groupBy({
      by: ['activityKey', 'weekStart'],
      where: { weekStart: { gte: toUTCDate(fromWeek) } },
    }),
    prisma.servantAttendance.findMany({
      where: { servantId, weekStart: { gte: toUTCDate(fromWeek) } },
      select: { activityKey: true, weekStart: true, status: true },
    }),
  ])

  const activityKeys = new Set(activities.map((a) => a.key))
  const held = heldPairs
    .filter((p) => activityKeys.has(p.activityKey))
    .map((p) => ({ activityKey: p.activityKey, week: formatDateOnly(p.weekStart) }))
  const mineByKey = new Map<string, CheckInStatus>()
  for (const r of mine) mineByKey.set(`${r.activityKey}|${formatDateOnly(r.weekStart)}`, r.status as CheckInStatus)

  const cells: SessionWeekRow[] = held.map((h) => ({
    sessionKey: h.activityKey,
    week: h.week,
    status: mineByKey.get(`${h.activityKey}|${h.week}`) ?? null,
  }))

  const weeks = Array.from(new Set(held.map((h) => h.week))).sort((a, b) => (a < b ? 1 : -1))
  const byWeek = weeks.map((week) => {
    const slice = cells.filter((c) => c.week === week)
    const rate = attendanceRate(slice)
    return {
      week,
      rate,
      cells: activities.map((a) => ({
        key: a.key,
        label: a.label,
        status: slice.find((c) => c.sessionKey === a.key)?.status ?? null,
        wasHeld: slice.some((c) => c.sessionKey === a.key),
      })),
    }
  })

  return { activities, overall: attendanceRate(cells), byWeek }
}
