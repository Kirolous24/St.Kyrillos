import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LIVESTREAM, SITE_URL } from '@/lib/constants'

const WEBHOOK_SECRET = process.env.YOUTUBE_WEBHOOK_SECRET || 'stkyrillos-webhook-secret'
const PUBSUBHUBBUB_HUB = 'https://pubsubhubbub.appspot.com/subscribe'

/**
 * POST — Subscribe (or renew) to YouTube PubSubHubbub notifications.
 * Called by the Vercel cron job every 7 days, or manually.
 * Protected by CRON_SECRET for cron calls.
 */
export async function POST(request: NextRequest) {
  // Verify this is from Vercel cron or an admin
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const callbackUrl = `${SITE_URL}/api/youtube-webhook`
    const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${LIVESTREAM.youtubeChannelId}`

    // Send subscription request to Google's PubSubHubbub hub
    const formData = new URLSearchParams({
      'hub.callback': callbackUrl,
      'hub.topic': topic,
      'hub.verify': 'async',
      'hub.mode': 'subscribe',
      'hub.secret': WEBHOOK_SECRET,
      'hub.lease_seconds': '864000', // 10 days (max)
    })

    const response = await fetch(PUBSUBHUBBUB_HUB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[YouTube Subscribe] Hub returned ${response.status}: ${errorText}`)
      return NextResponse.json(
        { error: `Hub returned ${response.status}`, details: errorText },
        { status: 502 }
      )
    }

    console.log('[YouTube Subscribe] Subscription request sent to hub (awaiting async verification)')

    return NextResponse.json({
      success: true,
      message: 'Subscription request sent. YouTube will verify asynchronously.',
      callback: callbackUrl,
      topic,
    })
  } catch (error) {
    console.error('[YouTube Subscribe] Error:', error)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }
}

/**
 * GET — Check current subscription status.
 */
export async function GET() {
  try {
    const status = await prisma.livestreamStatus.findUnique({
      where: { id: 'current' },
    })

    if (!status) {
      return NextResponse.json({
        subscribed: false,
        message: 'No subscription found. POST to this endpoint to subscribe.',
      })
    }

    const isExpired = status.leaseExpiresAt ? status.leaseExpiresAt < new Date() : true

    return NextResponse.json({
      subscribed: !isExpired,
      subscribedAt: status.subscribedAt,
      leaseExpiresAt: status.leaseExpiresAt,
      isExpired,
      isLive: status.isLive,
      videoId: status.videoId,
      lastUpdated: status.updatedAt,
    })
  } catch (error) {
    console.error('[YouTube Subscribe] Status check error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
