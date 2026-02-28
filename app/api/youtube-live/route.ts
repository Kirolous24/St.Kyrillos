import { NextResponse } from 'next/server'
import { LIVESTREAM } from '@/lib/constants'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

interface YouTubeSearchItem {
  id: { videoId: string }
  snippet: {
    title: string
    thumbnails: {
      high: { url: string }
    }
  }
}

interface YouTubeVideoItem {
  id: string
  liveStreamingDetails?: {
    concurrentViewers?: string
  }
  snippet: {
    title: string
    thumbnails: {
      high: { url: string }
    }
  }
}

async function searchLiveStreams(channelId: string): Promise<YouTubeSearchItem[]> {
  if (!YOUTUBE_API_KEY) return []

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('channelId', channelId)
  url.searchParams.set('eventType', 'live')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '1')
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
        error: 'YouTube API key not configured'
      })
    }

    const channelId = LIVESTREAM.youtubeChannelId
    const liveStreams = await searchLiveStreams(channelId)

    if (liveStreams.length > 0) {
      const videoId = liveStreams[0].id.videoId
      const videoDetails = await getVideoDetails([videoId])
      const video = videoDetails[0]

      return NextResponse.json({
        isLive: true,
        videoId,
        title: video?.snippet.title || liveStreams[0].snippet.title,
        thumbnail: video?.snippet.thumbnails.high.url,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        viewers: video?.liveStreamingDetails?.concurrentViewers
      })
    }

    return NextResponse.json({
      isLive: false,
      message: 'No live stream currently'
    })
  } catch (error) {
    console.error('Error checking YouTube live status:', error)
    return NextResponse.json(
      { isLive: false, error: 'Failed to check live status' },
      { status: 500 }
    )
  }
}
