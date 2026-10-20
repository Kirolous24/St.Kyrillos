import { birthdayCalendarFor } from '@/lib/portal/data/birthday-calendar'
import { isCalendarToken, REFRESH_HOURS } from '@/lib/portal/birthday-calendar'

export const dynamic = 'force-dynamic'

/**
 * A servant's birthday calendar (2026-10-19), fetched by their calendar app
 * from `/api/portal-calendar/<secret>.ics`. Calendar apps cannot sign in, so
 * the secret in the address is the only key, and nothing here reads a session.
 *
 * Phones fetch subscriptions often, and every fetch that reaches the database
 * can wake it, which spends the free plan's monthly compute. So the website's
 * cache answers repeats for half a day, matching the refresh the calendar asks
 * for; a reset link's 404 is cached for an hour.
 */
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const token = params.file.replace(/\.ics$/, '')
  if (!isCalendarToken(token)) return new Response('Not found', { status: 404 })

  try {
    const ics = await birthdayCalendarFor(token)
    if (!ics) {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } })
    }
    const seconds = REFRESH_HOURS * 3600
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="sunday-school-birthdays.ics"',
        'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}`,
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (err) {
    console.error('[api/portal-calendar] failed:', err)
    // Uncached, so the phone keeps the birthdays it has and simply tries later.
    return new Response('Try again later', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
