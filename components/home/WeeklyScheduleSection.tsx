import { prisma } from '@/lib/prisma'
import { WeeklySchedule } from './WeeklySchedule'
import { getCopticDayDataBatch } from '@/lib/coptic-api'

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

    const startStr = weekStart.toISOString().slice(0, 10)
    const endStr = weekEnd.toISOString().slice(0, 10)

    // Fetch events and coptic data in parallel
    const [raw, copticData] = await Promise.all([
      prisma.scheduleEvent.findMany({
        where: { date: { gte: weekStart, lte: weekEnd } },
        orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
      }),
      getCopticDayDataBatch(startStr, endStr).catch(() => ({} as Record<string, never>)),
    ])

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

    return <WeeklySchedule events={events} copticData={copticData} />
  } catch (error) {
    console.error("Failed to load schedule:", error)
    return <WeeklySchedule events={[]} />
  }
}
