import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

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

    const event = await prisma.scheduleEvent.update({
      where: { id },
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

    await prisma.scheduleEvent.delete({
      where: { id },
    })

    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
