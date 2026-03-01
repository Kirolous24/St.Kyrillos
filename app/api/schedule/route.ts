import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const events = await prisma.scheduleEvent.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
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
    const { dayOfWeek, time, sortOrder, title, description, durationMinutes, location } = body

    if (
      typeof dayOfWeek !== 'number' ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      !time ||
      typeof sortOrder !== 'number' ||
      !title
    ) {
      return NextResponse.json(
        { error: 'Invalid input. Required: dayOfWeek (0-6), time, sortOrder, title' },
        { status: 400 }
      )
    }

    const event = await prisma.scheduleEvent.create({
      data: {
        dayOfWeek,
        time: String(time).slice(0, 20),
        sortOrder,
        durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : 60,
        title: String(title).slice(0, 200),
        description: description ? String(description).slice(0, 500) : null,
        location: location ? String(location).slice(0, 200) : null,
      },
    })

    revalidatePath('/')
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
