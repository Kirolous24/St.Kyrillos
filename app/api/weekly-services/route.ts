import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isValidDayOfWeek, isValidTime24, isValidDuration, time24ToSortOrder } from '@/lib/schedule-validation'
import { materializeWeeklyServices } from '@/lib/weekly-services-materialize'

function revalidateScheduleSurfaces() {
  revalidatePath('/')
  revalidatePath('/schedule')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/weekly-services')
}

// GET all weekly services ordered by day + time
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const services = await prisma.weeklyService.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('Error fetching weekly services:', error)
    return NextResponse.json({ error: 'Failed to fetch weekly services' }, { status: 500 })
  }
}

// POST create a new weekly service
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    const service = await prisma.weeklyService.create({
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

    // Auto-populate the rolling window with the new service right away (respects
    // the master auto-fill switch; no-op if it's off). Idempotent.
    await materializeWeeklyServices().catch(() => {})
    revalidateScheduleSurfaces()

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error('Error creating weekly service:', error)
    return NextResponse.json({ error: 'Failed to create weekly service' }, { status: 500 })
  }
}
