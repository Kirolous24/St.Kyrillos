import type { Metadata } from 'next'
import { Clock, Users, Target, MessageCircle, Instagram } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'
import Link from 'next/link'

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
              <p><span className="font-semibold text-gray-700">Day:</span> Sunday</p>
              <p><span className="font-semibold text-gray-700">Time:</span> 6:30 PM</p>
              <p className="text-xs text-gray-500 mt-2">Location: Main Church</p>
            </div>
          ),
        },
      ]}
      extraContent={
        <div>
          <div className="flex items-center gap-5 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/30" />
            <h2 className="font-serif text-2xl text-gray-900 whitespace-nowrap px-2">Stay Connected</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/30" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href="https://chat.whatsapp.com/Lv2JiFoq1ykE9U0L6BjxUS?mode=gi_t"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 px-6 py-4 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-colors"
            >
              <MessageCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">WhatsApp Group</p>
                <p className="text-sm text-gray-600">Updates & events</p>
              </div>
            </a>
            <a
              href="https://www.instagram.com/st.kyrillos.youth.meeting/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 px-6 py-4 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 hover:border-pink-300 transition-colors"
            >
              <svg className="w-6 h-6 text-pink-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.266.069 1.646.069 4.85 0 3.204-.012 3.584-.07 4.85-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.646-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900">Instagram</p>
                <p className="text-sm text-gray-600">@st.kyrillos.youth.meeting</p>
              </div>
            </a>
          </div>
        </div>
      }
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
