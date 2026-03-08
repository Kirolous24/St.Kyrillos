'use client'

import Image from 'next/image'
import { FAQAccordion } from '@/components/im-new/FAQAccordion'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FAQS } from '@/lib/constants'

function FAQSection() {
  return (
    <section className="section-padding bg-gray-50 relative overflow-hidden">
      {/* Decorative watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
        <Image src="/images/CC3.png" alt="" width={400} height={400} className="w-96 h-96" />
      </div>

      <div className="container-custom relative z-10">
        <SectionHeader
          title="Frequently Asked Questions"
          withAccent
        />

        <div className="max-w-3xl mx-auto">
          <FAQAccordion categories={FAQS} />
        </div>
      </div>
    </section>
  )
}

export function ImNewContent() {
  return (
    <>
      <section className="relative h-[60vh] md:h-[70vh] overflow-hidden">
        <Image
          src="/images/new_church2.jpg"
          alt="St. Kyrillos the Sixth Coptic Orthodox Church"
          fill
          className="object-cover"
          priority
        />
      </section>

      <FAQSection />
    </>
  )
}
