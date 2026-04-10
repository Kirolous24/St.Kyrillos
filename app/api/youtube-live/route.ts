import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LIVESTREAM } from '@/lib/constants'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const SEARCH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes between search.list calls (100 units each)
const VERIFY_INTERVAL_MS = 30 * 1000 // 30 seconds between videos.list calls (1 unit each)

/**
 * GET — Returns current livestream status.
 *
 * Primary:  reads from DB (populated by PubSubHubbub webhook — near real-time on publish).
 * Verify:   if DB has a stored videoId (even if isLive=false, e.g. an "upcoming" scheduled
 *           stream), call videos.list (1 unit) to check whether it's now live. Rate-limited
 *           by `updatedAt` to once per VERIFY_INTERVAL_MS. This catches the upcoming→live
 *           transition, which YouTube does NOT re-notify via PubSubHubbub.
 * Fallback: if still not live and 15+ min since last search, call search.list (100 units)
 *           to catch streams the webhook missed entirely.
 */
export async function GET() {
  try {
    let status = await prisma.livestreamStatus.findUnique({
      where: { id: 'current' },
    })

    const now = Date.now()
    const ageMs = status?.updatedAt ? now - status.updatedAt.getTime() : Infinity

    // Verify stored videoId (1 unit) — catches upcoming→live transitions and stream-end.
    // Runs whenever we have a videoId and it's been >30s since the last write.
    if (status?.videoId && YOUTUBE_API_KEY && ageMs > VERIFY_INTERVAL_MS) {
      try {
        console.log(`[YouTube Live] Verifying videoId ${status.videoId} (last update: ${ageMs}ms ago)`)
        const video = await checkVideoStatus(status.videoId)
        const broadcast = video?.snippet?.liveBroadcastContent

        if (video && broadcast === 'live') {
          console.log(`[YouTube Live] ✅ Verification: ${status.videoId} is now LIVE`)
          status = await prisma.livestreamStatus.update({
            where: { id: 'current' },
            data: {
              isLive: true,
              videoId: status.videoId,
              title: video.snippet?.title || status.title,
              thumbnail: video.snippet?.thumbnails?.high?.url || status.thumbnail,
              viewers: video.liveStreamingDetails?.concurrentViewers || null,
            },
          })
        } else if (video && broadcast === 'upcoming') {
          console.log(`[YouTube Live] ⏱️ Verification: ${status.videoId} still UPCOMING`)
          // Still scheduled — keep the videoId so we keep polling it, but bump updatedAt
          status = await prisma.livestreamStatus.update({
            where: { id: 'current' },
            data: { isLive: false },
          })
        } else if (video) {
          console.log(`[YouTube Live] ❌ Verification: ${status.videoId} no longer broadcasting (${broadcast})`)
          // Video exists but is no longer a live/upcoming broadcast (stream ended, VOD) — clear
          status = await prisma.livestreamStatus.update({
            where: { id: 'current' },
            data: { isLive: false, videoId: null, title: null, thumbnail: null, viewers: null },
          })
        } else {
          console.log(`[YouTube Live] ⚠️ Verification: ${status.videoId} not found via API`)
        }
        // If video is null (API returned nothing / transient error), leave state as-is
      } catch (err) {
        console.error('[YouTube Live] Verification error, falling through to cached state:', err)
      }
    } else if (status?.videoId) {
      console.log(`[YouTube Live] Skipping verification (ageMs: ${ageMs}ms < ${VERIFY_INTERVAL_MS}ms)`)
    }

    // DB (freshly verified or still-trusted) says we're live
    if (status?.isLive && status.videoId) {
      return NextResponse.json({
        isLive: true,
        videoId: status.videoId,
        title: status.title,
        thumbnail: status.thumbnail,
        embedUrl: `https://www.youtube.com/embed/${status.videoId}?autoplay=1`,
        watchUrl: `https://www.youtube.com/watch?v=${status.videoId}`,
        viewers: status.viewers,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' },
      })
    }

    // Not live and no stored videoId — run fallback search (100 units, max once per 15 min)
    if (YOUTUBE_API_KEY) {
      const lastSearch = status?.lastSearchAt
      const timeSinceSearch = lastSearch ? now - lastSearch.getTime() : Infinity
      const shouldSearch = !lastSearch || (timeSinceSearch > SEARCH_INTERVAL_MS)

      if (shouldSearch) {
        console.log('[YouTube Live] 🔍 Running fallback search.list poll')
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
          console.log(`[YouTube Live] 🔴 search.list found LIVE: ${videoId}`)
          return NextResponse.json({
            isLive: true,
            videoId,
            title: liveVideo.snippet?.title,
            thumbnail: liveVideo.snippet?.thumbnails?.high?.url,
            embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          }, {
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' },
          })
        } else {
          console.log('[YouTube Live] 🔍 search.list found no live stream')
        }
      } else {
        console.log(`[YouTube Live] ⏱️ Skipping search.list (${Math.round(timeSinceSearch / 1000)}s since last search, need ${SEARCH_INTERVAL_MS / 1000}s)`)
      }
    }

    // Not live
    return NextResponse.json({
      isLive: false,
      hasUpcoming: false,
      message: 'No live stream currently',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' },
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
