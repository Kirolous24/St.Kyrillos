import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WeeklyServicesManager } from './WeeklyServicesManager'

export default async function WeeklyServicesPage() {
  const session = await auth()
  if (!session) redirect('/admin/login')

  const services = await prisma.weeklyService.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
  })

  const serialized = services.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    title: s.title,
    time: s.time,
    durationMinutes: s.durationMinutes,
    location: s.location,
    description: s.description,
    enabled: s.enabled,
    sortOrder: s.sortOrder,
  }))

  return <WeeklyServicesManager initialServices={serialized} />
}
