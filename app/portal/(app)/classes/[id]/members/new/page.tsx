import { notFound } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { isFellowship } from '@/lib/portal/fellowship'
import { PageHeader } from '@/components/portal/ui'
import { AddMember } from './AddMember'

export const metadata = { title: 'Add member' }

/** Add someone to a Fellowship meeting (2026-10-24). */
export default async function AddMemberPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'student.write')
  if (!isFellowship(cls.stage)) notFound()
  return (
    <>
      <PageHeader
        title="Add member"
        subtitle={`${cls.name} · find someone already in the portal, or add someone new`}
        icon={<UserPlus className="h-5 w-5" />}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      <AddMember classId={cls.id} meetingName={cls.name} />
    </>
  )
}
