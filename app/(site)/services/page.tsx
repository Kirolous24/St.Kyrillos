import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'
import { ServicesContent } from '@/components/services/ServicesContent'

export const metadata: Metadata = {
  title: 'Church Services',
  description: `Explore the various ministries and services offered at ${CHURCH_INFO.fullName}. From Sunday School to community groups.`,
}

export default function ServicesPage() {
  return <ServicesContent />
}
