import { notFound } from 'next/navigation'
import { Bus } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import {
  defaultServiceFor,
  reservationItems,
  reservationServantChoices,
  reservationServiceOptions,
  reservationsBetween,
} from '@/lib/portal/data/reservations'
import { churchToday, parseDateOnly } from '@/lib/portal/dates'
import { BOOK_AHEAD_DAYS, MAX_RESERVATION_DAYS, canReserve } from '@/lib/portal/reservations'
import { Card, EmptyState, PageHeader } from '@/components/portal/ui'
import { ReservationForm } from '../ReservationForm'
import { takenSlots } from '../taken'

export const metadata = { title: 'Reserve a van' }

const DAY_MS = 86_400_000

/** A new reservation, with the day and the van filled in when they came from the calendar. */
export default async function NewReservationPage({ searchParams = {} }: { searchParams?: { date?: string; item?: string } }) {
  const user = await requirePortalUser()
  if (!canReserve(user.role)) notFound()

  const now = new Date()
  const today = churchToday(now)
  const [items, servants, services, service, upcoming] = await Promise.all([
    reservationItems(),
    reservationServantChoices(),
    reservationServiceOptions(),
    defaultServiceFor(user),
    reservationsBetween(now, new Date(now.getTime() + (BOOK_AHEAD_DAYS + MAX_RESERVATION_DAYS) * DAY_MS)),
  ])
  const asked = parseDateOnly(searchParams.date ?? '')
  const itemId = items.find((i) => i.id === searchParams.item)?.id ?? (items.length === 1 ? items[0]!.id : '')

  return (
    <>
      <PageHeader
        title="Reserve a van"
        icon={<Bus className="h-5 w-5" aria-hidden />}
        back={{ href: '/portal/reservations', label: 'Reservations' }}
        subtitle="Pick the van, the day and the hours, who is taking it, and what for."
      />
      {items.length === 0 ? (
        <EmptyState title="No vans to reserve yet" hint="The Sunday School admin adds the vans that can be reserved." />
      ) : (
        <Card>
          <ReservationForm
            items={items.map(({ id, name, color, details, photo }) => ({ id, name, color, details, photo }))}
            servants={servants}
            services={services}
            taken={takenSlots(upcoming)}
            today={today}
            submitLabel="Reserve"
            initial={{
              itemId,
              date: asked && asked >= today ? asked : '',
              from: '',
              until: '',
              untilDate: '',
              servantIds: user.servantId ? [user.servantId] : [],
              service: services.includes(service) ? service : '',
              note: '',
            }}
          />
        </Card>
      )}
    </>
  )
}
