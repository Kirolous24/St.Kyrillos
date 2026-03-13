'use client'

import Image from 'next/image'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

const worshipElements = [
  { title: 'Scripture Readings', description: 'Old Testament, Epistles, and Gospels' },
  { title: 'Ancient Hymns', description: 'Unchanged since the early Church' },
  { title: 'Holy Incense', description: 'Prayers rising to God' },
  { title: 'The Eucharist', description: 'The center of our worship' },
]

export function WorshipGrid() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section className="py-24 bg-gray-900 text-white relative overflow-hidden">
      {/* Subtle grain overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
      }} />

      <div className="container-custom relative z-10">

        {/* Header */}
        <div className="flex items-center gap-6 mb-16">
          <div className="h-px flex-1 bg-gold/20" />
          <div className="text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-2">The Divine Liturgy</p>
            <h2 className="font-serif text-4xl md:text-5xl text-white">How We Worship</h2>
          </div>
          <div className="h-px flex-1 bg-gold/20" />
        </div>

        <div
          ref={ref}
          className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Two-column: text left, images right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left: intro + elements */}
            <div className="space-y-10">
              <p className="text-lg text-gray-300 leading-relaxed">
                Our worship is <span className="text-white font-medium">liturgical</span>, following ancient prayers, hymns, and rituals passed down through generations. Every gesture, word, and chant carries the weight of two thousand years.
              </p>

              <div>
                <h3 className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-6">
                  The Divine Liturgy Includes
                </h3>
                <div className="space-y-0">
                  {worshipElements.map((item, i) => (
                    <div
                      key={item.title}
                      className="flex items-start gap-4 py-5 border-b border-white/10 last:border-0"
                      style={{ transitionDelay: `${i * 80}ms` }}
                    >
                      <span className="text-gold/50 font-serif text-sm leading-none mt-0.5 select-none w-5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-white font-medium text-sm">{item.title}</p>
                        <p className="text-gray-400 text-sm mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Languages callout */}
              <div className="border-l-2 border-gold/50 pl-5">
                <p className="text-gray-300 text-sm leading-relaxed">
                  Services are conducted in <span className="text-white font-medium">English, Arabic, and Coptic</span>, the language of ancient Egypt, descended from the pharaohs, connecting us to the earliest Christians.
                </p>
              </div>
            </div>

            {/* Right: stacked images */}
            <div className="relative h-[520px] hidden lg:block">
              {/* Back image — offset */}
              <div className="absolute top-0 right-0 w-[78%] h-[58%] rounded-sm overflow-hidden shadow-2xl">
                <Image
                  src="/images/book.jpg"
                  alt="Coptic liturgical book"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gray-900/20" />
              </div>

              {/* Front image — overlapping */}
              <div className="absolute bottom-0 left-0 w-[72%] h-[54%] rounded-sm overflow-hidden shadow-2xl ring-4 ring-gray-900">
                <Image
                  src="/images/cymbals-triangle.jpg"
                  alt="Traditional liturgical instruments"
                  fill
                  className="object-cover object-[50%_72%]"
                />
                <div className="absolute inset-0 bg-gray-900/10" />
              </div>

              {/* Gold accent bar */}
              <div className="absolute top-[56%] left-[68%] w-px h-24 bg-gold/40" />
            </div>

            {/* Mobile: side-by-side images */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <div className="relative h-48 rounded-sm overflow-hidden">
                <Image src="/images/book.jpg" alt="Coptic liturgical book" fill className="object-cover" />
              </div>
              <div className="relative h-48 rounded-sm overflow-hidden">
                <Image src="/images/cymbals-triangle.jpg" alt="Traditional liturgical instruments" fill className="object-cover object-[50%_72%]" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
