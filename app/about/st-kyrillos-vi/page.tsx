import type { Metadata } from 'next'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'

export const metadata: Metadata = {
  title: 'St. Kyrillos VI - Our Patron Saint',
  description: 'Learn about Pope Kyrillos VI (1902-1971), the 116th Pope of Alexandria and patron saint of our church. A man of deep prayer, humility, and miracles.',
}

export default function StKyrillosPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-gold font-semibold mb-4">Our Patron Saint</p>
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
                Pope Kyrillos VI
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
              1902 – 1971 • 116th Pope of Alexandria
            </p>
          </div>
        </div>
      </section>

      {/* Why Churches Are Named After Saints */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="prose-custom space-y-6">
              <p className="text-xl text-gray-700 leading-relaxed">
                Orthodox churches are typically named after saints, people who lived righteous,
                God fearing lives and were recognized by the Church for their holiness. The
                parishioners remember the saint&apos;s story and use that as encouragement to live
                their own lives of godliness. The saint also provides intercessions and prayers
                on behalf of the church.
              </p>
              <p className="text-lg text-gray-700">
                Our patron saint is <strong>Saint Pope Kyrillos VI</strong>. Below is his story
                and after that are some spiritual applications of his life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Story of St. Kyrillos VI */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              title="The Life of Saint Pope Kyrillos VI"
              withAccent
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Image on the left */}
              <div className="relative h-96 md:h-full rounded-xl overflow-hidden shadow-lg">
                <Image
                  src="/images/popek1.jpg"
                  alt="Pope Kyrillos VI"
                  fill
                  className="object-cover object-top scale-110 origin-top"
                />
              </div>

              {/* Text on the right */}
              <div className="prose-custom space-y-6">
                <p>
                  Saint Pope Kyrillos VI was born in Egypt with the name <strong>Azer Youssef Atta</strong>.
                  From an early age he was drawn to a life with God, and as a young man he left his work
                  to pursue monastic life. In 1928 he became a monk at the Monastery of El Baramous and
                  was known as <strong>Father Mina El Baramosy</strong>. He longed for a life of quiet
                  prayer and worship, so he sought solitude and lived for a time in a windmill in Old Cairo,
                  turning a simple place into a life of repentance, prayer, and the Divine Liturgy.
                </p>

                <p>
                  His life of prayer did not make him distant from people. Many came to him for counsel,
                  confession, comfort, and guidance. In 1959 the Church chose him to become Pope and
                  Patriarch of Alexandria, and he took the name <strong>Kyrillos VI</strong>. During his
                  years as Pope from 1959 to 1971 he became widely known for his devotion to prayer and
                  the liturgy, and for his fatherly care for all who came to him.
                </p>

                <p>
                  One of the great fruits of his love for monastic life and his devotion to Saint Mina
                  was the founding of the modern <strong>Monastery of Saint Mina in Mariut</strong>. Soon
                  after becoming Pope he laid its foundation, and it became a place of prayer, repentance,
                  and pilgrimage for many.
                </p>

                <p>
                  Saint Pope Kyrillos VI departed this life on <strong>March 9, 1971</strong>. Later,
                  according to his will, his body was moved to the Monastery of Saint Mina, where many
                  continue to visit and seek God&apos;s mercy through prayer.
                </p>

                <p>
                  In <strong>2013</strong> the Coptic Orthodox Church formally canonized Saint Pope
                  Kyrillos VI among the saints, confirming what many had witnessed for decades—a life
                  marked by humility, repentance, deep prayer, and a powerful witness to the presence of God.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spiritual Application */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="bg-primary-50 rounded-2xl p-8 md:p-12">
              <h2 className="font-serif text-heading-3 text-primary-900 mb-6 text-center">
                His Legacy for Our Church
              </h2>
              <div className="prose-custom">
                <p className="text-gray-700 text-lg leading-relaxed text-center">
                  As our patron saint, Saint Pope Kyrillos VI calls us to be rooted in the altar,
                  the Scriptures, confession, and prayer, and to live with confidence that Christ
                  is present and faithful in every generation. May his prayers be with us, and may
                  God plant within us the same spirit of repentance, peace, and unwavering trust in Him.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prayer */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-8 md:p-12 text-center shadow-soft">
              <Star className="w-10 h-10 text-gold mx-auto mb-6" />
              <h2 className="font-serif text-heading-3 text-gray-900 mb-6">
                Prayer to St. Kyrillos VI
              </h2>
              <blockquote className="text-gray-700 italic text-lg leading-relaxed">
                &quot;O great saint, Pope Kyrillos VI, you who loved silence and prayer,
                intercede for us before the throne of grace. Pray for our church
                that bears your name, that we may follow your example of humility
                and devotion to Christ our God. Amen.&quot;
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* Feast Day */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-serif text-heading-2 text-gray-900 mb-4">
              Feast Day
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              The feast day of Pope Kyrillos VI is celebrated on{' '}
              <strong>21 Paoni</strong> (Coptic calendar) / <strong>June 28</strong>{' '}
              (Gregorian calendar), commemorating his departure.
            </p>
            <Button href="/schedule" variant="primary">
              See Our Schedule
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
