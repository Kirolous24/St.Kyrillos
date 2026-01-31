'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 600px and not dismissed
      if (window.scrollY > 600 && !isDismissed) {
        setIsVisible(true)
      } else if (window.scrollY <= 600) {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isDismissed])

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDismissed(true)
    setIsVisible(false)
  }

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 z-40 lg:hidden',
        'transition-all duration-300 ease-out',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <Link
        href="/give"
        className={cn(
          'flex items-center justify-center gap-3',
          'w-full py-4 px-6 rounded-full',
          'bg-gold text-white font-semibold shadow-soft-xl',
          'hover:bg-gold-dark transition-colors',
          'animate-pulse-glow'
        )}
      >
        <Heart className="w-5 h-5" />
        <span>Support Our Church</span>
      </Link>
      <button
        onClick={handleDismiss}
        className={cn(
          'absolute -top-2 -right-2',
          'w-8 h-8 rounded-full',
          'bg-gray-800 text-white',
          'flex items-center justify-center',
          'shadow-soft hover:bg-gray-900 transition-colors'
        )}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
