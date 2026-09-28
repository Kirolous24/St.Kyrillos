import { notFound } from 'next/navigation'
import { CalendarCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requirePortalUser } from '@/lib/portal/session'
import { PageHeader } from '@/components/portal/ui'
import { SessionEditor } from './SessionEditor'
import { ServantActivityEditor } from './ServantActivityEditor'
import { ActivityEditor } from '@/components/portal/ActivityEditor'

export const metadata = { title: 'Sessions & Points' }

export default async function AdminSessionsPage() {
  const user = await requirePortalUser()
  if (user.role !== 'ADMIN') notFound()
  const [sessions, activities, servantActivities] = await Promise.all([
    prisma.attendanceSession.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.pointActivity.findMany({ where: { classId: null, isActive: true }, orderBy: { label: 'asc' } }),
    prisma.servantActivity.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
  ])
  return (
    <>
      <PageHeader
        title="Sessions & Points"
        subtitle="What a student earns for each session attended, and for the activities every class has. Classes can add their own on their Points page. Changes apply from now on."
        icon={<CalendarCheck className="h-5 w-5" />}
      />
      <SessionEditor sessions={sessions.map((s) => ({ key: s.key, label: s.label, points: s.points, isActive: s.isActive, icon: s.icon }))} />
      <ActivityEditor activities={activities.map((a) => ({ id: a.id, label: a.label, points: a.points, icon: a.icon }))} />
      <ServantActivityEditor
        activities={servantActivities.map((a) => ({ key: a.key, label: a.label, dayOfWeek: a.dayOfWeek, isActive: a.isActive }))}
      />
    </>
  )
}
