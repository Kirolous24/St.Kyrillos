'use client'

import Image from 'next/image'
import { BookOpen, Music, Flame, Heart } from 'lucide-react'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

const worshipElements = [
  {
    icon: BookOpen,
    title: 'Scripture Readings',
    description: 'Old Testament, Epistles, and Gospels',
  },
  {
    icon: Music,
    title: 'Ancient Hymns',
    description: 'Unchanged since the early Church',
  },
  {
    icon: Flame,
    title: 'Holy Incense',
    description: 'Prayers rising to God',
  },
  {
    icon: Heart,
    title: 'The Eucharist',
    description: 'The center of our worship',
  },
]

export function WorshipGrid() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section className="section-padding bg-primary-950 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_20%_50%,_white_0%,_transparent_50%)]" />

      <div className="container-custom relative z-10">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <span className="inline-block w-12 h-1 bg-gold rounded-full" />
          </div>
          <h2 className="font-serif text-heading-1 md:text-display-2 text-white text-balance">
            How We Worship
          </h2>
        </div>

        {/* Intro text */}
        <p className="text-lg text-white/80 text-center max-w-3xl mx-auto mb-16">
          Our worship is <strong className="text-white">liturgical</strong> — meaning we follow
          ancient prayers, hymns, and rituals passed down through generations.
          The Divine Liturgy includes:
        </p>

        <div
          ref={ref}
          className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
        >
          {/* Left: 2x2 grid of glass cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {worshipElements.map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="glass-dark rounded-xl p-6 hover-lift"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-gold" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-white/60 text-sm">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Right: Church image */}
          <div className="relative rounded-xl overflow-hidden shadow-soft-xl glow-gold">
            <Image
              src="/images/church2.jpg"
              alt="Interior of St. Kyrillos Coptic Orthodox Church"
              width={600}
              height={450}
              className="w-full h-auto object-cover aspect-[4/3]"
            />
          </div>
        </div>

        {/* Language callout */}
        <div className="mt-16 max-w-3xl mx-auto border-l-4 border-gold pl-6">
          <p className="text-white/80 text-lg leading-relaxed">
            Services are conducted in <strong className="text-white">English, Arabic, and Coptic</strong>
            {' '}(the language of ancient Egypt, descended from the pharaohs). The
            Coptic language preserves our ancient heritage and connects us to
            the earliest Christians.
          </p>
        </div>
      </div>
    </section>
  )
}
