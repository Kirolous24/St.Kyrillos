import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, Link2, Printer } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { agendaCsvForClass, agendaServantOptions, listAgendaWeeks, loadAgendaWeek } from '@/lib/portal/data/agenda'
import { can } from '@/lib/portal/permissions'
import { TEACHING_WRITE, normaliseWeekStart, weekDistanceLabel, agendaBlankTemplateRows, schoolYearWeeks, weekLabel } from '@/lib/portal/agenda'
import { toCsv } from '@/lib/portal/csv'
import { addDays, mondayOf, todayInNewYork } from '@/lib/portal/dates'
import {
  PageHeader,
  SectionTitle,
  Card,
  Badge,
  EmptyState,
  LinkButton,
  Tabs,
  TabLink,
} from '@/components/portal/ui'
import { cn } from '@/lib/utils'
import { AgendaEditor } from './AgendaEditor'
import { CurriculumLink } from './CurriculumLink'
import { AgendaNav, AgendaTools } from './AgendaTools'
import { ArchiveSearch } from './ArchiveSearch'
import { ClearWeeksPanel } from './ClearWeeksPanel'

export const metadata = { title: 'Schedule of the Year' }

/**
 * F0227 — the two rails name this page differently and both are the prototype's
 * own wording: a servant's rail says "Lesson Preparation" (index.stripped.html
 * L4021, where it pointed at exactly this page) and an admin's says "Schedule of
 * the Year". A single fixed heading makes one of the two rails a lie, so the
 * heading follows the viewer. The browser-tab title stays the neutral one.
 */
const agendaTitle = (role: string) => (role === 'SERVANT' ? 'Lesson Preparation' : 'Schedule of the Year')

/** The prototype's week-navigation pills (`padding:9px 16px;border-radius:20px`). */
function pillClass(active: boolean) {
  return cn(
    'inline-flex min-h-[40px] items-center gap-1.5 rounded-[20px] border px-4 py-[9px] text-[12px] font-bold transition-colors',
    active
      ? 'border-brand-gold bg-brand-wash text-brand-gold-dark shadow-nav-on'
      : 'border-parch-200 bg-parch-50 text-parch-700 hover:border-brand-gold/60 hover:bg-brand-wash',
  )
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { class?: string; week?: string; view?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const classes = await listVisibleClasses(user)
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title={agendaTitle(user.role)} icon={<CalendarDays className="h-5 w-5" aria-hidden />} />
        <EmptyState title="No classes yet" hint="Ask the Sunday School admin to add you to a class." />
      </>
    )
  }

  const classId = classes.some((c) => c.id === searchParams.class) ? searchParams.class! : classes[0]!.id
  const cls = await requireClassAccess(user, classId, 'class.read')
  const canWrite = can(user, TEACHING_WRITE, { classId: cls.id, classStage: cls.stage })

  const mode = searchParams.view === 'archive' ? 'archive' : 'edit'
  // The class this one follows, if an admin linked it. Two reads because the
  // column is a bare id with no relation — it came across from the Firebase
  // import that way and nothing has ever needed to join on it.
  const linkRow = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { curriculumLinkedToId: true },
  })
  const curriculumSource = linkRow?.curriculumLinkedToId
    ? await prisma.schoolClass.findUnique({
        where: { id: linkRow.curriculumLinkedToId },
        select: { id: true, name: true },
      })
    : null
  const today = todayInNewYork()
  const thisMonday = mondayOf(today)
  const week = normaliseWeekStart(searchParams.week) ?? thisMonday

  const [view, servants, archive, csv] = await Promise.all([
    loadAgendaWeek(cls.id, week),
    agendaServantOptions(cls.id),
    listAgendaWeeks(cls.id),
    canWrite ? agendaCsvForClass(cls.id) : Promise.resolve(''),
  ])

  // Generated, not queried — an empty year in the importer's own shape.
  const blankCsv = canWrite ? toCsv(agendaBlankTemplateRows(today)) : ''

  const href = (w: string) => `/portal/agenda?class=${encodeURIComponent(cls.id)}&week=${w}`
  const shareTargets = classes
    .filter((c) => c.id !== cls.id && can(user, TEACHING_WRITE, { classId: c.id, classStage: c.stage }))
    .map((c) => ({ id: c.id, name: c.name }))

  return (
    <>
      <PageHeader
        title={agendaTitle(user.role)}
        icon={<CalendarDays className="h-5 w-5" aria-hidden />}
        subtitle={`${cls.name} · ${view.label}`}
        actions={
          <LinkButton href={`/portal/agenda/week?class=${encodeURIComponent(cls.id)}&week=${week}`} variant="secondary">
            <Printer className="h-4 w-4" aria-hidden /> Weekly assignments
          </LinkButton>
        }
      />

      {/* The prototype's three-mode strip (Edit List / Weekly Assignment View /
          Lesson Archive). The port split the modes across pages with nothing
          linking them, so a servant on one had no idea the others existed.
          Every tab carries class and week, so none of them is a dead link. */}
      <Tabs>
        <TabLink href={`/portal/agenda?class=${encodeURIComponent(cls.id)}&week=${week}`} active={mode === 'edit'}>
          This week
        </TabLink>
        <TabLink href={`/portal/agenda/week?class=${encodeURIComponent(cls.id)}&week=${week}`} active={false}>
          Weekly assignments
        </TabLink>
        <TabLink href={`/portal/agenda?class=${encodeURIComponent(cls.id)}&week=${week}&view=archive`} active={mode === 'archive'}>
          Archive
        </TabLink>
      </Tabs>

      <AgendaNav
        classId={cls.id}
        week={week}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      />

      {curriculumSource && (
        <CurriculumLink
          classId={cls.id}
          weekStart={view.weekStart}
          weekLabel={view.label}
          source={curriculumSource}
          canWrite={canWrite}
        />
      )}

      <nav aria-label="Week" className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <Link href={href(addDays(week, -7))} className={pillClass(false)}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
        </Link>
        <Link href={href(thisMonday)} className={pillClass(week === thisMonday)}>
          <CalendarDays className="h-4 w-4" aria-hidden /> This week
        </Link>
        <Link href={href(addDays(week, 7))} className={pillClass(false)}>
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
        <span className="ml-1 text-[12px] text-parch-500">{weekDistanceLabel(week, today)}</span>
      </nav>

      {mode === 'archive' ? (
        <ArchiveMonths archive={archive} currentWeek={view.weekStart} href={href} today={today} />
      ) : (
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {canWrite ? (
            <AgendaEditor
              classId={cls.id}
              className={cls.name}
              weekStart={view.weekStart}
              weekLabel={view.label}
              servants={servants.onClass}
              otherServants={servants.others}
              initial={{
                slideLink: view.slideLink ?? '',
                notes: view.notes ?? '',
                leadServantId: view.leadServantId ?? '',
                backupServantId: view.backupServantId ?? '',
                rows: view.grid.rows.map((r) => ({
                  key: r.key,
                  label: r.label,
                  topic: r.topic ?? '',
                  servantId: r.servantId ?? '',
                })),
              }}
              savedAt={view.updatedAt}
            />
          ) : (
            <ReadOnlyWeek view={view} />
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {canWrite && (
            <AgendaTools classId={cls.id} className={cls.name} weekStart={view.weekStart} csv={csv} blankCsv={blankCsv} shareTargets={shareTargets} />
          )}

          {/* F0221 / F0490 / F0585 / F0586 — the old app's bulk "Clear Selected
              Weeks", as a folded panel rather than a tick box on every tile: the
              tiles are links, and this deletes lesson planning. */}
          {canWrite && (
            <ClearWeeksPanel
              classId={cls.id}
              className={cls.name}
              weeks={archive
                .filter((w) => w.filledCount > 0 || w.hasSlides)
                .map((w) => ({
                  weekStart: w.weekStart,
                  label: w.label,
                  filledCount: w.filledCount,
                  hasSlides: w.hasSlides,
                }))}
            />
          )}

          <ArchiveMonths archive={archive} currentWeek={view.weekStart} href={href} today={today} />
        </div>
      </div>
      )}
    </>
  )
}

/**
 * The prototype's agenda archive: weeks grouped into a per-month accordion, each
 * week a small tile with the month abbreviation over a Playfair day number,
 * green when the week has been filled in and dashed when it has not.
 */
function ArchiveMonths({
  archive,
  currentWeek,
  href,
  today,
}: {
  archive: Awaited<ReturnType<typeof listAgendaWeeks>>
  currentWeek: string
  href: (w: string) => string
  today: string
}) {
  // F0218 — the accordion listed only weeks that had been **saved**, so a
  // future week was reachable by URL and by the date picker but appeared
  // nowhere in the year overview: a servant planning ahead could not see what
  // was left to fill. The school year is laid out in full and the saved weeks
  // joined onto it, exactly as the prototype's overview did. Weeks saved
  // outside this school year are kept too, rather than vanishing from their
  // own archive.
  const saved = new Map(archive.map((w) => [w.weekStart, w]))
  const yearWeeks = schoolYearWeeks(today)
  const blank = (weekStart: string, ordinal: string | null): (typeof archive)[number] => ({
    weekStart,
    label: weekLabel(weekStart),
    ordinal,
    filledCount: 0,
    leadServantName: null,
    backupServantName: null,
    hasSlides: false,
    slideLink: null,
    topics: [],
    searchText: '',
  })
  const all = [
    ...yearWeeks.map((w) => saved.get(w.key) ?? blank(w.key, w.label)),
    ...archive.filter((w) => !yearWeeks.some((y) => y.key === w.weekStart)),
  ].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))

  // Group by calendar month, newest month first.
  const months: Array<{ key: string; label: string; weeks: typeof archive }> = []
  const byKey = new Map<string, (typeof months)[number]>()
  for (const w of all) {
    const key = w.weekStart.slice(0, 7)
    let group = byKey.get(key)
    if (!group) {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
      group = { key, label, weeks: [] }
      byKey.set(key, group)
      months.push(group)
    }
    group.weeks.push(w)
  }

  return (
    <div className="space-y-2.5">
      <SectionTitle hint={`${archive.length} of ${all.length} weeks filled`}>Archive</SectionTitle>

      {/* F0591 — the prototype searched the saved topics, which is how a
          servant looks for a week: "when did we do St. Moses?". */}
      <ArchiveSearch
        rows={archive.map((w) => ({
          weekStart: w.weekStart,
          label: w.label,
          ordinal: w.ordinal,
          searchText: w.searchText,
          filledCount: w.filledCount,
          href: href(w.weekStart),
          slideLink: w.slideLink,
          topics: w.topics,
        }))}
      >
        <ArchiveAccordion archive={all} currentWeek={currentWeek} href={href} months={months} />
      </ArchiveSearch>
    </div>
  )
}

function ArchiveAccordion({
  archive,
  currentWeek,
  href,
  months,
}: {
  archive: Awaited<ReturnType<typeof listAgendaWeeks>>
  currentWeek: string
  href: (w: string) => string
  months: Array<{ key: string; label: string; weeks: Awaited<ReturnType<typeof listAgendaWeeks>> }>
}) {
  const currentMonth = currentWeek.slice(0, 7)
  return (
    <div className="space-y-2.5">

      {months.map((g) => {
        const filledCount = g.weeks.filter((w) => w.filledCount > 0 || w.hasSlides).length
        return (
          <details
            key={g.key}
            open={g.key === currentMonth}
            className="overflow-hidden rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 shadow-card"
          >
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3.5">
              <span className="flex items-center gap-2.5">
                <span className="text-[13.5px] font-bold text-parch-900">{g.label}</span>
                <span
                  className={cn(
                    'rounded-[10px] px-2.5 py-0.5 text-[10.5px] font-bold',
                    filledCount > 0 ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#F5F2ED] text-parch-500',
                  )}
                >
                  {filledCount}/{g.weeks.length} filled
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-parch-500 transition-transform [[open]_&]:rotate-90"
                aria-hidden
              />
            </summary>

            <div className="border-t border-[#F0EEE8] px-4 py-3.5">
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
                {g.weeks.map((w) => {
                  const filled = w.filledCount > 0 || w.hasSlides
                  const current = w.weekStart === currentWeek
                  const [, month, day] = w.weekStart.split('-')
                  const abbr = new Date(Number(w.weekStart.slice(0, 4)), Number(month) - 1, Number(day))
                    .toLocaleDateString('en-US', { month: 'short' })
                    .toUpperCase()
                  return (
                    <li key={w.weekStart}>
                      <Link
                        href={href(w.weekStart)}
                        title={`${w.ordinal ? `${w.ordinal} — ` : ''}${w.label} · ${w.filledCount}/10 filled${w.leadServantName ? ` · Lead ${w.leadServantName}` : ''}`}
                        className={cn(
                          'flex min-h-[64px] flex-col items-center justify-center rounded-[10px] border-[1.5px] px-1.5 py-2.5 text-center transition-colors',
                          filled
                            ? 'border-[#86EFAC] bg-[#F0FDF4]'
                            : 'border-dashed border-parch-200 bg-parch-50',
                          current && 'ring-2 ring-brand-gold ring-offset-1',
                        )}
                      >
                        <span className={cn('text-[9.5px] font-bold', filled ? 'text-[#166534]' : 'text-parch-400')}>
                          {abbr}
                        </span>
                        <span
                          className={cn(
                            'font-serif text-[17px] font-bold leading-tight',
                            filled ? 'text-[#166534]' : 'text-parch-400',
                          )}
                        >
                          {Number(day)}
                        </span>
                        <span className={cn('text-[8.5px] font-semibold', filled ? 'text-[#16A34A]' : 'text-parch-300')}>
                          {filled ? `${w.filledCount}/10` : 'Empty'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-center text-[11px] text-parch-500">Tap a week to open it</p>
            </div>
          </details>
        )
      })}
    </div>
  )
}

/** The read-only running order, matching the prototype's weekly assignment table. */
function ReadOnlyWeek({ view }: { view: Awaited<ReturnType<typeof loadAgendaWeek>> }) {
  const filled = view.grid.rows.filter((r) => r.topic || r.servantName).length
  return (
    <Card
      title={view.label}
      icon={<CalendarDays className="h-4 w-4" aria-hidden />}
      action={<Badge tone={filled > 0 ? 'gold' : 'neutral'}>{filled}/10 filled</Badge>}
      bodyClassName="p-0"
    >
      <dl className="grid grid-cols-2 gap-3 border-b border-[#F0EEE8] px-[18px] py-3.5">
        <div>
          <dt className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Lead</dt>
          <dd className="text-[12.5px] font-semibold text-parch-800">{view.leadServantName ?? '—'}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Backup</dt>
          <dd className="text-[12.5px] font-semibold text-parch-800">{view.backupServantName ?? '—'}</dd>
        </div>
      </dl>

      {view.notes && (
        <p className="whitespace-pre-line border-b border-[#F0EEE8] bg-parch-100 px-[18px] py-3 text-[12.5px] text-parch-700">
          {view.notes}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F3EFE6]">
              <th scope="col" className="px-4 py-3 text-left text-[12px] font-bold text-brand-800">Activity / Service</th>
              <th scope="col" className="px-4 py-3 text-left text-[12px] font-bold text-brand-800">Topic &amp; Content</th>
              <th scope="col" className="px-4 py-3 text-center text-[12px] font-bold text-brand-800">Assigned Servant</th>
            </tr>
          </thead>
          <tbody>
            {view.grid.rows.map((row) => (
              <tr key={row.key}>
                <td className="whitespace-nowrap border-b border-[#F0EEE8] px-4 py-3 font-semibold text-parch-900">{row.label}</td>
                <td className={cn('border-b border-[#F0EEE8] px-4 py-3', row.topic ? 'text-[#374151]' : 'text-parch-500')}>
                  {row.topic ?? '—'}
                </td>
                <td className={cn('whitespace-nowrap border-b border-[#F0EEE8] px-4 py-3 text-center', row.servantName ? 'text-[#374151]' : 'text-parch-500')}>
                  {row.servantName ?? 'Unassigned'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.slideLink && (
        <p className="px-[18px] py-3.5">
          <a
            href={view.slideLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-gold bg-brand-wash px-3 py-1.5 text-[11.5px] font-bold text-brand-gold-dark"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden /> Open Slides
          </a>
        </p>
      )}
    </Card>
  )
}
