import Link from 'next/link'
import { Megaphone } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listAnnouncements, announceableStage } from '@/lib/portal/data/community'
import { formatLongDate, STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, Card, Badge, EmptyState, IconTile } from '@/components/portal/ui'
import { AnnouncementManager } from './AnnouncementManager'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsPage({ searchParams }: { searchParams: { scope?: string } }) {
  const user = await requirePortalUser()
  const { scope, announcements } = await listAnnouncements(user)

  const canChurchWide = user.role === 'ADMIN' || user.role === 'PASTOR'
  const targetable = canChurchWide ? scope.classes : scope.classes.filter((c) => user.classIds.includes(c.id))
  // F0285 — a servant who oversees a stage but teaches no class had no target on
  // the form and so could not post anything at all. Her own stage is now one.
  const ownStage = announceableStage(user)
  const canCreate = canChurchWide || (user.role === 'SERVANT' && (targetable.length > 0 || !!ownStage))

  // F0274 — one column mixing a church-wide notice with one class's reminder
  // meant an admin asking "what has the church actually been told?" read past
  // everybody else's class chatter to find out. The chips filter; they never
  // hide. The default deliberately stays every notice rather than the
  // prototype's church-wide-only view: silently dropping class notices out of
  // the admin's default page is how a notice goes unanswered.
  const scopeOf = (a: { classId: string | null; stage: string | null }) =>
    a.classId ? 'class' : a.stage ? 'stage' : 'church'
  const SCOPE_CHIPS: Array<{ key: string | null; label: string }> = [
    { key: null, label: 'All' },
    { key: 'church', label: 'Church-wide' },
    { key: 'stage', label: 'By stage' },
    { key: 'class', label: 'By class' },
  ]
  // Only a scope that actually appears gets a chip, so no chip filters to
  // nothing, and an unknown ?scope= falls back to All rather than an empty page.
  const present = new Set<string>(announcements.map(scopeOf))
  const activeScope = searchParams.scope && present.has(searchParams.scope) ? searchParams.scope : null
  const shown = activeScope ? announcements.filter((a) => scopeOf(a) === activeScope) : announcements

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={canChurchWide ? 'Church-wide notices and anything aimed at a stage or a class.' : 'Notices for you and your classes.'}
      />

      {/* F0501 / F0312 — NOT in PageHeader's `actions`. That slot renders inside
          the dark maroon banner, and AnnouncementManager is not a button: it is a
          button that expands into the whole compose form (emoji, title, body,
          date, target, sort order). Clicking "New announcement" therefore opened
          a full form inside the banner — the exact defect Wave 24 had to fix on
          the events page. The trigger and its form are one component sharing one
          piece of state, so they cannot be split; the component goes below the
          header instead. */}
      {canCreate && (
        <div className="mb-4">
          <AnnouncementManager classes={targetable} canChurchWide={canChurchWide} ownStage={ownStage} />
        </div>
      )}

      {present.size > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5 print:hidden">
          {SCOPE_CHIPS.filter((c) => c.key === null || present.has(c.key)).map((c) => (
            <Link
              key={c.key ?? 'all'}
              href={c.key ? `/portal/announcements?scope=${c.key}` : '/portal/announcements'}
              aria-current={c.key === activeScope ? 'true' : undefined}
              data-scope-chip={c.key ?? 'all'}
              className={
                'rounded-[20px] border px-3 py-1 text-[11.5px] font-bold transition-colors ' +
                (c.key === activeScope
                  ? 'border-brand-gold bg-brand-wash text-brand-800'
                  : 'border-parch-200 text-parch-600 hover:border-brand-gold hover:text-brand-800')
              }
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          title="No announcements right now"
          hint={canCreate ? 'Post one so everybody hears the same thing.' : 'Anything important will show up here.'}
        />
      ) : (
        <Card
          title={activeScope ? `${SCOPE_CHIPS.find((c) => c.key === activeScope)!.label} announcements` : 'All announcements'}
          icon={<Megaphone className="h-3.5 w-3.5" aria-hidden />}
          action={
            <span className="text-[12px] text-parch-500">
              {shown.length} of {announcements.length}
            </span>
          }
          bodyClassName="p-0"
        >
          <ul>
            {shown.map((a) => {
              // Church-wide notices wear the gold tile; a class notice wears
              // the same colour that class has everywhere else in the portal.
              const churchWide = !a.classId && !a.stage
              const accent = a.classId ? accentFor(a.classId) : '#C89B3C'
              return (
                <li
                  key={a.id}
                  className={
                    'flex items-start gap-3.5 border-b border-[#F5F2ED] px-[18px] py-3.5 last:border-b-0' +
                    (churchWide ? ' bg-brand-wash/45' : '') +
                    (a.isActive ? '' : ' opacity-60')
                  }
                >
                  <IconTile accent={accent} size="sm">
                    <span className="text-[19px] leading-none">{a.emoji || '📢'}</span>
                  </IconTile>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      {a.classId ? (
                        <Badge tone="neutral">{a.className ?? 'Class'}</Badge>
                      ) : a.stage ? (
                        <Badge tone="brand">All {STAGE_LABEL[a.stage]}</Badge>
                      ) : (
                        <Badge tone="gold">Church-wide</Badge>
                      )}
                      {!a.isActive && <Badge tone="warn">Hidden</Badge>}
                    </div>

                    <h2 className="font-serif text-[14px] font-bold leading-snug text-parch-900">{a.title}</h2>
                    {/* F0655 — a title-only announcement draws no empty paragraph. */}
                    {a.body.trim() && (
                      <p className="mt-1 whitespace-pre-line text-[12px] leading-[1.6] text-parch-600">{a.body}</p>
                    )}
                    <p className="mt-1.5 text-[11px] text-parch-500">
                      {a.date ? `${formatLongDate(a.date)} · ` : ''}
                      {a.createdByName}
                    </p>

                    {a.canManage && (
                      <AnnouncementManager
                        classes={targetable}
                        canChurchWide={canChurchWide}
                        announcement={{
                          id: a.id,
                          title: a.title,
                          body: a.body,
                          emoji: a.emoji,
                          date: a.date,
                          sortOrder: a.sortOrder,
                          isActive: a.isActive,
                          classId: a.classId,
                          stage: a.stage,
                        }}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}
