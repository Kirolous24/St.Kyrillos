import type { Metadata } from 'next'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WeeklyScheduleSection } from '@/components/home/WeeklyScheduleSection'
import { CHURCH_INFO } from '@/lib/constants'

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
      <WeeklyScheduleSection />

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
