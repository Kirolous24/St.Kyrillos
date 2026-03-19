import type { Metadata } from 'next'
import { Clock, Users, Music } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: 'Choir',
  description: `Choir ministry at ${CHURCH_INFO.fullName}. Praising God through sacred music across all age groups.`,
}

const choirGroups = [
  {
    name: 'Kindergarten',
    description: 'Introducing our youngest members to the joy of worship through simple hymns and praise songs.',
  },
  {
    name: '1st – 2nd Grade',
    description: 'Building a foundation in liturgical music and beginning to learn basic Coptic responses.',
  },
  {
    name: '3rd – 4th Grade',
    description: 'Expanding hymn repertoire and deepening understanding of the liturgy through guided practice.',
  },
  {
    name: 'Middle School',
    description: 'Developing more advanced chanting skills and taking an active role in serving during liturgy.',
  },
  {
    name: "Women's Adult",
    description: 'A dedicated choir for women, serving the congregation through heartfelt praise and sacred Coptic hymnody.',
  },
]

export default function ChoirPage() {
  return (
    <ServicePageLayout
      title="Choir"
      subtitle="Lifting Our Voices in Praise"
      heroImage="/images/choir-singing.jpg"
      description="Music is one of the most powerful forms of prayer. Our choir ministry serves people of all ages — from our youngest children to adults — offering a space to grow in faith through the sacred hymns and chants of the Coptic Orthodox tradition."
      infoCards={[
        {
          icon: Users,
          title: "Who It's For",
          content: (
            <p>Open to all age groups, from Kindergarten through adults. Every voice is welcome and valued.</p>
          ),
        },
        {
          icon: Music,
          title: "What You'll Learn",
          content: (
            <ul className="space-y-1.5">
              <li>Coptic hymns and responses</li>
              <li>Liturgical chanting</li>
              <li>Sacred music theory</li>
              <li>Serving during Divine Liturgy</li>
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
            <h2 className="font-serif text-2xl text-gray-900 whitespace-nowrap px-2">Choir Groups</h2>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/30" />
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {choirGroups.map(g => (
              <div key={g.name} className="border border-gold/20 rounded-xl p-7 bg-[#faf7f2] flex gap-4">
                <Music className="w-5 h-5 text-primary-900 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-serif text-lg font-semibold text-gray-900 mb-2">{g.name}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{g.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  )
}
