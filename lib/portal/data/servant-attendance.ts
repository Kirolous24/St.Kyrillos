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
    // Any servant may mark anyone their own grid shows them — the prototype's
    // rule, restored at the church's request. `canMarkServant` enforces the
    // same thing server-side; this is only what the page renders.
    canMarkOthers: user.role === 'ADMIN' || user.role === 'SERVANT',
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
  /** One cell per held (activity, week) pair — which week was missed, not just how many. */
  cells: SessionWeekRow[]
}

export interface ServantReport {
  /** Mondays with anything recorded, oldest first. */
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
    // Scoped to the servants on screen. Church-wide, any servant anywhere
    // recording an activity made it "held" for everybody in scope, so a group
    // that never attends, say, the Friday meeting was scored 0/N on it and the
    // Standing badge was computed from a denominator they were never part of.
    prisma.servantAttendance.groupBy({
      by: ['activityKey', 'weekStart'],
      where: { weekStart: range, servantId: { in: servantIds } },
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
      // The per-week cells were computed and then thrown away, collapsed into
      // one aggregate per activity before the function returned — so the page
      // could say a servant attended 3 of 5, but never which two they missed.
      // That is the whole point of the prototype's week grid (OG L8080-8106).
      cells,
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

export interface MeetingHistoryRow {
  activityKey: string
  label: string
  weekStart: string
  present: number
  excused: number
  marked: number
  /** Who was there, in the order the grid lists them. */
  attendees: string[]
  /**
   * F0009 / F0605 — how many of those present scanned the code themselves,
   * rather than being ticked off the grid by somebody else.
   *
   * No column was added for this. Every scan already writes a QrRedemption
   * receipt naming the token, the account and the moment, and nothing in the
   * portal ever deletes one — so the answer was already stored for every meeting
   * ever held, including the ones held before anybody asked the question. The
   * earlier note calling this unrecoverable without a migration was reading the
   * ServantAttendance table alone and missing the receipts.
   */
  scanned: number
}

/**
 * Past servant meetings, newest first — the prototype's meeting history list.
 *
 * Editing a past week already worked through the week stepper, but there was
 * no list of what had been held: a coordinator had to step back through empty
 * weeks to find the last meeting. Read-only, and scoped exactly like the grid,
 * so the pastor sees it too.
 */
export async function listMeetingHistory(user: PortalUser, limit = 16): Promise<MeetingHistoryRow[]> {
  const [activities, scope] = await Promise.all([listServantActivities(), loadServantScope(user)])
  const ids = scope.servants.map((s) => s.id)
  if (ids.length === 0) return []

  const held = await prisma.servantAttendance.groupBy({
    by: ['activityKey', 'weekStart'],
    where: { servantId: { in: ids } },
    orderBy: { weekStart: 'desc' },
    take: limit,
  })
  if (held.length === 0) return []

  const rows = await prisma.servantAttendance.findMany({
    where: {
      servantId: { in: ids },
      weekStart: { in: held.map((h) => h.weekStart) },
      activityKey: { in: Array.from(new Set(held.map((h) => h.activityKey))) },
    },
    select: { servantId: true, activityKey: true, weekStart: true, status: true },
  })

  // F0009 / F0605 — the scan receipts for exactly the meetings on this page.
  // A receipt exists only where somebody scanned; everything else was marked by
  // hand.
  const receipts = await prisma.qrRedemption.findMany({
    where: {
      token: {
        kind: 'SERVANT_MEETING',
        activityKey: { in: Array.from(new Set(held.map((h) => h.activityKey))) },
        weekStart: { in: held.map((h) => h.weekStart) },
      },
    },
    select: { accountId: true, token: { select: { activityKey: true, weekStart: true } } },
  })
  const accountOf = new Map(scope.servants.map((s) => [s.id, s.accountId]))
  const scannedKeys = new Set(
    receipts
      .filter((r) => r.token.activityKey && r.token.weekStart)
      .map((r) => `${r.accountId}|${r.token.activityKey}|${formatDateOnly(r.token.weekStart!)}`),
  )

  const labelOf = new Map(activities.map((a) => [a.key, a.label]))
  const nameOf = new Map(scope.servants.map((s) => [s.id, s.name]))

  return held
    .map((h) => {
      const week = formatDateOnly(h.weekStart)
      const mine = rows.filter((r) => r.activityKey === h.activityKey && formatDateOnly(r.weekStart) === week)
      const attendees = mine
        .filter((r) => r.status === 'PRESENT')
        .map((r) => nameOf.get(r.servantId) ?? '')
        .filter(Boolean)
      const scanned = mine.filter(
        (r) =>
          r.status === 'PRESENT' &&
          scannedKeys.has(`${accountOf.get(r.servantId) ?? ''}|${h.activityKey}|${week}`),
      ).length
      return {
        activityKey: h.activityKey,
        label: labelOf.get(h.activityKey) ?? h.activityKey,
        weekStart: week,
        present: attendees.length,
        excused: mine.filter((r) => r.status === 'EXCUSED').length,
        marked: mine.length,
        attendees,
        scanned,
      }
    })
    .filter((h) => labelOf.has(h.activityKey))
    .sort((a, b) => (a.weekStart === b.weekStart ? a.label.localeCompare(b.label) : a.weekStart < b.weekStart ? 1 : -1))
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
