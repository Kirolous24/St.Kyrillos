import type { Metadata } from 'next'
import { Clock, Users, Target } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: "Women's Meeting",
  description: `Women's fellowship and spiritual nurturing at ${CHURCH_INFO.fullName}.`,
}

export default function WomensMeetingPage() {
  return (
    <ServicePageLayout
      title="Women's Meeting"
      subtitle="Sisters in Faith & Service"
description="Our Women's Meeting is a nurturing community where women come together to deepen their faith, support one another, and serve the Church and community. Through prayer, Bible study, spiritual formation, and fellowship, we encourage each other in our journeys as daughters of God, wives, mothers, and witnesses to Christ's love."
      infoCards={[
        {
          icon: Users,
          title: "Who It's For",
          content: (
            <p>All women of the parish and community seeking spiritual growth, friendship, and meaningful engagement in our faith community.</p>
          ),
        },
        {
          icon: Target,
          title: 'Benefits',
          content: (
            <ul className="space-y-1.5">
              <li>Spiritual growth & prayer</li>
              <li>Meaningful friendships</li>
              <li>Support & encouragement</li>
              <li>Service & mission opportunities</li>
            </ul>
          ),
        },
        {
          icon: Clock,
          title: 'Schedule',
          content: (
            <div className="space-y-1">
              <p><span className="font-semibold text-gray-700">Day:</span> [DAY]</p>
              <p><span className="font-semibold text-gray-700">Time:</span> [TIME]</p>
              <p className="text-xs text-gray-500 mt-2">Location: Fellowship Hall</p>
            </div>
          ),
        },
      ]}
    />
  )
}
