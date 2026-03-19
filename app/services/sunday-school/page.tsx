import type { Metadata } from 'next'
import { Clock, Users, Target } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: 'Sunday School',
  description: `Sunday School at ${CHURCH_INFO.fullName}. Religious education for children and adults.`,
}

const programs = [
  {
    name: 'Marhagan',
    description:
      'A joyful celebration of faith through Coptic hymns, liturgy, and praise, bringing children together in the spirit of worship and festivity.',
  },
  {
    name: 'Nady',
    description:
      'A community gathering for youth focused on fellowship, spiritual activities, and building lasting friendships within the church family.',
  },
]

export default function SundaySchoolPage() {
  return (
    <ServicePageLayout
      title="Sunday School"
      subtitle="Growing in Faith, Together"
      heroImage="/images/sunday-school.jpg"
      description="Sunday School is the heart of our faith formation ministry. We provide structured, age-appropriate religious education for children and young people, helping them understand the teachings of the Gospel and develop a deeper connection with Christ and the Church."
      infoCards={[
        {
          icon: Users,
          title: "Who It's For",
          content: (
            <p>Children and young adults (ages 3–18), organized into grade-appropriate classes. Parents are also welcome to join adult education sessions.</p>
          ),
        },
        {
          icon: Target,
          title: 'Benefits',
          content: (
            <ul className="space-y-1.5">
              <li>Deeper understanding of the Gospel</li>
              <li>Bible study and scripture memorization</li>
              <li>Orthodox Christian values and traditions</li>
              <li>Community with peers in faith</li>
            </ul>
          ),
        },
        {
          icon: Clock,
          title: 'Schedule',
          content: (
            <div className="space-y-1">
              <p><span className="font-semibold text-gray-700">Day:</span> Sunday</p>
              <p><span className="font-semibold text-gray-700">Time:</span> [TIME]</p>
              <p className="text-xs text-gray-500 mt-2">Location: Church Hall</p>
            </div>
          ),
        },
      ]}
      extraContent={
        <div>
          <div className="flex items-center gap-5 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/30" />
            <h2 className="font-serif text-2xl text-gray-900 whitespace-nowrap px-2">Programs</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/30" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {programs.map(p => (
              <div key={p.name} className="border border-gold/20 rounded-xl p-7 bg-[#faf7f2]">
                <h3 className="font-serif text-xl font-semibold text-primary-900 mb-3">{p.name}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      }
    />
  )
}
