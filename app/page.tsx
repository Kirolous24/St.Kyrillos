import { Hero } from '@/components/home/Hero'
import { QuickActions } from '@/components/home/QuickActions'
import { WelcomeSection } from '@/components/home/WelcomeSection'
// import { SchedulePreview } from '@/components/home/SchedulePreview'
import { VisitSection } from '@/components/home/VisitSection'

export default function HomePage() {
  return (
    <>
      <Hero />
      <QuickActions />
      <WelcomeSection />
      {/* <SchedulePreview /> */}
      <VisitSection />
    </>
  )
}
