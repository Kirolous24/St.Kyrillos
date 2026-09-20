import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LIVESTREAM, SITE_URL } from '@/lib/constants'
import { recordHubAttempt, readHubAttempt } from '@/lib/youtube-hub'

const WEBHOOK_SECRET = process.env.YOUTUBE_WEBHOOK_SECRET
const PUBSUBHUBBUB_HUB = 'https://pubsubhubbub.appspot.com/subscribe'

/**
 * POST — Subscribe (or renew) to YouTube PubSubHubbub notifications.
 * Called by the Vercel cron job every 7 days, or manually.
 * Protected by CRON_SECRET for cron calls.
 */
export async function POST() {

  try {
    const callbackUrl = `${SITE_URL}/api/youtube-webhook`
    const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${LIVESTREAM.youtubeChannelId}`

    // Send subscription request to Google's PubSubHubbub hub. hub.secret is
    // included when configured so the hub signs notifications (verified in
    // the POST handler of ../route.ts). Must match what the cron route sends.
    const formData = new URLSearchParams({
      'hub.callback': callbackUrl,
      'hub.topic': topic,
      'hub.verify': 'async',
      'hub.mode': 'subscribe',
      'hub.lease_seconds': '864000', // 10 days (max)
    })
    if (WEBHOOK_SECRET) formData.set('hub.secret', WEBHOOK_SECRET)

    const response = await fetch(PUBSUBHUBBUB_HUB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[YouTube Subscribe] Hub returned ${response.status}: ${errorText}`)
      await recordHubAttempt(`HTTP ${response.status}: ${errorText.trim()}`)
      return NextResponse.json(
        { error: `Hub returned ${response.status}`, details: errorText },
        { status: 502 }
      )
    }

    await recordHubAttempt('ok')
    console.log('[YouTube Subscribe] Subscription request sent to hub (awaiting async verification)')

    return NextResponse.json({
      success: true,
      message: 'Subscription request sent. YouTube will verify asynchronously.',
      callback: callbackUrl,
      topic,
    })
  } catch (error) {
    await recordHubAttempt(`fetch failed: ${error instanceof Error ? error.message : String(error)}`)
    console.error('[YouTube Subscribe] Error:', error)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }
}

/**
 * GET — Check current subscription status.
 */
export async function GET() {
  try {
    const [status, hub] = await Promise.all([
      prisma.livestreamStatus.findUnique({ where: { id: 'current' } }),
      readHubAttempt(),
    ])

    if (!status) {
      return NextResponse.json({
        subscribed: false,
        message: 'No subscription found. POST to this endpoint to subscribe.',
        hubLastAttemptAt: hub.lastAttemptAt,
        hubLastResult: hub.lastResult,
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
      hubLastAttemptAt: hub.lastAttemptAt,
      hubLastResult: hub.lastResult,
    })
  } catch (error) {
    console.error('[YouTube Subscribe] Status check error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
