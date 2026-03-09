import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TemplateManager } from './TemplateManager'

export default async function AdminTemplatesPage() {
  const session = await auth()
  if (!session) redirect('/admin/login')

  const raw = await prisma.seasonTemplate.findMany({
    include: {
      days: {
        orderBy: { dayOffset: 'asc' },
        include: {
          events: { orderBy: { time: 'asc' } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Serialize for client
  const templates = raw.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    totalDays: t.totalDays,
    days: t.days.map((d) => ({
      id: d.id,
      dayOffset: d.dayOffset,
      label: d.label,
      events: d.events.map((e) => ({
        id: e.id,
        title: e.title,
        time: e.time,
        durationMinutes: e.durationMinutes,
        location: e.location,
        description: e.description,
      })),
    })),
  }))

  return <TemplateManager initialTemplates={templates} />
}
