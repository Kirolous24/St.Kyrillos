import { prisma } from '@/lib/prisma'
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

  // Only an admin may move a student between classes (moveStudent enforces it
  // server-side too), so only an admin is offered the field.
  const classes =
    user.role === 'ADMIN'
      ? await prisma.schoolClass.findMany({ orderBy: [{ sortOrder: 'asc' }], select: { id: true, name: true } })
      : undefined

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
        classId={s.classId ?? ''}
        classes={classes}
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
          email: s.account.email,
          phone: formatPhone(s.account.phone),
          notes: s.notes,
        }}
      />
    </>
  )
}
