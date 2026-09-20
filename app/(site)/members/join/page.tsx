import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'
import { MembershipForm } from './MembershipForm'

export const metadata: Metadata = {
  title: 'Join Our Church',
  description: `Become a member of ${CHURCH_INFO.fullName}. Fill out our membership form to get connected.`,
}

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
        <div className="max-w-2xl mx-auto">
          <MembershipForm />
        </div>
      </div>
    </div>
  )
}
