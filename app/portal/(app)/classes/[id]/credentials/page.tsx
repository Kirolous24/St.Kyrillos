import { notFound } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { PageHeader, EmptyState } from '@/components/portal/ui'
import { ReportLetterhead } from '../../../reports/ReportLetterhead'
import { ClassCredentials } from './ClassCredentials'
import { onFileAccountIds } from '@/lib/portal/data/logins'
import { pinVaultEnabled } from '@/lib/portal/pin-vault'

export const metadata = { title: 'Class logins' }

/**
 * Admin-only. Resetting a whole class's PINs locks every one of them out until
 * the printed sheet has been handed round, so it is not a servant's button.
 */
export default async function ClassCredentialsPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const cls = await requireClassAccess(user, params.id, 'class.read')
  const roster = await prisma.student.findMany({
    where: { classId: cls.id },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, account: { select: { id: true, loginId: true } } },
  })
  // Which PINs are on file (option B), so the sheet can print the ones in use
  // without resetting anybody.
  const onFile = await onFileAccountIds(roster.map((s) => s.account.id))
  const students = roster.map((s) => ({
    studentId: s.id,
    accountId: s.account.id,
    name: `${s.firstName} ${s.lastName}`.trim(),
    loginId: s.account.loginId,
    onFile: onFile.has(s.account.id),
  }))
  const studentCount = students.length

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
        <ClassCredentials
          classId={cls.id}
          className={cls.name}
          studentCount={studentCount}
          students={students}
          vaultEnabled={pinVaultEnabled()}
        />
      )}
    </div>
  )
}
