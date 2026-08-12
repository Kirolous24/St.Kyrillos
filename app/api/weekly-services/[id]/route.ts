import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isValidDayOfWeek, isValidTime24, isValidDuration, time24ToSortOrder } from '@/lib/schedule-validation'
import { materializeWeeklyServices } from '@/lib/weekly-services-materialize'

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

function revalidateScheduleSurfaces() {
  revalidatePath('/')
  revalidatePath('/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/weekly-services')
}

// PUT — update a weekly service
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const body = await request.json()
    const { dayOfWeek, title, time, durationMinutes, location, description, enabled } = body

    if (!isValidDayOfWeek(dayOfWeek) || !title || !isValidTime24(time)) {
      return NextResponse.json(
        { error: 'Required: dayOfWeek (0-6), title, and time (HH:MM)' },
        { status: 400 }
      )
    }
    if (durationMinutes !== undefined && !isValidDuration(durationMinutes)) {
      return NextResponse.json({ error: 'durationMinutes must be between 1 and 1440' }, { status: 400 })
    }

    const service = await prisma.weeklyService.update({
      where: { id },
      data: {
        dayOfWeek,
        title: String(title).slice(0, 200),
        time: String(time).slice(0, 10),
        durationMinutes: isValidDuration(durationMinutes) ? durationMinutes : 60,
        location: String(location || 'Main Church').slice(0, 200),
        description: description ? String(description).slice(0, 500) : null,
        enabled: enabled !== false,
        sortOrder: time24ToSortOrder(time),
      },
    })

    // Re-materialize so a newly-enabled or retimed service appears across the
    // window immediately. Idempotent; respects the master auto-fill switch.
    await materializeWeeklyServices().catch(() => {})
    revalidateScheduleSurfaces()

    return NextResponse.json(service)
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: 'Weekly service not found' }, { status: 404 })
    }
    console.error('Error updating weekly service:', error)
    return NextResponse.json({ error: 'Failed to update weekly service' }, { status: 500 })
  }
}

// DELETE a weekly service
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    await prisma.weeklyService.delete({ where: { id } })

    revalidateScheduleSurfaces()
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isNotFound(error)) {
      return NextResponse.json({ error: 'Weekly service not found' }, { status: 404 })
    }
    console.error('Error deleting weekly service:', error)
    return NextResponse.json({ error: 'Failed to delete weekly service' }, { status: 500 })
  }
}
