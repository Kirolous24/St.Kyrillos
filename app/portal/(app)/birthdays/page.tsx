import Link from 'next/link'
import { Cake, CalendarDays, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { upcomingBirthdays } from '@/lib/portal/birthdays'
import { todayInNewYork, formatDateOnly, toUTCDate } from '@/lib/portal/dates'
import { formatShortDate } from '@/lib/portal/format'
import { PageHeader, Card, Badge, Avatar, EmptyState } from '@/components/portal/ui'

export const metadata = { title: 'Birthdays' }

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** A cake tile, the prototype's `bdRow`: round icon, name, day, "Turns n" pill. */
function CakeTile({
  name, on, turning, meta, href, tone,
}: {
  name: string
  on: string
  turning: number
  meta?: string
  href?: string
  tone: 'now' | 'soon'
}) {
  const body = (
    <>
      <span
        className={[
          'mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full',
          tone === 'now' ? 'bg-gradient-to-br from-brand-800 to-brand-gold text-parch-50' : 'bg-brand-wash text-brand-gold-dark',
        ].join(' ')}
        aria-hidden
      >
        <Cake className="h-5 w-5" />
      </span>
      <p className="truncate text-[11.5px] font-bold text-parch-900" title={name}>{name}</p>
      {meta && <p className="truncate text-[10px] text-parch-500">{meta}</p>}
      <p className="mb-2 text-[10.5px] text-parch-500">{formatShortDate(on)}</p>
      <Badge tone={tone === 'now' ? 'gold' : 'info'}>Turns {turning}</Badge>
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
      <p className={`mt-1 text-[10px] font-bold ${daysUntil <= 13 ? 'text-brand-gold-dark' : 'text-parch-500'}`}>{away}</p>
    </>
  )
  const cls =
    'block rounded-[14px] border-[1.5px] border-[#EFE9DC] bg-parch-50 px-2 py-3 text-center shadow-card transition-shadow hover:shadow-panel'
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export default async function BirthdaysPage() {
  const user = await requirePortalUser()
  const classes = await listVisibleClasses(user)
  const classIds = classes.map((c) => c.id)
  const today = todayInNewYork()

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
    today, 60,
  )
  const servantRows = upcomingBirthdays(
    servants.map((s) => ({ id: s.id, name: s.account.displayName, dob: s.birthday ? formatDateOnly(s.birthday) : null })),
    today, 60,
  )

  const canOpen = user.role !== 'STUDENT'
  const thisWeek = studentRows.filter((b) => b.daysUntil <= 6)
  const later = studentRows.filter((b) => b.daysUntil > 6)

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
      <PageHeader title="Birthdays" subtitle="Everyone celebrating in the next 60 days" icon={<Cake className="h-5 w-5" />} />

      <div className="mb-4">
        <Card
          title="This week"
          icon={<Cake className="h-4 w-4" />}
          action={<span className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">{thisWeek.length} celebrating</span>}
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
                  href={canOpen ? `/portal/students/${b.id}` : undefined}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {studentRows.length === 0 && (
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
    </>
  )
}
