import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Users, Music, ArrowLeft } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Choir',
  description: `Choir ministry at ${CHURCH_INFO.fullName}. Praising God through sacred music across all age groups.`,
}

const choirGroups = [
  {
    name: 'Kindergarten',
    description: 'Introducing our youngest members to the joy of worship through simple hymns and praise songs.',
    color: 'bg-yellow-50 border-yellow-100',
    iconColor: 'text-yellow-700',
  },
  {
    name: '1st – 2nd Grade',
    description: 'Building a foundation in liturgical music and beginning to learn basic Coptic responses.',
    color: 'bg-orange-50 border-orange-100',
    iconColor: 'text-orange-700',
  },
  {
    name: '3rd – 4th Grade',
    description: 'Expanding hymn repertoire and deepening understanding of the liturgy through guided practice.',
    color: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-700',
  },
  {
    name: 'Middle School',
    description: 'Developing more advanced chanting skills and taking an active role in serving during liturgy.',
    color: 'bg-green-50 border-green-100',
    iconColor: 'text-green-700',
  },
  {
    name: "Women's Adult",
    description: "A dedicated choir for women, serving the congregation through heartfelt praise and sacred Coptic hymnody.",
    color: 'bg-primary-50 border-primary-100',
    iconColor: 'text-primary-900',
  },
]

export default function ChoirPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Choir
            </h1>
            <p className="text-xl text-white/80">
              Lifting Our Voices in Praise
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="section-padding bg-white">
        <div className="container-custom max-w-4xl">
          <div className="mb-12">
            <h2 className="font-serif text-3xl font-semibold text-gray-900 mb-6">
              About the Choir Ministry
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Music is one of the most powerful forms of prayer. Our choir ministry serves people of all ages, from our youngest children to adults, offering a space to grow in faith through the sacred hymns and chants of the Coptic Orthodox tradition.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Who It's For */}
            <div className="bg-primary-50 rounded-xl p-6 border border-primary-100">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-primary-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">Who It's For</h3>
              </div>
              <p className="text-gray-700">
                Open to all age groups — from Kindergarten through adults. Every voice is welcome and valued.
              </p>
            </div>

            {/* What You'll Get */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <Music className="w-5 h-5 text-blue-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">What You'll Learn</h3>
              </div>
              <ul className="text-gray-700 space-y-2 text-sm">
                <li>• Coptic hymns and responses</li>
                <li>• Liturgical chanting</li>
                <li>• Sacred music theory</li>
                <li>• Serving during Divine Liturgy</li>
              </ul>
            </div>

            {/* Schedule */}
            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-green-900" />
                <h3 className="font-serif text-xl font-semibold text-gray-900">Schedule</h3>
              </div>
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">Day:</span> Sunday
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Time:</span> [TIME - Add specific time]
              </p>
              <p className="text-gray-700 text-sm mt-3">
                Location: Church Hall
              </p>
            </div>
          </div>

          {/* Choir Groups */}
          <div className="mb-12">
            <h2 className="font-serif text-2xl font-semibold text-gray-900 mb-6">
              Choir Groups
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {choirGroups.map((group) => (
                <div
                  key={group.name}
                  className={`rounded-xl p-6 border ${group.color}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Music className={`w-5 h-5 ${group.iconColor}`} />
                    <h3 className="font-serif text-lg font-semibold text-gray-900">{group.name}</h3>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{group.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-primary-900 to-primary-950 rounded-xl p-8 text-white text-center">
            <h3 className="font-serif text-2xl font-semibold mb-4">
              Join the Choir
            </h3>
            <p className="text-white/80 mb-6 max-w-2xl mx-auto">
              Whether you're a child just learning your first hymn or an adult who has been singing for years, there is a place for you in our choir family.
            </p>
          </div>
        </div>
      </section>

      {/* Back Link */}
      <section className="section-padding bg-gray-50 border-t border-gray-200">
        <div className="container-custom">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-primary-900 hover:text-primary-950 font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Services
          </Link>
        </div>
      </section>
    </>
  )
}
