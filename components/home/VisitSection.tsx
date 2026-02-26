'use client'

import { MapPin } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export function VisitSection() {
  const { ref, isVisible } = useScrollAnimation()

  // Using coordinates instead of address query removes the info popup box
  // z=13 zooms out to show the surrounding area

  const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(CHURCH_INFO.address.full)}&t=&z=10&ie=UTF8&iwloc=&output=embed`
  return (
    <section ref={ref} className={`section-padding bg-gray-50 ${isVisible ? 'animate-slide-in-right' : 'opacity-0'}`}>
      <div className="container-custom">
        <div className="text-center mb-10">
          <h2 className="font-serif text-4xl md:text-5xl text-gray-900">
            Come <span className="text-primary-900">Visit Us</span>
          </h2>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Map */}
          <div className="rounded-2xl overflow-hidden shadow-soft border border-gray-100 mb-6">
            <iframe
              src={mapsEmbedUrl}
              width="100%"
              height="450"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="St. Kyrillos the Sixth Church Location"
            />
          </div>

          {/* Address */}
          <div className="flex items-center justify-center gap-3 text-gray-600">
            <MapPin className="w-5 h-5 text-primary-900 flex-shrink-0" />
            <span className="text-lg">{CHURCH_INFO.address.full}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
