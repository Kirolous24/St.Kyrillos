import { notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireMemberRead } from '@/lib/portal/data/fellowship'
import { can } from '@/lib/portal/permissions'
import { formatDateOnly } from '@/lib/portal/dates'
import { formatPhone } from '@/lib/portal/phones'
import { PageHeader } from '@/components/portal/ui'
import { EditMember } from './EditMember'

export const metadata = { title: 'Edit member' }

/**
 * A member who does not serve (2026-10-24). A servant's details live on their
 * servant profile, so there is no edit page for them here.
 */
export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const { readable } = await requireMemberRead(user, params.id)
  if (!readable.some((m) => can(user, 'student.write', { classId: m.id, classStage: 'FELLOWSHIP' }))) notFound()
  const s = await prisma.student.findUnique({
    where: { id: params.id },
    select: { id: true, firstName: true, lastName: true, dob: true, notes: true, account: { select: { role: true, phone: true, email: true } } },
  })
  if (!s || s.account.role !== 'MEMBER') notFound()
  const birthday = s.dob ? formatDateOnly(s.dob) : ''
  const [y, m, d] = birthday ? birthday.split('-') : []
  return (
    <>
      <PageHeader
        title={`Edit ${s.firstName}`}
        subtitle="Their name, phone, email, birthday and a note"
        icon={<Pencil className="h-5 w-5" />}
        back={{ href: `/portal/members/${s.id}`, label: [s.firstName, s.lastName].filter(Boolean).join(' ') }}
      />
      <EditMember
        studentId={s.id}
        initial={{
          firstName: s.firstName,
          lastName: s.lastName,
          phone: formatPhone(s.account.phone),
          email: s.account.email ?? '',
          birthday: birthday ? `${Number(m)}/${Number(d)}/${y}` : '',
          note: s.notes ?? '',
        }}
      />
    </>
  )
}
