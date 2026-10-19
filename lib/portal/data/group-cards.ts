import { prisma } from '@/lib/prisma'
import { absenceStreakAgainst, type HistoryRow } from '../attendance-rules'
import { churchToday, daysBetween, formatDateOnly } from '../dates'
import { currentExcuse, excuseState, withExcusedDates, type ExcuseView } from '../excuses'
import { writtenForGroupOf } from '../followups'
import { recentSundays, type SundayDot } from '../group-cards'
import { classTotals } from './dashboard'
import { excusesByStudent } from './excuses'

/** How many Sundays a card draws as dots. */
export const RECENT_SUNDAYS = 8

/** Everything a child's card on My Group or Class Groups shows (2026-10-19). */
export interface KidCardData {
  id: string
  name: string
  photo: string | null
  /** Date-only. */
  dob: string | null
  fatherPhone: string | null
  motherPhone: string | null
  ownPhone: string | null
  dots: SundayDot[]
  /** Sundays missed in a row, excused ones not counted: the follow-up rule's number. */
  streak: number
  openCase: { id: string; title: string } | null
  lastContact: { daysAgo: number; by: string | null; forGroup: string | null } | null
  points: number
  /** On now, or the next one coming. */
  excuse: ExcuseView | null
  excusedNow: boolean
}

/**
 * The cards for these children, each read against their own class's Sundays.
 * One round of queries for the lot, however many there are.
 */
export async function loadKidCards(
  kids: ReadonlyArray<{ id: string; name: string; classId: string }>,
  today: string = churchToday(),
): Promise<Map<string, KidCardData>> {
  const out = new Map<string, KidCardData>()
  if (kids.length === 0) return out
  const kidIds = kids.map((k) => k.id)
  const classIds = Array.from(new Set(kids.map((k) => k.classId)))
  const [details, sundayRows, heldRows, openCases, lastContacts, points, excuses] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: kidIds } },
      select: {
        id: true,
        dob: true,
        createdAt: true,
        fatherPhone: true,
        motherPhone: true,
        account: { select: { phone: true, photo: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: kidIds }, sessionKey: 'sunday' },
      select: { studentId: true, date: true, status: true },
    }),
    // Class-wide: a Sunday the class held with no row for a child is a Sunday
    // they missed, exactly as the follow-up rule scores it.
    prisma.attendanceRecord.findMany({
      where: { classId: { in: classIds }, sessionKey: 'sunday' },
      distinct: ['classId', 'date'],
      select: { classId: true, date: true },
    }),
    prisma.followUpCase.findMany({
      where: { studentId: { in: kidIds }, status: 'OPEN' },
      select: { id: true, studentId: true, title: true },
    }),
    // The latest contact per child, with who made it and for whose group.
    prisma.followUpLog.findMany({
      where: { studentId: { in: kidIds } },
      orderBy: { at: 'desc' },
      distinct: ['studentId'],
      select: {
        studentId: true,
        at: true,
        by: { select: { displayName: true, servant: { select: { id: true } } } },
        groupServantId: true,
        groupServant: { select: { account: { select: { displayName: true } } } },
      },
    }),
    classTotals(classIds),
    excusesByStudent(kidIds),
  ])

  const detailById = new Map(details.map((d) => [d.id, d]))
  const heldByClass = new Map<string, string[]>()
  for (const r of heldRows) heldByClass.set(r.classId, [...(heldByClass.get(r.classId) ?? []), formatDateOnly(r.date)])
  const rowsByKid = new Map<string, HistoryRow[]>()
  for (const r of sundayRows) {
    rowsByKid.set(r.studentId, [...(rowsByKid.get(r.studentId) ?? []), { date: formatDateOnly(r.date), status: r.status }])
  }
  const caseByKid = new Map(openCases.map((c) => [c.studentId, { id: c.id, title: c.title }]))
  const contactByKid = new Map(lastContacts.map((l) => [l.studentId, l]))

  for (const k of kids) {
    const d = detailById.get(k.id)
    if (!d) continue
    const held = heldByClass.get(k.classId) ?? []
    const rows = rowsByKid.get(k.id) ?? []
    const since = formatDateOnly(d.createdAt)
    const windows = excuses.get(k.id) ?? []
    const excuse = currentExcuse(windows, today)
    const contact = contactByKid.get(k.id)
    out.set(k.id, {
      id: k.id,
      name: k.name,
      photo: d.account.photo,
      dob: d.dob ? formatDateOnly(d.dob) : null,
      fatherPhone: d.fatherPhone,
      motherPhone: d.motherPhone,
      ownPhone: d.account.phone,
      dots: recentSundays({ held, rows, since, excuses: windows, count: RECENT_SUNDAYS }),
      streak: absenceStreakAgainst(held, withExcusedDates(held, rows, windows, since), since),
      openCase: caseByKid.get(k.id) ?? null,
      lastContact: contact
        ? {
            daysAgo: daysBetween(churchToday(contact.at), today),
            by: contact.by?.displayName ?? null,
            forGroup: writtenForGroupOf({
              groupServantId: contact.groupServantId,
              groupServantName: contact.groupServant?.account.displayName ?? null,
              byServantId: contact.by?.servant?.id ?? null,
            }),
          }
        : null,
      points: points.get(k.id) ?? 0,
      excuse,
      excusedNow: !!excuse && excuseState(excuse, today) === 'active',
    })
  }
  return out
}
