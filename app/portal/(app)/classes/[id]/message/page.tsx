import { Send } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import Link from '@/components/portal/Link'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { sessionsForClass } from '@/lib/portal/class-members'
import { latestRegister, loadMissedMeeting, meetingMessage, registerDates } from '@/lib/portal/data/family-messages'
import { churchToday, parseDateOnly } from '@/lib/portal/dates'
import { formatShortDate } from '@/lib/portal/format'
import { PageHeader, EmptyState, LinkButton, inputClass, buttonClass } from '@/components/portal/ui'
import { cn } from '@/lib/utils'
import { FamilyMessenger } from './FamilyMessenger'
import { MEMBER_MESSAGE, isFellowship } from '@/lib/portal/fellowship'
import { STANDARD_MESSAGE, greetingName } from '@/lib/portal/family-messages'

export const metadata = { title: 'Message families' }

/**
 * Message families (2026-10-19): one message for every family whose child
 * missed a meeting. A servant asked for it after the Friday Bible Study. Its
 * message should say which chapters they read, not repeat Sunday's, and
 * changing it inside every child's own composer meant copy-pasting it once per
 * child. Here it is written once, and each family's button opens WhatsApp or
 * Messages with their child's copy already in it.
 *
 * Any servant who follows the class up may use it, whoever's group the child is
 * in; every message sent is noted on the child's follow-ups.
 */
export default async function MessageFamiliesPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { session?: string; date?: string }
}) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'followup.write')
  const today = churchToday()
  // A Fellowship meeting (2026-10-24) messages its members, about its own meeting.
  const members = isFellowship(cls.stage)
  const sessions = sessionsForClass(
    await prisma.attendanceSession.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: { key: true, label: true, classId: true },
    }),
    cls.id,
  ).filter((s) => !members || s.classId === cls.id)

  const header = (subtitle: string) => (
    <PageHeader
      title={members ? 'Message members' : 'Message families'}
      subtitle={subtitle}
      icon={<Send className="h-5 w-5" aria-hidden />}
      back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
    />
  )
  if (sessions.length === 0) {
    return (
      <>
        {header(cls.name)}
        <EmptyState title="No meetings are set up" hint="An admin turns meetings on under Sessions & Points." />
      </>
    )
  }

  // With nothing asked for, open on the class's most recent register: the
  // meeting a servant has just taken, or the last one they took.
  const askedDate = parseDateOnly(searchParams.date)
  let session = sessions.find((s) => s.key === searchParams.session)
  let date = askedDate
  if (!session) {
    const last = await latestRegister(cls.id, sessions.map((s) => s.key), askedDate ?? today)
    session =
      sessions.find((s) => s.key === last?.sessionKey) ??
      sessions.find((s) => s.classId === cls.id) ??
      sessions.find((s) => s.key === 'sunday') ??
      sessions[0]!
    date = date ?? last?.date ?? null
  }
  if (!date) date = (await latestRegister(cls.id, [session.key], today))?.date ?? today

  const [dates, missed, saved] = await Promise.all([
    registerDates(cls.id, session.key, 8),
    loadMissedMeeting({ classId: cls.id, session, date, today }),
    meetingMessage(cls.id, session.key, members ? MEMBER_MESSAGE : STANDARD_MESSAGE),
  ])
  const dayChips = dates.includes(date) ? dates : [date, ...dates].sort().reverse()
  const registerHref = `/portal/classes/${cls.id}/attendance?session=${session.key}&date=${date}`

  return (
    <>
      {header(`${cls.name} · ${session.label} · ${formatShortDate(date)}`)}

      {/* Which meeting, then which day it was taken. */}
      <div className="mb-3 flex flex-wrap gap-2" aria-label="Meeting">
        {sessions.map((s) => (
          <Link
            key={s.key}
            href={`/portal/classes/${cls.id}/message?session=${s.key}`}
            aria-current={s.key === session.key ? 'page' : undefined}
            className={cn(
              'rounded-[10px] px-3.5 py-2 text-[12px] font-bold transition-all',
              s.key === session.key
                ? 'bg-[linear-gradient(120deg,#6F1D1B_0%,#7A2A2A_50%,#C89B3C_100%)] text-white shadow-[0_4px_12px_rgba(90,31,31,.28)]'
                : 'border border-parch-200 bg-parch-100 text-parch-600 hover:border-brand-gold/50 hover:text-brand-800',
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-1.5" aria-label="Day">
        {dayChips.map((d) => (
          <Link
            key={d}
            href={`/portal/classes/${cls.id}/message?session=${session.key}&date=${d}`}
            aria-current={d === date ? 'page' : undefined}
            className={cn(
              'rounded-[20px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.3px] transition-colors',
              d === date ? 'border-brand-gold bg-brand-wash text-brand-800' : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800',
            )}
          >
            {formatShortDate(d)}
          </Link>
        ))}
        {/* Any other day, without JavaScript. */}
        <form method="get" className="flex items-center gap-1.5">
          <input type="hidden" name="session" value={session.key} />
          <input type="date" name="date" defaultValue={date} max={today} aria-label="Another day" className={cn(inputClass, 'w-auto py-1 text-[12px]')} />
          <button type="submit" className={buttonClass('secondary', 'sm')}>Go</button>
        </form>
      </div>

      {!missed.held ? (
        <EmptyState
          title={`No ${session.label} register on ${formatShortDate(date)}`}
          hint={
            members
              ? 'The message goes to the members a register says were not there. Take it first, or pick a day it was taken.'
              : 'The message goes to the families of the children a register says were not there. Take it first, or pick a day it was taken.'
          }
          action={<LinkButton href={registerHref}>Take the register</LinkButton>}
        />
      ) : missed.kids.length === 0 ? (
        <EmptyState
          title={`Nobody missed ${session.label} on ${formatShortDate(date)}`}
          hint={members ? 'Every member on the register was there or excused.' : 'Every child on the register was there or excused.'}
          action={<LinkButton href={registerHref} variant="secondary">Open the register</LinkButton>}
        />
      ) : (
        <FamilyMessenger
          // A fresh page for each meeting and day: its own message and its own draft.
          key={`${session.key}:${date}`}
          classId={cls.id}
          sessionKey={session.key}
          meeting={session.label}
          date={date}
          today={today}
          saved={saved}
          kids={missed.kids}
          members={members}
          sender={greetingName(user.displayName)}
        />
      )}
    </>
  )
}
