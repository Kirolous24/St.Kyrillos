import { NextRequest, NextResponse } from 'next/server'
import { LIVESTREAM, SITE_URL } from '@/lib/constants'

const WEBHOOK_SECRET = process.env.YOUTUBE_WEBHOOK_SECRET || 'stkyrillos-webhook-secret'
const PUBSUBHUBBUB_HUB = 'https://pubsubhubbub.appspot.com/subscribe'

/**
 * GET — Called by Vercel cron every 7 days to renew PubSubHubbub subscription.
 */
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const callbackUrl = `${SITE_URL}/api/youtube-webhook`
    const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${LIVESTREAM.youtubeChannelId}`

    const formData = new URLSearchParams({
      'hub.callback': callbackUrl,
      'hub.topic': topic,
      'hub.verify': 'async',
      'hub.mode': 'subscribe',
      'hub.secret': WEBHOOK_SECRET,
      'hub.lease_seconds': '864000', // 10 days
    })

    const response = await fetch(PUBSUBHUBBUB_HUB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[YouTube Cron] Hub returned ${response.status}: ${errorText}`)
      return NextResponse.json({ error: `Hub error: ${response.status}` }, { status: 502 })
    }

    console.log('[YouTube Cron] Subscription renewal sent to hub')
    return NextResponse.json({ success: true, message: 'Subscription renewal sent' })
  } catch (error) {
    console.error('[YouTube Cron] Error:', error)
    return NextResponse.json({ error: 'Failed to renew' }, { status: 500 })
  }
}
