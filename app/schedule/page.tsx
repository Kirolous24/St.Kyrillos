import type { Metadata } from 'next'
import Image from 'next/image'
import { Calendar, Clock, MapPin, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CHURCH_INFO, SCHEDULE } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Service Schedule',
  description: `Service schedule for ${CHURCH_INFO.name}. Join us for Divine Liturgy, Bible study, and other services throughout the week.`,
}

export default function SchedulePage() {
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
                Service Schedule
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
              Join us for worship, prayer, and fellowship
            </p>
          </div>
        </div>
      </section>

      {/* Weekly Schedule */}
      <section className="section-padding">
        <div className="container-custom">
          <SectionHeader
            title="Weekly Services"
            subtitle="Our regular schedule of worship services"
            withAccent
          />

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SCHEDULE.regular.map((day) => (
                <div
                  key={day.day}
                  className="bg-white rounded-2xl p-8 shadow-soft border border-gray-100"
                >
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-primary-900" />
                    </div>
                    <h3 className="font-serif text-heading-3 text-gray-900">
                      {day.day}
                    </h3>
                  </div>
                  <ul className="space-y-4">
                    {day.services.map((service, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3"
                      >
                        <Clock className="w-5 h-5 text-gold mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {service.name}
                          </p>
                          <p className="text-primary-900 font-semibold">
                            {service.time}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Schedule Note */}
            <div className="mt-10 bg-gold/10 border border-gold/20 rounded-xl p-6 flex items-start gap-4">
              <Info className="w-6 h-6 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-gray-700 font-medium mb-1">Please Note</p>
                <p className="text-gray-600">
                  {SCHEDULE.calendarNote} For the most up-to-date information,
                  please check our calendar below or contact the church office.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calendar Embed */}
      <section className="section-padding">
        <div className="container-custom">
          <SectionHeader
            title="Church Calendar"
            subtitle="Special events, feast days, and schedule changes"
            withAccent
          />

          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
              <iframe
                src={SCHEDULE.calendarEmbedUrl}
                className="w-full h-[600px] border-0"
                title="Church Calendar"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Location CTA */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="bg-primary-50 rounded-2xl p-8 md:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
                <MapPin className="w-8 h-8 text-primary-900" />
              </div>
              <h2 className="font-serif text-heading-2 text-gray-900 mb-4">
                Need Directions?
              </h2>
              <p className="text-gray-600 text-body-lg mb-2">
                {CHURCH_INFO.address.full}
              </p>
              <p className="text-gray-500 text-body mb-8">
                {CHURCH_INFO.phone}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button href="/contact" variant="primary">
                  Get Directions & Parking Info
                </Button>
                <Button href="/im-new" variant="secondary">
                  Planning Your First Visit?
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
