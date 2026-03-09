import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// GET all templates with nested days + events
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.seasonTemplate.findMany({
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

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST create a new template with nested days + events
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, totalDays, days } = body

    if (!name || !description || typeof totalDays !== 'number' || !Array.isArray(days)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const template = await prisma.seasonTemplate.create({
      data: {
        name: String(name).slice(0, 200),
        description: String(description).slice(0, 500),
        totalDays,
        days: {
          create: days.map((day: { dayOffset: number; label: string; events: Array<{ title: string; time: string; durationMinutes: number; location: string; description?: string | null }> }) => ({
            dayOffset: day.dayOffset,
            label: String(day.label).slice(0, 200),
            events: {
              create: (day.events || []).map((ev) => ({
                title: String(ev.title).slice(0, 200),
                time: String(ev.time).slice(0, 10),
                durationMinutes: typeof ev.durationMinutes === 'number' ? ev.durationMinutes : 60,
                location: String(ev.location || 'Main Church').slice(0, 200),
                description: ev.description ? String(ev.description).slice(0, 500) : null,
              })),
            },
          })),
        },
      },
      include: {
        days: {
          orderBy: { dayOffset: 'asc' },
          include: { events: { orderBy: { time: 'asc' } } },
        },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
