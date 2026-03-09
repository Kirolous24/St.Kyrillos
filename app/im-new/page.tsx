import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'
import { ImNewContent } from '@/components/im-new/ImNewContent'

export const metadata: Metadata = {
  title: "I'm New - What to Expect",
  description: `Planning your first visit to ${CHURCH_INFO.name}? Learn what to expect, what to wear, service times, and answers to common questions about visiting a Coptic Orthodox church.`,
}

export default function ImNewPage() {
  return <ImNewContent />
}
