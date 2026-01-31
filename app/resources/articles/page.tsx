import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { ContentCard } from '@/components/ui/Card'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Articles',
  description: `Read articles and spiritual reflections from ${CHURCH_INFO.fullName}. Faith formation resources for Orthodox Christians.`,
}

// Sample articles - in production, this would come from a CMS
const articles = [
  {
    id: '1',
    title: 'Understanding the Divine Liturgy',
    date: 'January 10, 2025',
    author: 'Fr. Pachom Ibrahim',
    excerpt: 'A guide to the structure and meaning of the Coptic Orthodox Divine Liturgy, helping newcomers and lifelong members deepen their worship experience.',
    category: 'Worship',
  },
  {
    id: '2',
    title: 'The Importance of Fasting in Orthodox Spirituality',
    date: 'December 28, 2024',
    author: 'Fr. Pachom Ibrahim',
    excerpt: 'Exploring the rich tradition of fasting in the Coptic Church and how it shapes our spiritual journey throughout the liturgical year.',
    category: 'Spiritual Life',
  },
]

export default function ArticlesPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Articles
            </h1>
            <p className="text-xl text-white/80">
              Spiritual reflections and faith formation
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
              className="py-4 border-b-2 border-primary-900 text-primary-900 font-medium whitespace-nowrap"
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

      {/* Articles List */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            {articles.length > 0 ? (
              <div className="grid gap-6">
                {articles.map((article) => (
                  <ContentCard
                    key={article.id}
                    title={article.title}
                    date={article.date}
                    author={article.author}
                    excerpt={article.excerpt}
                    href={`/resources/articles/${article.id}`}
                    category={article.category}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="font-serif text-xl text-gray-900 mb-2">
                  Articles Coming Soon
                </h3>
                <p className="text-gray-600">
                  We're working on adding articles. Check back soon!
                </p>
              </div>
            )}

            {/* Placeholder Note */}
            <div className="mt-12 bg-gold/10 border border-gold/20 rounded-xl p-6 text-center">
              <p className="text-gray-600 text-sm">
                <strong>Note:</strong> This is sample data. Connect to a CMS (like Sanity)
                to manage articles dynamically.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
