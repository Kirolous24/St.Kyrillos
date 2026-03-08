'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { cn } from '@/lib/utils'

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  category: string
  questions: readonly FAQItem[]
}

interface FAQAccordionProps {
  categories: readonly FAQCategory[]
}

function AccordionItem({ question, answer }: FAQItem) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-soft border-l-4 transition-all duration-300',
        isOpen ? 'border-l-gold shadow-soft-lg' : 'border-l-transparent hover:border-l-gold/50'
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left gap-4"
        aria-expanded={isOpen}
      >
        <h4 className="font-semibold text-lg text-gray-900">{question}</h4>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-primary-900 flex-shrink-0 transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <p className="px-6 pb-6 text-gray-600 leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  )
}

export function FAQAccordion({ categories }: FAQAccordionProps) {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <div ref={ref} className={isVisible ? 'animate-fade-in-up' : 'opacity-0'}>
      {categories.map((category) => (
        <div key={category.category} className="mb-12 last:mb-0">
          <h3 className="font-serif text-heading-3 text-primary-900 mb-6">
            {category.category}
          </h3>
          <div className="space-y-4">
            {category.questions.map((faq, idx) => (
              <AccordionItem key={idx} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
