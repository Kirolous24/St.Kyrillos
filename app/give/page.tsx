import type { Metadata } from 'next'
import Image from 'next/image'
import { Heart, Mail } from 'lucide-react'
import ZelleCard from '@/components/give/ZelleCard'
import { CHURCH_INFO, GIVING } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Give',
  description: `Support ${CHURCH_INFO.fullName} through online giving or by mail. Your generosity sustains our ministries and mission.`,
}

export default function GivePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            {/* Coptic Crosses */}
            <div className="relative flex items-center justify-center gap-8 mb-4">
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-24 h-24 opacity-40"
              />
              <h1 className="font-serif text-display-2 md:text-display-1">
                Support Our Church
              </h1>
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-24 h-24 opacity-40"
              />
            </div>
            <p className="text-xl text-white/80">
              Your generosity sustains our ministries and mission
            </p>
          </div>
        </div>
      </section>

      {/* Scripture */}
      <section className="py-12 bg-gold/10">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center">
            <blockquote className="font-serif text-xl md:text-2xl text-gray-700 italic leading-relaxed">
              "{GIVING.scripture.text}"
            </blockquote>
            <cite className="block mt-4 text-gold font-semibold not-italic">
              — {GIVING.scripture.reference}
            </cite>
          </div>
        </div>
      </section>

      {/* Giving Options */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Online Giving */}
              <div className="bg-white rounded-2xl p-8 shadow-soft border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-6">
                  {/* PayPal logo */}
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.99l-.225 1.43a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.308-4.385z" fill="#009CDE"/>
                    <path d="M6.237 8.863a.868.868 0 0 1 .859-.736h5.49c.65 0 1.256.042 1.813.13a7.657 7.657 0 0 1 1.147.279 4.79 4.79 0 0 1 .824.45c.043.028.085.058.126.089.483-3.076-.004-5.17-1.67-7.063C12.966.053 10.276 0 7.116 0H1.562C.999 0 .515.43.426 1.01L.002 3.748v.167c.003-.003.006-.003.01 0l.843-5.348h5.382v.296z" fill="#003087"/>
                  </svg>
                </div>
                <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                  Give Online
                </h2>
                <p className="text-gray-600 mb-6">
                  Make a secure donation via PayPal. You can give using your
                  PayPal account, credit card, or debit card.
                </p>
                <a
                  href="https://www.paypal.com/paypalme/stkyrillosnashville"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full bg-[#0070BA] hover:bg-[#005ea6] text-white font-semibold text-lg py-4 px-6 rounded-xl transition-colors duration-200"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.99l-.225 1.43a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.308-4.385z"/>
                  </svg>
                  Donate with PayPal
                </a>
                <p className="text-gray-500 text-sm mt-4 text-center">
                  Secure payment powered by PayPal
                </p>
              </div>

              <ZelleCard />

              {/* Give by Check */}
              <div className="bg-white rounded-2xl p-8 shadow-soft border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mb-6">
                  <Mail className="w-8 h-8 text-gold" />
                </div>
                <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                  Give by Check
                </h2>
                <p className="text-gray-600 mb-6">
                  Mail your contribution to our church office. Make checks
                  payable to:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="font-semibold text-gray-900 mb-2">
                    {GIVING.checkPayableTo}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {CHURCH_INFO.address.street}<br />
                    {CHURCH_INFO.address.city}, {CHURCH_INFO.address.state} {CHURCH_INFO.address.zip}
                  </p>
                </div>
                <p className="text-gray-500 text-sm">
                  Donations by check are processed weekly.
                </p>
              </div>
            </div>

            {/* What Your Giving Supports */}
            <div className="mt-16">
              <div className="text-center mb-10">
                <h2 className="font-serif text-heading-2 text-gray-900 mb-4">
                  What Your Giving Supports
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Your tithes and offerings help us fulfill our mission in the
                  following ways:
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Heart, label: 'Worship & Sacraments', description: 'Liturgy supplies, altar needs' },
                  { icon: Heart, label: 'Education & Formation', description: 'Sunday School, Bible studies' },
                  { icon: Heart, label: 'Facilities & Operations', description: 'Building maintenance, utilities' },
                  { icon: Heart, label: 'Outreach & Service', description: 'Community support, charitable giving' },
                ].map((item, idx) => (
                  <div key={idx} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-6 h-6 text-primary-900" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {item.label}
                    </h3>
                    <p className="text-gray-500 text-sm">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Thank You */}
      <section className="section-padding bg-primary-900">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center text-white">
            <Heart className="w-12 h-12 text-gold mx-auto mb-6" />
            <h2 className="font-serif text-heading-2 mb-4">
              Thank You for Your Generosity
            </h2>
            <p className="text-white/80 text-lg">
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
