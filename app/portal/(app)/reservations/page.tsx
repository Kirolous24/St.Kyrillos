import Link from '@/components/portal/Link'
import { notFound } from 'next/navigation'
import { Bus, Plus, Settings2 } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import {
  reservationApprovers,
  reservationById,
  reservationItems,
  reservationsBetween,
  upcomingReservationsOf,
  waitingReservations,
} from '@/lib/portal/data/reservations'
import { calendarSpan } from '@/lib/portal/calendar-spans'
import { addDays, churchDayStart, churchToday } from '@/lib/portal/dates'
import { andList } from '@/lib/portal/format'
import { canReserve, formatBackAt, formatReservationTime, mayDecideReservation, reservationPurpose, reservationsByDay } from '@/lib/portal/reservations'
import { Callout, Card, EmptyState, LinkButton, PageHeader } from '@/components/portal/ui'
import { ReservationCalendar } from './ReservationCalendar'
import { DecisionButtons } from './DecisionButtons'
import { StatusBadge, VanChip, VanPicture } from './parts'

export const metadata = { title: 'Reservations' }

/**
 * Van reservations (2026-11-02): "Can we do something for the Vans … To
 * organize using them", and "a calendar on who using what". Every servant sees
 * every reservation; each van shows whether it is out right now. Since
 * 2026-11-04 each one is a request the approvers answer, listed here for them.
 */
export default async function ReservationsPage({
  searchParams = {},
}: {
  searchParams?: { month?: string; saved?: string; cancelled?: string; decided?: string }
}) {
  const user = await requirePortalUser()
  if (!canReserve(user.role)) notFound()

  const now = new Date()
  const today = churchToday(now)
  const span = calendarSpan({ month: searchParams.month }, today)
  const approvers = await reservationApprovers()
  const decides = mayDecideReservation(user, approvers.map((a) => a.servantId))
  const [items, month, outNow, mine, saved, decided, waiting] = await Promise.all([
    reservationItems(),
    reservationsBetween(churchDayStart(span.start), churchDayStart(addDays(span.end, 1))),
    reservationsBetween(now, new Date(now.getTime() + 1), ['APPROVED']),
    upcomingReservationsOf(user, now),
    searchParams.saved ? reservationById(searchParams.saved) : Promise.resolve(null),
    searchParams.decided ? reservationById(searchParams.decided) : Promise.resolve(null),
    decides ? waitingReservations(now) : Promise.resolve([]),
  ])
  const isAdmin = user.role === 'ADMIN'
  const approverNames = approvers.length > 0 ? andList(approvers.map((a) => a.name)) : 'the admin'

  return (
    <>
      <PageHeader
        title="Reservations"
        icon={<Bus className="h-5 w-5" aria-hidden />}
        subtitle="Reserve a church van, and see who has each one when."
        actions={
          <>
            {items.length > 0 && (
              <LinkButton href="/portal/reservations/new" variant="gold" size="sm">
                <Plus className="h-4 w-4" aria-hidden />
                Reserve a van
              </LinkButton>
            )}
            {isAdmin && (
              <LinkButton href="/portal/reservations/manage" variant="secondary" size="sm">
                <Settings2 className="h-4 w-4" aria-hidden />
                Manage vans
              </LinkButton>
            )}
          </>
        }
      />

      {saved && (
        <div className="mb-4" data-testid="reservation-saved">
          {saved.status === 'PENDING' ? (
            <Callout tone="info" title="Sent for approval">
              {saved.itemName} for {reservationPurpose(saved)}: {formatReservationTime(saved)}. It went to {approverNames}, and you will be told the
              answer.{' '}
              <Link href={`/portal/reservations/${saved.id}`} className="font-bold underline">
                Open it
              </Link>
            </Callout>
          ) : (
            <Callout tone="good" title="Saved">
              {saved.itemName} for {reservationPurpose(saved)}: {formatReservationTime(saved)}.{' '}
              <Link href={`/portal/reservations/${saved.id}`} className="font-bold underline">
                Open it
              </Link>
            </Callout>
          )}
        </div>
      )}
      {decided && (
        <div className="mb-4" data-testid="reservation-decided">
          <Callout tone={decided.status === 'APPROVED' ? 'good' : 'info'} title={decided.status === 'APPROVED' ? 'Approved' : 'Rejected'}>
            {decided.itemName} for {reservationPurpose(decided)}: {formatReservationTime(decided)}. {decided.createdByName ?? 'The one who asked'} has been told.
          </Callout>
        </div>
      )}
      {searchParams.cancelled && (
        <div className="mb-4" data-testid="reservation-cancelled">
          <Callout tone="good">The reservation was cancelled.</Callout>
        </div>
      )}

      {waiting.length > 0 && (
        <Card title={`Waiting for approval (${waiting.length})`} className="mb-5" bodyClassName="p-0">
          <ul data-testid="waiting-requests">
            {waiting.map((r) => (
              <li key={r.id} data-request={r.id} className="border-b-[0.5px] border-[#F0EEE8] px-[18px] py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <VanChip name={r.itemName} color={r.itemColor} waiting />
                  <Link href={`/portal/reservations/${r.id}`} className="text-[12.5px] font-bold text-parch-900 hover:underline">
                    {formatReservationTime(r)}
                  </Link>
                  <span className="text-[12.5px] text-parch-700">{r.service}</span>
                </div>
                {r.reason && <p className="mt-1 whitespace-pre-line text-[12.5px] text-parch-800">{r.reason}</p>}
                <p className="mt-0.5 text-[12px] text-parch-500">
                  Requested by {r.createdByName ?? 'someone no longer here'}
                  {r.servants.length > 0 && <>. Taking it: {andList(r.servants.map((s) => s.name))}</>}
                </p>
                <div className="mt-2">
                  <DecisionButtons id={r.id} status={r.status} asker={r.createdByName ?? 'The one who asked'} afterHref={`/portal/reservations?decided=${r.id}`} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No vans to reserve yet"
          hint={isAdmin ? 'Add the church’s vans under Manage vans.' : 'The Sunday School admin adds the vans that can be reserved.'}
        />
      ) : (
        <ul className="mb-5 grid gap-3 sm:grid-cols-2" aria-label="The vans" data-testid="van-cards">
          {items.map((item) => {
            const out = outNow.find((r) => r.itemId === item.id)
            return (
              <li key={item.id}>
                <Card bodyClassName="flex items-center gap-3">
                  <VanPicture color={item.color} photo={item.photo} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-parch-900">{item.name}</p>
                    {item.details && <p className="text-[11.5px] text-parch-500">{item.details}</p>}
                    <p className="mt-0.5 text-[12px]" data-testid="van-now">
                      {out ? (
                        <Link href={`/portal/reservations/${out.id}`} className="font-semibold text-[#B45309] hover:underline">
                          Out now, back {formatBackAt(out.endsAt, today)} ({out.servants.length > 0 ? andList(out.servants.map((s) => s.name)) : reservationPurpose(out)})
                        </Link>
                      ) : (
                        <span className="font-semibold text-[#16A34A]">Free now</span>
                      )}
                    </p>
                  </div>
                  <LinkButton href={`/portal/reservations/new?item=${item.id}`} variant="secondary" size="sm" className="shrink-0">
                    Reserve
                  </LinkButton>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {mine.length > 0 && (
        <Card title="Your reservations" className="mb-5" bodyClassName="p-0">
          <ul data-testid="my-reservations">
            {mine.slice(0, 6).map((r) => (
              <li key={r.id} className="border-b-[0.5px] border-[#F0EEE8] last:border-b-0">
                <Link href={`/portal/reservations/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-[18px] py-2.5 hover:bg-brand-wash">
                  <VanChip name={r.itemName} color={r.itemColor} waiting={r.status === 'PENDING'} />
                  <span className="text-[12.5px] font-bold text-parch-900">{formatReservationTime(r)}</span>
                  <span className="text-[12.5px] text-parch-600">{r.service}</span>
                  <StatusBadge status={r.status} endsAt={r.endsAt} now={now} />
                  {r.reason && <span className="line-clamp-1 w-full text-[12px] text-parch-500">{r.reason}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReservationCalendar span={span} days={reservationsByDay(month, span.start, span.end)} today={today} items={items} />
    </>
  )
}
