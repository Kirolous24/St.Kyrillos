import type { Metadata } from 'next'
import Image from 'next/image'
import { Heart, CreditCard, Mail, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
            <div className="grid md:grid-cols-2 gap-8">
              {/* Online Giving */}
              <div className="bg-white rounded-2xl p-8 shadow-soft border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-6">
                  <CreditCard className="w-8 h-8 text-primary-900" />
                </div>
                <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                  Give Online
                </h2>
                <p className="text-gray-600 mb-6">
                  Make a one-time or recurring donation securely online. You can
                  give via credit card, debit card, or bank transfer.
                </p>
                <Button
                  href={GIVING.onlineUrl}
                  external
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Give Now
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <p className="text-gray-500 text-sm mt-4 text-center">
                  Secure payment powered by [Tithe.ly/Givelify/PayPal]
                </p>
              </div>

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
