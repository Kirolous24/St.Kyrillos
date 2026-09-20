import { notFound } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses } from '@/lib/portal/data/classes'
import { PageHeader, EmptyState, LinkButton, ClassCard } from '@/components/portal/ui'
import { STAGE_LABEL } from '@/lib/portal/format'
import { accentByOrder } from '@/lib/portal/accents'

export const metadata = { title: 'Classes' }

export default async function ClassesPage() {
  const user = await requirePortalUser()
  // Staff area — students reach their own class through their own page only.
  if (user.role === 'STUDENT') notFound()
  const classes = await listVisibleClasses(user)

  return (
    <>
      <PageHeader
        title={user.role === 'SERVANT' ? 'My Classes' : 'Classes'}
        subtitle={`${classes.length} class${classes.length === 1 ? '' : 'es'}`}
        icon={<GraduationCap className="h-5 w-5" />}
        actions={user.role === 'ADMIN' ? <LinkButton href="/portal/admin/classes">Manage classes</LinkButton> : undefined}
      />
      {classes.length === 0 ? (
        <EmptyState title="No classes to show" hint="Classes you serve in will appear here." />
      ) : (
        /* .classes-grid — repeat(auto-fill,minmax(210px,1fr)), gap 14px */
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          {classes.map((c) => (
            <ClassCard
              key={c.id}
              href={`/portal/classes/${c.id}`}
              name={c.name}
              accent={accentByOrder(c.sortOrder)}
              icon={<GraduationCap className="h-[19px] w-[19px]" />}
              rows={[
                { key: 'Servants', value: c.servantCount === 0 ? 'Not assigned' : `${c.servantCount} servant${c.servantCount === 1 ? '' : 's'}` },
                { key: 'Students', value: c.studentCount },
                { key: 'Stage', value: <span className="text-brand-gold-dark">{STAGE_LABEL[c.stage]}</span> },
              ]}
            />
          ))}
        </div>
      )}
    </>
  )
}
