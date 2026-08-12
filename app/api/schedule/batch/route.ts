import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { dateStrToNoonUTC, isWithinWindow } from '@/lib/schedule-window'
import { eventKey } from '@/lib/weekly-services-plan'
import { isValidDuration, isValidSortOrder, isValidDateStr } from '@/lib/schedule-validation'

interface BatchEvent {
  date: string
  time: string
  sortOrder: number
  durationMinutes: number
  title: string
  description: string | null
  location: string | null
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { events } = body as { events: BatchEvent[] }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 })
    }
    if (events.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 events per batch' }, { status: 400 })
    }

    const now = new Date()

    // Validate every event: same rules the single-event endpoint enforces,
    // including the 4-week window (previously the batch route skipped this).
    for (const ev of events) {
      if (!isValidDateStr(ev.date) || !ev.time || !isValidSortOrder(ev.sortOrder) || !ev.title) {
        return NextResponse.json(
          { error: `Invalid event: ${ev.title || 'unknown'}. Required: date, time, sortOrder (0-1439), title` },
          { status: 400 }
        )
      }
      if (ev.durationMinutes !== undefined && !isValidDuration(ev.durationMinutes)) {
        return NextResponse.json({ error: `Invalid duration for: ${ev.title}` }, { status: 400 })
      }
      if (!isWithinWindow(ev.date, now)) {
        return NextResponse.json({ error: `Date out of window for: ${ev.title}` }, { status: 400 })
      }
    }

    // Create all missing events in one transaction, skipping any that already
    // exist (matched by natural key) so re-applying weekly services / templates /
    // fill-day never produces duplicates. Returns only the rows actually created.
    const created = await prisma.$transaction(async (tx) => {
      const times = events.map((e) => dateStrToNoonUTC(e.date).getTime())
      const minD = new Date(Math.min(...times))
      const maxD = new Date(Math.max(...times))
      const existing = await tx.scheduleEvent.findMany({
        where: { date: { gte: minD, lte: maxD } },
        select: { date: true, sortOrder: true, title: true },
      })
      const seen = new Set(existing.map((e) => eventKey(e.date.toISOString(), e.sortOrder, e.title)))

      const out = []
      for (const ev of events) {
        const cleanTitle = String(ev.title).slice(0, 200)
        const key = eventKey(ev.date, ev.sortOrder, cleanTitle)
        if (seen.has(key)) continue // already exists OR duplicated within this batch
        seen.add(key)
        const row = await tx.scheduleEvent.create({
          data: {
            date: dateStrToNoonUTC(ev.date),
            time: String(ev.time).slice(0, 20),
            sortOrder: ev.sortOrder,
            durationMinutes: isValidDuration(ev.durationMinutes) ? ev.durationMinutes : 60,
            title: cleanTitle,
            description: ev.description ? String(ev.description).slice(0, 500) : null,
            location: ev.location ? String(ev.location).slice(0, 200) : null,
          },
        })
        out.push(row)
      }
      return out
    })

    revalidatePath('/')
    revalidatePath('/schedule')
    revalidatePath('/admin/dashboard')

    // Concise activity log, grouped by date — only for events actually created.
    if (created.length > 0) {
      const dateGroups: Record<string, string[]> = {}
      for (const ev of created) {
        const d = ev.date.toISOString().slice(0, 10)
        if (!dateGroups[d]) dateGroups[d] = []
        dateGroups[d].push(ev.title)
      }
      const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const detail = Object.entries(dateGroups)
        .map(([d, titles]) => {
          const dt = dateStrToNoonUTC(d)
          return `${titles.join(', ')} on ${DAY_SHORT[dt.getUTCDay()]}, ${MONTH_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}`
        })
        .join(' · ')
      await logActivity(session.user?.name ?? 'Unknown', 'batch_created', detail, created.length)
    }

    return NextResponse.json({ created, count: created.length }, { status: 201 })
  } catch (error) {
    console.error('Error batch creating events:', error)
    return NextResponse.json({ error: 'Failed to create events' }, { status: 500 })
  }
}
