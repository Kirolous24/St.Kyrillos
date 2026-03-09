import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// PUT — full replace of a template (deletes old days/events, creates new ones)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { name, description, totalDays, days } = body

    if (!name || !description || typeof totalDays !== 'number' || !Array.isArray(days)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Delete old days (cascade deletes events too)
    await prisma.templateDay.deleteMany({ where: { templateId: id } })

    // Update template and create new days + events
    const template = await prisma.seasonTemplate.update({
      where: { id },
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

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE a template
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    await prisma.seasonTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
