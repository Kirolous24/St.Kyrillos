import type { Metadata } from 'next'
import { Heart, Clock } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: 'Kitchen & Cleaning Service',
  description: `Kitchen and cleaning ministry at ${CHURCH_INFO.fullName}. Serving the community through hospitality and care.`,
}

export default function KitchenCleaningPage() {
  return (
    <ServicePageLayout
      title="Kitchen & Cleaning"
      subtitle="Serving with Love Behind the Scenes"
      heroImage="/images/kitchen-service.jpg"
      description='"Whoever wants to become great among you must be your servant." (Matthew 20:26) — The Kitchen and Cleaning ministry is one of the most humble and essential forms of service in our church. These dedicated volunteers ensure our church home is clean, welcoming, and ready to receive the congregation, reflecting the care and love we have for one another.'
      infoCards={[
        {
          icon: Heart,
          title: 'How We Serve',
          content: (
            <ul className="space-y-1.5">
              <li>Preparing & serving food for gatherings</li>
              <li>Setting up and cleaning after events</li>
              <li>Maintaining kitchen hygiene & supplies</li>
              <li>Cleaning the church hall & common areas</li>
              <li>Supporting feasts & special occasions</li>
            </ul>
          ),
        },
        {
          icon: Clock,
          title: 'When We Serve',
          content: (
            <div className="space-y-1">
              <p><span className="font-semibold text-gray-700">Regular:</span> Sundays after Liturgy</p>
              <p className="text-xs text-gray-500 mt-2">Additional service days around church feasts, events, and special gatherings.</p>
            </div>
          ),
        },
        {
          icon: Heart,
          title: 'Get Involved',
          content: (
            <p>This ministry is open to all who have a heart to serve. No special skills needed — just a willing spirit and love for the church community.</p>
          ),
        },
      ]}
    />
  )
}
