import { notFound } from 'next/navigation'
import { CalendarCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader } from '@/components/portal/ui'
import { SessionEditor } from './SessionEditor'
import { ServantActivityEditor } from './ServantActivityEditor'

export const metadata = { title: 'Sessions & Points' }

export default async function AdminSessionsPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const [sessions, servantActivities] = await Promise.all([
    prisma.attendanceSession.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.servantActivity.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
  ])
  return (
    <>
      <PageHeader
        title="Sessions & Points"
        subtitle="What a student earns for attending each session. Changes apply to attendance taken from now on."
        icon={<CalendarCheck className="h-5 w-5" />}
      />
      <SessionEditor sessions={sessions.map((s) => ({ key: s.key, label: s.label, points: s.points, isActive: s.isActive, icon: s.icon }))} />
      <ServantActivityEditor
        activities={servantActivities.map((a) => ({ key: a.key, label: a.label, dayOfWeek: a.dayOfWeek, isActive: a.isActive }))}
      />
    </>
  )
}
