// The servants' weekly attendance report, for the children (2026-10-19).
// The Middle School overseer asked for it: "have this report for the kids too,
// not just the servants".
//
// It counts the church's way (ANALYSIS §5), as lib/portal/reports.ts does: a
// meeting is HELD for a class in a week when that class has any row for it
// that week. Every child of the class is then expected; an excused mark leaves
// that week out; anything else, a row saying absent or no row at all, counts
// against them. On top of that, as in the follow-up rule
// (attendance-rules.ts), a meeting held before a child joined the class is not
// theirs to miss. They joined at the earlier of being added and their first
// register mark there. No DB access; tested in
// tests/portal/kid-weekly-report.test.ts.

import { mondayOf } from './dates'
import { dominantWeekday } from './reports'
import { attendanceRate, type CheckInStatus, type SessionWeekRow } from './qr'

type Mark = 'PRESENT' | 'EXCUSED' | 'ABSENT'

export interface KidReportInput {
  classes: ReadonlyArray<{ id: string; name: string }>
  /** One entry per child per class in view: a Pre-Servants teen is in two. */
  roster: ReadonlyArray<{
    studentId: string
    name: string
    classId: string
    /** In this class beyond their own (ClassMember): expected only at its own meeting. */
    member: boolean
    /** YYYY-MM-DD they were added to this class (or the portal). */
    joinedOn: string
    /** Their first register mark in this class ever, if any. */
    firstMarkedOn: string | null
  }>
  /** The meetings still running; `classId` is set on a class's own meeting. */
  sessions: ReadonlyArray<{ key: string; label: string; classId: string | null }>
  /** Every mark in the range, for the classes in view. */
  records: ReadonlyArray<{ studentId: string; classId: string; date: string; sessionKey: string; status: Mark }>
}

export interface Tally {
  attended: number
  held: number
}

export interface KidReportRow extends Tally {
  studentId: string
  name: string
  classId: string
  className: string
  rate: number | null
  bySession: Record<string, Tally>
  /** One per meeting they were expected at; null = held, but nobody marked them. */
  cells: SessionWeekRow[]
}

export interface KidWeeklyReport {
  /** Mondays with any meeting held, oldest first. */
  weeks: string[]
  /** Meetings held in the range, in the church's order, with the weekday each is held on. */
  sessions: Array<{ key: string; label: string; weekday: number | null }>
  /** Meetings that apply here but had no register in the range. */
  notHeld: Array<{ key: string; label: string }>
  rows: KidReportRow[]
  classes: Array<Tally & { classId: string; name: string; students: number; rate: number | null; bySession: Record<string, Tally> }>
  perSession: Array<Tally & { key: string; label: string; weekday: number | null; rate: number | null }>
  total: Tally & { rate: number | null }
}

const RANK: Record<Mark, number> = { PRESENT: 3, EXCUSED: 2, ABSENT: 1 }

const rateOf = (t: Tally): number | null => (t.held === 0 ? null : Math.round((t.attended / t.held) * 100))

const add = (into: Record<string, Tally>, key: string, t: Tally) => {
  const prev = into[key] ?? { attended: 0, held: 0 }
  into[key] = { attended: prev.attended + t.attended, held: prev.held + t.held }
}

export function buildKidWeeklyReport(input: KidReportInput): KidWeeklyReport {
  const classIds = new Set(input.classes.map((c) => c.id))
  const applies = input.sessions.filter((s) => s.classId === null || classIds.has(s.classId))
  const sessionOf = new Map(applies.map((s) => [s.key, s]))
  const order = new Map(applies.map((s, i) => [s.key, i]))

  // Per class: each held (meeting, week), the first day it met that week, and
  // every child's best mark for it.
  const occasions = new Map<string, Map<string, { sessionKey: string; week: string; firstDate: string }>>()
  const best = new Map<string, Mark>()
  const datesBySession = new Map<string, string[]>()
  for (const r of input.records) {
    if (!classIds.has(r.classId) || !sessionOf.has(r.sessionKey)) continue
    const week = mondayOf(r.date)
    const occ = `${r.sessionKey}|${week}`
    const forClass = occasions.get(r.classId) ?? new Map()
    const known = forClass.get(occ)
    if (!known) forClass.set(occ, { sessionKey: r.sessionKey, week, firstDate: r.date })
    else if (r.date < known.firstDate) known.firstDate = r.date
    occasions.set(r.classId, forClass)
    datesBySession.set(r.sessionKey, [...(datesBySession.get(r.sessionKey) ?? []), r.date])
    const cell = `${r.classId}|${r.studentId}|${occ}`
    const prev = best.get(cell)
    if (!prev || RANK[r.status] > RANK[prev]) best.set(cell, r.status)
  }

  const sortedOccasions = (classId: string) =>
    Array.from(occasions.get(classId)?.values() ?? []).sort((a, b) =>
      a.week === b.week ? (order.get(a.sessionKey) ?? 0) - (order.get(b.sessionKey) ?? 0) : a.week < b.week ? -1 : 1,
    )

  const className = new Map(input.classes.map((c) => [c.id, c.name]))
  const rows: KidReportRow[] = input.roster
    .filter((k) => classIds.has(k.classId))
    .map((k) => {
      const since = k.firstMarkedOn && k.firstMarkedOn < k.joinedOn ? k.firstMarkedOn : k.joinedOn
      const cells: SessionWeekRow[] = sortedOccasions(k.classId)
        .filter((o) => o.firstDate >= since)
        // A member is marked for the church's meetings in their own class.
        .filter((o) => !k.member || sessionOf.get(o.sessionKey)?.classId === k.classId)
        .map((o) => ({
          sessionKey: o.sessionKey,
          week: o.week,
          status: (best.get(`${k.classId}|${k.studentId}|${o.sessionKey}|${o.week}`) ?? null) as CheckInStatus | null,
        }))
      const bySession: Record<string, Tally> = {}
      for (const key of Array.from(new Set(cells.map((c) => c.sessionKey)))) {
        const r = attendanceRate(cells.filter((c) => c.sessionKey === key))
        bySession[key] = { attended: r.attended, held: r.held }
      }
      const total = attendanceRate(cells)
      return {
        studentId: k.studentId,
        name: k.name,
        classId: k.classId,
        className: className.get(k.classId) ?? '',
        attended: total.attended,
        held: total.held,
        rate: total.rate,
        bySession,
        cells,
      }
    })

  const weekdayOf = (key: string): number | null => {
    const dates = datesBySession.get(key) ?? []
    return dates.length ? dominantWeekday(dates) : null
  }
  const heldKeys = new Set<string>()
  occasions.forEach((forClass) => forClass.forEach((o) => heldKeys.add(o.sessionKey)))
  const sessions = applies.filter((s) => heldKeys.has(s.key)).map((s) => ({ key: s.key, label: s.label, weekday: weekdayOf(s.key) }))
  const notHeld = applies.filter((s) => !heldKeys.has(s.key)).map((s) => ({ key: s.key, label: s.label }))

  const perSessionTally: Record<string, Tally> = {}
  for (const r of rows) for (const [key, t] of Object.entries(r.bySession)) add(perSessionTally, key, t)
  const perSession = sessions.map((s) => {
    const t = perSessionTally[s.key] ?? { attended: 0, held: 0 }
    return { ...s, attended: t.attended, held: t.held, rate: rateOf(t) }
  })

  const classes = input.classes.map((c) => {
    const mine = rows.filter((r) => r.classId === c.id)
    const bySession: Record<string, Tally> = {}
    for (const r of mine) for (const [key, t] of Object.entries(r.bySession)) add(bySession, key, t)
    const t = mine.reduce((n, r) => ({ attended: n.attended + r.attended, held: n.held + r.held }), { attended: 0, held: 0 })
    return { classId: c.id, name: c.name, students: mine.length, ...t, rate: rateOf(t), bySession }
  })

  const total = rows.reduce((n, r) => ({ attended: n.attended + r.attended, held: n.held + r.held }), { attended: 0, held: 0 })
  const weeks = Array.from(new Set(Array.from(occasions.values()).flatMap((m) => Array.from(m.values()).map((o) => o.week)))).sort()

  return { weeks, sessions, notHeld, rows, classes, perSession, total: { ...total, rate: rateOf(total) } }
}
