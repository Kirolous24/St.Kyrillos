'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FAQS } from '@/lib/constants'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left py-6 flex items-start justify-between gap-4 hover:text-primary-900 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-lg">{question}</span>
        <span className={`text-xl text-primary-900 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="pb-6 text-gray-600 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  )
}

function FAQCategory({ category }: { category: { readonly category: string; readonly questions: readonly { readonly question: string; readonly answer: string }[] } }) {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <div ref={ref} className={`mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <h2 className="font-serif text-3xl text-gray-900 mb-8 pb-4 border-b-2 border-gold/40">{category.category}</h2>
      <div className="space-y-0">
        {category.questions.map((item, idx) => (
          <FAQItem key={idx} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  )
}

export function FAQPageContent() {
  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header with Small Image */}
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center mb-16">
            {/* Left: Image */}
            <div className="md:col-span-1">
              <div className="relative w-full h-64 rounded-lg overflow-hidden shadow-soft">
                <Image
                  src="/images/alter-jesus.jpg"
                  alt="Christ in the sanctuary"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Right: Welcome Text */}
            <div className="md:col-span-2">
              <h1 className="font-serif text-4xl md:text-5xl text-gray-900 mb-6">Welcome</h1>
              <blockquote className="italic text-gray-700 text-lg leading-relaxed border-l-4 border-gold pl-6">
                "Now therefore, you are no longer strangers and foreigners, but fellow citizens with the saints and members of the household of God, having been built on the foundation of the apostles and prophets, Jesus Christ Himself being the chief cornerstone."
                <footer className="mt-3 text-gray-600 not-italic font-semibold">(Ephesians 2:19-20)</footer>
              </blockquote>
            </div>
          </div>

          {/* Main Heading */}
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl text-gray-900">Frequently Asked Questions</h2>
          </div>

          {/* FAQ Content */}
          <div className="max-w-3xl mx-auto">
            {FAQS.map((category, idx) => (
              <FAQCategory key={idx} category={category} />
            ))}
          </div>

          {/* Footer CTA */}
          <div className="mt-20 pt-16 border-t border-gray-200 text-center">
            <h3 className="font-serif text-2xl text-gray-900 mb-4">Still have questions?</h3>
            <p className="text-gray-600 mb-8">
              Our clergy are always available to discuss your questions about our faith and community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/about/clergy"
                className="px-8 py-3 bg-gold hover:bg-gold-light text-primary-950 font-semibold rounded transition-colors"
              >
                Contact Our Clergy
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
