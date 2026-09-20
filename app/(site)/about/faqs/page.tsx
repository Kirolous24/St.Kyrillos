import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'
import { FAQPageContent } from '@/components/faqs/FAQContent'

export const metadata: Metadata = {
  title: 'FAQs - Frequently Asked Questions',
  description: `Find answers to common questions about visiting St. Kyrillos the Sixth Coptic Orthodox Church. Learn what to expect, what to wear, service times, and more.`,
}

export default function FAQPage() {
  return <FAQPageContent />
}
