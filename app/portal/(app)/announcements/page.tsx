import { Megaphone } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listAnnouncements } from '@/lib/portal/data/community'
import { formatLongDate, STAGE_LABEL } from '@/lib/portal/format'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, Card, Badge, EmptyState, IconTile } from '@/components/portal/ui'
import { AnnouncementManager } from './AnnouncementManager'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsPage() {
  const user = await requirePortalUser()
  const { scope, announcements } = await listAnnouncements(user)

  const canChurchWide = user.role === 'ADMIN' || user.role === 'PASTOR'
  const targetable = canChurchWide ? scope.classes : scope.classes.filter((c) => user.classIds.includes(c.id))
  const canCreate = canChurchWide || (user.role === 'SERVANT' && targetable.length > 0)

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={canChurchWide ? 'Church-wide notices and anything aimed at a stage or a class.' : 'Notices for you and your classes.'}
        actions={canCreate ? <AnnouncementManager classes={targetable} canChurchWide={canChurchWide} /> : undefined}
      />

      {announcements.length === 0 ? (
        <EmptyState
          title="No announcements right now"
          hint={canCreate ? 'Post one so everybody hears the same thing.' : 'Anything important will show up here.'}
        />
      ) : (
        <Card
          title="All announcements"
          icon={<Megaphone className="h-3.5 w-3.5" aria-hidden />}
          action={<span className="text-[12px] text-parch-500">{announcements.length} total</span>}
          bodyClassName="p-0"
        >
          <ul>
            {announcements.map((a) => {
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
                    <p className="mt-1 whitespace-pre-line text-[12px] leading-[1.6] text-parch-600">{a.body}</p>
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
