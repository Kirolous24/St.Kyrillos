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
    select: { id: true, name: true, stage: true, visitationThreshold: true, description: true, isActive: true, sortOrder: true, _count: { select: { students: true, servants: true } } },
  })
  return (
    <>
      <PageHeader
        title="Manage classes"
        subtitle={`${classes.length} class${classes.length === 1 ? '' : 'es'} \u00b7 add, reorder, hide or remove`}
        icon={<GraduationCap className="h-5 w-5" />}
        back={{ href: '/portal/classes', label: 'Classes' }}
      />
      <ClassManager classes={classes.map((c) => ({ ...c, students: c._count.students, servants: c._count.servants }))} />
    </>
  )
}
