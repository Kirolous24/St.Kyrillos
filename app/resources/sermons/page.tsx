import type { Metadata } from 'next'
import Link from 'next/link'
import { Play, Headphones, FileText } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Sermons',
  description: `Listen to sermons and teachings from ${CHURCH_INFO.fullName}. Audio and video recordings of Sunday homilies and special talks.`,
}

// Sample sermon data - in production, this would come from a CMS
const sermons = [
  {
    id: '1',
    title: 'The Parable of the Prodigal Son',
    date: 'January 12, 2025',
    speaker: 'Fr. Pachom Ibrahim',
    description: 'A reflection on God\'s boundless mercy and the joy of returning to the Father.',
    type: 'audio',
    duration: '25 min',
  },
  {
    id: '2',
    title: 'Living the Beatitudes Today',
    date: 'January 5, 2025',
    speaker: 'Fr. Pachom Ibrahim',
    description: 'How the teachings of Jesus in the Sermon on the Mount apply to our daily lives.',
    type: 'video',
    duration: '30 min',
  },
  {
    id: '3',
    title: 'The Feast of Theophany',
    date: 'January 19, 2025',
    speaker: 'Fr. Pachom Ibrahim',
    description: 'Understanding the significance of Christ\'s baptism and our own baptismal calling.',
    type: 'audio',
    duration: '22 min',
  },
  // Add more sermons as they become available
]

export default function SermonsPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Sermons
            </h1>
            <p className="text-xl text-white/80">
              Listen to recent teachings and homilies
            </p>
          </div>
        </div>
      </section>

      {/* Resources Nav */}
      <section className="border-b border-gray-200 sticky top-20 bg-white z-30">
        <div className="container-custom">
          <nav className="flex gap-8 overflow-x-auto">
            <Link
              href="/resources/sermons"
              className="py-4 border-b-2 border-primary-900 text-primary-900 font-medium whitespace-nowrap"
            >
              Sermons
            </Link>
            <Link
              href="/resources/articles"
              className="py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
            >
              Articles
            </Link>
            <Link
              href="/resources/bible-studies"
              className="py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
            >
              Bible Studies
            </Link>
          </nav>
        </div>
      </section>

      {/* Sermons List */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            {sermons.length > 0 ? (
              <div className="space-y-6">
                {sermons.map((sermon) => (
                  <article
                    key={sermon.id}
                    className="bg-white rounded-xl p-6 shadow-soft border border-gray-100 hover:shadow-soft-lg transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        {sermon.type === 'video' ? (
                          <Play className="w-5 h-5 text-primary-900" />
                        ) : (
                          <Headphones className="w-5 h-5 text-primary-900" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-2">
                          <time>{sermon.date}</time>
                          <span>•</span>
                          <span>{sermon.speaker}</span>
                          <span>•</span>
                          <span>{sermon.duration}</span>
                        </div>
                        <h3 className="font-serif text-xl font-semibold text-gray-900 mb-2">
                          {sermon.title}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {sermon.description}
                        </p>
                        <button className="inline-flex items-center gap-2 text-primary-900 font-medium hover:underline">
                          {sermon.type === 'video' ? (
                            <>
                              <Play className="w-4 h-4" />
                              Watch
                            </>
                          ) : (
                            <>
                              <Headphones className="w-4 h-4" />
                              Listen
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="font-serif text-xl text-gray-900 mb-2">
                  Sermons Coming Soon
                </h3>
                <p className="text-gray-600">
                  We're working on adding sermon recordings. Check back soon!
                </p>
              </div>
            )}

            {/* Placeholder Note */}
            <div className="mt-12 bg-gold/10 border border-gold/20 rounded-xl p-6 text-center">
              <p className="text-gray-600 text-sm">
                <strong>Note:</strong> This is sample data. Connect to a CMS (like Sanity)
                or add sermon files to populate this page with real content.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
