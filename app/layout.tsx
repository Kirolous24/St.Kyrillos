import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { BackToTop } from '@/components/ui/BackToTop'
import { PageTransition } from '@/components/ui/PageTransition'
import { CHURCH_INFO } from '@/lib/constants'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: `${CHURCH_INFO.fullName} | ${CHURCH_INFO.location}`,
    template: `%s | ${CHURCH_INFO.name}`,
  },
  description: `${CHURCH_INFO.fullName} is a Coptic Orthodox Christian community in ${CHURCH_INFO.location}. Join us for Divine Liturgy, Bible study, and fellowship. All are welcome.`,
  keywords: [
    'Coptic Orthodox Church',
    'Orthodox Christian',
    'Antioch Tennessee',
    'St Kyrillos',
    'Pope Kyrillos VI',
    'Egyptian Church',
    'Divine Liturgy',
    'Orthodox Church near me',
  ],
  authors: [{ name: CHURCH_INFO.fullName }],
  creator: CHURCH_INFO.fullName,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: CHURCH_INFO.fullName,
    title: CHURCH_INFO.fullName,
    description: `A Coptic Orthodox Christian community in ${CHURCH_INFO.location}. An ancient faith. A welcoming home.`,
  },
  twitter: {
    card: 'summary_large_image',
    title: CHURCH_INFO.fullName,
    description: `A Coptic Orthodox Christian community in ${CHURCH_INFO.location}. An ancient faith. A welcoming home.`,
  },
  icons: {
    icon: [
      { url: '/images/Logo.jpg' },
    ],
    apple: [
      { url: '/images/Logo.jpg' },
    ],
    shortcut: [
      { url: '/images/Logo.jpg' },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-white">
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
