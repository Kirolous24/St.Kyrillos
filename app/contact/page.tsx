import type { Metadata } from 'next'
import { MapPin, Phone, Mail, Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CHURCH_INFO } from '@/lib/constants'
import { ContactForm } from '@/components/forms/ContactForm'

export const metadata: Metadata = {
  title: 'Contact & Visit Us',
  description: `Contact ${CHURCH_INFO.fullName} or plan your visit. Get directions, parking information, office hours, and more.`,
}

export default function ContactPage() {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CHURCH_INFO.address.full)}`

  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Visit Us
            </h1>
            <p className="text-xl text-white/80">
              We'd love to welcome you to {CHURCH_INFO.name}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Info */}
            <div>
              <h2 className="font-serif text-heading-2 text-gray-900 mb-8">
                Contact Information
              </h2>

              <div className="space-y-6">
                {/* Address */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Address</h3>
                    <p className="text-gray-600">
                      {CHURCH_INFO.address.street}<br />
                      {CHURCH_INFO.address.city}, {CHURCH_INFO.address.state} {CHURCH_INFO.address.zip}
                    </p>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-900 font-medium mt-2 hover:underline"
                    >
                      Get Directions
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
                    <a
                      href={`tel:${CHURCH_INFO.phone.replace(/\D/g, '')}`}
                      className="text-gray-600 hover:text-primary-900 transition-colors"
                    >
                      {CHURCH_INFO.phone}
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                    <a
                      href={`mailto:${CHURCH_INFO.email}`}
                      className="text-gray-600 hover:text-primary-900 transition-colors"
                    >
                      {CHURCH_INFO.email}
                    </a>
                  </div>
                </div>

                {/* Office Hours */}
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Office Hours</h3>
                    <ul className="text-gray-600 space-y-1">
                      {CHURCH_INFO.officeHours.map((item, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{item.day}:</span> {item.hours}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Parking Info */}
              <div className="mt-10 bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Parking & Directions
                </h3>
                <p className="text-gray-600 text-sm">
                  [Add specific parking instructions here — lot location, overflow
                  parking, accessible entrance notes, and driving directions from
                  major highways.]
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <h2 className="font-serif text-heading-2 text-gray-900 mb-8">
                Send Us a Message
              </h2>
              <div className="bg-white rounded-2xl p-8 shadow-soft border border-gray-100">
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <SectionHeader
            title="Find Us"
            withAccent
          />

          <div className="max-w-4xl mx-auto">
            {/* Map Placeholder */}
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
              <div className="aspect-[16/9] bg-gray-100 flex items-center justify-center">
                <div className="text-center p-8">
                  <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg mb-2">
                    Google Maps will be embedded here
                  </p>
                  <p className="text-gray-400 text-sm max-w-md mx-auto mb-4">
                    Add your Google Maps embed code or use the address to generate one.
                  </p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary-900 font-medium hover:underline"
                  >
                    Open in Google Maps
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              {/*
                Uncomment when you have the embed code:
                <iframe
                  src="YOUR_GOOGLE_MAPS_EMBED_URL"
                  className="w-full h-[400px] border-0"
                  loading="lazy"
                  title="Church Location"
                />
              */}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-serif text-heading-2 text-gray-900 mb-4">
              Planning Your First Visit?
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Check out our guide for new visitors to learn what to expect,
              what to wear, and how to prepare for the Divine Liturgy.
            </p>
            <Button href="/im-new" variant="primary" size="lg">
              I'm New — Tell Me More
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
