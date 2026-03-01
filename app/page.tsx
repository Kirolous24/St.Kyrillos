export const dynamic = 'force-dynamic'

import { Hero } from '@/components/home/Hero'
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
