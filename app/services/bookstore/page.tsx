import type { Metadata } from 'next'
import { BookOpen, Clock } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicePageLayout } from '@/components/services/ServicePageLayout'

export const metadata: Metadata = {
  title: 'Bookstore',
  description: `The bookstore ministry at ${CHURCH_INFO.fullName}. Coptic Orthodox books, icons, and resources for the community.`,
}

export default function BookstorePage() {
  return (
    <ServicePageLayout
      title="Bookstore"
      subtitle="Resources to Nourish Your Faith"
      heroImage="/images/Coptic_cross.jpg"
      description="Our church bookstore offers a curated selection of Coptic Orthodox literature, icons, prayer books, and spiritual resources to support your journey in faith. Run entirely by volunteers, it is a ministry of service to our community."
      infoCards={[
        {
          icon: BookOpen,
          title: 'What We Offer',
          content: (
            <ul className="space-y-1.5">
              <li>Coptic Orthodox books & devotionals</li>
              <li>Icons and religious artwork</li>
              <li>Prayer books and liturgy guides</li>
              <li>Children's faith resources</li>
              <li>CDs and audio recordings of hymns</li>
            </ul>
          ),
        },
        {
          icon: Clock,
          title: 'Hours',
          content: (
            <div className="space-y-1">
              <p><span className="font-semibold text-gray-700">Open:</span> Sundays after Liturgy</p>
              <p className="text-xs text-gray-500 mt-2">Located in the church hall. Look for the bookstore table after service.</p>
            </div>
          ),
        },
        {
          icon: BookOpen,
          title: 'Volunteer',
          content: (
            <p>We welcome volunteers to help organize and manage resources. Speak to us after Sunday Liturgy to get involved.</p>
          ),
        },
      ]}
    />
  )
}
