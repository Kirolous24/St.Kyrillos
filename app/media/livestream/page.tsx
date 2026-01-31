import type { Metadata } from 'next'
import { Youtube, Facebook, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CHURCH_INFO, SOCIAL_LINKS, LIVESTREAM } from '@/lib/constants'
import { LivestreamPlayer } from '@/components/LivestreamPlayer'

export const metadata: Metadata = {
  title: 'Watch Online',
  description: `Watch livestreamed services from ${CHURCH_INFO.fullName}. Join us online for Divine Liturgy and other services.`,
}

export default function LivestreamPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Watch Online
            </h1>
            <p className="text-xl text-white/80">
              Join us for livestreamed services
            </p>
          </div>
        </div>
      </section>

      {/* Livestream Embed */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            {/* Live Video Player */}
            <LivestreamPlayer />

            {/* Schedule Info */}
            <div className="bg-gold/10 border border-gold/20 rounded-xl p-6 mb-8">
              <h2 className="font-semibold text-gray-900 mb-2">
                Livestream Schedule
              </h2>
              <p className="text-gray-600">
                {LIVESTREAM.schedule}. Check our{' '}
                <a href="/schedule" className="text-primary-900 font-medium hover:underline">
                  full schedule
                </a>{' '}
                for service times.
              </p>
            </div>

            {/* Social Links */}
            <div className="grid sm:grid-cols-2 gap-4">
              <a
                href={SOCIAL_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-6 bg-white rounded-xl shadow-soft border border-gray-100 hover:shadow-soft-lg transition-shadow group"
              >
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Youtube className="w-7 h-7 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-900 transition-colors">
                    YouTube Channel
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Watch past services and subscribe
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-gray-400" />
              </a>

              <a
                href={SOCIAL_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-6 bg-white rounded-xl shadow-soft border border-gray-100 hover:shadow-soft-lg transition-shadow group"
              >
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Facebook className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-900 transition-colors">
                    Facebook Page
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Live videos and community updates
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-gray-400" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* In-Person CTA */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-serif text-heading-2 text-gray-900 mb-4">
              Join Us In Person
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              While we're grateful to offer online services, nothing compares
              to worshipping together in person. We'd love to welcome you to
              our church.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button href="/im-new" variant="primary" size="lg">
                Plan Your Visit
              </Button>
              <Button href="/contact" variant="secondary" size="lg">
                Get Directions
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
