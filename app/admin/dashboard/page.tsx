import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ScheduleManager } from './ScheduleManager'
import { getCopticDayDataBatch, getTemplateSuggestions } from '@/lib/coptic-api'

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

  const startStr = weekStart.toISOString().slice(0, 10)
  const endStr = weekEnd.toISOString().slice(0, 10)

  // Fetch events, templates, and coptic data in parallel
  const [raw, rawTemplates, copticData] = await Promise.all([
    prisma.scheduleEvent.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.seasonTemplate.findMany({
      include: {
        days: {
          orderBy: { dayOffset: 'asc' },
          include: { events: { orderBy: { time: 'asc' } } },
        },
      },
      orderBy: { name: 'asc' },
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

  const templates = rawTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    totalDays: t.totalDays,
    days: t.days.map((d) => ({
      dayOffset: d.dayOffset,
      label: d.label,
      events: d.events.map((ev) => ({
        title: ev.title,
        time: ev.time,
        durationMinutes: ev.durationMinutes,
        location: ev.location,
        description: ev.description,
      })),
    })),
  }))

  // Find template suggestions based on feast days in the coptic data
  const suggestedTemplates = await getTemplateSuggestions(
    copticData,
    templates.map((t) => ({ id: t.id, name: t.name }))
  )

  return (
    <ScheduleManager
      initialEvents={events}
      initialTemplates={templates}
      copticData={copticData}
      suggestedTemplates={suggestedTemplates}
    />
  )
}
