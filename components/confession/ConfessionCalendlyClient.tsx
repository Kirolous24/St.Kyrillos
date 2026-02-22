'use client'

import Script from 'next/script'
import { ClergyHeader } from './ClergyHeader'
import { MetaInfo } from './MetaInfo'
import { CONFESSION_CONFIG } from '@/lib/constants'

const CALENDLY_URL = 'https://calendly.com/kirolouskamel24/confessions'

export function ConfessionCalendlyClient() {
  return (
    <div className="min-h-screen bg-white">
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />

      <div className="container-custom py-8 md:py-12">
        {/* Header — same as custom version */}
        <ClergyHeader
          clergName={CONFESSION_CONFIG.clergName}
          clergTitle={CONFESSION_CONFIG.clergTitle}
          clergImage={CONFESSION_CONFIG.clergImage}
          pageTitle="Confession/Appointments"
        />

        {/* Meta info — same as custom version */}
        <MetaInfo
          duration={CONFESSION_CONFIG.appointmentDuration}
          location={CONFESSION_CONFIG.location}
        />

        {/* Calendly inline widget */}
        <div
          className="calendly-inline-widget w-full rounded-2xl overflow-hidden border border-gray-100 shadow-soft"
          data-url={CALENDLY_URL}
          style={{ minWidth: '500px', height: '700px' }}
        />
      </div>
    </div>
  )
}
