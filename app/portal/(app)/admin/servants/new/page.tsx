import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { notFound } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/portal/ui'
import { ServantForm } from '@/components/portal/ServantForm'

export const metadata = { title: 'Add servant' }

export default async function NewServantPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const classes = await prisma.schoolClass.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  return (
    <>
      <PageHeader
        title="Add servant"
        subtitle="A login ID and PIN are generated automatically"
        icon={<UserPlus className="h-5 w-5" />}
        back={{ href: '/portal/admin/servants', label: 'Servants' }}
      />
      <ServantForm mode="create" classes={classes} />
    </>
  )
}
