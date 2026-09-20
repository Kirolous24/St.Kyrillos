import Image from 'next/image'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { listVisibleClasses, requireClassAccess } from '@/lib/portal/data/classes'
import { studentName } from '@/lib/portal/data/students'
import { buildStudentPayload } from '@/lib/portal/qr'
import { accentFor } from '@/lib/portal/accents'
import { PageHeader, EmptyState, Callout } from '@/components/portal/ui'
import { ClassPicker } from '@/components/portal/ClassPicker'
import { PrintButton } from '@/components/portal/PrintButton'
import { QrImage } from '@/components/portal/QrImage'

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

  return (
    <div className="portal-print-page">
      <PageHeader
        eyebrow="Attendance"
        title="QR cards"
        subtitle={`${cls.name} · ${students.length} card${students.length === 1 ? '' : 's'}`}
        back={{ href: '/portal/qr', label: 'QR Check-in' }}
        actions={<PrintButton label="Print cards" />}
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {students.map((s) => (
            <li
              key={s.id}
              className={`flex break-inside-avoid flex-col items-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-parch-300 bg-parch-50 p-3 text-center ${
                s.account.isActive ? '' : 'opacity-60'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Image src="/images/Logo.png" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" />
                <span className="text-[8.5px] font-bold uppercase tracking-[0.8px] text-brand-gold-dark">St. Kyrillos VI</span>
              </span>

              <QrImage value={buildStudentPayload(s.account.loginId)} size={128} alt="" className="shadow-none" />

              <p className="w-full truncate font-serif text-[13px] font-bold leading-tight text-parch-900">{studentName(s)}</p>
              <p
                className="w-full truncate text-[9.5px] font-bold uppercase tracking-[0.8px]"
                style={{ color: accent }}
              >
                {cls.name}
              </p>
              <p className="text-[19px] font-bold leading-none tracking-[0.28em] text-brand-800 tabular-nums">
                {s.account.loginId}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
