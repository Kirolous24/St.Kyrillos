import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'
import { MembershipForm } from './MembershipForm'
import { CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Join Our Church',
  description: `Become a member of ${CHURCH_INFO.fullName}. Fill out our membership form to get connected.`,
}

const STEPS = [
  { step: '1', label: 'Submit the form below' },
  { step: '2', label: 'Fr. Pachom will reach out to you' },
  { step: '3', label: 'Welcome to the family!' },
]

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <section className="relative py-20 md:py-28 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(ellipse_at_top_right,_white_0%,_transparent_60%)]" />
        <div className="container-custom relative z-10 text-center">
          <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-4">St. Kyrillos the Sixth</p>
          <h1 className="font-serif text-4xl md:text-5xl text-white mb-5">Join Our Church Family</h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto leading-relaxed">
            We&apos;d love to welcome you. Fill out the form and Fr. Pachom will personally be in touch with you.
          </p>
        </div>
      </section>

      <div className="container-custom py-16">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_340px] gap-10 items-start">

          {/* Form */}
          <MembershipForm />

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-28">
            {/* What happens next */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
              <h3 className="font-serif text-lg font-semibold text-gray-900 mb-5">What happens next?</h3>
              <ol className="space-y-4">
                {STEPS.map(({ step, label }) => (
                  <li key={step} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{label}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* What's included */}
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6">
              <h3 className="font-serif text-base font-semibold text-primary-900 mb-4">As a member you can</h3>
              <ul className="space-y-2.5">
                {[
                  'Receive the Holy Sacraments',
                  'Participate in all ministries',
                  'Join Sunday School & youth groups',
                  'Connect with our community',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-primary-800">
                    <CheckCircle2 className="w-4 h-4 text-primary-700 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
              <h3 className="font-serif text-base font-semibold text-gray-900 mb-1">Questions?</h3>
              <p className="text-sm text-gray-500 mb-3">Reach Fr. Pachom directly.</p>
              <a
                href="mailto:fr.pachom@stkyrillostn.org"
                className="text-sm font-medium text-primary-900 hover:underline"
              >
                fr.pachom@stkyrillostn.org
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
