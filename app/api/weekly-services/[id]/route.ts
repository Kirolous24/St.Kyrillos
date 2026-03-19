import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

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

    if (typeof dayOfWeek !== 'number' || !title || !time) {
      return NextResponse.json({ error: 'dayOfWeek, title, and time are required' }, { status: 400 })
    }

    const [h, m] = time.split(':').map(Number)
    const sortOrder = h * 60 + m

    const service = await prisma.weeklyService.update({
      where: { id },
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

    return NextResponse.json(service)
  } catch (error) {
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
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting weekly service:', error)
    return NextResponse.json({ error: 'Failed to delete weekly service' }, { status: 500 })
  }
}
