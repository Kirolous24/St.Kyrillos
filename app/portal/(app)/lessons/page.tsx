import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, Link2 } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { classServants } from '@/lib/portal/data/agenda'
import { listClassLessons, listLessonArchive, lessonStatsByClass } from '@/lib/portal/data/lessons'
import { can } from '@/lib/portal/permissions'
import { TEACHING_WRITE } from '@/lib/portal/agenda'
import { formatLongDate, STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { cn } from '@/lib/utils'
import { PageHeader, Card, Badge, Callout, EmptyState, Tabs, TabLink, IconTile, inputClass, buttonClass } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { LessonManager } from './LessonManager'
import { prisma } from '@/lib/prisma'

/**
 * F0227 — "Lessons", not "Lesson Preparation". The prototype used
 * "Lesson Preparation" for the weekly plan (/portal/agenda); this page is the
 * lesson archive, and the rail now names it "Lessons" for every role. Leaving
 * the old title here meant a servant clicked "Lessons" and landed on a page
 * headed "Lesson Preparation", while clicking "Lesson Preparation" landed them
 * on one headed "Schedule of the Year" — both rails lying about their own page.
 */
export const metadata = { title: 'Lessons' }

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: { class?: string; view?: string; q?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const classes = await listVisibleClasses(user)
  const writable = classes.filter((c) => can(user, TEACHING_WRITE, { classId: c.id, classStage: c.stage }))
  // Lessons are teaching material, not student data, and the prototype let any
  // servant read every class's. This route is staff-only at the edge, so
  // everyone who reaches it may use the archive.
  const canArchive = true
  const archiveOnly = writable.length === 0
  const view = canArchive && (searchParams.view === 'archive' || archiveOnly) ? 'archive' : 'class'

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Lessons" icon={<BookOpen className="h-5 w-5" aria-hidden />} />
        <EmptyState title="No classes yet" hint="Ask the Sunday School admin to add you to a class." />
      </>
    )
  }

  if (archiveOnly && !canArchive) {
    return (
      <>
        <PageHeader title="Lessons" icon={<BookOpen className="h-5 w-5" aria-hidden />} />
        <EmptyState title="Nothing to prepare" hint="You are not assigned to a class that you can plan lessons for." />
      </>
    )
  }

  const tabs = canArchive ? (
    <Tabs>
      {writable.length > 0 && <TabLink href="/portal/lessons" active={view === 'class'}>By class</TabLink>}
      <TabLink href="/portal/lessons?view=archive" active={view === 'archive'}>Archive · all classes</TabLink>
    </Tabs>
  ) : null

  if (view === 'archive')
    return <ArchiveView tabs={tabs} q={(searchParams.q ?? '').trim()} classId={searchParams.class ?? null} />

  const selectable = writable
  const classId = selectable.some((c) => c.id === searchParams.class)
    ? searchParams.class!
    : selectable[0]!.id
  const cls = await requireClassAccess(user, classId, TEACHING_WRITE)

  const [{ planned, taught }, servants] = await Promise.all([
    listClassLessons(cls.id),
    classServants(cls.id),
  ])
  // Copying reads another class's lessons, so every class is a possible source.
  // Sourcing these from the user's own visible classes left the typical servant
  // — who serves exactly one class — with an empty list and a dead feature.
  const allClasses = await prisma.schoolClass.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })
  const copySources = allClasses.filter((c) => c.id !== cls.id)

  return (
    <>
      <PageHeader
        title="Lessons"
        icon={<BookOpen className="h-5 w-5" aria-hidden />}
        subtitle={`${cls.name} · ${planned.length} planned, ${taught.length} taught`}
      />
      {tabs}
      {selectable.length > 1 && (
        <div className="mb-5">
          <ClassPicker value={cls.id} options={selectable.map((c) => ({ id: c.id, name: c.name }))} allowAll={false} />
        </div>
      )}
      <LessonManager
        classId={cls.id}
        className={cls.name}
        planned={planned}
        taught={taught}
        servants={servants}
        copySources={copySources}
      />
    </>
  )
}

/**
 * The prototype's archive timeline: one card per lesson, newest first — a gold
 * uppercase date line, a Playfair title, then the meta bits in a single row.
 */
async function ArchiveView({ tabs, q, classId }: { tabs: React.ReactNode; q: string; classId: string | null }) {
  // Church-wide by design: the point of the archive is to see what other
  // classes have taught, so it must not be scoped to the user's own classes.
  const classes = await prisma.schoolClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, stage: true },
  })
  const [all, stats] = await Promise.all([
    listLessonArchive(classes.map((c) => c.id)),
    lessonStatsByClass(),
  ])
  const stageOf = new Map(classes.map((c) => [c.id, c.stage]))
  // Live search over lesson content, which the port dropped entirely — with a
  // year of lessons across twelve classes, scrolling is not a search.
  const emptyClasses = classes.filter((c) => (stats.get(c.id)?.count ?? 0) === 0)
  const scoped = classId ? all.filter((l) => l.classId === classId) : all
  const needle = q.toLowerCase()
  const lessons = needle
    ? scoped.filter((l) =>
        [l.title, l.notes, ...(l.topics ?? []), ...(l.links ?? []).map((k) => k.label)]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(needle)),
      )
    : scoped

  return (
    <>
      <PageHeader
        title="Lesson Archive"
        icon={<BookOpen className="h-5 w-5" aria-hidden />}
        subtitle={
          q
            ? `${lessons.length} of ${all.length} lessons match “${q}”`
            : `Every lesson across ${classes.length} class${classes.length === 1 ? '' : 'es'}, newest first. Read only.`
        }
      />
      {tabs}
      <form className="mb-4 flex items-end gap-2">
        <input type="hidden" name="view" value="archive" />
        <label className="block w-full max-w-sm">
          <span className="sr-only">Search lessons</span>
          <input name="q" defaultValue={q} className={inputClass} placeholder="Search lessons, saints, verses…" />
        </label>
        <button type="submit" className={buttonClass('secondary')}>Search</button>
        {q && <Link href="/portal/lessons?view=archive" className={buttonClass('secondary')}>Clear</Link>}
      </form>
      {/* Grouped by class, with the classes that have taught nothing flagged —
          the prototype's oversight signal (OG L15574-15597). A flat timeline
          shows what HAS been taught; the point of this page for a coordinator
          is spotting what has not. */}
      {!q && emptyClasses.length > 0 && (
        <div className="mb-4">
          <Callout tone="bad" title={`${emptyClasses.length} class${emptyClasses.length === 1 ? '' : 'es'} with no lessons recorded`}>
            {emptyClasses.map((c) => c.name).join(' · ')}
          </Callout>
        </div>
      )}

      {!q && (
        <ul className="mb-4 flex flex-wrap gap-1.5">
          {classes.map((c) => {
            const stat = stats.get(c.id)
            const none = !stat || stat.count === 0
            return (
              <li key={c.id}>
                {/* A plain link that rebuilds the whole query: ClassPicker
                    pushes only its own param and would drop `view=archive`,
                    bouncing the user back to the editor. */}
                <Link
                  href={`/portal/lessons?view=archive&class=${encodeURIComponent(c.id)}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[20px] border px-2.5 py-[3px] text-[11px] font-bold transition-colors',
                    classId === c.id
                      ? 'border-brand-800 bg-brand-800 text-parch-50'
                      : none
                        ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] hover:border-[#DC2626]'
                        : 'border-[#E7E2DA] bg-parch-50 text-parch-600 hover:bg-brand-wash',
                  )}
                >
                  {c.name}
                  <span className={classId === c.id ? 'text-brand-gold' : none ? 'text-[#DC2626]' : 'text-parch-400'}>
                    {stat?.count ?? 0}
                  </span>
                </Link>
              </li>
            )
          })}
          {classId && (
            <li>
              <Link href="/portal/lessons?view=archive" className="inline-flex items-center rounded-[20px] border border-[#E7E2DA] px-2.5 py-[3px] text-[11px] font-bold text-parch-500 hover:bg-brand-wash">
                All classes
              </Link>
            </li>
          )}
        </ul>
      )}

      {lessons.length === 0 ? (
        <Card>
          <EmptyState
            title={classId ? 'No lessons for this class yet' : 'No lessons recorded yet'}
            hint="Servants add lessons from their own class page."
          />
        </Card>
      ) : (
        <ul className="grid gap-3.5 lg:grid-cols-2">
          {lessons.map((l) => {
            const accent = accentFor(l.classId)
            return (
              <li
                key={l.id}
                className="rounded-[16px] border border-parch-200 border-l-[3px] border-l-brand-gold bg-parch-50 p-[18px] shadow-card"
              >
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.5px] text-brand-gold-dark">
                  {l.date ? formatLongDate(l.date) : 'No date'} · {l.className}
                </p>
                <div className="mb-2 flex items-start gap-2.5">
                  <IconTile accent={accent} size="sm" solid>
                    <BookOpen className="h-4 w-4" aria-hidden />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-[16px] font-bold leading-snug text-parch-900">{l.title}</h3>
                    <p className="text-[11.5px] text-parch-500">
                      {STAGE_LABEL[stageOf.get(l.classId) ?? 'ELEMENTARY']}
                    </p>
                  </div>
                  <Badge tone={l.status === 'TAUGHT' ? 'good' : 'gold'}>
                    {l.status === 'TAUGHT' ? 'Taught' : 'Planned'}
                  </Badge>
                </div>
                {/* F0766 — the notes are what the lesson actually was. A servant
                    reading their own class's card has seen them all along
                    (LessonManager.tsx:524-526); the pastor reading the archive,
                    who was not in the room, got the title and nothing else. */}
                {l.notes && (
                  <p className="mb-2.5 whitespace-pre-line text-[12.5px] leading-relaxed text-parch-700">{l.notes}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-parch-500">
                  {/* F0263 — the line was unconditional, so a lesson carrying a
                      "Planned" badge said "Taught by Mina" two lines below it:
                      the archive claimed a lesson had happened that nobody had
                      given yet. "Added by" names who entered the row, which is
                      who a pastor asks when a class's archive has a gap. */}
                  <span>
                    {l.assignedToName
                      ? `${l.status === 'TAUGHT' ? 'Taught by' : 'Assigned to'} ${l.assignedToName}`
                      : 'Unassigned'}
                  </span>
                  {l.createdByName && <span>Added by {l.createdByName}</span>}
                  {l.topics.length > 0 && <span>{l.topics.join(' · ')}</span>}
                </div>
                {/* F0767 — the resource links were parsed, stored and searched and
                    then never drawn, so a pastor who found the right lesson in the
                    archive still had to open the class to reach the handout that
                    goes with it. */}
                {l.links.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {l.links.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-gold bg-brand-wash px-3 py-1.5 text-[11.5px] font-bold text-brand-gold-dark transition-colors hover:bg-brand-gold hover:text-parch-50"
                        >
                          <Link2 className="h-3.5 w-3.5" aria-hidden /> {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
