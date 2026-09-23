import { notFound } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { PageHeader, EmptyState } from '@/components/portal/ui'
import { ReportLetterhead } from '../../../reports/ReportLetterhead'
import { ClassCredentials } from './ClassCredentials'

export const metadata = { title: 'Class logins' }

/**
 * Admin-only. Resetting a whole class's PINs locks every one of them out until
 * the printed sheet has been handed round, so it is not a servant's button.
 */
export default async function ClassCredentialsPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const cls = await requireClassAccess(user, params.id, 'class.read')
  const studentCount = await prisma.student.count({ where: { classId: cls.id } })

  return (
    <div className="portal-print-page">
      <PageHeader
        title="Class logins"
        icon={<KeyRound className="h-5 w-5" aria-hidden />}
        subtitle={`${cls.name} · ${studentCount} student${studentCount === 1 ? '' : 's'}`}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      <ReportLetterhead title={`${cls.name} — student logins`} period="Hand to each family" />
      {studentCount === 0 ? (
        <EmptyState title="No students in this class yet" hint="Add students first, then come back for their logins." />
      ) : (
        <ClassCredentials classId={cls.id} className={cls.name} studentCount={studentCount} />
      )}
    </div>
  )
}
