import { notFound } from 'next/navigation'
import { QrCode } from 'lucide-react'
import { requirePortalUser } from '@/lib/portal/session'
import { requireClassAccess } from '@/lib/portal/data/classes'
import { isFellowship } from '@/lib/portal/fellowship'
import { churchToday } from '@/lib/portal/dates'
import { formatLongDate } from '@/lib/portal/format'
import { PageHeader } from '@/components/portal/ui'
import { CheckInCodePanel } from './CheckInCodePanel'

export const metadata = { title: 'QR check-in' }

/** A Fellowship meeting's QR check-in (2026-10-24): one code, members tap their names. */
export default async function MeetingCheckInPage({ params }: { params: { id: string } }) {
  const user = await requirePortalUser()
  const cls = await requireClassAccess(user, params.id, 'attendance.write')
  if (!isFellowship(cls.stage)) notFound()
  return (
    <>
      <PageHeader
        eyebrow="Attendance"
        title="QR check-in"
        subtitle={`${cls.name} · ${formatLongDate(churchToday())}`}
        icon={<QrCode className="h-5 w-5" aria-hidden />}
        back={{ href: `/portal/classes/${cls.id}`, label: cls.name }}
      />
      <CheckInCodePanel classId={cls.id} meetingName={cls.name} />
    </>
  )
}
