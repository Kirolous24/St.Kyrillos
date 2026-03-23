import type { Metadata } from 'next'
import { Clock, Users, Target } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: 'Youth Meeting',
  description: `Youth fellowship and spiritual development at ${CHURCH_INFO.fullName}.`,
}

export default function YouthMeetingPage() {
  return (
    <ServicePageLayout
      title="Youth Meeting"
      subtitle="Fellowship, Faith & Future"
      heroImage="/images/youth1.jpeg"
      description="Our Youth Meeting is a vibrant community for young adults seeking to grow in their faith while building lasting friendships. Through Bible discussions, spiritual formation, social activities, and service opportunities, we help young people navigate their journey of faith in today's world and discover God's purpose for their lives."
      infoCards={[
        {
          icon: Users,
          title: "Who It's For",
          content: (
            <p>Young adults ages [AGE RANGE], whether they've grown up in the Church or are new to our community.</p>
          ),
        },
        {
          icon: Target,
          title: 'Benefits',
          content: (
            <ul className="space-y-1.5">
              <li>Meaningful friendships & community</li>
              <li>Deeper spiritual growth</li>
              <li>Service & outreach opportunities</li>
              <li>Guidance for life's big questions</li>
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
              <p className="text-xs text-gray-500 mt-2">Location: Church Hall / Fellowship Area</p>
            </div>
          ),
        },
      ]}
      images={[
        { src: '/images/youth2.jpeg', alt: 'Youth gathering' },
        { src: '/images/youth1.jpeg', alt: 'Youth fellowship' },
        { src: '/images/youth3.jpeg', alt: 'Youth community', position: '50% 65%' },
        { src: '/images/youth4.jpeg', alt: 'Youth activities', position: '50% 65%' },
        { src: '/images/youth5.jpeg', alt: 'Youth meeting', position: 'top' },
        { src: '/images/youth6.png', alt: 'Youth gathering' },
        { src: '/images/youth7.png', alt: 'Youth fellowship' },
        { src: '/images/youth8.png', alt: 'Youth community' },
        { src: '/images/youth9.png', alt: 'Youth activities' },
      ]}
      carouselTitle="Youth Community in Action"
    />
  )
}
