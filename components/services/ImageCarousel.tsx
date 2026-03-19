'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CarouselImage {
  src: string
  alt: string
  position?: string
}

interface ImageCarouselProps {
  images: CarouselImage[]
  title?: string
}

export function ImageCarousel({ images, title }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % images.length)
  }, [images.length])

  const prev = () => setCurrent(c => (c - 1 + images.length) % images.length)

  useEffect(() => {
    if (isPaused || images.length <= 1) return
    const timer = setInterval(next, 4500)
    return () => clearInterval(timer)
  }, [isPaused, next, images.length])

  if (!images.length) return null

  return (
    <section className="py-16 md:py-20" style={{ background: 'linear-gradient(180deg, #faf7f2 0%, #ffffff 100%)' }}>
      {title && (
        <div className="container-custom mb-10">
          <div className="flex items-center gap-5">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-gold/40" />
            <h2 className="font-serif text-2xl md:text-3xl text-gray-900 whitespace-nowrap px-2">{title}</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/40 to-gold/40" />
          </div>
        </div>
      )}

      <div className="container-custom">
        <div
          className="relative overflow-hidden rounded-2xl mx-auto"
          style={{ maxWidth: '860px', height: 'clamp(280px, 52vh, 560px)' }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Sliding track */}
          <div
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${current * (100 / images.length)}%)`, width: `${images.length * 100}%` }}
          >
            {images.map((img, i) => (
              <div key={i} className="relative h-full flex-shrink-0" style={{ width: `${100 / images.length}%` }}>
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover"
                  style={{ objectPosition: img.position ?? 'center' }}
                  sizes="860px"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>

          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/25 via-transparent to-transparent rounded-2xl" />

          {/* Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/25 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-all duration-200 group"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/25 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-all duration-200 group"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </>
          )}

          {/* Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 items-center">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === current
                      ? 'w-7 h-2.5 bg-gold'
                      : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
