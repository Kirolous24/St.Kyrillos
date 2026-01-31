'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnnouncementBannerProps {
  message: string
  link?: {
    href: string
    text: string
  }
  variant?: 'info' | 'warning' | 'success'
}

export function AnnouncementBanner({
  message,
  link,
  variant = 'info',
}: AnnouncementBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  const variantStyles = {
    info: 'bg-primary-900 text-white',
    warning: 'bg-gold text-white',
    success: 'bg-green-600 text-white',
  }

  return (
    <div
      className={cn(
        'relative py-3 px-4',
        variantStyles[variant],
        'animate-fade-in'
      )}
    >
      <div className="container-custom">
        <div className="flex items-center justify-center gap-3 text-sm md:text-base">
          <Bell className="w-4 h-4 flex-shrink-0 animate-float" />
          <p className="text-center">
            {message}
            {link && (
              <>
                {' '}
                <Link
                  href={link.href}
                  className="underline font-semibold hover:no-underline"
                >
                  {link.text}
                </Link>
              </>
            )}
          </p>
          <button
            onClick={() => setIsVisible(false)}
            className="absolute right-4 p-1 rounded hover:bg-white/20 transition-colors"
            aria-label="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
