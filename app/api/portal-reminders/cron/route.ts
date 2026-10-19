import { NextResponse } from 'next/server'
import { sendTomorrowReminders } from '@/lib/portal/data/reminders'

export const dynamic = 'force-dynamic'

/**
 * Servant assignment reminders (2026-10-19): Vercel's scheduler calls this once
 * a day at about 6 PM church time (vercel.json), and it reminds every servant
 * with a part due tomorrow. Only the scheduler, which sends the cron secret, may
 * run it, and with no secret configured nobody may.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await sendTomorrowReminders())
  } catch (err) {
    console.error('[api/portal-reminders/cron] failed:', err)
    return NextResponse.json({ error: 'Reminders failed' }, { status: 500 })
  }
}
