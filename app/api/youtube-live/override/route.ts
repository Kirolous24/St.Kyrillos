import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const WEBHOOK_SECRET = process.env.YOUTUBE_WEBHOOK_SECRET || 'stkyrillos-webhook-secret'

/**
 * POST — Manually force the livestream status.
 * Use when the webhook misses a notification.
 * ?videoId=VIDEO_ID&secret=WEBHOOK_SECRET  to go live
 * ?secret=WEBHOOK_SECRET&clear=true        to clear live status
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clear = request.nextUrl.searchParams.get('clear') === 'true'
  const videoId = request.nextUrl.searchParams.get('videoId')

  if (clear) {
    await prisma.livestreamStatus.upsert({
      where: { id: 'current' },
      create: { id: 'current', isLive: false },
      update: { isLive: false, videoId: null, title: null, thumbnail: null, viewers: null },
    })
    return NextResponse.json({ success: true, isLive: false })
  }

  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  // Fetch title/thumbnail from YouTube if API key available
  let title: string | null = null
  let thumbnail: string | null = null
  const apiKey = process.env.YOUTUBE_API_KEY
  if (apiKey) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('id', videoId)
      url.searchParams.set('key', apiKey)
      const res = await fetch(url.toString())
      const data = await res.json()
      const video = data.items?.[0]
      title = video?.snippet?.title || null
      thumbnail = video?.snippet?.thumbnails?.high?.url || null
    } catch {}
  }

  await prisma.livestreamStatus.upsert({
    where: { id: 'current' },
    create: { id: 'current', isLive: true, videoId, title, thumbnail },
    update: { isLive: true, videoId, title, thumbnail },
  })

  return NextResponse.json({ success: true, isLive: true, videoId, title })
}
