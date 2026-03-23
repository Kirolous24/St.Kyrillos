import type { Metadata } from 'next'
import { Clock, Users, Target } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: "Men's Meeting",
  description: `Men's fellowship and spiritual development at ${CHURCH_INFO.fullName}.`,
}

export default function MensMeetingPage() {
  return (
    <ServicePageLayout
      title="Men's Meeting"
      subtitle="Brotherhood in Faith & Service"
description="Our Men's Meeting brings together men of the parish for spiritual growth, mutual support, and service to the Church and community. Through Bible study, mentorship, and fraternal activities, we cultivate Christian brotherhood and help men live out their faith as husbands, fathers, and witnesses to Christ in the world."
      infoCards={[
        {
          icon: Users,
          title: "Who It's For",
          content: (
            <p>All men of the parish and community who desire to grow spiritually and connect with other men in faith.</p>
          ),
        },
        {
          icon: Target,
          title: 'Benefits',
          content: (
            <ul className="space-y-1.5">
              <li>Brotherhood & accountability</li>
              <li>Biblical teaching & discussion</li>
              <li>Mentorship opportunities</li>
              <li>Community & outreach service</li>
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
