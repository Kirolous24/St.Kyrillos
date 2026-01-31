import Link from 'next/link'
import { Calendar, Users, MapPin, PlayCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const actions = [
  {
    icon: Users,
    title: 'Plan Your Visit',
    description: 'New to Orthodoxy? Learn what to expect when you join us.',
    href: '/im-new',
    gradient: 'from-primary-100 to-primary-50',
    iconBg: 'bg-primary-900',
  },
  {
    icon: Calendar,
    title: 'Service Schedule',
    description: 'Sunday Liturgy, weekday services, and upcoming events.',
    href: '/schedule',
    gradient: 'from-gold/20 to-gold/5',
    iconBg: 'bg-gold',
  },
  {
    icon: MapPin,
    title: 'Find Us',
    description: 'Get directions, parking info, and contact details.',
    href: '/contact',
    gradient: 'from-primary-100 to-primary-50',
    iconBg: 'bg-primary-900',
  },
  {
    icon: PlayCircle,
    title: 'Watch Live',
    description: 'Join us online for livestreamed services.',
    href: '/media/livestream',
    gradient: 'from-gold/20 to-gold/5',
    iconBg: 'bg-gold',
  },
]

export function QuickActions() {
  return (
    <section className="relative -mt-24 z-20 pb-16">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {actions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className="group block"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div
                className={cn(
                  "relative h-full p-6 rounded-2xl bg-white shadow-soft-lg",
                  "border border-gray-100 overflow-hidden",
                  "transition-all duration-500 ease-out",
                  "hover:shadow-soft-xl hover:-translate-y-2 hover:border-gold/30"
                )}
              >
                {/* Background gradient on hover */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  action.gradient
                )} />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-5",
                    "transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                    action.iconBg
                  )}>
                    <action.icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-900 transition-colors">
                    {action.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {action.description}
                  </p>

                  {/* Link indicator */}
                  <div className="flex items-center gap-2 text-gold font-semibold text-sm">
                    <span className="group-hover:mr-1 transition-all duration-300">Learn more</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>

                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-gold/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
