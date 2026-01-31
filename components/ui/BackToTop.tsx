'use client'

import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when page is scrolled down 400px
      if (window.scrollY > 400) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'w-12 h-12 rounded-full',
        'bg-primary-900 text-white shadow-soft-lg',
        'flex items-center justify-center',
        'transition-all duration-300 ease-out',
        'hover:bg-primary-950 hover:scale-110',
        'focus:outline-none focus:ring-2 focus:ring-primary-900 focus:ring-offset-2',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
      aria-label="Back to top"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  )
}
