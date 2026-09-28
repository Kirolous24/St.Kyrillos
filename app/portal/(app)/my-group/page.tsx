import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UsersRound, Phone, MessageCircle, Cake, HeartHandshake } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { ensureInitialSplits, loadClassGroups } from '@/lib/portal/data/groups'
import { effectiveServant } from '@/lib/portal/groups'
import { classTotals } from '@/lib/portal/data/dashboard'
import { absenceStreakAgainst, type HistoryRow } from '@/lib/portal/attendance-rules'
import { churchToday, formatDateOnly, daysBetween, daysUntilBirthday, ageOn } from '@/lib/portal/dates'
import { waLink } from '@/lib/portal/phones'
import { PageHeader, Card, Badge, EmptyState, Avatar, SectionTitle, buttonClass } from '@/components/portal/ui'
import { CheckInButton } from '@/components/portal/CheckInButton'
import { cn } from '@/lib/utils'

export const metadata = { title: 'My Group' }

const RECENT_SUNDAYS = 8

/**
 * Follow-up groups (2026-09-26): the children a servant follows up, and the
 * page that is about them rather than the whole class. Everything a servant
 * needs before a phone call is on one card: the last few Sundays, whether a
 * case is open, when somebody last reached the family, and a way to log it.
 * The whole class stays one click away; nothing here hides anybody.
 */
export default async function MyGroupPage() {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()
  await ensureInitialSplits().catch((err) => console.error('Initial group split failed:', err))

  const groups = user.servantId ? await loadClassGroups(user.classIds) : []
  const mineByClass = groups.map((g) => {
    const active = new Set(g.servants.map((s) => s.id))
    return {
      ...g,
      mine: g.kids.filter((k) => effectiveServant(k.groupServantId, active) === user.servantId),
      unassigned: g.kids.filter((k) => effectiveServant(k.groupServantId, active) === null).length,
    }
  })
  const kidIds = mineByClass.flatMap((g) => g.mine.map((k) => k.id))

  const header = (
    <PageHeader
      title="My Group"
      icon={<UsersRound className="h-5 w-5" aria-hidden />}
      subtitle={
        kidIds.length
          ? `${kidIds.length} child${kidIds.length === 1 ? '' : 'ren'} you follow up · call, check in, and keep an eye on the Sundays`
          : 'The children you follow up'
      }
    />
  )

  if (kidIds.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="You don't have a group yet"
          hint={
            user.classIds.length === 0
              ? 'Groups belong to the servants of a class. Once you serve a class, its children are split between its servants.'
              : 'Your class has not been split yet, or its coordinator has not given you any children. Ask them to use Split evenly on the class page.'
          }
        />
      </>
    )
  }

  const today = churchToday()
  const classIds = mineByClass.map((g) => g.classId)
  const [details, sundayRows, heldRows, openCases, lastContacts, points] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: kidIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
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
    prisma.followUpCase.findMany({ where: { studentId: { in: kidIds }, status: 'OPEN' }, select: { id: true, studentId: true, title: true } }),
    prisma.followUpLog.groupBy({ by: ['studentId'], where: { studentId: { in: kidIds } }, _max: { at: true } }),
    classTotals(classIds),
  ])

  const detailById = new Map(details.map((d) => [d.id, d]))
  const heldByClass = new Map<string, string[]>()
  for (const r of heldRows) heldByClass.set(r.classId, [...(heldByClass.get(r.classId) ?? []), formatDateOnly(r.date)])
  const rowsByKid = new Map<string, HistoryRow[]>()
  for (const r of sundayRows) {
    rowsByKid.set(r.studentId, [...(rowsByKid.get(r.studentId) ?? []), { date: formatDateOnly(r.date), status: r.status }])
  }
  const caseByKid = new Map(openCases.map((c) => [c.studentId, c]))
  const lastContactByKid = new Map(lastContacts.map((l) => [l.studentId, l._max.at]))

  return (
    <>
      {header}
      <div className="space-y-6">
        {mineByClass
          .filter((g) => g.mine.length > 0)
          .map((g) => {
            const held = (heldByClass.get(g.classId) ?? []).sort()
            const recent = held.slice(-RECENT_SUNDAYS)
            const cards = g.mine
              .map((k) => {
                const d = detailById.get(k.id)!
                const rows = rowsByKid.get(k.id) ?? []
                const since = formatDateOnly(d.createdAt)
                const streak = absenceStreakAgainst(held, rows, since)
                const last = lastContactByKid.get(k.id) ?? null
                const lastDays = last ? daysBetween(churchToday(last), today) : null
                return { k, d, rows, streak, last, lastDays, openCase: caseByKid.get(k.id) ?? null }
              })
              // Who needs a call first: an open case, then nobody has reached
              // them yet, then the longest since anybody did.
              .sort(
                (a, b) =>
                  Number(!!b.openCase) - Number(!!a.openCase) ||
                  (a.lastDays === null ? -1 : 0) - (b.lastDays === null ? -1 : 0) ||
                  (b.lastDays ?? 0) - (a.lastDays ?? 0) ||
                  a.k.name.localeCompare(b.k.name),
              )
            return (
              <section key={g.classId} data-testid="my-group-class">
                <SectionTitle hint={`${g.mine.length} of ${g.kids.length} in the class`}>
                  <Link href={`/portal/classes/${g.classId}`} className="hover:text-brand-800">
                    {g.name}
                  </Link>
                </SectionTitle>
                {g.unassigned > 0 && (
                  <p className="mb-3 text-[12px] text-[#D97706]">
                    {g.unassigned} {g.unassigned === 1 ? 'child in this class has' : 'children in this class have'} no servant
                    yet; your coordinator places them from the class page.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                  {cards.map(({ k, d, rows, streak, lastDays, openCase }) => {
                    const byDate = new Map(rows.map((r) => [r.date, r.status]))
                    const phone = d.fatherPhone || d.motherPhone || d.account.phone
                    const wa = waLink(phone)
                    const dob = d.dob ? formatDateOnly(d.dob) : null
                    const birthdayIn = dob ? daysUntilBirthday(dob, today) : null
                    return (
                      <Card key={k.id}>
                        <div className="flex items-start gap-3" data-testid="my-group-kid" data-student={k.id}>
                          <Avatar name={k.name} photo={d.account.photo} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link href={`/portal/students/${k.id}`} className="font-serif text-[14px] font-bold text-parch-900 hover:text-brand-800">
                                {k.name}
                              </Link>
                              {dob && <span className="text-[11.5px] text-parch-500">· {ageOn(dob, today)}</span>}
                              {openCase && (
                                <Link href={`/portal/follow-ups/${openCase.id}`}>
                                  <Badge tone="warn">
                                    <HeartHandshake className="h-3 w-3" aria-hidden /> Open case
                                  </Badge>
                                </Link>
                              )}
                              {birthdayIn !== null && birthdayIn <= 7 && (
                                <Badge tone="gold">
                                  <Cake className="h-3 w-3" aria-hidden /> {birthdayIn === 0 ? 'Birthday today' : `Birthday in ${birthdayIn}d`}
                                </Badge>
                              )}
                            </div>
                            {/* The last few Sundays the class held, oldest first. */}
                            <div className="mt-1.5 flex items-center gap-1" aria-label="Recent Sundays">
                              {recent.map((date) => {
                                const st = date < formatDateOnly(d.createdAt) ? null : byDate.get(date) ?? 'ABSENT'
                                return (
                                  <span
                                    key={date}
                                    title={`${date}: ${st === null ? 'before they joined' : st.toLowerCase()}`}
                                    className={cn(
                                      'inline-block h-2.5 w-2.5 rounded-full',
                                      st === 'PRESENT' && 'bg-[#16A34A]',
                                      st === 'EXCUSED' && 'bg-parch-300',
                                      st === 'ABSENT' && 'border-[1.5px] border-[#DC2626]',
                                      st === null && 'bg-parch-100',
                                    )}
                                  />
                                )
                              })}
                              <span className="ml-1.5 text-[11.5px] text-parch-600">
                                {recent.length === 0 ? 'No Sundays recorded yet' : streak === 0 ? 'Came last Sunday' : `Missed ${streak} in a row`}
                              </span>
                            </div>
                            <p className="mt-1 text-[11.5px] text-parch-600" data-testid="last-contacted">
                              {lastDays === null ? 'Not contacted yet' : lastDays === 0 ? 'Contacted today' : `Last contacted ${lastDays} day${lastDays === 1 ? '' : 's'} ago`}
                              {' · '}
                              {(points.get(k.id) ?? 0).toLocaleString()} pts
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {phone && (
                            <a href={`tel:${phone}`} className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px] px-2.5')} aria-label={`Call ${k.name}'s family`}>
                              <Phone className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden />
                            </a>
                          )}
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonClass('secondary', 'sm'), 'min-h-[36px] px-2.5')} aria-label={`WhatsApp ${k.name}'s family`}>
                              <MessageCircle className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden />
                            </a>
                          )}
                          <CheckInButton studentId={k.id} studentName={k.name} />
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )
          })}
      </div>
    </>
  )
}
