'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'

interface ParallaxHeroProps {
  imageSrc: string
  imageAlt: string
  title: string
  subtitle?: string
  subtitleGold?: boolean
  showScrollIndicator?: boolean
  overlayClassName?: string
  children?: React.ReactNode
}

export function ParallaxHero({
  imageSrc,
  imageAlt,
  title,
  subtitle,
  subtitleGold = true,
  showScrollIndicator = true,
  overlayClassName,
  children,
}: ParallaxHeroProps) {
  const [scrollY, setScrollY] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (isMobile) return
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobile])

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <section className="relative min-h-[60vh] md:min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Parallax */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{ transform: isMobile ? undefined : `translateY(${scrollY * 0.3}px)` }}
      >
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover scale-110"
          priority
        />
        <div className={overlayClassName || 'absolute inset-0 bg-gradient-to-b from-primary-950/60 via-black/50 to-primary-950/80'} />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_100%)]" />
      </div>

      {/* Gradient edges */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary-950/40 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-primary-950 to-transparent" />

      {/* Decorative gold lines */}
      <div className={`absolute top-1/4 left-10 w-px h-20 bg-gold/20 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute top-1/4 right-10 w-px h-20 bg-gold/20 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />

      {/* Content */}
      <div className="relative z-10 container-custom text-center text-white pt-20">
        <div className="max-w-4xl mx-auto">
          {/* Decorative line above */}
          <div className={`flex items-center justify-center gap-4 mb-6 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/60" />
            <div className="w-2 h-2 rotate-45 bg-gold/40" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/60" />
          </div>

          <h1
            className={`font-serif text-4xl sm:text-5xl md:text-6xl text-white mb-6 text-balance transition-all duration-1000 ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {title}
          </h1>

          {subtitle && (
            <p
              className={`text-xl md:text-2xl max-w-2xl mx-auto transition-all duration-1000 delay-200 ${
                isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              {subtitleGold ? (
                <span className="bg-gradient-to-r from-gold-light via-gold to-gold-light bg-clip-text text-transparent">
                  {subtitle}
                </span>
              ) : (
                <span className="text-white/80">{subtitle}</span>
              )}
            </p>
          )}

          {children && (
            <div className={`mt-8 transition-all duration-1000 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {children}
            </div>
          )}
        </div>
      </div>

      {/* Scroll indicator */}
      {showScrollIndicator && (
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000 delay-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <ChevronDown className="w-6 h-6 text-white/50 animate-scroll-down" />
        </div>
      )}
    </section>
  )
}
