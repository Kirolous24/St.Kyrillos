import type { Metadata } from 'next'
import { Clock, Users, Target } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: 'Hymns & Chanting',
  description: `Learn the sacred hymns and chanting traditions at ${CHURCH_INFO.fullName}.`,
}

export default function HymnsPage() {
  return (
    <ServicePageLayout
      title="Hymns & Chanting"
      subtitle="The Voice of the Church at Prayer"
      heroImage="/images/ICON_1.jpg"
      description="The Coptic Orthodox Church has a rich tradition of sacred hymns and liturgical chanting that dates back over two thousand years. These beautiful melodies and poetic texts express our faith and enhance our worship. Our Hymns & Chanting ministry teaches members of all ages how to participate fully in the sacred liturgy through learning the Church's musical traditions."
      infoCards={[
        {
          icon: Users,
          title: "Who It's For",
          content: (
            <p>Anyone interested in learning the sacred hymns of the Church — young and old, with or without musical experience. No prior knowledge required.</p>
          ),
        },
        {
          icon: Target,
          title: "What You'll Learn",
          content: (
            <ul className="space-y-1.5">
              <li>Ancient Coptic melodies</li>
              <li>Participate meaningfully in liturgy</li>
              <li>Preserve Church traditions</li>
              <li>Spiritual connection through music</li>
            </ul>
          ),
        },
        {
          icon: Clock,
          title: 'Schedule',
          content: (
            <div className="space-y-1">
              <p><span className="font-semibold text-gray-700">Days:</span> [DAY / TIMES]</p>
              <p className="text-xs text-gray-500 mt-2">Contact the church office for current class times.</p>
            </div>
          ),
        },
      ]}
    />
  )
}
