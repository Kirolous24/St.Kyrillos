import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LIVESTREAM } from '@/lib/constants'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const SEARCH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes between search.list calls

/**
 * GET — Returns current livestream status.
 *
 * Primary:  reads from DB (populated by PubSubHubbub webhook — near real-time).
 * Fallback: if not live and 15+ min since last search, calls YouTube search.list
 *           (100 units) to catch any streams the webhook may have missed.
 * Verify:   if DB says live, calls videos.list (1 unit) to confirm still running.
 */
export async function GET() {
  try {
    const status = await prisma.livestreamStatus.findUnique({
      where: { id: 'current' },
    })

    // DB says we're live — verify the stream is still running (1 unit)
    if (status?.isLive && status.videoId && YOUTUBE_API_KEY) {
      const video = await checkVideoStatus(status.videoId)

      if (video && video.snippet?.liveBroadcastContent === 'live') {
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

    // DB says live but no API key — trust DB
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

    // Not live — run fallback search if enough time has passed (100 units, max once per 15 min)
    if (YOUTUBE_API_KEY) {
      const lastSearch = status?.lastSearchAt
      const shouldSearch = !lastSearch || (Date.now() - lastSearch.getTime() > SEARCH_INTERVAL_MS)

      if (shouldSearch) {
        console.log('[YouTube Live] Running fallback search.list poll')
        const liveVideo = await searchLiveStream()

        // Always update lastSearchAt regardless of result
        await prisma.livestreamStatus.upsert({
          where: { id: 'current' },
          create: {
            id: 'current',
            isLive: !!liveVideo,
            videoId: liveVideo?.id?.videoId || null,
            title: liveVideo?.snippet?.title || null,
            thumbnail: liveVideo?.snippet?.thumbnails?.high?.url || null,
            lastSearchAt: new Date(),
          },
          update: {
            isLive: !!liveVideo,
            videoId: liveVideo?.id?.videoId || null,
            title: liveVideo?.snippet?.title || null,
            thumbnail: liveVideo?.snippet?.thumbnails?.high?.url || null,
            lastSearchAt: new Date(),
          },
        })

        if (liveVideo) {
          const videoId = liveVideo.id?.videoId
          return NextResponse.json({
            isLive: true,
            videoId,
            title: liveVideo.snippet?.title,
            thumbnail: liveVideo.snippet?.thumbnails?.high?.url,
            embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          }, {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
          })
        }
      }
    }

    // Not live
    return NextResponse.json({
      isLive: false,
      hasUpcoming: false,
      message: 'No live stream currently',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    })
  } catch (error) {
    console.error('Error checking livestream status:', error)
    return NextResponse.json(
      { isLive: false, hasUpcoming: false, error: 'Failed to check live status' },
      { status: 500 }
    )
  }
}

/** Check a single video's live status — 1 quota unit */
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

/** Search for a live stream on the channel — 100 quota units */
async function searchLiveStream() {
  if (!YOUTUBE_API_KEY) return null
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('channelId', LIVESTREAM.youtubeChannelId)
  url.searchParams.set('eventType', 'live')
  url.searchParams.set('type', 'video')
  url.searchParams.set('key', YOUTUBE_API_KEY)
  const response = await fetch(url.toString())
  const data = await response.json()
  return data.items?.[0] || null
}
