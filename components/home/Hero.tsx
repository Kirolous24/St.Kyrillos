'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CHURCH_INFO } from '@/lib/constants'
import { Calendar, Play } from 'lucide-react'

export function Hero() {
  const [scrollY, setScrollY] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
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

  // Trigger entrance animation
  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Parallax */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{ transform: isMobile ? undefined : `translateY(${scrollY * 0.3}px)` }}
      >
        <Image
          src="/images/New_church.jpg"
          alt="St. Kyrillos the Sixth Coptic Orthodox Church"
          fill
          className="object-cover scale-110"
          priority
        />
        {/* Enhanced gradient overlay with warm tones */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-950/60 via-black/50 to-primary-950/80" />
        {/* Subtle pattern overlay for texture */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_100%)]" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary-950/40 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-primary-950 to-transparent" />

      {/* Decorative cross pattern - subtle */}
      <div className={`absolute top-1/4 left-10 w-px h-20 bg-gold/20 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute top-1/4 right-10 w-px h-20 bg-gold/20 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />

      {/* Content */}
      <div className="relative z-10 container-custom text-center text-white pt-20">
        <div className="max-w-5xl mx-auto">
          {/* Decorative line above */}
          <div className={`flex items-center justify-center gap-4 mb-8 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/60" />
            <span className="text-gold/80 text-sm font-medium tracking-[0.3em] uppercase">Welcome to</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/60" />
          </div>

          {/* Church Name */}
          <h1
            className={`font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white mb-4 text-balance transition-all duration-1000 cursor-pointer ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <span className="relative inline-block">
              <span
                className={`transition-all duration-500 drop-shadow-2xl ${
                  isHovered ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}
              >
                {CHURCH_INFO.name}
              </span>
              <span
                className={`absolute top-0 left-1/2 -translate-x-1/2 transition-all duration-500 whitespace-nowrap text-gold ${
                  isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                }`}
              >
                Ⲧⲉⲕⲕⲗⲉⲥⲓϣ Ⲁⲃⲃⲁ Ⲕⲩⲣⲓⲗⲗⲟⲥ ⲡⲓⲙⲁϩ Ⲋ
              </span>
            </span>
          </h1>

          <p
            className={`text-xl md:text-2xl text-white/90 font-light mb-2 transition-all duration-700 delay-100 ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } ${isHovered ? 'opacity-0' : ''}`}
          >
            <span className="bg-gradient-to-r from-gold-light via-gold to-gold-light bg-clip-text text-transparent">
              Coptic Orthodox Church
            </span>
          </p>

          {/* Tagline */}
          <p
            className={`text-lg md:text-xl text-white/70 mt-8 max-w-2xl mx-auto transition-all duration-1000 delay-300 leading-relaxed ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {CHURCH_INFO.tagline}
          </p>

          {/* Location badge */}
          <div className={`mt-6 transition-all duration-1000 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              {CHURCH_INFO.location}
            </span>
          </div>

          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center mt-12 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <Link
              href="/im-new"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gold hover:bg-gold-light text-primary-950 font-semibold rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(201,162,39,0.4)]"
            >
              <span>Plan Your Visit</span>
              <Calendar className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </Link>
            <Link
              href="/media/livestream"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold rounded-full border border-white/30 hover:border-white/50 transition-all duration-300 hover:scale-105"
            >
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Watch Live</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll indicator - REMOVED */}
    </section>
  )
}
