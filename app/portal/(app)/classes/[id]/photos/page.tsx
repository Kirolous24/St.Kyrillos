import { notFound } from 'next/navigation'
import { Camera } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { isFellowship } from '@/lib/portal/fellowship'
import { photoOrder } from '@/lib/portal/photo-file'
import { PageHeader, EmptyState } from '@/components/portal/ui'
import { ClassPhotos } from './ClassPhotos'

export const metadata = { title: 'Class photos' }

/**
 * Every child's photo in one place (2026-10-25: "Allow pictures for Pre K!").
 * A servant could always set a child's photo from the child's own page, one
 * child at a time; the youngest classes cannot set their own, so a servant
 * goes down the class here, taking or choosing a photo for each. The children
 * still without one come first. The class's own children only: a child from
 * another class has their photo set there.
 */
export default async function ClassPhotosPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'student.write')
  // A Fellowship meeting's members are adults, edited on their own pages.
  if (isFellowship(cls.stage)) notFound()

  const kids = await prisma.student.findMany({
    where: { classId: cls.id },
    select: { id: true, firstName: true, lastName: true, account: { select: { photo: true } } },
  })
  const rows = photoOrder(kids.map((k) => ({ id: k.id, name: studentName(k), photo: k.account.photo })))
  const withPhoto = rows.filter((r) => r.photo).length

  return (
    <>
      <PageHeader
        title="Class photos"
        subtitle={`${cls.name} · ${withPhoto} of ${rows.length} ${rows.length === 1 ? 'child has' : 'children have'} a photo`}
        icon={<Camera className="h-5 w-5" aria-hidden />}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      {rows.length === 0 ? (
        <EmptyState title="No children in this class yet" hint="Add the class's children first, then their photos here." />
      ) : (
        <ClassPhotos kids={rows} />
      )}
    </>
  )
}
