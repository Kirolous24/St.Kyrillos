import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ScheduleManager } from './ScheduleManager'

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session) redirect('/admin/login')

  const events = await prisma.scheduleEvent.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
  })

  return <ScheduleManager initialEvents={events} />
}
