import Image from 'next/image'
import { notFound } from 'next/navigation'
import { QrCode } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { studentName } from '@/lib/portal/data/students'
import { buildStudentPayload } from '@/lib/portal/qr'
import { PageHeader, Card } from '@/components/portal/ui'
import { PrintButton } from '@/components/portal/PrintButton'
import { QrImage } from '@/components/portal/QrImage'

export const metadata = { title: 'My QR Code' }

export default async function MyQrPage() {
  const user = await requirePortalUser()
  if (!user.studentId) notFound()

  const student = await prisma.student.findUnique({
    where: { id: user.studentId },
    select: {
      firstName: true,
      lastName: true,
      class: { select: { name: true } },
      account: { select: { loginId: true } },
    },
  })
  if (!student) notFound()

  const name = studentName(student)
  const className = student.class?.name ?? 'No class yet'

  return (
    <div className="portal-print-page">
      <PageHeader
        eyebrow="My progress"
        icon={<QrCode className="h-5 w-5" aria-hidden />}
        title="My QR Code"
        subtitle="Show this to a servant to be checked in, or print it and keep it in your Bible."
        actions={<PrintButton label="Print card" />}
      />

      {/* the prototype's 340px centred card: crest line, code, name, class, ID */}
      <div className="mx-auto max-w-[360px]">
        <Card tone="brand" bodyClassName="px-5 py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex items-center gap-2">
              <Image src="/images/Logo.png" alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-full object-cover" />
              <span className="text-[10px] font-bold uppercase tracking-[1px] text-brand-gold-dark">
                St. Kyrillos VI Sunday School
              </span>
            </span>

            <QrImage value={buildStudentPayload(student.account.loginId)} size={220} alt={`QR code for ${name}`} />

            <div>
              <h2 className="font-serif text-[18px] font-bold leading-tight text-parch-900">{name}</h2>
              <p className="mt-0.5 text-[12.5px] text-parch-500">{className}</p>
            </div>

            <div className="w-full rounded-[12px] border border-parch-200 bg-parch-100 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-parch-500">Portal ID</p>
              <p className="mt-0.5 text-[28px] font-bold leading-none tracking-[0.28em] text-brand-800 tabular-nums">
                {student.account.loginId}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* the prototype's gold-wash note under the card */}
      <div className="mx-auto mt-4 max-w-[360px] rounded-[12px] border border-brand-gold/30 bg-brand-wash px-4 py-3.5 text-center text-[12px] leading-relaxed text-brand-gold-dark print:hidden">
        Your servant scans this to check you in and record your points. It only identifies you — it never signs anyone in,
        and your 4-digit PIN stays private.
      </div>
    </div>
  )
}
