import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Download, FileText } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Bible Studies',
  description: `Bible study resources from ${CHURCH_INFO.fullName}. Study guides, notes, and recordings to deepen your understanding of Scripture.`,
}

// Sample Bible studies - in production, this would come from a CMS
const studies = [
  {
    id: '1',
    title: 'The Gospel of John: An Introduction',
    date: 'January 2025',
    teacher: 'Fr. Pachom Ibrahim',
    description: 'A comprehensive study of the Fourth Gospel, exploring its unique theology and the profound truths it reveals about Christ.',
    sessions: 12,
    hasNotes: true,
    hasVideo: true,
  },
  {
    id: '2',
    title: 'The Epistle to the Romans',
    date: 'November 2024',
    teacher: 'Fr. Pachom Ibrahim',
    description: 'St. Paul\'s masterful letter explaining salvation, grace, and the Christian life. Essential for understanding Orthodox theology.',
    sessions: 8,
    hasNotes: true,
    hasVideo: false,
  },
]

export default function BibleStudiesPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Bible Studies
            </h1>
            <p className="text-xl text-white/80">
              Deepen your understanding of Scripture
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
              className="py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
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
              className="py-4 border-b-2 border-primary-900 text-primary-900 font-medium whitespace-nowrap"
            >
              Bible Studies
            </Link>
          </nav>
        </div>
      </section>

      {/* Studies List */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            {studies.length > 0 ? (
              <div className="space-y-6">
                {studies.map((study) => (
                  <article
                    key={study.id}
                    className="bg-white rounded-xl p-6 shadow-soft border border-gray-100"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-gold" />
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-2">
                          <span>{study.date}</span>
                          <span>•</span>
                          <span>{study.teacher}</span>
                          <span>•</span>
                          <span>{study.sessions} sessions</span>
                        </div>
                        <h3 className="font-serif text-xl font-semibold text-gray-900 mb-2">
                          {study.title}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {study.description}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {study.hasNotes && (
                            <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                              <Download className="w-4 h-4" />
                              Download Notes
                            </button>
                          )}
                          {study.hasVideo && (
                            <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 hover:bg-primary-200 rounded-lg text-sm font-medium text-primary-900 transition-colors">
                              <BookOpen className="w-4 h-4" />
                              Watch Sessions
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="font-serif text-xl text-gray-900 mb-2">
                  Bible Studies Coming Soon
                </h3>
                <p className="text-gray-600">
                  We're working on adding Bible study resources. Check back soon!
                </p>
              </div>
            )}

            {/* Join Bible Study CTA */}
            <div className="mt-12 bg-primary-50 rounded-xl p-8 text-center">
              <h3 className="font-serif text-xl font-semibold text-gray-900 mb-2">
                Join Our Weekly Bible Study
              </h3>
              <p className="text-gray-600 mb-4">
                We meet every Wednesday at [TIME] for in-person Bible study.
                All are welcome, regardless of your familiarity with Scripture.
              </p>
              <Link
                href="/schedule"
                className="text-primary-900 font-medium hover:underline"
              >
                View Schedule →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
