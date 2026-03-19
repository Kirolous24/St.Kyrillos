import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logActivity, formatEventDetail } from '@/lib/activity-log'

// Get the start of the current week (Sunday) and end of week 4 (Saturday)
function getScheduleWindow() {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - dayOfWeek)
  weekStart.setUTCHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 27) // 4 weeks
  weekEnd.setUTCHours(23, 59, 59, 999)

  return { weekStart, weekEnd }
}

export async function GET() {
  try {
    const { weekStart, weekEnd } = getScheduleWindow()

    const events = await prisma.scheduleEvent.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
      },
      orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, time, sortOrder, title, description, durationMinutes, location } = body

    if (!date || !time || typeof sortOrder !== 'number' || !title) {
      return NextResponse.json(
        { error: 'Invalid input. Required: date (YYYY-MM-DD), time, sortOrder, title' },
        { status: 400 }
      )
    }

    // Store at noon UTC so the date never shifts by timezone
    const eventDate = new Date(`${date}T12:00:00.000Z`)
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Validate within 4-week window
    const { weekStart, weekEnd } = getScheduleWindow()
    if (eventDate < weekStart || eventDate > weekEnd) {
      return NextResponse.json(
        { error: 'Date must be within the next 4 weeks' },
        { status: 400 }
      )
    }

    const event = await prisma.scheduleEvent.create({
      data: {
        date: eventDate,
        time: String(time).slice(0, 20),
        sortOrder,
        durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : 60,
        title: String(title).slice(0, 200),
        description: description ? String(description).slice(0, 500) : null,
        location: location ? String(location).slice(0, 200) : null,
      },
    })

    revalidatePath('/')
    revalidatePath('/schedule')
    await logActivity(session.user?.name ?? 'Unknown', 'created', formatEventDetail(event.title, date))
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
