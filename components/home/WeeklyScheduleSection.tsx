import { prisma } from '@/lib/prisma'
import { WeeklySchedule } from './WeeklySchedule'

export async function WeeklyScheduleSection() {
  try {
    // Fetch only this week's events (Sunday through Saturday)
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay())
    weekStart.setUTCHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
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

    return <WeeklySchedule events={events} />
  } catch (error) {
    console.error("Failed to load schedule:", error)
    return <WeeklySchedule events={[]} />
  }
}
