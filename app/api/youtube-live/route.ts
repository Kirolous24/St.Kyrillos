import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LIVESTREAM } from '@/lib/constants'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

/**
 * GET — Returns current livestream status.
 *
 * Primary: reads from DB (populated by PubSubHubbub webhook — near real-time).
 * Fallback: if DB says live, verify with a cheap videos.list call (1 unit)
 *           to detect when the stream ends.
 */
export async function GET() {
  try {
    const status = await prisma.livestreamStatus.findUnique({
      where: { id: 'current' },
    })

    // DB says we're live — verify the stream is still running
    if (status?.isLive && status.videoId && YOUTUBE_API_KEY) {
      const video = await checkVideoStatus(status.videoId)

      if (video && video.snippet?.liveBroadcastContent === 'live') {
        // Still live — return fresh data with updated viewer count
        return NextResponse.json({
          isLive: true,
          videoId: status.videoId,
          title: video.snippet.title || status.title,
          thumbnail: video.snippet.thumbnails?.high?.url || status.thumbnail,
          embedUrl: `https://www.youtube.com/embed/${status.videoId}?autoplay=1`,
          watchUrl: `https://www.youtube.com/watch?v=${status.videoId}`,
          viewers: video.liveStreamingDetails?.concurrentViewers || status.viewers,
        }, {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
        })
      }

      // Stream ended — update DB
      await prisma.livestreamStatus.update({
        where: { id: 'current' },
        data: { isLive: false, videoId: null, title: null, thumbnail: null, viewers: null },
      })
    }

    // DB says live and we have data (but no API key to verify — trust it)
    if (status?.isLive && status.videoId && !YOUTUBE_API_KEY) {
      return NextResponse.json({
        isLive: true,
        videoId: status.videoId,
        title: status.title,
        thumbnail: status.thumbnail,
        embedUrl: `https://www.youtube.com/embed/${status.videoId}?autoplay=1`,
        watchUrl: `https://www.youtube.com/watch?v=${status.videoId}`,
        viewers: status.viewers,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
      })
    }

    // Not live
    return NextResponse.json({
      isLive: false,
      hasUpcoming: false,
      message: 'No live stream currently',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('Error checking livestream status:', error)
    return NextResponse.json(
      { isLive: false, hasUpcoming: false, error: 'Failed to check live status' },
      { status: 500 }
    )
  }
}

/**
 * Check a single video's live status.
 * Uses videos.list (1 quota unit) instead of search.list (100 units).
 */
async function checkVideoStatus(videoId: string) {
  if (!YOUTUBE_API_KEY) return null

  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,liveStreamingDetails')
  url.searchParams.set('id', videoId)
  url.searchParams.set('key', YOUTUBE_API_KEY)

  const response = await fetch(url.toString())
  const data = await response.json()
  return data.items?.[0] || null
}
