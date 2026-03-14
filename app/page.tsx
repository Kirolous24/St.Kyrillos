export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Hero } from '@/components/home/Hero'

export const metadata: Metadata = {
  title: 'St. Kyrillos the Sixth Coptic Orthodox Church | Antioch, Nashville TN',
  description: 'Welcome to St. Kyrillos the Sixth Coptic Orthodox Church in Antioch, Nashville, Tennessee. An ancient faith and a welcoming home. Join us for Divine Liturgy, Sunday school, Bible study, and fellowship.',
  alternates: {
    canonical: 'https://stkyrillostn.org',
  },
}
import { QuickActions } from '@/components/home/QuickActions'
import { WelcomeSection } from '@/components/home/WelcomeSection'
import { WeeklyScheduleSection } from '@/components/home/WeeklyScheduleSection'
import { VisitSection } from '@/components/home/VisitSection'

export default function HomePage() {
  return (
    <>
      <Hero />
      <QuickActions />
      <WelcomeSection />
      <WeeklyScheduleSection />
      <VisitSection />
    </>
  )
}
