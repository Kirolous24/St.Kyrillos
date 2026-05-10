import type { Metadata } from 'next'
import Image from 'next/image'
import { Heart, Mail } from 'lucide-react'
import ZelleCard from '@/components/give/ZelleCard'
import { CHURCH_INFO, GIVING } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Give',
  description: `Support ${CHURCH_INFO.fullName} through online giving or by mail. Your generosity sustains our ministries and mission.`,
}

function FiligreeRule() {
  return (
    <div className="flex items-center justify-center gap-3 text-gold/70" aria-hidden>
      <span className="h-px w-16 md:w-24 bg-gradient-to-r from-transparent via-gold/60 to-gold/60" />
      <span className="text-xs tracking-[0.4em]">✦</span>
      <span className="h-px w-16 md:w-24 bg-gradient-to-l from-transparent via-gold/60 to-gold/60" />
    </div>
  )
}

export default function GivePage() {
  return (
    <>
      {/* Hero — compact, fades into parchment body via gold rule */}
      <section className="relative pt-16 pb-12 md:pt-20 md:pb-14 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <div className="relative flex items-center justify-center gap-8 mb-3">
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-20 h-20 opacity-40"
              />
              <h1 className="font-serif text-display-2 md:text-display-1">
                Support Our Church
              </h1>
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-20 h-20 opacity-40"
              />
            </div>
            <p className="text-lg text-white/75">
              Your generosity sustains our ministries and mission
            </p>
          </div>
        </div>
      </section>

      {/* Continuous parchment body — scripture + giving panel + closing all share one surface */}
      <section className="relative bg-[#faf6ec] py-16 md:py-24">
        <div className="container-custom">
          {/* Scripture — sits on the same surface, framed by ornamental rules */}
          <div className="max-w-2xl mx-auto text-center">
            <FiligreeRule />
            <blockquote className="font-serif text-2xl md:text-3xl text-gray-800 italic leading-relaxed mt-8 mb-6">
              &ldquo;{GIVING.scripture.text}&rdquo;
            </blockquote>
            <cite className="block text-gold-dark font-semibold tracking-wide not-italic text-sm uppercase">
              {GIVING.scripture.reference}
            </cite>
          </div>

          {/* Unified giving panel — three methods inside one frame, separated by hairlines */}
          <div className="max-w-6xl mx-auto mt-16 md:mt-20">
            <div className="bg-white rounded-3xl border border-gold/25 shadow-[0_30px_80px_-40px_rgba(74,28,35,0.35)] overflow-hidden">
              <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-primary-100/70">
                {/* PayPal */}
                <div className="p-8 md:p-10 flex flex-col">
                  <div className="w-14 h-14 rounded-full bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center mb-6">
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.99l-.225 1.43a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.308-4.385z" fill="#009CDE"/>
                      <path d="M6.237 8.863a.868.868 0 0 1 .859-.736h5.49c.65 0 1.256.042 1.813.13a7.657 7.657 0 0 1 1.147.279 4.79 4.79 0 0 1 .824.45c.043.028.085.058.126.089.483-3.076-.004-5.17-1.67-7.063C12.966.053 10.276 0 7.116 0H1.562C.999 0 .515.43.426 1.01L.002 3.748v.167c.003-.003.006-.003.01 0l.843-5.348h5.382v.296z" fill="#003087"/>
                    </svg>
                  </div>
                  <h2 className="font-serif text-heading-3 text-gray-900 mb-3">
                    Give Online
                  </h2>
                  <p className="text-gray-600 mb-6 flex-grow">
                    Make a secure donation via PayPal — using your account, credit card, or debit card.
                  </p>
                  <a
                    href="https://www.paypal.com/paypalme/stkyrillosnashville"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full bg-[#0070BA] hover:bg-[#005ea6] text-white font-semibold py-3.5 px-6 rounded-xl transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.99l-.225 1.43a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.308-4.385z"/>
                    </svg>
                    Donate with PayPal
                  </a>
                  <p className="text-gray-400 text-xs mt-4 text-center">
                    Secure payment powered by PayPal
                  </p>
                </div>

                <ZelleCard />

                {/* Check */}
                <div className="p-8 md:p-10 flex flex-col">
                  <div className="w-14 h-14 rounded-full bg-gold/15 ring-1 ring-gold/30 flex items-center justify-center mb-6">
                    <Mail className="w-7 h-7 text-gold-dark" />
                  </div>
                  <h2 className="font-serif text-heading-3 text-gray-900 mb-3">
                    Give by Check
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Mail your contribution to our church office. Make checks payable to:
                  </p>
                  <div className="rounded-lg border border-dashed border-gold/40 bg-gold/5 p-4 mb-4">
                    <p className="font-serif font-semibold text-gray-900 mb-2">
                      {GIVING.checkPayableTo}
                    </p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {CHURCH_INFO.address.street}<br />
                      {CHURCH_INFO.address.city}, {CHURCH_INFO.address.state} {CHURCH_INFO.address.zip}
                    </p>
                  </div>
                  <p className="text-gray-400 text-xs mt-auto text-center">
                    Donations by check are processed weekly
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Closing prayer — same parchment surface, no dark break */}
          <div className="max-w-2xl mx-auto text-center mt-20 md:mt-24">
            <FiligreeRule />
            <Heart className="w-9 h-9 text-gold mx-auto mt-8 mb-5" strokeWidth={1.5} />
            <h2 className="font-serif text-heading-2 text-primary-950 mb-4">
              Thank You for Your Generosity
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed">
              Every gift, large or small, makes a difference. Your support enables
              us to continue serving our community and sharing the Orthodox faith.
              May God bless your faithfulness.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
