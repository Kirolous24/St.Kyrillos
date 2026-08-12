import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { materializeWeeklyServices } from '@/lib/weekly-services-materialize'

// Ensure the rolling window is populated from the enabled weekly services.
// Called by the admin dashboard on load (to catch up the current window) and
// reusable by the daily cron. Auth: an admin session OR the Vercel cron secret.
export async function POST(request: Request) {
  try {
    const session = await auth()
    const authHeader = request.headers.get('authorization')
    const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!session && !isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await materializeWeeklyServices()

    if (result.created > 0) {
      revalidatePath('/')
      revalidatePath('/schedule')
      revalidatePath('/admin/dashboard')
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error materializing weekly services:', error)
    return NextResponse.json({ error: 'Failed to materialize weekly services' }, { status: 500 })
  }
}
