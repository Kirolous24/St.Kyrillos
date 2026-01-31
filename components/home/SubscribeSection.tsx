import { SubscribeForm } from '@/components/forms/SubscribeForm'
import { Bell, Mail, Sparkles } from 'lucide-react'

export function SubscribeSection() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-primary-900 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
      </div>

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2.5a2.5 2.5 0 0 1 5 0V16h15v2H25v2.5a2.5 2.5 0 0 1-5 0z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`
      }} />

      <div className="container-custom relative">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-gold text-sm font-medium mb-8 border border-white/10">
            <Bell className="w-4 h-4" />
            <span>Newsletter</span>
          </div>

          <h2 className="font-serif text-4xl md:text-5xl text-white mb-6">
            Stay <span className="text-gold">Connected</span>
          </h2>
          <p className="text-xl text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
            Receive updates about services, events, and spiritual resources from our community.
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            {[
              { icon: Mail, label: 'Weekly updates' },
              { icon: Sparkles, label: 'Event announcements' },
              { icon: Bell, label: 'Service reminders' },
            ].map((feature) => (
              <div key={feature.label} className="flex items-center gap-2 text-white/60 text-sm">
                <feature.icon className="w-4 h-4 text-gold" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>

          <div className="max-w-md mx-auto">
            <SubscribeForm variant="dark" />
          </div>

          <p className="text-white/40 text-sm mt-6">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>
  )
}
