'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Users, BookOpen, Music, Heart, ShoppingBag, UtensilsCrossed, ArrowRight } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

const services = [
  {
    id: 'sunday-school',
    title: 'Sunday School',
    icon: BookOpen,
    shortDescription: 'Religious education for all ages',
    href: '/services/sunday-school',
    imageSrc: '/images/sunday-school.jpg',
  },
  {
    id: 'hymns',
    title: 'Hymns & Chanting',
    icon: Music,
    shortDescription: 'Learning the sacred songs of the Church',
    href: '/services/hymns',
    imageSrc: '/images/cymbals-triangle.jpg',
  },
  {
    id: 'youth-meeting',
    title: 'Youth Meeting',
    icon: Users,
    shortDescription: 'Fellowship and spiritual growth for young adults',
    href: '/services/youth-meeting',
    imageSrc: '/images/youth2.jpeg',
  },
  {
    id: 'mens-meeting',
    title: "Men's Meeting",
    icon: Users,
    shortDescription: 'Brotherhood and spiritual development',
    href: '/services/mens-meeting',
    imageSrc: '/images/bible-study.jpg',
  },
  {
    id: 'womens-meeting',
    title: "Women's Meeting",
    icon: Heart,
    shortDescription: 'Community and spiritual nurturing',
    href: '/services/womens-meeting',
    imageSrc: '/images/congregation.jpg',
  },
  {
    id: 'choir',
    title: 'Choir',
    icon: Music,
    shortDescription: 'Praising God through sacred music, Kg through adult',
    href: '/services/choir',
    imageSrc: '/images/choir-singing.jpg',
  },
  {
    id: 'bookstore',
    title: 'Bookstore',
    icon: ShoppingBag,
    shortDescription: 'Coptic Orthodox books, icons, and faith resources',
    href: '/services/bookstore',
    imageSrc: '/images/Coptic_cross.jpg',
  },
  {
    id: 'kitchen-cleaning',
    title: 'Kitchen & Cleaning',
    icon: UtensilsCrossed,
    shortDescription: 'Serving the community through hospitality and care',
    href: '/services/kitchen-cleaning',
    imageSrc: '/images/kitchen-service.jpg',
  },
]

function ServicesGrid() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section className="section-padding bg-gray-50 relative">
      {/* Decorative cross watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
        <Image src="/images/CC3.png" alt="" width={400} height={400} className="w-96 h-96" />
      </div>

      <div className="container-custom relative z-10">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-4">
            <span className="inline-block w-12 h-1 bg-gold rounded-full" />
          </div>
          <h2 className="font-serif text-heading-1 md:text-display-2 text-gray-900 text-balance">
            All Services & Ministries
          </h2>
          <p className="mt-4 text-body-lg text-gray-600 max-w-2xl mx-auto">
            Every ministry is an invitation to grow closer to God and one another
          </p>
        </div>

        <div
          ref={ref}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${isVisible ? 'stagger-children' : ''}`}
        >
          {services.map((service) => {
            const Icon = service.icon
            return (
              <Link
                key={service.id}
                href={service.href}
                className="group bg-white rounded-xl overflow-hidden shadow-soft border border-gray-100 hover:shadow-soft-lg hover:border-primary-200 hover:-translate-y-1 transition-all duration-300"
              >
                {/* Card image */}
                <div className="relative aspect-[3/2] overflow-hidden">
                  <OptimizedImage
                    src={service.imageSrc}
                    alt={service.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    style={service.id === 'hymns' ? { objectPosition: '50% 55%' } : undefined}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  {/* Icon badge */}
                  <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-soft transition-all duration-300 group-hover:bg-gold group-hover:scale-110">
                    <Icon className="w-5 h-5 text-primary-900 group-hover:text-white transition-colors" />
                  </div>
                </div>

                {/* Card content */}
                <div className="p-5">
                  <h3 className="font-serif text-lg font-semibold text-gray-900 mb-1.5 group-hover:text-primary-900 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {service.shortDescription}
                  </p>
                  <span className="inline-flex items-center text-primary-900 font-medium text-sm gap-1.5 group-hover:gap-2.5 transition-all">
                    Learn More
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ScriptureBanner() {
  return (
    <section className="py-12 bg-primary-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_50%,_white_0%,_transparent_50%)]" />
      <div className="container-custom relative z-10 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
          <Image src="/images/CC5.png" alt="" width={24} height={24} className="w-6 h-6 opacity-30" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
        </div>
        <p className="font-serif text-lg md:text-xl italic text-gradient-gold max-w-3xl mx-auto leading-relaxed">
          &ldquo;For where two or three are gathered together in My name, I am there in the midst of them.&rdquo;
        </p>
        <p className="mt-3 text-white/40 text-sm tracking-widest uppercase">
          Matthew 18:20
        </p>
      </div>
    </section>
  )
}

export function ServicesContent() {
  return (
    <>
      <ServicesGrid />
      <ScriptureBanner />
    </>
  )
}
