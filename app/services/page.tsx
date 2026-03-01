import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Users, BookOpen, Music, Heart, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Church Services',
  description: `Explore the various ministries and services offered at ${CHURCH_INFO.fullName}. From Sunday School to community groups.`,
}

const services = [
  {
    id: 'sunday-school',
    title: 'Sunday School',
    icon: BookOpen,
    shortDescription: 'Religious education for all ages',
    href: '/services/sunday-school',
  },
  {
    id: 'hymns',
    title: 'Hymns & Chanting',
    icon: Music,
    shortDescription: 'Learning the sacred songs of the Church',
    href: '/services/hymns',
  },
  {
    id: 'youth-meeting',
    title: 'Youth Meeting',
    icon: Users,
    shortDescription: 'Fellowship and spiritual growth for young adults',
    href: '/services/youth-meeting',
  },
  {
    id: 'mens-meeting',
    title: "Men's Meeting",
    icon: Users,
    shortDescription: 'Brotherhood and spiritual development',
    href: '/services/mens-meeting',
  },
  {
    id: 'womens-meeting',
    title: "Women's Meeting",
    icon: Heart,
    shortDescription: 'Community and spiritual nurturing',
    href: '/services/womens-meeting',
  },
  {
    id: 'choir',
    title: 'Choir',
    icon: Music,
    shortDescription: 'Praising God through sacred music — Kg through adult',
    href: '/services/choir',
  },
  {
    id: 'bookstore',
    title: 'Bookstore',
    icon: ShoppingBag,
    shortDescription: 'Coptic Orthodox books, icons, and faith resources',
    href: '/services/bookstore',
  },
  {
    id: 'kitchen-cleaning',
    title: 'Kitchen & Cleaning',
    icon: UtensilsCrossed,
    shortDescription: 'Serving the community through hospitality and care',
    href: '/services/kitchen-cleaning',
  },
]

export default function ServicesPage() {
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
                Our Services & Ministries
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
              Discover the many ways to grow spiritually and connect with our community
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {services.map((service) => {
              const Icon = service.icon
              return (
                <Link
                  key={service.id}
                  href={service.href}
                  className="group bg-white rounded-xl p-8 shadow-soft border border-gray-100 hover:shadow-soft-lg hover:border-primary-200 transition-all duration-300"
                >
                  <div className="mb-4 p-3 w-fit rounded-lg bg-primary-100 group-hover:bg-primary-200 transition-colors">
                    <Icon className="w-6 h-6 text-primary-900" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-900 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {service.shortDescription}
                  </p>
                  <span className="inline-flex items-center text-primary-900 font-medium text-sm group-hover:gap-2 gap-1 transition-all">
                    Learn More →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="section-padding bg-gradient-to-r from-primary-900 to-primary-950">
        <div className="container-custom text-center text-white">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">
            Ready to Get Involved?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Whether you're looking to deepen your faith, serve the community, or connect with others, there's a place for you here.
          </p>
        </div>
      </section>
    </>
  )
}
