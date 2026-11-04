import { notFound } from 'next/navigation'
import { Bus } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import {
  reservationApprovers,
  reservationById,
  reservationItems,
  reservationServantChoices,
  reservationServiceOptions,
  reservationsBetween,
} from '@/lib/portal/data/reservations'
import { churchClock, churchToday } from '@/lib/portal/dates'
import { andList, formatDateTime } from '@/lib/portal/format'
import {
  BOOK_AHEAD_DAYS,
  MAX_RESERVATION_DAYS,
  canReserve,
  formatReservationTime,
  mayCancelReservation,
  mayDecideReservation,
  mayEditReservation,
} from '@/lib/portal/reservations'
import { Badge, Card, PageHeader } from '@/components/portal/ui'
import { ReservationForm } from '../ReservationForm'
import { CancelReservationButton } from '../CancelReservationButton'
import { DecisionButtons } from '../DecisionButtons'
import { StatusBadge, VanPicture } from '../parts'
import { takenSlots } from '../taken'

export const metadata = { title: 'Reservation' }

const DAY_MS = 86_400_000

/**
 * One reservation: who has which van when, and for the people it belongs to,
 * the way to change or cancel it. Since 2026-11-04 it says where the request
 * stands, and the approvers answer it here.
 */
export default async function ReservationPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  if (!canReserve(user.role)) notFound()
  const r = await reservationById(params.id)
  if (!r) notFound()

  const now = new Date()
  const today = churchToday(now)
  const owned = { createdById: r.createdById, servantIds: r.servants.map((s) => s.id), endsAt: r.endsAt }
  const canEdit = mayEditReservation(user, owned, now)
  const canCancel = mayCancelReservation(user, owned, now)
  const over = r.endsAt <= now
  const month = churchClock(r.startsAt).date.slice(0, 7)

  const [allItems, servants, services, upcoming, approvers] = await Promise.all([
    reservationItems(true),
    canEdit ? reservationServantChoices() : Promise.resolve([]),
    canEdit ? reservationServiceOptions() : Promise.resolve([]),
    canEdit ? reservationsBetween(now, new Date(now.getTime() + (BOOK_AHEAD_DAYS + MAX_RESERVATION_DAYS) * DAY_MS)) : Promise.resolve([]),
    reservationApprovers(),
  ])
  const decides = mayDecideReservation(user, approvers.map((a) => a.servantId))
  const approverNames = approvers.length > 0 ? andList(approvers.map((a) => a.name)) : 'the admin'
  const asker = r.createdByName ?? 'The one who asked'
  const approval = decides
    ? undefined
    : r.status === 'APPROVED'
      ? `Changing the van, the day, the times, the service or the reason sends it to ${approverNames} for approval again.`
      : r.status === 'REJECTED'
        ? `Asking again sends it to ${approverNames} for approval.`
        : `It is waiting for approval from ${approverNames}.`
  const van = allItems.find((i) => i.id === r.itemId)
  // Its own van stays on the list though it was retired since; nobody else may pick that one.
  const formItems = allItems.filter((i) => i.isActive || i.id === r.itemId).map(({ id, name, color, details, photo }) => ({ id, name, color, details, photo }))
  const from = churchClock(r.startsAt)
  const until = churchClock(r.endsAt)
  const what = `the ${r.itemName}, ${formatReservationTime(r)}`

  return (
    <>
      <PageHeader
        title={r.itemName}
        icon={<Bus className="h-5 w-5" aria-hidden />}
        back={{ href: `/portal/reservations?month=${month}`, label: 'Reservations' }}
        subtitle={formatReservationTime(r)}
      />

      <Card className="mb-5" bodyClassName="flex flex-wrap gap-4">
        <VanPicture color={r.itemColor} photo={van?.photo ?? null} size="lg" />
        <dl className="grid min-w-[240px] flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]" data-testid="reservation-details">
          <dt className="font-bold text-parch-500">When</dt>
          <dd className="font-bold text-parch-900">
            {formatReservationTime(r)}
            {over ? (
              <span className="ml-2">
                <Badge>Over</Badge>
              </span>
            ) : r.startsAt <= now ? (
              <span className="ml-2">
                <Badge tone="warn">Out now</Badge>
              </span>
            ) : null}
          </dd>
          <dt className="font-bold text-parch-500">Status</dt>
          <dd className="text-parch-900" data-testid="reservation-status">
            <span className="mr-2">
              <StatusBadge status={r.status} endsAt={r.endsAt} now={now} />
            </span>
            {r.status === 'PENDING' && !over && <>from {approverNames}</>}
            {r.status !== 'PENDING' && r.decidedByName && (
              <>
                by {r.decidedByName}
                {r.decidedAt && <span className="text-parch-500">, {formatDateTime(r.decidedAt)}</span>}
              </>
            )}
            {r.status === 'REJECTED' && r.decisionNote && <span className="mt-0.5 block whitespace-pre-line text-parch-700">“{r.decisionNote}”</span>}
          </dd>
          <dt className="font-bold text-parch-500">For</dt>
          <dd className="text-parch-900">{r.service}</dd>
          {r.reason && (
            <>
              <dt className="font-bold text-parch-500">Reason</dt>
              <dd className="whitespace-pre-line text-parch-900" data-testid="reservation-reason">
                {r.reason}
              </dd>
            </>
          )}
          <dt className="font-bold text-parch-500">Servants</dt>
          <dd className="text-parch-900">{r.servants.length > 0 ? andList(r.servants.map((s) => s.name)) : 'Nobody'}</dd>
          <dt className="font-bold text-parch-500">Requested by</dt>
          <dd className="text-parch-700">{r.createdByName ?? 'Someone no longer here'}</dd>
          {van?.details && (
            <>
              <dt className="font-bold text-parch-500">Van</dt>
              <dd className="text-parch-700">{van.details}</dd>
            </>
          )}
        </dl>
      </Card>

      {decides && !over && (
        <Card title={r.status === 'PENDING' ? 'Approve or reject' : r.status === 'APPROVED' ? 'Reject it after all' : 'Approve it after all'} className="mb-5">
          <p className="mb-3 text-[12.5px] text-parch-600">{asker} is told your answer.</p>
          <DecisionButtons id={r.id} status={r.status} asker={asker} />
        </Card>
      )}

      {canEdit ? (
        <Card title={r.status === 'REJECTED' && !decides ? 'Change it and ask again' : 'Change it'} className="mb-5">
          <ReservationForm
            items={formItems}
            servants={servants}
            services={services.includes(r.service) ? services : [...services, r.service]}
            taken={takenSlots(upcoming)}
            today={today}
            submitLabel={r.status === 'REJECTED' && !decides ? 'Ask again' : 'Save changes'}
            approval={approval}
            initial={{
              id: r.id,
              itemId: r.itemId,
              date: from.date,
              from: from.time,
              until: until.time,
              untilDate: until.date !== from.date ? until.date : '',
              servantIds: r.servants.map((s) => s.id),
              service: r.service,
              reason: r.reason ?? '',
            }}
          />
          <div className="mt-4 border-t border-[#F0EEE8] pt-4">
            <CancelReservationButton id={r.id} what={what} />
          </div>
        </Card>
      ) : canCancel ? (
        <Card title="Take it off" className="mb-5">
          <p className="mb-3 text-[12.5px] text-parch-600">This reservation is over. Taking it off removes it from the calendar.</p>
          <CancelReservationButton id={r.id} what={what} label="Take it off the calendar" />
        </Card>
      ) : (
        <p className="text-[12.5px] text-parch-500" data-testid="reservation-readonly">
          {over
            ? 'This reservation is over.'
            : 'Only the one who made this reservation, the servants on it, or the admin can change it.'}{' '}
          <span className="text-parch-400">Saved {formatDateTime(r.createdAt)}.</span>
        </p>
      )}
    </>
  )
}
