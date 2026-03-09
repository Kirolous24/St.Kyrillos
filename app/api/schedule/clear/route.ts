import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// DELETE events for a date range
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { startDate, endDate } = body as { startDate: string; endDate: string }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate required (YYYY-MM-DD)' }, { status: 400 })
    }

    const start = new Date(`${startDate}T00:00:00.000Z`)
    const end = new Date(`${endDate}T23:59:59.999Z`)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const result = await prisma.scheduleEvent.deleteMany({
      where: {
        date: { gte: start, lte: end },
      },
    })

    revalidatePath('/')
    revalidatePath('/schedule')
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('Error clearing events:', error)
    return NextResponse.json({ error: 'Failed to clear events' }, { status: 500 })
  }
}
