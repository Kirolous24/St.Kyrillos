import { requirePortalUser } from '@/lib/portal/session'
import { requireStudentRead, studentName } from '@/lib/portal/data/students'
import { can } from '@/lib/portal/permissions'
import { notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { PageHeader } from '@/components/portal/ui'
import { StudentForm } from '@/components/portal/StudentForm'
import { formatDateOnly } from '@/lib/portal/dates'
import { formatPhone } from '@/lib/portal/phones'

export const metadata = { title: 'Edit student' }

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const s = await requireStudentRead(user, params.id)
  if (!can(user, 'student.write', { classId: s.classId ?? undefined, classStage: s.class?.stage, studentId: s.id })) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${studentName(s)}`}
        subtitle={s.class?.name ?? undefined}
        icon={<Pencil className="h-5 w-5" />}
        back={{ href: `/portal/students/${s.id}`, label: 'Profile' }}
      />
      <StudentForm
        mode="edit"
        studentId={s.id}
        backHref={`/portal/students/${s.id}`}
        initial={{
          firstName: s.firstName,
          lastName: s.lastName,
          gender: (s.gender as 'male' | 'female' | null) ?? '',
          dob: s.dob ? formatDateOnly(s.dob) : '',
          grade: s.grade,
          address: s.address,
          fatherName: s.fatherName,
          fatherPhone: formatPhone(s.fatherPhone),
          motherName: s.motherName,
          motherPhone: formatPhone(s.motherPhone),
          parentEmails: s.parentEmails.join(', '),
          notes: s.notes,
        }}
      />
    </>
  )
}
