import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { buildStudentPayload } from '@/lib/portal/qr'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, EmptyState, Callout } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { qrSvgDataUrl } from '@/components/portal/QrImage'
import { CardSheet } from './CardSheet'

export const metadata = { title: 'Print QR cards' }

export default async function QrCardsPage({ searchParams }: { searchParams: { class?: string } }) {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN' && user.role !== 'SERVANT') notFound()

  const classes = await listVisibleClasses(user)
  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Print QR cards" back={{ href: '/portal/qr', label: 'QR Check-in' }} />
        <EmptyState title="No classes yet" hint="Ask an admin to assign you to a class." />
      </>
    )
  }

  const classId = classes.some((c) => c.id === searchParams.class) ? searchParams.class! : classes[0]!.id
  const cls = await requireClassAccess(user, classId, 'student.read')
  const accent = accentFor(cls.id)

  const students = await prisma.student.findMany({
    where: { classId: cls.id },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, account: { select: { loginId: true, isActive: true } } },
  })

  // QR images are rendered here because `qrcode` is server-only; the client
  // sheet takes the finished data URLs.
  const cards = await Promise.all(
    students.map(async (s) => ({
      id: s.id,
      name: studentName(s),
      loginId: s.account.loginId,
      inactive: !s.account.isActive,
      qr: await qrSvgDataUrl(buildStudentPayload(s.account.loginId)),
    })),
  )

  return (
    <div className="portal-print-page">
      <PageHeader
        eyebrow="Attendance"
        title="QR cards"
        subtitle={`${cls.name} · ${students.length} card${students.length === 1 ? '' : 's'}`}
        back={{ href: '/portal/qr', label: 'QR Check-in' }}
        /* Printing lives with the selection below, so there is one print
           control and it knows what was picked. */
      />

      {classes.length > 1 && (
        <div className="mb-4 print:hidden">
          <ClassPicker value={cls.id} options={classes.map((c) => ({ id: c.id, name: c.name }))} allowAll={false} />
        </div>
      )}

      <div className="mb-5 print:hidden">
        <Callout tone="info">
          Each card shows the student&apos;s 4-digit portal ID. A servant scans it from the &ldquo;Scan students&rdquo; tab to
          mark the student present or award points. Cut along the dashed edges after printing.
        </Callout>
      </div>

      {/* the printed sheet's masthead, exactly as the prototype's print window */}
      <p className="mb-4 hidden text-center text-[12px] font-bold uppercase tracking-[1px] text-brand-800 print:block">
        St. Kyrillos VI — Student QR Codes · {cls.name}
      </p>

      {students.length === 0 ? (
        <EmptyState title="No students in this class" />
      ) : (
        <CardSheet cards={cards} className={cls.name} accent={accent} />
      )}
    </div>
  )
}
