import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logActivity, formatEventDetail } from '@/lib/activity-log'
import { dateStrToNoonUTC, isWithinWindow } from '@/lib/schedule-window'
import { isValidDuration, isValidSortOrder, isValidDateStr } from '@/lib/schedule-validation'

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

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

    if (!isValidDateStr(date) || !time || !isValidSortOrder(sortOrder) || !title) {
      return NextResponse.json(
        { error: 'Invalid input. Required: date (YYYY-MM-DD), time, sortOrder (0-1439), title' },
        { status: 400 }
      )
    }
    if (durationMinutes !== undefined && !isValidDuration(durationMinutes)) {
      return NextResponse.json({ error: 'durationMinutes must be between 1 and 1440' }, { status: 400 })
    }
    if (!isWithinWindow(date, new Date())) {
      return NextResponse.json({ error: 'Date must be within the next 4 weeks' }, { status: 400 })
    }

    const event = await prisma.scheduleEvent.update({
      where: { id },
      data: {
        date: dateStrToNoonUTC(date),
        time: String(time).slice(0, 20),
        sortOrder,
        durationMinutes: isValidDuration(durationMinutes) ? durationMinutes : 60,
        title: String(title).slice(0, 200),
        description: description ? String(description).slice(0, 500) : null,
        location: location ? String(location).slice(0, 200) : null,
      },
    })

    revalidatePath('/')
    revalidatePath('/schedule')
    revalidatePath('/admin/dashboard')
    await logActivity(session.user?.name ?? 'Unknown', 'updated', formatEventDetail(event.title, date))
    return NextResponse.json(event)
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    console.error('Error updating event:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
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
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    await prisma.scheduleEvent.delete({ where: { id } })

    revalidatePath('/')
    revalidatePath('/schedule')
    revalidatePath('/admin/dashboard')
    const dateStr = existing.date.toISOString().slice(0, 10)
    await logActivity(session.user?.name ?? 'Unknown', 'deleted', formatEventDetail(existing.title, dateStr))
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    console.error('Error deleting event:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
