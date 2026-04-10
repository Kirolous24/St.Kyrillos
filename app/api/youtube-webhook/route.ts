import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LIVESTREAM } from '@/lib/constants'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

/**
 * GET — PubSubHubbub subscription verification.
 * YouTube sends a challenge query param that we must echo back.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const topic = searchParams.get('hub.topic')
  const challenge = searchParams.get('hub.challenge')
  const leaseSeconds = searchParams.get('hub.lease_seconds')

  // Verify this is for our channel
  const expectedTopic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${LIVESTREAM.youtubeChannelId}`

  if ((mode === 'subscribe' || mode === 'unsubscribe') && topic === expectedTopic && challenge) {
    console.log(`[YouTube Webhook] Subscription ${mode} verified, lease: ${leaseSeconds}s`)

    // Record subscription in DB
    if (mode === 'subscribe' && leaseSeconds) {
      const leaseMs = parseInt(leaseSeconds, 10) * 1000
      await prisma.livestreamStatus.upsert({
        where: { id: 'current' },
        create: {
          id: 'current',
          isLive: false,
          subscribedAt: new Date(),
          leaseExpiresAt: new Date(Date.now() + leaseMs),
        },
        update: {
          subscribedAt: new Date(),
          leaseExpiresAt: new Date(Date.now() + leaseMs),
        },
      })
    }

    // Must return the challenge as plain text
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return new NextResponse('Invalid verification request', { status: 404 })
}

/**
 * POST — PubSubHubbub notification.
 * YouTube sends an Atom XML feed entry when new content is published.
 * We parse it, check if it's a live stream, and update DB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    console.log('[YouTube Webhook] POST received, body length:', body.length)

    // Parse the Atom XML to extract video ID
    // YouTube sends: <yt:videoId>VIDEO_ID</yt:videoId>
    const videoIdMatch = body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
    if (!videoIdMatch) {
      console.log('[YouTube Webhook] No video ID found in payload')
      return new NextResponse('OK', { status: 200 })
    }

    const videoId = videoIdMatch[1]
    console.log(`[YouTube Webhook] Received notification for video: ${videoId}`)

    // Check if this video is actually a live stream using the YouTube API
    if (!YOUTUBE_API_KEY) {
      console.error('[YouTube Webhook] No YouTube API key configured')
      return new NextResponse('OK', { status: 200 })
    }

    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet,liveStreamingDetails')
    url.searchParams.set('id', videoId)
    url.searchParams.set('key', YOUTUBE_API_KEY)

    const response = await fetch(url.toString())
    const data = await response.json()
    const video = data.items?.[0]

    if (!video) {
      console.log(`[YouTube Webhook] Video ${videoId} not found via API`)
      return new NextResponse('OK', { status: 200 })
    }

    const liveBroadcastContent = video.snippet?.liveBroadcastContent
    const isLive = liveBroadcastContent === 'live'
    const isUpcoming = liveBroadcastContent === 'upcoming'

    if (!isLive && !isUpcoming) {
      console.log(`[YouTube Webhook] ⏭️ Ignoring video ${videoId} (broadcast content: ${liveBroadcastContent})`)
      return new NextResponse('OK', { status: 200 })
    }

    // Don't let an "upcoming" notification clobber an active live stream.
    // YouTube re-fires webhooks whenever metadata changes, and a scheduled
    // future stream can arrive while we're still live on a different video.
    // The live verification in /api/youtube-live will clear state when the
    // current stream actually ends, freeing the slot for the next one.
    const current = await prisma.livestreamStatus.findUnique({ where: { id: 'current' } })
    if (isUpcoming && current?.isLive && current.videoId && current.videoId !== videoId) {
      console.log(`[YouTube Webhook] 🛡️ Protecting live stream ${current.videoId} — ignoring upcoming notification for ${videoId}`)
      return new NextResponse('OK', { status: 200 })
    }

    await prisma.livestreamStatus.upsert({
      where: { id: 'current' },
      create: {
        id: 'current',
        isLive,
        videoId,
        title: video.snippet?.title,
        thumbnail: video.snippet?.thumbnails?.high?.url,
        viewers: video.liveStreamingDetails?.concurrentViewers || null,
      },
      update: {
        isLive,
        videoId,
        title: video.snippet?.title,
        thumbnail: video.snippet?.thumbnails?.high?.url,
        viewers: video.liveStreamingDetails?.concurrentViewers || null,
      },
    })

    console.log(`[YouTube Webhook] ✅ Updated livestream status: ${isLive ? '🔴 LIVE' : '⏱️ UPCOMING'} — ${video.snippet?.title}`)

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('[YouTube Webhook] Error processing notification:', error)
    return new NextResponse('Internal error', { status: 500 })
  }
}
