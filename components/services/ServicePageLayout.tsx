import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { ImageCarousel } from './ImageCarousel'

export interface InfoCard {
  icon: LucideIcon
  title: string
  content: ReactNode
}

export interface CarouselImage {
  src: string
  alt: string
  position?: string
}

interface ServicePageLayoutProps {
  title: string
  subtitle: string
  heroImage?: string
  description: string
  infoCards: InfoCard[]
  images?: CarouselImage[]
  carouselTitle?: string
  extraContent?: ReactNode
}

export function ServicePageLayout({
  title,
  subtitle,
  heroImage,
  description,
  infoCards,
  images,
  carouselTitle,
  extraContent,
}: ServicePageLayoutProps) {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden flex flex-col" style={{ minHeight: '75vh' }}>
        {heroImage && (
          <Image
            src={heroImage}
            alt={title}
            fill
            className="object-cover"
            priority
          />
        )}

        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: heroImage
              ? 'linear-gradient(150deg, rgba(74,28,35,0.88) 0%, rgba(114,47,55,0.65) 40%, rgba(20,10,10,0.78) 100%)'
              : 'linear-gradient(150deg, #4a1c23 0%, #722f37 45%, #1a1010 100%)',
          }}
        />

        {/* Title block */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center text-white px-6 flex-1"
          style={{ minHeight: '75vh' }}
        >
          {/* Gold ornament */}
          <div className="flex items-center gap-3 mb-7">
            <div className="h-px w-14 bg-gradient-to-r from-transparent to-gold/70" />
            <Image src="/images/CC5.png" alt="" width={16} height={16} className="opacity-55 w-4 h-4" />
            <div className="h-px w-14 bg-gradient-to-l from-transparent to-gold/70" />
          </div>

          <h1 className="font-serif text-display-2 md:text-display-1 mb-5 drop-shadow-lg tracking-tight">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-lg font-sans tracking-wide leading-relaxed">
            {subtitle}
          </p>
        </div>
      </section>

      {/* ── DESCRIPTION ──────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-white">
        <div className="container-custom max-w-2xl text-center">
          <p className="text-body-lg text-gray-600 leading-[1.85]">{description}</p>
        </div>
      </section>

      {/* ── INFO CARDS ────────────────────────────────────────── */}
      <section className="py-16 md:py-20" style={{ background: '#faf7f2' }}>
        <div className="container-custom max-w-5xl">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gold/20">
            {infoCards.map((card, i) => {
              const Icon = card.icon
              return (
                <div key={i} className="px-8 py-8 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-gold/35 bg-white flex items-center justify-center flex-shrink-0 shadow-soft">
                      <Icon className="w-5 h-5 text-primary-900" />
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-gray-900">{card.title}</h3>
                  </div>
                  <div className="text-gray-600 text-sm leading-relaxed pl-[52px]">
                    {card.content}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── EXTRA CONTENT ─────────────────────────────────────── */}
      {extraContent && (
        <section className="py-16 md:py-20 bg-white">
          <div className="container-custom max-w-5xl">{extraContent}</div>
        </section>
      )}

      {/* ── CAROUSEL ──────────────────────────────────────────── */}
      {images && images.length > 0 && (
        <ImageCarousel images={images} title={carouselTitle} />
      )}

      {/* ── BACK FOOTER ───────────────────────────────────────── */}
      <section className="py-10 bg-gray-50 border-t border-gray-200">
        <div className="container-custom">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-primary-900 hover:text-gold font-medium text-sm transition-colors duration-200 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
            Back to All Services
          </Link>
        </div>
      </section>
    </>
  )
}
