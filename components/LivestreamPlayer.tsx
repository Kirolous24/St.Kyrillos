'use client'

import { useEffect, useState } from 'react'
import { Play, ExternalLink, Calendar, Clock, Users } from 'lucide-react'
import { LIVESTREAM } from '@/lib/constants'
import { Button } from '@/components/ui/Button'

interface LiveStatus {
  isLive: boolean
  hasUpcoming: boolean
  videoId?: string
  title?: string
  thumbnail?: string
  embedUrl?: string
  watchUrl?: string
  viewers?: string
  scheduledStartTime?: string
  message?: string
  error?: string
}

function formatScheduledTime(isoString: string): { date: string; time: string; relative: string } {
  const date = new Date(isoString)
  const now = new Date()

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  // Calculate relative time
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  let relative: string
  if (diffMs < 0) {
    relative = 'Starting soon'
  } else if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60))
    relative = `In ${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  } else if (diffHours < 24) {
    relative = `In ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
  } else if (diffDays === 1) {
    relative = 'Tomorrow'
  } else {
    relative = `In ${diffDays} days`
  }

  return { date: dateStr, time: timeStr, relative }
}

export function LivestreamPlayer() {
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkLiveStatus() {
      try {
        const response = await fetch('/api/youtube-live')
        const data = await response.json()
        setLiveStatus(data)
      } catch (err) {
        console.error('Failed to check live status:', err)
        setLiveStatus({ isLive: false, hasUpcoming: false, error: 'Failed to load livestream status' })
      } finally {
        setIsLoading(false)
      }
    }

    checkLiveStatus()

    // Refresh every 2 minutes to check if stream has started
    const interval = setInterval(checkLiveStatus, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-soft-xl aspect-video mb-8">
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Play className="w-10 h-10 text-white" />
            </div>
            <p className="text-white/80 text-lg mb-2">
              Checking for live stream...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Currently LIVE
  if (liveStatus?.isLive && liveStatus.embedUrl) {
    return (
      <div className="mb-8">
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="font-semibold text-sm uppercase tracking-wide">
              Live Now
            </span>
          </div>
          {liveStatus.viewers && (
            <div className="flex items-center gap-1 text-sm">
              <Users className="w-4 h-4" />
              <span>{parseInt(liveStatus.viewers).toLocaleString()} watching</span>
            </div>
          )}
        </div>
        <div className="bg-gray-900 rounded-b-2xl overflow-hidden shadow-soft-xl aspect-video">
          <iframe
            src={liveStatus.embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={liveStatus.title || 'Live Service'}
          />
        </div>
        {liveStatus.title && (
          <p className="mt-3 text-gray-700 font-medium">{liveStatus.title}</p>
        )}
        {liveStatus.watchUrl && (
          <div className="mt-4 text-center">
            <Button
              href={liveStatus.watchUrl}
              variant="secondary"
              size="sm"
              external
            >
              Watch on YouTube
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Upcoming scheduled stream
  if (liveStatus?.hasUpcoming && liveStatus.scheduledStartTime) {
    const scheduled = formatScheduledTime(liveStatus.scheduledStartTime)

    return (
      <div className="mb-8">
        <div className="bg-gradient-to-r from-primary-700 to-primary-800 text-white px-4 py-2 rounded-t-2xl flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4" />
          <span className="font-semibold text-sm uppercase tracking-wide">
            Next Live Stream
          </span>
        </div>
        <div className="bg-gray-900 rounded-b-2xl overflow-hidden shadow-soft-xl">
          <div className="relative aspect-video">
            {liveStatus.thumbnail ? (
              <img
                src={liveStatus.thumbnail}
                alt={liveStatus.title || 'Upcoming stream'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <Play className="w-16 h-16 text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="text-center text-white p-6">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">{scheduled.relative}</span>
                </div>
                <p className="text-2xl font-semibold mb-2">{scheduled.date}</p>
                <p className="text-xl text-white/90">{scheduled.time}</p>
              </div>
            </div>
          </div>
          <div className="p-6 bg-gray-800">
            {liveStatus.title && (
              <h3 className="text-white font-semibold text-lg mb-4">{liveStatus.title}</h3>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {liveStatus.watchUrl && (
                <Button
                  href={liveStatus.watchUrl}
                  variant="primary"
                  size="md"
                  external
                >
                  Set Reminder on YouTube
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              )}
              <Button
                href={LIVESTREAM.youtubeStreamsUrl}
                variant="secondary"
                size="md"
                external
              >
                View Past Streams
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No live or upcoming streams
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-soft-xl aspect-video mb-8">
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
            <Play className="w-10 h-10 text-white" />
          </div>
          <p className="text-white/80 text-lg mb-2">
            No Live Stream Currently
          </p>
          <p className="text-white/60 text-sm max-w-md mx-auto mb-6">
            {liveStatus?.error || 'Check back during service times to watch live, or view our past streams on YouTube.'}
          </p>
          <Button
            href={LIVESTREAM.youtubeStreamsUrl}
            variant="secondary"
            size="md"
            external
          >
            View Past Streams
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
