import type { Metadata } from 'next'
import Image from 'next/image'
import { Youtube, Facebook, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CHURCH_INFO, SOCIAL_LINKS, LIVESTREAM } from '@/lib/constants'

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
            {/* Coptic Crosses */}
            <div className="relative flex items-center justify-center gap-8 mb-4">
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-24 h-24 opacity-40"
              />
              <h1 className="font-serif text-display-2 md:text-display-1">
                Watch Online
              </h1>
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-24 h-24 opacity-40"
              />
            </div>
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
            {/* Watch Live Button */}
            <a
              href={LIVESTREAM.youtubeLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full p-4 mb-6 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              <Youtube className="w-6 h-6" />
              Watch Live on YouTube
            </a>

            {/* Live Video Player */}
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden mb-8">
              <div className="aspect-video">
                <iframe
                  src={LIVESTREAM.youtubeLiveEmbedUrl}
                  className="w-full h-full"
                  title="St. Kyrillos the Sixth Livestream"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <p className="text-center text-sm text-gray-500 py-3">
                If the video doesn't appear above, click "Watch Live on YouTube"
              </p>
            </div>

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
