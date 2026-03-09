import type { Metadata } from 'next'
import { CopticOrthodoxyContent } from '@/components/about/CopticOrthodoxyContent'

export const metadata: Metadata = {
  title: 'What is the Coptic Orthodox Church?',
  description: 'Learn about the Coptic Orthodox Church — one of the oldest Christian churches in the world, founded by St. Mark the Evangelist in Egypt.',
}

export default function CopticOrthodoxyPage() {
  return <CopticOrthodoxyContent />
}
