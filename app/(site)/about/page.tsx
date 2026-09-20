import { redirect } from 'next/navigation'

// Redirect /about to /about/coptic-orthodoxy
export default function AboutPage() {
  redirect('/about/coptic-orthodoxy')
}
