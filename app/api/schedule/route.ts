import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logActivity, formatEventDetail } from '@/lib/activity-log'
import { scheduleWindowUTC, dateStrToNoonUTC, isWithinWindow } from '@/lib/schedule-window'
import { isValidDuration, isValidSortOrder, isValidDateStr } from '@/lib/schedule-validation'

export async function GET() {
  try {
    const { weekStart, weekEnd } = scheduleWindowUTC(new Date())

    const events = await prisma.scheduleEvent.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
      },
      orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
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

    if (!isValidDateStr(date) || !time || !isValidSortOrder(sortOrder) || !title) {
      return NextResponse.json(
        { error: 'Invalid input. Required: date (YYYY-MM-DD), time, sortOrder (0-1439), title' },
        { status: 400 }
      )
    }
    if (durationMinutes !== undefined && !isValidDuration(durationMinutes)) {
      return NextResponse.json({ error: 'durationMinutes must be between 1 and 1440' }, { status: 400 })
    }

    // Store at noon UTC so the date never shifts by timezone
    const eventDate = dateStrToNoonUTC(date)

    // Validate within the rolling window (same window the public site shows)
    if (!isWithinWindow(date, new Date())) {
      return NextResponse.json({ error: 'Date must be within the next 4 weeks' }, { status: 400 })
    }

    const cleanTitle = String(title).slice(0, 200)

    // Idempotency: if an identical event (same day + start minute + title) already
    // exists, return it instead of creating a duplicate. This makes double-submits,
    // network retries, and re-applied presets safe without a DB unique constraint.
    const existing = await prisma.scheduleEvent.findFirst({
      where: { date: eventDate, sortOrder, title: { equals: cleanTitle, mode: 'insensitive' } },
    })
    if (existing) {
      return NextResponse.json(existing, { status: 200 })
    }

    const event = await prisma.scheduleEvent.create({
      data: {
        date: eventDate,
        time: String(time).slice(0, 20),
        sortOrder,
        durationMinutes: isValidDuration(durationMinutes) ? durationMinutes : 60,
        title: cleanTitle,
        description: description ? String(description).slice(0, 500) : null,
        location: location ? String(location).slice(0, 200) : null,
      },
    })

    revalidatePath('/')
    revalidatePath('/schedule')
    revalidatePath('/admin/dashboard')
    await logActivity(session.user?.name ?? 'Unknown', 'created', formatEventDetail(event.title, date))
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
