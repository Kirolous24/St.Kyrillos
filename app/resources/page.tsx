import type { Metadata } from 'next'
import {
  Globe,
  Play,
  BookMarked,
  Music,
  BookOpen,
  Scroll,
  CalendarDays,
  ExternalLink,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Hymns, liturgy, prayers, sermons, scripture, and more.',
}

const CATEGORIES = [
  {
    id: 'diocese',
    title: 'Our Diocese',
    description:
      'Official resources from the Coptic Orthodox Metropolis of the Southern United States.',
    icon: Globe,
    resources: [
      {
        title: 'Diocese Resource Hub',
        description:
          'Browse all resources published by our diocese — literature, audio, and more.',
        url: 'https://suscopts.org/resources',
        source: 'suscopts.org',
      },
      {
        title: 'Coptic Orthodox Wiki',
        description:
          'An encyclopedic reference on Coptic faith, history, sacraments, liturgy, and saints.',
        url: 'https://wiki.suscopts.org',
        source: 'wiki.suscopts.org',
      },
    ],
  },
  {
    id: 'sermons',
    title: 'Sermons & Teachings',
    description: 'Video and audio teachings from our diocese.',
    icon: Play,
    resources: [
      {
        title: 'YouTube Channel — Metropolitan Youssef',
        description:
          'YouTube channel for sermons and teachings from His Eminence Metropolitan Youssef, head of our diocese.',
        url: 'https://www.youtube.com/@MetropolitanYoussef_SUSCopts/videos',
        source: 'youtube.com',
      },
      {
        title: 'Weekly Holy Bible Study',
        description:
          'Ongoing video Bible study series led by His Eminence Metropolitan Youssef.',
        url: 'https://www.suscopts.org/diocese/bishop/bible-study',
        source: 'suscopts.org',
      },
    ],
  },
  {
    id: 'prayer',
    title: 'Prayer & Liturgy',
    description:
      'Texts and guides for the Agpeya, Divine Liturgy, and daily prayer.',
    icon: BookMarked,
    resources: [
      {
        title: 'The Agpeya — Book of Hours',
        description:
          'The complete Coptic prayer book with all seven canonical hours of daily prayer.',
        url: 'https://www.copticchurch.net/liturgy/agpeya/index.html',
        source: 'copticchurch.net',
      },
      {
        title: 'Divine Liturgy Text',
        description:
          'Full text of the Liturgy of St. Basil in English, Coptic, and Arabic.',
        url: 'https://www.copticchurch.net/liturgy',
        source: 'copticchurch.net',
      },
      {
        title: 'Daily Lectionary Readings',
        description:
          "Today's scripture readings according to the Coptic Orthodox lectionary.",
        url: 'https://www.copticchurch.net/readings',
        source: 'copticchurch.net',
      },
      {
        title: 'Prayers Collection',
        description:
          'Hundreds of Coptic prayers — personal, liturgical, and sacramental.',
        url: 'https://st-takla.org/Prayers-Slawat/Online-Coptic-Prayer-Book-01-Index.html',
        source: 'st-takla.org',
      },
    ],
  },
  {
    id: 'hymns',
    title: 'Hymns & Music',
    description:
      'Lyrics, audio recordings, and references for Coptic hymns and praises.',
    icon: Music,
    resources: [
      {
        title: 'Hymn Lyrics Library',
        description:
          'Over 2,100 Coptic hymns with full lyrics in English, Coptic, and Arabic.',
        url: 'https://tasbeha.org/hymn_library/',
        source: 'tasbeha.org',
      },
      {
        title: 'Audio Hymns',
        description:
          'Recordings of Coptic hymns sung by various cantors and deacon choirs.',
        url: 'https://tasbeha.org/mp3/Hymns.html',
        source: 'tasbeha.org',
      },
      {
        title: 'Midnight Praises (Tasbeha)',
        description:
          'Audio recordings of the midnight praises and other Coptic praise services.',
        url: 'https://tasbeha.org/mp3/Praises.html',
        source: 'tasbeha.org',
      },
      {
        title: 'Deacon Hymns Text',
        description:
          'Written texts of Coptic hymns used by deacons and cantors during the liturgy.',
        url: 'https://www.suscopts.org/deacons/hymns/hymns_text.html',
        source: 'suscopts.org',
      },
    ],
  },
  {
    id: 'scripture',
    title: 'Scripture & Study',
    description: 'The Holy Bible and tools for deeper study.',
    icon: BookOpen,
    resources: [
      {
        title: 'Holy Bible',
        description:
          'Read the Bible online with access to maps, commentary, and a Bible dictionary.',
        url: 'https://st-takla.org/Bibles/Holy-Bible.html',
        source: 'st-takla.org',
      },
      {
        title: 'Bible Dictionary',
        description:
          'Look up people, places, and terms from the Bible with clear explanations.',
        url: 'https://st-takla.org/bible/dictionary/en/index.html',
        source: 'st-takla.org',
      },
    ],
  },
  {
    id: 'theology',
    title: 'Theology & Church Fathers',
    description:
      'Writings of the Church Fathers, theological articles, and free Coptic books.',
    icon: Scroll,
    resources: [
      {
        title: 'Theology Articles',
        description:
          'In-depth theological articles on Coptic Orthodox doctrine and faith.',
        url: 'https://www.copticchurch.net/theology',
        source: 'copticchurch.net',
      },
      {
        title: 'Patrology — Church Fathers',
        description:
          'Writings and teachings of the early Church Fathers and Coptic theologians.',
        url: 'https://www.copticchurch.net/patrology',
        source: 'copticchurch.net',
      },
      {
        title: 'Free Books Library',
        description:
          'A large collection of free Coptic Orthodox books including works of Pope Shenouda III.',
        url: 'https://st-takla.org/Full-Free-Coptic-Books/00-English-Christian-Books/Christian-Coptic-Library-00-index.html',
        source: 'st-takla.org',
      },
      {
        title: 'Diocese Literature',
        description:
          'Articles and literary resources published by the Diocese of the Southern United States.',
        url: 'https://suscopts.org/resources/literature',
        source: 'suscopts.org',
      },
    ],
  },
  {
    id: 'heritage',
    title: 'Saints & Heritage',
    description:
      'The Coptic calendar, daily saint commemorations, and church history.',
    icon: CalendarDays,
    resources: [
      {
        title: 'Synaxarium — Daily Saints',
        description:
          'A daily commemoration of the lives of Coptic saints throughout the year.',
        url: 'https://www.copticchurch.net/synaxarium',
        source: 'copticchurch.net',
      },
      {
        title: 'Coptic Calendar — Fasts & Feasts',
        description:
          'The liturgical calendar of the Coptic Orthodox Church with feasts and fasts.',
        url: 'https://suscopts.org/coptic-orthodox/fasts-and-feasts',
        source: 'suscopts.org',
      },
    ],
  },
]

export default function ResourcesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Resources
            </h1>
            <p className="text-xl text-white/80">
              Curated links to grow in faith — hymns, liturgy, prayer,
              scripture, and more from trusted Coptic Orthodox sources.
            </p>
          </div>
        </div>
      </section>

      {/* Category Sections */}
      <div className="section-padding">
        <div className="container-custom space-y-20">
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <section key={category.id} id={category.id}>
                {/* Section header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary-900" />
                  </div>
                  <div>
                    <h2 className="font-serif text-heading-2 text-gray-900">
                      {category.title}
                    </h2>
                    <p className="text-gray-500 mt-0.5">{category.description}</p>
                  </div>
                </div>

                {/* Resource cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {category.resources.map((resource) => (
                    <a
                      key={resource.url}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block bg-white rounded-xl border border-gray-100 shadow-soft p-6 hover:shadow-soft-lg hover:border-primary-200 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-serif text-lg font-semibold text-gray-900 group-hover:text-primary-900 transition-colors mb-2">
                            {resource.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                            {resource.description}
                          </p>
                          <span className="inline-block text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            {resource.source}
                          </span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-primary-900 transition-colors flex-shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
