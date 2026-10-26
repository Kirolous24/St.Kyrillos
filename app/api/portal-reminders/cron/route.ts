import { NextResponse } from 'next/server'
import { sendDailyReminders } from '@/lib/portal/data/reminders'
import { shuffleDueGroups } from '@/lib/portal/data/groups'

export const dynamic = 'force-dynamic'

/**
 * The portal's evening job. Vercel's scheduler calls this once a day at about
 * 6 PM church time (vercel.json). It shuffles the follow-up groups that are due
 * (every two months, 2026-10-25), then reminds every servant with a part due
 * tomorrow and, every other evening, of the coming Sunday's parts they have
 * not marked done (2026-10-19, daily since 2026-10-25). Only the scheduler,
 * which sends the cron secret, may run it, and with no secret configured
 * nobody may.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // The follow-up groups due a shuffle are shuffled first (2026-10-25), so
  // tonight's reminders and tomorrow's lists already show the new groups. A
  // failure there must not cost anybody their reminder.
  let groups: { classes: number; moved: number } | { error: string }
  try {
    groups = await shuffleDueGroups()
  } catch (err) {
    console.error('[api/portal-reminders/cron] shuffling failed:', err)
    groups = { error: 'Shuffling failed' }
  }
  try {
    return NextResponse.json({ ...(await sendDailyReminders()), groups })
  } catch (err) {
    console.error('[api/portal-reminders/cron] failed:', err)
    return NextResponse.json({ error: 'Reminders failed' }, { status: 500 })
  }
}
