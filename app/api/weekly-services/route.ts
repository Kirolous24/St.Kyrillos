import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

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

    if (typeof dayOfWeek !== 'number' || !title || !time) {
      return NextResponse.json({ error: 'dayOfWeek, title, and time are required' }, { status: 400 })
    }

    const [h, m] = time.split(':').map(Number)
    const sortOrder = h * 60 + m

    const service = await prisma.weeklyService.create({
      data: {
        dayOfWeek,
        title: String(title).slice(0, 200),
        time: String(time).slice(0, 10),
        durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : 60,
        location: String(location || 'Main Church').slice(0, 200),
        description: description ? String(description).slice(0, 500) : null,
        enabled: enabled !== false,
        sortOrder,
      },
    })

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error('Error creating weekly service:', error)
    return NextResponse.json({ error: 'Failed to create weekly service' }, { status: 500 })
  }
}
