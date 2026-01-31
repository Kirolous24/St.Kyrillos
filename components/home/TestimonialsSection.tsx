'use client'

import { useState, useEffect, useCallback } from 'react'
import { Quote, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const testimonials = [
  {
    id: 1,
    quote:
      "From the moment we walked in, we felt welcomed. The liturgy is beautiful, the community is warm, and we've found a true spiritual home.",
    author: 'Michael & Sarah',
    role: 'Members since 2022',
    initials: 'MS',
  },
  {
    id: 2,
    quote:
      "The ancient traditions combined with genuine love for newcomers makes St. Kyrillos special. Father Pachom's sermons always touch my heart.",
    author: 'Maria T.',
    role: 'Convert to Orthodoxy',
    initials: 'MT',
  },
  {
    id: 3,
    quote:
      "My children love Sunday School here. They're learning about the faith in a way that's engaging and meaningful. This community has become our family.",
    author: 'David K.',
    role: 'Parent',
    initials: 'DK',
  },
]

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const nextTestimonial = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length)
  }, [])

  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  // Auto-play functionality
  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      nextTestimonial()
    }, 6000) // Change every 6 seconds

    return () => clearInterval(interval)
  }, [isPaused, nextTestimonial])

  return (
    <section
      className="py-24 bg-primary-950 relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-gold rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-400 rounded-full blur-3xl" />
      </div>

      {/* Decorative quote marks */}
      <div className="absolute top-20 left-10 opacity-5">
        <Quote className="w-32 h-32 text-white" />
      </div>
      <div className="absolute bottom-20 right-10 opacity-5 rotate-180">
        <Quote className="w-32 h-32 text-white" />
      </div>

      <div className="container-custom relative">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-gold text-sm font-medium mb-6 backdrop-blur-sm">
            <Star className="w-4 h-4 fill-current" />
            <span>Community Voices</span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-white mb-4">
            Hear from Our <span className="text-gold">Parish Family</span>
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Stories of faith, belonging, and transformation
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Main testimonial card */}
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 md:p-12">
              {/* Quote icon */}
              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gold/20 flex items-center justify-center">
                  <Quote className="w-8 h-8 text-gold" />
                </div>
              </div>

              {/* Testimonial content with slide animation */}
              <div className="relative min-h-[200px]">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={testimonial.id}
                    className={cn(
                      'transition-all duration-700 ease-out',
                      index === activeIndex
                        ? 'opacity-100 translate-x-0 relative'
                        : 'opacity-0 absolute inset-0 translate-x-8 pointer-events-none'
                    )}
                  >
                    <blockquote className="text-center">
                      <p className="text-xl md:text-2xl text-white/90 leading-relaxed mb-10 font-light">
                        &ldquo;{testimonial.quote}&rdquo;
                      </p>
                      <footer className="flex flex-col items-center">
                        {/* Avatar */}
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-primary-950 font-bold text-lg mb-4">
                          {testimonial.initials}
                        </div>
                        <cite className="not-italic">
                          <span className="block font-serif text-xl font-semibold text-white">
                            {testimonial.author}
                          </span>
                          <span className="block text-gold/80 mt-1 text-sm">
                            {testimonial.role}
                          </span>
                        </cite>
                      </footer>
                    </blockquote>
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-6 mt-10">
                <button
                  onClick={prevTestimonial}
                  className={cn(
                    'w-12 h-12 rounded-full border border-white/20',
                    'flex items-center justify-center text-white/60',
                    'transition-all duration-300',
                    'hover:border-gold hover:text-gold hover:bg-gold/10',
                    'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-primary-950'
                  )}
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Progress dots */}
                <div className="flex gap-3">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        'h-2 rounded-full transition-all duration-500',
                        index === activeIndex
                          ? 'bg-gold w-10'
                          : 'bg-white/30 w-2 hover:bg-white/50'
                      )}
                      aria-label={`Go to testimonial ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={nextTestimonial}
                  className={cn(
                    'w-12 h-12 rounded-full border border-white/20',
                    'flex items-center justify-center text-white/60',
                    'transition-all duration-300',
                    'hover:border-gold hover:text-gold hover:bg-gold/10',
                    'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-primary-950'
                  )}
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Auto-play indicator */}
              <div className="flex justify-center mt-6">
                <span className="text-white/40 text-xs flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    isPaused ? "bg-white/40" : "bg-gold animate-pulse"
                  )} />
                  {isPaused ? 'Paused' : 'Auto-playing'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
