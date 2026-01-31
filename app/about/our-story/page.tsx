import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Our Story',
  description: `Learn about the history and mission of ${CHURCH_INFO.fullName} in ${CHURCH_INFO.location}.`,
}

export default function OurStoryPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Our Story
            </h1>
            <p className="text-xl text-white/80">
              The history and mission of {CHURCH_INFO.name}
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            {/* Main Content */}
            <div className="prose-custom">
              <div className="bg-primary-50 border-l-4 border-primary-900 p-6 rounded-r-lg mb-12">
                <p className="text-lg text-gray-700 italic m-0">
                  [This section should tell your church's founding story. Update
                  this content with the actual history of St. Kyrillos the Sixth.]
                </p>
              </div>

              <h2>Our Founding</h2>
              <p>
                St. Kyrillos the Sixth Coptic Orthodox Church was established in
                [YEAR] to serve the growing Coptic Orthodox community in the
                Antioch and greater Nashville area of Tennessee.
              </p>
              <p>
                [Add details about how the church was founded, who the founding
                members were, any challenges overcome, and how the community has
                grown over the years.]
              </p>

              <h2>Our Mission</h2>
              <p>
                Our mission is to proclaim the Gospel of Jesus Christ through
                the apostolic Coptic Orthodox tradition, to nurture the spiritual
                growth of our members, and to welcome all who seek to know the
                ancient Christian faith.
              </p>
              <p>
                We are committed to:
              </p>
              <ul>
                <li>Celebrating the Holy Liturgy and sacraments</li>
                <li>Teaching the Orthodox faith to all ages</li>
                <li>Building a loving, supportive community</li>
                <li>Serving those in need in our local community</li>
                <li>Sharing the beauty of Orthodox Christianity with all who seek</li>
              </ul>

              <h2>Our Community Today</h2>
              <p>
                Today, {CHURCH_INFO.name} is a vibrant community of families,
                young adults, and individuals united in the Orthodox faith. We
                gather each Sunday for the Divine Liturgy, throughout the week
                for Bible studies and prayer services, and for fellowship events
                that bring our community together.
              </p>
              <p>
                We are part of the{' '}
                <a
                  href={CHURCH_INFO.diocese.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CHURCH_INFO.diocese.name}
                </a>
                , under the spiritual leadership of His Holiness Pope Tawadros II,
                Pope of Alexandria and Patriarch of the See of St. Mark.
              </p>

              <h2>Our Patron Saint</h2>
              <p>
                Our church is named in honor of Pope Kyrillos VI (1902–1971),
                the 116th Pope of Alexandria. Known for his deep prayer life,
                humility, and the many miracles attributed to his intercession,
                St. Kyrillos VI remains one of the most beloved saints of the
                modern Coptic Church.
              </p>
            </div>

            {/* Links to Related Pages */}
            <div className="mt-16 pt-12 border-t border-gray-200">
              <h3 className="font-serif text-heading-3 text-gray-900 mb-6">
                Learn More
              </h3>
              <div className="grid gap-4">
                <Link
                  href="/about/clergy"
                  className="group flex items-center justify-between p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-primary-900 transition-colors">
                      Meet Our Clergy
                    </h4>
                    <p className="text-gray-600 text-sm">
                      Learn about Fr. Pachom Ibrahim and our clergy team
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-900 transition-colors" />
                </Link>
                <Link
                  href="/about/coptic-orthodoxy"
                  className="group flex items-center justify-between p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-primary-900 transition-colors">
                      What is Coptic Orthodoxy?
                    </h4>
                    <p className="text-gray-600 text-sm">
                      Discover the ancient Christian faith
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-900 transition-colors" />
                </Link>
                <Link
                  href="/about/st-kyrillos-vi"
                  className="group flex items-center justify-between p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-primary-900 transition-colors">
                      St. Kyrillos VI
                    </h4>
                    <p className="text-gray-600 text-sm">
                      Our patron saint and his legacy
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-900 transition-colors" />
                </Link>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <Button href="/im-new" variant="primary" size="lg">
                Plan Your Visit
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
