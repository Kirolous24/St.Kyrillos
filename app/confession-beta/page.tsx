import type { Metadata } from 'next'
import { ConfessionPageClient } from '@/components/confession/ConfessionPageClient'
import { CHURCH_INFO, CONFESSION_CONFIG } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Confession Appointments',
  description: `Book a confession appointment with ${CONFESSION_CONFIG.clergName} at ${CHURCH_INFO.name}. ${CONFESSION_CONFIG.appointmentDuration}-minute appointments available.`,
}

export default function ConfessionPage() {
  return <ConfessionPageClient />
}
