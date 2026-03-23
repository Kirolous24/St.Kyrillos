import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'
import { BookOpen } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Confession Appointments',
  description: `Confession appointments at ${CHURCH_INFO.name}. Coming soon.`,
}

// TODO (re-enable): Replace this page with the original implementation below once Fr. Pachom approves.
// Original page was: return <ConfessionCalendlyClient />
// Original imports needed:
//   import { CONFESSION_CONFIG } from '@/lib/constants'
//   import { ConfessionCalendlyClient } from '@/components/confession/ConfessionCalendlyClient'
// Also restore the original metadata description using CONFESSION_CONFIG.

export default function ConfessionCalendlyPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-gray-900 mb-3">
          Confession Appointments
        </h1>
        <p className="text-gray-500 leading-relaxed">
          Online confession booking is not available yet. Please speak with Fr. Pachom directly after Liturgy to schedule an appointment.
        </p>
      </div>
    </div>
  )
}
