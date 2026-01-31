import { Button } from '@/components/ui/Button'
import { Cross, Heart, BookOpen } from 'lucide-react'

export function WelcomeSection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary-50 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-50" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl opacity-50" />

      <div className="container-custom relative">
        <div className="max-w-4xl mx-auto">
          {/* Section header with decorative elements */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold" />
              <Cross className="w-5 h-5 text-gold" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold" />
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-gray-900 mb-4">
              Welcome <span className="text-gradient-gold">Home</span>
            </h2>
            <p className="text-gray-500 text-lg">A place of faith, worship, and community</p>
          </div>

          {/* Content with better typography */}
          <div className="space-y-6 text-lg text-gray-600 text-center leading-relaxed">
            <p>
              St. Kyrillos the Sixth Coptic Orthodox Church is a community of faith
              in Antioch, Tennessee, part of the{' '}
              <a
                href="https://www.suscopts.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-900 hover:text-gold transition-colors font-medium underline decoration-gold/30 hover:decoration-gold underline-offset-4"
              >
                Coptic Orthodox Diocese of the Southern United States
              </a>
              .
            </p>

            <p>
              We are an ancient Christian church tracing our roots to St. Mark the
              Evangelist, who brought Christianity to Egypt in the first century.
              Today, we continue that{' '}
              <span className="font-semibold text-primary-900">2,000-year tradition</span>{' '}
              of worship, fellowship, and service.
            </p>

            <p className="text-xl">
              Whether you&apos;re exploring Orthodoxy for the first time, returning to
              the faith, or looking for a spiritual home,{' '}
              <span className="font-serif italic text-primary-900">you are welcome here</span>.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 mb-12">
            {[
              { icon: Cross, label: 'Ancient Faith', desc: '2,000 years of tradition' },
              { icon: Heart, label: 'Warm Community', desc: 'A family in Christ' },
              { icon: BookOpen, label: 'Living Liturgy', desc: 'Worship that transforms' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center text-center p-6 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-primary-900" />
                </div>
                <h3 className="font-serif font-semibold text-gray-900 mb-1">{item.label}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/about/coptic-orthodoxy" variant="primary" className="group">
              <span>Learn About Coptic Orthodoxy</span>
            </Button>
            <Button href="/about/clergy" variant="secondary">
              Meet Our Clergy
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
