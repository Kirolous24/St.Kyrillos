import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ScheduleManager } from './ScheduleManager'
import { StatsPanel } from './StatsPanel'
import { getCopticDayDataBatch, getTemplateSuggestions } from '@/lib/coptic-api'
import { Suspense } from 'react'

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

  // Fetch events, templates, weekly services, and coptic data in parallel
  const [raw, rawTemplates, rawWeeklyServices, copticData] = await Promise.all([
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
    prisma.weeklyService.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
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

  const weeklyServices = rawWeeklyServices.map((s) => ({
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

  // Find template suggestions based on feast days in the coptic data
  const suggestedTemplates = await getTemplateSuggestions(
    copticData,
    templates.map((t) => ({ id: t.id, name: t.name }))
  )

  const isKirolous = session.user?.name === 'Kirolous'

  return (
    <div>
      {isKirolous && (
        <div className="pt-6">
          <Suspense fallback={null}>
            <StatsPanel />
          </Suspense>
        </div>
      )}
      <ScheduleManager
        initialEvents={events}
        initialTemplates={templates}
        initialWeeklyServices={weeklyServices}
        copticData={copticData}
        suggestedTemplates={suggestedTemplates}
        userName={session.user?.name ?? ''}
      />
    </div>
  )
}
