import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

interface BatchEvent {
  date: string
  time: string
  sortOrder: number
  durationMinutes: number
  title: string
  description: string | null
  location: string | null
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { events } = body as { events: BatchEvent[] }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 })
    }

    if (events.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 events per batch' }, { status: 400 })
    }

    // Validate each event
    for (const ev of events) {
      if (!ev.date || !ev.time || typeof ev.sortOrder !== 'number' || !ev.title) {
        return NextResponse.json(
          { error: `Invalid event: ${ev.title || 'unknown'}. Required: date, time, sortOrder, title` },
          { status: 400 }
        )
      }
      const d = new Date(`${ev.date}T12:00:00.000Z`)
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: `Invalid date format for: ${ev.title}` },
          { status: 400 }
        )
      }
    }

    // Create all events in a transaction
    const created = await prisma.$transaction(
      events.map((ev) =>
        prisma.scheduleEvent.create({
          data: {
            date: new Date(`${ev.date}T12:00:00.000Z`),
            time: String(ev.time).slice(0, 20),
            sortOrder: ev.sortOrder,
            durationMinutes: typeof ev.durationMinutes === 'number' ? ev.durationMinutes : 60,
            title: String(ev.title).slice(0, 200),
            description: ev.description ? String(ev.description).slice(0, 500) : null,
            location: ev.location ? String(ev.location).slice(0, 200) : null,
          },
        })
      )
    )

    revalidatePath('/')
    revalidatePath('/schedule')
    return NextResponse.json({ created, count: created.length }, { status: 201 })
  } catch (error) {
    console.error('Error batch creating events:', error)
    return NextResponse.json(
      { error: 'Failed to create events' },
      { status: 500 }
    )
  }
}
