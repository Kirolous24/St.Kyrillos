import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Cake, CalendarDays, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { upcomingBirthdays, birthdaysInWeek } from '@/lib/portal/birthdays'
import { todayInNewYork, formatDateOnly, toUTCDate, mondayOf, addDays } from '@/lib/portal/dates'
import { formatShortDate, formatMonthDay, formatLongDate } from '@/lib/portal/format'
import { PageHeader, Card, Badge, Avatar, EmptyState, LinkButton } from '@/components/portal/ui'

export const metadata = { title: 'Birthdays' }

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** A cake tile, the prototype's `bdRow`: round icon, name, day, "Turns n" pill. */
function CakeTile({
  name, on, turning, meta, href, tone, isToday, isServant,
}: {
  name: string
  on: string
  turning: number
  meta?: string
  href?: string
  tone: 'now' | 'soon'
  /** True on the day itself — the prototype marked it, the port did not. */
  isToday?: boolean
  isServant?: boolean
}) {
  const body = (
    <>
      <span
        className={[
          'mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full',
          /* F0509 — next week's tile was cream with a gold icon, identical to
             this week's, so the board a servant scans on a Sunday gave no
             signal about which birthdays still have time to prepare for. The
             prototype's bdRow() accented next week in blue (#EFF6FF/#1D4ED8);
             the "Turns n" badge already carries that blue, the card did not. */
          tone === 'now' ? 'bg-gradient-to-br from-brand-800 to-brand-gold text-parch-50' : 'bg-[#DBEAFE] text-[#1D4ED8]',
        ].join(' ')}
        aria-hidden
      >
        <Cake className="h-5 w-5" />
      </span>
      <p className="truncate text-[11.5px] font-bold text-parch-900" title={name}>
        {name}
        {/* F0243 — a servant's name in the same grid as the children's was
            indistinguishable from a child's. */}
        {isServant && <span className="font-normal text-parch-500"> (servant)</span>}
      </p>
      {meta && <p className="truncate text-[10px] text-parch-500">{meta}</p>}
      {/* F0250 — nothing said a birthday was *today*, which is the one day the
          card exists to catch. */}
      <p className={cn('mb-2 text-[10.5px]', isToday ? 'font-bold text-brand-800' : 'text-parch-500')}>
        {isToday ? `🎉 Today · ${formatShortDate(on)}` : formatShortDate(on)}
      </p>
      <Badge tone={isToday ? 'gold' : tone === 'now' ? 'gold' : 'info'}>Turns {turning}</Badge>
    </>
  )
  const cls =
    'block rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 px-2.5 py-3.5 text-center shadow-card transition-shadow hover:shadow-panel'
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

/** A compact person tile for the month lists: initials, date, how far off. */
function PersonTile({
  name, on, turning, daysUntil, meta, href,
}: {
  name: string
  on: string
  turning?: number
  daysUntil: number
  meta?: string
  href?: string
}) {
  const weeks = Math.max(1, Math.ceil(daysUntil / 7))
  const away =
    daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : daysUntil <= 6 ? 'This week' : daysUntil <= 13 ? 'Next week' : `In ${weeks} wks`
  // F0512 — the roster said how far off each birthday was in words only, so
  // "who is coming up" meant reading every tile in a grid of a hundred. The
  // prototype put a dot on each row — green this week, gold next, grey after —
  // which is what makes a wall of names scannable at arm's length. Driven by
  // the same daysUntil thresholds as the label beside it, so the two can never
  // tell different stories.
  const dot = daysUntil <= 6 ? '#16A34A' : daysUntil <= 13 ? '#C89B3C' : '#B9B2A5'
  const body = (
    <>
      <span className="mx-auto mb-2 block w-fit">
        <Avatar name={name} size="sm" />
      </span>
      <p className="truncate text-[11px] font-bold text-parch-900" title={name}>{name}</p>
      {meta && <p className="truncate text-[10px] text-parch-500">{meta}</p>}
      <p className="text-[10px] text-parch-500">
        {formatShortDate(on)}
        {turning !== undefined && <> &middot; turns {turning}</>}
      </p>
      <p className={`mt-1 flex items-center justify-center gap-1.5 text-[10px] font-bold ${daysUntil <= 13 ? 'text-brand-gold-dark' : 'text-parch-500'}`}>
        <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: dot }} />
        {away}
      </p>
    </>
  )
  const cls =
    'block rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 px-2 py-3 text-center shadow-card transition-shadow hover:shadow-panel'
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export default async function BirthdaysPage({ searchParams }: { searchParams: { show?: string } }) {
  const user = await requirePortalUser()
  const classes = await listVisibleClasses(user)
  const classIds = classes.map((c) => c.id)
  const today = todayInNewYork()
  // The prototype had a full roster as well as the near-term board; at 60 days
  // anyone further out appeared nowhere in the portal at all.
  const showAll = searchParams.show === 'all'
  const windowDays = showAll ? 366 : 60

  const [students, servants] = await Promise.all([
    prisma.student.findMany({ where: { classId: { in: classIds } }, select: { id: true, firstName: true, lastName: true, dob: true, class: { select: { name: true } } } }),
    user.role === 'STUDENT'
      ? Promise.resolve([])
      : prisma.servant.findMany({
          where: user.role === 'SERVANT' ? { classes: { some: { classId: { in: classIds } } } } : {},
          select: { id: true, birthday: true, account: { select: { displayName: true } } },
        }),
  ])

  const studentRows = upcomingBirthdays(
    students.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null, className: s.class?.name ?? '' })),
    today, windowDays,
  )
  const servantRows = upcomingBirthdays(
    servants.map((s) => ({ id: s.id, name: s.account.displayName, dob: s.birthday ? formatDateOnly(s.birthday) : null })),
    today, windowDays,
  )

  const canOpen = user.role !== 'STUDENT'

  // F0511 — the prototype's "All Students, sorted by date" was permanently on
  // the page; here the whole year lived behind ?show=all, so the roster a
  // servant scans for "who is coming up" was one click away from not existing.
  // The students are already all loaded — `upcomingBirthdays` filters in
  // memory — so the full roster costs nothing extra and is always rendered,
  // collapsed, beneath the near-term board.
  const wholeRoster = upcomingBirthdays(
    students.map((s) => ({ id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null, className: s.class?.name ?? '' })),
    today, 366,
  )

  // Calendar weeks, Monday to Sunday in ET, as the prototype had them. A
  // rolling seven days from today drops everyone earlier in the week as soon as
  // it is Sunday, which is exactly when a servant looks for who to greet.
  const weekStart = mondayOf(today)
  const nextWeekStart = addDays(weekStart, 7)
  const studentPeople = students.map((s) => ({
    id: s.id, name: studentName(s), dob: s.dob ? formatDateOnly(s.dob) : null, className: s.class?.name ?? '',
  }))
  // F0251 — the week cards listed children only; servants sat in a separate
  // card at the foot of the page, so a servant whose birthday was this Sunday
  // was invisible on the one card the church actually reads. They join the week
  // buckets, marked as servants so the two are still distinguishable (F0243).
  const servantPeople = servants.map((s) => ({
    id: s.id,
    name: s.account.displayName,
    dob: s.birthday ? formatDateOnly(s.birthday) : null,
    className: 'Servant',
    isServant: true as const,
  }))
  const weekPeople = [...studentPeople, ...servantPeople]
  const thisWeek = birthdaysInWeek(weekPeople, weekStart, today)
  const nextWeek = birthdaysInWeek(weekPeople, nextWeekStart, today)
  const isServantId = new Set(servantPeople.map((p) => p.id))

  // Anything beyond next week still comes from the forward window, grouped by month.
  const nextWeekEnd = addDays(nextWeekStart, 6)
  const later = studentRows.filter((b) => b.on > nextWeekEnd)

  // Whose date of birth is missing entirely — the prototype showed these so a
  // servant could see whose record still needed filling in.
  const missingDob = studentPeople
    .filter((p) => !p.dob)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Group what is left by the month the birthday falls in, keeping order.
  const months: Array<{ key: string; label: string; people: typeof later }> = []
  for (const b of later) {
    const d = toUTCDate(b.on)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
    const last = months[months.length - 1]
    if (last && last.key === key) last.people.push(b)
    else months.push({ key, label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`, people: [b] })
  }

  return (
    <>
      <PageHeader
        title="Birthdays"
        /* F0507 — the Monday-to-Sunday range is already computed for the week
           cards below; it was never shown to the person reading the page. On a
           Sunday "this week" is ambiguous exactly when it matters — the servant
           checking who to greet cannot tell whether it means the week just
           ending or the one starting. The dates settle it. */
        subtitle={`${formatLongDate(weekStart)} – ${formatLongDate(addDays(weekStart, 6))} · ${
          showAll ? 'everyone, across the whole year' : 'everyone celebrating in the next 60 days'
        }`}
        icon={<Cake className="h-5 w-5" />}
        actions={
          <LinkButton href={showAll ? '/portal/birthdays' : '/portal/birthdays?show=all'} variant="secondary">
            {showAll ? 'Show next 60 days' : 'Show the whole year'}
          </LinkButton>
        }
      />

      <div className="mb-4">
        <Card
          title="This week"
          icon={<Cake className="h-4 w-4" />}
          /* F0508 — the card said how many were celebrating but never which
             seven days it meant, so "this week" on a Sunday was ambiguous
             exactly when it mattered. */
          action={
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              {formatMonthDay(weekStart)}&ndash;{formatMonthDay(addDays(weekStart, 6))} · {thisWeek.length} celebrating
            </span>
          }
        >
          {thisWeek.length === 0 ? (
            <p className="py-5 text-center text-[12.5px] text-parch-500">No birthdays this week.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
              {thisWeek.map((b) => (
                <CakeTile
                  key={b.id}
                  name={b.name}
                  on={b.on}
                  turning={b.turning}
                  meta={b.className || undefined}
                  tone="now"
                  isToday={b.daysUntil === 0}
                  isServant={isServantId.has(b.id)}
                  href={canOpen && !isServantId.has(b.id) ? `/portal/students/${b.id}` : undefined}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mb-4">
        <Card
          title="Next week"
          icon={<Cake className="h-4 w-4" />}
          action={
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              {formatMonthDay(nextWeekStart)}&ndash;{formatMonthDay(nextWeekEnd)} · {nextWeek.length} celebrating
            </span>
          }
        >
          {nextWeek.length === 0 ? (
            <p className="py-5 text-center text-[12.5px] text-parch-500">No birthdays next week.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
              {nextWeek.map((b) => (
                <CakeTile
                  key={b.id}
                  name={b.name}
                  on={b.on}
                  turning={b.turning}
                  meta={b.className || undefined}
                  tone="soon"
                  isToday={b.daysUntil === 0}
                  isServant={isServantId.has(b.id)}
                  href={canOpen && !isServantId.has(b.id) ? `/portal/students/${b.id}` : undefined}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {studentRows.length === 0 && missingDob.length === 0 && (
        <EmptyState title="No student birthdays coming up" hint="Add a date of birth on a student's profile and it shows up here." />
      )}

      {months.map((m) => (
        <div key={m.key} className="mb-4">
          <Card title={m.label} icon={<CalendarDays className="h-4 w-4" />} action={<span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{m.people.length}</span>}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {m.people.map((b) => (
                <PersonTile
                  key={b.id}
                  name={b.name}
                  on={b.on}
                  turning={b.turning}
                  daysUntil={b.daysUntil}
                  meta={b.className || undefined}
                  href={canOpen ? `/portal/students/${b.id}` : undefined}
                />
              ))}
            </div>
          </Card>
        </div>
      ))}

      {/* Always present, closed by default: the whole roster in date order, as
          the prototype had it, without burying this week's board underneath it. */}
      {!showAll && wholeRoster.length > 0 && (
        <details className="mb-4 overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card print:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden />
              <span className="text-[13px] font-semibold text-parch-900">Everyone, in date order</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">
              {wholeRoster.length}
            </span>
          </summary>
          <div className="border-t border-[#F3F0EB] p-[18px]">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {wholeRoster.map((b) => (
                <PersonTile
                  key={b.id}
                  name={b.name}
                  on={b.on}
                  turning={b.turning}
                  daysUntil={b.daysUntil}
                  meta={b.className || undefined}
                  href={canOpen ? `/portal/students/${b.id}` : undefined}
                />
              ))}
            </div>
          </div>
        </details>
      )}

      {user.role !== 'STUDENT' && (
        <Card title="Servants" icon={<Users className="h-4 w-4" />} action={<span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{servantRows.length}</span>}>
          {servantRows.length === 0 ? (
            <EmptyState title="No servant birthdays coming up" />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {servantRows.map((b) => (
                <PersonTile key={b.id} name={b.name} on={b.on} daysUntil={b.daysUntil} />
              ))}
            </div>
          )}
        </Card>
      )}

      {missingDob.length > 0 && (
        <div className="mb-4">
          <Card
            title="No birthday on file"
            icon={<CalendarDays className="h-4 w-4" />}
            action={<span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{missingDob.length}</span>}
          >
            <p className="mb-3 text-[12px] text-parch-500">
              These students have no date of birth recorded, so they never appear on the board. Add one on their profile.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {missingDob.map((p) =>
                canOpen ? (
                  <li key={p.id}>
                    <Link
                      href={`/portal/students/${p.id}`}
                      className="inline-flex rounded-[20px] border border-[#E7E2DA] bg-parch-50 px-2.5 py-[3px] text-[11.5px] font-semibold text-parch-700 transition-colors hover:border-brand-gold hover:text-brand-800"
                    >
                      {p.name}
                    </Link>
                  </li>
                ) : (
                  <li key={p.id} className="inline-flex rounded-[20px] border border-[#E7E2DA] px-2.5 py-[3px] text-[11.5px] font-semibold text-parch-700">
                    {p.name}
                  </li>
                ),
              )}
            </ul>
          </Card>
        </div>
      )}
    </>
  )
}
