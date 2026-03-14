import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { BackToTop } from '@/components/ui/BackToTop'
import { PageTransition } from '@/components/ui/PageTransition'
import { CHURCH_INFO, SITE_URL, SOCIAL_LINKS } from '@/lib/constants'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${CHURCH_INFO.fullName} | ${CHURCH_INFO.location}`,
    template: `%s | ${CHURCH_INFO.name}`,
  },
  description: `${CHURCH_INFO.fullName} is a Coptic Orthodox Christian community in Antioch, Nashville, Tennessee. Join us for Divine Liturgy, Bible study, and fellowship. All are welcome.`,
  keywords: [
    // Church name variants
    'St Kyrillos', 'St Kirolous', 'St Kirolos', 'St Kyrellos', 'St Cyril',
    'Saint Kyrillos', 'Saint Kirolous', 'Saint Kirolos',
    'Pope Kyrillos', 'Pope Kirollos', 'Pope Kirolos', 'Pope Kyrellos',
    'Pope Cyril VI', 'Kyrillos the Sixth', 'Kirolous the Sixth', 'Kirolos VI', 'Cyril VI',
    // Church type
    'Coptic Orthodox Church', 'Coptic Church', 'Orthodox Christian',
    'Coptic Orthodox', 'Egyptian Church', 'Ancient Christianity',
    // Location
    'Antioch Tennessee', 'Nashville Tennessee', 'Antioch TN',
    'Coptic Orthodox Church Nashville', 'Coptic Church Nashville',
    'Coptic Orthodox Nashville TN', 'Orthodox Church Nashville',
    'Coptic Church Tennessee', 'Church Antioch TN',
    'Orthodox Church near me',
    // Services
    'Divine Liturgy', 'Divine Liturgy Nashville', 'Coptic Liturgy',
    'Bible study Nashville', 'Sunday school Nashville',
  ],
  authors: [{ name: CHURCH_INFO.fullName }],
  creator: CHURCH_INFO.fullName,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: CHURCH_INFO.fullName,
    title: CHURCH_INFO.fullName,
    description: `A Coptic Orthodox Christian community in Antioch, Nashville, Tennessee. An ancient faith. A welcoming home.`,
  },
  twitter: {
    card: 'summary_large_image',
    title: CHURCH_INFO.fullName,
    description: `A Coptic Orthodox Christian community in Antioch, Nashville, Tennessee. An ancient faith. A welcoming home.`,
  },
  icons: {
    icon: [{ url: '/images/Logo.png', type: 'image/png' }],
    apple: [{ url: '/images/Logo.png', type: 'image/png' }],
    shortcut: [{ url: '/images/Logo.png', type: 'image/png' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Church',
  name: CHURCH_INFO.fullName,
  alternateName: [
    'St Kyrillos Coptic Orthodox Church',
    'St Kirolous Coptic Orthodox Church',
    'St Kirolos Coptic Orthodox Church',
    'Saint Kyrillos the Sixth',
  ],
  url: SITE_URL,
  telephone: CHURCH_INFO.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: CHURCH_INFO.address.street,
    addressLocality: CHURCH_INFO.address.city,
    addressRegion: CHURCH_INFO.address.state,
    postalCode: CHURCH_INFO.address.zip,
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 36.0614,
    longitude: -86.6642,
  },
  sameAs: [
    SOCIAL_LINKS.facebook,
    SOCIAL_LINKS.youtube,
  ],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Sunday',
      description: 'Divine Liturgy',
    },
  ],
  description: `${CHURCH_INFO.fullName} is a Coptic Orthodox Christian community in Antioch, Nashville, Tennessee. We offer Divine Liturgy, Bible study, Sunday school, and fellowship.`,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Announcement Banner - uncomment and customize when needed */}
        {/* <AnnouncementBanner
          message="Special Christmas Liturgy on January 7th at 7:00 AM"
          link={{ href: '/schedule', text: 'View Schedule' }}
          variant="info"
        /> */}
        <Navbar />
        <main className="flex-1 pt-20">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  )
}
