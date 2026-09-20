import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/portal/ui'
import { StudentForm } from '@/components/portal/StudentForm'

export const metadata = { title: 'Add student' }

export default async function NewStudentPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'student.write')
  return (
    <>
      <PageHeader
        title="Add student"
        subtitle={`${cls.name} \u00b7 a login ID and PIN are generated automatically`}
        icon={<UserPlus className="h-5 w-5" />}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      <StudentForm mode="create" classId={cls.id} backHref={`/portal/classes/${cls.id}`} />
    </>
  )
}
