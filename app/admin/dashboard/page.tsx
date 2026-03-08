import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ScheduleManager } from './ScheduleManager'

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session) redirect('/admin/login')

  // Load next 4 weeks of events
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - dayOfWeek)
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 27)
  weekEnd.setUTCHours(23, 59, 59, 999)

  const raw = await prisma.scheduleEvent.findMany({
    where: { date: { gte: weekStart, lte: weekEnd } },
    orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
  })

  // Serialize Date objects for client component
  const events = raw.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    time: e.time,
    sortOrder: e.sortOrder,
    durationMinutes: e.durationMinutes,
    title: e.title,
    description: e.description,
    location: e.location,
  }))

  return <ScheduleManager initialEvents={events} />
}
