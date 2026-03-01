import type { Metadata } from 'next'
import Link from 'next/link'
import { Heart, Clock, ArrowLeft } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Kitchen & Cleaning Service',
  description: `Kitchen and cleaning ministry at ${CHURCH_INFO.fullName}. Serving the community through hospitality and care.`,
}

export default function KitchenCleaningPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Kitchen & Cleaning
            </h1>
            <p className="text-xl text-white/80">
              Serving with Love Behind the Scenes
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="section-padding bg-white">
        <div className="container-custom max-w-4xl">
          <div className="mb-12">
            <h2 className="font-serif text-3xl font-semibold text-gray-900 mb-6">
              About This Ministry
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              The Kitchen and Cleaning ministry is one of the most humble and essential forms of service in our church. These dedicated volunteers ensure our church home is clean, welcoming, and ready to receive the congregation — reflecting the care and love we have for one another.
            </p>
            <p className="text-gray-700 text-lg leading-relaxed">
              "Whoever wants to become great among you must be your servant." — Matthew 20:26
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* How We Serve */}
            <div className="bg-primary-50 rounded-xl p-6 border border-primary-100">
              <div className="flex items-center gap-3 mb-4">
                <Heart className="w-5 h-5 text-primary-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">How We Serve</h3>
              </div>
              <ul className="text-gray-700 space-y-2 text-sm">
                <li>• Preparing and serving food for church gatherings</li>
                <li>• Setting up and cleaning after events</li>
                <li>• Maintaining kitchen hygiene and supplies</li>
                <li>• Cleaning the church hall and common areas</li>
                <li>• Supporting special occasions and celebrations</li>
              </ul>
            </div>

            {/* When */}
            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-green-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">When We Serve</h3>
              </div>
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">Regular:</span> Sundays after Liturgy
              </p>
              <p className="text-gray-700 text-sm mt-3">
                Additional service days around church feasts, events, and special gatherings.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-primary-900 to-primary-950 rounded-xl p-8 text-white text-center">
            <h3 className="font-serif text-2xl font-semibold mb-4">
              Serve With Us
            </h3>
            <p className="text-white/80 max-w-2xl mx-auto">
              This ministry is open to all who have a heart to serve. No special skills needed — just a willing spirit and love for the church community.
            </p>
          </div>
        </div>
      </section>

      {/* Back Link */}
      <section className="section-padding bg-gray-50 border-t border-gray-200">
        <div className="container-custom">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-primary-900 hover:text-primary-950 font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Services
          </Link>
        </div>
      </section>
    </>
  )
}
