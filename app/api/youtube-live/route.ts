import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const CHANNEL_HANDLE = '@SaintKyrillosTN'

interface YouTubeSearchItem {
  id: { videoId: string }
  snippet: {
    title: string
    description: string
    thumbnails: {
      high: { url: string }
    }
    liveBroadcastContent: 'live' | 'upcoming' | 'none'
    publishedAt: string
  }
}

interface YouTubeVideoItem {
  id: string
  liveStreamingDetails?: {
    scheduledStartTime?: string
    actualStartTime?: string
    actualEndTime?: string
    concurrentViewers?: string
  }
  snippet: {
    title: string
    description: string
    thumbnails: {
      high: { url: string }
    }
  }
}

async function getChannelId(): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null

  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'id')
  url.searchParams.set('forHandle', CHANNEL_HANDLE)
  url.searchParams.set('key', YOUTUBE_API_KEY)

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data.items && data.items.length > 0) {
    return data.items[0].id
  }
  return null
}

async function searchLiveStreams(channelId: string, eventType: 'live' | 'upcoming'): Promise<YouTubeSearchItem[]> {
  if (!YOUTUBE_API_KEY) return []

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('channelId', channelId)
  url.searchParams.set('eventType', eventType)
  url.searchParams.set('type', 'video')
  url.searchParams.set('order', 'date')
  url.searchParams.set('maxResults', '5')
  url.searchParams.set('key', YOUTUBE_API_KEY)

  const response = await fetch(url.toString())
  const data = await response.json()

  return data.items || []
}

async function getVideoDetails(videoIds: string[]): Promise<YouTubeVideoItem[]> {
  if (!YOUTUBE_API_KEY || videoIds.length === 0) return []

  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,liveStreamingDetails')
  url.searchParams.set('id', videoIds.join(','))
  url.searchParams.set('key', YOUTUBE_API_KEY)

  const response = await fetch(url.toString())
  const data = await response.json()

  return data.items || []
}

export async function GET() {
  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({
        isLive: false,
        hasUpcoming: false,
        error: 'YouTube API key not configured'
      })
    }

    // Get channel ID from handle
    const channelId = await getChannelId()
    if (!channelId) {
      return NextResponse.json({
        isLive: false,
        hasUpcoming: false,
        error: 'Could not find YouTube channel'
      })
    }

    // Check for currently live streams
    const liveStreams = await searchLiveStreams(channelId, 'live')

    if (liveStreams.length > 0) {
      const videoId = liveStreams[0].id.videoId
      const videoDetails = await getVideoDetails([videoId])
      const video = videoDetails[0]

      return NextResponse.json({
        isLive: true,
        hasUpcoming: false,
        videoId,
        title: video?.snippet.title || liveStreams[0].snippet.title,
        thumbnail: video?.snippet.thumbnails.high.url,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        viewers: video?.liveStreamingDetails?.concurrentViewers
      })
    }

    // Check for upcoming scheduled streams
    const upcomingStreams = await searchLiveStreams(channelId, 'upcoming')

    if (upcomingStreams.length > 0) {
      const videoIds = upcomingStreams.map(s => s.id.videoId)
      const videoDetails = await getVideoDetails(videoIds)

      // Sort by scheduled start time to get the next one
      const sortedUpcoming = videoDetails
        .filter(v => v.liveStreamingDetails?.scheduledStartTime)
        .sort((a, b) => {
          const timeA = new Date(a.liveStreamingDetails!.scheduledStartTime!).getTime()
          const timeB = new Date(b.liveStreamingDetails!.scheduledStartTime!).getTime()
          return timeA - timeB
        })

      if (sortedUpcoming.length > 0) {
        const nextStream = sortedUpcoming[0]
        const scheduledTime = nextStream.liveStreamingDetails?.scheduledStartTime

        return NextResponse.json({
          isLive: false,
          hasUpcoming: true,
          videoId: nextStream.id,
          title: nextStream.snippet.title,
          thumbnail: nextStream.snippet.thumbnails.high.url,
          scheduledStartTime: scheduledTime,
          watchUrl: `https://www.youtube.com/watch?v=${nextStream.id}`
        })
      }
    }

    // No live or upcoming streams
    return NextResponse.json({
      isLive: false,
      hasUpcoming: false,
      message: 'No live or scheduled streams found'
    })
  } catch (error) {
    console.error('Error checking YouTube live status:', error)
    return NextResponse.json(
      {
        isLive: false,
        hasUpcoming: false,
        error: 'Failed to check live status'
      },
      { status: 500 }
    )
  }
}
