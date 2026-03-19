import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logActivity, formatEventDetail } from '@/lib/activity-log'

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
    const { date, time, sortOrder, title, description, durationMinutes, location } = body

    if (!date || !time || typeof sortOrder !== 'number' || !title) {
      return NextResponse.json(
        { error: 'Invalid input. Required: date (YYYY-MM-DD), time, sortOrder, title' },
        { status: 400 }
      )
    }

    const eventDate = new Date(`${date}T12:00:00.000Z`)
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const event = await prisma.scheduleEvent.update({
      where: { id },
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
    await logActivity(session.user?.name ?? 'Unknown', 'updated', formatEventDetail(event.title, date))
    return NextResponse.json(event)
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

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

    const existing = await prisma.scheduleEvent.findUnique({ where: { id } })
    await prisma.scheduleEvent.delete({ where: { id } })

    revalidatePath('/')
    revalidatePath('/schedule')
    if (existing) {
      const dateStr = existing.date.toISOString().slice(0, 10)
      await logActivity(session.user?.name ?? 'Unknown', 'deleted', formatEventDetail(existing.title, dateStr))
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
