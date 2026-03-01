import { prisma } from '@/lib/prisma'
import { WeeklySchedule } from './WeeklySchedule'

export async function WeeklyScheduleSection() {
  const events = await prisma.scheduleEvent.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
  })

  return <WeeklySchedule events={events} />
}
