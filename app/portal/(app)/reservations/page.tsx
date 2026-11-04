import Link from '@/components/portal/Link'
import { notFound } from 'next/navigation'
import { Bus, Plus, Settings2 } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { reservationById, reservationItems, reservationsBetween, upcomingReservationsOf } from '@/lib/portal/data/reservations'
import { calendarSpan } from '@/lib/portal/calendar-spans'
import { addDays, churchDayStart, churchToday } from '@/lib/portal/dates'
import { andList } from '@/lib/portal/format'
import { canReserve, formatBackAt, formatReservationTime, reservationPurpose, reservationsByDay } from '@/lib/portal/reservations'
import { Callout, Card, EmptyState, LinkButton, PageHeader } from '@/components/portal/ui'
import { ReservationCalendar } from './ReservationCalendar'
import { VanChip, VanPicture } from './parts'

export const metadata = { title: 'Reservations' }

/**
 * Van reservations (2026-11-02): "Can we do something for the Vans … To
 * organize using them", and "a calendar on who using what". Every servant sees
 * every reservation; each van shows whether it is out right now.
 */
export default async function ReservationsPage({
  searchParams = {},
}: {
  searchParams?: { month?: string; saved?: string; cancelled?: string }
}) {
  const user = await requirePortalUser()
  if (!canReserve(user.role)) notFound()

  const now = new Date()
  const today = churchToday(now)
  const span = calendarSpan({ month: searchParams.month }, today)
  const [items, month, outNow, mine, saved] = await Promise.all([
    reservationItems(),
    reservationsBetween(churchDayStart(span.start), churchDayStart(addDays(span.end, 1))),
    reservationsBetween(now, new Date(now.getTime() + 1)),
    upcomingReservationsOf(user, now),
    searchParams.saved ? reservationById(searchParams.saved) : Promise.resolve(null),
  ])
  const isAdmin = user.role === 'ADMIN'

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
          <Callout tone="good" title="Saved">
            {saved.itemName} for {reservationPurpose(saved)}: {formatReservationTime(saved)}.{' '}
            <Link href={`/portal/reservations/${saved.id}`} className="font-bold underline">
              Open it
            </Link>
          </Callout>
        </div>
      )}
      {searchParams.cancelled && (
        <div className="mb-4" data-testid="reservation-cancelled">
          <Callout tone="good">The reservation was cancelled.</Callout>
        </div>
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
                  <VanChip name={r.itemName} color={r.itemColor} />
                  <span className="text-[12.5px] font-bold text-parch-900">{formatReservationTime(r)}</span>
                  <span className="text-[12.5px] text-parch-600">{reservationPurpose(r)}</span>
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
