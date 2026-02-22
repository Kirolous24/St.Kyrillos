import type { Metadata } from 'next'
import { Clock, MapPin, Shirt, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CHURCH_INFO, SCHEDULE, FAQS } from '@/lib/constants'

export const metadata: Metadata = {
  title: "I'm New - What to Expect",
  description: `Planning your first visit to ${CHURCH_INFO.name}? Learn what to expect, what to wear, service times, and answers to common questions about visiting a Coptic Orthodox church.`,
}

export default function ImNewPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-32 md:py-48 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900 bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url(/images/church1.jpeg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/50 z-0"></div>
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-6">
              Welcome
            </h1>
            <p className="text-xl text-white/80">
              Everything you need to know for your first visit to {CHURCH_INFO.name}
            </p>
          </div>
        </div>
      </section>

      {/* Quick Info Box */}
      <section className="relative -mt-8 z-20">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-soft-lg p-8 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Service Time */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Sunday Liturgy</h3>
                    <p className="text-gray-600 text-sm">
                      {SCHEDULE.regular[0]?.services[1]?.time || '8:00 AM'}
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Location</h3>
                    <p className="text-gray-600 text-sm">
                      {CHURCH_INFO.address.city}, {CHURCH_INFO.address.state}
                    </p>
                  </div>
                </div>

                {/* Dress */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Shirt className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Dress Code</h3>
                    <p className="text-gray-600 text-sm">Modest attire</p>
                  </div>
                </div>

                {/* Service Length */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Service Length</h3>
                    <p className="text-gray-600 text-sm">~2.5-3 hours</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 pt-8 border-t border-gray-200">
                <Button href="/schedule" variant="secondary">
                  See Full Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="section-padding">
        <div className="container-custom">
          <SectionHeader
            title="What to Expect"
            subtitle="Your first visit to an Orthodox church can feel unfamiliar. Here's what you need to know."
            withAccent
          />

          <div className="max-w-4xl mx-auto">
            <div className="grid gap-8 md:gap-12">
              {/* When You Arrive */}
              <div className="bg-gray-50 rounded-2xl p-8">
                <h3 className="font-serif text-heading-3 text-gray-900 mb-4">
                  When You Arrive
                </h3>
                <p className="text-body-lg text-gray-600">
                  You'll be greeted at the door by friendly members of our congregation.
                  Don't worry about knowing what to do — just follow along as best you can,
                  or simply observe and take it all in. There's no pressure to participate
                  in ways you're not comfortable with.
                </p>
              </div>

              {/* During the Liturgy */}
              <div className="bg-gray-50 rounded-2xl p-8">
                <h3 className="font-serif text-heading-3 text-gray-900 mb-4">
                  During the Liturgy
                </h3>
                <div className="text-body-lg text-gray-600 space-y-4">
                  <p>
                    The Divine Liturgy is our main Sunday worship service. We stand for most
                    of the service (chairs are available along the walls for those who need them).
                    It's perfectly fine to sit when you need to rest.
                  </p>
                  <p>
                    Hymns are sung in three languages: English, Arabic, and Coptic (the
                    ancient language of Egypt). Service books are available to help you
                    follow along, or you can simply listen and pray.
                  </p>
                  <p>
                    Feel free to arrive a bit late or step out if needed — many families
                    with young children do this. No one will judge you.
                  </p>
                </div>
              </div>

              {/* At Communion */}
              <div className="bg-gray-50 rounded-2xl p-8">
                <h3 className="font-serif text-heading-3 text-gray-900 mb-4">
                  At Communion
                </h3>
                <div className="text-body-lg text-gray-600 space-y-4">
                  <p>
                    Holy Communion (the Eucharist) is reserved for Orthodox Christians who
                    have prepared through fasting, prayer, and recent confession. If you
                    are not Orthodox, we kindly ask that you refrain from receiving Communion.
                  </p>
                  <p>
                    However, <strong className="text-gray-900">everyone is welcome</strong> to
                    approach the priest at the end of the service to receive blessed bread,
                    which is offered to all as a sign of fellowship.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <SectionHeader
            title="Frequently Asked Questions"
            withAccent
          />

          <div className="max-w-3xl mx-auto">
            {FAQS.map((category) => (
              <div key={category.category} className="mb-12 last:mb-0">
                <h3 className="font-serif text-heading-3 text-primary-900 mb-6">
                  {category.category}
                </h3>
                <div className="space-y-6">
                  {category.questions.map((faq, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-6 shadow-soft">
                      <h4 className="font-semibold text-lg text-gray-900 mb-3">
                        {faq.question}
                      </h4>
                      <p className="text-gray-600 text-body leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-900">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="font-serif text-heading-1 mb-6">Ready to Visit?</h2>
            <p className="text-lg text-white/80 mb-8">
              We'd love to meet you. Check our schedule and come see us this Sunday.
              If you have questions, don't hesitate to reach out.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button href="/schedule" variant="gold" size="lg">
                See Schedule
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
