import Image from 'next/image'
import { Clock, ExternalLink, MapPin, Share2, Mail, Users, Play } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listEvents, type EventView } from '@/lib/portal/data/community'
import { todayInNewYork } from '@/lib/portal/dates'
import { formatLongDate, formatShortDate, initials, formatTimeOfDay } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { youtubeId, youtubeThumbnail } from '@/lib/portal/links'
import { PageHeader, EmptyState, SectionTitle } from '@/components/portal/ui'
import { EventManager } from './EventManager'

export const metadata = { title: 'Events' }

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Everything a person needs if they forward this to a parent. */
function shareText(event: EventView): string {
  return [
    event.title,
    `${formatLongDate(event.date)}${event.time ? ` · ${formatTimeOfDay(event.time)}` : ''}`,
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
          {/* F0315 — the poster's face when there is one, their initials when
              there is not. Initials alone say nothing on a church-wide feed
              where two servants can share them. */}
          {event.createdByPhoto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={event.createdByPhoto}
              alt=""
              className="h-[26px] w-[26px] shrink-0 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 1.5px ${accent}` }}
            />
          ) : (
            <span
              aria-hidden
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white"
              style={{ background: accent }}
            >
              {initials(event.createdByName)}
            </span>
          )}
          <span className="truncate text-[11.5px] text-parch-500">
            {event.createdByName}
            {/* F0657 — who they are to the church, not just their name. Two at
                most: a servant on five classes would otherwise take the row. */}
            {event.createdByClasses.length > 0 && (
              <span className="text-parch-400">
                {' · '}
                {event.createdByClasses.slice(0, 2).join(', ')}
                {event.createdByClasses.length > 2 ? ` +${event.createdByClasses.length - 2}` : ''}
              </span>
            )}
          </span>
        </div>

        <h3 className="font-serif text-[15px] font-bold leading-snug text-parch-900">{event.title}</h3>

        <dl className="mt-1.5 space-y-1">
          {event.time && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-parch-500">
              <dt className="sr-only">Time</dt>
              <Clock className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden />
              <dd>{formatTimeOfDay(event.time)}</dd>
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

        {event.link && <LinkPreview href={event.link} />}

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

/**
 * F0768 — a YouTube link on an event card rendered as the same grey "Details"
 * pill as a sign-up form, so the clip a servant posted for the retreat looked
 * like paperwork and nobody opened it. The prototype showed the thumbnail with
 * a play button (OG :15040-15046).
 *
 * The thumbnail goes through next/image deliberately: the portal's CSP is
 * `img-src 'self' data:` (next.config.js), so a bare <img> pointed at
 * img.youtube.com renders an empty box — and proxying it keeps every child's
 * IP address out of Google's logs. The id pattern is anchored to the YouTube
 * hosts rather than the prototype's bare `v=`, which would have put a broken
 * thumbnail on any unrelated link that happened to carry that parameter.
 */
function LinkPreview({ href }: { href: string }) {
  // Shared with the class feed so a /live/ link cannot preview on one surface
  // and not the other, which is what two separate copies of this regex did.
  const ytId = youtubeId(href)

  if (!ytId) {
    return (
      <p className="mt-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-parch-200 bg-parch-100 px-3.5 text-[12px] font-bold text-brand-800 transition-colors hover:border-brand-gold/60 hover:bg-brand-wash"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Details
        </a>
      </p>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-link-preview="youtube"
      className="group relative mt-2 block w-[280px] max-w-full overflow-hidden rounded-[10px]"
    >
      <Image
        src={youtubeThumbnail(ytId)}
        alt=""
        width={480}
        height={360}
        className="h-[158px] w-full object-cover"
      />
      <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/10">
        <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#FF0000] shadow-[0_3px_12px_rgba(0,0,0,.4)]">
          <Play className="h-[18px] w-[18px] translate-x-[1px] fill-white text-white" />
        </span>
      </span>
      <span className="absolute bottom-2 left-2 rounded-[8px] bg-black/70 px-[7px] py-[2px] text-[11px] font-bold text-white">
        Watch on YouTube
      </span>
    </a>
  )
}

export default async function EventsPage() {
  const user = await requirePortalUser()
  const today = todayInNewYork()
  const { scope, upcoming, past } = await listEvents(user, today)

  const canTargetAll = user.role === 'ADMIN' || user.role === 'PASTOR'
  // A servant addresses the classes they serve — and, F0313, the classes in the
  // stage they oversee. An event is visible to everybody whichever classes it
  // names, so this is the label widening rather than the audience; a coordinator
  // who teaches no single class previously had no target at all and could not
  // add an event. "The whole Sunday School" still belongs to the admin and
  // Fr. Pachom.
  const targetable = canTargetAll
    ? scope.classes
    : scope.classes.filter(
        (c) => user.classIds.includes(c.id) || (!!user.stageOversight && c.stage === user.stageOversight),
      )
  const canCreate = canTargetAll || (user.role === 'SERVANT' && targetable.length > 0)

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Retreats, trips and services coming up for your classes."
      />

      {/* F0312 — EventManager was passed as the header's `actions`, and
          PageHeader renders actions *inside* the dark maroon banner. Opening
          "Add event" therefore drew the whole form — labels, inputs,
          checkboxes — on the burgundy ground, unreadable. The trigger and the
          form are one component with one piece of state, so the component
          moves out of the banner rather than being split in two. */}
      {canCreate && (
        <div className="mb-5">
          <EventManager classes={targetable} canTargetAll={canTargetAll} />
        </div>
      )}

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

      {/* F0311 — the prototype listed today, then what is coming, then what has
          been, in one column (OG :15082-15085). The port shut the past behind a
          closed accordion, so "when was the last retreat?" had a click in front
          of it that nothing on screen suggested. Open by default, still
          collapsible — which is better than the prototype, not a copy of it.
          The query stops at the 25 most recent (lib/portal/data/community.ts:168)
          and the summary now says so instead of reading as the whole history. */}
      {past.length > 0 && (
        <details open className="group mt-8">
          <summary className="cursor-pointer list-none rounded-[10px] border border-parch-200 bg-parch-50 px-4 py-3 text-[12px] font-bold text-parch-600 transition-colors hover:border-brand-gold/50 hover:text-brand-800">
            {past.length} past event{past.length === 1 ? '' : 's'} · {formatShortDate(past[0].date)} and earlier
            {past.length >= 25 ? ' · most recent 25 only' : ''}
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
