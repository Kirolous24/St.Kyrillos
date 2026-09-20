import { notFound } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { classServants } from '@/lib/portal/data/agenda'
import { listClassLessons, listLessonArchive } from '@/lib/portal/data/lessons'
import { can } from '@/lib/portal/permissions'
import { TEACHING_WRITE } from '@/lib/portal/agenda'
import { formatLongDate, STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, Card, Badge, EmptyState, Tabs, TabLink, IconTile } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { LessonManager } from './LessonManager'

export const metadata = { title: 'Lesson Preparation' }

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: { class?: string; view?: string }
}) {
  const user = await requirePortalUser()
  if (user.role === 'STUDENT') notFound()

  const classes = await listVisibleClasses(user)
  const writable = classes.filter((c) => can(user, TEACHING_WRITE, { classId: c.id, classStage: c.stage }))
  const canArchive = user.role === 'ADMIN' || user.role === 'PASTOR'
  const archiveOnly = writable.length === 0
  const view = canArchive && (searchParams.view === 'archive' || archiveOnly) ? 'archive' : 'class'

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Lesson Preparation" icon={<BookOpen className="h-5 w-5" aria-hidden />} />
        <EmptyState title="No classes yet" hint="Ask the Sunday School admin to add you to a class." />
      </>
    )
  }

  if (archiveOnly && !canArchive) {
    return (
      <>
        <PageHeader title="Lesson Preparation" icon={<BookOpen className="h-5 w-5" aria-hidden />} />
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

  if (view === 'archive') return <ArchiveView user={user} tabs={tabs} />

  const selectable = writable
  const classId = selectable.some((c) => c.id === searchParams.class)
    ? searchParams.class!
    : selectable[0]!.id
  const cls = await requireClassAccess(user, classId, TEACHING_WRITE)

  const [{ planned, taught }, servants] = await Promise.all([
    listClassLessons(cls.id),
    classServants(cls.id),
  ])
  // Copying reads another class, so any class the user can see may be a source.
  const copySources = classes.filter((c) => c.id !== cls.id).map((c) => ({ id: c.id, name: c.name }))

  return (
    <>
      <PageHeader
        title="Lesson Preparation"
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
async function ArchiveView({
  user,
  tabs,
}: {
  user: Awaited<ReturnType<typeof requirePortalUser>>
  tabs: React.ReactNode
}) {
  const classes = await listVisibleClasses(user)
  const lessons = await listLessonArchive(classes.map((c) => c.id))
  const stageOf = new Map(classes.map((c) => [c.id, c.stage]))

  return (
    <>
      <PageHeader
        title="Lesson Archive"
        icon={<BookOpen className="h-5 w-5" aria-hidden />}
        subtitle={`Every lesson across ${classes.length} class${classes.length === 1 ? '' : 'es'}, newest first. Read only.`}
      />
      {tabs}
      {lessons.length === 0 ? (
        <Card>
          <EmptyState title="No lessons recorded yet" hint="Servants add lessons from their own class page." />
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
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-parch-500">
                  <span>
                    {l.assignedToName ? `Taught by ${l.assignedToName}` : 'Unassigned'}
                  </span>
                  {l.topics.length > 0 && <span>{l.topics.join(' · ')}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
