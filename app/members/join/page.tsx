import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'
import { MembershipForm } from './MembershipForm'

export const metadata: Metadata = {
  title: 'Join Our Church',
  description: `Become a member of ${CHURCH_INFO.fullName}. Fill out our membership form to get connected.`,
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative py-16 md:py-20 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Join Our Church
            </h1>
            <p className="text-lg text-white/80">
              We&apos;re glad you want to connect with us. Fill out the form below
              and Fr. Pachom will be in touch with you.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto">
            <MembershipForm />
          </div>
        </div>
      </section>
    </div>
  )
}
