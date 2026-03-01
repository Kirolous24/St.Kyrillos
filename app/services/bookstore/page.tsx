import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Clock, ArrowLeft } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Bookstore',
  description: `The bookstore ministry at ${CHURCH_INFO.fullName}. Coptic Orthodox books, icons, and resources for the community.`,
}

export default function BookstorePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Bookstore
            </h1>
            <p className="text-xl text-white/80">
              Resources to Nourish Your Faith
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="section-padding bg-white">
        <div className="container-custom max-w-4xl">
          <div className="mb-12">
            <h2 className="font-serif text-3xl font-semibold text-gray-900 mb-6">
              About the Bookstore
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Our church bookstore offers a curated selection of Coptic Orthodox literature, icons, prayer books, and spiritual resources to support your journey in faith. Run entirely by volunteers, it is a ministry of service to our community.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* What We Offer */}
            <div className="bg-primary-50 rounded-xl p-6 border border-primary-100">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-5 h-5 text-primary-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">What We Offer</h3>
              </div>
              <ul className="text-gray-700 space-y-2 text-sm">
                <li>• Coptic Orthodox books and devotionals</li>
                <li>• Icons and religious artwork</li>
                <li>• Prayer books and liturgy guides</li>
                <li>• Children's faith resources</li>
                <li>• CDs and audio recordings of hymns</li>
              </ul>
            </div>

            {/* Hours */}
            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-green-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">Hours</h3>
              </div>
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">Open:</span> Sundays after Liturgy
              </p>
              <p className="text-gray-700 text-sm mt-3">
                Located in the church hall. Look for the bookstore table after service.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-primary-900 to-primary-950 rounded-xl p-8 text-white text-center">
            <h3 className="font-serif text-2xl font-semibold mb-4">
              Volunteer at the Bookstore
            </h3>
            <p className="text-white/80 max-w-2xl mx-auto">
              Interested in serving through the bookstore ministry? We welcome volunteers to help organize and manage resources for our community.
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
