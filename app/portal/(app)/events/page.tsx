import { Clock, ExternalLink, MapPin, Share2, Mail, Users } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listEvents, type EventView } from '@/lib/portal/data/community'
import { todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate, formatShortDate, initials } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, EmptyState, SectionTitle } from '@/components/portal/ui'
import { EventManager } from './EventManager'

export const metadata = { title: 'Events' }

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Everything a person needs if they forward this to a parent. */
function shareText(event: EventView): string {
  return [
    event.title,
    `${formatLongDate(event.date)}${event.time ? ` · ${event.time}` : ''}`,
    event.location ? `Where: ${event.location}` : null,
    event.notes,
    event.link,
    '— St. Kyrillos VI Sunday School',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * The prototype's `.ev-dt` block: month over a big Playfair day number over the
 * weekday. Gold when it is today, burgundy when it is still to come, flat grey
 * once it has passed.
 */
function DateBlock({ date, today, past }: { date: string; today: string; past: boolean }) {
  const d = new Date(`${date}T12:00:00`)
  const isToday = date === today
  return (
    <div
      className={
        'flex w-[76px] shrink-0 flex-col items-center justify-center gap-1 px-2 py-[18px] ' +
        (isToday
          ? 'bg-[linear-gradient(160deg,#C89B3C_0%,#B08540_100%)]'
          : past
            ? 'bg-parch-500'
            : 'bg-[linear-gradient(160deg,#6F1D1B_0%,#7A2A2A_100%)]')
      }
    >
      <span className="text-[10px] font-bold uppercase tracking-[1px] text-white/60">{MONTHS[d.getMonth()]}</span>
      <span className="font-serif text-[26px] font-extrabold leading-none text-white">{d.getDate()}</span>
      <span className="text-[10px] uppercase tracking-[0.5px] text-white/50">{DAYS[d.getDay()]}</span>
      {isToday && (
        <span className="mt-0.5 rounded-[8px] bg-parch-50/25 px-1.5 py-px text-[9px] font-extrabold text-white">TODAY</span>
      )}
    </div>
  )
}

function EventRow({
  event,
  today,
  classes,
  canTargetAll,
  past = false,
}: {
  event: EventView
  today: string
  classes: Array<{ id: string; name: string }>
  canTargetAll: boolean
  past?: boolean
}) {
  const text = shareText(event)
  const isToday = event.date === today
  const forText = event.targetAll ? 'All classes' : event.classNames.join(', ')
  const accent = accentFor(event.classIds[0] ?? event.id)

  return (
    <div
      className={
        'flex overflow-hidden rounded-[16px] border-[1.5px] bg-parch-50 ' +
        (isToday ? 'border-brand-gold shadow-panel' : 'border-[#EFE9DC] shadow-card') +
        (past ? ' opacity-60' : '')
      }
    >
      <DateBlock date={event.date} today={today} past={past} />

      <div className="min-w-0 flex-1 p-[18px]">
        {/* Who posted it. */}
        <div className="mb-3.5 flex items-center gap-2 border-b border-[#F0EEE8] pb-3.5">
          <span
            aria-hidden
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white"
            style={{ background: accent }}
          >
            {initials(event.createdByName)}
          </span>
          <span className="truncate text-[11.5px] text-parch-500">{event.createdByName}</span>
        </div>

        <h3 className="font-serif text-[15px] font-bold leading-snug text-parch-900">{event.title}</h3>

        <dl className="mt-1.5 space-y-1">
          {event.time && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-parch-500">
              <dt className="sr-only">Time</dt>
              <Clock className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden />
              <dd>{event.time}</dd>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-parch-500">
              <dt className="sr-only">Where</dt>
              <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden />
              <dd>{event.location}</dd>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[12.5px] text-parch-500">
            <dt className="sr-only">Date</dt>
            <dd>{formatLongDate(event.date)}</dd>
          </div>
        </dl>

        {forText && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-[20px] bg-brand-wash px-[11px] py-[5px] text-[11px] font-bold text-brand-gold-dark">
            <Users className="h-3 w-3" aria-hidden /> This event is for: {forText}
          </p>
        )}

        {event.link && (
          <p className="mt-2">
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-parch-200 bg-parch-100 px-3.5 text-[12px] font-bold text-brand-800 transition-colors hover:border-brand-gold/60 hover:bg-brand-wash"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Details
            </a>
          </p>
        )}

        {event.notes && (
          <p className="mt-2.5 whitespace-pre-line rounded-[8px] bg-parch-100 px-[11px] py-2 text-[12px] leading-[1.6] text-parch-600">
            {event.notes}
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#F5F2ED] pt-3 print:hidden">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
            <Share2 className="h-3.5 w-3.5" aria-hidden /> Share
          </span>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[20px] bg-[#F0FDF4] px-3 text-[11px] font-bold text-[#166534] transition-opacity hover:opacity-80"
          >
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(text)}`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[20px] bg-[#EFF6FF] px-3 text-[11px] font-bold text-[#1D4ED8] transition-opacity hover:opacity-80"
          >
            <Mail className="h-3 w-3" aria-hidden /> Email
          </a>
        </div>

        {event.canManage && (
          <EventManager
            classes={classes}
            canTargetAll={canTargetAll}
            event={{
              id: event.id,
              title: event.title,
              date: event.date,
              time: event.time,
              location: event.location,
              link: event.link,
              notes: event.notes,
              targetAll: event.targetAll,
              classIds: event.classIds,
            }}
          />
        )}
      </div>
    </div>
  )
}

export default async function EventsPage() {
  const user = await requirePortalUser()
  const today = todayInNewYork()
  const { scope, upcoming, past } = await listEvents(user, today)

  const canTargetAll = user.role === 'ADMIN' || user.role === 'PASTOR'
  // A servant may only address the classes they actually serve, even though
  // they can read the ones they oversee.
  const targetable = canTargetAll ? scope.classes : scope.classes.filter((c) => user.classIds.includes(c.id))
  const canCreate = canTargetAll || (user.role === 'SERVANT' && targetable.length > 0)

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Retreats, trips and services coming up for your classes."
        actions={canCreate ? <EventManager classes={targetable} canTargetAll={canTargetAll} /> : undefined}
      />

      {upcoming.length === 0 ? (
        <EmptyState
          title="Nothing on the calendar yet"
          hint={canCreate ? 'Add the next retreat, trip or meeting so everyone can see it.' : 'Check back soon — new events show up here.'}
        />
      ) : (
        <div className="space-y-4">
          {upcoming.map((e) => (
            <EventRow key={e.id} event={e} today={today} classes={targetable} canTargetAll={canTargetAll} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="group mt-8">
          <summary className="cursor-pointer list-none rounded-[10px] border border-parch-200 bg-parch-50 px-4 py-3 text-[12px] font-bold text-parch-600 transition-colors hover:border-brand-gold/50 hover:text-brand-800">
            {past.length} past event{past.length === 1 ? '' : 's'} · {formatShortDate(past[0].date)} and earlier
          </summary>
          <div className="mt-4 space-y-4">
            <SectionTitle hint="Already happened">Past events</SectionTitle>
            {past.map((e) => (
              <EventRow key={e.id} event={e} today={today} classes={targetable} canTargetAll={canTargetAll} past />
            ))}
          </div>
        </details>
      )}
    </>
  )
}
