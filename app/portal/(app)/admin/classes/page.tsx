import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { notFound } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { PageHeader } from '@/components/portal/ui'
import { ClassManager } from './ClassManager'

export const metadata = { title: 'Manage classes' }

export default async function AdminClassesPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const classes = await prisma.schoolClass.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      stage: true,
      visitationThreshold: true,
      description: true,
      isActive: true,
      sortOrder: true,
      curriculumLinkedToId: true,
      // F0541 — the card said "3 servants" and stopped. An admin checking who
      // covers a class had to open the roster and filter it, and the one thing
      // they usually want — which of the three is the coordinator — was nowhere
      // on this screen at all. The count came from `_count`, so the names were
      // never queried.
      servants: {
        select: { title: true, servant: { select: { account: { select: { displayName: true } } } } },
      },
      _count: { select: { students: true, servants: true } },
    },
  })
  return (
    <>
      <PageHeader
        title="Manage classes"
        subtitle={`${classes.length} class${classes.length === 1 ? '' : 'es'} \u00b7 add, reorder, hide or remove`}
        icon={<GraduationCap className="h-5 w-5" />}
        back={{ href: '/portal/classes', label: 'Classes' }}
      />
      <ClassManager
        classes={classes.map((c) => ({
          ...c,
          students: c._count.students,
          servants: c._count.servants,
          // Coordinators first, then alphabetically — the order an admin reads
          // the list in, rather than whatever the join returned.
          servantNames: c.servants
            .map((s) => ({ name: s.servant.account.displayName, title: s.title }))
            .sort((a, b) => (a.title === b.title ? a.name.localeCompare(b.name) : a.title ? -1 : 1)),
        }))}
      />
    </>
  )
}
