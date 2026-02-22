import type { Metadata } from 'next'
import Image from 'next/image'
import { Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CHURCH_INFO, CLERGY } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Our Clergy',
  description: `Meet the clergy of ${CHURCH_INFO.fullName}. Learn about Fr. Pachom Ibrahim and our pastoral team.`,
}

export default function ClergyPage() {
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
                Our Clergy
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
              Shepherding our community in faith and love
            </p>
          </div>
        </div>
      </section>

      {/* Clergy List */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            {CLERGY.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl shadow-soft overflow-hidden mb-8 last:mb-0"
              >
                <div className="md:flex">
                  {/* Photo */}
                  <div className="md:w-1/3 flex-shrink-0">
                    <div className="aspect-[2/3] md:h-full bg-gray-100 relative">
                      <Image
                        src="/images/clergy/fr-pachom.png"
                        alt={member.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="md:w-2/3 min-w-0 p-8 md:p-10 md:pl-16">
                    <div className="mb-6">
                      <p className="text-gold font-semibold text-sm uppercase tracking-wide mb-2">
                        {member.title}
                      </p>
                      <h2 className="font-serif text-heading-2 text-gray-900">
                        {member.name}
                      </h2>
                    </div>

                    <div className="prose-custom mb-8">
                      <p>{member.bio}</p>
                    </div>

                    {/* Contact */}
                    <div className="pt-6 border-t border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-4">
                        Contact
                      </h3>
                      <div className="flex flex-wrap gap-4">
                        <a
                          href={`mailto:${member.contact.email}`}
                          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-900 transition-colors"
                        >
                          <Mail className="w-5 h-5" />
                          <span>{member.contact.email}</span>
                        </a>
                        <a
                          href={`tel:${member.contact.phone.replace(/\D/g, '')}`}
                          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-900 transition-colors"
                        >
                          <Phone className="w-5 h-5" />
                          <span>{member.contact.phone}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-serif text-heading-2 text-gray-900 mb-4">
              Schedule an Appointment
            </h2>
            <p className="text-gray-600 text-body-lg mb-8">
              For pastoral meetings, confession, sacrament inquiries, or
              spiritual guidance, please contact Fr. Pachom to schedule
              an appointment.
            </p>
            <Button href="/confession" variant="primary" size="lg">
              Book Confession
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
